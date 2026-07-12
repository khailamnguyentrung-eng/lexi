/**
 * Content Intelligence — shared types (M3.2)
 *
 * These types are the contract between the pure engines
 * (knowledgeCoverage, knowledgeGap) and the service layer
 * (knowledgeMapping). No Prisma types cross this boundary.
 */

// ─────────────────────────────────────────────────────────
// Input types — pre-fetched data passed to pure engines
// ─────────────────────────────────────────────────────────

export interface KnowledgeUnitInput {
  id: string;
  topic: string;
  label: string;
  targetEasyCount: number;
  targetMediumCount: number;
  targetHardCount: number;
}

export interface QuestionInput {
  id: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  knowledgeUnitId: string | null;
}

// ─────────────────────────────────────────────────────────
// Output types — produced by pure engines
// ─────────────────────────────────────────────────────────

export interface DifficultyBreakdown {
  easy: number;
  medium: number;
  hard: number;
}

export type CoverageStatus = "COMPLETE" | "PARTIAL" | "UNDER_COVERED";

export type GapPriority = "HIGH" | "MEDIUM" | "LOW";

export interface CoverageReport {
  knowledgeUnitId: string;
  topic: string;
  label: string;
  targets: DifficultyBreakdown;
  actual: DifficultyBreakdown;
  // Percentage of target questions that are covered, capped per band:
  // sum(min(actual[band], target[band])) / sum(target[band]) * 100
  // Extra questions above target do not inflate the percentage.
  coveragePercentage: number;
  status: CoverageStatus;
}

export interface KnowledgeGap {
  knowledgeUnitId: string;
  topic: string;
  label: string;
  missing: DifficultyBreakdown; // max(0, target - actual) per band
  priority: GapPriority;
}

// ─────────────────────────────────────────────────────────
// Aggregate report — returned by the service layer
// ─────────────────────────────────────────────────────────

export interface KnowledgeCoverageReport {
  generatedAt: string;
  totalUnits: number;
  completeUnits: number;
  partialUnits: number;
  underCoveredUnits: number;
  coverageReports: CoverageReport[];
  gaps: KnowledgeGap[]; // priority-sorted: HIGH first
}
