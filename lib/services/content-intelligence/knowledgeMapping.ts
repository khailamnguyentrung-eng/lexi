/**
 * Knowledge Mapping Service — M3.2 (refactored in M3.3)
 *
 * Aggregate coverage reporting only. Individual question ↔ KnowledgeUnit
 * CRUD operations live in questionKnowledgeMapping.ts (M3.3).
 *
 * Architecture: this is the repository + service orchestration layer.
 *   questionKnowledgeMapping (individual ops)
 *   knowledgeMapping (aggregate) → knowledgeCoverage (pure) → KnowledgeCoverageReport
 */

import { prisma } from "@/lib/db/prisma";
import type { KnowledgeUnitInput, QuestionInput, KnowledgeCoverageReport } from "./types";
import { computeAllCoverageReports } from "./knowledgeCoverage";
import { detectGaps } from "./knowledgeGap";

// ─────────────────────────────────────────────────────────
// Repository queries (private — service layer only)
// ─────────────────────────────────────────────────────────

async function fetchAllKnowledgeUnits(): Promise<KnowledgeUnitInput[]> {
  const rows = await prisma.knowledgeUnit.findMany({
    select: {
      id: true,
      topic: true,
      label: true,
      targetEasyCount: true,
      targetMediumCount: true,
      targetHardCount: true,
    },
    orderBy: { topic: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    label: r.label,
    targetEasyCount: r.targetEasyCount,
    targetMediumCount: r.targetMediumCount,
    targetHardCount: r.targetHardCount,
  }));
}

async function fetchAllQuestions(): Promise<QuestionInput[]> {
  const rows = await prisma.question.findMany({
    select: {
      id: true,
      topic: true,
      difficulty: true,
      knowledgeUnitId: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    difficulty: r.difficulty as "EASY" | "MEDIUM" | "HARD",
    knowledgeUnitId: r.knowledgeUnitId,
  }));
}

// ─────────────────────────────────────────────────────────
// Public service functions
// ─────────────────────────────────────────────────────────

/**
 * Return all KnowledgeUnits (lightweight listing, no question counts).
 */
export async function getAllKnowledgeUnits() {
  return prisma.knowledgeUnit.findMany({
    select: {
      id: true,
      topic: true,
      label: true,
      targetEasyCount: true,
      targetMediumCount: true,
      targetHardCount: true,
    },
    orderBy: { topic: "asc" },
  });
}

// ─────────────────────────────────────────────────────────
// Full coverage report — orchestrates repository + pure engines
// ─────────────────────────────────────────────────────────

/**
 * Compute the full knowledge coverage report.
 * Fetches all KnowledgeUnits and Questions in parallel, then runs the
 * pure coverage engine and gap detection — no student data, no AI.
 */
export async function getKnowledgeCoverageReport(): Promise<KnowledgeCoverageReport> {
  const [units, questions] = await Promise.all([
    fetchAllKnowledgeUnits(),
    fetchAllQuestions(),
  ]);

  const coverageReports = computeAllCoverageReports(units, questions);
  const gaps = detectGaps(coverageReports);

  return {
    generatedAt: new Date().toISOString(),
    totalUnits: units.length,
    completeUnits: coverageReports.filter((r) => r.status === "COMPLETE").length,
    partialUnits: coverageReports.filter((r) => r.status === "PARTIAL").length,
    underCoveredUnits: coverageReports.filter((r) => r.status === "UNDER_COVERED").length,
    coverageReports,
    gaps,
  };
}
