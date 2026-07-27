/**
 * Analytics module exports.
 * Public API for analytics computation across the LEXI application.
 *
 * Import hierarchy (no circular deps):
 *   examBlueprint → (no analytics deps)
 *   types         → examBlueprint (via Prisma enums)
 *   confidenceEngine → types
 *   canonicalTopic  → (no analytics deps)
 *   sessionAnalytics → examBlueprint, types, confidenceEngine, canonicalTopic
 *   repository      → types (Prisma queries)
 *   service         → repository, sessionAnalytics, types
 *   contracts       → examBlueprint, types, service (mapping only — no Prisma)
 */

// Blueprint configuration
export {
  EXAM_SECTION_WEIGHTS,
  EXAM_SECTION_DEPTH,
  SECTION_LABELS,
  ALL_SECTIONS,
} from "./examBlueprint";

// Type definitions
export type {
  CoverageStatus,
  SectionCoverage,
  BlueprintCoverage,
  SectionBreakdown,
  ReadinessResult,
  WrongAttemptDetail,
  PatternObservation,
  NotebookContext,
  WeaknessTopic,
  SessionAnalyticsResult,
  SectionDropAnalysis,
} from "./types";

export { ConfidenceTier } from "./types";

// Confidence system
export {
  determineWeaknessConfidence,
  determinePatternConfidence,
  determineComparisonConfidence,
  determineSectionDropConfidence,
  determineReadinessConfidence,
  STUDENT_CONFIDENCE_LABEL,
  CONFIDENCE_COLOR,
  TUTOR_TIER_LABEL,
} from "./confidenceEngine";

// Canonical topic normalization
export { canonicalTopic } from "./canonicalTopic";

// Repository (DB queries — import separately, never from inside the engine)
export type {
  AttemptWithQuestion,
  NotebookContextRow,
} from "./repository";
export {
  fetchSessionAttempts,
  fetchNotebookContext,
  findMostRecentlyCompletedScope,
} from "./repository";

// Pure analytics engine
export type { AttemptInput } from "./sessionAnalytics";
export {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
} from "./sessionAnalytics";

// Service orchestration (repository + engine, no Prisma)
export type { SessionAnalyticsOutput } from "./service";
export {
  getSessionAnalytics,
  enrichWeaknessWithNotebook,
} from "./service";

// API contracts — stable frontend-facing types and mappers
// These are the only types frontend components should import from analytics
export type {
  ReadinessBand,
  ConfidenceLevel,
  SectionCoverageStatus,
  ReadinessSummary,
  BlueprintSectionItem,
  BlueprintCoverageSummary,
  SectionBreakdownItem,
  PatternSignal,
  NotebookRecord,
  WrongAnswerItem,
  WeaknessSignalItem,
  SessionAnalyticsResponse,
} from "./contracts";
export {
  toSessionAnalyticsResponse,
} from "./contracts";

// Narrative layer — pure deterministic text generation from contract types
export type {
  ReadinessNarrative,
  WeaknessNarrative,
} from "./narrative";
export {
  generateReadinessNarrative,
  generateWeaknessNarrative,
} from "./narrative";

// Notebook intelligence — cross-references ErrorNotebookEntry with QuestionAttempt
// to produce improvement signals and priority summaries per topic
export type { ImprovementSignal, TopicNotebookSummary } from "./notebookIntelligence";
export {
  computeImprovementSignal,
  getTopicNotebookSummaries,
  getPriorityReviewTopic,
} from "./notebookIntelligence";

// Mastery tracking — derives sustained-mastery state from notebook summaries
// Pure computation layer; no additional DB queries beyond notebookIntelligence.
export type { MasteryState, TopicMasteryProfile } from "./masteryTracking";
export {
  computeTopicMastery,
  getTopicMasteryProfiles,
  countByMasteryState,
} from "./masteryTracking";

// Difficulty calibration — adaptive question selection (M2.3)
export type {
  DifficultyTarget,
  AttemptForCalibration,
  DifficultyWeights,
} from "./difficultyCalibration";
export {
  computeDifficultyTarget,
  computeSelectionWeights,
  applyDifficultyWeighting,
} from "./difficultyCalibration";

// Behavior engine — observed session signals (M2.2)
// Pure engine + repository; no schema changes required.
export type {
  SessionTimeOfDay,
  PaceProfile,
  ResponseTimeSignal,
  MoodContext,
  BehaviorProfile,
  SessionDataPoint,
  MoodDataPoint,
} from "./behaviorEngine";
export {
  computeBehaviorProfile,
  getBehaviorProfile,
} from "./behaviorEngine";

// StudentLearningProfile v2 additions (M2.5)
export type { GoalCountdown } from "./studentLearningProfile";
export { computeGoalCountdown } from "./studentLearningProfile";

// Learning Signal Engine — deterministic observations from profile data (M2.4)
// Pure engine + service function; no schema changes required.
// StudentLearningProfile integration deferred to M2.5.
export type {
  SignalType,
  SignalSeverity,
  SignalConfidence,
  SignalEvidence,
  LearningSignal,
} from "./learningSignalEngine";
export {
  computeLearningSignals,
  getLearningSignals,
} from "./learningSignalEngine";
