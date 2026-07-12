import type { NormalizedQuestionDraft } from "@/lib/services/content-import/normalizer";

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface NormalizeQuestionsInput {
  rawText: string;
  sourceFileName: string;
}

export interface GenerateExplanationInput {
  promptText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  studentAnswer?: string;
}

export interface NormalizeQuestionsResult {
  drafts: NormalizedQuestionDraft[];
  retryCount: number; // how many JSON-repair retries this call needed (0 or 1)
}

// Input for question generation (M4.2) — admin-triggered, gap-driven.
// topic + topicLabel identify the KnowledgeUnit; difficulty and targetCount
// scope the generation batch. The provider uses these to build its prompt.
export interface GenerateQuestionsInput {
  topic: string;        // canonical snake_case topic, e.g. "present_perfect"
  topicLabel: string;   // human-readable label, e.g. "Hiện tại hoàn thành"
  difficulty: "EASY" | "MEDIUM" | "HARD";
  targetCount: number;  // how many questions to generate (already clamped to gap)
}

export interface GenerateQuestionsResult {
  drafts: NormalizedQuestionDraft[];
  retryCount: number;
}

export interface AIProvider {
  name: "claude" | "gemini" | "mock";
  chat(params: { system: string; messages: ChatMessageInput[] }): Promise<string>;
  // Admin content-import only — never called from the student chatbot.
  // Returns *candidate* drafts; nothing in this layer ever creates a real
  // Question row. validator.ts checks the output before it's persisted as
  // an ExtractedQuestionDraft, and only a human approving that draft
  // (lib/services/content-import/importer.ts's approveDraft) creates one.
  normalizeQuestions(input: NormalizeQuestionsInput): Promise<NormalizeQuestionsResult>;
  // Standalone Vietnamese explanation for a single question — a smaller,
  // reusable building block alongside chat() and normalizeQuestions(),
  // intended for future features (e.g. Error Detective mode) rather than
  // wired into any UI yet.
  generateExplanation(input: GenerateExplanationInput): Promise<string>;
  // M4.2: Gap-driven question generation. Generates candidate drafts for a
  // specific topic + difficulty. Returns NormalizedQuestionDraft[] so the
  // result flows through the same validation gate as extracted questions.
  // Never creates Question rows — that requires human approval via approveDraft().
  generateQuestions(input: GenerateQuestionsInput): Promise<GenerateQuestionsResult>;
}

export type { NormalizedQuestionDraft };
