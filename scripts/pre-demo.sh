#!/usr/bin/env bash
# Puts everything into a known-good state before a rehearsal or the talk, then run
# ./scripts/reset-demo.sh [--flaky|--two-bugs] to open the demo PR.
#
#   ./scripts/pre-demo.sh              # checks, cleanup, workflows restored, green baseline on main
#   ./scripts/pre-demo.sh --skip-pull  # same, without pre-pulling the test images
#
# Safe to run repeatedly. Takes about 1-2 minutes (mostly the baseline run).
set -euo pipefail

REPO="${DEMO_REPO:-olensmar/ql-testcon-demo}"
RUNNER_NAMESPACE="${RUNNER_NAMESPACE:-default-runner-agent}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_PULL=false
[[ "${1:-}" == "--skip-pull" ]] && SKIP_PULL=true

# Setting from the environment, else from agents/.env.
setting() { local v="${!1:-}"; [[ -n "$v" ]] && { echo "$v"; return; }
            grep -E "^$1=" "$ROOT/agents/.env" 2>/dev/null | tail -1 | cut -d= -f2-; }
BACKEND="$(setting TESTKUBE_BACKEND)"; BACKEND="${BACKEND:-mcp}"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1/5 Prerequisites"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' \
  && ok "Node $(node --version)" || fail "Node >= 22.18 required (have $(node --version))"
gh auth status >/dev/null 2>&1 && ok "gh logged in" || fail "gh not logged in: run 'gh auth login'"
if [[ "$BACKEND" == "cli" ]]; then
  command -v testkube >/dev/null && ok "Testkube backend: CLI ($(testkube version 2>/dev/null | grep -o 'Client Version [^ ]*' || echo testkube))" \
    || fail "TESTKUBE_BACKEND=cli but the testkube CLI is not installed"
else
  [[ -n "$(setting TK_ACCESS_TOKEN)" ]] && ok "Testkube backend: hosted MCP, API token set" \
    || fail "agents/.env missing or without TK_ACCESS_TOKEN (see agents/.env.example)"
fi
[[ -d "$ROOT/agents/node_modules" ]] || (cd "$ROOT/agents" && npm ci --silent)
ok "agent dependencies installed"

step "2/5 Cluster"
if [[ "$BACKEND" == "cli" ]]; then
  KCFG="$(setting TK_CLI_KUBECONFIG)"; OSS_NS="$(setting TK_CLI_NAMESPACE)"; OSS_NS="${OSS_NS:-testkube}"
  kubectl ${KCFG:+--kubeconfig "$KCFG"} wait --for=condition=Ready pod --all -n "$OSS_NS" --timeout=60s >/dev/null \
    && ok "Testkube pods ready (namespace $OSS_NS${KCFG:+, $KCFG})" \
    || fail "Testkube pods in '$OSS_NS' not ready (check TK_CLI_KUBECONFIG / TK_CLI_NAMESPACE)"
  SKIP_PULL=true
else
  minikube status >/dev/null 2>&1 && ok "minikube running" || fail "minikube not running: run 'minikube start'"
  kubectl wait --for=condition=Ready pod --all -n "$RUNNER_NAMESPACE" --timeout=60s >/dev/null \
    && ok "Testkube runner agent ready (namespace $RUNNER_NAMESPACE)" \
    || fail "runner agent pods in '$RUNNER_NAMESPACE' not ready (set RUNNER_NAMESPACE if it lives elsewhere)"
fi
if $SKIP_PULL; then
  ok "skipped image pre-pull"
else
  "$ROOT/scripts/prewarm.sh" >/dev/null && ok "test images pulled into minikube"
fi

step "3/5 Leftovers from earlier runs"
open_prs=$(gh pr list -R "$REPO" --state open --json number -q '.[].number')  # demo PRs and warm-up PRs
for n in $open_prs; do
  gh pr close "$n" -R "$REPO" --comment "Closed before a new demo run." >/dev/null 2>&1
done
ok "open demo PRs closed (${open_prs:-none})"
(cd "$ROOT" && for wt in .worktrees/pr-*; do [[ -d "$wt" ]] && git worktree remove --force "$wt"; done; git worktree prune)
(cd "$ROOT" && git for-each-ref --format='%(refname:short)' 'refs/heads/demo/pr-*' | xargs -r git branch -q -D)
ok "PR worktrees and local demo branches removed"

step "4/5 Testkube (backend: $BACKEND)"
(cd "$ROOT/agents" && npm run --silent setup -- --run) | sed 's/^/    /' \
  && ok "workflows restored (no quarantine labels, fault injection off) and green on main" \
  || fail "baseline on main is not green: check the Testkube dashboard before demoing"

step "5/5 Ready"
cat <<NEXT
  Next: open a demo PR and run the loop
    ./scripts/reset-demo.sh            # bug only          (~3 min)
    ./scripts/reset-demo.sh --flaky    # bug + flaky test  (~4 min)
    ./scripts/reset-demo.sh --two-bugs # two fix rounds    (~5 min)
    cd agents && npm run loop -- --pr <number>     (or start 'npm run watch' first)
NEXT
