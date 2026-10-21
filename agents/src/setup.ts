/**
 * Applies the demo TestWorkflows in ../testkube to Testkube via MCP (create or update),
 * and optionally runs each one on `main` to build a green baseline history.
 *
 *   npm run setup            # apply workflows
 *   npm run setup -- --run   # apply, then run all on main and wait
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { connectTestkube } from "./lib/testkube.ts";

const WORKFLOW_DIR = join(import.meta.dirname, "..", "..", "testkube");
const runBaseline = process.argv.includes("--run");

const tk = await connectTestkube();
try {
  const files = (await readdir(WORKFLOW_DIR)).filter((f) => f.endsWith(".yaml")).sort();
  const names: string[] = [];

  for (const file of files) {
    const yaml = await readFile(join(WORKFLOW_DIR, file), "utf8");
    const name: string = parse(yaml).metadata.name;
    names.push(name);
    try {
      await tk.call("create_workflow", { yaml });
      console.log(`created  ${name}`);
    } catch (err) {
      if (!/already exists/i.test(String(err))) throw err;
      await tk.call("update_workflow", { workflowName: name, yaml });
      console.log(`updated  ${name}`);
    }
  }

  if (runBaseline) {
    const runs = await Promise.all(
      names.map((workflowName) => tk.call("run_workflow", { workflowName, config: { revision: "main", pr: "" } })),
    );
    console.log(`\nbaseline runs started: ${runs.map((r) => r.name).join(", ")}`);
    await tk.call("wait_for_executions", { executionIds: runs.map((r) => r.id).join(","), timeoutMinutes: "15" });
    for (const run of runs) {
      const info = await tk.call("get_execution_info", { executionId: run.id });
      console.log(`${info.result.status.padEnd(8)} ${info.name} (${info.result.duration})`);
    }
  }
} finally {
  await tk.close();
}
