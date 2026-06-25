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
  fetchSessionComparisonData,
  NotebookContextRow,
} from "./repository";
import {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
  computeSessionComparison,
} from "./sessionAnalytics";
import type {
  BlueprintCoverage,
  ReadinessResult,
  WeaknessTopic,
  NotebookContext,
  SessionComparisonResult,
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
 * Compute full analytics for one curriculum session.
 *
 * Fetches session attempts, runs all analytics computations, then
 * fetches notebook context only if there are weakness topics to enrich.
 * This avoids an unnecessary DB round-trip for perfect-score sessions.
 */
export async function getSessionAnalytics(
  userId: string,
  curriculumSessionId: string,
  sessionNumber: number
): Promise<SessionAnalyticsOutput> {
  const attempts = await fetchSessionAttempts(userId, curriculumSessionId);

  const readiness = computeReadiness(attempts, [sessionNumber]);
  const blueprintCoverage = computeBlueprintCoverage(attempts);
  const rawWeakness = computeWeaknessSignals(attempts, 3);

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

/**
 * Compare per-topic accuracy between two curriculum sessions.
 *
 * Returns a topic-by-topic delta view showing which areas improved,
 * declined, or stayed similar. Topics with insufficient data in either
 * session are included with direction INSUFFICIENT_DATA rather than omitted,
 * so the UI can explain the gap.
 */
export async function getSessionComparison(
  userId: string,
  sessionAId: string,
  sessionBId: string,
  sessionANumber: number,
  sessionBNumber: number
): Promise<SessionComparisonResult> {
  const { sessionA, sessionB } = await fetchSessionComparisonData(
    userId,
    sessionAId,
    sessionBId
  );

  return computeSessionComparison(sessionA, sessionB, sessionANumber, sessionBNumber);
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
