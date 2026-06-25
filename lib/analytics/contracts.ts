/**
 * Analytics API contract layer.
 *
 * Defines the stable JSON shapes returned by:
 *   GET /api/analytics/session/[sessionNumber]   → SessionAnalyticsResponse
 *   GET /api/analytics/compare/[sessionA]/[sessionB] → SessionComparisonResponse
 *
 * BOUNDARY RULES
 * - No @prisma/client imports — these types must be serializable without Prisma
 * - No engine internals leaked (e.g., raw weightedTopicMastery, contribution)
 * - Date fields are string (ISO 8601) — reflects actual JSON wire format
 * - ConfidenceTier enum replaced by plain string union (ConfidenceLevel)
 * - QuestionType / Difficulty Prisma enums replaced by plain string (section, difficulty)
 *
 * Architecture:
 *   DB → Repository → Engine → Service → [contracts.ts] → Route → Frontend
 *                                         ^^^^^^^^^^^^^^^
 *                                         This file is the API boundary.
 *
 * STABILITY CONTRACT
 * Once frontend components consume these shapes, treat them as frozen.
 * Additive changes (new optional fields) are safe.
 * Structural changes (rename, remove, type-change) require frontend coordination.
 */

import { EXAM_SECTION_DEPTH, SECTION_LABELS } from "./examBlueprint";
import type {
  SectionBreakdown,
  SectionCoverage,
  WeaknessTopic,
  TopicComparison,
  SessionComparisonResult,
  ComparisonDirection,
} from "./types";

export type { ComparisonDirection };
import type { SessionAnalyticsOutput } from "./service";

// ──────────────────────────────────────────────────────────────────
// Primitive contract types (replace Prisma / enum dependencies)
// ──────────────────────────────────────────────────────────────────

/** Exam readiness band — same values as the engine, typed without Prisma. */
export type ReadinessBand = "EXAM_READY" | "NEARLY_READY" | "DEVELOPING" | "NOT_READY";

/** Analytics confidence level — plain string union; ConfidenceTier enum values. */
export type ConfidenceLevel = "OBSERVED" | "EMERGING" | "CONFIRMED";

/** Blueprint section status — same values as the engine. */
export type SectionCoverageStatus = "ASSESSED" | "PARTIAL" | "UNASSESSED";

// ──────────────────────────────────────────────────────────────────
// SessionAnalyticsResponse sub-types
// ──────────────────────────────────────────────────────────────────

/** Readiness summary — top-level score and band, without internal calculation intermediates. */
export interface ReadinessSummary {
  score: number;           // 0–100
  band: ReadinessBand;
  confidence: ConfidenceLevel;
  insufficientData: boolean;
}

/** One exam section's blueprint coverage status. */
export interface BlueprintSectionItem {
  section: string;            // QuestionType value (e.g. "GRAMMAR_MCQ")
  label: string;              // Vietnamese label (e.g. "Ngữ pháp / Từ vựng")
  attemptCount: number;
  expectedDepth: number;      // exam blueprint target (e.g. 15 for GRAMMAR_MCQ)
  status: SectionCoverageStatus;
  examWeight: number;         // 0.05–0.375
}

/** Blueprint coverage — which sections were touched and at what depth. */
export interface BlueprintCoverageSummary {
  assessedCount: number;      // sections with ≥2 attempts
  partialCount: number;       // sections with exactly 1 attempt
  unassessedCount: number;    // sections with 0 attempts
  sections: BlueprintSectionItem[];
}

/** Per-section detail for tutor bar-chart view. */
export interface SectionBreakdownItem {
  section: string;         // QuestionType value
  label: string;           // Vietnamese label
  accuracy: number;        // 0.0–1.0
  attemptCount: number;
  expectedDepth: number;   // exam blueprint target
  examWeight: number;      // section's proportion of the 40-question exam
  depthRatio: number;      // min(attemptCount, expectedDepth) / expectedDepth
}

/** Pattern observation — repeated wrong option on the same topic. */
export interface PatternSignal {
  selectedOption: string;    // A / B / C / D
  occurrenceCount: number;
  exampleOptionText: string;
  confidence: ConfidenceLevel;
  studentVisible: boolean;   // false for N=2 (tutor-only); true for N≥3
}

/** Historical error notebook context for a weakness topic. */
export interface NotebookRecord {
  entryCount: number;
  totalOccurrences: number;
  isRemedialFlagged: boolean;
  mostRecentEntry: {
    reason: string;
    studentAnswer: string;
    correctAnswer: string;
    reviewStage: number;
    lastReviewedAt: string | null; // ISO 8601 string (Date serialized)
  } | null;
}

/** One wrong answer — enough detail for an explanation UI without leaking internals. */
export interface WrongAnswerItem {
  questionCode: string;
  promptText: string;
  selectedOption: string;   // A / B / C / D
  correctOption: string;    // A / B / C / D
  explanationVi: string;
  commonMistake: string | null;
}

/** One weakness topic — risk-ranked, notebook-enriched. */
export interface WeaknessSignalItem {
  topic: string;
  label: string;              // snake_case → "Title Case"
  riskScore: number;          // Σ examWeight for wrong attempts
  wrongCount: number;
  totalAttempts: number;
  accuracy: number;           // 0.0–1.0
  confidence: ConfidenceLevel;
  patternObservation: PatternSignal | null;
  notebookContext: NotebookRecord | null;
  wrongAnswers: WrongAnswerItem[];  // ordered by question; renamed from wrongAttempts
}

// ──────────────────────────────────────────────────────────────────
// SessionAnalyticsResponse — main contract
// ──────────────────────────────────────────────────────────────────

/**
 * Full analytics response for one curriculum session.
 * Returned by GET /api/analytics/session/[sessionNumber].
 *
 * Field layout:
 *   readiness        — score, band, overall confidence, data-quality flag
 *   blueprintCoverage — which exam sections were covered and how deeply
 *   weaknessSignals  — top-3 topics at risk, enriched with notebook history
 *   sectionBreakdown — per-section accuracy for tutor bar chart
 *   confidence       — top-level copy of readiness.confidence (convenience field)
 *   generatedAt      — ISO 8601 timestamp of computation
 */
export interface SessionAnalyticsResponse {
  sessionNumber: number;
  generatedAt: string;                      // ISO 8601
  confidence: ConfidenceLevel;             // overall data quality (= readiness.confidence)
  readiness: ReadinessSummary;
  blueprintCoverage: BlueprintCoverageSummary;
  weaknessSignals: WeaknessSignalItem[];   // top-3, risk-ranked
  sectionBreakdown: SectionBreakdownItem[]; // all 8 sections
}

// ──────────────────────────────────────────────────────────────────
// SessionComparisonResponse — main contract
// ──────────────────────────────────────────────────────────────────

/** One topic's comparison between two sessions. */
export interface TopicComparisonItem {
  topic: string;
  label: string;
  direction: ComparisonDirection;
  delta: number | null;         // session2.accuracy - session1.accuracy; null if INSUFFICIENT_DATA
  confidence: ConfidenceLevel;
  session1: { correct: number; total: number; accuracy: number } | null;
  session2: { correct: number; total: number; accuracy: number } | null;
}

/**
 * Topic-by-topic comparison between two curriculum sessions.
 * Returned by GET /api/analytics/compare/[sessionA]/[sessionB].
 *
 * Field layout:
 *   topics           — full topic list, comparable topics first
 *   summary          — aggregate counts for quick UI display
 *   confidence       — overall comparison quality (min confidence across comparable topics)
 */
export interface SessionComparisonResponse {
  session1Number: number;
  session2Number: number;
  confidence: ConfidenceLevel;  // most conservative confidence across comparable topics
  topics: TopicComparisonItem[];
  summary: {
    improvedCount: number;
    declinedCount: number;
    insufficientDataCount: number;
  };
}

// ──────────────────────────────────────────────────────────────────
// Mapping functions — engine/service output → API contract
// ──────────────────────────────────────────────────────────────────

function mapSectionBreakdown(bd: SectionBreakdown): SectionBreakdownItem {
  return {
    section: bd.section as string,
    label: SECTION_LABELS[bd.section],
    accuracy: bd.accuracy,
    attemptCount: bd.attemptCount,
    expectedDepth: EXAM_SECTION_DEPTH[bd.section],
    examWeight: bd.weight,
    depthRatio: bd.depthRatio,
  };
}

function mapSectionCoverage(sc: SectionCoverage): BlueprintSectionItem {
  return {
    section: sc.section as string,
    label: sc.label,
    attemptCount: sc.attemptCount,
    expectedDepth: EXAM_SECTION_DEPTH[sc.section],
    status: sc.status as SectionCoverageStatus,
    examWeight: sc.examWeight,
  };
}

function mapWeaknessTopic(wt: WeaknessTopic): WeaknessSignalItem {
  return {
    topic: wt.topic,
    label: wt.label,
    riskScore: wt.riskScore,
    wrongCount: wt.wrongCount,
    totalAttempts: wt.totalAttempts,
    accuracy: wt.accuracy,
    confidence: wt.confidence as ConfidenceLevel,
    patternObservation: wt.patternObservation
      ? {
          selectedOption: wt.patternObservation.selectedOption,
          occurrenceCount: wt.patternObservation.occurrenceCount,
          exampleOptionText: wt.patternObservation.exampleOptionText,
          confidence: wt.patternObservation.confidence as ConfidenceLevel,
          studentVisible: wt.patternObservation.studentVisible,
        }
      : null,
    notebookContext: wt.notebookContext
      ? {
          entryCount: wt.notebookContext.entryCount,
          totalOccurrences: wt.notebookContext.totalOccurrences,
          isRemedialFlagged: wt.notebookContext.isRemedialFlagged,
          mostRecentEntry: wt.notebookContext.mostRecentEntry
            ? {
                reason: wt.notebookContext.mostRecentEntry.reason,
                studentAnswer: wt.notebookContext.mostRecentEntry.studentAnswer,
                correctAnswer: wt.notebookContext.mostRecentEntry.correctAnswer,
                reviewStage: wt.notebookContext.mostRecentEntry.reviewStage,
                lastReviewedAt:
                  wt.notebookContext.mostRecentEntry.lastReviewedAt instanceof Date
                    ? wt.notebookContext.mostRecentEntry.lastReviewedAt.toISOString()
                    : wt.notebookContext.mostRecentEntry.lastReviewedAt,
              }
            : null,
        }
      : null,
    wrongAnswers: wt.wrongAttempts.map((wa) => ({
      questionCode: wa.questionCode,
      promptText: wa.promptText,
      selectedOption: wa.selectedOption,
      correctOption: wa.correctOption,
      explanationVi: wa.explanationVi,
      commonMistake: wa.commonMistake,
    })),
  };
}

function mapTopicComparison(tc: TopicComparison): TopicComparisonItem {
  return {
    topic: tc.topic,
    label: tc.label,
    direction: tc.direction as ComparisonDirection,
    delta: tc.delta,
    confidence: tc.confidence as ConfidenceLevel,
    session1: tc.session1,
    session2: tc.session2,
  };
}

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
  OBSERVED: 0,
  EMERGING: 1,
  CONFIRMED: 2,
};

/** Derive the most conservative confidence across all comparable topics. */
function overallComparisonConfidence(topics: TopicComparisonItem[]): ConfidenceLevel {
  const comparable = topics.filter((t) => t.direction !== "INSUFFICIENT_DATA");
  if (comparable.length === 0) return "OBSERVED";
  return comparable.reduce<ConfidenceLevel>(
    (lowest, t) =>
      CONFIDENCE_ORDER[t.confidence] < CONFIDENCE_ORDER[lowest] ? t.confidence : lowest,
    "CONFIRMED"
  );
}

// ──────────────────────────────────────────────────────────────────
// Public API — the two mapping functions used by route handlers
// ──────────────────────────────────────────────────────────────────

/**
 * Convert service output → API contract for session analytics.
 * Called in GET /api/analytics/session/[sessionNumber].
 */
export function toSessionAnalyticsResponse(
  output: SessionAnalyticsOutput
): SessionAnalyticsResponse {
  const confidence = output.readiness.confidence as ConfidenceLevel;

  return {
    sessionNumber: output.sessionNumber,
    generatedAt: output.generatedAt,
    confidence,
    readiness: {
      score: output.readiness.readinessScore,
      band: output.readiness.band as ReadinessBand,
      confidence,
      insufficientData: output.readiness.insufficientData,
    },
    blueprintCoverage: {
      assessedCount: output.blueprintCoverage.assessedCount,
      partialCount: output.blueprintCoverage.partialCount,
      unassessedCount: output.blueprintCoverage.unassessedCount,
      sections: output.blueprintCoverage.sections.map(mapSectionCoverage),
    },
    weaknessSignals: output.weaknessTopics.map(mapWeaknessTopic),
    sectionBreakdown: output.readiness.sectionBreakdown.map(mapSectionBreakdown),
  };
}

/**
 * Convert service output → API contract for session comparison.
 * Called in GET /api/analytics/compare/[sessionA]/[sessionB].
 */
export function toSessionComparisonResponse(
  result: SessionComparisonResult
): SessionComparisonResponse {
  const topics = result.topics.map(mapTopicComparison);

  return {
    session1Number: result.session1Number,
    session2Number: result.session2Number,
    confidence: overallComparisonConfidence(topics),
    topics,
    summary: {
      improvedCount: result.improvedCount,
      declinedCount: result.declinedCount,
      insufficientDataCount: result.insufficientDataCount,
    },
  };
}
