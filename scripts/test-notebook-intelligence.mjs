/**
 * test-notebook-intelligence.mjs
 *
 * Validates computeImprovementSignal logic and topic priority sorting.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions from notebookIntelligence.ts.
 *
 * Run: node scripts/test-notebook-intelligence.mjs
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

// ── Inlined pure functions (mirrors notebookIntelligence.ts) ─────────────────

function computeImprovementSignal(attempts, lastReviewedAt) {
  const pre = attempts.filter((a) => a.attemptedAt < lastReviewedAt);
  const post = attempts.filter((a) => a.attemptedAt > lastReviewedAt);

  if (post.length === 0) return "NO_DATA";

  const preAcc = pre.length > 0 ? pre.filter((a) => a.isCorrect).length / pre.length : 0;
  const postAcc = post.filter((a) => a.isCorrect).length / post.length;

  if (postAcc >= 0.8 && postAcc - preAcc >= 0.1) return "IMPROVED";
  if (postAcc > preAcc) return "IMPROVING";
  return "RECURRING";
}

function topicPriority(s) {
  let score = 0;
  if (s.improvementSignal === "RECURRING") score += 40;
  if (s.improvementSignal === "IMPROVING") score += 10;
  if (s.isRemedialFlagged) score += 20;
  if (s.dueCount > 0) score += 15;
  score += Math.min(s.totalOccurrences, 10);
  return score;
}

function shouldExclude(topic) {
  return topic.masteredCount === topic.entryCount;
}

// ── Date fixtures ─────────────────────────────────────────────────────────────

const REVIEW_DATE  = new Date("2026-06-17T12:00:00Z"); // 7 days ago
const DAY_14_AGO   = new Date("2026-06-10T12:00:00Z"); // before review
const DAY_3_AGO    = new Date("2026-06-21T12:00:00Z"); // after review

// ── Scenario 1: IMPROVED ─────────────────────────────────────────────────────

console.log("\nScenario 1: IMPROVED (significant accuracy gain after review)");
{
  // Pre-review: 1/4 correct = 25%
  // Post-review: 7/8 correct = 87.5%  — delta = 62.5pp, postAcc ≥ 0.80 ✓
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("Signal is IMPROVED", signal === "IMPROVED", `got ${signal}`);
}

// ── Scenario 2: IMPROVED — exact threshold ───────────────────────────────────

console.log("\nScenario 2: IMPROVED — exact threshold boundary");
{
  // Post = 0.80 (exactly), pre = 0.60 → delta = 0.20 ≥ 0.10 → IMPROVED
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    // 3/5 pre = 60%
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    // 4/5 post = 80% — exactly at threshold
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("Exact 80%/60% boundary → IMPROVED", signal === "IMPROVED", `got ${signal}`);
}

// ── Scenario 3: IMPROVING ────────────────────────────────────────────────────

console.log("\nScenario 3: IMPROVING (some improvement, below 80% threshold)");
{
  // Pre: 1/4 = 25%,  Post: 3/6 = 50%  — delta = 25pp but postAcc < 0.80
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("Signal is IMPROVING", signal === "IMPROVING", `got ${signal}`);
}

// ── Scenario 4: RECURRING ────────────────────────────────────────────────────

console.log("\nScenario 4: RECURRING (no gain after review)");
{
  // Pre: 3/4 = 75%,  Post: 2/4 = 50%  — accuracy dropped
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("Signal is RECURRING (accuracy dropped)", signal === "RECURRING", `got ${signal}`);
}

console.log("\nScenario 4b: RECURRING (equal accuracy — no gain)");
{
  // Pre: 2/4 = 50%,  Post: 2/4 = 50%  — flat
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("Signal is RECURRING (flat accuracy)", signal === "RECURRING", `got ${signal}`);
}

// ── Scenario 5: NO_DATA ──────────────────────────────────────────────────────

console.log("\nScenario 5: NO_DATA (reviewed but no post-review practice)");
{
  const attempts = [
    { isCorrect: false, attemptedAt: DAY_14_AGO },
    { isCorrect: true,  attemptedAt: DAY_14_AGO },
  ]; // nothing after REVIEW_DATE
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("Signal is NO_DATA", signal === "NO_DATA", `got ${signal}`);
}

console.log("\nScenario 5b: NO_DATA (zero attempts total)");
{
  const signal = computeImprovementSignal([], REVIEW_DATE);
  assert("Empty attempts → NO_DATA", signal === "NO_DATA", `got ${signal}`);
}

// ── Scenario 6: No pre-attempts, high post accuracy ─────────────────────────

console.log("\nScenario 6: No pre-attempts, strong post-review performance");
{
  // Pre: 0 attempts (preAcc = 0)
  // Post: 4/5 = 80% — delta = 0.80 ≥ 0.10 → IMPROVED
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("No pre-attempts + 80% post → IMPROVED", signal === "IMPROVED", `got ${signal}`);
}

console.log("\nScenario 6b: No pre-attempts, moderate post-review performance");
{
  // Pre: 0 attempts (preAcc = 0)
  // Post: 3/6 = 50% — delta = 0.50 but postAcc < 0.80 → IMPROVING
  const attempts = [
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: true,  attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
    { isCorrect: false, attemptedAt: DAY_3_AGO },
  ];
  const signal = computeImprovementSignal(attempts, REVIEW_DATE);
  assert("No pre-attempts + 50% post → IMPROVING", signal === "IMPROVING", `got ${signal}`);
}

// ── Topic priority sorting ────────────────────────────────────────────────────

console.log("\nPriority sorting tests");

function makeSummary(overrides) {
  return {
    topic: "test",
    label: "Test",
    entryCount: 1,
    totalOccurrences: 1,
    isRemedialFlagged: false,
    maxReviewStage: 0,
    lastReviewedAt: null,
    dueCount: 0,
    masteredCount: 0,
    improvementSignal: "NO_DATA",
    preReviewAccuracy: null,
    postReviewAccuracy: null,
    ...overrides,
  };
}

{
  const recurring = makeSummary({ improvementSignal: "RECURRING", totalOccurrences: 1 });
  const noData    = makeSummary({ improvementSignal: "NO_DATA",   totalOccurrences: 10 });
  assert(
    "RECURRING (1 occurrence) sorts before NO_DATA (10 occurrences)",
    topicPriority(recurring) > topicPriority(noData),
    `recurring=${topicPriority(recurring)}, noData=${topicPriority(noData)}`
  );
}

{
  const recurringFlagged   = makeSummary({ improvementSignal: "RECURRING", isRemedialFlagged: true,  totalOccurrences: 3 });
  const recurringUnflagged = makeSummary({ improvementSignal: "RECURRING", isRemedialFlagged: false, totalOccurrences: 3 });
  assert(
    "RECURRING + remedialFlagged sorts before RECURRING alone",
    topicPriority(recurringFlagged) > topicPriority(recurringUnflagged),
    `flagged=${topicPriority(recurringFlagged)}, unflagged=${topicPriority(recurringUnflagged)}`
  );
}

{
  const withDue    = makeSummary({ improvementSignal: "NO_DATA", dueCount: 1, totalOccurrences: 1 });
  const withoutDue = makeSummary({ improvementSignal: "NO_DATA", dueCount: 0, totalOccurrences: 5 });
  assert(
    "NO_DATA with due entry sorts before NO_DATA with more occurrences but none due",
    topicPriority(withDue) > topicPriority(withoutDue),
    `due=${topicPriority(withDue)}, noDue=${topicPriority(withoutDue)}`
  );
}

{
  const improving = makeSummary({ improvementSignal: "IMPROVING", totalOccurrences: 1 });
  const noData    = makeSummary({ improvementSignal: "NO_DATA",   totalOccurrences: 1 });
  assert(
    "IMPROVING sorts before NO_DATA (same occurrences)",
    topicPriority(improving) > topicPriority(noData),
    `improving=${topicPriority(improving)}, noData=${topicPriority(noData)}`
  );
}

// ── Mastered exclusion ────────────────────────────────────────────────────────

console.log("\nMastered exclusion tests");

{
  const fullyMastered = makeSummary({ masteredCount: 2, entryCount: 2 });
  assert("All entries MASTERED → excluded", shouldExclude(fullyMastered));
}

{
  const partiallyMastered = makeSummary({ masteredCount: 1, entryCount: 3 });
  assert("Partially mastered → NOT excluded", !shouldExclude(partiallyMastered));
}

{
  const nonemastered = makeSummary({ masteredCount: 0, entryCount: 2 });
  assert("No entries mastered → NOT excluded", !shouldExclude(nonemastered));
}

// ── Repeated mistakes prioritized ────────────────────────────────────────────

console.log("\nRepeated mistakes priority");

{
  // High occurrenceCount adds up to 10 bonus points max
  const manyMistakes = makeSummary({ totalOccurrences: 15 }); // capped at 10
  const fewMistakes  = makeSummary({ totalOccurrences: 2  });
  assert(
    "More occurrences → higher priority (up to cap)",
    topicPriority(manyMistakes) > topicPriority(fewMistakes),
    `many=${topicPriority(manyMistakes)}, few=${topicPriority(fewMistakes)}`
  );
}

{
  // Cap at 10 — 15 occurrences and 11 occurrences should score the same
  const fifteen = makeSummary({ totalOccurrences: 15 });
  const eleven  = makeSummary({ totalOccurrences: 11 });
  assert(
    "Occurrence bonus is capped at 10 (15 and 11 occurrences score equally)",
    topicPriority(fifteen) === topicPriority(eleven),
    `fifteen=${topicPriority(fifteen)}, eleven=${topicPriority(eleven)}`
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed${failed > 0 ? `, ${failed} FAILED` : ""}\n`);
if (failed > 0) process.exit(1);
