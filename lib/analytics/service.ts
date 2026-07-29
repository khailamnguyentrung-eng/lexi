/**
 * Analytics service orchestration layer.
 *
 * This module sits between the repository (DB queries) and the pure engine
 * (calculations). It is the only layer that coordinates both.
 *
 * Responsibilities:
 *   - Orchestrate repository calls (never write DB queries here)
 *   - Pass data to pure engine functions (never calculate here)
 *   - Return fully assembled analytics results to route handlers
 *
 * Forbidden imports: @/lib/db/prisma, @prisma/client, @anthropic-ai/sdk,
 *                    @google/genai, any UI component
 */

import {
  fetchSessionAttempts,
  fetchNotebookContext,
  NotebookContextRow,
} from "./repository";
import {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
} from "./sessionAnalytics";
import { loadExamBlueprint } from "./examBlueprint";
import type {
  BlueprintCoverage,
  ReadinessResult,
  WeaknessTopic,
  NotebookContext,
} from "./types";

// ──────────────────────────────────────────────────────────────────
// Output types
// ──────────────────────────────────────────────────────────────────

/**
 * Full analytics output for one session.
 * Returned by getSessionAnalytics() and consumed by the results page route handler.
 */
export interface SessionAnalyticsOutput {
  sessionNumber: number;
  readiness: ReadinessResult;
  blueprintCoverage: BlueprintCoverage;
  weaknessTopics: WeaknessTopic[]; // top 3, notebook-enriched
  generatedAt: string; // ISO timestamp
}

// ──────────────────────────────────────────────────────────────────
// Public service functions
// ──────────────────────────────────────────────────────────────────

/**
 * Compute full analytics for one ProgramCurriculum slot.
 * `sessionNumber` is a caller-supplied display label (the slot's `order`)
 * — the SessionAnalyticsOutput.sessionNumber field name is unchanged since
 * the frontend/`toSessionAnalyticsResponse()` contract reads it by that name
 * (reused generic label, not renamed — same precedent documented elsewhere
 * in this codebase for this exact field).
 *
 * Fetches session attempts, runs all analytics computations, then
 * fetches notebook context only if there are weakness topics to enrich.
 * This avoids an unnecessary DB round-trip for perfect-score sessions.
 */
export async function getSessionAnalytics(
  userId: string,
  programCurriculumId: string,
  sessionNumber: number
): Promise<SessionAnalyticsOutput> {
  const attempts = await fetchSessionAttempts(userId, programCurriculumId);

  // A2: blueprint giờ là dữ liệu trong DB, không còn là hằng số trong code.
  // Nạp ở tầng service (async) rồi truyền xuống các engine thuần — chúng phải
  // giữ đồng bộ và test được không cần DB.
  // Slug đóng cứng "hanoi-g10" là có chủ đích trong A2: mọi câu hỏi hiện có
  // đều thuộc kỳ thi này (A1 đã backfill). Chọn kỳ thi theo ngữ cảnh người
  // học là việc của tiểu dự án B, không phải A2.
  const blueprint = await loadExamBlueprint("hanoi-g10");

  const readiness = computeReadiness(attempts, [sessionNumber], blueprint);
  const blueprintCoverage = computeBlueprintCoverage(attempts, blueprint);
  const rawWeakness = computeWeaknessSignals(attempts, blueprint, 3);

  let weaknessTopics = rawWeakness;

  if (rawWeakness.length > 0) {
    const topics = rawWeakness.map((w) => w.topic);
    const notebookRows = await fetchNotebookContext(userId, topics);
    weaknessTopics = enrichWeaknessWithNotebook(rawWeakness, notebookRows);
  }

  return {
    sessionNumber,
    readiness,
    blueprintCoverage,
    weaknessTopics,
    generatedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────
// Pure enrichment helper (exported for callers with pre-fetched data)
// ──────────────────────────────────────────────────────────────────

/**
 * Merge notebook context into computed weakness topics.
 *
 * Pure function — no DB calls. Exported so that route handlers or tests
 * that already have both datasets can run the merge without fetching again.
 *
 * Topics with no matching notebook entry retain notebookContext: null.
 */
export function enrichWeaknessWithNotebook(
  weaknessTopics: WeaknessTopic[],
  notebookRows: NotebookContextRow[]
): WeaknessTopic[] {
  const byTopic = new Map(notebookRows.map((r) => [r.topic, r]));

  return weaknessTopics.map((topic) => {
    const row = byTopic.get(topic.topic);
    if (!row) return topic;

    const notebookContext: NotebookContext = {
      topic: row.topic,
      entryCount: row.entryCount,
      totalOccurrences: row.totalOccurrences,
      isRemedialFlagged: row.isRemedialFlagged,
      mostRecentEntry: row.mostRecentEntry,
    };

    return { ...topic, notebookContext };
  });
}
