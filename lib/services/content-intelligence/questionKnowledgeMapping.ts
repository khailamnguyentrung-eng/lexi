/**
 * Question Knowledge Mapping Service — M3.3
 *
 * Handles individual question ↔ KnowledgeUnit assignments.
 * This is the canonical location for all CRUD operations on
 * Question.knowledgeUnitId.
 *
 * Architecture: Prisma access only here.
 *   importer.ts → autoAssignKnowledgeUnit() → Question.knowledgeUnitId
 *   Admin routes → assign/remove/query functions here
 *
 * Matching strategy: deterministic topic string equality only.
 *   question.topic === knowledgeUnit.topic (both normalized snake_case)
 *   No fuzzy matching. No AI classification.
 */

import { prisma } from "@/lib/db/prisma";

// ─────────────────────────────────────────────────────────
// Pure helper — exported so it can be tested without a DB
// ─────────────────────────────────────────────────────────

/**
 * Deterministic topic-based KnowledgeUnit lookup.
 * Returns the matching unit's id, or null if no unit covers this topic.
 * Exact string equality only — canonicalization is the caller's responsibility.
 */
export function findMatchingKnowledgeUnitId(
  topic: string,
  units: { id: string; topic: string }[]
): string | null {
  return units.find((u) => u.topic === topic)?.id ?? null;
}

// ─────────────────────────────────────────────────────────
// Service functions — Prisma access
// ─────────────────────────────────────────────────────────

/**
 * Formally assign a question to a KnowledgeUnit via the FK.
 * Overwrites any existing assignment.
 */
export async function assignQuestionToKnowledgeUnit(
  questionId: string,
  knowledgeUnitId: string
): Promise<void> {
  await prisma.question.update({
    where: { id: questionId },
    data: { knowledgeUnitId },
  });
}

/**
 * Remove a question's KnowledgeUnit assignment, returning it to unmapped state.
 * Coverage computation continues to work via topic-string matching.
 */
export async function removeQuestionKnowledgeUnit(questionId: string): Promise<void> {
  await prisma.question.update({
    where: { id: questionId },
    data: { knowledgeUnitId: null },
  });
}

/**
 * Return all questions that have not been formally linked to a KnowledgeUnit.
 * Ordered by topic so the admin sees a grouped list.
 */
export async function getUnmappedQuestions() {
  return prisma.question.findMany({
    where: { knowledgeUnitId: null },
    select: {
      id: true,
      questionCode: true,
      topic: true,
      difficulty: true,
    },
    orderBy: { topic: "asc" },
  });
}

/**
 * Return all questions formally assigned to a specific KnowledgeUnit.
 * Ordered by difficulty so easy → medium → hard.
 */
export async function getQuestionsForKnowledgeUnit(knowledgeUnitId: string) {
  return prisma.question.findMany({
    where: { knowledgeUnitId },
    select: {
      id: true,
      questionCode: true,
      topic: true,
      difficulty: true,
    },
    orderBy: { difficulty: "asc" },
  });
}

// ─────────────────────────────────────────────────────────
// Import pipeline integration helper
// ─────────────────────────────────────────────────────────

/**
 * Try to assign a newly created Question to a KnowledgeUnit based on its topic.
 * Called by approveDraft() after Question creation — non-throwing by design.
 * Returns true if a matching KnowledgeUnit was found and assigned, false otherwise.
 *
 * Failure never blocks approval: if no KnowledgeUnit exists for this topic yet,
 * the question remains unmapped and coverage computation still works via topic
 * string matching.
 */
export async function autoAssignKnowledgeUnit(
  questionId: string,
  topic: string
): Promise<boolean> {
  const unit = await prisma.knowledgeUnit.findUnique({ where: { topic } });
  if (!unit) return false;
  await prisma.question.update({
    where: { id: questionId },
    data: { knowledgeUnitId: unit.id },
  });
  return true;
}
