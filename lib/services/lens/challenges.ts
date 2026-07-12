/**
 * LEXI Lens — Challenges transformer.
 *
 * Derives what needs attention for the learner from StudentLearningProfile v3.
 * Pure — no DB access, no AI, no new inference rules.
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { StudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import { mapConfidenceTier } from "./types";
import type { ChallengeItem, Challenges } from "./types";

const MAX_CHALLENGES = 7;
const MAX_WEAK_SKILLS = 3;

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function signalReason(
  signal: string,
  dueCount: number,
  isRemedialFlagged: boolean
): string {
  const parts: string[] = [];

  switch (signal) {
    case "RECURRING":
      parts.push("You've reviewed this but mistakes continue.");
      break;
    case "IMPROVING":
      parts.push("Still working on this — recent progress shows improvement.");
      break;
    case "STABLE":
      parts.push("No clear progress yet — may need a fresh approach.");
      break;
    default:
      parts.push("Needs attention.");
  }

  if (dueCount > 0) parts.push("Due for review now.");
  if (isRemedialFlagged) parts.push("You've flagged this for extra help.");

  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────
// Public transformer
// ─────────────────────────────────────────────────────────

/**
 * Derive challenge items from a StudentLearningProfile v3.
 *
 * Sources:
 *   - activeWeaknesses          — RECURRING or NEEDS_REVIEW topics (from notebook)
 *   - performanceState          — WEAK skills (<50%)
 *   - problemSolvingState       — LOW_ENGAGEMENT help seeking and ERRORS_PERSISTING correction
 *
 * Rules:
 *   - Skip activeWeaknesses with signal = "IMPROVED" (those belong in Strengths)
 *   - Cap active weaknesses at 5, weak skills at 3
 *   - Help-seeking gap: only if LOW_ENGAGEMENT and recurring weaknesses present
 *   - Error pattern: only if ERRORS_PERSISTING
 *   - Max 7 challenge items total
 *
 * No new inference — only narrates values already present in the profile.
 */
export function deriveChallenges(profile: StudentLearningProfile): Challenges {
  const { learnerModel, activeWeaknesses } = profile;
  const { performanceState, problemSolvingState, knowledgeState } = learnerModel;

  const knowledgeTier = knowledgeState.confidenceTier;
  const perfTier = performanceState.confidenceTier;
  const problemTier = problemSolvingState.confidenceTier;
  const problemPrefix = problemTier === ConfidenceTier.OBSERVED ? "Early sign: " : "";

  const items: ChallengeItem[] = [];

  // 1. Active weakness topics (from notebook, capped at 5)
  const relevantWeaknesses = activeWeaknesses.filter((w) => w.signal !== "IMPROVED");
  for (const w of relevantWeaknesses.slice(0, 5)) {
    items.push({
      type: "ACTIVE_WEAKNESS",
      label: w.label,
      reason: signalReason(w.signal, w.dueCount, w.isRemedialFlagged),
      signal: w.signal,
      dueNow: w.dueCount > 0,
      confidence: mapConfidenceTier(knowledgeTier),
      confidenceTier: knowledgeTier,
      source: "activeWeaknesses",
    });
  }

  // 2. Weak skills (tier = "WEAK", <50%) — capped at 3
  const weakSkills = performanceState.skillPerformance
    .filter((s) => s.tier === "WEAK")
    .slice(0, MAX_WEAK_SKILLS);

  for (const skill of weakSkills) {
    items.push({
      type: "WEAK_SKILL",
      label: `Weak in ${skill.label}`,
      reason: `Your accuracy in ${skill.label} is ${Math.round(skill.percentage)}%. Practice this skill to improve.`,
      confidence: mapConfidenceTier(perfTier),
      confidenceTier: perfTier,
      source: "learnerModel.performanceState.skillPerformance",
    });
  }

  // 3. Help-seeking gap (only if LOW_ENGAGEMENT and there are recurring weaknesses)
  const helpSeeking = problemSolvingState.helpSeeking;
  const recurringCount = activeWeaknesses.filter((w) => w.signal === "RECURRING").length;
  if (helpSeeking.value === "LOW_ENGAGEMENT" && recurringCount > 0) {
    items.push({
      type: "HELP_SEEKING_GAP",
      label: "Low engagement with remediation",
      reason: `${problemPrefix}You haven't flagged topics for extra help, even though ${recurringCount} topic${recurringCount !== 1 ? "s" : ""} show recurring mistakes.`,
      actionHint: "Try reviewing the error notebook and marking topics for remediation.",
      confidence: mapConfidenceTier(problemTier),
      confidenceTier: problemTier,
      source: "learnerModel.problemSolvingState.helpSeeking",
    });
  }

  // 4. Error pattern (only if ERRORS_PERSISTING)
  const errorCorrection = problemSolvingState.errorCorrection;
  if (errorCorrection.value === "ERRORS_PERSISTING") {
    items.push({
      type: "ERROR_PATTERN",
      label: "Errors not decreasing",
      reason: `${problemPrefix}Recorded errors are not decreasing. You're reviewing but not resolving the mistakes.`,
      actionHint:
        "This usually means the explanation needs to be different, or the topic needs more examples.",
      confidence: mapConfidenceTier(problemTier),
      confidenceTier: problemTier,
      source: "learnerModel.problemSolvingState.errorCorrection",
    });
  }

  return {
    challenges: items.slice(0, MAX_CHALLENGES),
    generatedAt: new Date().toISOString(),
  };
}
