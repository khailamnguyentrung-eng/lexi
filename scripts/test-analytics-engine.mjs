/**
 * test-analytics-engine.mjs
 *
 * Gọi THẬT computeBlueprintCoverage/computeReadiness/computeWeaknessSignals
 * sau khi A2 chuyển chúng sang nhận ExamBlueprint qua tham số.
 *
 * Vì sao cần: scripts/test-analytics.mjs tự định nghĩa lại các hàm này nội
 * tuyến (lối viết cũ của repo) nên nó KHÔNG chạm code thật — nó vẫn xanh kể
 * cả khi engine hỏng. Bài này đóng đúng lỗ hổng đó.
 *
 * Blueprint dựng tay, không đọc DB: chính là thứ thiết kế "blueprint qua
 * tham số" mua được, và bài test này là bằng chứng nó hoạt động. Cả 3 hàm
 * vẫn đồng bộ (không async, không import Prisma) — nếu ai lỡ tay biến chúng
 * thành async, gọi trực tiếp (không await) bên dưới sẽ trả về Promise thay
 * vì object thật, và mọi property-access assertion sẽ chết ngay (undefined).
 *
 * Run: node --import tsx scripts/test-analytics-engine.mjs
 */
import {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
} from "../lib/analytics/sessionAnalytics.ts";

// ──────────────────────────────────────────────────────────────────
// Hand-built blueprint fixture — no DB. Mirrors hanoi-g10's real shape
// (8 sections, same order/depths as examBlueprint.ts's old constants /
// the seeded Exam row) so the locked readinessScore below is comparable
// to test-analytics.mjs's independent reimplementation.
// ──────────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 40;

const BLUEPRINT_SECTIONS_RAW = [
  { code: "PHONETICS_SOUND", label: "Ngữ âm — âm thanh", questionCount: 2 },
  { code: "PHONETICS_STRESS", label: "Ngữ âm — trọng âm", questionCount: 2 },
  { code: "GRAMMAR_MCQ", label: "Ngữ pháp / Từ vựng", questionCount: 15 },
  { code: "ERROR_IDENTIFICATION", label: "Nhận diện lỗi sai", questionCount: 2 },
  { code: "WORD_FORMATION", label: "Hình thành từ", questionCount: 4 },
  { code: "CLOZE", label: "Điền vào chỗ trống", questionCount: 5 },
  { code: "READING_COMPREHENSION", label: "Đọc hiểu", questionCount: 5 },
  { code: "SENTENCE_TRANSFORMATION", label: "Viết lại câu", questionCount: 5 },
];

const blueprint = {
  slug: "hanoi-g10-fixture",
  totalQuestions: TOTAL_QUESTIONS,
  timeAllowedMin: 60,
  sections: BLUEPRINT_SECTIONS_RAW.map((s) => ({
    ...s,
    weight: s.questionCount / TOTAL_QUESTIONS,
  })),
};

// ──────────────────────────────────────────────────────────────────
// Test data helper
// ──────────────────────────────────────────────────────────────────

function makeAttempt(type, topic, isCorrect, selectedOption = "B") {
  return {
    isCorrect,
    selectedOption: isCorrect ? "A" : selectedOption,
    attemptedAt: new Date(),
    timeSpentSec: 30,
    question: {
      id: `q-${Math.random().toString(36).slice(2)}`,
      questionCode: `Q${Math.floor(Math.random() * 1000)}`,
      type,
      skill: "GRAMMAR",
      topic,
      difficulty: "MEDIUM",
      promptText: "Test question prompt",
      optionA: "Option A (correct)",
      optionB: "Option B (wrong)",
      optionC: "Option C",
      optionD: "Option D",
      correctOption: "A",
      explanationVi: "Giải thích",
      commonMistake: null,
    },
  };
}

// ──────────────────────────────────────────────────────────────────
// Test harness
// ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

// ──────────────────────────────────────────────────────────────────
// 1. computeBlueprintCoverage([], blueprint) — no attempts
// ──────────────────────────────────────────────────────────────────

console.log("\ncomputeBlueprintCoverage — real engine, hand-built blueprint");

test("[] attempts → 8 sections, all UNASSESSED, assessedCount 0", () => {
  const cov = computeBlueprintCoverage([], blueprint);
  assert(cov.sections.length === 8, `expected 8 sections, got ${cov.sections.length}`);
  assert(
    cov.sections.every((s) => s.status === "UNASSESSED"),
    `expected all UNASSESSED, got ${cov.sections.map((s) => s.status).join(",")}`,
  );
  assert(cov.assessedCount === 0, `expected assessedCount 0, got ${cov.assessedCount}`);
});

test("2 attempts on GRAMMAR_MCQ → that section ASSESSED, every other section UNASSESSED", () => {
  const attempts = [
    makeAttempt("GRAMMAR_MCQ", "grammar", true),
    makeAttempt("GRAMMAR_MCQ", "grammar", true),
  ];
  const cov = computeBlueprintCoverage(attempts, blueprint);
  const grammar = cov.sections.find((s) => s.section === "GRAMMAR_MCQ");
  assert(grammar?.status === "ASSESSED", `expected GRAMMAR_MCQ ASSESSED, got ${grammar?.status}`);
  const others = cov.sections.filter((s) => s.section !== "GRAMMAR_MCQ");
  assert(
    others.every((s) => s.status === "UNASSESSED"),
    `expected every other section UNASSESSED, got ${others.map((s) => `${s.section}:${s.status}`).join(",")}`,
  );
});

test("reads the blueprint PARAMETER, not a leftover constant — a 2-section blueprint returns 2 sections", () => {
  const miniBlueprint = {
    slug: "mini-fixture",
    totalQuestions: 10,
    timeAllowedMin: 15,
    sections: [
      { code: "READING_COMPREHENSION", label: "Đọc hiểu", questionCount: 5, weight: 0.5 },
      { code: "CLOZE", label: "Điền vào chỗ trống", questionCount: 5, weight: 0.5 },
    ],
  };
  const cov = computeBlueprintCoverage([], miniBlueprint);
  assert(cov.sections.length === 2, `expected 2 sections, got ${cov.sections.length}`);
  assert(
    cov.sections.map((s) => s.section).sort().join(",") === "CLOZE,READING_COMPREHENSION",
    `expected exactly [CLOZE, READING_COMPREHENSION], got ${cov.sections.map((s) => s.section).join(",")}`,
  );
});

// ──────────────────────────────────────────────────────────────────
// 2. computeReadiness
// ──────────────────────────────────────────────────────────────────

console.log("\ncomputeReadiness — real engine, hand-built blueprint");

test("[] attempts → weightedTopicMastery 0 and coverageDepthScore 0", () => {
  const r = computeReadiness([], [1], blueprint);
  assert(r.weightedTopicMastery === 0, `expected 0, got ${r.weightedTopicMastery}`);
  assert(r.coverageDepthScore === 0, `expected 0, got ${r.coverageDepthScore}`);
  assert(r.insufficientData === true, "expected insufficientData true");
});

// Locked to an OBSERVED value, not derived algebraically in this file (that's
// test-analytics.mjs's job with its own inline reimplementation) — this test
// exists to prove the real sessionAnalytics.ts code, called with a hand-built
// blueprint, produces the number the design predicts. 3 attempts per section,
// 100% correct, against the same depths as hanoi-g10:
//   WTM = 1.0 (all correct); CDS = Σ min(3,depth)/depth × weight = 0.525
//   score = round((1.0×0.6 + 0.525×0.4) × 100) = 81 → NEARLY_READY
// (same arithmetic test-analytics.mjs's reimplementation asserts — this test
// additionally proves the REAL sessionAnalytics.ts code reaches it.)
test("sparse (3/section, 100% correct) → readinessScore 81, band NEARLY_READY", () => {
  const attempts = blueprint.sections.flatMap((s) =>
    [1, 2, 3].map(() => makeAttempt(s.code, "grammar", true)),
  );
  const r = computeReadiness(attempts, [1], blueprint);
  assert(r.readinessScore === 81, `expected 81, got ${r.readinessScore}`);
  assert(r.band === "NEARLY_READY", `expected NEARLY_READY, got ${r.band}`);
});

// ──────────────────────────────────────────────────────────────────
// 3. computeWeaknessSignals
// ──────────────────────────────────────────────────────────────────

console.log("\ncomputeWeaknessSignals — real engine, hand-built blueprint");

test("returns at most topN=3 topics, sorted by riskScore descending", () => {
  const attempts = [
    ...Array.from({ length: 5 }, () => makeAttempt("GRAMMAR_MCQ", "grammar_weak", false, "B")),
    ...Array.from({ length: 3 }, () => makeAttempt("CLOZE", "cloze_weak", false, "C")),
    ...Array.from({ length: 2 }, () => makeAttempt("PHONETICS_SOUND", "phonetics_weak", false, "D")),
    ...Array.from({ length: 2 }, () => makeAttempt("WORD_FORMATION", "word_formation_weak", false, "A")),
  ];
  const results = computeWeaknessSignals(attempts, blueprint, 3);
  assert(results.length <= 3, `expected at most 3 topics, got ${results.length}`);
  for (let i = 1; i < results.length; i++) {
    assert(
      results[i - 1].riskScore >= results[i].riskScore,
      `expected descending riskScore, got ${results.map((r) => r.riskScore).join(",")}`,
    );
  }
});

// Regression for the bug the reviewer's parallel-run proof surfaced: the OLD
// code (`EXAM_SECTION_WEIGHTS as Record<string, number>`, an object literal)
// looked up `weights[a.question.type]`. Object literals inherit from
// Object.prototype, so a question.type of "constructor" resolved to the
// Object constructor FUNCTION, not undefined — riskScore silently became
// garbage (not a plain missing-key 0). The new Map-based lookup has no
// prototype chain to leak through: an unknown key is just a miss.
test("question.type='constructor' (prototype-pollution edge case) → riskScore is a number, not garbage", () => {
  const attempts = [
    makeAttempt("constructor", "prototype_edge_case", false, "B"),
    makeAttempt("constructor", "prototype_edge_case", false, "C"),
  ];
  const results = computeWeaknessSignals(attempts, blueprint, 3);
  const topic = results.find((r) => r.topic === "prototype_edge_case");
  assert(topic !== undefined, "expected prototype_edge_case topic to appear (it has wrong attempts)");
  assert(
    typeof topic.riskScore === "number",
    `expected riskScore to be a number, got ${typeof topic.riskScore} (${String(topic.riskScore)})`,
  );
  assert(
    topic.riskScore === 0,
    `expected riskScore 0 ("constructor" matches no real section weight), got ${topic.riskScore}`,
  );
});

// ──────────────────────────────────────────────────────────────────
// 4. question.type = null — schema.prisma's documented semantics (A2 Task 5):
//    a question with `type = null` must contribute 0 to coverage/mastery, not
//    crash and not silently get miscounted into some other section's depth.
// ──────────────────────────────────────────────────────────────────

console.log("\ntype = null attempt — locked semantics: contributes nothing to readiness");

test("mixing in a type=null attempt does not change readinessScore vs. the same data without it", () => {
  const baseAttempts = blueprint.sections.flatMap((s) =>
    [1, 2, 3].map(() => makeAttempt(s.code, "grammar", true)),
  );
  const baseline = computeReadiness(baseAttempts, [1], blueprint);

  const nullTypeAttempt = makeAttempt(null, "grammar", true);
  const withNullType = computeReadiness([...baseAttempts, nullTypeAttempt], [1], blueprint);

  assert(
    withNullType.readinessScore === baseline.readinessScore,
    `expected readinessScore unchanged (${baseline.readinessScore}), got ${withNullType.readinessScore}`,
  );
  assert(
    withNullType.weightedTopicMastery === baseline.weightedTopicMastery,
    `expected weightedTopicMastery unchanged (${baseline.weightedTopicMastery}), got ${withNullType.weightedTopicMastery}`,
  );
  assert(
    withNullType.coverageDepthScore === baseline.coverageDepthScore,
    `expected coverageDepthScore unchanged (${baseline.coverageDepthScore}), got ${withNullType.coverageDepthScore}`,
  );
});

test("mixing in a type=null attempt does not change computeBlueprintCoverage vs. the same data without it", () => {
  const baseAttempts = [
    makeAttempt("GRAMMAR_MCQ", "grammar", true),
    makeAttempt("GRAMMAR_MCQ", "grammar", true),
  ];
  const baseline = computeBlueprintCoverage(baseAttempts, blueprint);

  const nullTypeAttempt = makeAttempt(null, "grammar", true);
  const withNullType = computeBlueprintCoverage([...baseAttempts, nullTypeAttempt], blueprint);

  assert(
    withNullType.assessedCount === baseline.assessedCount &&
      withNullType.partialCount === baseline.partialCount &&
      withNullType.unassessedCount === baseline.unassessedCount,
    `expected identical section-status counts, got assessed=${withNullType.assessedCount} ` +
      `partial=${withNullType.partialCount} unassessed=${withNullType.unassessedCount} ` +
      `vs baseline assessed=${baseline.assessedCount} partial=${baseline.partialCount} ` +
      `unassessed=${baseline.unassessedCount}`,
  );
  for (const s of blueprint.sections) {
    const before = baseline.sections.find((x) => x.section === s.code);
    const after = withNullType.sections.find((x) => x.section === s.code);
    assert(
      before.attemptCount === after.attemptCount,
      `expected ${s.code} attemptCount unchanged (${before.attemptCount}), got ${after.attemptCount}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
