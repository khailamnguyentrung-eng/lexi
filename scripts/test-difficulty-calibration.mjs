/**
 * test-difficulty-calibration.mjs
 *
 * Validates all pure functions from lib/analytics/difficultyCalibration.ts.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions.
 *
 * Run: node scripts/test-difficulty-calibration.mjs
 */

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ── Inlined pure functions (mirrors lib/analytics/difficultyCalibration.ts) ──

function computeDifficultyTarget(recentAttempts, minSamples = 5) {
  if (recentAttempts.length < minSamples) return null;
  const accuracy =
    recentAttempts.filter((a) => a.isCorrect).length / recentAttempts.length;
  if (accuracy > 0.8) return "HARD";
  if (accuracy >= 0.5) return "MEDIUM";
  return "EASY";
}

function computeSelectionWeights(target) {
  switch (target) {
    case "EASY":   return { EASY: 0.70, MEDIUM: 0.25, HARD: 0.05 };
    case "MEDIUM": return { EASY: 0.20, MEDIUM: 0.55, HARD: 0.25 };
    case "HARD":   return { EASY: 0.05, MEDIUM: 0.25, HARD: 0.70 };
  }
}

function applyDifficultyWeighting(questions, target, count) {
  if (questions.length <= count) return questions;

  const pools = {
    EASY:   questions.filter((q) => q.difficulty === "EASY"),
    MEDIUM: questions.filter((q) => q.difficulty === "MEDIUM"),
    HARD:   questions.filter((q) => q.difficulty === "HARD"),
  };

  const w = computeSelectionWeights(target);

  let nEasy   = Math.round(w.EASY   * count);
  let nMedium = Math.round(w.MEDIUM * count);
  let nHard   = Math.round(w.HARD   * count);

  const shortEasy = Math.max(0, nEasy - pools.EASY.length);
  const shortHard = Math.max(0, nHard - pools.HARD.length);
  nEasy   = Math.min(nEasy,   pools.EASY.length);
  nHard   = Math.min(nHard,   pools.HARD.length);
  nMedium = Math.min(nMedium + shortEasy + shortHard, pools.MEDIUM.length);

  return [
    ...pools.EASY.slice(0, nEasy),
    ...pools.MEDIUM.slice(0, nMedium),
    ...pools.HARD.slice(0, nHard),
  ].slice(0, count);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function attempts(correctCount, totalCount, difficulty = "MEDIUM") {
  return Array.from({ length: totalCount }, (_, i) => ({
    isCorrect: i < correctCount,
    difficulty,
  }));
}

function questions(nEasy, nMedium, nHard) {
  return [
    ...Array.from({ length: nEasy },   (_, i) => ({ id: `E${i}`, difficulty: "EASY" })),
    ...Array.from({ length: nMedium }, (_, i) => ({ id: `M${i}`, difficulty: "MEDIUM" })),
    ...Array.from({ length: nHard },   (_, i) => ({ id: `H${i}`, difficulty: "HARD" })),
  ];
}

// ── computeDifficultyTarget: accuracy thresholds ──────────────────────────────

console.log("\n── computeDifficultyTarget: accuracy thresholds ─────────────────");

assert("9/10 correct (90%) → HARD",
  computeDifficultyTarget(attempts(9, 10)) === "HARD");

assert("10/10 correct (100%) → HARD",
  computeDifficultyTarget(attempts(10, 10)) === "HARD");

// 80% is the exact boundary: > 0.80 is HARD, = 0.80 is MEDIUM
assert("8/10 correct (80%) exact boundary → MEDIUM",
  computeDifficultyTarget(attempts(8, 10)) === "MEDIUM");

assert("7/10 correct (70%) → MEDIUM",
  computeDifficultyTarget(attempts(7, 10)) === "MEDIUM");

assert("5/10 correct (50%) exact boundary → MEDIUM",
  computeDifficultyTarget(attempts(5, 10)) === "MEDIUM");

assert("4/10 correct (40%) → EASY",
  computeDifficultyTarget(attempts(4, 10)) === "EASY");

assert("0/10 correct (0%) → EASY",
  computeDifficultyTarget(attempts(0, 10)) === "EASY");

// ── computeDifficultyTarget: minSamples guard ─────────────────────────────────

console.log("\n── computeDifficultyTarget: minSamples guard ────────────────────");

assert("0 attempts → null",
  computeDifficultyTarget([]) === null);

assert("4 attempts (below default 5) → null",
  computeDifficultyTarget(attempts(4, 4)) === null);

assert("5 attempts (at default boundary) → not null",
  computeDifficultyTarget(attempts(5, 5)) !== null);

assert("10 attempts → not null",
  computeDifficultyTarget(attempts(9, 10)) !== null);

assert("custom minSamples=3, 3 attempts → not null",
  computeDifficultyTarget(attempts(3, 3), 3) !== null);

assert("custom minSamples=3, 2 attempts → null",
  computeDifficultyTarget(attempts(2, 2), 3) === null);

// ── computeSelectionWeights: output values ────────────────────────────────────

console.log("\n── computeSelectionWeights: output values ───────────────────────");

{
  const w = computeSelectionWeights("EASY");
  assert("EASY target: EASY weight = 0.70",   w.EASY   === 0.70);
  assert("EASY target: MEDIUM weight = 0.25", w.MEDIUM === 0.25);
  assert("EASY target: HARD weight = 0.05",   w.HARD   === 0.05);
  const sum = +(w.EASY + w.MEDIUM + w.HARD).toFixed(10);
  assert("EASY target: weights sum to 1.0", sum === 1.0, `got ${sum}`);
}

{
  const w = computeSelectionWeights("MEDIUM");
  assert("MEDIUM target: EASY weight = 0.20",   w.EASY   === 0.20);
  assert("MEDIUM target: MEDIUM weight = 0.55", w.MEDIUM === 0.55);
  assert("MEDIUM target: HARD weight = 0.25",   w.HARD   === 0.25);
  const sum = +(w.EASY + w.MEDIUM + w.HARD).toFixed(10);
  assert("MEDIUM target: weights sum to 1.0", sum === 1.0, `got ${sum}`);
}

{
  const w = computeSelectionWeights("HARD");
  assert("HARD target: EASY weight = 0.05",   w.EASY   === 0.05);
  assert("HARD target: MEDIUM weight = 0.25", w.MEDIUM === 0.25);
  assert("HARD target: HARD weight = 0.70",   w.HARD   === 0.70);
  const sum = +(w.EASY + w.MEDIUM + w.HARD).toFixed(10);
  assert("HARD target: weights sum to 1.0", sum === 1.0, `got ${sum}`);
}

// ── applyDifficultyWeighting: no selection when pool ≤ count ─────────────────

console.log("\n── applyDifficultyWeighting: pool ≤ count → no selection ────────");

{
  const q = questions(2, 3, 2); // 7 total
  const result = applyDifficultyWeighting(q, "HARD", 10);
  assert("pool (7) ≤ count (10) → all returned", result.length === 7);
  assert("pool ≤ count → same reference check", result === q);
}

{
  const q = questions(3, 4, 3); // 10 total
  const result = applyDifficultyWeighting(q, "EASY", 10);
  assert("pool (10) = count (10) → all returned", result.length === 10);
}

// ── applyDifficultyWeighting: HARD target ────────────────────────────────────

console.log("\n── applyDifficultyWeighting: HARD target ────────────────────────");

{
  // 15 questions: 5 EASY, 5 MEDIUM, 5 HARD; select 10 with HARD target
  // HARD weights: EASY=0.05→round(0.5)=1, MEDIUM=0.25→round(2.5)=3, HARD=0.70→round(7)=7 → total 11, capped to 10
  const q = questions(5, 5, 5);
  const result = applyDifficultyWeighting(q, "HARD", 10);
  assert("HARD target: result ≤ 10", result.length <= 10);
  const hardCount  = result.filter(r => r.difficulty === "HARD").length;
  const easyCount  = result.filter(r => r.difficulty === "EASY").length;
  assert("HARD target: majority from HARD pool", hardCount > easyCount);
  assert("HARD target: some HARD questions returned", hardCount >= 3);
}

// ── applyDifficultyWeighting: EASY target ────────────────────────────────────

console.log("\n── applyDifficultyWeighting: EASY target ────────────────────────");

{
  // 15 questions: 5 EASY, 5 MEDIUM, 5 HARD; select 10 with EASY target
  const q = questions(5, 5, 5);
  const result = applyDifficultyWeighting(q, "EASY", 10);
  assert("EASY target: result ≤ 10", result.length <= 10);
  const easyCount = result.filter(r => r.difficulty === "EASY").length;
  const hardCount = result.filter(r => r.difficulty === "HARD").length;
  assert("EASY target: majority from EASY pool", easyCount > hardCount);
  assert("EASY target: some EASY questions returned", easyCount >= 3);
}

// ── applyDifficultyWeighting: MEDIUM target ───────────────────────────────────

console.log("\n── applyDifficultyWeighting: MEDIUM target ──────────────────────");

{
  const q = questions(5, 5, 5); // 15 total, select 10
  const result = applyDifficultyWeighting(q, "MEDIUM", 10);
  assert("MEDIUM target: result ≤ 10", result.length <= 10);
  const mediumCount = result.filter(r => r.difficulty === "MEDIUM").length;
  assert("MEDIUM target: MEDIUM is largest group", mediumCount >= 3);
}

// ── applyDifficultyWeighting: empty EASY pool fallback ───────────────────────

console.log("\n── applyDifficultyWeighting: empty pool fallback ────────────────");

{
  // No EASY questions — shortfall redirected to MEDIUM
  const q = questions(0, 10, 5); // 15 total: 0 EASY, 10 MEDIUM, 5 HARD
  const result = applyDifficultyWeighting(q, "EASY", 10);
  assert("empty EASY pool: no EASY returned", result.filter(r => r.difficulty === "EASY").length === 0);
  assert("empty EASY pool: MEDIUM fills the gap", result.filter(r => r.difficulty === "MEDIUM").length >= 5);
  assert("empty EASY pool: result ≤ count", result.length <= 10);
}

{
  // No HARD questions — shortfall redirected to MEDIUM
  const q = questions(5, 10, 0); // 15 total: 5 EASY, 10 MEDIUM, 0 HARD
  const result = applyDifficultyWeighting(q, "HARD", 10);
  assert("empty HARD pool: no HARD returned", result.filter(r => r.difficulty === "HARD").length === 0);
  assert("empty HARD pool: MEDIUM fills the gap", result.filter(r => r.difficulty === "MEDIUM").length >= 3);
  assert("empty HARD pool: result ≤ count", result.length <= 10);
}

{
  // Only MEDIUM questions available — all weights collapse into MEDIUM
  const q = questions(0, 15, 0);
  const result = applyDifficultyWeighting(q, "HARD", 10);
  assert("only MEDIUM pool: all from MEDIUM", result.every(r => r.difficulty === "MEDIUM"));
  assert("only MEDIUM pool: result ≤ count", result.length <= 10);
}

// ── applyDifficultyWeighting: edge cases ─────────────────────────────────────

console.log("\n── applyDifficultyWeighting: edge cases ─────────────────────────");

{
  // Empty question set
  const result = applyDifficultyWeighting([], "HARD", 10);
  assert("empty questions → empty result", result.length === 0);
}

{
  // Pool larger than count with one difficulty
  const q = questions(0, 20, 0); // 20 MEDIUM only
  const result = applyDifficultyWeighting(q, "MEDIUM", 10);
  assert("single-pool 20→10: result capped at count", result.length <= 10);
}

{
  // Verify no duplicate IDs in result
  const q = questions(6, 6, 6); // 18 total
  const result = applyDifficultyWeighting(q, "MEDIUM", 10);
  const ids = result.map(r => r.id);
  const uniqueIds = new Set(ids);
  assert("no duplicate questions in result", uniqueIds.size === ids.length);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`✓ All ${total} tests passed`);
} else {
  console.error(`✗ ${failed}/${total} tests failed`);
  process.exit(1);
}
