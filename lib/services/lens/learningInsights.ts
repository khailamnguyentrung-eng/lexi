/**
 * LEXI Lens — Learning Insights transformer.
 *
 * Extracts the top 1–3 key observations from StudentLearningProfile v3.
 * Pure — no DB access, no AI, no new inference rules.
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { StudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import { mapConfidenceTier, mapSignalConfidence } from "./types";
import type { LearningInsight, LearningInsights } from "./types";

const MAX_INSIGHTS = 3;

// ─────────────────────────────────────────────────────────
// Private helpers — one builder per insight type
// ─────────────────────────────────────────────────────────

function buildPrimarySignalInsight(
  profile: StudentLearningProfile
): LearningInsight | null {
  const signal = profile.topSignal;
  if (!signal) return null;

  const confidenceTier = mapSignalConfidence(signal.confidence);
  const prefixObserved = confidenceTier === ConfidenceTier.OBSERVED ? "Early sign: " : "";

  let narrative = "";
  switch (signal.type) {
    case "FIRST_MASTERY":
      narrative = `${prefixObserved}You just mastered your first topic: ${signal.topicLabel}! This is a big milestone.`;
      break;
    case "TOPIC_MASTERED":
      narrative = `${prefixObserved}You've mastered ${signal.topicLabel}. Great progress!`;
      break;
    case "TOPIC_IMPROVING":
      narrative = `${prefixObserved}${signal.topicLabel} is improving. Keep practicing.`;
      break;
    case "RECURRING_WEAKNESS":
      narrative = `${prefixObserved}${signal.topicLabel} shows a recurring pattern. You've reviewed it multiple times but mistakes continue.`;
      break;
    case "RETENTION_RISK":
      narrative = `${prefixObserved}${signal.topicLabel} is at risk of being forgotten — these entries are due for review.`;
      break;
    case "LEARNING_MOMENTUM":
      narrative = `${prefixObserved}You're making overall progress. Keep up the momentum.`;
      break;
    case "PACE_OBSERVATION":
      narrative = `${prefixObserved}Your session pace has been declining. A short break or topic change might help.`;
      break;
    case "STREAK_MILESTONE":
      narrative = `You're on a ${signal.evidence.currentStreak}-day streak! Consistent daily practice is the fastest path to improvement.`;
      break;
    default:
      return null;
  }

  const evidence: LearningInsight["evidence"] = {};
  if (signal.type === "STREAK_MILESTONE" && signal.evidence.currentStreak !== undefined) {
    evidence.streakDays = signal.evidence.currentStreak;
  }
  evidence.signalType = signal.type;

  return {
    type: "PRIMARY_SIGNAL",
    narrative,
    evidence,
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "topSignal",
  };
}

function buildAccuracyTrendInsight(
  profile: StudentLearningProfile
): LearningInsight | null {
  const { performanceState } = profile.learnerModel;
  const { accuracyTrend, overallAccuracy, confidenceTier } = performanceState;

  if (accuracyTrend === "INSUFFICIENT_DATA") {
    return {
      type: "ACCURACY_TREND",
      narrative: "Too early to measure accuracy trends — complete a few more attempts.",
      evidence: {},
      confidence: "LOW",
      confidenceTier: ConfidenceTier.OBSERVED,
      source: "learnerModel.performanceState",
    };
  }

  const prefix = confidenceTier === ConfidenceTier.OBSERVED ? "Early observation: " : "";
  const accuracyStr = `${Math.round(overallAccuracy)}%`;

  let narrative = "";
  switch (accuracyTrend) {
    case "IMPROVING":
      narrative = `${prefix}Your accuracy is improving (currently ${accuracyStr}). Great progress!`;
      break;
    case "STABLE":
      narrative = `${prefix}You're holding steady at ${accuracyStr} accuracy — a solid foundation to build on.`;
      break;
    case "DECLINING":
      narrative = `${prefix}Your accuracy has been declining (currently ${accuracyStr}). Consider focusing on fundamentals.`;
      break;
    default:
      return null;
  }

  return {
    type: "ACCURACY_TREND",
    narrative,
    evidence: { attempts: undefined },
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.performanceState",
  };
}

function buildConsistencyInsight(
  profile: StudentLearningProfile
): LearningInsight | null {
  const { performanceState } = profile.learnerModel;
  const { consistencyProfile, confidenceTier } = performanceState;

  // Only surface non-CONSISTENT and ERRATIC; CONSISTENT is not noteworthy
  if (consistencyProfile === "CONSISTENT") return null;
  // Suppress if confidence is too low
  if (confidenceTier === ConfidenceTier.OBSERVED) return null;

  const prefix = confidenceTier === ConfidenceTier.EMERGING ? "It looks like " : "";

  let narrative = "";
  if (consistencyProfile === "VARIABLE") {
    narrative = `${prefix}your performance varies session to session. Some days you're sharper than others.`;
  } else if (consistencyProfile === "ERRATIC") {
    narrative = `${prefix}your results are erratic. Something may be affecting your focus or preparation between sessions.`;
  } else {
    return null;
  }

  // Capitalize after prefix if no prefix
  if (!prefix) {
    narrative = narrative.charAt(0).toUpperCase() + narrative.slice(1);
  }

  return {
    type: "CONSISTENCY",
    narrative,
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.performanceState.consistencyProfile",
  };
}

function buildRecoveryInsight(
  profile: StudentLearningProfile
): LearningInsight | null {
  const { problemSolvingState } = profile.learnerModel;
  const { feedbackRecovery } = problemSolvingState;

  if (feedbackRecovery.value === "UNKNOWN") return null;

  const confidenceTier = problemSolvingState.confidenceTier;
  const prefix = confidenceTier === ConfidenceTier.OBSERVED ? "Early observation: " : "";

  let narrative = "";
  switch (feedbackRecovery.value) {
    case "RECOVERS_QUICKLY":
      narrative = `${prefix}When you make a mistake, you usually correct it immediately. Strong error recovery.`;
      break;
    case "GRADUAL_RECOVERY":
      narrative = `${prefix}You recover from errors gradually — taking a few extra attempts before getting it right.`;
      break;
    case "SLOW_RECOVERY":
      narrative = `${prefix}You recover from errors slowly. Consider reviewing the explanation after each mistake.`;
      break;
    default:
      return null;
  }

  return {
    type: "RECOVERY",
    narrative,
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.problemSolvingState.feedbackRecovery",
  };
}

// ─────────────────────────────────────────────────────────
// Public transformer
// ─────────────────────────────────────────────────────────

/**
 * Extract the top 1–3 learning insights from a StudentLearningProfile v3.
 *
 * Priority order:
 *   1. PRIMARY_SIGNAL  — topSignal if present (most urgent/notable event)
 *   2. ACCURACY_TREND  — overall trajectory with current accuracy
 *   3. CONSISTENCY     — only when VARIABLE or ERRATIC and confidence >= EMERGING
 *   4. RECOVERY        — problem-solving recovery pattern if known
 *
 * Returns at most MAX_INSIGHTS (3) insights, in priority order.
 * No new inference — only narrates values already present in the profile.
 */
export function extractLearningInsights(
  profile: StudentLearningProfile
): LearningInsights {
  const candidates: (LearningInsight | null)[] = [
    buildPrimarySignalInsight(profile),
    buildAccuracyTrendInsight(profile),
    buildConsistencyInsight(profile),
    buildRecoveryInsight(profile),
  ];

  const insights = candidates
    .filter((i): i is LearningInsight => i !== null)
    .slice(0, MAX_INSIGHTS);

  return {
    insights,
    generatedAt: new Date().toISOString(),
  };
}
