import { prisma } from "@/lib/db/prisma";
import { canonicalTopic } from "./canonicalTopic";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

/**
 * How well a student retained a topic after reviewing their notebook entries.
 *
 * IMPROVED   — post-review accuracy ≥ 0.80 AND improved ≥ 10 percentage points
 * IMPROVING  — post-review accuracy > pre-review (below IMPROVED threshold)
 * RECURRING  — no accuracy gain after review (still struggling)
 * NO_DATA    — no practice attempts recorded after the review date
 */
export type ImprovementSignal = "IMPROVED" | "IMPROVING" | "RECURRING" | "NO_DATA";

export interface TopicNotebookSummary {
  topic: string;
  label: string;
  entryCount: number;
  totalOccurrences: number;
  isRemedialFlagged: boolean;
  maxReviewStage: number;
  lastReviewedAt: Date | null;
  dueCount: number;
  masteredCount: number;
  improvementSignal: ImprovementSignal;
  preReviewAccuracy: number | null;
  postReviewAccuracy: number | null;
}

interface AttemptPoint {
  isCorrect: boolean;
  attemptedAt: Date;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function labelFromTopic(topic: string): string {
  return topic
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function topicPriority(s: TopicNotebookSummary): number {
  let score = 0;
  if (s.improvementSignal === "RECURRING") score += 40;
  if (s.improvementSignal === "IMPROVING") score += 10;
  if (s.isRemedialFlagged) score += 20;
  if (s.dueCount > 0) score += 15;
  score += Math.min(s.totalOccurrences, 10);
  return score;
}

// ──────────────────────────────────────────────────────────────────
// Pure functions (no DB access)
// ──────────────────────────────────────────────────────────────────

/**
 * Compute improvement signal from practice attempts and a review date.
 *
 * Thresholds:
 *   IMPROVED:  postAcc ≥ 0.80 AND (postAcc − preAcc) ≥ 0.10
 *   IMPROVING: postAcc > preAcc (below IMPROVED threshold)
 *   RECURRING: postAcc ≤ preAcc (no gain after review)
 *   NO_DATA:   zero attempts after lastReviewedAt
 *
 * When there are no pre-review attempts, preAcc is treated as 0.
 */
export function computeImprovementSignal(
  attempts: AttemptPoint[],
  lastReviewedAt: Date,
): ImprovementSignal {
  const pre = attempts.filter((a) => a.attemptedAt < lastReviewedAt);
  const post = attempts.filter((a) => a.attemptedAt > lastReviewedAt);

  if (post.length === 0) return "NO_DATA";

  const preAcc = pre.length > 0 ? pre.filter((a) => a.isCorrect).length / pre.length : 0;
  const postAcc = post.filter((a) => a.isCorrect).length / post.length;

  if (postAcc >= 0.8 && postAcc - preAcc >= 0.1) return "IMPROVED";
  if (postAcc > preAcc) return "IMPROVING";
  return "RECURRING";
}

// ──────────────────────────────────────────────────────────────────
// Repository / service functions (DB reads only, no writes)
// ──────────────────────────────────────────────────────────────────

/**
 * Compute per-topic notebook summaries with improvement signals.
 *
 * Data flow:
 *   ErrorNotebookEntry (grouped by canonicalTopic)
 *   + QuestionAttempt (matched by canonicalTopic(question.topic))
 *   → TopicNotebookSummary[] sorted by priority
 *
 * Topics where all entries are MASTERED are excluded.
 * Priority order: RECURRING > isRemedialFlagged > due today > occurrence count.
 */
export async function getTopicNotebookSummaries(
  userId: string,
): Promise<TopicNotebookSummary[]> {
  const now = new Date();

  const [entries, allAttempts] = await Promise.all([
    prisma.errorNotebookEntry.findMany({
      where: { userId },
      select: {
        concept: true,
        occurrenceCount: true,
        isRemedialFlagged: true,
        reviewStage: true,
        lastReviewedAt: true,
        nextReviewAt: true,
        status: true,
      },
    }),
    prisma.questionAttempt.findMany({
      where: { userId },
      select: {
        isCorrect: true,
        attemptedAt: true,
        question: { select: { topic: true } },
      },
    }),
  ]);

  // Group entries by canonical topic
  type TopicAccum = {
    label: string;
    entryCount: number;
    totalOccurrences: number;
    isRemedialFlagged: boolean;
    maxReviewStage: number;
    lastReviewedAt: Date | null;
    dueCount: number;
    masteredCount: number;
  };
  const topicMap = new Map<string, TopicAccum>();

  for (const entry of entries) {
    const canonical = canonicalTopic(entry.concept);
    const isDue =
      entry.status !== "MASTERED" &&
      entry.nextReviewAt !== null &&
      entry.nextReviewAt <= now;

    const existing = topicMap.get(canonical);
    if (existing) {
      existing.entryCount += 1;
      existing.totalOccurrences += entry.occurrenceCount;
      existing.isRemedialFlagged = existing.isRemedialFlagged || entry.isRemedialFlagged;
      existing.maxReviewStage = Math.max(existing.maxReviewStage, entry.reviewStage);
      if (
        entry.lastReviewedAt &&
        (!existing.lastReviewedAt || entry.lastReviewedAt > existing.lastReviewedAt)
      ) {
        existing.lastReviewedAt = entry.lastReviewedAt;
      }
      if (isDue) existing.dueCount += 1;
      if (entry.status === "MASTERED") existing.masteredCount += 1;
    } else {
      topicMap.set(canonical, {
        label: labelFromTopic(canonical),
        entryCount: 1,
        totalOccurrences: entry.occurrenceCount,
        isRemedialFlagged: entry.isRemedialFlagged,
        maxReviewStage: entry.reviewStage,
        lastReviewedAt: entry.lastReviewedAt,
        dueCount: isDue ? 1 : 0,
        masteredCount: entry.status === "MASTERED" ? 1 : 0,
      });
    }
  }

  // Group attempts by canonical topic
  const attemptsByTopic = new Map<string, AttemptPoint[]>();
  for (const attempt of allAttempts) {
    const topicRaw = attempt.question.topic;
    const canonical = canonicalTopic(topicRaw);
    const point: AttemptPoint = {
      isCorrect: attempt.isCorrect,
      attemptedAt: new Date(attempt.attemptedAt),
    };
    const list = attemptsByTopic.get(canonical);
    if (list) {
      list.push(point);
    } else {
      attemptsByTopic.set(canonical, [point]);
    }
  }

  // Build summaries — exclude topics where ALL entries are MASTERED
  const summaries: TopicNotebookSummary[] = [];

  for (const [topic, data] of topicMap.entries()) {
    if (data.masteredCount === data.entryCount) continue;

    const attempts = attemptsByTopic.get(topic) ?? [];
    let improvementSignal: ImprovementSignal = "NO_DATA";
    let preReviewAccuracy: number | null = null;
    let postReviewAccuracy: number | null = null;

    if (data.lastReviewedAt !== null) {
      const reviewDate = data.lastReviewedAt;
      improvementSignal = computeImprovementSignal(attempts, reviewDate);
      if (improvementSignal !== "NO_DATA") {
        const pre = attempts.filter((a) => a.attemptedAt < reviewDate);
        const post = attempts.filter((a) => a.attemptedAt > reviewDate);
        preReviewAccuracy =
          pre.length > 0 ? pre.filter((a) => a.isCorrect).length / pre.length : 0;
        postReviewAccuracy = post.filter((a) => a.isCorrect).length / post.length;
      }
    }

    summaries.push({
      topic,
      label: data.label,
      entryCount: data.entryCount,
      totalOccurrences: data.totalOccurrences,
      isRemedialFlagged: data.isRemedialFlagged,
      maxReviewStage: data.maxReviewStage,
      lastReviewedAt: data.lastReviewedAt,
      dueCount: data.dueCount,
      masteredCount: data.masteredCount,
      improvementSignal,
      preReviewAccuracy,
      postReviewAccuracy,
    });
  }

  summaries.sort((a, b) => topicPriority(b) - topicPriority(a));
  return summaries;
}

/**
 * Returns the highest-priority topic for the dashboard banner.
 * Returns null when the student has no active (non-mastered) notebook topics.
 */
export async function getPriorityReviewTopic(
  userId: string,
): Promise<TopicNotebookSummary | null> {
  const summaries = await getTopicNotebookSummaries(userId);
  return summaries[0] ?? null;
}
