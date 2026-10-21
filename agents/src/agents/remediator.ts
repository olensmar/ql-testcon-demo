import { runAgent } from "../lib/agent.ts";
import type { PullRequest } from "../lib/github.ts";
import { RemediationReport, type TriageReport } from "../lib/schemas.ts";

export function remediate(pr: PullRequest, triage: TriageReport[], worktree: string) {
  return runAgent({
    name: "remediator",
    model: "claude-opus-5-5",
    effort: "medium",
    tools: ["Read", "Edit", "Grep", "Glob", "Bash"],
    allowedTools: [
      "Read",
      "Edit",
      "Grep",
      "Glob",
      "Bash(npm test)",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git add*)",
      "Bash(git commit*)",
    ],
    schema: RemediationReport,
    cwd: worktree,
    maxTurns: 30,
    prompt: `Remediate the test failures on PR #${pr.number} "${pr.title}" (branch ${pr.headRefName}).

Triage reports:
\`\`\`json
${JSON.stringify(triage, null, 2)}
\`\`\``,
  });
}
