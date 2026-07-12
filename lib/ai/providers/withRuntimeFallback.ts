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
} from "./types";

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
        return fallback.normalizeQuestions(input);
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
        return fallback.generateQuestions(input);
      }
    },
  };
}
