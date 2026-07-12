/**
 * LEXI Lens — Learner Summary transformer.
 *
 * Transforms StudentLearningProfile v3 into a single coherent LearnerSummary.
 * Pure — no DB access, no AI, no new inference rules.
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { StudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import { mapConfidenceTier } from "./types";
import type { LearnerSummary } from "./types";

const SOURCE = "learnerModel.knowledgeState";

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function formatEngagementOpening(level: string): string {
  switch (level) {
    case "HIGHLY_ACTIVE": return "A highly active learner";
    case "ACTIVE":        return "An active learner";
    case "OCCASIONAL":    return "An occasional learner";
    case "INACTIVE":      return "An inactive learner";
    default:              return "A learner";
  }
}

function formatTrendPhrase(trend: string, topicCount: number): string {
  const ctx = topicCount > 0
    ? ` across ${topicCount} topic${topicCount !== 1 ? "s" : ""}`
    : "";
  switch (trend) {
    case "PROGRESSING":      return `showing clear progress${ctx}.`;
    case "STABLE":           return `holding steady${ctx}.`;
    case "NEEDS_ATTENTION":  return `with topics that need attention${ctx}.`;
    case "INSUFFICIENT_DATA": return "still building learning history.";
    default:                 return `with ${topicCount} active topics.`;
  }
}

function formatRetryPhrase(retry: string): string {
  switch (retry) {
    case "FREQUENT_RETRIER":   return "Retries after errors frequently.";
    case "OCCASIONAL_RETRIER": return "Sometimes retries after errors.";
    case "RARELY_RETRIES":     return "Rarely revisits after errors.";
    default:                   return "";
  }
}

function formatRecoveryPhrase(recovery: string): string {
  switch (recovery) {
    case "RECOVERS_QUICKLY": return "Typically corrects mistakes immediately.";
    case "GRADUAL_RECOVERY": return "Shows gradual improvement after errors.";
    case "SLOW_RECOVERY":    return "Slow to recover from errors.";
    default:                 return "";
  }
}

function formatKnowledgeLandscape(
  masteredCount: number,
  developingCount: number,
  topicCount: number,
  isLowConfidence: boolean
): string {
  if (isLowConfidence) {
    return "Still building a picture of progress across topics.";
  }
  if (masteredCount > 0) {
    const masteredLabel = `${masteredCount} topic${masteredCount !== 1 ? "s" : ""}`;
    if (developingCount > 0) {
      return `Has mastered ${masteredLabel}, with ${developingCount} currently improving.`;
    }
    return `Has mastered ${masteredLabel}.`;
  }
  if (topicCount > 0) {
    return `No mastered topics yet; all ${topicCount} are in active review.`;
  }
  return "";
}

// ─────────────────────────────────────────────────────────
// Public transformer
// ─────────────────────────────────────────────────────────

/**
 * Build a LearnerSummary from a StudentLearningProfile v3.
 *
 * Uses: engagementLevel, learningTrend, knowledgeState topic counts,
 * problemSolvingState retry/recovery patterns, currentStreak, recentMoodContext.
 *
 * No new inference — only narrates values already present in the profile.
 */
export function buildLearnerSummary(
  profile: StudentLearningProfile
): LearnerSummary {
  const { learnerModel, learningTrend, currentStreak } = profile;
  const { knowledgeState, learningBehaviorState, problemSolvingState } = learnerModel;
  const { engagementObservation } = learningBehaviorState;
  const { engagementLevel, recentMoodContext } = engagementObservation;

  const topicCount = knowledgeState.topicCount;
  const masteredCount = knowledgeState.masteredConcepts.length;
  const developingCount = knowledgeState.developingConcepts.length;
  const weakCount = knowledgeState.weakConcepts.length;
  const confidenceTier = knowledgeState.confidenceTier;
  const isLowConfidence = confidenceTier === ConfidenceTier.OBSERVED;

  // No topics at all — too early for a meaningful summary
  if (topicCount < 1) {
    return {
      narrative: "No learning data yet. Complete a few sessions to see your profile.",
      engagementLevel,
      masteredCount: 0,
      developingCount: 0,
      weakCount: 0,
      streakDays: currentStreak,
      topicCount: 0,
      trendIndicator: learningTrend as LearnerSummary["trendIndicator"],
      confidenceLevel: "LOW",
      confidenceTier,
      source: SOURCE,
    };
  }

  const parts: string[] = [];

  // 1. Opening: engagement + trend
  const opening = formatEngagementOpening(engagementLevel);
  const trendPhrase = formatTrendPhrase(learningTrend, topicCount);
  parts.push(`${opening} ${trendPhrase}`);

  // 2. Problem-solving pattern (only if we have non-UNKNOWN values)
  const retryVal = problemSolvingState.retryPattern.value;
  const recoveryVal = problemSolvingState.feedbackRecovery.value;
  const retryPhrase = retryVal !== "UNKNOWN" ? formatRetryPhrase(retryVal) : "";
  const recoveryPhrase = recoveryVal !== "UNKNOWN" ? formatRecoveryPhrase(recoveryVal) : "";
  if (retryPhrase || recoveryPhrase) {
    parts.push([retryPhrase, recoveryPhrase].filter(Boolean).join(" "));
  }

  // 3. Knowledge landscape
  const landscape = formatKnowledgeLandscape(
    masteredCount, developingCount, topicCount, isLowConfidence
  );
  if (landscape) parts.push(landscape);

  // 4. Mood context (optional)
  if (recentMoodContext) {
    parts.push(`Recent sessions show ${recentMoodContext} mood context.`);
  }

  return {
    narrative: parts.join(" "),
    engagementLevel,
    masteredCount,
    developingCount,
    weakCount,
    streakDays: currentStreak,
    topicCount,
    trendIndicator: learningTrend as LearnerSummary["trendIndicator"],
    confidenceLevel: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: SOURCE,
  };
}
