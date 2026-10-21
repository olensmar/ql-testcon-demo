/**
 * The PR quality loop: Selector → Executor → Triage → Remediator → Executor (verify) → Gate.
 *
 *   npm run loop -- --pr 12     # run the loop for one PR
 *   npm run watch               # wait for new PRs and run the loop for each
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { executePlan } from "./agents/executor.ts";
import { reportGate } from "./agents/gate.ts";
import { remediate } from "./agents/remediator.ts";
import { selectTests } from "./agents/selector.ts";
import { triageFailure } from "./agents/triage.ts";
import * as github from "./lib/github.ts";
import type { ExecutionReport, RemediationReport, TestPlan, TriageReport } from "./lib/schemas.ts";
import { connectTestkube } from "./lib/testkube.ts";
import { AgentLog, banner, colors as c, statusIcon } from "./lib/ui.ts";

const git = promisify(execFile);
const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const log = new AgentLog("loop");

type Execution = ExecutionReport["executions"][number] & { url?: string };

async function runLoop(prNumber: number) {
  const started = Date.now();
  const costs: Record<string, number> = {};
  const track = <T>(name: string, r: { output: T; costUsd: number }) => {
    costs[name] = (costs[name] ?? 0) + r.costUsd;
    return r.output;
  };

  const pr = await github.getPr(prNumber);
  const diff = await github.getPrDiff(prNumber);
  banner(`AI quality loop · PR #${pr.number}`, `${pr.title} · ${pr.headRefOid.slice(0, 7)}`);
  log.info(`${pr.files.length} files changed: ${pr.files.map((f) => f.path).join(", ")}`);
  await github.setStatus(pr.headRefOid, "pending", "AI quality loop running…");
  const worktree = await prepareWorktree(pr);

  // 1 · Select ------------------------------------------------------------------------------
  banner("1 · Select", "intelligent test selection");
  const plan = track("selector", await selectTests(pr, diff));
  printPlan(plan);
  await github.comment(pr.number, planComment(plan));

  // 2 · Execute ------------------------------------------------------------------------------
  banner("2 · Execute", `Testkube on Kubernetes @ ${pr.headRefOid.slice(0, 7)}`);
  const initial = await withUrls(track("executor", await executePlan(plan, pr.headRefOid, pr.number, "initial")));
  printExecutions(initial);
  await github.comment(pr.number, executionComment("Test run", pr.headRefOid, initial));

  let headSha = pr.headRefOid;
  let triage: TriageReport[] = [];
  let remediation: RemediationReport | undefined;
  let verification: Execution[] | undefined;
  const failures = initial.filter((e) => e.status !== "passed");

  if (failures.length > 0) {
    // 3 · Triage ----------------------------------------------------------------------------
    banner("3 · Triage", `${failures.length} failed execution${failures.length > 1 ? "s" : ""}, analysed in parallel`);
    const results = await Promise.all(failures.map((f) => triageFailure(pr, diff, f, worktree)));
    triage = results.map((r) => track("triage", r));
    for (const t of triage) printTriage(t);
    await tagTriage(triage);
    await github.comment(pr.number, triageComment(triage, initial));

    // 4 · Remediate -------------------------------------------------------------------------
    banner("4 · Remediate");
    remediation = track("remediator", await remediate(pr, triage, worktree));
    const newSha = (await git("git", ["rev-parse", "HEAD"], { cwd: worktree })).stdout.trim();
    if (remediation.committed && newSha !== headSha) {
      await git("git", ["push", "origin", `HEAD:refs/heads/${pr.headRefName}`], { cwd: worktree });
      log.ok(`pushed ${newSha.slice(0, 7)} to ${pr.headRefName}`);
      headSha = newSha;
    }
    log.info(`${remediation.action}: ${remediation.summary.split("\n")[0]}`);
    await github.comment(pr.number, remediationComment(remediation, headSha));

    // 5 · Verify ----------------------------------------------------------------------------
    if (remediation.action !== "escalated") {
      banner("5 · Verify", `same plan @ ${headSha.slice(0, 7)}`);
      verification = await withUrls(track("executor", await executePlan(plan, headSha, pr.number, "verify")));
      printExecutions(verification);
      await github.comment(pr.number, executionComment("Verification run", headSha, verification));
    }
  }

  // 6 · Gate ----------------------------------------------------------------------------------
  banner("6 · Gate", "release confidence");
  const gate = track(
    "gate",
    await reportGate(pr, headSha, { plan, initialRun: initial, triage, remediation, verificationRun: verification }),
  );
  const passed = gate.verdict === "pass";
  await github.setStatus(headSha, passed ? "success" : "failure", gate.headline, pr.url);
  await github.comment(pr.number, `## ${passed ? "✅" : "❌"} Quality gate: ${gate.headline}\n\n${gate.summary}`);
  (passed ? log.ok : log.fail).call(log, `${gate.verdict.toUpperCase()} · confidence ${gate.confidence}% · ${gate.headline}`);

  const total = Object.values(costs).reduce((a, b) => a + b, 0);
  const breakdown = Object.entries(costs).map(([k, v]) => `${k} $${v.toFixed(2)}`).join(" · ");
  banner(
    `Done in ${((Date.now() - started) / 1000).toFixed(0)}s`,
    `agent cost $${total.toFixed(2)} (${breakdown}) · ${pr.url}`,
  );
}

/** Check out the PR head in its own worktree, for Triage to read and the Remediator to edit. */
async function prepareWorktree(pr: github.PullRequest): Promise<string> {
  const dir = join(REPO_ROOT, ".worktrees", `pr-${pr.number}`);
  await git("git", ["fetch", "-q", "origin", pr.headRefName], { cwd: REPO_ROOT });
  if (existsSync(dir)) await git("git", ["worktree", "remove", "--force", dir], { cwd: REPO_ROOT });
  await git("git", ["worktree", "add", "-q", "-B", `demo/pr-${pr.number}`, dir, pr.headRefOid], { cwd: REPO_ROOT });
  return dir;
}

/** Records each triage verdict on its execution in Testkube (tags are replaced, so merge). */
async function tagTriage(reports: TriageReport[]) {
  const testkube = await connectTestkube();
  try {
    for (const t of reports) {
      const info = await testkube.call("get_execution_info", { executionId: t.executionId });
      const tags = { ...info.tags, triage: t.classification };
      await testkube.call("update_execution_tags", { executionId: t.executionId, tags });
      new AgentLog("triage", t.workflow).info(`🏷  tagged ${info.name} triage=${t.classification}`);
    }
  } finally {
    await testkube.close();
  }
}

async function withUrls(report: ExecutionReport): Promise<Execution[]> {
  const missing = report.executions.filter((e) => !e.executionId);
  if (missing.length > 0) {
    throw new Error(`executor did not start: ${missing.map((e) => `${e.workflow} (${e.note})`).join(", ")}`);
  }
  const testkube = await connectTestkube();
  try {
    return await Promise.all(
      report.executions.map(async (e) => {
        const { url } = await testkube.call("build_dashboard_url", {
          resourceType: "execution",
          workflowName: e.workflow,
          executionId: e.executionId,
        });
        return { ...e, url };
      }),
    );
  } finally {
    await testkube.close();
  }
}

// ---- terminal output ------------------------------------------------------------------------

function printPlan(plan: TestPlan) {
  const selector = new AgentLog("selector");
  selector.info(`${c.bold}${plan.summary}`);
  for (const s of plan.selected) {
    const cfg = Object.entries(s.config).map(([k, v]) => `${k}=${v}`).join(" ");
    selector.info(`${c.green}RUN ${c.reset} ${s.workflow.padEnd(20)} ${c.gray}${cfg ? `[${cfg}] ` : ""}${s.reason}`);
  }
  for (const s of plan.skipped) {
    selector.info(`${c.gray}SKIP ${s.workflow.padEnd(20)} ${s.reason}`);
  }
}

function printExecutions(executions: Execution[]) {
  for (const e of executions) {
    log.info(`${statusIcon(e.status)} ${e.workflow.padEnd(20)} ${e.status.padEnd(7)} ${e.duration.padStart(8)}  ${c.gray}${e.note}`);
  }
}

function printTriage(t: TriageReport) {
  const triageLog = new AgentLog("triage", t.workflow);
  triageLog.info(`${c.bold}${t.classification}${c.reset} (${Math.round(t.confidence * 100)}%): ${t.rootCause}`);
}

// ---- PR comments ----------------------------------------------------------------------------

const AGENT_FOOTER = "\n\n<sub>🤖 Posted by the AI quality loop · Claude Agent SDK + Testkube MCP</sub>";

function planComment(plan: TestPlan): string {
  const rows = [
    ...plan.selected.map((s) => `| ▶️ run | \`${s.workflow}\` | ${s.reason} |`),
    ...plan.skipped.map((s) => `| ⏭️ skip | \`${s.workflow}\` | ${s.reason} |`),
  ];
  return `### 🎯 Test selection: ${plan.selected.length} of ${plan.selected.length + plan.skipped.length} workflows

${plan.summary}

| | Workflow | Why |
|---|---|---|
${rows.join("\n")}${AGENT_FOOTER}`;
}

function executionComment(title: string, sha: string, executions: Execution[]): string {
  const rows = executions.map(
    (e) => `| ${statusIcon(e.status)} | [\`${e.workflow}\`](${e.url}) | ${e.status} | ${e.duration} | ${e.note || ""} |`,
  );
  const failed = executions.filter((e) => e.status !== "passed").length;
  return `### 🚀 ${title} @ \`${sha.slice(0, 7)}\`: ${failed === 0 ? "all passed" : `${failed} failed`}

Executed in parallel by Testkube on Kubernetes.

| | Workflow | Status | Duration | Note |
|---|---|---|---|---|
${rows.join("\n")}${AGENT_FOOTER}`;
}

function triageComment(reports: TriageReport[], executions: Execution[]): string {
  const sections = reports.map((t) => {
    const url = executions.find((e) => e.executionId === t.executionId)?.url;
    return `#### [\`${t.workflow}\`](${url}): **${t.classification}** (${Math.round(t.confidence * 100)}% confidence)

**Root cause:** ${t.rootCause}

**Evidence**
${t.evidence.map((e) => `- ${e}`).join("\n")}

**Suspect files:** ${t.suspectFiles.map((f) => `\`${f}\``).join(", ")}

**Suggested fix:** ${t.suggestedFix}`;
  });
  return `### 🔎 Failure triage\n\n${sections.join("\n\n---\n\n")}${AGENT_FOOTER}`;
}

function remediationComment(r: RemediationReport, sha: string): string {
  const icon = { fixed: "🛠️", quarantined: "🧪", escalated: "🙋" }[r.action];
  const commit = r.committed ? `\n\nCommit: ${sha}` : "";
  return `### ${icon} Remediation: ${r.action}\n\n${r.summary}${commit}${AGENT_FOOTER}`;
}

// ---- entry point ----------------------------------------------------------------------------

const { values } = parseArgs({
  options: { pr: { type: "string" }, watch: { type: "boolean", default: false } },
});

if (values.pr) {
  await runLoop(Number(values.pr));
} else if (values.watch) {
  await watch();
} else {
  console.error("usage: npm run loop -- --pr <number>   |   npm run watch");
  process.exit(1);
}

/** Polls GitHub for newly opened PRs and runs the loop for each one. */
async function watch() {
  const seen = new Set((await github.listOpenPrs()).map((p) => p.number));
  banner("Watching for pull requests", `${github.REPO} · ${seen.size} already open, ignoring those`);
  for (;;) {
    for (const pr of await github.listOpenPrs()) {
      if (seen.has(pr.number)) continue;
      seen.add(pr.number);
      log.info(`new PR #${pr.number}: ${pr.title}`);
      try {
        await runLoop(pr.number);
      } catch (err) {
        log.fail(`loop failed for PR #${pr.number}: ${(err as Error).message}`);
      }
      banner("Watching for pull requests", github.REPO);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
