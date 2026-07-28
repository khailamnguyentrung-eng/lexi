/**
 * Shared proposal-recording logic for KU-1 part B, used by BOTH paths:
 *   Path B (questionKnowledgeMapping.ts's autoAssignKnowledgeUnit — a miss
 *     during ordinary question import) and
 *   Path A (taxonomyReader.ts — a dedicated source→taxonomy AI read).
 *
 * Factored out rather than duplicated in each caller so the dedup rule can't
 * quietly diverge between the two paths — it did not exist as a separate
 * module until Path A needed the exact same rule Path B already had.
 */

import { prisma } from "@/lib/db/prisma";

export interface ProposalInput {
  contentSourceId: string;
  taxonomyJobId?: string; // set by Path A; omitted (null) by Path B — see PendingKnowledgeUnit's schema comment
  proposedTopic: string;
  proposedLabel: string;
  evidenceQuote: string;
  evidenceLocation?: string | null;
  aiConfidence?: number | null;
}

/**
 * Record a proposal unless one is already PENDING_REVIEW for the same
 * (contentSourceId, proposedTopic) pair — the dedup rule recorded in
 * DECISION_LOG ("KU-1 part B — miss-handling records a proposal instead of
 * discarding the topic"). Scoped to PENDING_REVIEW only, so a REJECTED
 * proposal never permanently blocks the same topic being proposed again by
 * a later import or a later Path A run.
 *
 * Returns whether a new row was created, so callers can report counts
 * (e.g. "N proposals created, M were duplicates of an existing one").
 */
export async function recordPendingKnowledgeUnitProposal(input: ProposalInput): Promise<boolean> {
  const existing = await prisma.pendingKnowledgeUnit.findFirst({
    where: {
      contentSourceId: input.contentSourceId,
      proposedTopic: input.proposedTopic,
      reviewStatus: "PENDING_REVIEW",
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.pendingKnowledgeUnit.create({
    data: {
      contentSourceId: input.contentSourceId,
      taxonomyJobId: input.taxonomyJobId,
      proposedTopic: input.proposedTopic,
      proposedLabel: input.proposedLabel,
      evidenceQuote: input.evidenceQuote,
      evidenceLocation: input.evidenceLocation,
      aiConfidence: input.aiConfidence,
    },
  });
  return true;
}
