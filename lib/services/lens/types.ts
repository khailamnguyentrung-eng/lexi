/**
 * LEXI Lens — Phase 6.1 — Presentation output contracts.
 *
 * Pure types and confidence-mapping utilities for the Lens layer.
 * No inference, no DB access, no AI. Lens only transforms StudentLearningProfile v3.
 */

import { ConfidenceTier } from "@/lib/analytics/types";

export { ConfidenceTier };

// ─────────────────────────────────────────────────────────
// Confidence mapping
// ─────────────────────────────────────────────────────────

/**
 * User-facing confidence level derived from a ConfidenceTier.
 * Maps the internal three-tier system to a simple LOW / MEDIUM / HIGH string
 * suitable for UI display (icon, label, or conditional wording).
 */
export type LensConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Map a ConfidenceTier enum value → LensConfidence string. */
export function mapConfidenceTier(tier: ConfidenceTier): LensConfidence {
  if (tier === ConfidenceTier.CONFIRMED) return "HIGH";
  if (tier === ConfidenceTier.EMERGING) return "MEDIUM";
  return "LOW";
}

/**
 * Map a signal-level confidence string ("HIGH" | "MEDIUM" | "LOW")
 * back to a ConfidenceTier for items sourced from LearningSignal.
 */
export function mapSignalConfidence(
  confidence: "HIGH" | "MEDIUM" | "LOW"
): ConfidenceTier {
  if (confidence === "HIGH") return ConfidenceTier.CONFIRMED;
  if (confidence === "MEDIUM") return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

/**
 * Map a recommendation confidence string back to ConfidenceTier.
 */
export function mapRecommendationConfidence(
  confidence: "HIGH" | "MEDIUM" | "LOW"
): ConfidenceTier {
  if (confidence === "HIGH") return ConfidenceTier.CONFIRMED;
  if (confidence === "MEDIUM") return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

// ─────────────────────────────────────────────────────────
// 3.1 Learner Summary
// ─────────────────────────────────────────────────────────

/**
 * A single coherent snapshot of who this learner is right now.
 *
 * narrative         — full plain-language summary (1–4 sentences)
 * engagementLevel   — raw engagement classification from learningBehaviorState
 * masteredCount     — topics at MASTERED state
 * developingCount   — topics at IMPROVING or STABLE state
 * weakCount         — topics at NEEDS_REVIEW state
 * streakDays        — current consecutive practice days
 * topicCount        — total active notebook topics
 * trendIndicator    — overall learning trajectory
 * confidenceLevel   — LOW / MEDIUM / HIGH mapped from knowledgeState.confidenceTier
 * confidenceTier    — raw ConfidenceTier from knowledgeState (for traceability)
 * source            — field path in StudentLearningProfile this was derived from
 */
export interface LearnerSummary {
  narrative: string;
  engagementLevel: string;
  masteredCount: number;
  developingCount: number;
  weakCount: number;
  streakDays: number;
  topicCount: number;
  trendIndicator: "PROGRESSING" | "STABLE" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA";
  confidenceLevel: LensConfidence;
  confidenceTier: ConfidenceTier;
  source: string;
}

// ─────────────────────────────────────────────────────────
// 3.2 Learning Insights
// ─────────────────────────────────────────────────────────

/**
 * A single learning insight — one key observation from the learner's data.
 *
 * type          — which aspect of learning this insight describes
 * narrative     — plain-language observation (1–2 sentences)
 * evidence      — optional quantitative evidence supporting the narrative
 * confidence    — LOW / MEDIUM / HIGH mapped from the underlying engine tier
 * confidenceTier — raw ConfidenceTier from the source engine
 * source        — field path in StudentLearningProfile this was derived from
 */
export interface LearningInsight {
  type: "PRIMARY_SIGNAL" | "ACCURACY_TREND" | "CONSISTENCY" | "RECOVERY";
  narrative: string;
  evidence?: {
    signalType?: string;
    accuracyChange?: number;
    attempts?: number;
    streakDays?: number;
  };
  confidence: LensConfidence;
  confidenceTier: ConfidenceTier;
  source: string;
}

export interface LearningInsights {
  insights: LearningInsight[];
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────
// 3.3 Strengths
// ─────────────────────────────────────────────────────────

/**
 * A single strength item — one area where the learner is progressing.
 *
 * type              — category of strength
 * label             — display label (topic label, skill label, or descriptive phrase)
 * detail            — optional supporting detail
 * percentageOrCount — accuracy % for skills, or topic count for developing/mastered groups
 * confidence        — LOW / MEDIUM / HIGH from the source engine
 * confidenceTier    — raw ConfidenceTier from the source engine
 * source            — field path in StudentLearningProfile
 */
export interface StrengthItem {
  type: "MASTERED_TOPIC" | "DEVELOPING_TOPIC" | "STRONG_SKILL" | "PACING_MOMENTUM";
  label: string;
  detail?: string;
  percentageOrCount?: number;
  confidence: LensConfidence;
  confidenceTier: ConfidenceTier;
  source: string;
}

export interface Strengths {
  strengths: StrengthItem[];
  generatedAt: string;
  confidenceNote?: string;
}

// ─────────────────────────────────────────────────────────
// 3.4 Challenges
// ─────────────────────────────────────────────────────────

/**
 * A single challenge item — one area that needs attention.
 *
 * type           — category of challenge
 * label          — display label
 * reason         — plain-language description of why this is a challenge
 * signal         — improvement signal for active weakness items (RECURRING | IMPROVING | STABLE)
 * dueNow         — true if this topic has entries due for SM-2 review
 * relatedTopics  — topic labels related to a weak skill
 * actionHint     — optional suggested next step
 * confidence     — LOW / MEDIUM / HIGH from the source engine
 * confidenceTier — raw ConfidenceTier from the source engine
 * source         — field path in StudentLearningProfile
 */
export interface ChallengeItem {
  type: "ACTIVE_WEAKNESS" | "WEAK_SKILL" | "HELP_SEEKING_GAP" | "ERROR_PATTERN";
  label: string;
  reason: string;
  signal?: string;
  dueNow?: boolean;
  relatedTopics?: string[];
  actionHint?: string;
  confidence: LensConfidence;
  confidenceTier: ConfidenceTier;
  source: string;
}

export interface Challenges {
  challenges: ChallengeItem[];
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────
// 3.5 Recommended Actions
// ─────────────────────────────────────────────────────────

/**
 * A single recommended action — one concrete next step for the learner.
 *
 * priority       — 1 (highest) to 4 (lowest)
 * topic          — canonical topic key
 * label          — display label
 * reason         — why this action is recommended
 * suggestedAction — REVIEW_NOTEBOOK | PRACTICE_TOPIC | ADVANCE_SESSION
 * questionCount  — available questions for practice actions
 * sessionNumber  — curriculum session number for session advancement
 * sessionTitle   — session display title for session advancement
 * confidence     — LOW / MEDIUM / HIGH inherited from PracticeRecommendation.confidence
 * confidenceTier — raw ConfidenceTier derived from recommendation confidence
 * source         — field path in StudentLearningProfile
 */
export interface RecommendationItem {
  priority: 1 | 2 | 3 | 4;
  topic: string;
  label: string;
  reason: string;
  suggestedAction: string;
  questionCount?: number;
  sessionNumber?: number;
  sessionTitle?: string;
  confidence: LensConfidence;
  confidenceTier: ConfidenceTier;
  source: string;
}

export interface RecommendedActions {
  actions: RecommendationItem[];
  nextSessionReady: boolean;
  streakContext?: string;
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────
// Full Lens View
// ─────────────────────────────────────────────────────────

/**
 * The complete assembled Lens view — all five presentation layers combined.
 * Produced by assembling each layer from a single StudentLearningProfile v3.
 */
export interface LensViewModel {
  summary: LearnerSummary;
  insights: LearningInsights;
  strengths: Strengths;
  challenges: Challenges;
  recommendations: RecommendedActions;
  generatedAt: string;
}
