import { getGeminiClient, GEMINI_MODEL } from "@/lib/ai/geminiClient";
import {
  NORMALIZE_SYSTEM_PROMPT,
  GENERATE_QUESTIONS_SYSTEM_PROMPT,
  normalizeWithRetry,
  generateWithRetry,
} from "./normalizationCore";
import type { AIProvider, ChatMessageInput, GenerateQuestionsInput, GenerateQuestionsResult } from "./types";

// Gemini uses "model" where Anthropic/our ChatMessageInput use
// "assistant" — translate at the boundary so the rest of the codebase
// (chat route, normalizationCore) never needs to know this difference
// exists.
async function callGemini(system: string, messages: ChatMessageInput[]) {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction: system },
  });
  return response.text ?? "[]";
}

export const geminiProvider: AIProvider = {
  name: "gemini",
  async chat({ system, messages }) {
    return callGemini(system, messages);
  },

  // Retries exactly once on invalid JSON (see normalizationCore.ts) — same
  // policy as claudeProvider, just routed through Gemini's API instead.
  async normalizeQuestions({ rawText, sourceFileName }) {
    const result = await normalizeWithRetry(
      (messages) => callGemini(NORMALIZE_SYSTEM_PROMPT, messages),
      rawText,
      sourceFileName,
    );
    return { ...result, servedBy: "gemini", fallbackReason: null };
  },

  async generateExplanation({ promptText, optionA, optionB, optionC, optionD, correctOption, studentAnswer }) {
    const system =
      "Bạn là Lexi, một gia sư tiếng Anh thân thiện. Giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đúng là đúng, dựa trên kiến thức ngữ pháp/từ vựng tiếng Anh chuẩn. Nếu có đáp án học sinh chọn sai, giải thích thêm vì sao đáp án đó sai. Không dùng ngôn ngữ chê trách.";
    const studentLine = studentAnswer ? `\nHọc sinh đã chọn: ${studentAnswer}` : "";
    const user = `Câu hỏi: ${promptText}\nA. ${optionA}\nB. ${optionB}\nC. ${optionC}\nD. ${optionD}\nĐáp án đúng: ${correctOption}${studentLine}`;
    return callGemini(system, [{ role: "user", content: user }]);
  },

  async generateQuestions({ topic, topicLabel, difficulty, targetCount }: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
    const result = await generateWithRetry(
      (messages) => callGemini(GENERATE_QUESTIONS_SYSTEM_PROMPT, messages),
      topic,
      topicLabel,
      difficulty,
      targetCount,
    );
    return { ...result, servedBy: "gemini", fallbackReason: null };
  },
};
