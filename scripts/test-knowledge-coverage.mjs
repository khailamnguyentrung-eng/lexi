/**
 * test-knowledge-coverage.mjs
 *
 * Validates M3.2 pure engine functions:
 *   - computeCoverageReport() in knowledgeCoverage.ts
 *   - computeAllCoverageReports() in knowledgeCoverage.ts
 *   - detectGaps() in knowledgeGap.ts
 *   - filterGapsByPriority() in knowledgeGap.ts
 *
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions under test.
 *
 * Run: node scripts/test-knowledge-coverage.mjs
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

// ── Inlined helpers ───────────────────────────────────────────────────────────

function computeCoveredCount(targets, actual) {
  return (
    Math.min(actual.easy, targets.easy) +
    Math.min(actual.medium, targets.medium) +
    Math.min(actual.hard, targets.hard)
  );
}

function computeTotalTarget(targets) {
  return targets.easy + targets.medium + targets.hard;
}

function computeCoveragePercentage(targets, actual) {
  const total = computeTotalTarget(targets);
  if (total === 0) return 100;
  return Math.round((computeCoveredCount(targets, actual) / total) * 100);
}

function computeStatus(targets, actual, percentage) {
  if (
    actual.easy >= targets.easy &&
    actual.medium >= targets.medium &&
    actual.hard >= targets.hard
  ) {
    return "COMPLETE";
  }
  const totalActual = actual.easy + actual.medium + actual.hard;
  if (totalActual === 0 || percentage < 50) {
    return "UNDER_COVERED";
  }
  return "PARTIAL";
}

function computeCoverageReport(unit, questions) {
  const unitQuestions = questions.filter((q) => q.topic === unit.topic);
  const actual = {
    easy: unitQuestions.filter((q) => q.difficulty === "EASY").length,
    medium: unitQuestions.filter((q) => q.difficulty === "MEDIUM").length,
    hard: unitQuestions.filter((q) => q.difficulty === "HARD").length,
  };
  const targets = {
    easy: unit.targetEasyCount,
    medium: unit.targetMediumCount,
    hard: unit.targetHardCount,
  };
  const coveragePercentage = computeCoveragePercentage(targets, actual);
  return {
    knowledgeUnitId: unit.id,
    topic: unit.topic,
    label: unit.label,
    targets,
    actual,
    coveragePercentage,
    status: computeStatus(targets, actual, coveragePercentage),
  };
}

function computeAllCoverageReports(units, questions) {
  return units
    .map((unit) => computeCoverageReport(unit, questions))
    .sort((a, b) => a.coveragePercentage - b.coveragePercentage);
}

function computeMissing(targets, actual) {
  return {
    easy: Math.max(0, targets.easy - actual.easy),
    medium: Math.max(0, targets.medium - actual.medium),
    hard: Math.max(0, targets.hard - actual.hard),
  };
}

function derivePriority(missing) {
  if (missing.hard > 0) return "HIGH";
  if (missing.medium > 0) return "MEDIUM";
  return "LOW";
}

const PRIORITY_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function detectGaps(reports) {
  const gaps = [];
  for (const report of reports) {
    if (report.status === "COMPLETE") continue;
    const missing = computeMissing(report.targets, report.actual);
    const totalMissing = missing.easy + missing.medium + missing.hard;
    if (totalMissing === 0) continue;
    gaps.push({
      knowledgeUnitId: report.knowledgeUnitId,
      topic: report.topic,
      label: report.label,
      missing,
      priority: derivePriority(missing),
    });
  }
  return gaps.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const totalA = a.missing.easy + a.missing.medium + a.missing.hard;
    const totalB = b.missing.easy + b.missing.medium + b.missing.hard;
    return totalB - totalA;
  });
}

function filterGapsByPriority(gaps, priority) {
  return gaps.filter((g) => g.priority === priority);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUnit(overrides = {}) {
  return {
    id: "unit_1",
    topic: "present_simple",
    label: "Present Simple",
    targetEasyCount: 5,
    targetMediumCount: 5,
    targetHardCount: 3,
    ...overrides,
  };
}

function makeQuestion(topic, difficulty, overrides = {}) {
  return { id: `q_${Math.random()}`, topic, difficulty, knowledgeUnitId: null, ...overrides };
}

// ── computeCoverageReport: basic cases ───────────────────────────────────────

console.log("\n── computeCoverageReport: zero questions ────────────────────");

{
  const unit = makeUnit();
  const report = computeCoverageReport(unit, []);
  assert("knowledgeUnitId propagated", report.knowledgeUnitId === "unit_1");
  assert("topic propagated", report.topic === "present_simple");
  assert("label propagated", report.label === "Present Simple");
  assert("targets correct", report.targets.easy === 5 && report.targets.medium === 5 && report.targets.hard === 3);
  assert("actual all zero", report.actual.easy === 0 && report.actual.medium === 0 && report.actual.hard === 0);
  assert("coveragePercentage = 0", report.coveragePercentage === 0);
  assert("status = UNDER_COVERED", report.status === "UNDER_COVERED");
}

console.log("\n── computeCoverageReport: fully covered ─────────────────────");

{
  const unit = makeUnit();
  const questions = [
    ...Array(5).fill(null).map(() => makeQuestion("present_simple", "EASY")),
    ...Array(5).fill(null).map(() => makeQuestion("present_simple", "MEDIUM")),
    ...Array(3).fill(null).map(() => makeQuestion("present_simple", "HARD")),
  ];
  const report = computeCoverageReport(unit, questions);
  assert("actual.easy = 5", report.actual.easy === 5);
  assert("actual.medium = 5", report.actual.medium === 5);
  assert("actual.hard = 3", report.actual.hard === 3);
  assert("coveragePercentage = 100", report.coveragePercentage === 100);
  assert("status = COMPLETE", report.status === "COMPLETE");
}

console.log("\n── computeCoverageReport: partial coverage ──────────────────");

{
  const unit = makeUnit();
  // 5 easy (full), 3 medium (partial), 0 hard (missing)
  const questions = [
    ...Array(5).fill(null).map(() => makeQuestion("present_simple", "EASY")),
    ...Array(3).fill(null).map(() => makeQuestion("present_simple", "MEDIUM")),
  ];
  const report = computeCoverageReport(unit, questions);
  // covered: min(5,5) + min(3,5) + min(0,3) = 5+3+0 = 8 / 13 total = ~61%
  assert("coveragePercentage ~61%", report.coveragePercentage === 62, `got ${report.coveragePercentage}`);
  assert("status = PARTIAL", report.status === "PARTIAL");
}

console.log("\n── computeCoverageReport: over-covered (surplus not inflated) ──");

{
  const unit = makeUnit({ targetEasyCount: 3, targetMediumCount: 3, targetHardCount: 2 });
  const questions = [
    ...Array(10).fill(null).map(() => makeQuestion("present_simple", "EASY")),
    ...Array(3).fill(null).map(() => makeQuestion("present_simple", "MEDIUM")),
    ...Array(2).fill(null).map(() => makeQuestion("present_simple", "HARD")),
  ];
  const report = computeCoverageReport(unit, questions);
  // covered: min(10,3) + min(3,3) + min(2,2) = 3+3+2 = 8 / 8 = 100
  assert("surplus easy does not inflate %, capped at target", report.coveragePercentage === 100);
  assert("status = COMPLETE despite surplus", report.status === "COMPLETE");
  assert("actual.easy reflects real count (10)", report.actual.easy === 10);
}

console.log("\n── computeCoverageReport: topic filtering ───────────────────");

{
  const unit = makeUnit({ topic: "present_simple" });
  const questions = [
    makeQuestion("present_simple", "EASY"),
    makeQuestion("past_simple", "EASY"),       // different topic, should be excluded
    makeQuestion("present_simple", "MEDIUM"),
  ];
  const report = computeCoverageReport(unit, questions);
  assert("only matching topic questions counted", report.actual.easy === 1 && report.actual.medium === 1);
}

console.log("\n── computeCoverageReport: under-covered threshold ───────────");

{
  // 1 easy out of 5+5+3=13 target → ~7% → UNDER_COVERED
  const unit = makeUnit();
  const questions = [makeQuestion("present_simple", "EASY")];
  const report = computeCoverageReport(unit, questions);
  assert("1/13 questions → status UNDER_COVERED", report.status === "UNDER_COVERED");
}

{
  // exactly 50% fill: 6.5 / 13 → 7 covered out of 13 = 53% → PARTIAL
  const unit = makeUnit();
  const questions = [
    ...Array(3).fill(null).map(() => makeQuestion("present_simple", "EASY")),
    ...Array(3).fill(null).map(() => makeQuestion("present_simple", "MEDIUM")),
    makeQuestion("present_simple", "HARD"),
  ];
  const report = computeCoverageReport(unit, questions);
  // covered: min(3,5)+min(3,5)+min(1,3) = 3+3+1 = 7 / 13 = 53%
  assert("7/13 covered → PARTIAL (not UNDER_COVERED)", report.status === "PARTIAL");
}

console.log("\n── computeAllCoverageReports: sorting ───────────────────────");

{
  const units = [
    makeUnit({ id: "u1", topic: "present_simple", label: "A" }),
    makeUnit({ id: "u2", topic: "past_simple", label: "B" }),
    makeUnit({ id: "u3", topic: "future_simple", label: "C" }),
  ];
  const questions = [
    // u1: fully covered
    ...Array(5).fill(null).map(() => makeQuestion("present_simple", "EASY")),
    ...Array(5).fill(null).map(() => makeQuestion("present_simple", "MEDIUM")),
    ...Array(3).fill(null).map(() => makeQuestion("present_simple", "HARD")),
    // u2: partially covered
    ...Array(3).fill(null).map(() => makeQuestion("past_simple", "EASY")),
    // u3: empty
  ];
  const reports = computeAllCoverageReports(units, questions);
  assert("sorted by coveragePercentage ascending (0 first)", reports[0].topic === "future_simple");
  assert("fully covered unit is last", reports[2].topic === "present_simple");
}

// ── detectGaps ────────────────────────────────────────────────────────────────

console.log("\n── detectGaps: complete unit excluded ───────────────────────");

{
  const reports = [
    {
      knowledgeUnitId: "u1", topic: "a", label: "A",
      targets: { easy: 5, medium: 5, hard: 3 },
      actual:  { easy: 5, medium: 5, hard: 3 },
      coveragePercentage: 100, status: "COMPLETE",
    },
  ];
  const gaps = detectGaps(reports);
  assert("COMPLETE unit produces no gap", gaps.length === 0);
}

console.log("\n── detectGaps: priority rules ───────────────────────────────");

{
  // Missing hard → HIGH
  const reports = [{
    knowledgeUnitId: "u1", topic: "a", label: "A",
    targets: { easy: 5, medium: 5, hard: 3 },
    actual:  { easy: 5, medium: 5, hard: 0 },
    coveragePercentage: 77, status: "PARTIAL",
  }];
  const gaps = detectGaps(reports);
  assert("missing hard → priority HIGH", gaps[0].priority === "HIGH");
  assert("missing.hard = 3", gaps[0].missing.hard === 3);
  assert("missing.easy = 0", gaps[0].missing.easy === 0);
}

{
  // Hard met, medium missing → MEDIUM
  const reports = [{
    knowledgeUnitId: "u1", topic: "a", label: "A",
    targets: { easy: 5, medium: 5, hard: 3 },
    actual:  { easy: 5, medium: 2, hard: 3 },
    coveragePercentage: 77, status: "PARTIAL",
  }];
  const gaps = detectGaps(reports);
  assert("hard met but medium missing → priority MEDIUM", gaps[0].priority === "MEDIUM");
  assert("missing.medium = 3", gaps[0].missing.medium === 3);
}

{
  // Only easy missing → LOW
  const reports = [{
    knowledgeUnitId: "u1", topic: "a", label: "A",
    targets: { easy: 5, medium: 5, hard: 3 },
    actual:  { easy: 2, medium: 5, hard: 3 },
    coveragePercentage: 85, status: "PARTIAL",
  }];
  const gaps = detectGaps(reports);
  assert("only easy missing → priority LOW", gaps[0].priority === "LOW");
}

console.log("\n── detectGaps: sorting (HIGH before MEDIUM before LOW) ──────");

{
  const reports = [
    {
      knowledgeUnitId: "u1", topic: "a", label: "A",
      targets: { easy: 5, medium: 5, hard: 3 },
      actual:  { easy: 2, medium: 5, hard: 3 },
      coveragePercentage: 85, status: "PARTIAL", // LOW (only easy missing)
    },
    {
      knowledgeUnitId: "u2", topic: "b", label: "B",
      targets: { easy: 5, medium: 5, hard: 3 },
      actual:  { easy: 5, medium: 5, hard: 0 },
      coveragePercentage: 77, status: "PARTIAL", // HIGH (hard missing)
    },
    {
      knowledgeUnitId: "u3", topic: "c", label: "C",
      targets: { easy: 5, medium: 5, hard: 3 },
      actual:  { easy: 5, medium: 2, hard: 3 },
      coveragePercentage: 77, status: "PARTIAL", // MEDIUM (medium missing)
    },
  ];
  const gaps = detectGaps(reports);
  assert("first gap is HIGH priority", gaps[0].priority === "HIGH");
  assert("second gap is MEDIUM priority", gaps[1].priority === "MEDIUM");
  assert("third gap is LOW priority", gaps[2].priority === "LOW");
}

console.log("\n── detectGaps: secondary sort (more missing first) ──────────");

{
  const reports = [
    {
      knowledgeUnitId: "u1", topic: "a", label: "A",
      targets: { easy: 5, medium: 5, hard: 3 },
      actual:  { easy: 5, medium: 5, hard: 2 }, // 1 hard missing
      coveragePercentage: 92, status: "PARTIAL",
    },
    {
      knowledgeUnitId: "u2", topic: "b", label: "B",
      targets: { easy: 5, medium: 5, hard: 3 },
      actual:  { easy: 5, medium: 5, hard: 0 }, // 3 hard missing
      coveragePercentage: 77, status: "PARTIAL",
    },
  ];
  const gaps = detectGaps(reports);
  // Both HIGH, but u2 has more missing (3 vs 1), so u2 comes first
  assert("within HIGH, more missing comes first", gaps[0].knowledgeUnitId === "u2");
}

console.log("\n── detectGaps: UNDER_COVERED unit generates gap ─────────────");

{
  const reports = [{
    knowledgeUnitId: "u1", topic: "a", label: "A",
    targets: { easy: 5, medium: 5, hard: 3 },
    actual:  { easy: 0, medium: 0, hard: 0 },
    coveragePercentage: 0, status: "UNDER_COVERED",
  }];
  const gaps = detectGaps(reports);
  assert("UNDER_COVERED unit generates a gap", gaps.length === 1);
  assert("empty unit is HIGH priority (hard missing)", gaps[0].priority === "HIGH");
  assert("missing.easy = 5", gaps[0].missing.easy === 5);
  assert("missing.medium = 5", gaps[0].missing.medium === 5);
  assert("missing.hard = 3", gaps[0].missing.hard === 3);
}

console.log("\n── filterGapsByPriority ──────────────────────────────────────");

{
  const gaps = [
    { priority: "HIGH",   knowledgeUnitId: "u1", topic: "a", label: "A", missing: { easy: 0, medium: 0, hard: 3 } },
    { priority: "MEDIUM", knowledgeUnitId: "u2", topic: "b", label: "B", missing: { easy: 0, medium: 3, hard: 0 } },
    { priority: "LOW",    knowledgeUnitId: "u3", topic: "c", label: "C", missing: { easy: 3, medium: 0, hard: 0 } },
    { priority: "HIGH",   knowledgeUnitId: "u4", topic: "d", label: "D", missing: { easy: 5, medium: 5, hard: 3 } },
  ];
  const highOnly = filterGapsByPriority(gaps, "HIGH");
  assert("filterGapsByPriority(HIGH) returns 2 gaps", highOnly.length === 2);
  assert("all returned gaps are HIGH", highOnly.every(g => g.priority === "HIGH"));
  const medOnly = filterGapsByPriority(gaps, "MEDIUM");
  assert("filterGapsByPriority(MEDIUM) returns 1 gap", medOnly.length === 1);
  const lowOnly = filterGapsByPriority(gaps, "LOW");
  assert("filterGapsByPriority(LOW) returns 1 gap", lowOnly.length === 1);
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
