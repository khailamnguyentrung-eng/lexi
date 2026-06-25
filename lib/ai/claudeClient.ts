import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// process.env.ANTHROPIC_API_KEY can be "" (set but empty) in .env, not just
// undefined — both mean "not configured" for our purposes.
export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getClaudeClient(): Anthropic {
  if (!isClaudeConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const CLAUDE_MODEL = "claude-sonnet-4-6";
