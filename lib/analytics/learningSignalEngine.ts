/**
 * Learning Signal Engine — M2.4
 *
 * Derives typed, structured learning signals from StudentLearningProfile data.
 * All signals are deterministic observations — no AI, no schema changes, no new DB queries.
 *
 * Architecture:
 *   StudentLearningProfile + currentStreak → computeLearningSignals() → LearningSignal[]
 *
 * The pure engine has no Prisma access. getLearningSignals() pre-fetches all input.
 */

import { getStudentLearningProfile } from "./studentLearningProfile";
import type { StudentLearningProfile } from "./studentLearningProfile";
import { getLearningStreak } from "@/lib/services/streak";
import { ConfidenceTier } from "./types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type SignalType =
  | "FIRST_MASTERY"
  | "TOPIC_MASTERED"
  | "TOPIC_IMPROVING"
  | "RECURRING_WEAKNESS"
  | "RETENTION_RISK"
  | "LEARNING_MOMENTUM"
  | "PACE_OBSERVATION"
  | "STREAK_MILESTONE";

// How urgent or notable is this signal?
// CRITICAL is reserved for future use (e.g. exam < 7 days + NEEDS_ATTENTION).
export type SignalSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// How reliable is the data behind this signal?
export type SignalConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface SignalEvidence {
  occurrenceCount?: number;  // times topic appeared in notebook (RECURRING_WEAKNESS, TOPIC_IMPROVING)
  dueCount?: number;         // SM-2 entries currently overdue (RETENTION_RISK)
  masteredCount?: number;    // total mastered topics (FIRST_MASTERY, TOPIC_MASTERED)
  improvingCount?: number;   // topics currently IMPROVING (TOPIC_IMPROVING — unused, reserved)
  currentStreak?: number;    // consecutive active days (STREAK_MILESTONE)
  sessionsAnalyzed?: number; // sessions observed for behavioral signals
}

export interface LearningSignal {
  type: SignalType;
  severity: SignalSeverity;
  topic: string | null;      // canonical topic key, or null for global / label-only signals
  topicLabel: string | null; // human-readable display label
  evidence: SignalEvidence;
  confidence: SignalConfidence;
  generatedAt: string;       // ISO timestamp when computeLearningSignals() ran
  suppressionKey: string;    // unique key for deduplication — same key not shown twice within N sessions
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const SIGNAL_CAP = 5;
const STREAK_MILESTONES: ReadonlySet<number> = new Set([3, 7, 14, 30]);
const SEVERITY_ORDER: Record<SignalSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function confidenceFromTier(tier: ConfidenceTier): SignalConfidence {
  if (tier === ConfidenceTier.CONFIRMED) return "HIGH";
  if (tier === ConfidenceTier.EMERGING) return "MEDIUM";
  return "LOW";
}

function confidenceFromOccurrences(count: number): SignalConfidence {
  if (count >= 5) return "HIGH";
  if (count >= 3) return "MEDIUM";
  return "LOW";
}

// ─────────────────────────────────────────────────────────
// Signal derivation helpers (private)
// ─────────────────────────────────────────────────────────

function deriveFirstMasterySignal(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal | null {
  if (profile.masterySummary.masteredTopics.length !== 1) return null;
  return {
    type: "FIRST_MASTERY",
    severity: "HIGH",
    topic: null,
    topicLabel: profile.masterySummary.masteredTopics[0],
    evidence: { masteredCount: 1 },
    confidence: "HIGH",
    generatedAt: ts,
    suppressionKey: "FIRST_MASTERY",
  };
}

function deriveMasteredSignals(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal[] {
  // Exactly 1 mastered topic → FIRST_MASTERY handles it, avoid duplication
  if (profile.masterySummary.masteredTopics.length <= 1) return [];
  const total = profile.masterySummary.masteredTopics.length;
  return profile.masterySummary.masteredTopics.map((label) => ({
    type: "TOPIC_MASTERED" as const,
    severity: "MEDIUM" as const,
    // masterySummary.masteredTopics contains display labels, not topic keys.
    // topic: null signals the absence of a canonical key at this layer.
    topic: null,
    topicLabel: label,
    evidence: { masteredCount: total },
    confidence: "HIGH" as const,
    generatedAt: ts,
    suppressionKey: `TOPIC_MASTERED_${label}`,
  }));
}

function deriveImprovingSignals(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal[] {
  // improvingTopics includes IMPROVING and STABLE; signal only fires for IMPROVING
  return profile.improvingTopics
    .filter((p) => p.masteryState === "IMPROVING")
    .map((p) => ({
      type: "TOPIC_IMPROVING" as const,
      severity: "MEDIUM" as const,
      topic: p.topic,
      topicLabel: p.label,
      evidence: { occurrenceCount: p.summary.totalOccurrences },
      confidence: confidenceFromOccurrences(p.summary.totalOccurrences),
      generatedAt: ts,
      suppressionKey: `TOPIC_IMPROVING_${p.topic}`,
    }));
}

function deriveRecurringWeaknessSignals(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal[] {
  return profile.activeWeaknesses
    .filter((w) => w.signal === "RECURRING" && w.totalOccurrences >= 3)
    .map((w) => ({
      type: "RECURRING_WEAKNESS" as const,
      severity: "HIGH" as const,
      topic: w.topic,
      topicLabel: w.label,
      evidence: { occurrenceCount: w.totalOccurrences },
      confidence: confidenceFromOccurrences(w.totalOccurrences),
      generatedAt: ts,
      suppressionKey: `RECURRING_WEAKNESS_${w.topic}`,
    }));
}

function deriveRetentionRiskSignals(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal[] {
  // RECURRING topics are already captured by deriveRecurringWeaknessSignals;
  // RETENTION_RISK targets topics that are due for review but not yet chronic.
  return profile.activeWeaknesses
    .filter((w) => w.dueCount > 0 && w.signal !== "RECURRING")
    .map((w) => {
      const confidence: SignalConfidence =
        w.dueCount >= 3 ? "HIGH" : w.dueCount === 2 ? "MEDIUM" : "LOW";
      return {
        type: "RETENTION_RISK" as const,
        severity: "MEDIUM" as const,
        topic: w.topic,
        topicLabel: w.label,
        evidence: { dueCount: w.dueCount },
        confidence,
        generatedAt: ts,
        suppressionKey: `RETENTION_RISK_${w.topic}`,
      };
    });
}

function deriveLearningMomentumSignal(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal | null {
  if (profile.learningTrend !== "PROGRESSING") return null;
  return {
    type: "LEARNING_MOMENTUM",
    severity: "MEDIUM",
    topic: null,
    topicLabel: null,
    evidence: { sessionsAnalyzed: profile.behaviorProfile.sessionCount },
    confidence: confidenceFromTier(profile.behaviorProfile.confidenceTier),
    generatedAt: ts,
    suppressionKey: "LEARNING_MOMENTUM",
  };
}

function derivePaceObservationSignal(
  profile: StudentLearningProfile,
  ts: string
): LearningSignal | null {
  const bp = profile.behaviorProfile;
  if (bp.paceProfile !== "DECLINING" || bp.sessionCount < 3) return null;
  return {
    type: "PACE_OBSERVATION",
    severity: "LOW",
    topic: null,
    topicLabel: null,
    evidence: { sessionsAnalyzed: bp.sessionCount },
    confidence: "LOW",
    generatedAt: ts,
    suppressionKey: "PACE_OBSERVATION",
  };
}

function deriveStreakMilestoneSignal(
  currentStreak: number,
  ts: string
): LearningSignal | null {
  if (!STREAK_MILESTONES.has(currentStreak)) return null;
  return {
    type: "STREAK_MILESTONE",
    severity: "MEDIUM",
    topic: null,
    topicLabel: null,
    evidence: { currentStreak },
    confidence: "HIGH",
    generatedAt: ts,
    suppressionKey: `STREAK_MILESTONE_${currentStreak}`,
  };
}

// ─────────────────────────────────────────────────────────
// Pure engine
// ─────────────────────────────────────────────────────────

/**
 * Compute learning signals from a pre-fetched student profile and streak count.
 * Pure — no DB access. All input is fetched by the caller.
 *
 * Returns signals sorted by severity DESC (HIGH before MEDIUM before LOW).
 * Within the same severity, topic-specific signals appear before global ones.
 * Result is capped at SIGNAL_CAP (5) to prevent signal flooding.
 */
export function computeLearningSignals(
  profile: StudentLearningProfile,
  currentStreak: number
): LearningSignal[] {
  const ts = new Date().toISOString();
  const candidates: LearningSignal[] = [];

  const firstMastery = deriveFirstMasterySignal(profile, ts);
  if (firstMastery) candidates.push(firstMastery);

  candidates.push(...deriveMasteredSignals(profile, ts));
  candidates.push(...deriveImprovingSignals(profile, ts));
  candidates.push(...deriveRecurringWeaknessSignals(profile, ts));
  candidates.push(...deriveRetentionRiskSignals(profile, ts));

  const momentum = deriveLearningMomentumSignal(profile, ts);
  if (momentum) candidates.push(momentum);

  const pace = derivePaceObservationSignal(profile, ts);
  if (pace) candidates.push(pace);

  const streak = deriveStreakMilestoneSignal(currentStreak, ts);
  if (streak) candidates.push(streak);

  candidates.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sevDiff !== 0) return sevDiff;
    // At equal severity: topic-specific signals before global (null topic)
    if (a.topic !== null && b.topic === null) return -1;
    if (a.topic === null && b.topic !== null) return 1;
    return 0;
  });

  return candidates.slice(0, SIGNAL_CAP);
}

// ─────────────────────────────────────────────────────────
// Service function
// ─────────────────────────────────────────────────────────

/**
 * Fetch and compute learning signals for a user.
 *
 * Pre-fetches StudentLearningProfile (includes BehaviorProfile from M2.2)
 * and the current learning streak in parallel, then delegates to the pure engine.
 *
 * Note: StudentLearningProfile is not modified in M2.4. Signals are available via
 * this standalone function until M2.5 wires them into the profile.
 */
export async function getLearningSignals(userId: string): Promise<LearningSignal[]> {
  const [profile, streak] = await Promise.all([
    getStudentLearningProfile(userId),
    getLearningStreak(userId),
  ]);
  return computeLearningSignals(profile, streak);
}
