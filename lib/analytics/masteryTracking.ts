import { getTopicNotebookSummaries } from "./notebookIntelligence";
import type { TopicNotebookSummary } from "./notebookIntelligence";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * Derived mastery state for a canonical topic.
 *
 * Computed from TopicNotebookSummary — no additional DB queries.
 * Never stored; always re-derived on demand.
 *
 * NEEDS_REVIEW — struggling, newly logged, or regressed after review
 * IMPROVING    — accuracy is rising but below mastery threshold
 * STABLE       — consistently performing well across multiple review cycles
 * MASTERED     — full review cycle completed with sustained high accuracy,
 *                or all notebook entries explicitly MASTERED
 */
export type MasteryState = "NEEDS_REVIEW" | "IMPROVING" | "STABLE" | "MASTERED";

export interface TopicMasteryProfile {
  topic: string;
  label: string;
  masteryState: MasteryState;
  summary: TopicNotebookSummary;
}

// ─────────────────────────────────────────────────────────
// Pure functions (no DB access)
// ─────────────────────────────────────────────────────────

/**
 * Derive mastery state from a topic's notebook summary.
 * Pure — deterministic, no side effects, no DB access.
 *
 * Evaluation order (first match wins):
 *
 *   MASTERED:
 *     1. All entries explicitly MASTERED (masteredCount === entryCount)
 *     2. Full spaced-rep cycle complete (stage ≥ 4) + IMPROVED signal
 *        + postAccuracy ≥ 0.80 + not remedial-flagged
 *        (remedial topics must earn MASTERED entry-by-entry, not via accuracy alone)
 *
 *   STABLE:
 *     3. IMPROVED signal + postAccuracy ≥ 0.75 + stage ≥ 2
 *        (proven accuracy after two review cycles)
 *     4. IMPROVING signal + postAccuracy ≥ 0.70 + stage ≥ 3
 *        (still improving but far along the review cycle)
 *
 *   IMPROVING:
 *     5. IMPROVED or IMPROVING signal + postAccuracy ≥ 0.50
 *        (a single IMPROVED cycle lands here if stage < 2 — not yet sustained)
 *
 *   NEEDS_REVIEW (default):
 *     - RECURRING or NO_DATA signal
 *     - postAccuracy < 0.50 regardless of signal
 *     - lastReviewedAt === null (never reviewed)
 *     - anything not matched above
 */
export function computeTopicMastery(s: TopicNotebookSummary): MasteryState {
  // ── MASTERED ──────────────────────────────────────────

  // Path 1: all notebook entries explicitly marked MASTERED
  if (s.masteredCount === s.entryCount && s.entryCount > 0) {
    return "MASTERED";
  }

  // Path 2: completed full spaced-rep cycle with demonstrated accuracy
  // Remedial-flagged topics are excluded — they need entry-level MASTERED,
  // not just a good accuracy run.
  if (
    s.maxReviewStage >= 4 &&
    s.improvementSignal === "IMPROVED" &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.8 &&
    !s.isRemedialFlagged
  ) {
    return "MASTERED";
  }

  // ── STABLE ────────────────────────────────────────────

  // Path 3: IMPROVED signal + strong accuracy + reviewed at least twice
  if (
    s.improvementSignal === "IMPROVED" &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.75 &&
    s.maxReviewStage >= 2
  ) {
    return "STABLE";
  }

  // Path 4: far into review cycle + steadily improving accuracy
  if (
    s.maxReviewStage >= 3 &&
    s.improvementSignal === "IMPROVING" &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.7
  ) {
    return "STABLE";
  }

  // ── IMPROVING ─────────────────────────────────────────

  // Path 5: accuracy is meaningfully above floor and heading in the right direction
  // Note: IMPROVED + stage < 2 lands here intentionally — one good cycle
  // isn't enough to call it sustained.
  if (
    (s.improvementSignal === "IMPROVED" || s.improvementSignal === "IMPROVING") &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.5
  ) {
    return "IMPROVING";
  }

  // ── NEEDS_REVIEW (default) ────────────────────────────
  return "NEEDS_REVIEW";
}

/**
 * Count profiles by mastery state.
 * Pure helper — no DB access.
 */
export function countByMasteryState(
  profiles: TopicMasteryProfile[]
): Record<MasteryState, number> {
  const counts: Record<MasteryState, number> = {
    NEEDS_REVIEW: 0,
    IMPROVING: 0,
    STABLE: 0,
    MASTERED: 0,
  };
  for (const p of profiles) {
    counts[p.masteryState] += 1;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────
// Repository function
// ─────────────────────────────────────────────────────────

/**
 * Build mastery profiles for all active notebook topics.
 *
 * Reuses getTopicNotebookSummaries() — no additional DB queries.
 * Topics where all entries are MASTERED are already excluded by
 * getTopicNotebookSummaries() at the source level; those topics
 * never appear in the output here.
 */
export async function getTopicMasteryProfiles(
  userId: string
): Promise<TopicMasteryProfile[]> {
  const summaries = await getTopicNotebookSummaries(userId);
  return summaries.map((s) => ({
    topic: s.topic,
    label: s.label,
    masteryState: computeTopicMastery(s),
    summary: s,
  }));
}
