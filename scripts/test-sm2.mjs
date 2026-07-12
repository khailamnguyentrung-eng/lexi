/**
 * test-sm2.mjs
 *
 * Validates computeSM2Update and accuracyToQuality logic.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions from lib/services/errorNotebook.ts.
 *
 * Run: node scripts/test-sm2.mjs
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

// ── Inlined pure functions (mirrors lib/services/errorNotebook.ts) ────────────

function computeNextInterval(currentStage, ef) {
  if (currentStage === 0) return 1;
  if (currentStage === 1) return 6;
  let interval = 6;
  for (let i = 2; i <= currentStage; i++) {
    interval = Math.round(interval * ef);
  }
  return interval;
}

function accuracyToQuality(accuracy) {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.8) return 4;
  if (accuracy >= 0.6) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

function computeSM2Update({ reviewStage, easeFactor, quality }) {
  const DEFAULT_EF = 2.5;
  const ef = easeFactor ?? DEFAULT_EF;
  const q = quality;

  const newEF = Math.max(
    1.3,
    Math.min(2.5, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  if (q < 3) {
    return { newReviewStage: 0, newEaseFactor: newEF, intervalDays: 1 };
  }

  return {
    newReviewStage: reviewStage + 1,
    newEaseFactor: newEF,
    intervalDays: computeNextInterval(reviewStage, ef),
  };
}

// ── accuracyToQuality ─────────────────────────────────────────────────────────

console.log("\n── accuracyToQuality ─────────────────────────────────────────────");

assert("1.0 (perfect) → 5",   accuracyToQuality(1.0) === 5);
assert("0.90 (exact) → 5",    accuracyToQuality(0.90) === 5);
assert("0.91 → 5",             accuracyToQuality(0.91) === 5);
assert("0.89 → 4",             accuracyToQuality(0.89) === 4);
assert("0.80 (exact) → 4",    accuracyToQuality(0.80) === 4);
assert("0.60 (exact) → 3",    accuracyToQuality(0.60) === 3);
assert("0.61 → 3",             accuracyToQuality(0.61) === 3);
assert("0.59 → 2",             accuracyToQuality(0.59) === 2);
assert("0.40 (exact) → 2",    accuracyToQuality(0.40) === 2);
assert("0.39 → 1",             accuracyToQuality(0.39) === 1);
assert("0.0 → 1",              accuracyToQuality(0.0) === 1);

// ── computeSM2Update: success path ───────────────────────────────────────────

console.log("\n── SM-2 success path (quality ≥ 3) ──────────────────────────────");

// Stage 0 + q=5 → stage 1, interval 1
{
  const r = computeSM2Update({ reviewStage: 0, easeFactor: 2.5, quality: 5 });
  assert("q=5 stage 0: newStage = 1",      r.newReviewStage === 1);
  assert("q=5 stage 0: interval = 1",      r.intervalDays === 1);
  // EF 2.5 + q=5 → formula gives 2.6, clamped to 2.5
  assert("q=5 stage 0: EF clamps at 2.5",  r.newEaseFactor === 2.5,
    `got ${r.newEaseFactor}`);
}

// q=5 with lower EF confirms EF actually increases when not clamped
{
  const r = computeSM2Update({ reviewStage: 0, easeFactor: 2.0, quality: 5 });
  assert("q=5 EF=2.0: EF increases",       r.newEaseFactor > 2.0,
    `got ${r.newEaseFactor}`);
}

// Stage 1 + q=4 → stage 2, interval 6, EF unchanged (q=4 is neutral point)
{
  const r = computeSM2Update({ reviewStage: 1, easeFactor: 2.5, quality: 4 });
  assert("q=4 stage 1: newStage = 2",     r.newReviewStage === 2);
  assert("q=4 stage 1: interval = 6",     r.intervalDays === 6);
  assert("q=4 stage 1: EF unchanged",     Math.abs(r.newEaseFactor - 2.5) < 0.001,
    `got ${r.newEaseFactor}`);
}

// Stage 2 + q=3 + EF=2.5 → stage 3, interval = round(6×2.5) = 15
{
  const r = computeSM2Update({ reviewStage: 2, easeFactor: 2.5, quality: 3 });
  assert("q=3 stage 2: newStage = 3",     r.newReviewStage === 3);
  assert("q=3 stage 2: interval = 15",    r.intervalDays === 15,
    `got ${r.intervalDays}`);
  assert("q=3 stage 2: EF decreases",     r.newEaseFactor < 2.5,
    `got ${r.newEaseFactor}`);
}

// Stage 3 + EF=2.5: interval = round(round(6×2.5)×2.5) = round(15×2.5) = round(37.5) = 38
{
  const r = computeSM2Update({ reviewStage: 3, easeFactor: 2.5, quality: 4 });
  assert("q=4 stage 3: newStage = 4",     r.newReviewStage === 4);
  assert("q=4 stage 3: interval = 38",    r.intervalDays === 38,
    `got ${r.intervalDays}`);
}

// ── computeSM2Update: reset path ─────────────────────────────────────────────

console.log("\n── SM-2 reset path (quality < 3) ────────────────────────────────");

// q=2, advanced stage → reset
{
  const r = computeSM2Update({ reviewStage: 4, easeFactor: 2.5, quality: 2 });
  assert("q=2 stage 4: newStage = 0 (reset)",  r.newReviewStage === 0);
  assert("q=2 stage 4: interval = 1",           r.intervalDays === 1);
  assert("q=2: EF is still updated (not zero)", r.newEaseFactor > 0,
    `got ${r.newEaseFactor}`);
  assert("q=2: EF decreases from 2.5",          r.newEaseFactor < 2.5,
    `got ${r.newEaseFactor}`);
}

// q=1 → reset
{
  const r = computeSM2Update({ reviewStage: 3, easeFactor: 2.0, quality: 1 });
  assert("q=1 stage 3: newStage = 0 (reset)",  r.newReviewStage === 0);
  assert("q=1 stage 3: interval = 1",           r.intervalDays === 1);
}

// q=2 (exact boundary) → reset
{
  const r = computeSM2Update({ reviewStage: 2, easeFactor: 2.5, quality: 2 });
  assert("q=2 exact boundary → reset",   r.newReviewStage === 0);
  assert("q=2 exact boundary interval",  r.intervalDays === 1);
}

// q=3 (exact boundary) → growth (NOT reset)
{
  const r = computeSM2Update({ reviewStage: 0, easeFactor: 2.5, quality: 3 });
  assert("q=3 exact boundary → NOT reset", r.newReviewStage === 1);
  assert("q=3 exact boundary interval",    r.intervalDays === 1);
}

// ── EF clamping ───────────────────────────────────────────────────────────────

console.log("\n── EF clamping ──────────────────────────────────────────────────");

// EF at floor 1.3 + bad quality → stays at 1.3
{
  const r = computeSM2Update({ reviewStage: 0, easeFactor: 1.3, quality: 1 });
  assert("EF floor: 1.3 + q=1 → stays at 1.3", r.newEaseFactor === 1.3,
    `got ${r.newEaseFactor}`);
}

// EF at ceiling 2.5 + perfect quality → clamps at 2.5
{
  const r = computeSM2Update({ reviewStage: 0, easeFactor: 2.5, quality: 5 });
  assert("EF ceiling: 2.5 + q=5 → clamps at 2.5", r.newEaseFactor === 2.5,
    `got ${r.newEaseFactor}`);
}

// EF just below ceiling with q=5 → should still clamp
{
  const r = computeSM2Update({ reviewStage: 1, easeFactor: 2.45, quality: 5 });
  assert("EF 2.45 + q=5 → clamps at 2.5", r.newEaseFactor === 2.5,
    `got ${r.newEaseFactor}`);
}

// ── null easeFactor (DB default path) ────────────────────────────────────────

console.log("\n── null easeFactor → default 2.5 ───────────────────────────────");

{
  const rNull = computeSM2Update({ reviewStage: 1, easeFactor: null, quality: 4 });
  const r25   = computeSM2Update({ reviewStage: 1, easeFactor: 2.5,  quality: 4 });
  assert("null EF: same result as EF=2.5 (stage)",    rNull.newReviewStage === r25.newReviewStage);
  assert("null EF: same result as EF=2.5 (interval)", rNull.intervalDays   === r25.intervalDays);
  assert("null EF: same result as EF=2.5 (newEF)",
    Math.abs(rNull.newEaseFactor - r25.newEaseFactor) < 0.0001);
}

// ── Stage progression: intervals 1 → 6 → 15 → 38 (EF=2.5 throughout) ────────

console.log("\n── Stage progression with EF=2.5 ───────────────────────────────");

const stages = [
  { stage: 0, expectedInterval: 1  },
  { stage: 1, expectedInterval: 6  },
  { stage: 2, expectedInterval: 15 },
  { stage: 3, expectedInterval: 38 },
];

for (const { stage, expectedInterval } of stages) {
  const r = computeSM2Update({ reviewStage: stage, easeFactor: 2.5, quality: 4 });
  assert(
    `stage ${stage} → interval ${expectedInterval}`,
    r.intervalDays === expectedInterval,
    `got ${r.intervalDays}`,
  );
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
