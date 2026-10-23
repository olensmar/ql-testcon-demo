/**
 * Testkube backend that drives the `testkube` CLI instead of the hosted MCP server, so the demo
 * also works with a Testkube Open Source runner (which has no MCP server). It exposes the same tool
 * names the agents use, both as an in-process MCP server (for agents) and as plain functions (for
 * orchestrator code), so prompts, allow-lists and the loop don't change.
 *
 * Configure with TESTKUBE_BACKEND=cli plus, optionally:
 *   TK_CLI_HOME        HOME for the CLI, i.e. which ~/.testkube config/context it uses
 *   TK_CLI_KUBECONFIG  kubeconfig of the cluster running Testkube (Open Source)
 *   TK_CLI_ARGS        extra global CLI flags, e.g. "--namespace testkube"
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const run = promisify(execFile);
const ANSI = /\x1b\[[0-9;]*m/g;
const TERMINAL = new Set(["passed", "failed", "aborted", "canceled", "timeout", "skipped"]);
const ARTIFACT_DIR = join(tmpdir(), "ql-testcon-artifacts");

async function cli(args: string[]): Promise<string> {
  const env = { ...process.env };
  if (process.env.TK_CLI_HOME) env.HOME = process.env.TK_CLI_HOME;
  if (process.env.TK_CLI_KUBECONFIG) env.KUBECONFIG = process.env.TK_CLI_KUBECONFIG;
  const extra = (process.env.TK_CLI_ARGS ?? "").split(/\s+/).filter(Boolean);
  try {
    const { stdout } = await run("testkube", [...args, ...extra], { env, maxBuffer: 64 * 1024 * 1024 });
    return stdout.replace(ANSI, "");
  } catch (err: any) {
    const detail = String(err.stderr || err.stdout || err.message).replace(ANSI, "").trim();
    throw new Error(`testkube ${args.join(" ")} failed: ${detail.slice(0, 600)}`);
  }
}

/** The CLI can print text and several JSON documents; this returns the first JSON value. */
function firstJson(text: string): any {
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error(`no JSON in CLI output: ${text.slice(0, 200)}`);
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      if (--depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("unterminated JSON in CLI output");
}

const cliJson = async (args: string[]) => firstJson(await cli([...args, "-o", "json"]));
const getExecution = (id: string) => cliJson(["get", "testworkflowexecution", id]);

function summarize(e: any) {
  return {
    id: e.id,
    name: e.name,
    number: e.number,
    workflowName: e.workflow?.name,
    scheduledAt: e.scheduledAt,
    result: {
      status: e.result?.status,
      duration: e.result?.duration,
      ...(e.result?.statusDetails ? { statusDetails: e.result.statusDetails } : {}),
    },
    tags: e.tags ?? {},
    configParams: e.configParams,
  };
}

/** A small JSONPath subset: $, $.a.b, $['a','b.c'] and $..key. */
function jsonPath(value: any, expr: string): unknown[] {
  const get = (obj: any, path: string) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (expr === "$") return [value];
  const recursive = expr.match(/^\$\.\.([\w-]+)$/);
  if (recursive) {
    const found: unknown[] = [];
    const walk = (o: any) => {
      if (o && typeof o === "object") {
        for (const [k, v] of Object.entries(o)) {
          if (k === recursive[1]) found.push(v);
          walk(v);
        }
      }
    };
    walk(value);
    return found;
  }
  const keys = expr.match(/^\$\[(.+)\]$/);
  if (keys) return keys[1].split(",").map((k) => get(value, k.trim().replace(/^['"]|['"]$/g, "")));
  const path = expr.match(/^\$\.([\w.-]+)$/);
  if (path) return [get(value, path[1])];
  throw new Error(`unsupported expression ${expr}: the CLI backend supports $, $.a.b, $['a','b.c'] and $..key`);
}

async function downloadArtifacts(executionId: string): Promise<string> {
  const dir = join(ARTIFACT_DIR, executionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    await cli(["download", "artifacts", executionId, "--download-dir", dir]);
  }
  return dir;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

async function applyWorkflow(yaml: string) {
  const file = join(tmpdir(), `ql-testcon-workflow-${process.pid}-${Date.now()}.yaml`);
  await writeFile(file, yaml);
  try {
    const out = await cli(["create", "testworkflow", "-f", file, "--update"]);
    return { ok: true, output: out.trim().split("\n").pop() };
  } finally {
    await rm(file, { force: true });
  }
}

const tagArgs = (selector?: string) =>
  (selector ?? "").split(",").map((t) => t.trim()).filter(Boolean).flatMap((t) => ["--tag", t]);

// ---- the tools ---------------------------------------------------------------------------------

type Shape = Record<string, z.ZodType>;
interface CliTool {
  description: string;
  shape: Shape;
  handler: (args: any) => Promise<unknown>;
}

const TOOLS: Record<string, CliTool> = {
  list_workflows: {
    description: "List TestWorkflows, optionally filtered by label selector (key=value[,key=value]).",
    shape: { selector: z.string().optional(), pageSize: z.string().optional() },
    handler: async ({ selector }) => {
      const list = await cliJson(["get", "testworkflows", ...(selector ? ["--label", selector] : [])]);
      return list.map((w: any) => ({
        name: w.workflow?.name,
        description: w.workflow?.description,
        labels: w.workflow?.labels ?? {},
        latest: w.latestExecution
          ? { id: w.latestExecution.id, name: w.latestExecution.name, status: w.latestExecution.result?.status }
          : undefined,
      }));
    },
  },
  get_workflow_definition: {
    description: "Get the definition (spec, config parameters, labels) of a TestWorkflow.",
    shape: { workflowName: z.string() },
    handler: async ({ workflowName }) => ({ workflow: await cliJson(["get", "testworkflow", workflowName]) }),
  },
  get_workflow_metrics: {
    description: "Health of a TestWorkflow: pass rate and flip rate over its recent executions.",
    shape: { workflowName: z.string() },
    handler: async ({ workflowName }) => {
      const runs = await cliJson(["get", "testworkflowexecution", "--testworkflow", workflowName, "--limit", "20"]);
      const statuses: string[] = runs.map((e: any) => e.result?.status).filter((s: string) => TERMINAL.has(s));
      const passed = statuses.filter((s) => s === "passed").length;
      const flips = statuses.slice(1).filter((s, i) => s !== statuses[i]).length;
      return {
        workflowName,
        executions: statuses.length,
        passRate: statuses.length ? passed / statuses.length : null,
        flipRate: statuses.length > 1 ? flips / (statuses.length - 1) : null,
        note: "computed from recent executions by the CLI backend",
      };
    },
  },
  run_workflow: {
    description: "Run a TestWorkflow with optional config parameters. Returns the execution id.",
    shape: { workflowName: z.string(), config: z.record(z.string(), z.any()).optional() },
    handler: async ({ workflowName, config }) => {
      const configArgs = Object.entries(config ?? {}).flatMap(([k, v]) => ["--config", `${k}=${v}`]);
      const e = await cliJson(["run", "testworkflow", workflowName, ...configArgs]);
      return { id: e.id, name: e.name, number: e.number, workflowName, status: e.result?.status };
    },
  },
  wait_for_executions: {
    description: "Wait until the given executions (comma-separated ids) have finished; returns their final status.",
    shape: { executionIds: z.string(), timeoutMinutes: z.string().optional() },
    handler: async ({ executionIds, timeoutMinutes }) => {
      const ids = String(executionIds).split(",").map((s) => s.trim()).filter(Boolean);
      const deadline = Date.now() + Number(timeoutMinutes ?? 30) * 60_000;
      const done = new Map<string, any>();
      while (done.size < ids.length && Date.now() < deadline) {
        for (const id of ids.filter((i) => !done.has(i))) {
          const e = await getExecution(id);
          if (TERMINAL.has(e.result?.status)) done.set(id, e);
        }
        if (done.size < ids.length) await new Promise((r) => setTimeout(r, 3000));
      }
      return {
        executions: ids.map((id) => {
          const e = done.get(id);
          return e ? { id, name: e.name, status: e.result?.status } : { id, status: "still running (timeout)" };
        }),
      };
    },
  },
  get_execution_info: {
    description: "Status, timing, result details, tags and config of one execution.",
    shape: { executionId: z.string(), workflowName: z.string().optional() },
    handler: async ({ executionId }) => summarize(await getExecution(executionId)),
  },
  fetch_execution_logs: {
    description:
      "Logs of an execution. Use grep to filter, or tail / startLine+endLine for a range (max 100 lines). " +
      "The CLI backend returns the combined log; worker refs are not supported.",
    shape: {
      executionId: z.string(),
      grep: z.string().optional(),
      tail: z.string().optional(),
      startLine: z.string().optional(),
      endLine: z.string().optional(),
      workerRef: z.string().optional(),
      workerIndex: z.string().optional(),
    },
    handler: async ({ executionId, grep, tail, startLine, endLine, workerRef }) => {
      const raw = await cli(["get", "testworkflowexecution", executionId, "--logs-only"]);
      const lines = raw.split("\n");
      const body = lines.slice(Math.max(0, lines.findIndex((l) => l.startsWith("Getting logs")) + 1));
      let picked = body.map((text, i) => ({ n: i + 1, text }));
      if (grep) picked = picked.filter((l) => l.text.includes(grep));
      if (startLine || endLine) picked = picked.filter((l) => l.n >= Number(startLine ?? 1) && l.n <= Number(endLine ?? l.n));
      if (tail) picked = picked.slice(-Number(tail));
      picked = picked.slice(-100);
      const note = workerRef ? "Note: worker refs are not supported by the CLI backend; this is the combined log.\n" : "";
      return `${note}Total lines: ${body.length}\n` + picked.map((l) => `Line ${l.n}: ${l.text}`).join("\n");
    },
  },
  list_artifacts: {
    description: "List the artifacts (files) an execution produced.",
    shape: { executionId: z.string() },
    handler: async ({ executionId }) => {
      const dir = await downloadArtifacts(executionId);
      const files = await walk(dir);
      return Promise.all(files.map(async (f) => ({ name: relative(dir, f), size: (await stat(f)).size })));
    },
  },
  read_artifact: {
    description: "Read a text artifact of an execution (e.g. a JUnit report). Use a name from list_artifacts.",
    shape: { executionId: z.string(), fileName: z.string() },
    handler: async ({ executionId, fileName }) => {
      const dir = await downloadArtifacts(executionId);
      const path = join(dir, fileName);
      if (!path.startsWith(dir) || !existsSync(path)) return `No artifact ${fileName} (see list_artifacts)`;
      const buf = await readFile(path);
      if (buf.includes(0)) return `${fileName} is a binary file (${buf.length} bytes)`;
      const text = buf.toString("utf8");
      return text.length > 60_000 ? text.slice(0, 60_000) + "\n… (truncated)" : text;
    },
  },
  query_executions: {
    description:
      "Query executions (filter by workflowName, tagSelector key=value[,…], selector for workflow labels, status) " +
      "and extract fields with a JSONPath expression: $, $.a.b, $['a','b.c'] or $..key. Returns {executionId: [values]}.",
    shape: {
      expression: z.string(),
      workflowName: z.string().optional(),
      tagSelector: z.string().optional(),
      selector: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
      aggregate: z.boolean().optional(),
    },
    handler: async ({ expression, workflowName, tagSelector, selector, status, limit, aggregate }) => {
      const runs = await cliJson([
        "get", "testworkflowexecution",
        ...(workflowName ? ["--testworkflow", workflowName] : []),
        ...tagArgs(tagSelector),
        ...(selector ? ["--label", selector] : []),
        ...(status ? ["--status", status] : []),
        "--limit", String(limit ?? 50),
      ]);
      if (aggregate) return jsonPath(runs, expression);
      return Object.fromEntries(runs.map((e: any) => [e.id, jsonPath(e, expression)]));
    },
  },
  update_execution_tags: {
    description: "Replace the tags of an execution ({} clears them).",
    shape: { executionId: z.string(), tags: z.record(z.string(), z.string()) },
    handler: async ({ executionId, tags }) => {
      await cli(["update", "testworkflowexecution", executionId, ...Object.entries(tags).flatMap(([k, v]) => ["--tag", `${k}=${v}`])]);
      return { executionId, tags };
    },
  },
  create_workflow: {
    description: "Create (or update) a TestWorkflow from its YAML definition.",
    shape: { yaml: z.string() },
    handler: async ({ yaml }) => applyWorkflow(yaml),
  },
  update_workflow: {
    description: "Update a TestWorkflow from its full YAML definition.",
    shape: { workflowName: z.string(), yaml: z.string() },
    handler: async ({ yaml }) => applyWorkflow(yaml),
  },
  build_dashboard_url: {
    description: "Dashboard URL for an execution (none with the CLI backend).",
    shape: { resourceType: z.string(), workflowName: z.string(), executionId: z.string().optional() },
    handler: async () => ({ url: "" }),
  },
};

const asText = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

/** In-process MCP server with the CLI-backed tools, for the agents. */
export function cliMcpServer(name: string): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name,
    version: "1.0.0",
    tools: Object.entries(TOOLS).map(([toolName, t]) =>
      tool(toolName, t.description, t.shape, async (args) => {
        try {
          return { content: [{ type: "text", text: asText(await t.handler(args)) }] };
        } catch (err) {
          return { content: [{ type: "text", text: (err as Error).message }], isError: true };
        }
      }),
    ),
  });
}

/** Same tools as plain function calls, for orchestrator code (setup, tagging, quarantine, …). */
export class CliTestkubeClient {
  async call<T = any>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
    const t = TOOLS[toolName];
    if (!t) throw new Error(`${toolName} is not available with the CLI backend`);
    return (await t.handler(args)) as T;
  }

  async toolNames(): Promise<string[]> {
    return Object.keys(TOOLS);
  }

  async close() {}
}
