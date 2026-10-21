import { runAgent } from "../lib/agent.ts";
import type { PullRequest } from "../lib/github.ts";
import { GateReport } from "../lib/schemas.ts";
import { tk } from "../lib/testkube.ts";

export function reportGate(pr: PullRequest, headSha: string, loopSummary: unknown) {
  return runAgent({
    name: "gate",
    model: "claude-sonnet-5-5",
    effort: "low",
    tools: [],
    allowedTools: tk("query_executions", "get_execution_info"),
    schema: GateReport,
    maxTurns: 10,
    prompt: `Produce the quality gate verdict for PR #${pr.number} "${pr.title}".

Current head revision: ${headSha} (short: ${headSha.slice(0, 7)})

What happened in the loop:
\`\`\`json
${JSON.stringify(loopSummary, null, 2)}
\`\`\``,
  });
}
