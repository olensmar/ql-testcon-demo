import { runAgent } from "../lib/agent.ts";
import type { PullRequest } from "../lib/github.ts";
import { TriageReport } from "../lib/schemas.ts";
import { tk } from "../lib/testkube.ts";

export function triageFailure(
  pr: PullRequest,
  diff: string,
  failure: { workflow: string; executionId: string; note: string },
  config: Record<string, string>,
  worktree: string,
) {
  return runAgent({
    name: "triage",
    qualifier: failure.workflow,
    model: "claude-opus-5-5",
    effort: "medium",
    tools: ["Read", "Grep", "Glob"],
    allowedTools: [
      "Read",
      "Grep",
      "Glob",
      ...tk(
        "get_execution_info",
        "fetch_execution_logs",
        "list_artifacts",
        "read_artifact",
        "query_executions",
        "run_workflow",
        "wait_for_executions",
      ),
    ],
    schema: TriageReport,
    cwd: worktree,
    maxTurns: 20,
    prompt: `Triage this failed Testkube execution.

Workflow: ${failure.workflow}
Execution ID: ${failure.executionId}
Executor note: ${failure.note || "(none)"}
Config it ran with: ${JSON.stringify(config)}

It ran against PR #${pr.number} "${pr.title}" at revision ${pr.headRefOid}, which is checked out in your working directory.

PR diff:
\`\`\`diff
${diff}
\`\`\``,
  });
}
