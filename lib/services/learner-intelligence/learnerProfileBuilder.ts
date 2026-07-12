/**
 * Learner Profile Builder — Phase 5.5
 *
 * Pure assembly layer. Composes all five Phase 5 intelligence engines into a
 * single LearnerModel snapshot that is embedded in StudentLearningProfile v3.
 *
 * Responsibilities (what this builder MAY do):
 *   - Call each engine with its required inputs
 *   - Assemble the five engine outputs into one typed snapshot
 *   - Record the assembly timestamp
 *
 * Hard constraints (what this builder MUST NOT do):
 *   - Add new inference rules not already inside an engine
 *   - Classify the learner (personality, aptitude, motivation)
 *   - Duplicate any logic that lives inside a named engine
 *
 * Decision (M5.5):
 *   StudentLearningProfile v3 embeds LearnerModel as a field.
 *   Rejected: embedding intelligence rules inside the profile itself.
 *   See DECISION_LOG.md — M5.5.
 */

import type { TopicMasteryProfile } from "@/lib/analytics/masteryTracking";
import type { LearningSignal } from "@/lib/analytics/learningSignalEngine";
import type { BehaviorProfile } from "@/lib/analytics/behaviorEngine";
import { computeKnowledgeState } from "./knowledgeState";
import { computePerformanceState } from "./performanceState";
import { computeLearningBehaviorState } from "./behaviorState";
import { computeLearningPreferenceState } from "./preferenceState";
import { computeProblemSolvingState } from "./problemSolvingState";
import type {
  KnowledgeState,
  PerformanceState,
  LearningBehaviorState,
  LearningPreferenceState,
  ProblemSolvingState,
  AttemptRecord,
  SkillAccuracyInput,
  ExplicitPreferences,
  ActiveWeakness,
} from "./types";

// Re-export engine output types for consumers of LearnerModel
export type {
  KnowledgeState,
  PerformanceState,
  LearningBehaviorState,
  LearningPreferenceState,
  ProblemSolvingState,
};

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * The Phase 5 learner model snapshot.
 *
 * Five intelligence layers in one coherent view:
 *   knowledgeState        — what the learner knows (mastered, developing, weak)
 *   performanceState      — how the learner performs (accuracy trend, skill tiers)
 *   learningBehaviorState — how the learner practices (session patterns, engagement)
 *   learningPreferenceState — what the learner prefers (timing, depth, format)
 *   problemSolvingState   — how the learner responds to difficulty (retry, recovery)
 *
 * Embedded in StudentLearningProfile v3 as `learnerModel`.
 */
export interface LearnerModel {
  knowledgeState: KnowledgeState;
  performanceState: PerformanceState;
  learningBehaviorState: LearningBehaviorState;
  learningPreferenceState: LearningPreferenceState;
  problemSolvingState: ProblemSolvingState;
  assembledAt: string; // ISO timestamp when assembleLearnerModel() ran
}

/**
 * All data required to assemble the learner model.
 *
 * Callers pre-fetch all inputs from DB or derived data.
 * No DB access happens inside assembleLearnerModel().
 *
 * Data sharing across engines (no duplicate fetches):
 *   masteryProfiles + activeWeaknesses → knowledgeState + problemSolvingState
 *   attempts           → performanceState + problemSolvingState
 *   behaviorProfile    → learningBehaviorState + learningPreferenceState
 *   learningSignals    → knowledgeState only (confidence tier boost)
 */
export interface LearnerModelInput {
  // KnowledgeState engine
  masteryProfiles: TopicMasteryProfile[];
  activeWeaknesses: ActiveWeakness[];
  learningSignals: LearningSignal[];
  // PerformanceState + ProblemSolvingState (shared attempt array)
  attempts: AttemptRecord[];
  skillAccuracies: SkillAccuracyInput[];
  // LearningBehaviorState + LearningPreferenceState (shared behaviorProfile)
  behaviorProfile: BehaviorProfile;
  // LearningPreferenceState explicit overrides — optional, not yet backed by DB schema
  explicitPreferences?: ExplicitPreferences;
}

// ─────────────────────────────────────────────────────────
// Assembly function
// ─────────────────────────────────────────────────────────

/**
 * Assemble a LearnerModel snapshot from pre-fetched engine inputs.
 *
 * Pure — no DB access, no AI calls, no side effects.
 * Calls each engine exactly once. No new inference rules added here.
 */
export function assembleLearnerModel(input: LearnerModelInput): LearnerModel {
  return {
    knowledgeState: computeKnowledgeState(
      input.masteryProfiles,
      input.activeWeaknesses,
      input.learningSignals,
    ),
    performanceState: computePerformanceState(
      input.attempts,
      input.skillAccuracies,
    ),
    learningBehaviorState: computeLearningBehaviorState(
      input.behaviorProfile,
    ),
    learningPreferenceState: computeLearningPreferenceState(
      input.behaviorProfile,
      input.explicitPreferences,
    ),
    problemSolvingState: computeProblemSolvingState(
      input.attempts,
      input.activeWeaknesses,
    ),
    assembledAt: new Date().toISOString(),
  };
}
