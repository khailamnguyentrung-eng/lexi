// Local, no-API-key AIProvider backend — talks to Ollama's HTTP API on the
// same machine. "Configured" here means "the operator opted in via
// AI_PROVIDER=ollama", not "the server is actually reachable" — unlike
// Claude/Gemini there is no key to check for presence. If Ollama isn't
// actually running when a real call happens, that failure is caught by
// withRuntimeFallback.ts the same way a dead Gemini quota is: this file
// does not add its own reachability check or fallback logic.
export function isOllamaConfigured(): boolean {
  return true;
}

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b-instruct";

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

// Ollama's /api/generate takes one combined prompt, not a system+messages
// list like Claude/Gemini's chat APIs — system and the message history are
// concatenated into a single text block before sending. No conversation
// state is kept between calls (matches how this codebase already uses
// chat(): one system + one user turn per normalizeQuestions/generateQuestions
// call, plus at most one repair turn for JSON retry).
export async function callOllama(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const transcript = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
  const prompt = `${system}\n\n${transcript}`;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  });
  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OllamaGenerateResponse;
  return data.response;
}
