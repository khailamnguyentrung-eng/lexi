/**
 * Performance State Engine — Phase 5.1
 *
 * Pure deterministic engine. No Prisma. No AI. No DB access.
 * No personality interpretation.
 *
 * Transforms attempt history and skill accuracy data into a structured
 * PerformanceState snapshot covering accuracy trend, consistency, and
 * per-skill classification.
 *
 * Confidence rules:
 *   OBSERVED  — fewer than 10 attempts (too few to establish a pattern)
 *   EMERGING  — 10–49 attempts (pattern visible, not yet stable)
 *   CONFIRMED — 50+ attempts (robust statistical picture)
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type {
  AttemptRecord,
  SkillAccuracyInput,
  PerformanceState,
  AccuracyTrend,
  ConsistencyProfile,
  SkillPerformance,
} from "./types";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const MIN_ATTEMPTS_FOR_TREND = 5;
const MIN_ATTEMPTS_FOR_CONSISTENCY = 10;
const TREND_DELTA_THRESHOLD = 0.05; // 5 percentage-point gap triggers IMPROVING/DECLINING

// Variance thresholds (on accuracy proportions, 0–1 scale).
// std dev < 0.05  → CONSISTENT  (variance < 0.0025)
// std dev < 0.15  → VARIABLE    (variance < 0.0225)
// otherwise       → ERRATIC
const CONSISTENT_VARIANCE_MAX = 0.0025;
const VARIABLE_VARIANCE_MAX = 0.0225;

const CONFIRMED_ATTEMPT_THRESHOLD = 50;
const EMERGING_ATTEMPT_THRESHOLD = 10;

const STRONG_SKILL_THRESHOLD = 75;
const DEVELOPING_SKILL_THRESHOLD = 50;

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function sortedByDate(attempts: AttemptRecord[]): AttemptRecord[] {
  return [...attempts].sort(
    (a, b) =>
      new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime(),
  );
}

function accuracy(slice: AttemptRecord[]): number {
  if (slice.length === 0) return 0;
  return slice.filter((a) => a.isCorrect).length / slice.length;
}

function computeAccuracyTrend(attempts: AttemptRecord[]): AccuracyTrend {
  if (attempts.length < MIN_ATTEMPTS_FOR_TREND) return "INSUFFICIENT_DATA";

  const sorted = sortedByDate(attempts);
  const half = Math.floor(sorted.length / 2);
  const earlierAcc = accuracy(sorted.slice(0, half));
  const laterAcc = accuracy(sorted.slice(sorted.length - half));

  if (laterAcc - earlierAcc >= TREND_DELTA_THRESHOLD) return "IMPROVING";
  if (earlierAcc - laterAcc >= TREND_DELTA_THRESHOLD) return "DECLINING";
  return "STABLE";
}

function computeConsistencyProfile(attempts: AttemptRecord[]): ConsistencyProfile {
  if (attempts.length < MIN_ATTEMPTS_FOR_CONSISTENCY) return "CONSISTENT";

  const sorted = sortedByDate(attempts);
  const windowSize = Math.floor(sorted.length / 3);

  const windows: AttemptRecord[][] = [
    sorted.slice(0, windowSize),
    sorted.slice(windowSize, 2 * windowSize),
    sorted.slice(2 * windowSize),
  ];

  const accuracies = windows.map((w) => accuracy(w));
  const mean = accuracies.reduce((s, v) => s + v, 0) / accuracies.length;
  const variance =
    accuracies.reduce((s, v) => s + (v - mean) ** 2, 0) / accuracies.length;

  if (variance <= CONSISTENT_VARIANCE_MAX) return "CONSISTENT";
  if (variance <= VARIABLE_VARIANCE_MAX) return "VARIABLE";
  return "ERRATIC";
}

function derivePerformanceConfidenceTier(attemptCount: number): ConfidenceTier {
  if (attemptCount >= CONFIRMED_ATTEMPT_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (attemptCount >= EMERGING_ATTEMPT_THRESHOLD) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function classifySkillTier(
  percentage: number,
): "STRONG" | "DEVELOPING" | "WEAK" {
  if (percentage >= STRONG_SKILL_THRESHOLD) return "STRONG";
  if (percentage >= DEVELOPING_SKILL_THRESHOLD) return "DEVELOPING";
  return "WEAK";
}

// ─────────────────────────────────────────────────────────
// Pure engine
// ─────────────────────────────────────────────────────────

/**
 * Compute performance state from pre-fetched attempt and skill data.
 * Pure — no DB access. All input is fetched by the caller.
 *
 * Accuracy trend:
 *   Splits attempts chronologically into two equal halves.
 *   If later accuracy exceeds earlier by ≥ 5 pp → IMPROVING.
 *   If earlier exceeds later by ≥ 5 pp → DECLINING.
 *   Otherwise → STABLE. Fewer than 5 attempts → INSUFFICIENT_DATA.
 *
 * Consistency:
 *   Splits chronologically into 3 windows, measures accuracy variance.
 *   Low variance → CONSISTENT, moderate → VARIABLE, high → ERRATIC.
 *   Fewer than 10 attempts → defaults to CONSISTENT (no pattern yet).
 *
 * Skill performance:
 *   Maps each skill accuracy to STRONG (≥75), DEVELOPING (≥50), or WEAK (<50).
 */
export function computePerformanceState(
  attempts: AttemptRecord[],
  skillAccuracies: SkillAccuracyInput[],
): PerformanceState {
  const overallAccuracy =
    attempts.length === 0
      ? 0
      : Math.round(
          (attempts.filter((a) => a.isCorrect).length / attempts.length) * 100,
        );

  const accuracyTrend = computeAccuracyTrend(attempts);
  const consistencyProfile = computeConsistencyProfile(attempts);
  const confidenceTier = derivePerformanceConfidenceTier(attempts.length);

  const skillPerformance: SkillPerformance[] = skillAccuracies.map((s) => ({
    skill: s.skill,
    label: s.label,
    percentage: s.percentage,
    // A skill with no evidence is NO_DATA, never WEAK — a fabricated 0% must
    // not become a confident-weakness claim (Ch.2 §2.7; Constitution 5.2/5.10).
    tier: s.hasData ? classifySkillTier(s.percentage) : "NO_DATA",
  }));

  return {
    accuracyTrend,
    overallAccuracy,
    consistencyProfile,
    skillPerformance,
    confidenceTier,
    computedAt: new Date().toISOString(),
  };
}
