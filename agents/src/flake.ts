/**
 * Turns the controllable flake in shop-e2e-browse on or off (via Testkube MCP).
 *
 *   npm run flake -- on    # the NEXT execution fails (slow catalog), the one after passes, ...
 *   npm run flake -- off
 *
 * "on" sets the workflow's `chaos` default to "odd" or "even" so that the next execution
 * number gets 3s of catalog latency, i.e. it fails the 2s render budget; executions then
 * alternate fail/pass. Run it right before the demo PR is processed.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { connectTestkube } from "./lib/testkube.ts";

const WORKFLOW = "shop-e2e-browse";
const mode = process.argv[2];
if (mode !== "on" && mode !== "off") {
  console.error("usage: npm run flake -- on|off");
  process.exit(1);
}

const tk = await connectTestkube();
try {
  const doc = parse(await readFile(join(import.meta.dirname, "..", "..", "testkube", `${WORKFLOW}.yaml`), "utf8"));
  let chaos = "off";
  if (mode === "on") {
    const numbers: Record<string, number[]> = await tk.call("query_executions", {
      workflowName: WORKFLOW,
      expression: "$.number",
    });
    const latest = Math.max(0, ...Object.values(numbers).flat());
    chaos = (latest + 1) % 2 === 1 ? "odd" : "even";
    console.log(`flake on: next ${WORKFLOW} execution (#${latest + 1}) fails, #${latest + 2} passes, …`);
  } else {
    console.log(`flake off: ${WORKFLOW} runs normally`);
  }
  doc.spec.config.chaos.default = chaos;
  await tk.call("update_workflow", { workflowName: WORKFLOW, yaml: stringify(doc) });
} finally {
  await tk.close();
}
