#!/usr/bin/env bash
# Opens a fresh "Add discount codes at checkout" PR (with the planted bug) for a demo run.
# Closes any previous demo PR and recreates the branch from main + demo/discount-codes.patch.
set -euo pipefail

REPO="${DEMO_REPO:-olensmar/ql-testcon-demo}"
BRANCH="feature/discount-codes"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for n in $(gh pr list -R "$REPO" --head "$BRANCH" --state open --json number -q '.[].number'); do
  echo "closing previous demo PR #$n"
  gh pr close "$n" -R "$REPO" --comment "Superseded by a new demo run." >/dev/null
done

git fetch -q origin main
WT="$(mktemp -d)"
trap 'git worktree remove --force "$WT" 2>/dev/null || true' EXIT
git worktree add -q --detach "$WT" origin/main
git -C "$WT" apply "$ROOT/demo/discount-codes.patch"
git -C "$WT" add -A
git -C "$WT" commit -q -m "feat(checkout): add discount codes" \
  -m "Customers can enter a discount code at checkout. SAVE10 and WELCOME20 take a percentage off the order. Includes unit, API and E2E tests."
git -C "$WT" push -q -f origin "HEAD:refs/heads/$BRANCH"

gh pr create -R "$REPO" --head "$BRANCH" --base main \
  --title "Add discount codes at checkout" \
  --body "$(cat <<'BODY'
Adds percentage discount codes to checkout.

- `POST /api/checkout` accepts an optional `discountCode` (`SAVE10` = 10%, `WELCOME20` = 20%), case-insensitive
- The order summary shows the discount line
- Invalid codes are rejected with a 400

Tests: unit tests for the new pricing logic (passing locally ✅), plus API and E2E coverage.
BODY
)"
