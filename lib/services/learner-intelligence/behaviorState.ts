/**
 * Learning Behavior State Engine — Phase 5.2
 *
 * Pure deterministic engine. No Prisma. No AI. No DB access.
 * No personality interpretation. No motivation inference.
 *
 * Transforms an existing BehaviorProfile (computed by M2.2) into a structured
 * LearningBehaviorState snapshot covering session patterns, completion behavior,
 * pace, response time, and engagement signals.
 *
 * All output fields describe observed actions only:
 *   Allowed:   "Completed 12 sessions" / "Prefers evening sessions"
 *   Forbidden: "Highly motivated" / "Consistent personality"
 *
 * Confidence rules (inherited from BehaviorProfile.confidenceTier):
 *   OBSERVED  — < 5 sessions (too little data; all pattern fields may be null)
 *   EMERGING  — 5–9 sessions (patterns visible, not yet stable)
 *   CONFIRMED — 10+ sessions (sufficient data for reliable observation)
 */

import type { BehaviorProfile } from "@/lib/analytics/behaviorEngine";
import type {
  EngagementLevel,
  LearningBehaviorState,
} from "./types";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const HIGHLY_ACTIVE_THRESHOLD = 20;
const ACTIVE_THRESHOLD = 10;
const OCCASIONAL_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function deriveEngagementLevel(sessionCount: number): EngagementLevel {
  if (sessionCount >= HIGHLY_ACTIVE_THRESHOLD) return "HIGHLY_ACTIVE";
  if (sessionCount >= ACTIVE_THRESHOLD) return "ACTIVE";
  if (sessionCount >= OCCASIONAL_THRESHOLD) return "OCCASIONAL";
  return "INACTIVE";
}

// ─────────────────────────────────────────────────────────
// Pure engine
// ─────────────────────────────────────────────────────────

/**
 * Compute learning behavior state from a pre-fetched BehaviorProfile.
 * Pure — no DB access. All input is fetched by the caller.
 *
 * The function restructures BehaviorProfile fields into the five behavior
 * dimensions defined by the Phase 5 learner model design, adding only the
 * EngagementLevel derivation (count-based classification) on top.
 *
 * Null fields in the output indicate insufficient data, not absence of behavior.
 * A null preferredTimeOfDay means fewer than 5 sessions with timing data —
 * it does not mean the student has no time preference.
 */
export function computeLearningBehaviorState(
  behaviorProfile: BehaviorProfile,
): LearningBehaviorState {
  return {
    sessionPattern: {
      sessionCount: behaviorProfile.sessionCount,
      avgSessionDurationMin: behaviorProfile.avgSessionDurationMin,
      preferredTimeOfDay: behaviorProfile.preferredTimeOfDay,
    },
    completionBehavior: {
      completedSessionCount: behaviorProfile.sessionCount,
    },
    paceObservation: {
      paceProfile: behaviorProfile.paceProfile,
    },
    retryBehavior: {
      responseTimeSignal: behaviorProfile.responseTimeSignal,
    },
    engagementObservation: {
      engagementLevel: deriveEngagementLevel(behaviorProfile.sessionCount),
      recentMoodContext: behaviorProfile.recentMoodContext,
    },
    confidenceTier: behaviorProfile.confidenceTier,
    computedAt: new Date().toISOString(),
  };
}
