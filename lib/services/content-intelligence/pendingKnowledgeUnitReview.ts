/**
 * PendingKnowledgeUnit review queue — KU-1 part B, build order step 3
 * (docs/KU1_PARTB_DESIGN.md §5, §8).
 *
 * The four reviewer actions the design doc names: Approve, Merge, Rename,
 * Reject. Rename is implemented as Approve with an override, not a separate
 * function — the design doc's own description ("edit topic/label, then
 * approve") describes one reviewer action with two steps, not two
 * independent operations. reviewStatus records which happened (APPROVED vs
 * RENAMED) so the audit trail still distinguishes them.
 *
 * Architecture: Prisma access only here, matching questionKnowledgeMapping.ts's
 * existing convention for this layer.
 *
 * ── The coverage-report caveat (read before changing MERGE or RENAME) ──
 * `computeCoverageReport()` (knowledgeCoverage.ts) counts questions by
 * `q.topic === unit.topic` — a decision recorded in DECISION_LOG ("M3.2 —
 * Coverage engine uses topic string matching, not FK"), made before this
 * review queue existed. APPROVE keeps that invariant intact: the created
 * KnowledgeUnit.topic is exactly the proposal's proposedTopic, which is
 * exactly the string already sitting on the matching Question rows, so
 * string-matching coverage and the knowledgeUnitId backfill agree.
 *
 * MERGE and RENAME-with-an-override BREAK that agreement on purpose, because
 * that is what they are for: MERGE says "these are actually one concept",
 * which is by definition a claim string equality does not capture. After a
 * merge, the affected questions are linked via `knowledgeUnitId` — correctly,
 * per V1_V2_RECONCILIATION.md's ruling that the FK becomes the primary link
 * — but `computeCoverageReport()` will still undercount them, because it does
 * not consult the FK. This is a real, known limitation, not an oversight:
 * fixing it means changing what M3.2 decided, for a different module, and is
 * out of scope here. Flagged in docs/KU1_PARTB_DESIGN.md and DECISION_LOG.
 */

import { prisma } from "@/lib/db/prisma";
import type { PendingKUStatus } from "@prisma/client";

export class TopicAlreadyExistsError extends Error {
  constructor(public readonly topic: string, public readonly existingKnowledgeUnitId: string) {
    super(
      `A KnowledgeUnit for topic "${topic}" already exists (id=${existingKnowledgeUnitId}). ` +
        `Use mergePendingKnowledgeUnit() to fold this proposal into it instead of approving it as new.`
    );
    this.name = "TopicAlreadyExistsError";
  }
}

/**
 * All proposals awaiting a decision, oldest first (so a reviewer works
 * through the backlog in the order it was surfaced). Includes provenance
 * (source filename) since a reviewer judging "is this real" needs to know
 * what document caused it.
 */
export async function listPendingKnowledgeUnits() {
  return prisma.pendingKnowledgeUnit.findMany({
    where: { reviewStatus: "PENDING_REVIEW" },
    include: { contentSource: { select: { fileName: true, sourceLabel: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Link every unlinked Question sharing this exact topic string to a
 * KnowledgeUnit. Shared by approve() (topic unchanged — always safe) and
 * merge() (topic unchanged — always safe). NOT used for a renamed topic,
 * since after a rename the KU's topic no longer equals the Question rows'
 * topic string; see the file header.
 */
async function linkQuestionsByExactTopic(topic: string, knowledgeUnitId: string): Promise<number> {
  const { count } = await prisma.question.updateMany({
    where: { topic, knowledgeUnitId: null },
    data: { knowledgeUnitId },
  });
  return count;
}

export interface ResolveResult {
  proposal: { id: string; reviewStatus: PendingKUStatus };
  knowledgeUnitId: string;
  questionsLinked: number;
}

/**
 * Approve a proposal — creates a new KnowledgeUnit and links every question
 * already sitting on that exact topic (closing exactly the gap
 * autoAssignKnowledgeUnit()'s miss-handling recorded in the first place).
 *
 * `override` implements Rename: reviewer-supplied topic/label replace the
 * proposal's own (typically AI- or naive-generated) values. When an override
 * changes the topic, question-linking is intentionally skipped — the created
 * KnowledgeUnit's topic no longer matches the existing Question.topic string,
 * so there is nothing to safely auto-link; a human assigning those questions
 * individually (existing M3.3 admin tools) is correct here, not a bulk
 * string match that would create silently-wrong groupings.
 *
 * Throws TopicAlreadyExistsError if a KnowledgeUnit for the resolved topic
 * already exists (e.g. two sources independently proposed the same topic and
 * the other was approved first) — deliberately not a silent auto-merge, so a
 * human decides rather than the system reinterpreting an Approve click as a
 * Merge. The error carries the existing unit's id so the caller can offer
 * "merge into it instead" without a second lookup.
 */
export async function approvePendingKnowledgeUnit(
  id: string,
  reviewedByUserId: string,
  override?: { topic?: string; label?: string }
): Promise<ResolveResult> {
  const proposal = await prisma.pendingKnowledgeUnit.findUniqueOrThrow({ where: { id } });
  if (proposal.reviewStatus !== "PENDING_REVIEW") {
    throw new Error(`Proposal ${id} is already resolved (${proposal.reviewStatus})`);
  }

  const finalTopic = override?.topic ?? proposal.proposedTopic;
  const finalLabel = override?.label ?? proposal.proposedLabel;
  const wasRenamed = finalTopic !== proposal.proposedTopic || finalLabel !== proposal.proposedLabel;

  const existing = await prisma.knowledgeUnit.findUnique({ where: { topic: finalTopic } });
  if (existing) throw new TopicAlreadyExistsError(finalTopic, existing.id);

  const unit = await prisma.knowledgeUnit.create({
    data: { topic: finalTopic, label: finalLabel },
  });

  // Only safe when the topic was not overridden — see the docstring.
  const questionsLinked =
    finalTopic === proposal.proposedTopic
      ? await linkQuestionsByExactTopic(proposal.proposedTopic, unit.id)
      : 0;

  const updated = await prisma.pendingKnowledgeUnit.update({
    where: { id },
    data: {
      reviewStatus: wasRenamed ? "RENAMED" : "APPROVED",
      reviewedByUserId,
      resolvedUnitId: unit.id,
    },
  });

  return { proposal: updated, knowledgeUnitId: unit.id, questionsLinked };
}

/**
 * Merge a proposal into an existing KnowledgeUnit — no new unit is created.
 * Links matching questions via the FK; does NOT touch the string-based
 * coverage report. See the file header's caveat.
 */
export async function mergePendingKnowledgeUnit(
  id: string,
  targetKnowledgeUnitId: string,
  reviewedByUserId: string,
  reviewNote?: string
): Promise<ResolveResult> {
  const proposal = await prisma.pendingKnowledgeUnit.findUniqueOrThrow({ where: { id } });
  if (proposal.reviewStatus !== "PENDING_REVIEW") {
    throw new Error(`Proposal ${id} is already resolved (${proposal.reviewStatus})`);
  }

  // findUniqueOrThrow rather than trusting the caller's id blindly — a
  // dangling/typo'd target must fail loudly, not silently null out resolvedUnitId.
  const target = await prisma.knowledgeUnit.findUniqueOrThrow({ where: { id: targetKnowledgeUnitId } });

  const questionsLinked = await linkQuestionsByExactTopic(proposal.proposedTopic, target.id);

  const updated = await prisma.pendingKnowledgeUnit.update({
    where: { id },
    data: {
      reviewStatus: "MERGED",
      reviewedByUserId,
      resolvedUnitId: target.id,
      reviewNote,
    },
  });

  return { proposal: updated, knowledgeUnitId: target.id, questionsLinked };
}

/**
 * Reject a proposal — not a real KnowledgeUnit (e.g. AI proposed a
 * non-concept like "test instructions"). Does not block the same topic being
 * proposed again later: autoAssignKnowledgeUnit()'s dedup only checks
 * PENDING_REVIEW (DECISION_LOG "KU-1 part B — miss-handling records a
 * proposal instead of discarding the topic").
 */
export async function rejectPendingKnowledgeUnit(
  id: string,
  reviewedByUserId: string,
  reviewNote?: string
) {
  const proposal = await prisma.pendingKnowledgeUnit.findUniqueOrThrow({ where: { id } });
  if (proposal.reviewStatus !== "PENDING_REVIEW") {
    throw new Error(`Proposal ${id} is already resolved (${proposal.reviewStatus})`);
  }
  return prisma.pendingKnowledgeUnit.update({
    where: { id },
    data: { reviewStatus: "REJECTED", reviewedByUserId, reviewNote },
  });
}
