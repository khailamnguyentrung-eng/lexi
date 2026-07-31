/**
 * AI Draft Generator — M4.2 / M4.3
 *
 * Connects the AIProvider abstraction to the generation job lifecycle.
 * Converts AI output (NormalizedQuestionDraft[]) into GeneratedQuestionDraft[],
 * runs the M3.4 content validation gate, and persists results as
 * GeneratedQuestionDraft DB rows (M4.3) for the human review queue.
 *
 * Architecture:
 *   contextBuilder.ts (pure) → AIProvider.generateQuestions() → this file
 *   → generatedDraftRepository.createDraftsForJob() → DB rows for review
 *
 * Rules enforced here:
 *   - No Question creation. Only approveDraft() may create Question rows.
 *   - No auto-approval. Every draft requires human review.
 *   - On AI failure: job → FAILED, error stored, no fake drafts created.
 *   - Job lifecycle (PENDING → GENERATING → REVIEWING | FAILED) managed here.
 */

import { getAIProvider } from "@/lib/ai/providers/index";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { NormalizedQuestionDraft } from "@/lib/services/content-import/normalizer";
import type { KnowledgeUnitInput, KnowledgeGap } from "@/lib/services/content-intelligence/types";
import type { KnowledgeUnitValidationInput } from "@/lib/services/content-intelligence/validationTypes";
import { buildGenerationContext } from "./contextBuilder";
import { validateGeneratedDrafts } from "./draftGenerator";
import { updateJobStatus } from "./generationJob";
import { createDraftsForJob } from "./generatedDraftRepository";
import type { GeneratedQuestionDraft, GenerationResult } from "./types";

// ─────────────────────────────────────────────────────────
// Pure conversion — exported for testing
// ─────────────────────────────────────────────────────────

/**
 * Convert a NormalizedQuestionDraft (AI provider output) to GeneratedQuestionDraft.
 *
 * Preserves questionCode, type, and skill from the AI output so that
 * generatedDraftRepository.approveDraft() has everything it needs to create
 * the Question row without extra lookups. Drops sourceExam (not applicable
 * to generated content). The source field already encodes generation origin.
 */
export function toGeneratedDraft(normalized: NormalizedQuestionDraft): GeneratedQuestionDraft {
  return {
    questionCode: normalized.questionCode,
    type: normalized.type!, // generation path always sets this — see normalizer.ts's NormalizedQuestionDraft split
    skill: normalized.skill,
    topic: normalized.topic,
    difficulty: normalized.difficulty as "EASY" | "MEDIUM" | "HARD",
    promptText: normalized.promptText,
    optionA: normalized.optionA!, // generation path always sets this — see normalizer.ts's NormalizedQuestionDraft split
    optionB: normalized.optionB!, // generation path always sets this — see normalizer.ts's NormalizedQuestionDraft split
    optionC: normalized.optionC!, // generation path always sets this — see normalizer.ts's NormalizedQuestionDraft split
    optionD: normalized.optionD!, // generation path always sets this — see normalizer.ts's NormalizedQuestionDraft split
    correctOption: normalized.correctOption!, // generation path always sets this — see normalizer.ts's NormalizedQuestionDraft split
    explanationVi: normalized.explanationVi,
    commonMistake: normalized.commonMistake,
    learningObjective: normalized.learningObjective,
    source: normalized.source,
  };
}

// ─────────────────────────────────────────────────────────
// Provider call — pure-ish (no DB), injectable for testing
// ─────────────────────────────────────────────────────────

/**
 * Call a provider's generateQuestions() and convert the output to
 * GeneratedQuestionDraft[]. Does NOT update job status or persist drafts —
 * those are the responsibility of generateDraftsForGap() below.
 *
 * Exported so tests can inject a mock provider without needing a real DB.
 */
export async function callGenerationProvider(
  provider: AIProvider,
  context: { topic: string; topicLabel: string; difficulty: "EASY" | "MEDIUM" | "HARD"; count: number },
): Promise<{ drafts: GeneratedQuestionDraft[]; retryCount: number }> {
  const result = await provider.generateQuestions({
    topic: context.topic,
    topicLabel: context.topicLabel,
    difficulty: context.difficulty,
    targetCount: context.count,
  });

  const drafts = result.drafts.map(toGeneratedDraft);
  return { drafts, retryCount: result.retryCount };
}

// ─────────────────────────────────────────────────────────
// Full orchestrator — requires Prisma (job status + persistence)
// ─────────────────────────────────────────────────────────

/**
 * Run the full generation pipeline for a detected knowledge gap.
 *
 * Steps:
 *   1. Build GenerationContext (pure — clamps count to gap)
 *   2. Transition job PENDING → GENERATING
 *   3. Call AIProvider.generateQuestions()
 *   4. Convert NormalizedQuestionDraft[] → GeneratedQuestionDraft[]
 *   5. Run M3.4 content validation on all drafts
 *   6. Persist validated drafts as GeneratedQuestionDraft DB rows (M4.3)
 *   7. Transition GENERATING → REVIEWING
 *   8. On any error: transition to FAILED, return empty result
 *
 * @param jobId          Existing QuestionGenerationJob id (must be in PENDING status)
 * @param unit           KnowledgeUnit being targeted (unit.id = knowledgeUnitId for drafts)
 * @param gap            Gap detected by knowledgeGap.ts for this unit
 * @param difficulty     Which band to fill
 * @param requestedCount Admin's requested count (clamped to gap internally)
 * @param knowledgeUnits All KnowledgeUnits — passed to validation for mapping check
 */
export async function generateDraftsForGap(
  jobId: string,
  unit: KnowledgeUnitInput,
  gap: KnowledgeGap,
  difficulty: "EASY" | "MEDIUM" | "HARD",
  requestedCount: number,
  knowledgeUnits: KnowledgeUnitValidationInput[] = [],
): Promise<GenerationResult> {
  // Step 1: build context (throws if no gap exists)
  const context = buildGenerationContext(unit, gap, difficulty, requestedCount);

  // Step 2: PENDING → GENERATING
  await updateJobStatus(jobId, "GENERATING");

  try {
    // Steps 3+4: call provider, convert output
    const provider = getAIProvider();
    const { drafts } = await callGenerationProvider(provider, context);

    if (drafts.length === 0) {
      await updateJobStatus(jobId, "FAILED", "AI provider returned zero drafts");
      return { drafts: [], generatorUsed: "AI", jobId };
    }

    // Step 5: run M3.4 validation
    const validationResults = validateGeneratedDrafts(drafts, knowledgeUnits);

    // Step 6: persist drafts to DB (M4.3)
    await createDraftsForJob(jobId, unit.id, drafts, validationResults);

    // Step 7: success
    await updateJobStatus(jobId, "REVIEWING");
    return { drafts, generatorUsed: "AI", jobId };
  } catch (err) {
    // Step 8: any error → FAILED
    const message = err instanceof Error ? err.message : String(err);
    await updateJobStatus(jobId, "FAILED", message);
    return { drafts: [], generatorUsed: "AI", jobId };
  }
}
