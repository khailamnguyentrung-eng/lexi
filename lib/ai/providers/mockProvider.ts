import type { AIProvider, NormalizedQuestionDraft, GenerateQuestionsInput, GenerateQuestionsResult } from "./types";

// Used when no real AI provider is configured (no ANTHROPIC_API_KEY or
// GOOGLE_GEMINI_API_KEY, or AI_PROVIDER=mock explicitly), so the chat UI
// still responds instead of dead-ending. Deliberately does NOT pretend to
// be a real grammar explanation — fabricating English-teaching content
// would be worse than no AI at all. Just acknowledges the question and is
// upfront about being a placeholder.
const TEMPLATES = [
  (question: string) =>
    `Đây là phản hồi mẫu (chế độ demo, chưa kết nối AI thật) cho câu hỏi: "${question}". Khi quản trị viên cấu hình AI_PROVIDER (Gemini hoặc Claude), Lexi sẽ giải thích chi tiết hơn. Trong lúc này, bạn có thể xem lại phần giải thích trong bài luyện tập nhé! 🦄`,
  (question: string) =>
    `Lexi ghi nhận câu hỏi: "${question}" — nhưng hiện tại đang ở chế độ demo nên chưa thể trả lời sâu được. Hãy nhờ quản trị viên cấu hình AI thật, hoặc xem lại "Vì sao" trong phần luyện tập để ôn lại nhé.`,
];

// Canned generation drafts — clearly labeled placeholders for the generation
// pipeline when no real provider is configured. Returns at most 2 drafts
// regardless of targetCount so demo mode doesn't flood the review queue.
function buildMockGeneratedDrafts(
  topic: string,
  topicLabel: string,
  difficulty: string,
  targetCount: number,
): NormalizedQuestionDraft[] {
  const prefix = topic.toUpperCase().replace(/_/g, "").slice(0, 8);
  const diffShort = difficulty.slice(0, 3);
  const source = `generated:${topic}:${difficulty}`;
  const count = Math.min(targetCount, 2); // cap mock output at 2

  return Array.from({ length: count }, (_, i) => ({
    questionCode: `GEN_${prefix}_${diffShort}_${String(i + 1).padStart(2, "0")}`,
    type: "GRAMMAR_MCQ",
    skill: "VOCAB_GRAMMAR",
    difficulty,
    topic,
    promptText: `(mẫu AI demo — ${topicLabel}, ${difficulty}) Câu ${i + 1}: Chọn đáp án đúng. (Cấu hình AI_PROVIDER thật để có câu hỏi thực sự)`,
    optionA: "Lựa chọn A (mẫu demo)",
    optionB: "Lựa chọn B (mẫu demo)",
    optionC: "Lựa chọn C (mẫu demo)",
    optionD: "Lựa chọn D (mẫu demo)",
    correctOption: "A",
    explanationVi: `Đây là câu hỏi mẫu về chủ điểm ${topicLabel} ở mức ${difficulty}. Admin cần cấu hình AI_PROVIDER (Gemini hoặc Claude) để nhận câu hỏi thực sự từ AI.`,
    commonMistake: null,
    learningObjective: `Ôn luyện kiến thức về ${topicLabel} ở mức ${difficulty}.`,
    source,
    sourceExam: null,
  }));
}

// Canned drafts for the content-import pipeline when no real provider is
// configured — same purpose as the chat templates above: clearly labeled
// placeholders, not a fabricated reading of the actual document.
function buildMockDrafts(sourceFileName: string): NormalizedQuestionDraft[] {
  const prefix = sourceFileName
    .replace(/\.[^.]+$/, "")
    .slice(0, 20)
    .replace(/[^a-zA-Z0-9]/g, "_");

  return [
    {
      questionCode: `IMPORT_${prefix}_SAMPLE1`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      difficulty: "MEDIUM",
      topic: "present_perfect",
      promptText: "She ___ in Hanoi since 2018. (mẫu AI demo, cần admin kiểm tra lại — chưa có AI thật)",
      optionA: "live",
      optionB: "lived",
      optionC: "has lived",
      optionD: "living",
      correctOption: "C",
      explanationVi: "Dùng hiện tại hoàn thành với 'since' để chỉ hành động kéo dài từ quá khứ đến hiện tại.",
      commonMistake: "Học sinh dễ chọn quá khứ đơn 'lived' khi câu có mốc thời gian bắt đầu (since).",
      learningObjective: "Phân biệt hiện tại hoàn thành với quá khứ đơn khi có 'since'.",
      source: sourceFileName,
      sourceExam: null,
    },
    {
      questionCode: `IMPORT_${prefix}_SAMPLE2`,
      type: "READING_COMPREHENSION",
      skill: "READING",
      difficulty: "MEDIUM",
      topic: "reading_comprehension_detail",
      promptText: "(mẫu AI demo — câu hỏi đọc hiểu thực tế sẽ thay thế dòng này khi có AI thật)",
      optionA: "Option A",
      optionB: "Option B",
      optionC: "Option C",
      optionD: "Option D",
      correctOption: "A",
      explanationVi: "Đây là dữ liệu mẫu để minh hoạ luồng review — chưa phải nội dung thật từ file.",
      commonMistake: null,
      learningObjective: "Minh hoạ pipeline import, cần thay bằng AI thật.",
      source: sourceFileName,
      sourceExam: null,
    },
  ];
}

export const mockProvider: AIProvider = {
  name: "mock",
  async chat({ messages }) {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const question = lastUserMessage?.content.slice(0, 200) ?? "câu hỏi của bạn";
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    return template(question);
  },
  async normalizeQuestions({ sourceFileName }) {
    return { drafts: buildMockDrafts(sourceFileName), retryCount: 0, servedBy: "mock", fallbackReason: null };
  },
  async generateExplanation({ promptText, correctOption }) {
    return `(Giải thích mẫu — chế độ demo) Đáp án đúng cho câu "${promptText.slice(0, 80)}" là ${correctOption}. Cấu hình AI_PROVIDER thật để có giải thích chi tiết.`;
  },

  async generateQuestions({ topic, topicLabel, difficulty, targetCount }: GenerateQuestionsInput): Promise<GenerateQuestionsResult> {
    return {
      drafts: buildMockGeneratedDrafts(topic, topicLabel, difficulty, targetCount),
      retryCount: 0,
      servedBy: "mock",
      fallbackReason: null,
    };
  },
};
