/**
 * Knowledge Coverage Engine — M3.2
 *
 * Pure deterministic computation of question bank coverage per KnowledgeUnit.
 * Coverage is measured by question count per difficulty band only.
 *
 * Architecture: no Prisma, no AI, no student data, no behavior signals.
 * Service layer (knowledgeMapping.ts) fetches data and calls these functions.
 *
 * Matching strategy:
 *   A question is counted toward a unit when q.topic === unit.topic.
 *   This covers all questions regardless of whether knowledgeUnitId is set,
 *   since existing seeded questions have knowledgeUnitId = null.
 */

import type {
  CoverageReport,
  CoverageStatus,
  DifficultyBreakdown,
  KnowledgeUnitInput,
  QuestionInput,
} from "./types";

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function computeCoveredCount(
  targets: DifficultyBreakdown,
  actual: DifficultyBreakdown
): number {
  return (
    Math.min(actual.easy, targets.easy) +
    Math.min(actual.medium, targets.medium) +
    Math.min(actual.hard, targets.hard)
  );
}

function computeTotalTarget(targets: DifficultyBreakdown): number {
  return targets.easy + targets.medium + targets.hard;
}

function computeCoveragePercentage(
  targets: DifficultyBreakdown,
  actual: DifficultyBreakdown
): number {
  const total = computeTotalTarget(targets);
  if (total === 0) return 100;
  return Math.round((computeCoveredCount(targets, actual) / total) * 100);
}

function computeStatus(
  targets: DifficultyBreakdown,
  actual: DifficultyBreakdown,
  percentage: number
): CoverageStatus {
  // COMPLETE: every band meets or exceeds its target
  if (
    actual.easy >= targets.easy &&
    actual.medium >= targets.medium &&
    actual.hard >= targets.hard
  ) {
    return "COMPLETE";
  }
  // UNDER_COVERED: no questions at all, or overall fill rate below 50%
  const totalActual = actual.easy + actual.medium + actual.hard;
  if (totalActual === 0 || percentage < 50) {
    return "UNDER_COVERED";
  }
  // PARTIAL: some coverage but not all targets met
  return "PARTIAL";
}

// ─────────────────────────────────────────────────────────
// Exported pure engine functions
// ─────────────────────────────────────────────────────────

/**
 * Compute the coverage report for a single KnowledgeUnit.
 * @param unit  - the unit to evaluate
 * @param questions - the full question bank (engine filters by topic internally)
 */
export function computeCoverageReport(
  unit: KnowledgeUnitInput,
  questions: QuestionInput[]
): CoverageReport {
  const unitQuestions = questions.filter((q) => q.topic === unit.topic);

  const actual: DifficultyBreakdown = {
    easy: unitQuestions.filter((q) => q.difficulty === "EASY").length,
    medium: unitQuestions.filter((q) => q.difficulty === "MEDIUM").length,
    hard: unitQuestions.filter((q) => q.difficulty === "HARD").length,
  };

  const targets: DifficultyBreakdown = {
    easy: unit.targetEasyCount,
    medium: unit.targetMediumCount,
    hard: unit.targetHardCount,
  };

  const coveragePercentage = computeCoveragePercentage(targets, actual);

  return {
    knowledgeUnitId: unit.id,
    topic: unit.topic,
    label: unit.label,
    targets,
    actual,
    coveragePercentage,
    status: computeStatus(targets, actual, coveragePercentage),
  };
}

/**
 * Compute coverage reports for all KnowledgeUnits.
 * Results are ordered by coveragePercentage ascending (most under-covered first).
 */
export function computeAllCoverageReports(
  units: KnowledgeUnitInput[],
  questions: QuestionInput[]
): CoverageReport[] {
  return units
    .map((unit) => computeCoverageReport(unit, questions))
    .sort((a, b) => a.coveragePercentage - b.coveragePercentage);
}
