// Runtime fallback wrapper: if a configured provider fails at API call time,
// automatically degrade to mockProvider rather than surfacing an error.
// Wraps the AIProvider interface without modifying any provider implementations
// or call sites. Only normalizeQuestions, generateExplanation, and generateQuestions
// fall back; chat remains pass-through so the route's existing error handling stays in place.

import type {
  AIProvider,
  ChatMessageInput,
  GenerateExplanationInput,
  GenerateQuestionsInput,
  GenerateQuestionsResult,
  NormalizeQuestionsInput,
  NormalizeQuestionsResult,
  ProposeTaxonomyInput,
  ProposeTaxonomyResult,
} from "./types";

// Provider error messages can be long (Gemini's 429 body is ~1KB of JSON) and
// are not guaranteed key-free. AIRunReport promises to carry no API key, so
// summarise rather than interpolate the raw message into the UI.
const MAX_REASON_CHARS = 200;

function summarizeProviderError(providerName: string, errMsg: string): string {
  const oneLine = errMsg.replace(/\s+/g, " ").trim();
  const clipped =
    oneLine.length > MAX_REASON_CHARS ? `${oneLine.slice(0, MAX_REASON_CHARS)}…` : oneLine;
  return `${providerName} thất bại — đã dùng Mock thay thế. Nội dung dưới đây là DỮ LIỆU GIẢ, không phải kết quả AI thật. Lỗi: ${clipped}`;
}

export function withRuntimeFallback(primary: AIProvider, fallback: AIProvider): AIProvider {
  return {
    name: primary.name,

    // Chat remains pass-through — the calling route (app/api/chat/[sessionId]/messages)
    // already has a try/catch that returns student-appropriate messaging.
    // Wrapping here would replace that graceful degradation with admin-facing mock output.
    async chat(params: { system: string; messages: ChatMessageInput[] }): Promise<string> {
      return primary.chat(params);
    },

    // Fall back on any error (API failure, quota, network, auth, etc.).
    // Returns clearly labeled mock drafts which the human review gate will catch
    // before any Question row is persisted.
    async normalizeQuestions(input: NormalizeQuestionsInput): Promise<NormalizeQuestionsResult> {
      try {
        return await primary.normalizeQuestions(input);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AI FALLBACK ACTIVE] ${primary.name} normalizeQuestions failed (${errMsg}). Using ${fallback.name}.`
        );
        const result = await fallback.normalizeQuestions(input);
        // Override the fallback's own honest self-report: it says "mock served
        // this", which is true but incomplete. What the admin needs to know is
        // that mock served it BECAUSE the real provider failed, and why.
        return { ...result, fallbackReason: summarizeProviderError(primary.name, errMsg) };
      }
    },

    // Fall back on any error. Mock returns a labeled placeholder explanation
    // suitable for review before any student-facing use.
    async generateExplanation(input: GenerateExplanationInput): Promise<string> {
      try {
        return await primary.generateExplanation(input);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AI FALLBACK ACTIVE] ${primary.name} generateExplanation failed (${errMsg}). Using ${fallback.name}.`
        );
        return fallback.generateExplanation(input);
      }
    },

    // Fall back on any error. Mock returns clearly labeled placeholder drafts
    // that the human review gate will flag before any Question row is created.
    async generateQuestions(input: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
      try {
        return await primary.generateQuestions(input);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AI FALLBACK ACTIVE] ${primary.name} generateQuestions failed (${errMsg}). Using ${fallback.name}.`
        );
        const result = await fallback.generateQuestions(input);
        return { ...result, fallbackReason: summarizeProviderError(primary.name, errMsg) };
      }
    },

    // Fall back on any error. Mock returns a proposal grounded in a real
    // snippet of the actual rawText (see mockProvider.ts) — clearly labeled,
    // still requires human review before any KnowledgeUnit is created.
    async proposeTaxonomy(input: ProposeTaxonomyInput): Promise<ProposeTaxonomyResult> {
      try {
        return await primary.proposeTaxonomy(input);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AI FALLBACK ACTIVE] ${primary.name} proposeTaxonomy failed (${errMsg}). Using ${fallback.name}.`
        );
        const result = await fallback.proposeTaxonomy(input);
        // Mirrors normalizeQuestions/generateQuestions: override the
        // fallback's own honest "mock served this" with WHY it had to.
        return { ...result, fallbackReason: summarizeProviderError(primary.name, errMsg) };
      }
    },
  };
}
