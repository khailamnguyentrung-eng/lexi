/**
 * LEXI Lens — Strengths transformer.
 *
 * Derives what is working well for the learner from StudentLearningProfile v3.
 * Pure — no DB access, no AI, no new inference rules.
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { StudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import { mapConfidenceTier } from "./types";
import type { StrengthItem, Strengths } from "./types";

const MAX_STRENGTHS = 8;
const MAX_STRONG_SKILLS = 3;

// ─────────────────────────────────────────────────────────
// Public transformer
// ─────────────────────────────────────────────────────────

/**
 * Derive strength items from a StudentLearningProfile v3.
 *
 * Sources:
 *   - knowledgeState.masteredConcepts  — MASTERED topics (omitted if OBSERVED confidence)
 *   - knowledgeState.developingConcepts — IMPROVING/STABLE topics (always shown)
 *   - performanceState.skillPerformance — STRONG skills (≥75%) if EMERGING or CONFIRMED
 *   - learningBehaviorState.paceObservation — ACCELERATING pace if present
 *
 * No new inference — only narrates values already present in the profile.
 */
export function deriveStrengths(profile: StudentLearningProfile): Strengths {
  const { learnerModel } = profile;
  const { knowledgeState, performanceState, learningBehaviorState } = learnerModel;

  const knowledgeTier = knowledgeState.confidenceTier;
  const perfTier = performanceState.confidenceTier;
  const behaviorTier = learningBehaviorState.confidenceTier;
  const isKnowledgeObserved = knowledgeTier === ConfidenceTier.OBSERVED;
  const isPerfObserved = perfTier === ConfidenceTier.OBSERVED;

  const items: StrengthItem[] = [];

  // 1. Mastered topics — omit if knowledge confidence is too low
  if (!isKnowledgeObserved) {
    const masteredList = knowledgeState.masteredConcepts.slice(0, 5);
    for (const concept of masteredList) {
      items.push({
        type: "MASTERED_TOPIC",
        label: concept.label,
        detail: "You've mastered this topic.",
        confidence: mapConfidenceTier(knowledgeTier),
        confidenceTier: knowledgeTier,
        source: "learnerModel.knowledgeState.masteredConcepts",
      });
    }
    if (knowledgeState.masteredConcepts.length > 5) {
      // Summarise the overflow count as a single item
      const overflow = knowledgeState.masteredConcepts.length - 5;
      items.push({
        type: "MASTERED_TOPIC",
        label: `+${overflow} more mastered topics`,
        percentageOrCount: overflow,
        confidence: mapConfidenceTier(knowledgeTier),
        confidenceTier: knowledgeTier,
        source: "learnerModel.knowledgeState.masteredConcepts",
      });
    }
  }

  // 2. Developing topics (IMPROVING or STABLE) — always shown
  const developing = knowledgeState.developingConcepts;
  if (developing.length > 0) {
    items.push({
      type: "DEVELOPING_TOPIC",
      label: `Making progress on ${developing.length} topic${developing.length !== 1 ? "s" : ""}`,
      detail: developing.slice(0, 3).map((c) => c.label).join(", "),
      percentageOrCount: developing.length,
      confidence: mapConfidenceTier(knowledgeTier),
      confidenceTier: knowledgeTier,
      source: "learnerModel.knowledgeState.developingConcepts",
    });
  }

  // 3. Strong skills (tier = "STRONG", ≥75%) — only if performance confidence is EMERGING+
  if (!isPerfObserved) {
    const strongSkills = performanceState.skillPerformance
      .filter((s) => s.tier === "STRONG")
      .slice(0, MAX_STRONG_SKILLS);

    for (const skill of strongSkills) {
      items.push({
        type: "STRONG_SKILL",
        label: `Strong in ${skill.label}`,
        detail: `${Math.round(skill.percentage)}% accuracy`,
        percentageOrCount: skill.percentage,
        confidence: mapConfidenceTier(perfTier),
        confidenceTier: perfTier,
        source: "learnerModel.performanceState.skillPerformance",
      });
    }
  }

  // Pacing: no ACCELERATING value exists in current PaceProfile type (CONSISTENT | DECLINING | VARIABLE).
  // Pacing momentum strength is deferred until the pace engine adds a positive-trend value.

  const confidenceNote = isKnowledgeObserved
    ? "These are early observations based on limited data."
    : undefined;

  return {
    strengths: items.slice(0, MAX_STRENGTHS),
    generatedAt: new Date().toISOString(),
    confidenceNote,
  };
}
