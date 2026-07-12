/**
 * Draft Generator — M4.1 (Placeholder)
 *
 * Establishes the generation pipeline contract. The actual AI call is wired
 * in M4.2 — this module contains only the interface and the placeholder
 * implementation that returns an empty result.
 *
 * The placeholder exists to:
 *   1. Confirm the pipeline types compile end-to-end.
 *   2. Allow the job lifecycle (PENDING → GENERATING → REVIEWING) to be
 *      exercised in tests without a real model call.
 *   3. Give the validation integration a concrete shape to run against.
 *
 * IMPORTANT: The placeholder never writes to the DB and never creates drafts.
 * Real generation (AIProvider.generateQuestions) is added in M4.2.
 *
 * Architecture: pure functions — no Prisma, no AI calls, no network.
 *   generationJob.ts (Prisma) → draftGenerator.ts (pure) → GenerationResult
 *   GenerationResult.drafts → contentValidation.ts (pure) → ValidationResult
 */

import type { GenerationInput, GenerationResult, GeneratedQuestionDraft } from "./types";
import type { QuestionValidationInput, KnowledgeUnitValidationInput } from "@/lib/services/content-intelligence/validationTypes";
import { validateQuestions } from "@/lib/services/content-intelligence/contentValidation";

// ─────────────────────────────────────────────────────────
// Placeholder generator
// ─────────────────────────────────────────────────────────

/**
 * Placeholder implementation — returns zero drafts.
 *
 * M4.2 replaces this body with:
 *   const provider = getAIProvider();
 *   const raw = await provider.generateQuestions(input);
 *   return { drafts: raw, generatorUsed: "AI", jobId: input.jobId };
 *
 * The function signature is the stable contract — callers do not change
 * when the implementation is swapped.
 */
export function generateDraftQuestions(input: GenerationInput): GenerationResult {
  // Intentionally empty in M4.1. Real AI generation wired in M4.2.
  void input; // suppress unused-variable warning
  return {
    drafts: [],
    generatorUsed: "PLACEHOLDER",
    jobId: input.jobId,
  };
}

// ─────────────────────────────────────────────────────────
// Validation bridge
// ─────────────────────────────────────────────────────────

/**
 * Convert a GeneratedQuestionDraft to the QuestionValidationInput shape
 * expected by the content validation engine.
 *
 * Generated drafts do not have a DB id yet — a synthetic id is used so
 * validation results can be correlated back to the draft by index.
 */
export function toValidationInput(
  draft: GeneratedQuestionDraft,
  syntheticId: string
): QuestionValidationInput {
  return {
    id: syntheticId,
    topic: draft.topic,
    promptText: draft.promptText,
    optionA: draft.optionA,
    optionB: draft.optionB,
    optionC: draft.optionC,
    optionD: draft.optionD,
    correctOption: draft.correctOption,
    explanationVi: draft.explanationVi,
    difficulty: draft.difficulty,
    // Generated drafts may not yet be formally assigned a KnowledgeUnit FK —
    // that happens when the draft is approved via approveDraft().
    knowledgeUnitId: null,
  };
}

/**
 * Run the M3.4 content validation engine against a set of generated drafts.
 * Reuses contentValidation.validateQuestions() — no duplicated logic.
 *
 * @param drafts    Raw drafts from generateDraftQuestions()
 * @param units     KnowledgeUnits available (for mapping quality check)
 * @returns         One ValidationResult per draft, in the same order
 */
export function validateGeneratedDrafts(
  drafts: GeneratedQuestionDraft[],
  units: KnowledgeUnitValidationInput[]
) {
  const inputs = drafts.map((d, i) => toValidationInput(d, `generated:${i}`));
  return validateQuestions(inputs, units);
}
