import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { query, type EffortLevel } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { testkubeMcpServer } from "./testkube.ts";
import { AgentLog } from "./ui.ts";

export interface AgentSpec<T> {
  /** Agent name; selects the prompt file src/prompts/<name>.md and the UI colour. */
  name: string;
  /** Shown next to the name in the UI, e.g. the workflow a triage agent works on. */
  qualifier?: string;
  model: string;
  effort: EffortLevel;
  prompt: string;
  /** Built-in Claude Code tools made available (Read, Edit, Bash, ...). Empty = MCP only. */
  tools: string[];
  /** Tools that run without asking. Anything else is denied (permissionMode: dontAsk). */
  allowedTools: string[];
  schema: z.ZodType<T>;
  cwd?: string;
  maxTurns: number;
}

export interface AgentResult<T> {
  output: T;
  costUsd: number;
  durationMs: number;
  turns: number;
  /** Claude Code session ID; the transcript lives in ~/.claude/projects/<cwd>/<sessionId>.jsonl */
  sessionId: string;
  cwd: string;
}

/** Every agent session started in this process, for the run manifest. */
export const sessions: Array<{ agent: string; sessionId: string; cwd: string; durationMs: number; costUsd: number }> = [];

const PROMPT_DIR = join(import.meta.dirname, "..", "prompts");

/** JSON Schema for structured output; the CLI rejects zod's `$schema` dialect marker. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export async function runAgent<T>(spec: AgentSpec<T>): Promise<AgentResult<T>> {
  const log = new AgentLog(spec.name, spec.qualifier);
  const systemPrompt = await readFile(join(PROMPT_DIR, `${spec.name}.md`), "utf8");

  const conversation = query({
    prompt: spec.prompt,
    options: {
      model: spec.model,
      effort: spec.effort,
      systemPrompt,
      tools: spec.tools,
      allowedTools: spec.allowedTools,
      permissionMode: "dontAsk",
      // Only the Testkube server configured here: no project/user MCP config and no
      // claude.ai account connectors, so every agent uses the same, allow-listed tools.
      mcpServers: testkubeMcpServer(),
      strictMcpConfig: true,
      env: { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
      settingSources: [],
      cwd: spec.cwd,
      maxTurns: spec.maxTurns,
      outputFormat: { type: "json_schema", schema: jsonSchema(spec.schema) },
    },
  });

  for await (const message of conversation) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") log.think(block.text);
        if (block.type === "tool_use" && block.name !== "StructuredOutput") {
          log.tool(block.name, block.input as Record<string, unknown>);
        }
      }
    } else if (message.type === "user" && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (block.type === "tool_result" && block.is_error) {
          const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
          log.toolError(text);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype !== "success") {
        log.fail(`agent stopped: ${message.subtype}`);
        throw new Error(`${spec.name} agent failed: ${message.subtype}`);
      }
      const output = spec.schema.parse(message.structured_output);
      const cwd = spec.cwd ?? process.cwd();
      const agent = spec.qualifier ? `${spec.name}:${spec.qualifier}` : spec.name;
      sessions.push({ agent, sessionId: message.session_id, cwd, durationMs: message.duration_ms, costUsd: message.total_cost_usd });
      log.info(`done in ${(message.duration_ms / 1000).toFixed(1)}s · ${message.num_turns} turns · session ${message.session_id}`);
      return {
        output,
        costUsd: message.total_cost_usd,
        durationMs: message.duration_ms,
        turns: message.num_turns,
        sessionId: message.session_id,
        cwd,
      };
    }
  }
  throw new Error(`${spec.name} agent ended without a result`);
}
