/**
 * Learning Preference State Engine — Phase 5.3
 *
 * Pure deterministic engine. No Prisma. No AI. No DB access.
 *
 * Produces a LearningPreferenceState snapshot from two evidence sources:
 *   1. Explicit learner choices (highest authority — EXPLICIT source)
 *   2. Repeated behavioral observations from BehaviorProfile (OBSERVED source)
 *
 * Prohibited derivations:
 *   ✗ Learning style classification ("visual learner", "auditory learner")
 *   ✗ Personality inference ("introverted", "conscientious")
 *   ✗ Motivation inference ("highly motivated", "disengaged")
 *   ✗ Intelligence or aptitude claims
 *
 * For each preference dimension, resolution priority:
 *   1. Explicit override (from ExplicitPreferences, if non-null)
 *   2. Observed behavioral pattern (from BehaviorProfile, where mappable)
 *   3. UNKNOWN — no evidence; engine cannot make a claim
 *
 * Confidence tier rules (per Phase 5 design):
 *   EXPLICIT source → OBSERVED tier  (one explicit choice, not yet a pattern)
 *   OBSERVED source → inherits from BehaviorProfile.confidenceTier
 *   NONE source     → OBSERVED tier  (no evidence; any claim would be speculation)
 */

import { ConfidenceTier } from "@/lib/analytics/types";
import type { BehaviorProfile } from "@/lib/analytics/behaviorEngine";
import type {
  PreferenceEntry,
  PreferenceSource,
  ExplicitPreferences,
  LearningPreferenceState,
  PracticeTimeValue,
  SessionDurationValue,
  ExplanationDepthValue,
  HintFrequencyValue,
  FeedbackTimingValue,
  PracticeModeValue,
  LanguagePreferenceValue,
} from "./types";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

// Session duration bucket thresholds in minutes
const SHORT_SESSION_MAX_MIN = 15;  // < 15 min → SHORT
const LONG_SESSION_MIN_MIN = 45;   // > 45 min → LONG
// 15–45 min → MEDIUM

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function unknownPreference<T extends string>(): PreferenceEntry<T> {
  return { value: "UNKNOWN", source: "NONE", confidenceTier: ConfidenceTier.OBSERVED };
}

function explicitPreference<T extends string>(value: T): PreferenceEntry<T> {
  return { value, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED };
}

function observedPreference<T extends string>(
  value: T,
  tier: ConfidenceTier,
): PreferenceEntry<T> {
  return { value, source: "OBSERVED", confidenceTier: tier };
}

/**
 * Resolve a single preference dimension.
 *
 * Returns explicit entry if the learner set one, observed entry if behavioral
 * data is available, or UNKNOWN if there is no evidence.
 */
function resolvePreference<T extends string>(
  explicit: T | null | undefined,
  observed: T | null,
  observedTier: ConfidenceTier,
): PreferenceEntry<T> {
  if (explicit != null) return explicitPreference(explicit);
  if (observed != null) return observedPreference(observed, observedTier);
  return unknownPreference<T>();
}

/**
 * Classify average session duration into a named bucket.
 * Returns null when no timing data is available.
 */
function classifySessionDuration(
  avgMin: number | null,
): SessionDurationValue | null {
  if (avgMin === null) return null;
  if (avgMin < SHORT_SESSION_MAX_MIN) return "SHORT";
  if (avgMin > LONG_SESSION_MIN_MIN) return "LONG";
  return "MEDIUM";
}

// ─────────────────────────────────────────────────────────
// Pure engine
// ─────────────────────────────────────────────────────────

/**
 * Compute learning preference state from behavioral data and explicit settings.
 * Pure — no DB access. All input is fetched by the caller.
 *
 * practiceTime:
 *   Explicit override → observed preferredTimeOfDay from BehaviorProfile → UNKNOWN.
 *   Observed confidence inherits from BehaviorProfile.confidenceTier.
 *
 * sessionDuration:
 *   Explicit override → avgSessionDurationMin bucketed (SHORT/MEDIUM/LONG) → UNKNOWN.
 *   Observed confidence inherits from BehaviorProfile.confidenceTier.
 *
 * explanationDepth, hintFrequency, feedbackTiming, practiceMode, languagePreference:
 *   Explicit override → UNKNOWN.
 *   No behavioral proxy available without additional data sources.
 *   These dimensions will be populated when a dedicated LearnerPreferences
 *   model is added, or when in-session interaction data is wired in.
 */
export function computeLearningPreferenceState(
  behaviorProfile: BehaviorProfile,
  explicitPreferences?: ExplicitPreferences,
): LearningPreferenceState {
  const ep = explicitPreferences ?? {};
  const tier = behaviorProfile.confidenceTier;

  const observedDuration = classifySessionDuration(
    behaviorProfile.avgSessionDurationMin,
  );

  return {
    practiceTime: resolvePreference<PracticeTimeValue>(
      ep.practiceTime,
      behaviorProfile.preferredTimeOfDay as PracticeTimeValue | null,
      tier,
    ),
    sessionDuration: resolvePreference<SessionDurationValue>(
      ep.sessionDuration,
      observedDuration,
      tier,
    ),
    explanationDepth: resolvePreference<ExplanationDepthValue>(
      ep.explanationDepth,
      null,
      tier,
    ),
    hintFrequency: resolvePreference<HintFrequencyValue>(
      ep.hintFrequency,
      null,
      tier,
    ),
    feedbackTiming: resolvePreference<FeedbackTimingValue>(
      ep.feedbackTiming,
      null,
      tier,
    ),
    practiceMode: resolvePreference<PracticeModeValue>(
      ep.practiceMode,
      null,
      tier,
    ),
    languagePreference: resolvePreference<LanguagePreferenceValue>(
      ep.languagePreference,
      null,
      tier,
    ),
    computedAt: new Date().toISOString(),
  };
}
