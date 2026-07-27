/**
 * Learning Behavior Engine — M2.2
 *
 * Analyzes observed learning patterns from session timing, response-time signals,
 * and mood context. Produces a BehaviorProfile: a factual summary of how the student
 * has been interacting with the system, not an identity label or psychological assessment.
 *
 * Architecture:
 *   Repository (getBehaviorProfile) → Pure Engine (computeBehaviorProfile) → BehaviorProfile
 *
 * Pure functions have no Prisma access. Repository function has no logic.
 */

import { prisma } from "@/lib/db/prisma";
import { ConfidenceTier } from "./types";

// ─────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────

export type SessionTimeOfDay = "MORNING" | "AFTERNOON" | "EVENING";
// MORNING:   06:00–11:59
// AFTERNOON: 12:00–17:59
// EVENING:   18:00–23:59 (and 00:00–05:59, treated as late-evening)

export type PaceProfile = "CONSISTENT" | "DECLINING" | "VARIABLE";
// Derived by comparing first-third vs last-third accuracy across sessions.
// CONSISTENT: performance holds throughout sessions
// DECLINING:  performance drops notably toward the end of sessions
// VARIABLE:   no stable pattern across sessions

export type ResponseTimeSignal = "EXTENDED" | "MODERATE" | "BRIEF";
// Derived from median timeSpentSec across attempts where data is available.
// EXTENDED: median ≥ 30s (student spends more time per question)
// MODERATE: 10s ≤ median < 30s
// BRIEF:    median < 10s OR fewer than 5 non-null records (insufficient data)
// Note: response time is a behavioral observation, not a proxy for psychological effort.

export type MoodContext = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
// Derived from last 7 MoodEntry records. Contextual signal only — not used
// to determine mastery or difficulty directly.
// POSITIVE: majority (≥ 4 of 7) are GREAT or GOOD
// NEGATIVE: majority (≥ 4 of 7) are TIRED or STRESSED
// NEUTRAL:  otherwise

export interface BehaviorProfile {
  preferredTimeOfDay: SessionTimeOfDay | null;  // null: < 5 sessions with startedAt
  paceProfile: PaceProfile | null;              // null: < 3 sessions with attempt data
  avgSessionDurationMin: number | null;         // null: no startedAt/completedAt pairs
  responseTimeSignal: ResponseTimeSignal | null; // null: < 5 non-null timeSpentSec records
  recentMoodContext: MoodContext | null;         // null: < 5 mood entries
  sessionCount: number;
  confidenceTier: ConfidenceTier;
}

// ─────────────────────────────────────────────────────────
// Internal input types (pure engine layer)
// ─────────────────────────────────────────────────────────

export interface SessionDataPoint {
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: {
    isCorrect: boolean;
    timeSpentSec: number | null;
    attemptedAt: Date;
  }[];
}

export interface MoodDataPoint {
  mood: "GREAT" | "GOOD" | "OKAY" | "TIRED" | "STRESSED";
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────
// Private derivation helpers (pure — no side effects)
// ─────────────────────────────────────────────────────────

function deriveTimeOfDay(sessions: SessionDataPoint[]): SessionTimeOfDay | null {
  const withStart = sessions.filter((s) => s.startedAt != null);
  if (withStart.length < 5) return null;

  const buckets: Record<SessionTimeOfDay, number> = {
    MORNING: 0,
    AFTERNOON: 0,
    EVENING: 0,
  };

  for (const s of withStart) {
    const hour = s.startedAt!.getHours();
    if (hour >= 6 && hour < 12) buckets.MORNING++;
    else if (hour >= 12 && hour < 18) buckets.AFTERNOON++;
    else buckets.EVENING++;
  }

  const dominant = (Object.entries(buckets) as [SessionTimeOfDay, number][]).reduce(
    (a, b) => (b[1] > a[1] ? b : a)
  );

  // Require dominant bucket to hold majority (> 50%)
  return dominant[1] > withStart.length / 2 ? dominant[0] : null;
}

function derivePaceProfile(sessions: SessionDataPoint[]): PaceProfile | null {
  const withAttempts = sessions.filter((s) => s.attempts.length >= 3);
  if (withAttempts.length < 3) return null;

  let decliningCount = 0;
  let consistentCount = 0;

  for (const s of withAttempts) {
    const sorted = [...s.attempts].sort(
      (a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime()
    );
    const third = Math.max(1, Math.floor(sorted.length / 3));
    const first = sorted.slice(0, third);
    const last = sorted.slice(sorted.length - third);

    const firstAcc = first.filter((a) => a.isCorrect).length / first.length;
    const lastAcc = last.filter((a) => a.isCorrect).length / last.length;
    const delta = firstAcc - lastAcc;

    if (delta >= 0.15) decliningCount++;
    else if (Math.abs(delta) < 0.15) consistentCount++;
  }

  const total = withAttempts.length;
  const majority = total / 2;

  if (decliningCount > majority) return "DECLINING";
  if (consistentCount > majority) return "CONSISTENT";
  return "VARIABLE";
}

function deriveAvgDuration(sessions: SessionDataPoint[]): number | null {
  const durations: number[] = [];
  for (const s of sessions) {
    if (s.startedAt != null && s.completedAt != null) {
      const mins = (s.completedAt.getTime() - s.startedAt.getTime()) / 60000;
      if (mins > 0 && mins < 300) durations.push(mins); // discard implausible values
    }
  }
  if (durations.length === 0) return null;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(avg * 10) / 10; // one decimal place
}

function deriveResponseTimeSignal(sessions: SessionDataPoint[]): ResponseTimeSignal | null {
  const timings: number[] = [];
  for (const s of sessions) {
    for (const a of s.attempts) {
      if (a.timeSpentSec != null) timings.push(a.timeSpentSec);
    }
  }
  if (timings.length < 5) return null;

  // Median to resist outlier influence
  const sorted = [...timings].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  if (median >= 30) return "EXTENDED";
  if (median >= 10) return "MODERATE";
  return "BRIEF";
}

function deriveMoodContext(moodEntries: MoodDataPoint[]): MoodContext | null {
  if (moodEntries.length < 5) return null;
  const recent = moodEntries.slice(0, 7);
  const positive = recent.filter(
    (m) => m.mood === "GREAT" || m.mood === "GOOD"
  ).length;
  const negative = recent.filter(
    (m) => m.mood === "TIRED" || m.mood === "STRESSED"
  ).length;
  const majority = recent.length / 2;
  if (positive > majority) return "POSITIVE";
  if (negative > majority) return "NEGATIVE";
  return "NEUTRAL";
}

function deriveConfidenceTier(sessionCount: number): ConfidenceTier {
  if (sessionCount >= 10) return ConfidenceTier.CONFIRMED;
  if (sessionCount >= 5) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

// ─────────────────────────────────────────────────────────
// Pure engine function (exported — no Prisma)
// ─────────────────────────────────────────────────────────

export function computeBehaviorProfile(
  sessions: SessionDataPoint[],
  moodEntries: MoodDataPoint[]
): BehaviorProfile {
  const sessionCount = sessions.length;
  return {
    preferredTimeOfDay: deriveTimeOfDay(sessions),
    paceProfile: derivePaceProfile(sessions),
    avgSessionDurationMin: deriveAvgDuration(sessions),
    responseTimeSignal: deriveResponseTimeSignal(sessions),
    recentMoodContext: deriveMoodContext(moodEntries),
    sessionCount,
    confidenceTier: deriveConfidenceTier(sessionCount),
  };
}

// ─────────────────────────────────────────────────────────
// Repository function (Prisma access — no logic)
// ─────────────────────────────────────────────────────────

export async function getBehaviorProfile(userId: string): Promise<BehaviorProfile> {
  const completedProgramSlots = await prisma.userProgramProgress.findMany({
    where: { userId, status: "COMPLETED" },
    select: { programCurriculumId: true, startedAt: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 30,
  });

  const programSlotIds = completedProgramSlots.map((s) => s.programCurriculumId);

  const [programAttempts, rawMoods] = await Promise.all([
    programSlotIds.length > 0
      ? prisma.questionAttempt.findMany({
          where: { userId, programCurriculumId: { in: programSlotIds } },
          select: { isCorrect: true, timeSpentSec: true, attemptedAt: true, programCurriculumId: true },
        })
      : Promise.resolve([]),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 14,
    }),
  ]);

  // Group attempts by which program slot they belong to.
  const attemptsByContext = new Map<
    string,
    { isCorrect: boolean; timeSpentSec: number | null; attemptedAt: Date }[]
  >();
  for (const a of programAttempts) {
    if (a.programCurriculumId == null) continue;
    const existing = attemptsByContext.get(a.programCurriculumId) ?? [];
    existing.push(a);
    attemptsByContext.set(a.programCurriculumId, existing);
  }

  const sessions: SessionDataPoint[] = completedProgramSlots.map((s) => ({
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    attempts: (attemptsByContext.get(s.programCurriculumId) ?? []).map((a) => ({
      isCorrect: a.isCorrect,
      timeSpentSec: a.timeSpentSec,
      attemptedAt: a.attemptedAt,
    })),
  }));

  const moodEntries: MoodDataPoint[] = rawMoods.map((m) => ({
    mood: m.mood as MoodDataPoint["mood"],
    createdAt: m.createdAt,
  }));

  return computeBehaviorProfile(sessions, moodEntries);
}
