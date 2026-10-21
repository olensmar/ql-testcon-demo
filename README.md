# AI agents + Testkube: a PR quality loop

Demo for the TestCon talk on scaling test execution with Kubernetes and using AI for
intelligent test selection, automated result analysis and remediation.

A pull request opens and five Claude Agent SDK agents take it from there. Every Testkube
interaction goes through the **Testkube MCP server**:

| # | Agent | Model | What it does with Testkube |
|---|---|---|---|
| 1 | **Selector** | Sonnet 5.5 | Reads the diff plus workflow labels, descriptions and health; plans which workflows to run (and which to skip) |
| 2 | **Executor** | Haiku 5.5 | Runs the plan in parallel on Kubernetes (sharded Playwright, distributed k6), waits, retries infra failures |
| 3 | **Triage** | Opus 5.5 | One per failed execution, in parallel: logs, artifacts and history; classifies the failure (product bug, test defect, flake or infra), which is recorded as a `triage` tag on the execution |
| 4 | **Remediator** | Opus 5.5 | Fixes the code (or quarantines a flaky workflow) and commits to the PR branch |
| 2' | **Executor** | Haiku 5.5 | Re-runs the plan at the fixed revision |
| 5 | **Gate Reporter** | Sonnet 5.5 | Cross-checks every execution tagged `pr=<n>` in Testkube, decides the verdict and confidence, and sets the `quality-gate` commit status |

The orchestration in [`agents/src/loop.ts`](agents/src/loop.ts) is deterministic. Each agent is
one `query()` call with its own prompt ([`agents/src/prompts`](agents/src/prompts)), tool
allow-list and JSON-schema output ([`agents/src/lib/schemas.ts`](agents/src/lib/schemas.ts)).
The output of each agent is the next agent's input.

## What's in the repo

```
app/            Plushie Shop: zero-dependency Node 22 app (node:http + static HTML)
tests/api       Postman collections (newman)
tests/e2e       Playwright specs
tests/load      k6 script
testkube/       6 TestWorkflows (labels demo=testcon, type=…, service=…)
agents/         Claude Agent SDK orchestrator + 5 agents
demo/           discount-codes.patch: the PR under test, including a planted bug
scripts/        setup, prewarm, reset-demo
```

**No app image is built.** Each workflow clones the repo at `config.revision`, starts the app
from source as a Testkube **service** (stock `node:22-alpine`, with the source copied in via
`transfer`), and points the tests at `{{services.shop.0.ip}}`. Every run gets a short-lived copy
of the PR's code.

### The planted bug

The PR adds discount codes, but computes the discount on `subtotal + shipping` instead of
`subtotal`. The PR's unit test uses a free-shipping order, so **unit tests pass**. The API and
E2E tests use a $30 + $5 shipping cart and fail: they expect $32.00 and get $31.50.

## Running it

Prerequisites: a Testkube environment with a runner (here, minikube), the `testkube` CLI logged
in (the agents use `testkube mcp serve`), `gh` logged in, Node ≥ 22.18, and Claude credentials
for the Agent SDK (`ANTHROPIC_API_KEY`, or an existing Claude Code login).

```bash
./scripts/setup.sh            # npm ci, pre-pull images, apply workflows via MCP, green baseline on main
./scripts/reset-demo.sh       # open a fresh "Add discount codes" PR
cd agents && npm run loop -- --pr <number>
# or: npm run watch            # waits for new PRs and runs the loop for each
```

To use the hosted Testkube MCP endpoint instead of the local stdio server, set
`TK_ACCESS_TOKEN`, `TK_ORG_ID` and `TK_ENV_ID`.

Every execution is tagged with `pr` and `revision` (through the workflows' `execution.tags`
expressions), and failed executions also get a `triage` tag. In the Testkube dashboard you can
filter on these tags to see the PR's whole history.

### The controllable flake

`./scripts/reset-demo.sh --flaky` (or `npm run flake -- on|off` in `agents/`) sets the
`chaos` config of `shop-e2e-browse`, which gives the app 3s of catalog latency on alternating
executions. The browse test has a 2s render budget, so the next run fails and the one after passes.
Triage confirms the flake with a re-run, the workflow gets the label `quarantine=true`, the
verification run skips it, and the Gate doesn't block on it.

### Agent sessions

The Agent SDK runs each agent as a local Claude Code session; nothing is registered server-side.
Every run writes `runs/pr-<n>.json`, which lists each agent's session ID, its transcript
(`~/.claude/projects/<cwd>/<session>.jsonl`) and a `claude --resume` command that opens the
session interactively. The terminal also prints the session ID when each agent finishes.

### Diagrams

[`docs/diagrams`](docs/diagrams) has slide-ready SVG and PNG versions of: the setup, the quality
loop, CI vs Kubernetes fan-out, the Selector, Triage and Gate agents in detail, "why not run
the tests in the agent's sandbox?", and the agent hand-offs (JSON contracts and the code between agents). They're styled for the TestCon deck (Nunito, dark
background, transparent PNGs). Re-render after editing an SVG with
`cd tests/e2e && cp ../../scripts/diagrams/render.mjs .render.mjs && node .render.mjs ../../docs/diagrams; rm .render.mjs`.

### AI spend

At the end of each run the terminal prints tokens (input, cache read, cache write, output) and
the estimated cost per agent session and model. The same table goes into the final PR comment
(collapsed) and into `runs/pr-<n>.json`. A typical run is 7 sessions, about 500k tokens and
about $0.40, mostly cached prompt reads; a flaky run with three triage agents is about $1.

See [DEMO-RUNBOOK.md](DEMO-RUNBOOK.md) for the on-stage checklist.
