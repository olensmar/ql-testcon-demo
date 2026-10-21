import { runAgent } from "../lib/agent.ts";
import { ExecutionReport, type TestPlan } from "../lib/schemas.ts";
import { tk } from "../lib/testkube.ts";

/** Runs a test plan at a specific revision. `phase` only labels the UI (initial run vs. verification). */
export function executePlan(plan: TestPlan, revision: string, prNumber: number, phase: string) {
  const runs = plan.selected.map((s) => ({
    workflow: s.workflow,
    config: { ...s.config, revision, pr: String(prNumber) },
  }));
  return runAgent({
    name: "executor",
    qualifier: phase,
    model: "claude-haiku-5-5",
    effort: "low",
    tools: [],
    allowedTools: tk("run_workflow", "wait_for_executions", "get_execution_info"),
    schema: ExecutionReport,
    maxTurns: 16,
    prompt: `Run this test plan in Testkube and report the results.

\`\`\`json
${JSON.stringify(runs, null, 2)}
\`\`\``,
  });
}
