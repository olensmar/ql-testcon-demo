#!/usr/bin/env bash
# Opens a fresh "Add discount codes at checkout" PR (with the planted bug) for a demo run.
# Closes any previous demo PR, restores the Testkube workflows (clears quarantine labels and
# fault injection) and recreates the branch from main + demo/discount-codes.patch.
#
#   ./scripts/reset-demo.sh            # bug only
#   ./scripts/reset-demo.sh --flaky    # bug + a flaky browse E2E run (fails once, passes on re-run)
#   ./scripts/reset-demo.sh --two-bugs # bug + a second UI bug that only shows once the first is fixed
#                                      # (the loop needs two fix rounds)
set -euo pipefail

FLAKY=false
TWO_BUGS=false
for arg in "$@"; do
  case "$arg" in
    --flaky) FLAKY=true ;;
    --two-bugs) TWO_BUGS=true ;;
    *) echo "unknown option: $arg"; exit 1 ;;
  esac
done

REPO="${DEMO_REPO:-olensmar/ql-testcon-demo}"
BRANCH="feature/discount-codes"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for n in $(gh pr list -R "$REPO" --head "$BRANCH" --state open --json number -q '.[].number'); do
  echo "closing previous demo PR #$n"
  gh pr close "$n" -R "$REPO" --comment "Superseded by a new demo run." >/dev/null
done

echo "restoring Testkube workflows"
(cd "$ROOT/agents" && npm run --silent setup >/dev/null)
if $FLAKY; then
  (cd "$ROOT/agents" && npm run --silent flake -- on)
fi

git fetch -q origin main
WT="$(mktemp -d)"
trap 'git worktree remove --force "$WT" 2>/dev/null || true' EXIT
git worktree add -q --detach "$WT" origin/main
git -C "$WT" apply "$ROOT/demo/discount-codes.patch"
git -C "$WT" add -A
git -C "$WT" commit -q -m "feat(checkout): add discount codes" \
  -m "Customers can enter a discount code at checkout. SAVE10 and WELCOME20 take a percentage off the order. Includes unit, API and E2E tests."
if $TWO_BUGS; then
  # The order total ignores the discount; E2E only reaches this assertion once the discount is right.
  sed -i '' 's|\$("order-total").textContent = money(order.total);|$("order-total").textContent = money(order.subtotal + order.shipping);|' \
    "$WT/app/public/index.html"
  git -C "$WT" commit -qam "feat(checkout): show order total in summary"
fi
git -C "$WT" push -q -f origin "HEAD:refs/heads/$BRANCH"

gh pr create -R "$REPO" --head "$BRANCH" --base main \
  --title "Add discount codes at checkout" \
  --body "$(cat <<'BODY'
Adds percentage discount codes to checkout.

- `POST /api/checkout` accepts an optional `discountCode` (`SAVE10` = 10%, `WELCOME20` = 20%), case-insensitive
- The order summary shows the discount line, and the catalog shows a SAVE10 promo banner
- Invalid codes are rejected with a 400

Tests: unit tests for the new pricing logic (passing locally ✅), plus API and E2E coverage.
BODY
)"
