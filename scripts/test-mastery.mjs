/**
 * test-mastery.mjs
 *
 * Validates computeTopicMastery() logic across all mastery states.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure function from masteryTracking.ts.
 *
 * Run: node scripts/test-mastery.mjs
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

// ── Inlined pure function (mirrors masteryTracking.ts) ────────────────────────

function computeTopicMastery(s) {
  // MASTERED: Path 1 — all entries explicitly MASTERED
  if (s.masteredCount === s.entryCount && s.entryCount > 0) return "MASTERED";

  // MASTERED: Path 2 — full spaced-rep cycle + high accuracy + not remedial
  if (
    s.maxReviewStage >= 4 &&
    s.improvementSignal === "IMPROVED" &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.8 &&
    !s.isRemedialFlagged
  ) return "MASTERED";

  // STABLE: Path 3 — IMPROVED + strong accuracy + reviewed at least twice
  if (
    s.improvementSignal === "IMPROVED" &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.75 &&
    s.maxReviewStage >= 2
  ) return "STABLE";

  // STABLE: Path 4 — advanced cycle + steadily improving accuracy
  if (
    s.maxReviewStage >= 3 &&
    s.improvementSignal === "IMPROVING" &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.7
  ) return "STABLE";

  // IMPROVING: Path 5 — accuracy above floor, heading right direction
  if (
    (s.improvementSignal === "IMPROVED" || s.improvementSignal === "IMPROVING") &&
    s.postReviewAccuracy !== null &&
    s.postReviewAccuracy >= 0.5
  ) return "IMPROVING";

  return "NEEDS_REVIEW";
}

// ── Fixture builder ───────────────────────────────────────────────────────────

function makeSummary(overrides) {
  return {
    topic: "conditionals",
    label: "Conditionals",
    entryCount: 1,
    totalOccurrences: 2,
    isRemedialFlagged: false,
    maxReviewStage: 0,
    lastReviewedAt: new Date("2026-06-20"),
    dueCount: 0,
    masteredCount: 0,
    improvementSignal: "NO_DATA",
    preReviewAccuracy: null,
    postReviewAccuracy: null,
    ...overrides,
  };
}

// ── MASTERED tests ────────────────────────────────────────────────────────────

console.log("\nMastered — explicit (all entries MASTERED)");
{
  const s = makeSummary({ entryCount: 2, masteredCount: 2 });
  assert("All entries MASTERED → MASTERED", computeTopicMastery(s) === "MASTERED");
}

console.log("\nMastered — spaced-repetition cycle complete");
{
  const s = makeSummary({
    maxReviewStage: 4,
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.85,
    isRemedialFlagged: false,
  });
  assert(
    "Stage 4 + IMPROVED + 0.85 postAcc + not remedial → MASTERED",
    computeTopicMastery(s) === "MASTERED"
  );
}

console.log("\nMastered — exact boundary (0.80 postAccuracy)");
{
  const s = makeSummary({
    maxReviewStage: 4,
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.8,
    isRemedialFlagged: false,
  });
  assert(
    "Stage 4 + IMPROVED + exactly 0.80 postAcc → MASTERED",
    computeTopicMastery(s) === "MASTERED"
  );
}

console.log("\nMastered — remedial flag blocks spaced-rep path");
{
  const s = makeSummary({
    maxReviewStage: 4,
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.9,
    isRemedialFlagged: true,   // has occurrenceCount > 2
  });
  assert(
    "isRemedialFlagged blocks stage-4 MASTERED path",
    computeTopicMastery(s) !== "MASTERED",
    `got ${computeTopicMastery(s)}`
  );
}

console.log("\nMastered — stage below 4 does not qualify");
{
  const s = makeSummary({
    maxReviewStage: 3,
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.9,
    isRemedialFlagged: false,
  });
  const state = computeTopicMastery(s);
  assert(
    "Stage 3 does not reach MASTERED (falls to STABLE)",
    state !== "MASTERED",
    `got ${state}`
  );
}

// ── STABLE tests ──────────────────────────────────────────────────────────────

console.log("\nStable — IMPROVED signal + strong accuracy + reviewed twice");
{
  const s = makeSummary({
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.8,
    maxReviewStage: 2,
  });
  assert(
    "IMPROVED + 0.80 postAcc + stage 2 → STABLE",
    computeTopicMastery(s) === "STABLE"
  );
}

console.log("\nStable — IMPROVED signal, 0.75 boundary");
{
  const s = makeSummary({
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.75,
    maxReviewStage: 2,
  });
  assert(
    "IMPROVED + exactly 0.75 postAcc + stage 2 → STABLE",
    computeTopicMastery(s) === "STABLE"
  );
}

console.log("\nStable — IMPROVING signal at advanced stage");
{
  const s = makeSummary({
    improvementSignal: "IMPROVING",
    postReviewAccuracy: 0.72,
    maxReviewStage: 3,
  });
  assert(
    "IMPROVING + 0.72 postAcc + stage 3 → STABLE",
    computeTopicMastery(s) === "STABLE"
  );
}

console.log("\nStable — IMPROVING, 0.70 boundary at stage 3");
{
  const s = makeSummary({
    improvementSignal: "IMPROVING",
    postReviewAccuracy: 0.7,
    maxReviewStage: 3,
  });
  assert(
    "IMPROVING + exactly 0.70 postAcc + stage 3 → STABLE",
    computeTopicMastery(s) === "STABLE"
  );
}

console.log("\nStable NOT triggered — IMPROVED but only stage 1");
{
  const s = makeSummary({
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.85,
    maxReviewStage: 1,   // only reviewed once — not sustained yet
  });
  const state = computeTopicMastery(s);
  assert(
    "IMPROVED + stage 1 does not reach STABLE (falls to IMPROVING)",
    state === "IMPROVING",
    `got ${state}`
  );
}

console.log("\nStable NOT triggered — IMPROVING but stage 2 (needs stage 3)");
{
  const s = makeSummary({
    improvementSignal: "IMPROVING",
    postReviewAccuracy: 0.75,
    maxReviewStage: 2,   // path 4 needs stage >= 3
  });
  const state = computeTopicMastery(s);
  assert(
    "IMPROVING + stage 2 does not reach STABLE",
    state !== "STABLE",
    `got ${state}`
  );
}

// ── IMPROVING tests ───────────────────────────────────────────────────────────

console.log("\nImproving — IMPROVING signal, accuracy above floor");
{
  const s = makeSummary({
    improvementSignal: "IMPROVING",
    postReviewAccuracy: 0.65,
    maxReviewStage: 1,
  });
  assert(
    "IMPROVING + 0.65 postAcc → IMPROVING",
    computeTopicMastery(s) === "IMPROVING"
  );
}

console.log("\nImproving — IMPROVED but only one review cycle (stage 1)");
{
  const s = makeSummary({
    improvementSignal: "IMPROVED",
    postReviewAccuracy: 0.82,
    maxReviewStage: 1,  // IMPROVED but stage < 2 → can't reach STABLE
  });
  assert(
    "IMPROVED + stage 1 → IMPROVING (single cycle not sustained)",
    computeTopicMastery(s) === "IMPROVING"
  );
}

console.log("\nImproving — 0.50 boundary");
{
  const s = makeSummary({
    improvementSignal: "IMPROVING",
    postReviewAccuracy: 0.5,
    maxReviewStage: 1,
  });
  assert(
    "IMPROVING + exactly 0.50 postAcc → IMPROVING",
    computeTopicMastery(s) === "IMPROVING"
  );
}

// ── NEEDS_REVIEW tests ────────────────────────────────────────────────────────

console.log("\nNeeds review — RECURRING signal");
{
  const s = makeSummary({
    improvementSignal: "RECURRING",
    postReviewAccuracy: 0.4,
    maxReviewStage: 2,
  });
  assert(
    "RECURRING signal → NEEDS_REVIEW",
    computeTopicMastery(s) === "NEEDS_REVIEW"
  );
}

console.log("\nNeeds review — NO_DATA (no post-review attempts)");
{
  const s = makeSummary({
    improvementSignal: "NO_DATA",
    postReviewAccuracy: null,
    lastReviewedAt: new Date("2026-06-15"),
  });
  assert(
    "NO_DATA signal → NEEDS_REVIEW",
    computeTopicMastery(s) === "NEEDS_REVIEW"
  );
}

console.log("\nNeeds review — never reviewed (lastReviewedAt null)");
{
  const s = makeSummary({
    improvementSignal: "NO_DATA",
    postReviewAccuracy: null,
    lastReviewedAt: null,
  });
  assert(
    "lastReviewedAt === null → NEEDS_REVIEW",
    computeTopicMastery(s) === "NEEDS_REVIEW"
  );
}

console.log("\nNeeds review — IMPROVING signal but accuracy below floor");
{
  const s = makeSummary({
    improvementSignal: "IMPROVING",
    postReviewAccuracy: 0.45,  // < 0.50
    maxReviewStage: 2,
  });
  assert(
    "IMPROVING + postAcc 0.45 → NEEDS_REVIEW (below 0.50 floor)",
    computeTopicMastery(s) === "NEEDS_REVIEW"
  );
}

console.log("\nNeeds review — RECURRING despite high stage");
{
  const s = makeSummary({
    improvementSignal: "RECURRING",
    postReviewAccuracy: 0.55,
    maxReviewStage: 3,  // far along but still failing → regression
  });
  assert(
    "RECURRING + stage 3 → NEEDS_REVIEW (regression)",
    computeTopicMastery(s) === "NEEDS_REVIEW"
  );
}

// ── countByMasteryState tests ─────────────────────────────────────────────────

function countByMasteryState(profiles) {
  const counts = { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 0 };
  for (const p of profiles) counts[p.masteryState] += 1;
  return counts;
}

console.log("\ncountByMasteryState");
{
  const profiles = [
    { masteryState: "MASTERED" },
    { masteryState: "STABLE" },
    { masteryState: "STABLE" },
    { masteryState: "IMPROVING" },
    { masteryState: "NEEDS_REVIEW" },
    { masteryState: "NEEDS_REVIEW" },
    { masteryState: "NEEDS_REVIEW" },
  ];
  const counts = countByMasteryState(profiles);
  assert("MASTERED count = 1",     counts.MASTERED === 1);
  assert("STABLE count = 2",       counts.STABLE === 2);
  assert("IMPROVING count = 1",    counts.IMPROVING === 1);
  assert("NEEDS_REVIEW count = 3", counts.NEEDS_REVIEW === 3);
}

{
  const counts = countByMasteryState([]);
  assert("Empty profiles → all zeros", counts.MASTERED === 0 && counts.STABLE === 0);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed${failed > 0 ? `, ${failed} FAILED` : ""}\n`);
if (failed > 0) process.exit(1);
