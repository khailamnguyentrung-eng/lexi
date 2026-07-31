import { isClaudeConfigured, CLAUDE_MODEL } from "@/lib/ai/claudeClient";
import { isGeminiConfigured, GEMINI_MODEL } from "@/lib/ai/geminiClient";
import { isOllamaConfigured, OLLAMA_MODEL } from "@/lib/ai/ollamaClient";
import { claudeProvider } from "./claudeProvider";
import { geminiProvider } from "./geminiProvider";
import { ollamaProvider } from "./ollamaProvider";
import { mockProvider } from "./mockProvider";
import { withRuntimeFallback } from "./withRuntimeFallback";
import type { AIProvider } from "./types";

export interface AIProviderStatus {
  provider: AIProvider;
  name: "claude" | "gemini" | "ollama" | "mock";
  model: string | null; // null for mock — there's no real model behind it
  requestedProvider: string | null; // raw AI_PROVIDER value, or null if unset
  isFallback: boolean; // true if we couldn't honor what was requested/expected
  fallbackReason: string | null;
}

function status(
  provider: AIProvider,
  name: AIProviderStatus["name"],
  model: string | null,
  requestedProvider: string | null,
  isFallback: boolean,
  fallbackReason: string | null,
): AIProviderStatus {
  if (isFallback && fallbackReason) console.warn(`[AIProvider] ${fallbackReason}`);
  return { provider, name, model, requestedProvider, isFallback, fallbackReason };
}

// AI_PROVIDER explicitly selects one of "mock" | "gemini" | "anthropic".
// If unset, auto-detects by whichever API key is actually present —
// Gemini first (it has a free tier, the reason this abstraction exists),
// then Claude, then Mock. If AI_PROVIDER names a provider whose key is
// missing, falls back to Mock rather than letting an API call fail deep
// inside a request — every caller can see *why* via fallbackReason
// instead of silently getting demo output.
export function getAIProviderStatus(): AIProviderStatus {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() || null;

  if (raw === "gemini") {
    if (isGeminiConfigured()) return status(geminiProvider, "gemini", GEMINI_MODEL, raw, false, null);
    return status(
      mockProvider,
      "mock",
      null,
      raw,
      true,
      "AI_PROVIDER=gemini nhưng GOOGLE_GEMINI_API_KEY chưa được cấu hình — dùng Mock.",
    );
  }

  if (raw === "anthropic" || raw === "claude") {
    if (isClaudeConfigured()) return status(claudeProvider, "claude", CLAUDE_MODEL, raw, false, null);
    return status(
      mockProvider,
      "mock",
      null,
      raw,
      true,
      "AI_PROVIDER=anthropic nhưng ANTHROPIC_API_KEY chưa được cấu hình — dùng Mock.",
    );
  }

  if (raw === "ollama" && isOllamaConfigured()) {
    // No key to check — Ollama is local. Reachability (is the server
    // actually running) is NOT checked here; a real call failing is
    // handled the same way a dead Gemini quota is, by
    // withRuntimeFallback.ts. Never auto-detected (see below) — must be
    // opted into explicitly, since it's slow/CPU-bound and shouldn't
    // silently become the default just because no cloud key is set.
    return status(ollamaProvider, "ollama", OLLAMA_MODEL, raw, false, null);
  }

  if (raw === "mock") {
    return status(mockProvider, "mock", null, raw, false, null);
  }

  if (raw) {
    // Unrecognized value — fall through to auto-detect, but say so.
    const note = `AI_PROVIDER="${raw}" không hợp lệ (chỉ hỗ trợ mock|gemini|anthropic|ollama) — tự nhận diện theo API key sẵn có.`;
    if (isGeminiConfigured()) return status(geminiProvider, "gemini", GEMINI_MODEL, raw, true, note);
    if (isClaudeConfigured()) return status(claudeProvider, "claude", CLAUDE_MODEL, raw, true, note);
    return status(mockProvider, "mock", null, raw, true, `${note} Không có API key nào được cấu hình.`);
  }

  // No AI_PROVIDER set at all — auto-detect by key presence. This is the
  // normal/expected path when a key is configured, not a fallback.
  if (isGeminiConfigured()) return status(geminiProvider, "gemini", GEMINI_MODEL, null, false, null);
  if (isClaudeConfigured()) return status(claudeProvider, "claude", CLAUDE_MODEL, null, false, null);
  return status(
    mockProvider,
    "mock",
    null,
    null,
    true,
    "Chưa cấu hình AI_PROVIDER hoặc bất kỳ API key nào — dùng Mock.",
  );
}

export function getAIProvider(): AIProvider {
  const { provider } = getAIProviderStatus();
  // If already mock, no wrapping needed — mock is the fallback target.
  if (provider.name === "mock") return provider;
  // Wrap real providers with runtime fallback to mock.
  return withRuntimeFallback(provider, mockProvider);
}

export type { AIProvider } from "./types";
