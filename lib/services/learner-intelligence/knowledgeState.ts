/**
 * Knowledge State Engine — Phase 5.1
 *
 * Pure deterministic engine. No Prisma. No AI. No DB access.
 *
 * Transforms mastery profiles, active weaknesses, and learning signals
 * into a structured KnowledgeState snapshot.
 *
 * Confidence rules:
 *   OBSERVED  — fewer than 3 notebook topics (too little data)
 *   EMERGING  — 3–9 topics, OR fewer than 3 topics with 2+ behavioral signals
 *   CONFIRMED — 10+ topics (rich, stable data picture)
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { TopicMasteryProfile } from "@/lib/analytics/masteryTracking";
import type { ActiveWeakness } from "@/lib/analytics/studentLearningProfile";
import type { LearningSignal } from "@/lib/analytics/learningSignalEngine";
import type { ConceptEntry, KnowledgeState } from "./types";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const CONFIRMED_TOPIC_THRESHOLD = 10;
const EMERGING_TOPIC_THRESHOLD = 3;
const SIGNAL_BOOST_THRESHOLD = 2; // signals that indicate observed behavior

// Signal types that confirm the engine has real behavioral data to work from.
// Presence of these signals means the learner has enough practice history
// to elevate confidence above OBSERVED even with few notebook topics.
const BEHAVIORAL_SIGNAL_TYPES = new Set([
  "RECURRING_WEAKNESS",
  "RETENTION_RISK",
  "TOPIC_IMPROVING",
  "TOPIC_MASTERED",
]);

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function deriveConfidenceTier(
  topicCount: number,
  behavioralSignalCount: number,
): ConfidenceTier {
  if (topicCount >= CONFIRMED_TOPIC_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (
    topicCount >= EMERGING_TOPIC_THRESHOLD ||
    behavioralSignalCount >= SIGNAL_BOOST_THRESHOLD
  ) {
    return ConfidenceTier.EMERGING;
  }
  return ConfidenceTier.OBSERVED;
}

// ─────────────────────────────────────────────────────────
// Pure engine
// ─────────────────────────────────────────────────────────

/**
 * Compute knowledge state from pre-fetched mastery and signal data.
 * Pure — no DB access. All input is fetched by the caller.
 *
 * Concept buckets:
 *   masteredConcepts   — MASTERED state (full learning loop complete)
 *   developingConcepts — IMPROVING or STABLE (actively progressing)
 *   weakConcepts       — NEEDS_REVIEW (require attention), priority-ordered:
 *                        remedial-flagged topics first, then by occurrence count desc
 *
 * Confidence tier reflects data richness, not concept quality:
 *   OBSERVED  — snapshot drawn from very little data; treat with caution
 *   EMERGING  — moderate data; reliable for general guidance
 *   CONFIRMED — rich data; snapshot is stable and trustworthy
 */
export function computeKnowledgeState(
  masteryProfiles: TopicMasteryProfile[],
  activeWeaknesses: ActiveWeakness[],
  signals: LearningSignal[],
): KnowledgeState {
  const remedialTopics = new Set(
    activeWeaknesses.filter((w) => w.isRemedialFlagged).map((w) => w.topic),
  );

  const masteredConcepts: ConceptEntry[] = masteryProfiles
    .filter((p) => p.masteryState === "MASTERED")
    .map((p) => ({ topic: p.topic, label: p.label, masteryState: p.masteryState }));

  const developingConcepts: ConceptEntry[] = masteryProfiles
    .filter(
      (p) => p.masteryState === "IMPROVING" || p.masteryState === "STABLE",
    )
    .map((p) => ({ topic: p.topic, label: p.label, masteryState: p.masteryState }));

  // Weak concepts: remedial-flagged first, then by occurrence count descending.
  // This matches the priority ordering used in buildActiveWeaknesses() so the
  // most urgent topics surface at the top of the list.
  const weakRaw = masteryProfiles.filter((p) => p.masteryState === "NEEDS_REVIEW");
  weakRaw.sort((a, b) => {
    const aRemedial = remedialTopics.has(a.topic) ? 1 : 0;
    const bRemedial = remedialTopics.has(b.topic) ? 1 : 0;
    if (aRemedial !== bRemedial) return bRemedial - aRemedial;
    return b.summary.totalOccurrences - a.summary.totalOccurrences;
  });
  const weakConcepts: ConceptEntry[] = weakRaw.map((p) => ({
    topic: p.topic,
    label: p.label,
    masteryState: p.masteryState,
  }));

  const topicCount = masteryProfiles.length;
  const behavioralSignalCount = signals.filter((s) =>
    BEHAVIORAL_SIGNAL_TYPES.has(s.type),
  ).length;
  const confidenceTier = deriveConfidenceTier(topicCount, behavioralSignalCount);

  return {
    masteredConcepts,
    developingConcepts,
    weakConcepts,
    confidenceTier,
    topicCount,
    computedAt: new Date().toISOString(),
  };
}
