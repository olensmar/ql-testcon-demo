import { runAgent } from "../lib/agent.ts";
import type { PullRequest } from "../lib/github.ts";
import { TestPlan } from "../lib/schemas.ts";
import { tk } from "../lib/testkube.ts";

export function selectTests(pr: PullRequest, diff: string) {
  const files = pr.files.map((f) => `- ${f.path} (+${f.additions} −${f.deletions})`).join("\n");
  return runAgent({
    name: "selector",
    model: "claude-sonnet-5-5",
    effort: "medium",
    tools: [],
    allowedTools: tk("list_workflows", "get_workflow_definition", "get_workflow_metrics"),
    schema: TestPlan,
    maxTurns: 12,
    prompt: `Select the Testkube workflows to run for this pull request.

PR #${pr.number}: ${pr.title}

${pr.body || "(no description)"}

Changed files:
${files}

Diff:
\`\`\`diff
${diff}
\`\`\``,
  });
}
