import type { Client } from "@microsoft/microsoft-graph-client";
import type { AuthConfig } from "../auth.js";
import { z } from "zod";

export interface ToolContext {
  graph: Client;
  cfg: AuthConfig;
  scope: string;
}

/**
 * Opaque tool descriptor used by the server. Each tool wraps its own
 * Zod-typed handler so that the collection can live in a uniform array
 * without TypeScript losing per-tool input types.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  run: (args: unknown, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<S extends z.ZodTypeAny>(def: {
  name: string;
  description: string;
  inputSchema: S;
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}): ToolDefinition {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    async run(args, ctx) {
      // The server validates arguments before calling run(), so this cast is
      // safe. We pass the pre-parsed value straight through.
      return def.handler(args as z.infer<S>, ctx);
    },
  };
}

export const EmailAddressSchema = z.object({
  address: z.string().email(),
  name: z.string().optional(),
});

export type EmailAddressInput = z.infer<typeof EmailAddressSchema>;

export function toRecipients(
  addresses: EmailAddressInput[] | undefined,
): Array<{ emailAddress: { address: string; name?: string } }> | undefined {
  if (!addresses || addresses.length === 0) return undefined;
  return addresses.map((a) => ({
    emailAddress: { address: a.address, name: a.name },
  }));
}

export const BodyTypeSchema = z.enum(["text", "html"]).default("text");

export function toBody(content: string, type: "text" | "html") {
  return { contentType: type === "html" ? "HTML" : "Text", content };
}
