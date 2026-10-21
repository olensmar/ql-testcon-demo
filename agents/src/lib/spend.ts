/** AI spend for one loop run: tokens and estimated cost per agent session and model. */
import type { ModelUsage } from "@anthropic-ai/claude-agent-sdk";
import { colors as c } from "./ui.ts";

export interface SpendRow {
  agent: string;
  model: string;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  costUsd: number;
}

export interface SpendReport {
  rows: SpendRow[];
  totals: Omit<SpendRow, "agent" | "model">;
  byModel: Array<{ model: string; sessions: number; costUsd: number; tokens: number }>;
}

export function buildSpend(sessions: Array<{ agent: string; modelUsage: Record<string, ModelUsage> }>): SpendReport {
  const rows: SpendRow[] = sessions.flatMap((s) =>
    Object.entries(s.modelUsage).map(([model, u]) => ({
      agent: s.agent,
      model: model.replace(/^claude-/, ""),
      input: u.inputTokens,
      cacheRead: u.cacheReadInputTokens,
      cacheWrite: u.cacheCreationInputTokens,
      output: u.outputTokens,
      costUsd: u.costUSD,
    })),
  );
  const sum = (f: (r: SpendRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const totals = {
    input: sum((r) => r.input),
    cacheRead: sum((r) => r.cacheRead),
    cacheWrite: sum((r) => r.cacheWrite),
    output: sum((r) => r.output),
    costUsd: sum((r) => r.costUsd),
  };
  const models = [...new Set(rows.map((r) => r.model))];
  const byModel = models
    .map((model) => {
      const m = rows.filter((r) => r.model === model);
      return {
        model,
        sessions: new Set(m.map((r) => r.agent)).size,
        costUsd: m.reduce((a, r) => a + r.costUsd, 0),
        tokens: m.reduce((a, r) => a + r.input + r.cacheRead + r.cacheWrite + r.output, 0),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
  return { rows, totals, byModel };
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 3 : 2)}`;

export function printSpend(report: SpendReport) {
  const header = ["agent", "model", "input", "cache read", "cache write", "output", "cost"];
  const widths = [24, 14, 8, 11, 12, 8, 8];
  const fmt = (cells: string[]) =>
    cells.map((cell, i) => (i < 2 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join(" ");
  console.log(`\n${c.bold} AI spend${c.reset}  ${c.gray}tokens and estimated cost per agent session${c.reset}`);
  console.log(`${c.gray} ${fmt(header)}${c.reset}`);
  for (const r of report.rows) {
    console.log(" " + fmt([r.agent, r.model, k(r.input), k(r.cacheRead), k(r.cacheWrite), k(r.output), usd(r.costUsd)]));
  }
  const t = report.totals;
  console.log(`${c.bold} ${fmt(["total", "", k(t.input), k(t.cacheRead), k(t.cacheWrite), k(t.output), usd(t.costUsd)])}${c.reset}`);
  const models = report.byModel.map((m) => `${m.model} ${usd(m.costUsd)} (${k(m.tokens)} tokens)`).join(" · ");
  console.log(`${c.gray} by model: ${models}${c.reset}`);
}

export function spendMarkdown(report: SpendReport): string {
  const t = report.totals;
  const rows = report.rows.map(
    (r) => `| ${r.agent} | ${r.model} | ${k(r.input)} | ${k(r.cacheRead)} | ${k(r.cacheWrite)} | ${k(r.output)} | ${usd(r.costUsd)} |`,
  );
  const models = report.byModel.map((m) => `${m.model} ${usd(m.costUsd)}`).join(" · ");
  return `<details><summary>🤖 AI spend for this run: <b>${usd(t.costUsd)}</b> (${models})</summary>

| Agent | Model | Input | Cache read | Cache write | Output | Cost |
|---|---|---:|---:|---:|---:|---:|
${rows.join("\n")}
| **Total** | | **${k(t.input)}** | **${k(t.cacheRead)}** | **${k(t.cacheWrite)}** | **${k(t.output)}** | **${usd(t.costUsd)}** |

Token counts are per agent session. Costs are the Agent SDK's estimates at list prices, not a bill.
</details>`;
}
