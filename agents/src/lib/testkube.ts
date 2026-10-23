import { existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CliTestkubeClient, cliMcpServer } from "./testkube-cli.ts";

/** Name the Testkube MCP server is registered under; tools appear as mcp__testkube__<tool>. */
export const TESTKUBE = "testkube";

/** Fully-qualified tool names for allowedTools lists. */
export const tk = (...tools: string[]) => tools.map((t) => `mcp__${TESTKUBE}__${t}`);

// Credentials live in agents/.env (see .env.example); real environment variables win.
const ENV_FILE = join(import.meta.dirname, "..", "..", ".env");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

/**
 * How the agents reach Testkube: "mcp" (default) uses the MCP server hosted by the Testkube control
 * plane; "cli" drives the testkube CLI through an in-process MCP server with the same tools, which
 * also works with a Testkube Open Source runner (see testkube-cli.ts).
 */
export const BACKEND: "mcp" | "cli" = process.env.TESTKUBE_BACKEND?.toLowerCase() === "cli" ? "cli" : "mcp";

/** What orchestrator code needs from either backend. */
export interface TestkubeApi {
  call<T = any>(tool: string, args?: Record<string, unknown>): Promise<T>;
  toolNames(): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * The Testkube MCP server hosted by the Testkube control plane, e.g.
 *   https://api.testkube.dev/organizations/<org>/environments/<env>/mcp
 * authenticated with a Testkube API token. Nothing runs locally.
 */
function endpoint(): { url: string; headers: Record<string, string> } {
  const { TK_MCP_URL, TK_ACCESS_TOKEN } = process.env;
  const missing = Object.entries({ TK_MCP_URL, TK_ACCESS_TOKEN })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Testkube MCP: set ${missing.join(" and ")} (in agents/.env, see .env.example)`);
  }
  return { url: TK_MCP_URL!, headers: { Authorization: `Bearer ${TK_ACCESS_TOKEN}` } };
}

let toolNamesOnce: Promise<string[]> | undefined;

/** All Testkube MCP tool names (fetched once per process), so agents can hide the ones they don't use. */
export function testkubeToolNames(): Promise<string[]> {
  toolNamesOnce ??= connectTestkube().then(async (tk) => {
    try {
      return await tk.toolNames();
    } finally {
      await tk.close();
    }
  });
  return toolNamesOnce;
}

export function testkubeMcpServer(): Record<string, McpServerConfig> {
  if (BACKEND === "cli") return { [TESTKUBE]: cliMcpServer(TESTKUBE) };
  const { url, headers } = endpoint();
  return { [TESTKUBE]: { type: "http", url, headers } };
}

/** A plain (no-LLM) client for the same tools, used by setup.ts, flake.ts and loop.ts. */
export async function connectTestkube(): Promise<TestkubeApi> {
  if (BACKEND === "cli") return new CliTestkubeClient();
  const { url, headers } = endpoint();
  const client = new Client({ name: "ql-testcon-demo", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }));
  return new TestkubeClient(client);
}

export class TestkubeClient implements TestkubeApi {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /** Calls a Testkube MCP tool and returns its text output, parsed as JSON when possible. */
  async call<T = any>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const res = await this.client.callTool({ name: tool, arguments: args });
    const text = (res.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    if (res.isError) throw new Error(`${tool} failed: ${text}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  /** Names of every tool the Testkube MCP server offers. */
  async toolNames(): Promise<string[]> {
    return (await this.client.listTools()).tools.map((t) => t.name);
  }

  async close() {
    await this.client.close();
  }
}
