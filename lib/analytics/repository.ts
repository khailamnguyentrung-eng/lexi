/**
 * Analytics data repository.
 *
 * Single responsibility: fetch data from the database in the shapes the
 * analytics engine needs. Contains no calculations, no confidence logic,
 * no narrative generation.
 *
 * Callers: API route handlers (thin) that pass results to the pure engine.
 * The engine (sessionAnalytics.ts) must never import this file.
 *
 * Data flow:
 *   Route Handler → repository.ts (DB queries) → sessionAnalytics.ts (pure math)
 */

import { prisma } from "@/lib/db/prisma";
import { ErrorStatus } from "@prisma/client";
import { canonicalTopic } from "./canonicalTopic";

// ──────────────────────────────────────────────────────────────────
// Return types
// ──────────────────────────────────────────────────────────────────

/**
 * A single attempt with only the question fields the engine needs.
 * Kept narrow so the engine's function signatures stay stable as schema evolves.
 */
export interface AttemptWithQuestion {
  id: string;
  userId: string;
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
  timeSpentSec: number | null;
  attemptedAt: Date;
  programCurriculumId: string | null;
  question: {
    id: string;
    questionCode: string;
    type: string | null;
    skill: string;
    topic: string;
    difficulty: string;
    promptText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    explanationVi: string;
    commonMistake: string | null;
  };
}

/**
 * Error notebook context for one topic.
 * Tells the engine how much historical error history exists for a topic.
 */
export interface NotebookContextRow {
  topic: string; // canonical form
  entryCount: number;
  totalOccurrences: number;
  isRemedialFlagged: boolean;
  mostRecentEntry: {
    reason: string;
    studentAnswer: string;
    correctAnswer: string;
    reviewStage: number;
    lastReviewedAt: Date | null;
  } | null;
}

// ──────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────

/**
 * Fetch all attempts submitted for a specific ProgramCurriculum slot.
 * Ordered by attemptedAt ASC so position-in-session is preserved for
 * section-drop analysis.
 *
 * Used to accept either a CurriculumSession or a ProgramCurriculum slot via
 * an AttemptScope union — CurriculumSession was retired, so this now only
 * ever serves Program (see docs/superpowers/plans/
 * 2026-07-28-retire-curriculumsession-phase1.md).
 */
export async function fetchSessionAttempts(
  userId: string,
  programCurriculumId: string
): Promise<AttemptWithQuestion[]> {
  const rows = await prisma.questionAttempt.findMany({
    where: { userId, programCurriculumId },
    orderBy: { attemptedAt: "asc" },
    select: {
      id: true,
      userId: true,
      questionId: true,
      selectedOption: true,
      isCorrect: true,
      timeSpentSec: true,
      attemptedAt: true,
      programCurriculumId: true,
      question: {
        select: {
          id: true,
          questionCode: true,
          type: true,
          skill: true,
          topic: true,
          difficulty: true,
          promptText: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctOption: true,
          explanationVi: true,
          commonMistake: true,
        },
      },
    },
  });

  return rows as AttemptWithQuestion[];
}

/**
 * Fetch error notebook context for a set of canonical topics.
 *
 * Excludes MASTERED entries (they are not current weaknesses).
 * Groups by canonical topic form so variant spellings collapse correctly.
 */
export async function fetchNotebookContext(
  userId: string,
  topics: string[]
): Promise<NotebookContextRow[]> {
  if (topics.length === 0) return [];

  // Fetch all non-mastered entries for this user.
  // We then filter in application code using canonicalTopic() because
  // the DB stores free-text `concept` strings that may have variant forms.
  // Prisma IN queries are exact-match only — they cannot call canonicalTopic().
  const allEntries = await prisma.errorNotebookEntry.findMany({
    where: {
      userId,
      status: { not: ErrorStatus.MASTERED },
    },
    select: {
      concept: true,
      occurrenceCount: true,
      isRemedialFlagged: true,
      reason: true,
      studentAnswer: true,
      correctAnswer: true,
      reviewStage: true,
      lastReviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Canonicalize the target topics set for fast lookup
  const canonicalTargets = new Set(topics.map((t) => canonicalTopic(t)));

  // Group entries by canonical topic, keeping only those in the target set
  const grouped = new Map<
    string,
    {
      entries: typeof allEntries;
      totalOccurrences: number;
      isRemedialFlagged: boolean;
    }
  >();

  for (const entry of allEntries) {
    const canonical = canonicalTopic(entry.concept);
    if (!canonicalTargets.has(canonical)) continue;

    const existing = grouped.get(canonical);
    if (existing) {
      existing.entries.push(entry);
      existing.totalOccurrences += entry.occurrenceCount;
      if (entry.isRemedialFlagged) existing.isRemedialFlagged = true;
    } else {
      grouped.set(canonical, {
        entries: [entry],
        totalOccurrences: entry.occurrenceCount,
        isRemedialFlagged: entry.isRemedialFlagged,
      });
    }
  }

  // Build result rows — most recent entry is already first (orderBy desc)
  return Array.from(grouped.entries()).map(([topic, { entries, totalOccurrences, isRemedialFlagged }]) => {
    const newest = entries[0] ?? null;
    return {
      topic,
      entryCount: entries.length,
      totalOccurrences,
      isRemedialFlagged,
      mostRecentEntry: newest
        ? {
            reason: newest.reason,
            studentAnswer: newest.studentAnswer,
            correctAnswer: newest.correctAnswer,
            reviewStage: newest.reviewStage,
            lastReviewedAt: newest.lastReviewedAt,
          }
        : null,
    };
  });
}

/**
 * Find the most recently completed ProgramCurriculum slot for this user —
 * used by studentLearningProfile.ts and practiceRecommendation.ts to feed
 * getSessionAnalytics() for readiness/weakness-topic signals.
 *
 * Previously compared CurriculumSession and ProgramCurriculum completions
 * against each other (whichever was more recent); CurriculumSession was
 * retired, so this now only reads UserProgramProgress (see
 * docs/superpowers/plans/2026-07-28-retire-curriculumsession-phase1.md).
 */
export interface MostRecentCompletedScope {
  programCurriculumId: string;
  label: number; // Program slot order — the display label getSessionAnalytics expects
}

export async function findMostRecentlyCompletedScope(userId: string): Promise<MostRecentCompletedScope | null> {
  const recent = await prisma.userProgramProgress.findFirst({
    where: { userId, status: "COMPLETED", completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: {
      programCurriculumId: true,
      programCurriculum: { select: { order: true } },
    },
  });

  if (!recent) return null;

  return {
    programCurriculumId: recent.programCurriculumId,
    label: recent.programCurriculum.order,
  };
}
