/**
 * Difficulty Calibration Engine — M2.3
 *
 * Pure functions that derive a difficulty target from a student's recent
 * topic-level accuracy, then re-weight question selection accordingly.
 *
 * Rules:
 *   - No Prisma inside these functions.
 *   - No AI.
 *   - No mood, behavior profile, or self-reported preference as input.
 *   - Difficulty target is derived only from observed accuracy (isCorrect).
 *
 * Architecture:
 *   Repository (getPracticeQuestions in curriculum.ts) feeds pre-fetched attempts
 *   to computeDifficultyTarget(), then passes the target to applyDifficultyWeighting()
 *   to select from the available question pool.
 */

// ─────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────

export type DifficultyTarget = "EASY" | "MEDIUM" | "HARD";

export interface AttemptForCalibration {
  isCorrect: boolean;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface DifficultyWeights {
  EASY: number;   // fraction of selected questions pulled from EASY pool
  MEDIUM: number;
  HARD: number;   // all three sum to 1.0
}

// ─────────────────────────────────────────────────────────
// Pure functions
// ─────────────────────────────────────────────────────────

/**
 * Derive a difficulty target from recent attempt accuracy on a topic or session.
 *
 * Returns null when there are fewer than minSamples attempts — the caller
 * should return the question set unchanged (no calibration applied).
 *
 * Accuracy thresholds:
 *   > 0.80 → HARD    (student is mastering — increase challenge)
 *   ≥ 0.50 → MEDIUM  (working zone — maintain current level)
 *   < 0.50 → EASY    (struggling — reduce friction, build confidence)
 *
 * Input accuracy is based solely on isCorrect — no difficulty weighting,
 * no mood signal, no response-time adjustment.
 */
export function computeDifficultyTarget(
  recentAttempts: AttemptForCalibration[],
  minSamples = 5
): DifficultyTarget | null {
  if (recentAttempts.length < minSamples) return null;
  const accuracy =
    recentAttempts.filter((a) => a.isCorrect).length / recentAttempts.length;
  if (accuracy > 0.8) return "HARD";
  if (accuracy >= 0.5) return "MEDIUM";
  return "EASY";
}

/**
 * Compute question pool selection weights for a given difficulty target.
 *
 * Weights sum to 1.0. Applied proportionally to pool sizes when selecting
 * questions via applyDifficultyWeighting().
 */
export function computeSelectionWeights(target: DifficultyTarget): DifficultyWeights {
  switch (target) {
    case "EASY":
      return { EASY: 0.70, MEDIUM: 0.25, HARD: 0.05 };
    case "MEDIUM":
      return { EASY: 0.20, MEDIUM: 0.55, HARD: 0.25 };
    case "HARD":
      return { EASY: 0.05, MEDIUM: 0.25, HARD: 0.70 };
  }
}

/**
 * Select up to `count` questions from the pool, weighted by DifficultyTarget.
 *
 * When fewer questions are available than `count`, returns all questions unchanged.
 * When a difficulty pool is empty or undersized, its shortfall is redistributed
 * to MEDIUM (the neutral middle tier).
 * The final slice(0, count) is a rounding safety net — the actual selection is
 * deterministic and ordered (EASY → MEDIUM → HARD within the returned set).
 *
 * Generic over T so it is testable with plain objects and usable with Prisma
 * Question types without importing either.
 */
export function applyDifficultyWeighting<T extends { difficulty: string }>(
  questions: T[],
  target: DifficultyTarget,
  count: number
): T[] {
  if (questions.length <= count) return questions;

  const pools = {
    EASY: questions.filter((q) => q.difficulty === "EASY"),
    MEDIUM: questions.filter((q) => q.difficulty === "MEDIUM"),
    HARD: questions.filter((q) => q.difficulty === "HARD"),
  };

  const w = computeSelectionWeights(target);

  // Raw targets from weights (may exceed pool sizes)
  let nEasy = Math.round(w.EASY * count);
  let nMedium = Math.round(w.MEDIUM * count);
  let nHard = Math.round(w.HARD * count);

  // Redistribute shortfalls from EASY and HARD pools to MEDIUM
  const shortEasy = Math.max(0, nEasy - pools.EASY.length);
  const shortHard = Math.max(0, nHard - pools.HARD.length);
  nEasy = Math.min(nEasy, pools.EASY.length);
  nHard = Math.min(nHard, pools.HARD.length);
  nMedium = Math.min(nMedium + shortEasy + shortHard, pools.MEDIUM.length);

  return [
    ...pools.EASY.slice(0, nEasy),
    ...pools.MEDIUM.slice(0, nMedium),
    ...pools.HARD.slice(0, nHard),
  ].slice(0, count);
}
