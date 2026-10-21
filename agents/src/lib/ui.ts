/** Terminal rendering for the live demo: colour-coded, prefixed agent activity. */

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export const AGENT_COLORS: Record<string, string> = {
  selector: c.cyan,
  executor: c.blue,
  triage: c.magenta,
  remediator: c.yellow,
  gate: c.green,
  loop: c.gray,
};

const startedAt = Date.now();
const elapsed = () => {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export class AgentLog {
  private label: string;
  private color: string;

  constructor(agent: string, qualifier?: string) {
    this.color = AGENT_COLORS[agent] ?? c.gray;
    this.label = qualifier ? `${agent}:${qualifier}` : agent;
  }

  private line(icon: string, text: string, style = "") {
    const prefix = `${c.gray}${elapsed()}${c.reset} ${this.color}${c.bold}[${this.label}]${c.reset}`;
    for (const [i, row] of text.split("\n").entries()) {
      console.log(`${prefix} ${i === 0 ? icon : " "} ${style}${row}${c.reset}`);
    }
  }

  think(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const rows = trimmed.split("\n").filter(Boolean);
    const shown = rows.slice(0, 4).join("\n") + (rows.length > 4 ? " …" : "");
    this.line("💭", shown, c.dim);
  }

  tool(name: string, input: Record<string, unknown>) {
    const short = name.replace(/^mcp__testkube__/, "testkube.");
    this.line("🔧", `${short} ${c.gray}${summarizeInput(input)}`);
  }

  toolError(text: string) {
    this.line("⚠️ ", text.slice(0, 200), c.red);
  }

  info(text: string) {
    this.line("•", text);
  }

  ok(text: string) {
    this.line("✅", text, c.green);
  }

  fail(text: string) {
    this.line("❌", text, c.red);
  }
}

function summarizeInput(input: Record<string, unknown>): string {
  const parts = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}=${s.length > 60 ? s.slice(0, 57) + "…" : s}`;
    });
  return parts.join(" ");
}

export function banner(title: string, subtitle = "") {
  const width = 78;
  console.log("");
  console.log(`${c.bold}${"━".repeat(width)}${c.reset}`);
  console.log(`${c.bold} ${title}${c.reset}${subtitle ? `  ${c.gray}${subtitle}${c.reset}` : ""}`);
  console.log(`${c.bold}${"━".repeat(width)}${c.reset}`);
}

export function statusIcon(status: string): string {
  if (status === "passed") return "✅";
  if (status === "failed") return "❌";
  return "⚠️ ";
}

export const colors = c;
