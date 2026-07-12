/**
 * Generated Draft Repository — M4.3
 *
 * Persistence layer for GeneratedQuestionDraft rows. This is the only file
 * that reads or writes the GeneratedQuestionDraft table.
 *
 * Rules enforced here:
 *   - Only approveDraft() may create a Question row.
 *   - Drafts with validationStatus FAIL are blocked from approval.
 *   - approveDraft() is idempotent: re-approving a draft returns the existing
 *     Question without creating a duplicate (approvedQuestionId guard).
 *   - When the last PENDING_REVIEW draft for a job is resolved, the job
 *     transitions automatically to COMPLETED.
 *
 * Architecture:
 *   GeneratedQuestionDraft (DB) ← this file ← aiDraftGenerator.ts
 *   This file calls generationJob.ts (updateJobStatus) for job completion.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { GeneratedQuestionDraft } from "./types";
import type { QuestionValidationResult } from "@/lib/services/content-intelligence/validationTypes";
import { updateJobStatus } from "./generationJob";

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

/** Map ValidationStatus string → DraftValidationStatus enum string for Prisma. */
function toDraftValidationStatus(
  status: "PASS" | "WARNING" | "FAIL"
): "PASS" | "WARNING" | "FAIL" {
  return status;
}

// ─────────────────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────────────────

/**
 * Persist a batch of generated drafts for a single job run.
 * Called by aiDraftGenerator.generateDraftsForGap() after validation.
 * Uses createMany for efficiency; returns the created row count.
 */
export async function createDraftsForJob(
  jobId: string,
  knowledgeUnitId: string,
  drafts: GeneratedQuestionDraft[],
  validationResults: QuestionValidationResult[],
): Promise<number> {
  const data = drafts.map((draft, i) => {
    const valResult = validationResults[i];
    return {
      generationJobId: jobId,
      knowledgeUnitId,
      questionCode: draft.questionCode,
      topic: draft.topic,
      difficulty: draft.difficulty,
      promptText: draft.promptText,
      optionA: draft.optionA,
      optionB: draft.optionB,
      optionC: draft.optionC,
      optionD: draft.optionD,
      correctOption: draft.correctOption,
      explanationVi: draft.explanationVi,
      commonMistake: draft.commonMistake,
      learningObjective: draft.learningObjective,
      questionType: draft.type,
      questionSkill: draft.skill,
      source: draft.source,
      validationStatus: toDraftValidationStatus(valResult.status),
      validationIssues: JSON.stringify(valResult.issues),
    };
  });

  const result = await prisma.generatedQuestionDraft.createMany({ data });
  return result.count;
}

// ─────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────

/** Return all drafts for a generation job, ordered by creation time. */
export async function listDraftsByJob(generationJobId: string) {
  return prisma.generatedQuestionDraft.findMany({
    where: { generationJobId },
    orderBy: { createdAt: "asc" },
  });
}

/** Return a single draft by id, or null if not found. */
export async function getDraft(draftId: string) {
  return prisma.generatedQuestionDraft.findUnique({ where: { id: draftId } });
}

// ─────────────────────────────────────────────────────────
// Review operations
// ─────────────────────────────────────────────────────────

/**
 * Approve a generated draft: validate it can be approved, create the Question
 * row, mark the draft APPROVED, and — if all drafts for the job are now
 * resolved — transition the job to COMPLETED.
 *
 * Throws if:
 *   - Draft not found
 *   - Draft validationStatus is FAIL (structural issues must be fixed first)
 *
 * Is idempotent: if approvedQuestionId is already set, returns the existing
 * Question without creating a duplicate.
 */
export async function approveDraft(draftId: string) {
  const draft = await prisma.generatedQuestionDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error(`GeneratedQuestionDraft not found: ${draftId}`);
  }

  // Idempotency guard
  if (draft.approvedQuestionId) {
    const existing = await prisma.question.findUnique({
      where: { id: draft.approvedQuestionId },
    });
    if (existing) return { draft, question: existing };
  }

  if (draft.validationStatus === "FAIL") {
    throw new Error(
      `Cannot approve draft ${draftId}: validationStatus is FAIL. ` +
        "Fix structural issues before approving."
    );
  }

  // Create the Question and mark the draft APPROVED atomically.
  const [question, updatedDraft] = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const q = await tx.question.create({
      data: {
        questionCode: draft.questionCode,
        // questionType and questionSkill are stored as strings in the draft;
        // cast to the Prisma enum with `as never`, matching how importer.ts
        // handles normalizedData JSON casts.
        type: draft.questionType as never,
        skill: draft.questionSkill as never,
        difficulty: draft.difficulty,
        topic: draft.topic,
        promptText: draft.promptText,
        optionA: draft.optionA,
        optionB: draft.optionB,
        optionC: draft.optionC,
        optionD: draft.optionD,
        correctOption: draft.correctOption,
        explanationVi: draft.explanationVi,
        commonMistake: draft.commonMistake,
        learningObjective: draft.learningObjective,
        source: draft.source,
        sourceExam: null,
        knowledgeUnitId: draft.knowledgeUnitId,
        generatedViaJobId: draft.generationJobId,
      },
    });

    const d = await tx.generatedQuestionDraft.update({
      where: { id: draftId },
      data: { status: "APPROVED", approvedQuestionId: q.id },
    });

    return [q, d] as const;
  });

  // If no more PENDING_REVIEW drafts remain for this job, complete the job.
  const pending = await prisma.generatedQuestionDraft.count({
    where: {
      generationJobId: draft.generationJobId,
      status: "PENDING_REVIEW",
    },
  });

  if (pending === 0) {
    await updateJobStatus(draft.generationJobId, "COMPLETED");
  }

  return { draft: updatedDraft, question };
}

/**
 * Reject a generated draft. The draft is marked REJECTED and no Question is
 * created. If all remaining drafts for the job are now resolved, transitions
 * the job to COMPLETED.
 *
 * Throws if the draft is not found.
 */
export async function rejectDraft(draftId: string, reviewNote?: string) {
  const draft = await prisma.generatedQuestionDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error(`GeneratedQuestionDraft not found: ${draftId}`);
  }

  const updated = await prisma.generatedQuestionDraft.update({
    where: { id: draftId },
    data: { status: "REJECTED", reviewNote: reviewNote ?? null },
  });

  const pending = await prisma.generatedQuestionDraft.count({
    where: {
      generationJobId: draft.generationJobId,
      status: "PENDING_REVIEW",
    },
  });

  if (pending === 0) {
    await updateJobStatus(draft.generationJobId, "COMPLETED");
  }

  return updated;
}
