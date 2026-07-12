/**
 * Problem Solving Pattern State Engine — Phase 5.4
 *
 * Pure deterministic engine. No Prisma. No AI. No DB access.
 *
 * Produces a ProblemSolvingState snapshot from two evidence sources:
 *   1. AttemptRecord[] — chronological attempt history (isCorrect + attemptedAt)
 *   2. ActiveWeakness[] — error notebook snapshot with improvement signals
 *
 * Prohibited derivations:
 *   ✗ Grit, persistence, or determination labels
 *   ✗ Motivation or engagement inferences
 *   ✗ Intelligence or aptitude claims
 *   ✗ Learning style classification
 *
 * Each pattern dimension describes only what was observed in the data:
 *   ✓ "Retried after 8 of 12 wrong answers (67%)"
 *   ✗ "Persistent learner"
 *   ✓ "Uses hints frequently"    (when hint data exists — not yet tracked)
 *   ✗ "Needs support"
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { ActiveWeakness } from "@/lib/analytics/studentLearningProfile";
import type {
  AttemptRecord,
  PatternEntry,
  RetryPatternValue,
  FeedbackRecoveryValue,
  HelpSeekingValue,
  ErrorCorrectionValue,
  ProblemSolvingState,
} from "./types";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

// Two attempts within this window after a wrong answer count as a retry
const RETRY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Retry pattern thresholds (proportion of wrong answers retried)
const FREQUENT_RETRY_THRESHOLD = 0.6;    // ≥60% → FREQUENT_RETRIER
const OCCASIONAL_RETRY_THRESHOLD = 0.25; // ≥25% → OCCASIONAL_RETRIER

// Post-error success rate thresholds
const QUICK_RECOVERY_THRESHOLD = 0.65;   // ≥65% correct retries → RECOVERS_QUICKLY
const GRADUAL_RECOVERY_THRESHOLD = 0.35; // ≥35% → GRADUAL_RECOVERY

// Remedial engagement thresholds (proportion of weakness topics remedially flagged)
const ACTIVE_ENGAGEMENT_THRESHOLD = 0.5; // ≥50% flagged → ACTIVE_ENGAGEMENT
const SOME_ENGAGEMENT_THRESHOLD = 0.2;   // ≥20% flagged → SOME_ENGAGEMENT

// Error correction thresholds (proportion of topics improving vs. recurring)
const IMPROVING_DOMINANT_THRESHOLD = 0.6; // ≥60% improving → ERRORS_REDUCING
const RECURRING_DOMINANT_THRESHOLD = 0.5; // ≥50% recurring → ERRORS_PERSISTING

// Confidence tier thresholds (by wrong attempt count for retry/recovery)
const MIN_WRONG_FOR_RETRY_EMERGING = 5;
const MIN_WRONG_FOR_RETRY_CONFIRMED = 20;

// Confidence tier thresholds (by weakness count for help-seeking/error-correction)
const MIN_WEAKNESSES_FOR_EMERGING = 3;
const MIN_WEAKNESSES_FOR_CONFIRMED = 8;

// Overall confidence from total attempt count
const CONFIRMED_ATTEMPT_THRESHOLD = 50;
const EMERGING_ATTEMPT_THRESHOLD = 10;

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function unknownPattern<T extends string>(reason: string | null): PatternEntry<T> {
  return { value: "UNKNOWN", evidence: reason, confidenceTier: ConfidenceTier.OBSERVED };
}

function retryConfidenceTier(wrongCount: number): ConfidenceTier {
  if (wrongCount >= MIN_WRONG_FOR_RETRY_CONFIRMED) return ConfidenceTier.CONFIRMED;
  if (wrongCount >= MIN_WRONG_FOR_RETRY_EMERGING) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function weaknessConfidenceTier(count: number): ConfidenceTier {
  if (count >= MIN_WEAKNESSES_FOR_CONFIRMED) return ConfidenceTier.CONFIRMED;
  if (count >= MIN_WEAKNESSES_FOR_EMERGING) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

// ─────────────────────────────────────────────────────────
// Retry pattern + feedback recovery (shared scan)
// ─────────────────────────────────────────────────────────

interface RetryScan {
  wrongCount: number;
  retryCount: number;
  correctRetryCount: number;
}

/**
 * Single chronological scan that detects both retry events and their outcomes.
 *
 * A retry is defined as: the attempt immediately following a wrong answer
 * occurs within RETRY_WINDOW_MS (10 minutes).
 */
function scanRetryBehavior(attempts: AttemptRecord[]): RetryScan {
  const sorted = [...attempts].sort(
    (a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime(),
  );

  let wrongCount = 0;
  let retryCount = 0;
  let correctRetryCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].isCorrect) {
      wrongCount++;
      if (i < sorted.length - 1) {
        const delta =
          new Date(sorted[i + 1].attemptedAt).getTime() -
          new Date(sorted[i].attemptedAt).getTime();
        if (delta <= RETRY_WINDOW_MS) {
          retryCount++;
          if (sorted[i + 1].isCorrect) correctRetryCount++;
        }
      }
    }
  }

  return { wrongCount, retryCount, correctRetryCount };
}

// ─────────────────────────────────────────────────────────
// Dimension builders
// ─────────────────────────────────────────────────────────

function buildRetryPattern(scan: RetryScan): PatternEntry<RetryPatternValue> {
  const { wrongCount, retryCount } = scan;

  if (wrongCount === 0) {
    return unknownPattern<RetryPatternValue>("No wrong answers recorded");
  }

  const tier = retryConfidenceTier(wrongCount);
  const rate = retryCount / wrongCount;
  const ratePct = pct(retryCount, wrongCount);
  const evidence = `Retried after ${retryCount} of ${wrongCount} wrong answers (${ratePct}%)`;

  if (rate >= FREQUENT_RETRY_THRESHOLD) {
    return { value: "FREQUENT_RETRIER", evidence, confidenceTier: tier };
  }
  if (rate >= OCCASIONAL_RETRY_THRESHOLD) {
    return { value: "OCCASIONAL_RETRIER", evidence, confidenceTier: tier };
  }
  return { value: "RARELY_RETRIES", evidence, confidenceTier: tier };
}

function buildFeedbackRecovery(scan: RetryScan): PatternEntry<FeedbackRecoveryValue> {
  const { wrongCount, retryCount, correctRetryCount } = scan;

  if (retryCount === 0) {
    const reason = wrongCount === 0
      ? null
      : "No retries detected after wrong answers";
    return unknownPattern<FeedbackRecoveryValue>(reason);
  }

  const tier = retryConfidenceTier(wrongCount);
  const rate = correctRetryCount / retryCount;
  const ratePct = pct(correctRetryCount, retryCount);
  const evidence = `${correctRetryCount} of ${retryCount} post-error retries were correct (${ratePct}%)`;

  if (rate >= QUICK_RECOVERY_THRESHOLD) {
    return { value: "RECOVERS_QUICKLY", evidence, confidenceTier: tier };
  }
  if (rate >= GRADUAL_RECOVERY_THRESHOLD) {
    return { value: "GRADUAL_RECOVERY", evidence, confidenceTier: tier };
  }
  return { value: "SLOW_RECOVERY", evidence, confidenceTier: tier };
}

function buildHelpSeeking(activeWeaknesses: ActiveWeakness[]): PatternEntry<HelpSeekingValue> {
  const total = activeWeaknesses.length;

  if (total === 0) {
    return unknownPattern<HelpSeekingValue>("No error topics recorded");
  }

  const flagged = activeWeaknesses.filter((w) => w.isRemedialFlagged).length;
  const rate = flagged / total;
  const ratePct = pct(flagged, total);
  const evidence = `${flagged} of ${total} error topics flagged for active remediation (${ratePct}%)`;
  const tier = weaknessConfidenceTier(total);

  if (rate >= ACTIVE_ENGAGEMENT_THRESHOLD) {
    return { value: "ACTIVE_ENGAGEMENT", evidence, confidenceTier: tier };
  }
  if (rate >= SOME_ENGAGEMENT_THRESHOLD) {
    return { value: "SOME_ENGAGEMENT", evidence, confidenceTier: tier };
  }
  return { value: "LOW_ENGAGEMENT", evidence, confidenceTier: tier };
}

function buildErrorCorrection(activeWeaknesses: ActiveWeakness[]): PatternEntry<ErrorCorrectionValue> {
  const withSignal = activeWeaknesses.filter((w) => w.signal !== "NO_DATA");
  const total = withSignal.length;

  if (total === 0) {
    return unknownPattern<ErrorCorrectionValue>(
      activeWeaknesses.length === 0
        ? "No error topics recorded"
        : "No improvement signal data available",
    );
  }

  const recurringCount = withSignal.filter((w) => w.signal === "RECURRING").length;
  const improvingCount = withSignal.filter(
    (w) => w.signal === "IMPROVED" || w.signal === "IMPROVING",
  ).length;

  const improvingRate = improvingCount / total;
  const recurringRate = recurringCount / total;

  const evidence = `${recurringCount} recurring, ${improvingCount} improving across ${total} error topics with signal data`;
  const tier = weaknessConfidenceTier(total);

  if (improvingRate >= IMPROVING_DOMINANT_THRESHOLD) {
    return { value: "ERRORS_REDUCING", evidence, confidenceTier: tier };
  }
  if (recurringRate >= RECURRING_DOMINANT_THRESHOLD) {
    return { value: "ERRORS_PERSISTING", evidence, confidenceTier: tier };
  }
  return { value: "ERRORS_STABLE", evidence, confidenceTier: tier };
}

function deriveOverallConfidenceTier(attemptCount: number): ConfidenceTier {
  if (attemptCount >= CONFIRMED_ATTEMPT_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (attemptCount >= EMERGING_ATTEMPT_THRESHOLD) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

// ─────────────────────────────────────────────────────────
// Pure engine
// ─────────────────────────────────────────────────────────

/**
 * Compute problem-solving pattern state from attempt history and error notebook.
 * Pure — no DB access. All input is fetched by the caller.
 *
 * retryPattern:
 *   Attempts sorted chronologically; a retry is an attempt within 10 minutes
 *   of a wrong answer. Retry rate = retried wrongs / total wrongs.
 *
 * feedbackRecovery:
 *   Among retry pairs detected above, post-error success rate =
 *   correct retries / total retries.
 *
 * helpSeeking:
 *   Derived from isRemedialFlagged on active weaknesses. This is the
 *   available proxy for remediation engagement; hint and explanation access
 *   tracking are not yet in the data model.
 *
 * errorCorrection:
 *   Derived from improvement signals on active weakness topics.
 *   IMPROVED/IMPROVING = errors being resolved; RECURRING = no improvement
 *   after review. Confidence from weakness count with signal data.
 */
export function computeProblemSolvingState(
  attempts: AttemptRecord[],
  activeWeaknesses: ActiveWeakness[],
): ProblemSolvingState {
  const scan = scanRetryBehavior(attempts);

  return {
    retryPattern: buildRetryPattern(scan),
    feedbackRecovery: buildFeedbackRecovery(scan),
    helpSeeking: buildHelpSeeking(activeWeaknesses),
    errorCorrection: buildErrorCorrection(activeWeaknesses),
    confidenceTier: deriveOverallConfidenceTier(attempts.length),
    computedAt: new Date().toISOString(),
  };
}
