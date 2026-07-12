/**
 * Generation Context Builder — M4.2
 *
 * Pure deterministic functions that translate a KnowledgeGap into a
 * GenerationContext — the structured request passed to the AI provider.
 *
 * Architecture: no Prisma, no AI, no side effects.
 *   knowledgeGap.ts (pure) → contextBuilder.ts (pure) → aiDraftGenerator.ts (AI + Prisma)
 *
 * The builder answers three questions:
 *   1. What topic and label does the AI need?  (from KnowledgeUnit)
 *   2. How many questions are actually needed? (clamp requestedCount to gap.missing)
 *   3. What objective text grounds the AI prompt? (human-readable, not injected into prompt yet)
 */

import type { KnowledgeUnitInput, KnowledgeGap } from "@/lib/services/content-intelligence/types";

// ─────────────────────────────────────────────────────────
// Output type
// ─────────────────────────────────────────────────────────

export interface GenerationContext {
  topic: string;
  topicLabel: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  // Effective count: Math.min(requestedCount, gap.missing[difficulty]).
  // Never zero — callers must check gap.missing[difficulty] > 0 before building.
  count: number;
  // Human-readable statement of what this job is filling.
  // Surfaced in admin UI job records; not injected into AI prompt directly.
  objective: string;
  // Snapshot of the full missing breakdown at build time (for audit / UI).
  missingCounts: { easy: number; medium: number; hard: number };
}

// ─────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────

/**
 * Return how many questions the gap actually needs for a given difficulty band,
 * clamped by the caller's requested count.
 *
 * Returns 0 if the band is already at or above target — callers should check
 * for this before creating a generation job.
 */
export function deriveCountFromGap(
  gap: KnowledgeGap,
  difficulty: "EASY" | "MEDIUM" | "HARD",
  requestedCount: number,
): number {
  const bandMissing =
    difficulty === "EASY"
      ? gap.missing.easy
      : difficulty === "MEDIUM"
        ? gap.missing.medium
        : gap.missing.hard;
  return Math.min(requestedCount, bandMissing);
}

function buildObjective(
  topicLabel: string,
  topic: string,
  difficulty: "EASY" | "MEDIUM" | "HARD",
  count: number,
  bandMissing: number,
): string {
  return `Generate ${count} ${difficulty} question(s) for '${topicLabel}' (${topic}). Knowledge bank is short ${bandMissing} ${difficulty} question(s) in this topic.`;
}

// ─────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────

/**
 * Build a GenerationContext from a KnowledgeUnit + gap + target params.
 *
 * @param unit           The KnowledgeUnit being targeted
 * @param gap            The detected gap for that unit (from knowledgeGap.ts)
 * @param difficulty     Which difficulty band to fill
 * @param requestedCount Admin's requested count — clamped to the actual gap
 *
 * @throws if requestedCount < 1 or the band has no gap (count would be 0).
 *         Caller is responsible for ensuring a real gap exists before calling.
 */
export function buildGenerationContext(
  unit: KnowledgeUnitInput,
  gap: KnowledgeGap,
  difficulty: "EASY" | "MEDIUM" | "HARD",
  requestedCount: number,
): GenerationContext {
  if (requestedCount < 1) {
    throw new Error(`requestedCount must be >= 1, got ${requestedCount}`);
  }

  const bandMissing =
    difficulty === "EASY"
      ? gap.missing.easy
      : difficulty === "MEDIUM"
        ? gap.missing.medium
        : gap.missing.hard;

  const count = Math.min(requestedCount, bandMissing);

  if (count === 0) {
    throw new Error(
      `No gap exists for topic '${unit.topic}' at difficulty ${difficulty} — band is already at or above target`,
    );
  }

  return {
    topic: unit.topic,
    topicLabel: unit.label,
    difficulty,
    count,
    objective: buildObjective(unit.label, unit.topic, difficulty, count, bandMissing),
    missingCounts: { ...gap.missing },
  };
}
