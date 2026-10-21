import { z } from "zod";

/** A test plan: produced by the Selector (and the Remediator's re-run request), consumed by the Executor. */
export const TestPlan = z.object({
  summary: z.string().describe("One or two sentences explaining the selection strategy for this change"),
  selected: z.array(
    z.object({
      workflow: z.string(),
      reason: z.string().describe("Why this workflow is relevant to the change"),
      config: z
        .record(z.string(), z.string())
        .describe("Extra workflow config params, e.g. {\"shards\": \"3\"}. Do not set revision or pr."),
    }),
  ),
  skipped: z.array(z.object({ workflow: z.string(), reason: z.string() })),
});
export type TestPlan = z.infer<typeof TestPlan>;

export const ExecutionReport = z.object({
  executions: z.array(
    z.object({
      workflow: z.string(),
      executionId: z.string(),
      executionName: z.string(),
      status: z.string().describe("Final status: passed, failed, aborted, timeout, ..."),
      duration: z.string(),
      note: z.string().describe("Short note, e.g. failure message or retry info; empty if passed"),
    }),
  ),
});
export type ExecutionReport = z.infer<typeof ExecutionReport>;

export const TriageReport = z.object({
  workflow: z.string(),
  executionId: z.string(),
  classification: z.enum(["product-bug", "test-defect", "flake", "infra"]),
  confidence: z.number().min(0).max(1),
  rootCause: z.string().describe("One or two sentences naming the defect"),
  evidence: z.array(z.string()).describe("Concrete facts: assertion messages, log lines, diff hunks"),
  suspectFiles: z.array(z.string()).describe("Repo-relative paths, with line numbers when known"),
  suggestedFix: z.string(),
  rerunExecutionId: z
    .string()
    .describe("ID of the confirming re-run on the same revision (required for flake), or empty string"),
});
export type TriageReport = z.infer<typeof TriageReport>;

export const RemediationReport = z.object({
  action: z.enum(["fixed", "quarantined", "escalated"]).describe("fixed if any code was changed"),
  summary: z.string().describe("What was changed and why, for the PR comment"),
  committed: z.boolean().describe("True if a commit was created on the PR branch"),
  filesChanged: z.array(z.string()),
  quarantine: z.array(z.string()).describe("Workflows to quarantine as confirmed flaky; empty if none"),
});
export type RemediationReport = z.infer<typeof RemediationReport>;

export const GateReport = z.object({
  verdict: z.enum(["pass", "fail"]),
  confidence: z.number().min(0).max(100).describe("Release confidence for this PR, 0-100"),
  headline: z.string().describe("One line, shown as the commit status description (max 120 chars)"),
  summary: z.string().describe("Markdown summary for the final PR comment"),
});
export type GateReport = z.infer<typeof GateReport>;
