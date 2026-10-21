import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/** Name the Testkube MCP server is registered under; tools appear as mcp__testkube__<tool>. */
export const TESTKUBE = "testkube";

/** Fully-qualified tool names for allowedTools lists. */
export const tk = (...tools: string[]) => tools.map((t) => `mcp__${TESTKUBE}__${t}`);

/**
 * Testkube MCP connection. By default spawns the local stdio server (`testkube mcp serve`),
 * which reuses the authenticated CLI context. Set TK_ACCESS_TOKEN, TK_ORG_ID and TK_ENV_ID to
 * use the hosted endpoint instead. Note: Insights boards need a user session (stdio/OAuth),
 * API tokens cannot create them.
 */
function hostedUrl(): string | undefined {
  const { TK_ACCESS_TOKEN, TK_ORG_ID, TK_ENV_ID } = process.env;
  if (!TK_ACCESS_TOKEN || !TK_ORG_ID || !TK_ENV_ID) return undefined;
  return `https://api.testkube.io/organizations/${TK_ORG_ID}/environments/${TK_ENV_ID}/mcp`;
}

export function testkubeMcpServer(): Record<string, McpServerConfig> {
  const url = hostedUrl();
  if (url) {
    return {
      [TESTKUBE]: { type: "http", url, headers: { Authorization: `Bearer ${process.env.TK_ACCESS_TOKEN}` } },
    };
  }
  return { [TESTKUBE]: { type: "stdio", command: "testkube", args: ["mcp", "serve"] } };
}

/** A plain (no-LLM) MCP client, used by setup.ts and for deterministic lookups in loop.ts. */
export async function connectTestkube(): Promise<TestkubeClient> {
  const client = new Client({ name: "ql-testcon-demo", version: "1.0.0" });
  const url = hostedUrl();
  const transport = url
    ? new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { Authorization: `Bearer ${process.env.TK_ACCESS_TOKEN}` } },
      })
    : new StdioClientTransport({ command: "testkube", args: ["mcp", "serve"], stderr: "ignore" });
  await client.connect(transport);
  return new TestkubeClient(client);
}

export class TestkubeClient {
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

  close() {
    return this.client.close();
  }
}
