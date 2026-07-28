/**
 * Confidence tier determination for analytics signals.
 *
 * Every analytics feature produces a ConfidenceTier based on deterministic
 * rules about sample size and data stability. These functions encode those rules.
 *
 * All functions are pure — no database access, no side effects.
 */

import { ConfidenceTier } from "./types";

/**
 * Determine confidence for a weakness topic.
 *
 * Thresholds:
 * - OBSERVED: < 3 wrong attempts
 * - EMERGING: 3–4 wrong attempts
 * - CONFIRMED: ≥ 5 wrong attempts
 *
 * A topic with only 1 or 2 wrong answers could be noise;
 * 5+ indicates a confirmed knowledge gap.
 */
export function determineWeaknessConfidence(wrongCount: number, totalAttempts: number): ConfidenceTier {
  if (wrongCount >= 5 || totalAttempts >= 6) return ConfidenceTier.CONFIRMED;
  if (wrongCount >= 3 || totalAttempts >= 4) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

/**
 * Determine confidence for a pattern observation (same wrong option multiple times).
 *
 * Thresholds:
 * - OBSERVED: 3 occurrences (N=2 filtered out earlier, never reaches here)
 * - EMERGING: 4–5 occurrences
 * - CONFIRMED: ≥ 6 occurrences
 *
 * With only 2 questions, same-option selection is 33% likely by chance.
 * 3+ makes it worth reporting as "possible pattern" to student.
 */
export function determinePatternConfidence(occurrenceCount: number): ConfidenceTier {
  if (occurrenceCount >= 6) return ConfidenceTier.CONFIRMED;
  if (occurrenceCount >= 4) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED; // occurrenceCount === 3
}

/**
 * Determine confidence for section-drop analysis.
 *
 * Thresholds:
 * - OBSERVED: < 30 total attempts (insufficient full-exam coverage)
 * - EMERGING: 30–39 total attempts (reasonable coverage)
 * - CONFIRMED: ≥ 40 total attempts (full real-exam coverage)
 */
export function determineSectionDropConfidence(totalAttempted: number): ConfidenceTier {
  if (totalAttempted >= 40) return ConfidenceTier.CONFIRMED;
  if (totalAttempted >= 30) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

/**
 * Determine confidence for readiness scoring.
 *
 * Thresholds:
 * - OBSERVED: single session with < 35 attempts
 * - EMERGING: either (2+ sessions) OR (≥ 35 attempts in single session)
 * - CONFIRMED: 2+ sessions AND ≥ 60 total attempts
 *
 * Readiness at peak confidence requires two full-length mock exams
 * (sessions 22 and 23) with realistic coverage.
 */
export function determineReadinessConfidence(
  totalAttempts: number,
  sessionCount: number
): ConfidenceTier {
  if (sessionCount >= 2 && totalAttempts >= 60) return ConfidenceTier.CONFIRMED;
  if (sessionCount >= 2 || totalAttempts >= 35) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

/**
 * Student-facing confidence label with sample-size disclosure.
 * Always shows the N-count; color is determined by tier.
 *
 * Example: "Dựa trên 5 câu" (Based on 5 questions) in gray (OBSERVED)
 */
export const STUDENT_CONFIDENCE_LABEL: Record<ConfidenceTier, string> = {
  [ConfidenceTier.OBSERVED]: "Dựa trên {n} câu",
  [ConfidenceTier.EMERGING]: "Dựa trên {n} câu",
  [ConfidenceTier.CONFIRMED]: "Dựa trên {n} câu trong {sessions} buổi",
};

/**
 * Tailwind color classes for confidence tiers.
 * Applied to badge/chip backgrounds.
 */
export const CONFIDENCE_COLOR: Record<ConfidenceTier, string> = {
  [ConfidenceTier.OBSERVED]: "bg-gray-100 text-gray-600",
  [ConfidenceTier.EMERGING]: "bg-yellow-100 text-yellow-700",
  [ConfidenceTier.CONFIRMED]: "bg-green-100 text-green-700",
};

/**
 * Tutor-facing tier labels.
 * Explain what the tier means in terms of evidence/confidence.
 */
export const TUTOR_TIER_LABEL: Record<ConfidenceTier, string> = {
  [ConfidenceTier.OBSERVED]: "OBSERVED — small sample, treat as hypothesis",
  [ConfidenceTier.EMERGING]: "EMERGING — moderate evidence, worth addressing",
  [ConfidenceTier.CONFIRMED]: "CONFIRMED — stable pattern across sufficient data",
};
