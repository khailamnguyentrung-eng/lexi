/**
 * Shared pure types for the learner intelligence layer (Phase 5).
 *
 * These types define the input and output contracts for knowledge state,
 * performance state, and learning behavior state engines.
 * No Prisma. No AI. No DB access.
 *
 * Import hierarchy:
 *   Engines (knowledgeState, performanceState, behaviorState) import from here.
 *   Consumers (services, API routes) import engine outputs from here.
 *   StudentLearningProfile does NOT import from here — it is a snapshot
 *   contract that must remain decoupled from intelligence containers.
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { TopicMasteryProfile } from "@/lib/analytics/masteryTracking";
import type { ActiveWeakness } from "@/lib/analytics/studentLearningProfile";
import type { LearningSignal } from "@/lib/analytics/learningSignalEngine";
import type {
  BehaviorProfile,
  SessionTimeOfDay,
  PaceProfile,
  ResponseTimeSignal,
  MoodContext,
} from "@/lib/analytics/behaviorEngine";

export { ConfidenceTier };
export type { BehaviorProfile, SessionTimeOfDay, PaceProfile, ResponseTimeSignal, MoodContext };
export type { ActiveWeakness };

// ─────────────────────────────────────────────────────────
// Knowledge State
// ─────────────────────────────────────────────────────────

/**
 * A single concept entry in the knowledge state snapshot.
 * Derived from TopicMasteryProfile — no additional data needed.
 */
export interface ConceptEntry {
  topic: string;
  label: string;
  masteryState: "NEEDS_REVIEW" | "IMPROVING" | "STABLE" | "MASTERED";
}

/**
 * Pre-fetched input for computeKnowledgeState().
 * All data must come from the caller — no DB access inside the engine.
 */
export interface KnowledgeStateInput {
  masteryProfiles: TopicMasteryProfile[];
  activeWeaknesses: ActiveWeakness[];
  signals: LearningSignal[];
}

/**
 * Snapshot of the student's current knowledge landscape.
 *
 * masteredConcepts  — topics at MASTERED state (completed learning loop)
 * developingConcepts — topics at IMPROVING or STABLE (progressing)
 * weakConcepts       — topics at NEEDS_REVIEW (require attention), priority-ordered
 * confidenceTier     — reliability of this snapshot based on data richness
 * topicCount         — total active notebook topics at snapshot time
 */
export interface KnowledgeState {
  masteredConcepts: ConceptEntry[];
  developingConcepts: ConceptEntry[];
  weakConcepts: ConceptEntry[];
  confidenceTier: ConfidenceTier;
  topicCount: number;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────
// Performance State
// ─────────────────────────────────────────────────────────

export type AccuracyTrend =
  | "IMPROVING"
  | "STABLE"
  | "DECLINING"
  | "INSUFFICIENT_DATA";

export type ConsistencyProfile = "CONSISTENT" | "VARIABLE" | "ERRATIC";

/**
 * A single attempt record — the minimum shape needed by the performance engine.
 * Callers map QuestionAttempt rows to this shape before calling the engine.
 */
export interface AttemptRecord {
  isCorrect: boolean;
  attemptedAt: string; // ISO date string
}

/**
 * Per-skill accuracy snapshot passed into the performance engine.
 * Callers source this from SkillMatrixEntry rows or the skill matrix service.
 */
export interface SkillAccuracyInput {
  skill: string;
  label: string;
  percentage: number; // 0–100
  // False when there is no evidence for this skill yet (no SkillMatrixEntry).
  // The engine must not classify strength/weakness from a fabricated 0% —
  // absence is a distinct state, not a low value (LEXI_SYSTEM Ch.2 §2.7;
  // Constitution 5.2/5.10).
  hasData: boolean;
}

/**
 * Per-skill classification derived by the performance engine.
 *
 * tier:
 *   STRONG      — percentage >= 75
 *   DEVELOPING  — percentage >= 50
 *   WEAK        — percentage <  50
 *   NO_DATA     — no evidence yet; not a strength or weakness claim
 */
export interface SkillPerformance {
  skill: string;
  label: string;
  percentage: number;
  tier: "STRONG" | "DEVELOPING" | "WEAK" | "NO_DATA";
}

/**
 * Pre-fetched input for computePerformanceState().
 * All data must come from the caller — no DB access inside the engine.
 */
export interface PerformanceStateInput {
  attempts: AttemptRecord[];
  skillAccuracies: SkillAccuracyInput[];
}

/**
 * Snapshot of the student's recent performance characteristics.
 *
 * accuracyTrend       — direction of accuracy change over time
 * overallAccuracy     — percent correct across all attempts (0–100)
 * consistencyProfile  — how stable accuracy is across time windows
 * skillPerformance    — per-skill snapshot with strength tier
 * confidenceTier      — reliability of this snapshot based on attempt volume
 */
export interface PerformanceState {
  accuracyTrend: AccuracyTrend;
  overallAccuracy: number;
  consistencyProfile: ConsistencyProfile;
  skillPerformance: SkillPerformance[];
  confidenceTier: ConfidenceTier;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────
// Learning Behavior State
// ─────────────────────────────────────────────────────────

/**
 * Observable engagement level derived from total completed session count.
 *
 * HIGHLY_ACTIVE — 20+ sessions
 * ACTIVE        — 10–19 sessions
 * OCCASIONAL    — 3–9 sessions
 * INACTIVE      — 0–2 sessions
 *
 * This is a factual count-based classification, not a motivation judgement.
 */
export type EngagementLevel =
  | "HIGHLY_ACTIVE"
  | "ACTIVE"
  | "OCCASIONAL"
  | "INACTIVE";

/**
 * When and how long the student practices.
 * All fields pass through directly from BehaviorProfile — no new derivation.
 */
export interface SessionPatternObservation {
  sessionCount: number;
  avgSessionDurationMin: number | null; // null: no start/end timing recorded
  preferredTimeOfDay: SessionTimeOfDay | null; // null: fewer than 5 sessions with timing
}

/**
 * How often the student completes sessions.
 *
 * completedSessionCount: sourced from BehaviorProfile.sessionCount —
 * getBehaviorProfile() only fetches completed sessions, so the count
 * reflects completed sessions only.
 *
 * Note: abandonment rate (started-but-incomplete ÷ total started) requires
 * fetching UserSessionProgress with status IN_PROGRESS. Deferred to a future
 * milestone that extends BehaviorStateInput with that data.
 */
export interface CompletionBehaviorObservation {
  completedSessionCount: number;
}

/**
 * How the student's accuracy evolves within each session.
 * paceProfile null means fewer than 3 sessions with sufficient attempt data.
 */
export interface PaceObservation {
  paceProfile: PaceProfile | null;
}

/**
 * How quickly the student responds to questions.
 *
 * responseTimeSignal is a behavioral proxy for deliberateness:
 *   EXTENDED (≥30s median) — student takes longer per question
 *   MODERATE (10–29s)      — typical deliberation time
 *   BRIEF (<10s)           — very fast responses
 *
 * This describes response time only. No claim is made about effort,
 * confidence, or retry intent from this signal alone.
 * Direct retry rate (immediate re-attempt after wrong answer) requires
 * per-attempt retry tracking — deferred to a future milestone.
 */
export interface RetryBehaviorObservation {
  responseTimeSignal: ResponseTimeSignal | null; // null: fewer than 5 timed attempts
}

/**
 * Cross-session engagement signals.
 *
 * engagementLevel — count-based classification of total sessions
 * recentMoodContext — contextual mood signal from last ≤7 mood entries;
 *                    null means the student has not submitted mood entries
 */
export interface EngagementObservation {
  engagementLevel: EngagementLevel;
  recentMoodContext: MoodContext | null;
}

/**
 * Pre-fetched input for computeLearningBehaviorState().
 * All data must come from the caller — no DB access inside the engine.
 */
export interface BehaviorStateInput {
  behaviorProfile: BehaviorProfile;
}

/**
 * Snapshot of the student's observed learning behavior patterns.
 *
 * All fields describe what happened, not why. No personality, motivation,
 * or learning-style inference is made from this data.
 *
 * sessionPattern      — when and how long sessions are
 * completionBehavior  — how many sessions are completed
 * paceObservation     — accuracy trajectory within sessions
 * retryBehavior       — response time as a proxy for deliberateness
 * engagementObservation — overall engagement level and recent mood context
 * confidenceTier      — inherited from BehaviorProfile (based on session count)
 */
export interface LearningBehaviorState {
  sessionPattern: SessionPatternObservation;
  completionBehavior: CompletionBehaviorObservation;
  paceObservation: PaceObservation;
  retryBehavior: RetryBehaviorObservation;
  engagementObservation: EngagementObservation;
  confidenceTier: ConfidenceTier;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────
// Learning Preference State
// ─────────────────────────────────────────────────────────

/**
 * How a preference value was determined.
 *
 * EXPLICIT — the learner directly set this value (highest authority)
 * OBSERVED — derived from repeated behavioral patterns (session data)
 * NONE     — no evidence found; value is "UNKNOWN"
 */
export type PreferenceSource = "EXPLICIT" | "OBSERVED" | "NONE";

/**
 * A single preference dimension with its value, evidence source, and confidence.
 *
 * Confidence rules (per Phase 5 design):
 *   EXPLICIT source → OBSERVED tier  (one authoritative data point)
 *   OBSERVED source → EMERGING or CONFIRMED (depends on behavioral data richness)
 *   NONE source     → OBSERVED tier  (no evidence; treat any claim with caution)
 *
 * "UNKNOWN" is the sentinel value when no preference can be determined.
 * It is not null — it is an explicit statement that the engine has no data.
 */
export interface PreferenceEntry<T extends string> {
  value: T | "UNKNOWN";
  source: PreferenceSource;
  confidenceTier: ConfidenceTier;
}

// ── Preference value types ────────────────────────────────

export type PracticeTimeValue = "MORNING" | "AFTERNOON" | "EVENING";

/** Session length bucket: SHORT < 15 min, MEDIUM 15–45 min, LONG > 45 min */
export type SessionDurationValue = "SHORT" | "MEDIUM" | "LONG";

/** How much detail the learner prefers in explanations after an error */
export type ExplanationDepthValue = "BRIEF" | "DETAILED" | "STEP_BY_STEP";

/** Whether the learner wants hints proactively, on request, or never */
export type HintFrequencyValue = "NEVER" | "ON_REQUEST" | "PROACTIVE";

/** When the learner prefers to receive answer feedback */
export type FeedbackTimingValue = "IMMEDIATE" | "END_OF_SESSION";

/** The type of practice the learner gravitates toward */
export type PracticeModeValue = "MIXED" | "TOPIC_FOCUSED" | "EXAM_SIMULATION";

/** UI language preference (LEXI is bilingual Vietnamese/English) */
export type LanguagePreferenceValue = "VIETNAMESE" | "ENGLISH" | "BILINGUAL";

/**
 * Explicit learner-controlled preference overrides.
 *
 * These fields are set when the learner has directly chosen a value
 * (e.g. via a settings screen). null or undefined means "not set by user"
 * — the engine will fall back to observed behavioral data or UNKNOWN.
 *
 * Future: these values will be backed by a dedicated LearnerPreferences
 * Prisma model. For Phase 5.3, callers pass whatever they have.
 */
export interface ExplicitPreferences {
  practiceTime?: PracticeTimeValue | null;
  sessionDuration?: SessionDurationValue | null;
  explanationDepth?: ExplanationDepthValue | null;
  hintFrequency?: HintFrequencyValue | null;
  feedbackTiming?: FeedbackTimingValue | null;
  practiceMode?: PracticeModeValue | null;
  languagePreference?: LanguagePreferenceValue | null;
}

/**
 * Pre-fetched input for computeLearningPreferenceState().
 * All data must come from the caller — no DB access inside the engine.
 *
 * behaviorProfile     — supplies observed time-of-day and duration signals
 * explicitPreferences — optional learner-set overrides (any field may be absent)
 */
export interface PreferenceStateInput {
  behaviorProfile: BehaviorProfile;
  explicitPreferences?: ExplicitPreferences;
}

/**
 * Snapshot of the learner's known preferences across seven dimensions.
 *
 * Every field is a PreferenceEntry — value + source + confidenceTier.
 * An "UNKNOWN" value with source "NONE" means the engine had no evidence
 * for that dimension. This is intentional and informative, not a bug.
 *
 * practiceTime     — when in the day the learner prefers to practice
 * sessionDuration  — preferred session length (SHORT / MEDIUM / LONG)
 * explanationDepth — depth of post-error explanations preferred
 * hintFrequency    — how often hints should be offered
 * feedbackTiming   — when to deliver answer feedback
 * practiceMode     — the type of practice the learner gravitates toward
 * languagePreference — UI / explanation language preference
 */
export interface LearningPreferenceState {
  practiceTime: PreferenceEntry<PracticeTimeValue>;
  sessionDuration: PreferenceEntry<SessionDurationValue>;
  explanationDepth: PreferenceEntry<ExplanationDepthValue>;
  hintFrequency: PreferenceEntry<HintFrequencyValue>;
  feedbackTiming: PreferenceEntry<FeedbackTimingValue>;
  practiceMode: PreferenceEntry<PracticeModeValue>;
  languagePreference: PreferenceEntry<LanguagePreferenceValue>;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────
// Problem Solving Pattern State
// ─────────────────────────────────────────────────────────

/**
 * A single problem-solving pattern dimension.
 *
 * value          — the observed pattern label, or "UNKNOWN" when data is insufficient
 * evidence       — human-readable description of the underlying observation;
 *                  null only when absolutely no relevant data exists
 * confidenceTier — reliability of this observation based on sample size
 *
 * All value labels describe observed actions only.
 * No personality traits, motivation claims, or grit inferences.
 */
export interface PatternEntry<T extends string> {
  value: T | "UNKNOWN";
  evidence: string | null;
  confidenceTier: ConfidenceTier;
}

/**
 * How often the learner retries after a wrong answer.
 *
 * A "retry" is an attempt that follows a wrong answer within 10 minutes,
 * derived from attempt timestamps alone.
 *
 * FREQUENT_RETRIER  — retries after ≥60% of wrong answers
 * OCCASIONAL_RETRIER — retries after 25–59% of wrong answers
 * RARELY_RETRIES    — retries after <25% of wrong answers
 */
export type RetryPatternValue =
  | "FREQUENT_RETRIER"
  | "OCCASIONAL_RETRIER"
  | "RARELY_RETRIES";

/**
 * How often the learner succeeds on post-error retries.
 *
 * Measures accuracy on the attempt immediately following a wrong answer
 * within the same retry window. Describes within-session recovery only.
 *
 * RECOVERS_QUICKLY  — ≥65% of post-error retries are correct
 * GRADUAL_RECOVERY  — 35–64% of post-error retries are correct
 * SLOW_RECOVERY     — <35% of post-error retries are correct
 */
export type FeedbackRecoveryValue =
  | "RECOVERS_QUICKLY"
  | "GRADUAL_RECOVERY"
  | "SLOW_RECOVERY";

/**
 * How actively the learner engages with remediation for flagged error topics.
 *
 * Derived from error notebook: proportion of active weakness topics that
 * have been flagged for active remediation. Hint and explanation access
 * are not yet tracked in the data model — this is the available proxy.
 *
 * ACTIVE_ENGAGEMENT — ≥50% of error topics flagged for remediation
 * SOME_ENGAGEMENT   — 20–49% flagged
 * LOW_ENGAGEMENT    — <20% flagged
 */
export type HelpSeekingValue =
  | "ACTIVE_ENGAGEMENT"
  | "SOME_ENGAGEMENT"
  | "LOW_ENGAGEMENT";

/**
 * Whether the learner's previously recorded errors are reducing over time.
 *
 * Derived from improvement signals on error notebook topics:
 *   IMPROVED / IMPROVING signals → errors are being resolved
 *   RECURRING signal → errors persist despite review
 *
 * ERRORS_REDUCING   — ≥60% of topics show IMPROVED or IMPROVING signal
 * ERRORS_STABLE     — mixed signals; no dominant trend
 * ERRORS_PERSISTING — ≥50% of topics show RECURRING signal (no improvement after review)
 */
export type ErrorCorrectionValue =
  | "ERRORS_REDUCING"
  | "ERRORS_STABLE"
  | "ERRORS_PERSISTING";

/**
 * Pre-fetched input for computeProblemSolvingState().
 * All data must come from the caller — no DB access inside the engine.
 *
 * attempts         — chronological attempt history (isCorrect + attemptedAt)
 * activeWeaknesses — current error notebook snapshot with improvement signals
 */
export interface ProblemSolvingStateInput {
  attempts: AttemptRecord[];
  activeWeaknesses: ActiveWeakness[];
}

/**
 * Snapshot of the learner's observable problem-solving response patterns.
 *
 * All fields describe how the learner responds to difficulty based on
 * system-recorded actions. No trait labels or motivational claims.
 *
 * retryPattern     — how often the learner retries after wrong answers
 * feedbackRecovery — success rate on attempts immediately after an error
 * helpSeeking      — engagement with remediation system for flagged errors
 * errorCorrection  — whether recorded error topics are reducing over time
 * confidenceTier   — overall reliability based on attempt volume
 */
export interface ProblemSolvingState {
  retryPattern: PatternEntry<RetryPatternValue>;
  feedbackRecovery: PatternEntry<FeedbackRecoveryValue>;
  helpSeeking: PatternEntry<HelpSeekingValue>;
  errorCorrection: PatternEntry<ErrorCorrectionValue>;
  confidenceTier: ConfidenceTier;
  computedAt: string;
}
