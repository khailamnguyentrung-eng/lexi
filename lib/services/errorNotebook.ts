import { prisma } from "@/lib/db/prisma";
import { canonicalTopic } from "@/lib/analytics/canonicalTopic";
import { fetchSessionAttempts } from "@/lib/analytics";

// ── Legacy fixed-offset stub (unchanged — callers that use nextReviewDate/isFinalStage
// keep working; SM-2 replaces write logic for notebook entries, not these helpers) ──

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export function nextReviewDate(fromStage: number, from: Date = new Date()) {
  const days = REVIEW_INTERVALS_DAYS[Math.min(fromStage, REVIEW_INTERVALS_DAYS.length - 1)];
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function isFinalStage(stage: number) {
  return stage >= REVIEW_INTERVALS_DAYS.length - 1;
}

// RV-1 (Ch.3 §3.3 Inv 5 / §3.1 "Consumed"): true exactly when a review
// ADVANCES the entry to MASTERED — i.e. the entry was at the final stage AND
// was not already MASTERED beforehand. Extracted as a pure function (not
// inlined at the route.ts call site) specifically so it is unit-testable:
// the original inline version (`wasFinalStage` alone) double-counted an
// idempotent re-review of an already-mastered entry, caught only by a live
// whole-branch review, not by anything committed. See
// scripts/test-review-engagement.mjs.
export function didAchieveMastery(statusBefore: string, wasFinalStage: boolean): boolean {
  return statusBefore !== "MASTERED" && wasFinalStage;
}

// ── SM-2 Engine ───────────────────────────────────────────────────────────────

export interface SM2UpdateInput {
  reviewStage: number;
  easeFactor: number | null; // null → default 2.5
  quality: number;           // 0–5
}

export interface SM2UpdateResult {
  newReviewStage: number;
  newEaseFactor: number; // clamped [1.3, 2.5]
  intervalDays: number;
}

// Derive the next review interval from the current stage without storing prevInterval.
// Stage 0 → 1 day, stage 1 → 6 days, stage ≥ 2 → iterative EF multiplication.
function computeNextInterval(currentStage: number, ef: number): number {
  if (currentStage === 0) return 1;
  if (currentStage === 1) return 6;
  let interval = 6;
  for (let i = 2; i <= currentStage; i++) {
    interval = Math.round(interval * ef);
  }
  return interval;
}

// Maps post-session accuracy (0.0–1.0) to SM-2 quality score (1–5).
export function accuracyToQuality(accuracy: number): number {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.8) return 4;
  if (accuracy >= 0.6) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

// Pure SM-2 update. No DB access. Fully testable without Prisma.
export function computeSM2Update(input: SM2UpdateInput): SM2UpdateResult {
  const DEFAULT_EF = 2.5;
  const ef = input.easeFactor ?? DEFAULT_EF;
  const q = input.quality;

  // Standard SM-2 ease-factor update formula
  const newEF = Math.max(
    1.3,
    Math.min(2.5, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  if (q < 3) {
    // Failed repetition: reset to stage 0, interval = 1 day
    return { newReviewStage: 0, newEaseFactor: newEF, intervalDays: 1 };
  }

  return {
    newReviewStage: input.reviewStage + 1,
    newEaseFactor: newEF,
    intervalDays: computeNextInterval(input.reviewStage, ef),
  };
}

// ── SM-2 Service ──────────────────────────────────────────────────────────────

// Called after a ProgramCurriculum slot completes. For each topic the
// student practiced, if there is a reviewed (lastReviewedAt != null) open
// notebook entry for that topic, update its SM-2 fields based on this
// session's accuracy.
//
// Previously accepted either a CurriculumSession or a ProgramCurriculum
// slot via an AttemptScope union — CurriculumSession was retired, so this
// is now ProgramCurriculum-only (see docs/superpowers/plans/
// 2026-07-28-retire-curriculumsession-phase1.md).
//
// Failures are non-fatal: the caller wraps this in a try/catch so
// slot completion is never blocked.
export async function applySM2ForSession(
  userId: string,
  programCurriculumId: string,
): Promise<void> {
  // Fetch attempts for this ProgramCurriculum slot with question topic —
  // reuses the same repository function getSessionAnalytics() already uses.
  const attempts = await fetchSessionAttempts(userId, programCurriculumId);

  if (attempts.length === 0) return;

  // 2. Compute accuracy per canonical topic
  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    const canonical = canonicalTopic(a.question.topic);
    const existing = topicStats.get(canonical);
    if (existing) {
      existing.total += 1;
      if (a.isCorrect) existing.correct += 1;
    } else {
      topicStats.set(canonical, { correct: a.isCorrect ? 1 : 0, total: 1 });
    }
  }

  // 3. Fetch reviewed open notebook entries for this user
  const entries = await prisma.errorNotebookEntry.findMany({
    where: {
      userId,
      status: { not: "MASTERED" },
      lastReviewedAt: { not: null },
    },
    select: {
      id: true,
      concept: true,
      reviewStage: true,
      easeFactor: true,
    },
  });

  if (entries.length === 0) return;

  // 4. For each entry whose topic was practiced, apply SM-2
  const now = new Date();
  const updates: Promise<unknown>[] = [];

  for (const entry of entries) {
    const canonical = canonicalTopic(entry.concept);
    const stats = topicStats.get(canonical);
    if (!stats) continue;

    const accuracy = stats.correct / stats.total;
    const quality = accuracyToQuality(accuracy);
    const result = computeSM2Update({
      reviewStage: entry.reviewStage,
      easeFactor: entry.easeFactor,
      quality,
    });

    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + result.intervalDays);

    updates.push(
      prisma.errorNotebookEntry.update({
        where: { id: entry.id },
        data: {
          reviewStage: result.newReviewStage,
          easeFactor: result.newEaseFactor,
          nextReviewAt,
        },
      }),
    );
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}
