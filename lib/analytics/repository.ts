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
  curriculumSessionId: string | null;
  programCurriculumId: string | null;
  question: {
    id: string;
    questionCode: string;
    type: string;
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
 * Which spine an attempt-fetch is scoped to. CurriculumSession is the
 * original linear-curriculum spine; ProgramCurriculum is the v2 generic
 * spine (see docs/DECISION_LOG.md "Program v2 — QuestionAttempt gains
 * programCurriculumId"). Both spines run in parallel on purpose — this
 * type lets the same fetch/analytics functions serve either one without
 * duplicating the query or the pure engine logic.
 */
export type AttemptScope =
  | { curriculumSessionId: string }
  | { programCurriculumId: string };

/**
 * Fetch all attempts submitted in a specific session — either a
 * CurriculumSession (legacy spine) or a ProgramCurriculum slot (v2 spine),
 * chosen by which key is present on `scope`. Ordered by attemptedAt ASC so
 * position-in-session is preserved for section-drop analysis.
 */
export async function fetchSessionAttempts(
  userId: string,
  scope: AttemptScope
): Promise<AttemptWithQuestion[]> {
  const where =
    "curriculumSessionId" in scope
      ? { userId, curriculumSessionId: scope.curriculumSessionId }
      : { userId, programCurriculumId: scope.programCurriculumId };

  const rows = await prisma.questionAttempt.findMany({
    where,
    orderBy: { attemptedAt: "asc" },
    select: {
      id: true,
      userId: true,
      questionId: true,
      selectedOption: true,
      isCorrect: true,
      timeSpentSec: true,
      attemptedAt: true,
      curriculumSessionId: true,
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
 * Find whichever spine's most recently completed unit (CurriculumSession or
 * ProgramCurriculum slot) is truly the most recent by completedAt — used by
 * studentLearningProfile.ts and practiceRecommendation.ts to feed
 * getSessionAnalytics() for readiness/weakness-topic signals.
 *
 * Fixes a latent bug in the code this replaces: both call sites previously
 * ordered by `curriculumSession.sessionNumber desc`, not `completedAt desc`
 * — wrong whenever a session is completed out of numeric order (e.g. a
 * review/checkpoint session redone later). Ordering by completedAt is what
 * "most recently completed" should have always meant.
 *
 * Does NOT touch getCurrentMission()/mission-derived fields — those stay
 * CurriculumSession-only, deliberately (see docs/superpowers/plans/
 * 2026-07-26-repoint-behavior-and-readiness.md's Global Constraints).
 */
export interface MostRecentCompletedScope {
  scope: AttemptScope;
  label: number; // sessionNumber or Program slot order — the display label getSessionAnalytics expects
}

export async function findMostRecentlyCompletedScope(userId: string): Promise<MostRecentCompletedScope | null> {
  const [recentCurriculum, recentProgram] = await Promise.all([
    prisma.userSessionProgress.findFirst({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        curriculumSessionId: true,
        curriculumSession: { select: { sessionNumber: true } },
      },
    }),
    prisma.userProgramProgress.findFirst({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        programCurriculumId: true,
        programCurriculum: { select: { order: true } },
      },
    }),
  ]);

  const curriculumTime = recentCurriculum?.completedAt?.getTime() ?? -Infinity;
  const programTime = recentProgram?.completedAt?.getTime() ?? -Infinity;

  if (curriculumTime === -Infinity && programTime === -Infinity) return null;

  if (programTime > curriculumTime) {
    return {
      scope: { programCurriculumId: recentProgram!.programCurriculumId },
      label: recentProgram!.programCurriculum.order,
    };
  }
  return {
    scope: { curriculumSessionId: recentCurriculum!.curriculumSessionId },
    label: recentCurriculum!.curriculumSession.sessionNumber,
  };
}
