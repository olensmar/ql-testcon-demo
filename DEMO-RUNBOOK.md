# Demo runbook

## The day before

- [ ] `minikube status` shows it running, and the Testkube runner agent is connected (`testkube get agents` or the dashboard)
- [ ] `./scripts/setup.sh`: all 6 baseline runs on `main` pass
- [ ] Do two full rehearsals: `./scripts/reset-demo.sh`, then `npm run loop -- --pr <n>`. Note the timings.
- [ ] Remove unrelated workflows from the environment (old `ql-demo-*` workflows) so the dashboard is clean

## 15 minutes before

- [ ] `./scripts/prewarm.sh` (images may have been evicted)
- [ ] `testkube mcp serve` works: run `cd agents && npm run setup` (it is idempotent)
- [ ] Credentials: `gh auth status`, plus `ANTHROPIC_API_KEY` exported (or a Claude Code login)
- [ ] `./scripts/reset-demo.sh`, so a fresh PR is open but **not** yet processed. Alternatively, start `npm run watch` and run reset live on stage.
- [ ] Screen layout:
  - Left: terminal (large font) in `agents/`
  - Right top: the PR on GitHub (conversation tab)
  - Right bottom: Testkube dashboard, Test Workflows filtered by `demo=testcon`
  - Optional: `kubectl get pods -n default-runner-agent -w` to show shard and worker pods appearing

## On stage (about 5 minutes of loop)

| Phase | What to point at |
|---|---|
| Select | The plan prints in the terminal and is posted as a PR comment: **4 of 6** workflows, with reasons for each skip. "No CI config decided this; the agent read the diff and the test metadata via MCP." |
| Execute | Pods fan out in the Testkube dashboard and kubectl: Playwright shards and k6 workers, all in parallel. The app is started from source per run, with no image build. |
| Results | Unit tests pass. API and E2E checkout **fail**: "unit tests alone would have let this through". |
| Triage | Two Opus agents in parallel read logs and artifacts through MCP. Verdict: *product bug*, discount computed on subtotal + shipping. Show the `triage=product-bug` tag on the execution in the dashboard. |
| Remediate | One-line fix plus a regression unit test, committed and pushed to the PR branch. |
| Verify | The same plan runs on the new SHA; all green. |
| Gate | The `quality-gate` commit status turns green and a final PR comment appears (verdict, confidence, what happened). In the Testkube dashboard, filter executions by tag `pr=<n>` to show the full trail. |

## If something goes wrong

- **GitHub or network hiccup:** `gh` calls retry automatically. Re-running `npm run loop -- --pr <n>` is safe; the agents re-plan from the PR's current head.
- **A workflow aborted (image pull or scheduling):** the Executor retries infra failures once on its own. Otherwise run `./scripts/prewarm.sh`.
- **The PR is already fixed from a previous run:** run `./scripts/reset-demo.sh` for a fresh PR.
- **No Testkube MCP (CLI auth expired):** run `testkube login`, or export `TK_ACCESS_TOKEN`, `TK_ORG_ID` and `TK_ENV_ID` to use the hosted endpoint.
