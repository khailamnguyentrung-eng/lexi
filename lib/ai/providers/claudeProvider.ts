import { getClaudeClient, CLAUDE_MODEL } from "@/lib/ai/claudeClient";
import {
  NORMALIZE_SYSTEM_PROMPT,
  GENERATE_QUESTIONS_SYSTEM_PROMPT,
  normalizeWithRetry,
  generateWithRetry,
} from "./normalizationCore";
import type { AIProvider, ChatMessageInput, GenerateQuestionsInput, GenerateQuestionsResult } from "./types";

async function callClaude(system: string, messages: ChatMessageInput[]) {
  const claude = getClaudeClient();
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system,
    messages,
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "[]";
}

export const claudeProvider: AIProvider = {
  name: "claude",
  async chat({ system, messages }) {
    return callClaude(system, messages);
  },

  // Retries exactly once on invalid JSON (see normalizationCore.ts): the
  // first bad response is sent back to Claude as its own previous turn,
  // with an explicit instruction to repair it into valid JSON.
  async normalizeQuestions({ rawText, sourceFileName }) {
    const result = await normalizeWithRetry(
      (messages) => callClaude(NORMALIZE_SYSTEM_PROMPT, messages),
      rawText,
      sourceFileName,
    );
    return { ...result, servedBy: "claude", fallbackReason: null };
  },

  async generateExplanation({ promptText, optionA, optionB, optionC, optionD, correctOption, studentAnswer }) {
    const system =
      "Bạn là Lexi, một gia sư tiếng Anh thân thiện. Giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đúng là đúng, dựa trên kiến thức ngữ pháp/từ vựng tiếng Anh chuẩn. Nếu có đáp án học sinh chọn sai, giải thích thêm vì sao đáp án đó sai. Không dùng ngôn ngữ chê trách.";
    const studentLine = studentAnswer ? `\nHọc sinh đã chọn: ${studentAnswer}` : "";
    const user = `Câu hỏi: ${promptText}\nA. ${optionA}\nB. ${optionB}\nC. ${optionC}\nD. ${optionD}\nĐáp án đúng: ${correctOption}${studentLine}`;
    return callClaude(system, [{ role: "user", content: user }]);
  },

  async generateQuestions({ topic, topicLabel, difficulty, targetCount }: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
    const result = await generateWithRetry(
      (messages) => callClaude(GENERATE_QUESTIONS_SYSTEM_PROMPT, messages),
      topic,
      topicLabel,
      difficulty,
      targetCount,
    );
    return { ...result, servedBy: "claude", fallbackReason: null };
  },
};
