# Demo runbook

## Running a rehearsal

From the repo root (`~/Dev/ql-testcon-demo`).

0. Get to a known-good state: `./scripts/pre-demo.sh` (about 1 minute). It checks the prerequisites
   (Node, `gh`, the API token in `agents/.env`, minikube and the runner agent), pre-pulls the test
   images, closes leftover demo PRs and worktrees, restores the Testkube workflows and runs all six
   on `main`. It stops with a ✗ and a hint if anything isn't right. Add `--skip-pull` to skip the
   image pull.
1. Open a fresh demo PR. This also closes the previous demo PR and restores the Testkube workflows
   (removes quarantine labels, turns fault injection off):

   | Scenario | Command | Loop | Time | AI spend |
   |---|---|---|---|---|
   | Bug only | `./scripts/reset-demo.sh` | 1 fix round | ~3 min | ~$0.40 |
   | Bug + flaky browse test | `./scripts/reset-demo.sh --flaky` | 1 fix round + quarantine | ~4 min | ~$0.80 |
   | Two bugs (second shows after the first fix) | `./scripts/reset-demo.sh --two-bugs` | 2 fix rounds | ~5 min | ~$0.70 |

   It prints the PR URL; note the number.
2. Run the loop: `cd agents && npm run loop -- --pr <number>`.
   Or, to show it reacting to the PR: start `cd agents && npm run watch` first, then run step 1 in a
   second terminal; the watcher picks up the new PR within 5 seconds.
3. Watch: the terminal, the PR page on GitHub (comments, `quality-gate` status) and the Testkube
   dashboard (executions, filter by tag `pr=<number>`).
4. Afterwards: the AI spend table is at the end of the terminal output and in the final PR
   comment; `runs/pr-<number>.json` lists every agent session, the Testkube tools it could see and
   a `claude --resume` command to open its transcript.

### Warm-up: a one-line PR made live on GitHub (~2 min, ~$0.30)

A small first demo before the scripted scenarios: you make the change in the browser, and the
loop picks it up. It runs only 2 of the 6 workflows (the browser E2E suites), and one test fails.

1. In a terminal: `cd agents && npm run watch` (after `./scripts/pre-demo.sh`).
2. On GitHub, open `app/public/index.html` in olensmar/ql-testcon-demo and click the pencil icon.
3. Find line 69 (in `renderCart`):
   `const count = cart.items.reduce((n, i) => n + i.quantity, 0);`
   and change it to:
   `const count = cart.items.length;`
4. **Commit changes…** → message "Simplify cart badge count" → choose **Create a new branch for this
   commit and start a pull request** → **Propose changes** → **Create pull request**.
5. Within 5 seconds the watcher starts the loop. Expected: the Selector runs only `shop-e2e-browse`
   and `shop-e2e-checkout` and skips unit, API and load ("client-side rendering only"). Browse passes,
   and the checkout test that adds the same plushie twice fails (badge shows 2, expects 3). Triage
   pinpoints `index.html:69` as a product bug, the Remediator reverts the line, round 2 is green and
   the Gate passes.

Why it lands well: the unit and API tests would all pass; only an end-to-end test that adds the
same item twice catches it, and the agents only ran the tests that could.

With `--flaky`, don't run `shop-e2e-browse` between steps 1 and 2: the flake alternates by
execution number. Run one rehearsal within the hour before going on stage, so the prompt cache is
warm and the live run is faster and cheaper.

## The day before

- [ ] `minikube status` shows it running, and the Testkube runner agent is connected (`testkube get agents` or the dashboard)
- [ ] `./scripts/setup.sh`: all 6 baseline runs on `main` pass
- [ ] Do two full rehearsals: `./scripts/reset-demo.sh`, then `npm run loop -- --pr <n>`. Note the timings.
- [ ] Remove unrelated workflows from the environment (old `ql-demo-*` workflows) so the dashboard is clean

## 15 minutes before

- [ ] `./scripts/pre-demo.sh`: all ✓ and a green baseline on `main`
- [ ] Credentials: `gh auth status`, plus `ANTHROPIC_API_KEY` exported (or a Claude Code login)
- [ ] `./scripts/reset-demo.sh` (bug only), `--flaky` (bug plus a flaky browse run) or `--two-bugs` (a second bug that only shows after the first fix, so the loop takes two fix rounds, about 5 minutes), so a fresh PR is open but **not** yet processed. Alternatively, start `npm run watch` and run reset live on stage. Don't run `shop-e2e-browse` between the reset and the loop, because the flake alternates by execution number.
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
| Triage (flaky run) | The browse triage agent suspects a slow-catalog flake, **re-runs** the workflow to check, sees it pass on the same commit and tags it `triage=flake`. |
| Remediate | One-line fix plus a regression unit test, committed and pushed to the PR branch. With `--flaky`, `shop-e2e-browse` also gets the label `quarantine=true` in Testkube. |
| Re-run (round 2) | The loop goes back to Execute: the same plan on the new SHA (quarantined workflows skipped); all green. If something still failed, it would triage and fix once more (`MAX_ROUNDS`, default 2) before the Gate decides. |
| Gate | The `quality-gate` commit status turns green and a final PR comment appears (verdict, confidence, what happened). In the Testkube dashboard, filter executions by tag `pr=<n>` to show the full trail. |

## Showing the agents themselves

- `runs/pr-<n>.json` lists every agent session in the run (agent, session ID, transcript path, resume command).
- To open one, run its `resume` command (e.g. `cd .worktrees/pr-5 && claude --resume <id>`). Claude Code shows the agent's full conversation: prompt, tool calls, MCP results.

## If something goes wrong

- **GitHub or network hiccup:** `gh` calls retry automatically. Re-running `npm run loop -- --pr <n>` is safe; the agents re-plan from the PR's current head.
- **A workflow aborted (image pull or scheduling):** the Executor retries infra failures once on its own. Otherwise run `./scripts/prewarm.sh`.
- **The PR is already fixed from a previous run:** run `./scripts/reset-demo.sh` for a fresh PR.
- **Testkube MCP returns 401:** the API token in `agents/.env` has expired or lacks access to the environment. Create a new one in the Testkube dashboard.
