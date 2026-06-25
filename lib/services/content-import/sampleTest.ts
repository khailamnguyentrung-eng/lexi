// Controlled, small-scale test action for the content-import admin page:
// run the full extract -> AI-normalize -> validate -> save-as-draft
// pipeline against only the first N questions of a source's raw text,
// instead of the whole document. Lets an admin sanity-check normalization
// quality (especially a real provider's output, once a key is configured)
// before running — and reviewing — a full 100+ question batch.
//
// Like the full pipeline, this NEVER creates a Question row. Results land
// as ExtractedQuestionDraft rows through the exact same review/approve
// gate (a human still has to click Duyệt on /admin/content-import).
import { prisma } from "@/lib/db/prisma";
import { fileExtractor } from "./extractor";
import { normalizeAndPersistDrafts } from "./importer";
import { getAIProviderStatus } from "@/lib/ai/providers";
import type { AIRunReport } from "./runReport";

// Heuristic slice: cuts the raw text right before the (n+1)-th line that
// looks like a question number ("12. ..."). Verified against the real
// 118-question source (Bo_de_test_Tieng_Anh_9.docx), where both the
// question section and the later answer-key section use this numbering —
// slicing on the first occurrence keeps just the question section, which
// is the realistic input an admin would actually want to test (can the AI
// derive the answer/explanation from the question text alone, without
// peeking at the answer key further down the document).
export function sliceToFirstNQuestions(rawText: string, n: number): string {
  const lines = rawText.split("\n");
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\d{1,2}\.\s/.test(lines[i])) {
      count++;
      if (count === n + 1) {
        return lines.slice(0, i).join("\n");
      }
    }
  }
  return rawText; // fewer than n+1 question-like lines found — return everything
}

export async function runSampleNormalization(contentSourceId: string, sampleSize = 5) {
  const contentSource = await prisma.contentSource.findUniqueOrThrow({ where: { id: contentSourceId } });
  const { name, model, requestedProvider, isFallback, fallbackReason } = getAIProviderStatus();

  const job = await prisma.importJob.create({ data: { contentSourceId, status: "EXTRACTING" } });
  const startedAt = Date.now();

  try {
    const { rawText: fullText } = await fileExtractor.extract(contentSource);
    const sampleText = sliceToFirstNQuestions(fullText, sampleSize);

    const { validCount, invalidCount, retryCount } = await normalizeAndPersistDrafts(
      job.id,
      sampleText,
      contentSource,
    );

    const finalJob = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id }, include: { drafts: true } });

    const report: AIRunReport = {
      aiStatus: { name, model, requestedProvider, isFallback, fallbackReason },
      chunksProcessed: 1,
      inputSizeChars: sampleText.length,
      outputQuestionCount: validCount + invalidCount,
      validCount,
      invalidCount,
      retryCount,
      processingTimeMs: Date.now() - startedAt,
    };

    return { job: finalJob, report };
  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}
