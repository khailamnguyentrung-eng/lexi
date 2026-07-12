/**
 * Content Generation — shared types (M4.1)
 *
 * Contract between the generation job service (generationJob.ts),
 * the draft generator (draftGenerator.ts), and the validation layer
 * (contentValidation.ts). No Prisma types cross this boundary.
 *
 * Architecture:
 *   generationJob.ts (Prisma) ─┐
 *                              ├→ draftGenerator.ts (pure) → GenerationResult
 *   contentValidation.ts ──────┘
 */

// ─────────────────────────────────────────────────────────
// Job lifecycle
// ─────────────────────────────────────────────────────────

/**
 * Mirror of the Prisma GenerationJobStatus enum — plain union so the pure
 * engine and tests can reference it without importing Prisma.
 */
export type GenerationJobStatus =
  | "PENDING"
  | "GENERATING"
  | "REVIEWING"
  | "COMPLETED"
  | "FAILED";

/**
 * Valid state machine transitions.
 * COMPLETED and FAILED are terminal — no further transitions allowed.
 */
export const VALID_JOB_TRANSITIONS: Record<GenerationJobStatus, GenerationJobStatus[]> = {
  PENDING:    ["GENERATING", "FAILED"],
  GENERATING: ["REVIEWING",  "FAILED"],
  REVIEWING:  ["COMPLETED",  "FAILED"],
  COMPLETED:  [],
  FAILED:     [],
};

/**
 * Input required to create a new generation job.
 * Aligned with the QuestionGenerationJob schema fields that must be set at creation.
 */
export interface GenerationJobInput {
  topic: string;               // must match an existing KnowledgeUnit.topic
  difficulty: "EASY" | "MEDIUM" | "HARD";
  targetCount: number;         // how many questions to generate (1–20)
}

/**
 * Lightweight job summary returned from service layer queries.
 */
export interface GenerationJobSummary {
  id: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  targetCount: number;
  status: GenerationJobStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────
// Generation pipeline
// ─────────────────────────────────────────────────────────

/**
 * Input passed to the draft generator. The service layer builds this after
 * creating the job and looking up the KnowledgeUnit label.
 */
export interface GenerationInput {
  jobId: string;
  topic: string;
  knowledgeUnitLabel: string;  // human-readable label for prompt context (M4.2+)
  difficulty: "EASY" | "MEDIUM" | "HARD";
  targetCount: number;
}

/**
 * A candidate question produced by the generation engine, ready to be
 * persisted as a GeneratedQuestionDraft DB row (M4.3) and later promoted
 * to a Question through the human review gate.
 *
 * questionCode, type, and skill are preserved from the AI provider output
 * so that approveDraft() has everything needed to create the Question row
 * without re-querying the draft or calling the AI again.
 * The source field is always "generated:<topic>:<difficulty>".
 */
export interface GeneratedQuestionDraft {
  questionCode: string;        // AI-generated, e.g. "GEN_PRESPERF_MED_01"
  type: string;                // QuestionType string — cast to enum at approval
  skill: string;               // SkillCategory string — cast to enum at approval
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  promptText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;       // "A" | "B" | "C" | "D"
  explanationVi: string;
  commonMistake: string | null;
  learningObjective: string | null;
  source: string;              // "generated:<topic>:<difficulty>"
}

/**
 * Which generator produced the drafts — used to distinguish placeholder
 * results (M4.1) from real AI output (M4.2+).
 */
export type GeneratorKind = "PLACEHOLDER" | "AI";

export interface GenerationResult {
  drafts: GeneratedQuestionDraft[];
  generatorUsed: GeneratorKind;
  jobId: string;
}
