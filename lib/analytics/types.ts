/**
 * Type definitions for the analytics system.
 *
 * The analytics pipeline produces results that flow through three layers:
 * 1. Analytics Engine (pure computation)
 * 2. Confidence System (confidence tier assignment)
 * 3. Narrative Engine (text generation for student/tutor views)
 *
 * These types are used throughout that pipeline.
 */

import { QuestionType, Difficulty } from "@prisma/client";

/**
 * Confidence tiers for analytics signals.
 *
 * OBSERVED: Small sample size, treat as hypothesis / watch for patterns
 * EMERGING: Moderate evidence, worth addressing / repeating pattern
 * CONFIRMED: Stable pattern across sufficient data / high confidence
 *
 * Tier assignment is deterministic based on sample size and session count.
 */
export enum ConfidenceTier {
  OBSERVED = "OBSERVED",
  EMERGING = "EMERGING",
  CONFIRMED = "CONFIRMED",
}

/**
 * Status of a section on the exam blueprint.
 *
 * ASSESSED: Student attempted ≥2 questions in this section
 * PARTIAL: Student attempted exactly 1 question in this section
 * UNASSESSED: Student attempted 0 questions in this section
 */
export type CoverageStatus = "ASSESSED" | "PARTIAL" | "UNASSESSED";

/**
 * Coverage for one exam section.
 * Used in BlueprintCoverageGrid UI and in CoverageDepthScore calculation.
 *
 * `section` is a plain string (ExamBlueprintSection.code), not QuestionType —
 * A2 moved the blueprint into the DB, where a section code is whatever the
 * seeded Exam's ExamSection rows say, not a closed Prisma enum.
 */
export interface SectionCoverage {
  section: string;
  label: string;
  attemptCount: number;
  status: CoverageStatus;
  examWeight: number;
}

/**
 * Complete blueprint coverage analysis.
 * Shows which sections were tested and at what depth.
 */
export interface BlueprintCoverage {
  sections: SectionCoverage[];
  assessedCount: number; // sections with status ASSESSED (≥2 attempts)
  partialCount: number; // sections with status PARTIAL (1 attempt)
  unassessedCount: number; // sections with status UNASSESSED (0 attempts)
}

/**
 * Detailed breakdown of accuracy per section for readiness calculation.
 * Used to compute both WeightedTopicMastery and CoverageDepthScore.
 *
 * `section` is a plain string (ExamBlueprintSection.code) — see SectionCoverage
 * above for why this is no longer QuestionType.
 */
export interface SectionBreakdown {
  section: string;
  accuracy: number; // 0.0–1.0
  attemptCount: number;
  weight: number; // exam section weight (0.050–0.375)
  contribution: number; // accuracy × weight (contributes to WeightedTopicMastery)
  depthRatio: number; // (min(attemptCount, expectedDepth) / expectedDepth) — contributes to CoverageDepthScore
}

/**
 * The output of readiness analysis.
 * Used by the readiness band component to determine the student's exam preparation level.
 */
export interface ReadinessResult {
  weightedTopicMastery: number; // 0.0–1.0
  coverageDepthScore: number; // 0.0–1.0 (replaces binary BlueprintCoverage)
  readinessScore: number; // 0–100 (after applying the formula and converting to percentage)
  band: "EXAM_READY" | "NEARLY_READY" | "DEVELOPING" | "NOT_READY";
  sessionsIncluded: number[]; // e.g., [22] or [22, 23]
  sectionBreakdown: SectionBreakdown[]; // detailed per-section metrics (tutor view)
  insufficientData: boolean; // true if totalAttempts === 0 (only gate besides CoverageDepthScore)
  confidence: ConfidenceTier;
}

/**
 * One wrong answer on a topic.
 * Includes full question details for explanation/feedback display.
 */
export interface WrongAttemptDetail {
  questionId: string;
  questionCode: string;
  promptText: string;
  selectedOption: string; // A/B/C/D
  correctOption: string; // A/B/C/D
  explanationVi: string;
  commonMistake: string | null;
  questionType: QuestionType;
  difficulty: Difficulty;
  // Option texts for pattern observation
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

/**
 * Observed pattern in wrong answers.
 * Indicates a possible systematic misconception if the same wrong option
 * was chosen multiple times.
 */
export interface PatternObservation {
  selectedOption: string; // A/B/C/D
  occurrenceCount: number;
  exampleOptionText: string;
  confidence: ConfidenceTier;
  studentVisible: boolean; // N>=3 only; N==2 is tutor-only
}

/**
 * Historical context from the error notebook.
 * Shows that a weakness has appeared before and how often.
 */
export interface NotebookContext {
  topic: string;
  entryCount: number; // distinct error notebook entries for this topic
  totalOccurrences: number; // sum of occurrenceCount across those entries
  isRemedialFlagged: boolean; // auto-set when occurrenceCount > 2
  mostRecentEntry: {
    reason: string;
    studentAnswer: string;
    correctAnswer: string;
    reviewStage: number;
    lastReviewedAt: Date | null;
  } | null;
}

/**
 * One topic from the top-3 weakness list.
 * Combines session-level accuracy with pattern observations and historical context.
 */
export interface WeaknessTopic {
  topic: string;
  label: string; // prettified (snake_case → Title Case)
  riskScore: number; // Σ examWeight for wrong attempts (deterministic ranking)
  wrongCount: number;
  totalAttempts: number;
  accuracy: number; // correct / total (0.0–1.0)
  confidence: ConfidenceTier;
  wrongAttempts: WrongAttemptDetail[];
  patternObservation: PatternObservation | null;
  notebookContext: NotebookContext | null;
}

/**
 * Complete session analytics result.
 * Returned by GET /api/analytics/session/[sessionId].
 * Used to render the post-exam results page with all analytics.
 */
export interface SessionAnalyticsResult {
  sessionId: string;
  sessionNumber: number;
  blueprintCoverage: BlueprintCoverage; // display metric only
  weaknessTopics: WeaknessTopic[]; // top 3
  sectionDrop: SectionDropAnalysis | null;
  readiness: ReadinessResult | null; // null if insufficient data
  generatedAt: string; // ISO timestamp
}

/**
 * Analysis of accuracy drop between exam sections.
 * Compares first third vs final third of the question sequence.
 */
export interface SectionDropAnalysis {
  totalAttempted: number;
  firstThirdAccuracy: number;
  middleThirdAccuracy: number;
  finalThirdAccuracy: number;
  drop: number; // firstThird - finalThird
  isSignificant: boolean; // drop > 0.10 (10 percentage points)
  difficultyConfoundDetected: boolean; // tutor view only: HARD questions concentrated in final third?
  confidence: ConfidenceTier;
}

