/**
 * Pure analytics calculation functions.
 *
 * This module contains all analytics computations for exam performance analysis.
 * Functions have zero database dependencies — they accept data arrays as input
 * and return typed results. This enables unit testing without mocking Prisma.
 *
 * All functions are deterministic: same input always produces same output.
 *
 * INPUT CONTRACT
 * Callers pass AttemptInput[], which the repository's AttemptWithQuestion
 * satisfies structurally. This keeps the engine free of Prisma imports.
 */

import {
  EXAM_SECTION_WEIGHTS,
  EXAM_SECTION_DEPTH,
  SECTION_LABELS,
  ALL_SECTIONS,
} from "./examBlueprint";
import {
  BlueprintCoverage,
  CoverageStatus,
  ReadinessResult,
  SectionBreakdown,
  WeaknessTopic,
  WrongAttemptDetail,
  PatternObservation,
  TopicComparison,
  SessionComparisonResult,
  ComparisonDirection,
  ConfidenceTier,
} from "./types";
import {
  determineReadinessConfidence,
  determineWeaknessConfidence,
  determinePatternConfidence,
  determineComparisonConfidence,
} from "./confidenceEngine";
import { canonicalTopic } from "./canonicalTopic";

// ──────────────────────────────────────────────────────────────────
// Engine input type — no Prisma dependency
// ──────────────────────────────────────────────────────────────────

/**
 * The minimum attempt shape the engine needs.
 * Structurally compatible with repository.AttemptWithQuestion.
 * Defined here so the engine imports nothing from repository or Prisma.
 */
export interface AttemptInput {
  isCorrect: boolean;
  selectedOption: string;
  attemptedAt: Date;
  timeSpentSec: number | null;
  question: {
    id: string;
    questionCode: string;
    type: string;
    skill: string;
    topic: string;
    difficulty: string;
    promptText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    explanationVi: string;
    commonMistake: string | null;
  };
}

// ──────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────

/** snake_case → "Title Case" for student-facing topic labels. */
function prettifyTopic(topic: string): string {
  return topic
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ──────────────────────────────────────────────────────────────────
// Blueprint coverage (display metric)
// ──────────────────────────────────────────────────────────────────

/**
 * Compute BlueprintCoverage from a set of attempts.
 *
 * Used for UI display only — which sections were touched and at what depth.
 * Does NOT feed into the readiness score (CoverageDepthScore handles that).
 */
export function computeBlueprintCoverage(attempts: AttemptInput[]): BlueprintCoverage {
  const countByType = new Map<string, number>();

  for (const attempt of attempts) {
    const t = attempt.question.type;
    countByType.set(t, (countByType.get(t) ?? 0) + 1);
  }

  const sections = ALL_SECTIONS.map((section) => {
    const count = countByType.get(section) ?? 0;
    const status: CoverageStatus =
      count >= 2 ? "ASSESSED" : count === 1 ? "PARTIAL" : "UNASSESSED";
    return {
      section,
      label: SECTION_LABELS[section],
      attemptCount: count,
      status,
      examWeight: EXAM_SECTION_WEIGHTS[section],
    };
  });

  return {
    sections,
    assessedCount: sections.filter((s) => s.status === "ASSESSED").length,
    partialCount: sections.filter((s) => s.status === "PARTIAL").length,
    unassessedCount: sections.filter((s) => s.status === "UNASSESSED").length,
  };
}

// ──────────────────────────────────────────────────────────────────
// Readiness scoring
// ──────────────────────────────────────────────────────────────────

/**
 * Compute exam readiness score.
 *
 * Formula: ReadinessScore = WeightedTopicMastery × 0.60 + CoverageDepthScore × 0.40
 *
 * CoverageDepthScore measures how thoroughly each section was sampled
 * relative to the real exam's expected question count — no arbitrary
 * totalAttempts gates needed. The only gate is insufficientData when
 * totalAttempts === 0.
 */
export function computeReadiness(
  attempts: AttemptInput[],
  sessionsIncluded: number[]
): ReadinessResult {
  const totalAttempts = attempts.length;
  const sessionCount = sessionsIncluded.length;

  if (totalAttempts === 0) {
    return {
      weightedTopicMastery: 0,
      coverageDepthScore: 0,
      readinessScore: 0,
      band: "NOT_READY",
      sessionsIncluded,
      sectionBreakdown: ALL_SECTIONS.map((section) => ({
        section,
        accuracy: 0,
        attemptCount: 0,
        weight: EXAM_SECTION_WEIGHTS[section],
        contribution: 0,
        depthRatio: 0,
      })),
      insufficientData: true,
      confidence: ConfidenceTier.OBSERVED,
    };
  }

  const bySection = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const type = attempt.question.type;
    const existing = bySection.get(type) ?? { correct: 0, total: 0 };
    existing.total++;
    if (attempt.isCorrect) existing.correct++;
    bySection.set(type, existing);
  }

  let weightedTopicMastery = 0;
  let coverageDepthScore = 0;

  const sectionBreakdown: SectionBreakdown[] = ALL_SECTIONS.map((section) => {
    const data = bySection.get(section);
    const accuracy = data && data.total > 0 ? data.correct / data.total : 0;
    const weight = EXAM_SECTION_WEIGHTS[section];
    const attemptCount = data?.total ?? 0;

    const contribution = accuracy * weight;
    weightedTopicMastery += contribution;

    const expectedDepth = EXAM_SECTION_DEPTH[section];
    const depthRatio =
      expectedDepth > 0 ? Math.min(attemptCount, expectedDepth) / expectedDepth : 0;
    coverageDepthScore += depthRatio * weight;

    return { section, accuracy, attemptCount, weight, contribution, depthRatio };
  });

  const readinessScore = Math.min(
    100,
    Math.round((weightedTopicMastery * 0.6 + coverageDepthScore * 0.4) * 100)
  );

  return {
    weightedTopicMastery,
    coverageDepthScore,
    readinessScore,
    band: scoreToBand(readinessScore),
    sessionsIncluded,
    sectionBreakdown,
    insufficientData: false,
    confidence: determineReadinessConfidence(totalAttempts, sessionCount),
  };
}

function scoreToBand(score: number): ReadinessResult["band"] {
  if (score >= 85) return "EXAM_READY";
  if (score >= 70) return "NEARLY_READY";
  if (score >= 55) return "DEVELOPING";
  return "NOT_READY";
}

// ──────────────────────────────────────────────────────────────────
// Weakness signals
// ──────────────────────────────────────────────────────────────────

/**
 * Compute top-N weakness topics from a set of attempts.
 *
 * Risk score = Σ examWeight for each wrong attempt on the topic.
 * Weighting by section importance means a wrong Grammar MCQ answer
 * (weight 0.375) matters more than a wrong Phonetics answer (weight 0.05).
 *
 * Returns at most topN topics, sorted by riskScore descending.
 * notebookContext is null — the service layer enriches it after fetching.
 */
export function computeWeaknessSignals(
  attempts: AttemptInput[],
  topN = 3
): WeaknessTopic[] {
  // Accumulate per canonical topic
  const topicMap = new Map<
    string,
    {
      totalAttempts: number;
      wrongAttempts: AttemptInput[];
      allAttempts: AttemptInput[];
    }
  >();

  for (const attempt of attempts) {
    const topic = canonicalTopic(attempt.question.topic);
    const existing = topicMap.get(topic) ?? {
      totalAttempts: 0,
      wrongAttempts: [],
      allAttempts: [],
    };
    existing.totalAttempts++;
    existing.allAttempts.push(attempt);
    if (!attempt.isCorrect) existing.wrongAttempts.push(attempt);
    topicMap.set(topic, existing);
  }

  const results: WeaknessTopic[] = [];

  for (const [topic, { totalAttempts, wrongAttempts, allAttempts }] of topicMap) {
    if (wrongAttempts.length === 0) continue;

    // riskScore: sum of section weights for wrong attempts
    // Cast via Record<string, number> because a.question.type comes from the
    // AttemptInput interface (string), not the Prisma QuestionType enum.
    const weights = EXAM_SECTION_WEIGHTS as Record<string, number>;
    const riskScore = wrongAttempts.reduce(
      (sum, a) => sum + (weights[a.question.type] ?? 0),
      0
    );

    const wrongCount = wrongAttempts.length;
    const accuracy = (totalAttempts - wrongCount) / totalAttempts;

    const wrongAttemptDetails: WrongAttemptDetail[] = wrongAttempts.map((a) => ({
      questionId: a.question.id,
      questionCode: a.question.questionCode,
      promptText: a.question.promptText,
      selectedOption: a.selectedOption,
      correctOption: a.question.correctOption,
      explanationVi: a.question.explanationVi,
      commonMistake: a.question.commonMistake,
      questionType: a.question.type as any,
      difficulty: a.question.difficulty as any,
      optionA: a.question.optionA,
      optionB: a.question.optionB,
      optionC: a.question.optionC,
      optionD: a.question.optionD,
    }));

    results.push({
      topic,
      label: prettifyTopic(topic),
      riskScore,
      wrongCount,
      totalAttempts,
      accuracy,
      confidence: determineWeaknessConfidence(wrongCount, totalAttempts),
      wrongAttempts: wrongAttemptDetails,
      patternObservation: detectPatternObservation(wrongAttempts, allAttempts),
      notebookContext: null, // enriched by service layer
    });
  }

  results.sort((a, b) => b.riskScore - a.riskScore);
  return results.slice(0, topN);
}

/**
 * Detect whether wrong answers on a topic share a repeated selected option.
 *
 * N=2: tutor-only (studentVisible: false) — 33% chance of coincidence.
 * N≥3: student-visible — confidence assigned by determinePatternConfidence.
 * N<2: null (no pattern worth noting).
 */
function detectPatternObservation(
  wrongAttempts: AttemptInput[],
  _allAttempts: AttemptInput[]
): PatternObservation | null {
  if (wrongAttempts.length < 2) return null;

  // Count frequency of each selected option
  const optionCounts = new Map<string, number>();
  for (const a of wrongAttempts) {
    optionCounts.set(a.selectedOption, (optionCounts.get(a.selectedOption) ?? 0) + 1);
  }

  // Find the most-repeated option
  let maxOption = "";
  let maxCount = 0;
  for (const [option, count] of optionCounts) {
    if (count > maxCount) {
      maxOption = option;
      maxCount = count;
    }
  }

  if (maxCount < 2) return null;

  // Find the text of that option from any attempt that selected it
  const exampleAttempt = wrongAttempts.find((a) => a.selectedOption === maxOption);
  const exampleOptionText = exampleAttempt
    ? optionText(exampleAttempt, maxOption)
    : maxOption;

  const studentVisible = maxCount >= 3;

  return {
    selectedOption: maxOption,
    occurrenceCount: maxCount,
    exampleOptionText,
    confidence: studentVisible ? determinePatternConfidence(maxCount) : ConfidenceTier.OBSERVED,
    studentVisible,
  };
}

function optionText(attempt: AttemptInput, option: string): string {
  switch (option) {
    case "A": return attempt.question.optionA;
    case "B": return attempt.question.optionB;
    case "C": return attempt.question.optionC;
    case "D": return attempt.question.optionD;
    default: return option;
  }
}

// ──────────────────────────────────────────────────────────────────
// Session comparison
// ──────────────────────────────────────────────────────────────────

/**
 * Compare per-topic accuracy between two sessions.
 *
 * Only topics with ≥2 attempts in BOTH sessions produce a meaningful delta.
 * Topics with data in only one session are still included with direction
 * INSUFFICIENT_DATA so the UI can explain the gap rather than silently omitting.
 *
 * "Similar" band: |delta| < 0.10 (10 percentage points).
 */
export function computeSessionComparison(
  sessionAAttempts: AttemptInput[],
  sessionBAttempts: AttemptInput[],
  sessionANumber: number,
  sessionBNumber: number
): SessionComparisonResult {
  const groupByTopic = (attempts: AttemptInput[]) => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      const topic = canonicalTopic(a.question.topic);
      const existing = map.get(topic) ?? { correct: 0, total: 0 };
      existing.total++;
      if (a.isCorrect) existing.correct++;
      map.set(topic, existing);
    }
    return map;
  };

  const groupA = groupByTopic(sessionAAttempts);
  const groupB = groupByTopic(sessionBAttempts);

  // Union of all topics that appear in either session
  const allTopics = new Set([...groupA.keys(), ...groupB.keys()]);

  const topics: TopicComparison[] = [];
  let improvedCount = 0;
  let declinedCount = 0;
  let insufficientDataCount = 0;

  for (const topic of allTopics) {
    const a = groupA.get(topic) ?? null;
    const b = groupB.get(topic) ?? null;

    const session1 = a
      ? { correct: a.correct, total: a.total, accuracy: a.correct / a.total }
      : null;
    const session2 = b
      ? { correct: b.correct, total: b.total, accuracy: b.correct / b.total }
      : null;

    // Both sessions need ≥2 attempts to produce a meaningful comparison
    const enoughDataA = (a?.total ?? 0) >= 2;
    const enoughDataB = (b?.total ?? 0) >= 2;
    const canCompare = enoughDataA && enoughDataB;

    let delta: number | null = null;
    let direction: ComparisonDirection;

    if (canCompare && session1 && session2) {
      delta = session2.accuracy - session1.accuracy;
      if (delta > 0.10) {
        direction = "IMPROVED";
        improvedCount++;
      } else if (delta < -0.10) {
        direction = "DECLINED";
        declinedCount++;
      } else {
        direction = "SIMILAR";
      }
    } else {
      direction = "INSUFFICIENT_DATA";
      insufficientDataCount++;
    }

    topics.push({
      topic,
      label: prettifyTopic(topic),
      session1,
      session2,
      delta,
      direction,
      confidence: determineComparisonConfidence(a?.total ?? null, b?.total ?? null),
    });
  }

  // Sort: comparable topics first (IMPROVED/DECLINED/SIMILAR), then INSUFFICIENT_DATA
  topics.sort((a, b) => {
    const order = (d: ComparisonDirection) =>
      d === "INSUFFICIENT_DATA" ? 1 : 0;
    return order(a.direction) - order(b.direction);
  });

  return {
    session1Number: sessionANumber,
    session2Number: sessionBNumber,
    topics,
    improvedCount,
    declinedCount,
    insufficientDataCount,
  };
}
