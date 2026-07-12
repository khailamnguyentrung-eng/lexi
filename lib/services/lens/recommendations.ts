/**
 * LEXI Lens — Recommendations transformer.
 *
 * Transforms existing PracticeRecommendation[] from StudentLearningProfile v3
 * into RecommendationItem[] with plain-language narratives.
 * Pure — no DB access, no AI, no new inference rules.
 * Does NOT invent new recommendations — only transforms what the profile already contains.
 */

import type { StudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import type { PracticeRecommendation } from "@/lib/services/practiceRecommendation";
import { mapConfidenceTier, mapRecommendationConfidence } from "./types";
import type { RecommendationItem, RecommendedActions } from "./types";

const STREAK_MILESTONE = 7;

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function buildReason(rec: PracticeRecommendation): string {
  switch (rec.priorityLabel) {
    case "RECURRING_MISTAKE":
      return `You've practiced this but mistakes continue. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`;
    case "DUE_REVIEW":
      return `It's been a while since your last review. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`;
    case "WEAKNESS_SIGNAL":
      return `Your recent accuracy was low on this topic. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`;
    case "CURRICULUM_PROGRESS":
      return rec.sessionNumber
        ? `You've finished the current content. Advance to Session ${rec.sessionNumber}${rec.label ? `: ${rec.label}` : ""}.`
        : "You've finished the current content. Advance to the next session.";
    default:
      return rec.reason;
  }
}

function addPreferenceHint(
  reason: string,
  rec: PracticeRecommendation,
  profile: StudentLearningProfile
): string {
  const pref = profile.learnerModel.learningPreferenceState;
  const practiceMode = pref.practiceMode.value;
  const sessionDuration = pref.sessionDuration.value;

  let hint = "";

  // Preference-aware hint for curriculum progress action
  if (rec.priorityLabel === "CURRICULUM_PROGRESS" && practiceMode === "EXAM_SIMULATION") {
    hint = " Try a full-length exam simulation.";
  }

  // Short session preference: suggest a quick drill for practice actions
  if (
    sessionDuration === "SHORT" &&
    (rec.priorityLabel === "RECURRING_MISTAKE" || rec.priorityLabel === "WEAKNESS_SIGNAL")
  ) {
    hint = " Quick 5-question drill recommended.";
  }

  return reason + hint;
}

// ─────────────────────────────────────────────────────────
// Public transformer
// ─────────────────────────────────────────────────────────

/**
 * Transform existing practice recommendations into Lens RecommendationItems.
 *
 * Sources:
 *   - profile.recommendations   — PracticeRecommendation[], already priority-ordered
 *   - profile.nextSessionNumber — for nextSessionReady flag
 *   - profile.learnerModel.learningPreferenceState — for optional preference hints
 *   - profile.currentStreak     — for streak milestone context
 *
 * Does NOT create new recommendations. Only transforms and enriches existing ones.
 * Max 4 actions (inherited from the upstream recommendation cap in M1.4).
 */
export function buildLensRecommendations(
  profile: StudentLearningProfile
): RecommendedActions {
  const { recommendations, nextSessionNumber, currentStreak } = profile;

  const actions: RecommendationItem[] = recommendations.map((rec) => {
    const confidenceTier = mapRecommendationConfidence(rec.confidence);
    const baseReason = buildReason(rec);
    const enrichedReason = addPreferenceHint(baseReason, rec, profile);

    const item: RecommendationItem = {
      priority: rec.priority,
      topic: rec.topic,
      label: rec.label,
      reason: enrichedReason,
      suggestedAction: rec.suggestedAction,
      questionCount: rec.questionCount > 0 ? rec.questionCount : undefined,
      confidence: mapConfidenceTier(confidenceTier),
      confidenceTier,
      source: "recommendations",
    };

    if (rec.sessionNumber !== undefined) {
      item.sessionNumber = rec.sessionNumber;
    }
    if (rec.priorityLabel === "CURRICULUM_PROGRESS" && rec.label) {
      item.sessionTitle = rec.label;
    }

    return item;
  });

  const streakContext =
    currentStreak >= STREAK_MILESTONE
      ? `Keep your ${currentStreak}-day streak going!`
      : undefined;

  return {
    actions,
    nextSessionReady: nextSessionNumber !== null,
    streakContext,
    generatedAt: new Date().toISOString(),
  };
}
