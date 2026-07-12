/**
 * Knowledge Gap Detection Engine — M3.2
 *
 * Pure deterministic detection of content gaps from coverage reports.
 * A gap exists when a KnowledgeUnit has not reached its target question counts
 * in one or more difficulty bands.
 *
 * Priority rules:
 *   HIGH   — any hard questions missing
 *   MEDIUM — hard target met but medium questions missing
 *   LOW    — easy questions missing only
 *
 * Architecture: no Prisma, no AI, no student performance data.
 */

import type {
  CoverageReport,
  DifficultyBreakdown,
  GapPriority,
  KnowledgeGap,
} from "./types";

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

function computeMissing(
  targets: DifficultyBreakdown,
  actual: DifficultyBreakdown
): DifficultyBreakdown {
  return {
    easy: Math.max(0, targets.easy - actual.easy),
    medium: Math.max(0, targets.medium - actual.medium),
    hard: Math.max(0, targets.hard - actual.hard),
  };
}

function derivePriority(missing: DifficultyBreakdown): GapPriority {
  if (missing.hard > 0) return "HIGH";
  if (missing.medium > 0) return "MEDIUM";
  return "LOW";
}

const PRIORITY_ORDER: Record<GapPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ─────────────────────────────────────────────────────────
// Exported pure engine functions
// ─────────────────────────────────────────────────────────

/**
 * Detect all gaps from a set of coverage reports.
 * COMPLETE units are excluded. Results are sorted: HIGH → MEDIUM → LOW,
 * then by total missing questions descending within each priority band.
 */
export function detectGaps(reports: CoverageReport[]): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  for (const report of reports) {
    if (report.status === "COMPLETE") continue;

    const missing = computeMissing(report.targets, report.actual);
    const totalMissing = missing.easy + missing.medium + missing.hard;

    if (totalMissing === 0) continue; // defensive: PARTIAL with no actual deficit

    gaps.push({
      knowledgeUnitId: report.knowledgeUnitId,
      topic: report.topic,
      label: report.label,
      missing,
      priority: derivePriority(missing),
    });
  }

  return gaps.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const totalA = a.missing.easy + a.missing.medium + a.missing.hard;
    const totalB = b.missing.easy + b.missing.medium + b.missing.hard;
    return totalB - totalA;
  });
}

/**
 * Filter gaps by priority level.
 */
export function filterGapsByPriority(
  gaps: KnowledgeGap[],
  priority: GapPriority
): KnowledgeGap[] {
  return gaps.filter((g) => g.priority === priority);
}
