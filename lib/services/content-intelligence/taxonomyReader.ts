/**
 * KU-1 part B, Path A — the source → taxonomy reader (design doc §7, ruled
 * B-1(b): read the source's own text and propose from it directly; no
 * chunking, no separate structure-summary step, since the documents this
 * repo actually has are import-pipeline-sized, not book-length. Escalate to
 * a chunked/summary-first approach only when a real source proves too large
 * for one AI call — not built speculatively).
 *
 * Orchestrates, does not compute: extraction is fileExtractor's job (Step 1
 * of the existing import pipeline, reused as-is), taxonomy proposal is the
 * AI provider's job (lib/ai/providers/taxonomyCore.ts), persistence dedup is
 * recordPendingKnowledgeUnitProposal's job (shared with Path B). This file
 * wires those together and manages SourceRead/TaxonomyJob's lifecycle.
 */

import { prisma } from "@/lib/db/prisma";
import { fileExtractor } from "@/lib/services/content-import/extractor";
import { getAIProvider } from "@/lib/ai/providers";
import { recordPendingKnowledgeUnitProposal } from "./pendingKnowledgeUnitProposal";

/**
 * Get this source's cached extraction, or run it once and cache it —
 * the "extract once, fan out" design (docs/KU1_PARTB_DESIGN.md §1.5).
 * A source already READ (by an earlier Path A run) returns the cached
 * SourceRead untouched, so re-running taxonomy proposal on the same source
 * never re-pays extraction cost.
 */
export async function getOrCreateSourceRead(contentSourceId: string) {
  const existing = await prisma.sourceRead.findFirst({
    where: { contentSourceId, status: "READ" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const contentSource = await prisma.contentSource.findUniqueOrThrow({ where: { id: contentSourceId } });

  try {
    const { rawText } = await fileExtractor.extract(contentSource);
    return prisma.sourceRead.create({
      data: { contentSourceId, status: "READ", rawExtractedText: rawText },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return prisma.sourceRead.create({
      data: { contentSourceId, status: "FAILED", errorMessage },
    });
  }
}

export interface TaxonomyJobSummary {
  taxonomyJobId: string;
  sourceReadId: string;
  proposalsCreated: number;
  duplicatesSkipped: number; // matched an existing PENDING_REVIEW proposal
  alreadyInRegistry: number; // the model proposed a topic that already has a KnowledgeUnit
  rejectedByVerification: number; // evidenceQuote didn't check out — see taxonomyCore.ts
  servedBy: "claude" | "gemini" | "ollama" | "mock";
  fallbackReason: string | null;
  retryCount: number;
}

/**
 * Run Path A end-to-end for one source: get/create its SourceRead, ask the
 * AI provider to propose KnowledgeUnits, and persist proposals through the
 * same dedup path Path B uses. Never creates a KnowledgeUnit or a Question —
 * only PendingKnowledgeUnit rows, which still need a human decision via
 * pendingKnowledgeUnitReview.ts.
 *
 * Throws if extraction itself failed (SourceRead.status === "FAILED") —
 * there is nothing to propose from, unlike a merely-empty AI response, which
 * is a legitimate ("no clear topics here") zero-proposal result.
 */
export async function runTaxonomyJob(contentSourceId: string): Promise<TaxonomyJobSummary> {
  const sourceRead = await getOrCreateSourceRead(contentSourceId);
  if (sourceRead.status === "FAILED" || !sourceRead.rawExtractedText) {
    throw new Error(
      `SourceRead ${sourceRead.id} has no extracted text (status=${sourceRead.status}, error=${sourceRead.errorMessage ?? "none"})`
    );
  }

  const taxonomyJob = await prisma.taxonomyJob.create({
    data: { sourceReadId: sourceRead.id, status: "PROPOSING" },
  });

  try {
    const existingUnits = await prisma.knowledgeUnit.findMany({ select: { topic: true } });
    const existingTopics = existingUnits.map((u) => u.topic);
    const existingTopicSet = new Set(existingTopics);

    const provider = getAIProvider();
    const result = await provider.proposeTaxonomy({
      rawText: sourceRead.rawExtractedText,
      existingTopics,
    });

    let proposalsCreated = 0;
    let duplicatesSkipped = 0;
    let alreadyInRegistry = 0;

    for (const proposal of result.proposals) {
      // Defensive: the prompt tells the model not to re-propose existing
      // topics, but instructions aren't guarantees. Skipping here (rather
      // than creating and letting a reviewer hit TopicAlreadyExistsError on
      // approve) keeps the queue free of proposals that can never resolve
      // to anything but "reject, this already exists".
      if (existingTopicSet.has(proposal.proposedTopic)) {
        alreadyInRegistry++;
        continue;
      }
      const created = await recordPendingKnowledgeUnitProposal({
        contentSourceId,
        taxonomyJobId: taxonomyJob.id,
        proposedTopic: proposal.proposedTopic,
        proposedLabel: proposal.proposedLabel,
        evidenceQuote: proposal.evidenceQuote,
        evidenceLocation: proposal.evidenceLocation,
        aiConfidence: proposal.confidence,
      });
      if (created) proposalsCreated++;
      else duplicatesSkipped++;
    }

    await prisma.taxonomyJob.update({ where: { id: taxonomyJob.id }, data: { status: "PROPOSED" } });

    return {
      taxonomyJobId: taxonomyJob.id,
      sourceReadId: sourceRead.id,
      proposalsCreated,
      duplicatesSkipped,
      alreadyInRegistry,
      rejectedByVerification: result.rejectedByVerification,
      servedBy: result.servedBy,
      fallbackReason: result.fallbackReason,
      retryCount: result.retryCount,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.taxonomyJob.update({
      where: { id: taxonomyJob.id },
      data: { status: "FAILED", errorMessage },
    });
    throw err;
  }
}
