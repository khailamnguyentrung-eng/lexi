// Step 3+4 of the pipeline: orchestrate extractor -> normalizer, persist
// the result as ExtractedQuestionDraft rows, and handle the human
// review step (approve writes a real Question row; reject just marks
// the draft). This is the file admin API routes call into — extractor.ts
// and normalizer.ts are implementation details it depends on, not public
// surface area for routes.
import { prisma } from "@/lib/db/prisma";
import type { ContentFileType, ContentSource } from "@prisma/client";
import { fileExtractor } from "./extractor";
import { normalizeWithAI } from "./ai-normalizer";
import type { NormalizedQuestionDraft } from "./normalizer";
import { autoAssignKnowledgeUnit } from "@/lib/services/content-intelligence/questionKnowledgeMapping";

// Step 1: register an uploaded file. Actual byte storage (local disk vs.
// object storage) is intentionally outside this function — callers pass
// the already-stored `storagePath`.
export async function createContentSource(params: {
  userId: string;
  fileName: string;
  fileType: ContentFileType;
  storagePath: string;
  sourceLabel?: string;
  province?: string;
  examYear?: number;
  examType?: string;
  gradeLevel?: string;
  subject?: string;
}) {
  return prisma.contentSource.create({
    data: {
      userId: params.userId,
      fileName: params.fileName,
      fileType: params.fileType,
      storagePath: params.storagePath,
      sourceLabel: params.sourceLabel,
      province: params.province,
      examYear: params.examYear,
      examType: params.examType,
      gradeLevel: params.gradeLevel,
      subject: params.subject,
      sourceFileName: params.fileName,
    },
  });
}

export interface PersistDraftsSummary {
  validCount: number;
  invalidCount: number;
  retryCount: number;
  servedBy: "claude" | "gemini" | "mock";
  fallbackReason: string | null;
}

// Shared by runImportJob (full document) and sampleTest.ts's
// runSampleNormalization (first-N-questions test run) — both create an
// ImportJob row themselves (different starting context: full extraction
// vs. a sliced sample) and then hand the resulting raw text here to run
// AI normalization, validate it, and persist drafts. Centralizing this
// means the REJECTED-on-invalid logic only lives in one place. Returns a
// small summary (counts + retryCount) so callers can build a run report
// (Task 4 in PROJECT_STATUS.md) without re-deriving it from the drafts.
async function normalizeAndPersistDrafts(
  jobId: string,
  rawText: string,
  contentSource: ContentSource,
): Promise<PersistDraftsSummary> {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "EXTRACTED", rawExtractedText: rawText },
  });

  const { results, retryCount, servedBy, fallbackReason } = await normalizeWithAI(rawText, contentSource);

  await prisma.importJob.update({ where: { id: jobId }, data: { status: "REVIEWING" } });

  await prisma.extractedQuestionDraft.createMany({
    data: results.map(({ draft, isValid, errors }) => ({
      importJobId: jobId,
      normalizedData: JSON.stringify(draft),
      reviewStatus: isValid ? "PENDING_REVIEW" : "REJECTED",
      reviewNote: isValid ? null : `Tự động từ chối do lỗi kiểm tra: ${errors.join("; ")}`,
    })),
  });

  return {
    validCount: results.filter((r) => r.isValid).length,
    invalidCount: results.filter((r) => !r.isValid).length,
    retryCount,
    servedBy,
    fallbackReason,
  };
}

// Step 2+3: run extraction + AI-assisted normalization for a content
// source, persist the resulting drafts. extractor.ts does real text
// extraction for DOCX/PDF; normalizeWithAI() goes through the
// Claude/Mock AIProvider switch and validates the result before it's
// ever persisted. Drafts that fail validation are stored as REJECTED
// (with the validation errors as the review note) so they're visible for
// debugging but can never be approved into a real Question; drafts that
// pass validation are PENDING_REVIEW, same as before.
export async function runImportJob(contentSourceId: string) {
  const contentSource = await prisma.contentSource.findUniqueOrThrow({ where: { id: contentSourceId } });

  const job = await prisma.importJob.create({
    data: { contentSourceId, status: "EXTRACTING" },
  });

  try {
    const { rawText } = await fileExtractor.extract(contentSource);
    await normalizeAndPersistDrafts(job.id, rawText, contentSource);
    return prisma.importJob.findUniqueOrThrow({ where: { id: job.id }, include: { drafts: true } });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

export { normalizeAndPersistDrafts };

export async function listPendingDrafts(importJobId: string) {
  return prisma.extractedQuestionDraft.findMany({
    where: { importJobId, reviewStatus: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
  });
}

// Approve a draft — creates the real Question row and records the
// resulting id so re-approval is a no-op.
export async function approveDraft(draftId: string, reviewedByUserId: string) {
  const draft = await prisma.extractedQuestionDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { importJob: { select: { contentSourceId: true } } },
  });
  const data: NormalizedQuestionDraft = JSON.parse(draft.normalizedData);

  const created = await prisma.question.create({
    data: {
      questionCode: data.questionCode,
      type: data.type as never,
      skill: data.skill as never,
      difficulty: data.difficulty as never,
      topic: data.topic,
      promptText: data.promptText,
      optionA: data.optionA,
      optionB: data.optionB,
      optionC: data.optionC,
      optionD: data.optionD,
      correctOption: data.correctOption,
      explanationVi: data.explanationVi,
      commonMistake: data.commonMistake,
      learningObjective: data.learningObjective,
      source: data.source,
      sourceExam: data.sourceExam,
    },
  });

  // Attempt topic-based KnowledgeUnit assignment. Non-throwing: missing
  // KnowledgeUnit never fails approval — backward compatible with all
  // existing questions and topics that predate the KnowledgeUnit registry.
  // On a miss, this records a PendingKnowledgeUnit (KU-1 part B) instead of
  // discarding the topic — promptText is the evidence a reviewer needs to
  // judge whether it's a real KnowledgeUnit.
  try {
    await autoAssignKnowledgeUnit(created.id, data.topic, {
      contentSourceId: draft.importJob.contentSourceId,
      evidenceQuote: data.promptText,
    });
  } catch {
    // auto-assign failure is non-critical; coverage still works via topic matching
  }

  const updated = await prisma.extractedQuestionDraft.update({
    where: { id: draftId },
    data: { reviewStatus: "APPROVED", reviewedByUserId, importedQuestionId: created.id },
  });

  await maybeMarkJobImported(draft.importJobId);
  return updated;
}

export async function rejectDraft(draftId: string, reviewedByUserId: string, reviewNote?: string) {
  const draft = await prisma.extractedQuestionDraft.update({
    where: { id: draftId },
    data: { reviewStatus: "REJECTED", reviewedByUserId, reviewNote },
  });
  await maybeMarkJobImported(draft.importJobId);
  return draft;
}

async function maybeMarkJobImported(importJobId: string) {
  const remaining = await prisma.extractedQuestionDraft.count({
    where: { importJobId, reviewStatus: "PENDING_REVIEW" },
  });
  if (remaining === 0) {
    await prisma.importJob.update({ where: { id: importJobId }, data: { status: "IMPORTED" } });
  }
}
