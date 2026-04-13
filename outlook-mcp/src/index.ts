#!/usr/bin/env node
/**
 * outlook-mcp: Model Context Protocol server exposing Microsoft Outlook
 * (Microsoft Graph) email and calendar operations over stdio.
 *
 * Quick start:
 *   1. Register an app at https://entra.microsoft.com with delegated scopes:
 *      Mail.ReadWrite, Mail.Send, MailboxSettings.ReadWrite,
 *      Calendars.ReadWrite, offline_access, User.Read
 *   2. Copy .env.example to .env and fill OUTLOOK_CLIENT_ID (+ tenant).
 *   3. npm install && npm run build
 *   4. Add to your MCP client config, e.g. claude_desktop_config.json:
 *        "outlook": {
 *          "command": "node",
 *          "args": ["/abs/path/outlook-mcp/dist/index.js"],
 *          "env": { "OUTLOOK_CLIENT_ID": "..." }
 *        }
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { loadAuthConfig, TokenProvider } from "./auth.js";
import { createGraphClient, userScope } from "./graph.js";
import { mailTools } from "./tools/mail.js";
import { calendarTools } from "./tools/calendar.js";
import type { ToolContext, ToolDefinition } from "./tools/shared.js";

const allTools: ToolDefinition[] = [...mailTools, ...calendarTools];

// Build a map once so CallTool lookups are O(1).
const toolMap = new Map<string, ToolDefinition>();
for (const tool of allTools) {
  if (toolMap.has(tool.name)) {
    throw new Error(`Duplicate tool name: ${tool.name}`);
  }
  toolMap.set(tool.name, tool);
}

// Convert a Zod schema to a JSON Schema object suitable for MCP's tool
// listing. We keep this intentionally small — the Graph SDK and our handlers
// enforce the real contract; the JSON Schema is just a hint for the client.
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    const out: Record<string, unknown> = {
      type: "object",
      properties,
      additionalProperties: false,
    };
    if (required.length > 0) out.required = required;
    return out;
  }
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema._def.innerType);
    inner.default = schema._def.defaultValue();
    return inner;
  }
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodAny) return {};
  if (schema instanceof z.ZodUnknown) return {};
  // Fall through for union / record / etc — let the client be permissive.
  return {};
}

async function main() {
  const cfg = loadAuthConfig();
  const tokenProvider = new TokenProvider(cfg);
  const graph = createGraphClient(tokenProvider);
  const ctx: ToolContext = { graph, cfg, scope: userScope(cfg) };

  const server = new Server(
    { name: "outlook-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
      };
    }
    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Invalid arguments for ${name}: ${parsed.error.message}`,
          },
        ],
      };
    }
    try {
      const result = await tool.run(parsed.data, ctx);
      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[outlook-mcp] tool ${name} failed: ${message}\n`);
      return {
        isError: true,
        content: [{ type: "text", text: `Graph request failed: ${message}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[outlook-mcp] ready — ${allTools.length} tools registered (mode=${cfg.mode})\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[outlook-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : err}\n`);
  process.exit(1);
});
