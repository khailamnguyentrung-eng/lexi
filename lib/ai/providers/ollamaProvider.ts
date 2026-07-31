import { callOllama, OLLAMA_MODEL } from "@/lib/ai/ollamaClient";
import {
  NORMALIZE_SYSTEM_PROMPT,
  GENERATE_QUESTIONS_SYSTEM_PROMPT,
  normalizeWithRetry,
  generateWithRetry,
} from "./normalizationCore";
import { PROPOSE_TAXONOMY_SYSTEM_PROMPT, proposeTaxonomyWithRetry } from "./taxonomyCore";
import type {
  AIProvider,
  ChatMessageInput,
  GenerateQuestionsInput,
  GenerateQuestionsResult,
  ProposeTaxonomyInput,
  ProposeTaxonomyResult,
} from "./types";

async function callOllamaChat(system: string, messages: ChatMessageInput[]) {
  return callOllama(system, messages);
}

// Local, no-API-key provider (Ollama). Same AIProvider shape as
// claudeProvider/geminiProvider — nothing above this file needs to know
// which one is running. Model quality/speed differs a lot from the cloud
// providers (see docs/superpowers/specs/... for the CPU-only benchmark
// this was built against); withRuntimeFallback.ts still governs what
// happens if the local server isn't reachable.
export const ollamaProvider: AIProvider = {
  name: "ollama",
  async chat({ system, messages }) {
    return callOllamaChat(system, messages);
  },

  async normalizeQuestions({ rawText, sourceFileName }) {
    const result = await normalizeWithRetry(
      (messages) => callOllamaChat(NORMALIZE_SYSTEM_PROMPT, messages),
      rawText,
      sourceFileName,
    );
    return { ...result, servedBy: "ollama", fallbackReason: null };
  },

  async generateExplanation({ promptText, optionA, optionB, optionC, optionD, correctOption, studentAnswer }) {
    const system =
      "Bạn là Lexi, một gia sư tiếng Anh thân thiện. Giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đúng là đúng, dựa trên kiến thức ngữ pháp/từ vựng tiếng Anh chuẩn. Nếu có đáp án học sinh chọn sai, giải thích thêm vì sao đáp án đó sai. Không dùng ngôn ngữ chê trách.";
    const studentLine = studentAnswer ? `\nHọc sinh đã chọn: ${studentAnswer}` : "";
    const user = `Câu hỏi: ${promptText}\nA. ${optionA}\nB. ${optionB}\nC. ${optionC}\nD. ${optionD}\nĐáp án đúng: ${correctOption}${studentLine}`;
    return callOllamaChat(system, [{ role: "user", content: user }]);
  },

  async generateQuestions({ topic, topicLabel, difficulty, targetCount }: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
    const result = await generateWithRetry(
      (messages) => callOllamaChat(GENERATE_QUESTIONS_SYSTEM_PROMPT, messages),
      topic,
      topicLabel,
      difficulty,
      targetCount,
    );
    return { ...result, servedBy: "ollama", fallbackReason: null };
  },

  async proposeTaxonomy({ rawText, existingTopics }: ProposeTaxonomyInput): Promise<ProposeTaxonomyResult> {
    const { accepted, rejected, retryCount } = await proposeTaxonomyWithRetry(
      (messages) => callOllamaChat(PROPOSE_TAXONOMY_SYSTEM_PROMPT, messages),
      rawText,
      existingTopics,
    );
    return {
      proposals: accepted,
      retryCount,
      servedBy: "ollama",
      fallbackReason: null,
      rejectedByVerification: rejected.length,
    };
  },
};

export { OLLAMA_MODEL };
