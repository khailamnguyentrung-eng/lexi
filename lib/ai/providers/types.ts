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

// `servedBy`/`fallbackReason` report what ACTUALLY produced this result, which
// is not always what was configured: withRuntimeFallback swaps in mock when a
// real provider throws (dead quota, bad key, network), and before these fields
// existed that swap was invisible — the admin UI read config via
// getAIProviderStatus() and showed a confident "Gemini" over mock's fabricated
// questions. The truth only exists at the moment of the catch, so it has to
// ride out on the result.
export interface NormalizeQuestionsResult {
  drafts: NormalizedQuestionDraft[];
  retryCount: number; // how many JSON-repair retries this call needed (0 or 1)
  servedBy: "claude" | "gemini" | "mock"; // who actually produced `drafts`
  fallbackReason: string | null; // non-null only when a real provider failed and mock took over
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
  servedBy: "claude" | "gemini" | "mock"; // who actually produced `drafts`
  fallbackReason: string | null; // non-null only when a real provider failed and mock took over
}

// KU-1 part B, Path A: read a source and propose KnowledgeUnits — never
// creates a Question, unlike normalizeQuestions/generateQuestions above. See
// docs/KU1_PARTB_DESIGN.md §1 for why the two are kept separate.
export interface ProposeTaxonomyInput {
  rawText: string;
  // KnowledgeUnit.topic values already in the registry. Passed so the prompt
  // can tell the model not to re-propose them — FigJam's "One only" namespace
  // (docs/KU1_PARTB_DESIGN.md §7 B-3) means a source that teaches
  // "present_perfect" again should add no new proposal, not a duplicate one
  // the reviewer has to notice and merge by hand.
  existingTopics: string[];
}

export interface ProposedTaxonomyUnit {
  proposedTopic: string; // snake_case, matches KnowledgeUnit.topic's convention
  proposedLabel: string;
  // A literal quote from rawText — never paraphrased. This is what
  // PendingKnowledgeUnit.evidenceQuote is FOR: a reviewer judging "is this a
  // real, distinct concept" without it is guesswork (see the model's schema
  // comment). parseTaxonomyProposals() rejects a proposal whose quote doesn't
  // actually appear in the source text, rather than trusting the model's claim.
  evidenceQuote: string;
  evidenceLocation: string | null;
  confidence: number; // 0..1 — the model's own stated confidence, not calibrated against anything
}

export interface ProposeTaxonomyResult {
  proposals: ProposedTaxonomyUnit[];
  retryCount: number;
  servedBy: "claude" | "gemini" | "mock";
  fallbackReason: string | null;
  // Count only, not the rejected items themselves — the reasons are
  // internal QA detail (see taxonomyCore.ts's verifyEvidenceQuotes), but
  // silently dropping the COUNT would be exactly the kind of invisible
  // discrepancy AIStatusLine's truthfulness fix (DECISION_LOG) exists to
  // prevent: the model proposed N things, only `proposals.length` survived,
  // and a caller needs to know that gap exists even without the detail.
  rejectedByVerification: number;
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
  // KU-1 part B, Path A. Never creates a Question or a KnowledgeUnit — only
  // PendingKnowledgeUnit proposals, which still require human review
  // (lib/services/content-intelligence/pendingKnowledgeUnitReview.ts).
  proposeTaxonomy(input: ProposeTaxonomyInput): Promise<ProposeTaxonomyResult>;
}

export type { NormalizedQuestionDraft };
