// Orchestrates normalization of a large document (e.g. the 118-question
// Bo_de_test_Tieng_Anh_9.docx) by chunking it into independently-sized AI
// calls instead of one call covering the whole thing. Read-only with
// respect to the database — chunkBySections() is pure text processing,
// normalizeWithAI() validates against the DB but writes nothing. Callers
// decide what to do with the result: the dry-run admin action just
// displays it; persisting drafts for real would reuse
// importer.ts's normalizeAndPersistDrafts() per chunk (not done here).
//
// Token-limit awareness: each chunk from chunkBySections() for the real
// 118-question source is ~6-9K characters (roughly 2-3K tokens) — well
// within a single Claude/Gemini call. `oversizedChunkWarning` flags any
// chunk over a soft threshold so this assumption doesn't go unnoticed if a
// much larger document is ever imported; this implementation does not
// split an individual chunk further (that would require sub-splitting
// mid-exam-part, which risks separating a question from its answer key).
import type { ContentSource } from "@prisma/client";
import { chunkBySections } from "./chunker";
import { normalizeWithAI } from "./ai-normalizer";
import type { ValidatedDraft } from "./validator";
import { getAIProviderStatus } from "@/lib/ai/providers";
import type { AIRunReport } from "./runReport";

const SOFT_CHUNK_SIZE_WARNING_CHARS = 40_000; // ~10K tokens, rough rule of thumb

export interface BatchResult {
  batchIndex: number;
  label: string;
  rawTextLength: number;
  drafts: ValidatedDraft[];
  error: string | null; // set if this batch's AI call/parsing failed entirely
  oversizedChunkWarning: boolean;
  retryCount: number;
  processingTimeMs: number;
}

export interface LargeDocumentResult {
  batches: BatchResult[];
  totalDrafts: number;
  validCount: number;
  invalidCount: number;
  failedBatchCount: number;
  duplicateQuestionCodesAcrossBatches: string[];
  report: AIRunReport;
}

export async function normalizeLargeDocument(
  rawText: string,
  contentSource: ContentSource,
): Promise<LargeDocumentResult> {
  const { name, model, requestedProvider, isFallback, fallbackReason } = getAIProviderStatus();
  const overallStart = Date.now();
  const chunks = chunkBySections(rawText);
  const batches: BatchResult[] = [];

  for (const chunk of chunks) {
    const oversizedChunkWarning = chunk.rawText.length > SOFT_CHUNK_SIZE_WARNING_CHARS;
    const batchStart = Date.now();
    try {
      const { results, retryCount } = await normalizeWithAI(chunk.rawText, contentSource);
      batches.push({
        batchIndex: chunk.batchIndex,
        label: chunk.label,
        rawTextLength: chunk.rawText.length,
        drafts: results,
        error: null,
        oversizedChunkWarning,
        retryCount,
        processingTimeMs: Date.now() - batchStart,
      });
    } catch (err) {
      // Partial failure: one batch failing (e.g. the model returned
      // unparseable JSON even after the one retry) does not abort the
      // other batches — each exam part is independent.
      batches.push({
        batchIndex: chunk.batchIndex,
        label: chunk.label,
        rawTextLength: chunk.rawText.length,
        drafts: [],
        error: err instanceof Error ? err.message : String(err),
        oversizedChunkWarning,
        retryCount: 0,
        processingTimeMs: Date.now() - batchStart,
      });
    }
  }

  const allDrafts = batches.flatMap((b) => b.drafts);
  const validCount = allDrafts.filter((d) => d.isValid).length;

  // validator.ts's duplicate check only sees one batch at a time (plus the
  // DB), so a questionCode accidentally reused across two different
  // batches (e.g. Part 2 and Part 3) wouldn't be caught there. Check
  // across the merged set here.
  const codeCounts = new Map<string, number>();
  for (const { draft } of allDrafts) {
    codeCounts.set(draft.questionCode, (codeCounts.get(draft.questionCode) ?? 0) + 1);
  }
  const duplicateQuestionCodesAcrossBatches = [...codeCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => code);

  const totalRetryCount = batches.reduce((sum, b) => sum + b.retryCount, 0);

  return {
    batches,
    totalDrafts: allDrafts.length,
    validCount,
    invalidCount: allDrafts.length - validCount,
    failedBatchCount: batches.filter((b) => b.error !== null).length,
    duplicateQuestionCodesAcrossBatches,
    report: {
      aiStatus: { name, model, requestedProvider, isFallback, fallbackReason },
      chunksProcessed: chunks.length,
      inputSizeChars: rawText.length,
      outputQuestionCount: allDrafts.length,
      validCount,
      invalidCount: allDrafts.length - validCount,
      retryCount: totalRetryCount,
      processingTimeMs: Date.now() - overallStart,
    },
  };
}
