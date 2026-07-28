/**
 * Standalone analytics engine verification.
 * Tests pure functions only — no DB, no network, no mocks.
 *
 * Run: node scripts/test-analytics.mjs
 *
 * Blueprint reference: Hanoi Grade 10 English entrance exam — 40 MCQ, 60 min.
 * Section depths are estimated (see examBlueprint.ts header for verification status).
 *
 * IMPORTANT: Keep inline constants below in sync with examBlueprint.ts.
 * When examBlueprint.ts is updated, update the matching values here too.
 */

// ──────────────────────────────────────────────────────────────────
// Inline blueprint constants (must match examBlueprint.ts exactly)
// ──────────────────────────────────────────────────────────────────

const TOTAL_EXAM_QUESTIONS = 40;

const EXAM_SECTION_DEPTH = {
  PHONETICS_SOUND: 2,
  PHONETICS_STRESS: 2,
  GRAMMAR_MCQ: 15,
  ERROR_IDENTIFICATION: 2,
  WORD_FORMATION: 4,
  CLOZE: 5,
  READING_COMPREHENSION: 5,
  SENTENCE_TRANSFORMATION: 5,
};

const EXAM_SECTION_WEIGHTS = Object.fromEntries(
  Object.entries(EXAM_SECTION_DEPTH).map(([k, v]) => [k, v / TOTAL_EXAM_QUESTIONS])
);

const ALL_SECTIONS = Object.keys(EXAM_SECTION_DEPTH);

// ──────────────────────────────────────────────────────────────────
// Inline pure functions (mirrors sessionAnalytics.ts logic exactly)
// ──────────────────────────────────────────────────────────────────

function algorithmicNormalize(raw) {
  return raw.toLowerCase().trim()
    .replace(/[\s\-.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const TOPIC_ALIASES = {
  relative_clause: "relative_clauses",
  conditional: "conditionals",
  passive: "passive_voice",
  passive_sentences: "passive_voice",
  reported: "reported_speech",
  indirect_speech: "reported_speech",
};

function canonicalTopic(raw) {
  const normalized = algorithmicNormalize(raw);
  return TOPIC_ALIASES[normalized] ?? normalized;
}

function prettifyTopic(topic) {
  return topic.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function computeReadiness(attempts, sessionsIncluded) {
  const totalAttempts = attempts.length;
  if (totalAttempts === 0) {
    return { readinessScore: 0, band: "NOT_READY", insufficientData: true };
  }

  const bySection = new Map();
  for (const a of attempts) {
    const existing = bySection.get(a.question.type) ?? { correct: 0, total: 0 };
    existing.total++;
    if (a.isCorrect) existing.correct++;
    bySection.set(a.question.type, existing);
  }

  let wtm = 0;
  let cds = 0;

  for (const section of ALL_SECTIONS) {
    const data = bySection.get(section);
    const accuracy = data && data.total > 0 ? data.correct / data.total : 0;
    const weight = EXAM_SECTION_WEIGHTS[section];
    const attemptCount = data?.total ?? 0;
    wtm += accuracy * weight;
    const expectedDepth = EXAM_SECTION_DEPTH[section];
    cds += (Math.min(attemptCount, expectedDepth) / expectedDepth) * weight;
  }

  const readinessScore = Math.round((wtm * 0.6 + cds * 0.4) * 100);
  let band;
  if (readinessScore >= 85) band = "EXAM_READY";
  else if (readinessScore >= 70) band = "NEARLY_READY";
  else if (readinessScore >= 55) band = "DEVELOPING";
  else band = "NOT_READY";

  return { readinessScore, band, insufficientData: false, weightedTopicMastery: wtm, coverageDepthScore: cds };
}

function computeWeaknessSignals(attempts, topN = 3) {
  const topicMap = new Map();
  for (const a of attempts) {
    const topic = canonicalTopic(a.question.topic);
    const existing = topicMap.get(topic) ?? { totalAttempts: 0, wrongAttempts: [] };
    existing.totalAttempts++;
    if (!a.isCorrect) existing.wrongAttempts.push(a);
    topicMap.set(topic, existing);
  }

  const results = [];
  for (const [topic, { totalAttempts, wrongAttempts }] of topicMap) {
    if (wrongAttempts.length === 0) continue;
    const riskScore = wrongAttempts.reduce((s, a) => s + (EXAM_SECTION_WEIGHTS[a.question.type] ?? 0), 0);
    const wrongCount = wrongAttempts.length;
    const accuracy = (totalAttempts - wrongCount) / totalAttempts;

    const optionCounts = new Map();
    for (const a of wrongAttempts) {
      optionCounts.set(a.selectedOption, (optionCounts.get(a.selectedOption) ?? 0) + 1);
    }
    let maxOption = "", maxCount = 0;
    for (const [opt, cnt] of optionCounts) {
      if (cnt > maxCount) { maxOption = opt; maxCount = cnt; }
    }
    const patternObservation = maxCount >= 2
      ? { selectedOption: maxOption, occurrenceCount: maxCount, studentVisible: maxCount >= 3 }
      : null;

    results.push({ topic, label: prettifyTopic(topic), riskScore, wrongCount, totalAttempts, accuracy, patternObservation, notebookContext: null });
  }

  results.sort((a, b) => b.riskScore - a.riskScore);
  return results.slice(0, topN);
}

function enrichWeaknessWithNotebook(weaknessTopics, notebookRows) {
  const byTopic = new Map(notebookRows.map((r) => [r.topic, r]));
  return weaknessTopics.map((topic) => {
    const row = byTopic.get(topic.topic);
    if (!row) return topic;
    return { ...topic, notebookContext: { topic: row.topic, entryCount: row.entryCount, totalOccurrences: row.totalOccurrences, isRemedialFlagged: row.isRemedialFlagged, mostRecentEntry: row.mostRecentEntry } };
  });
}

// ──────────────────────────────────────────────────────────────────
// Test data helpers
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
      type, skill: "GRAMMAR", topic, difficulty: "MEDIUM",
      promptText: "Test question prompt",
      optionA: "Option A (correct)", optionB: "Option B (wrong)",
      optionC: "Option C", optionD: "Option D",
      correctOption: "A", explanationVi: "Giải thích", commonMistake: null,
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

function assertRange(value, min, max, label) {
  if (value < min || value > max) throw new Error(`${label}: expected ${min}–${max}, got ${value}`);
}

// ──────────────────────────────────────────────────────────────────
// Suite 0: Blueprint integrity — these tests will FAIL if blueprint
//          is edited without keeping the invariants
// ──────────────────────────────────────────────────────────────────

console.log("\nBlueprint integrity");

test("EXAM_SECTION_DEPTH values sum to 40 (total exam questions)", () => {
  const total = Object.values(EXAM_SECTION_DEPTH).reduce((s, d) => s + d, 0);
  assert(total === TOTAL_EXAM_QUESTIONS, `Expected ${TOTAL_EXAM_QUESTIONS} total questions, got ${total}`);
});

test("EXAM_SECTION_WEIGHTS sum exactly to 1.0 (derived from depth / 40)", () => {
  const sum = Object.values(EXAM_SECTION_WEIGHTS).reduce((s, w) => s + w, 0);
  // Mathematically exact: (2+2+15+2+4+5+5+5)/40 = 40/40 = 1.0
  assert(Math.abs(sum - 1.0) < 1e-10, `Expected sum 1.0, got ${sum}`);
});

test("weights are proportional to depth (each weight = depth / 40)", () => {
  for (const section of ALL_SECTIONS) {
    const expected = EXAM_SECTION_DEPTH[section] / TOTAL_EXAM_QUESTIONS;
    const actual = EXAM_SECTION_WEIGHTS[section];
    assert(Math.abs(actual - expected) < 1e-12, `${section}: expected ${expected}, got ${actual}`);
  }
});

test("GRAMMAR_MCQ has highest weight (15/40 = 37.5%)", () => {
  const grammarWeight = EXAM_SECTION_WEIGHTS["GRAMMAR_MCQ"];
  for (const section of ALL_SECTIONS) {
    if (section === "GRAMMAR_MCQ") continue;
    assert(grammarWeight > EXAM_SECTION_WEIGHTS[section],
      `Expected GRAMMAR_MCQ weight > ${section} weight`);
  }
});

test("section depth values match current estimates", () => {
  assert(EXAM_SECTION_DEPTH["PHONETICS_SOUND"] === 2, "PHONETICS_SOUND: 2");
  assert(EXAM_SECTION_DEPTH["PHONETICS_STRESS"] === 2, "PHONETICS_STRESS: 2");
  assert(EXAM_SECTION_DEPTH["GRAMMAR_MCQ"] === 15, "GRAMMAR_MCQ: 15");
  assert(EXAM_SECTION_DEPTH["ERROR_IDENTIFICATION"] === 2, "ERROR_IDENTIFICATION: 2");
  assert(EXAM_SECTION_DEPTH["WORD_FORMATION"] === 4, "WORD_FORMATION: 4");
  assert(EXAM_SECTION_DEPTH["CLOZE"] === 5, "CLOZE: 5");
  assert(EXAM_SECTION_DEPTH["READING_COMPREHENSION"] === 5, "READING_COMPREHENSION: 5");
  assert(EXAM_SECTION_DEPTH["SENTENCE_TRANSFORMATION"] === 5, "SENTENCE_TRANSFORMATION: 5");
});

// ──────────────────────────────────────────────────────────────────
// Suite 1: Zero attempts
// ──────────────────────────────────────────────────────────────────

console.log("\nReadiness — zero attempts");

test("insufficientData is true", () => {
  assert(computeReadiness([], [1]).insufficientData === true);
});

test("score is 0 and band is NOT_READY", () => {
  const r = computeReadiness([], [1]);
  assert(r.readinessScore === 0, `Expected 0, got ${r.readinessScore}`);
  assert(r.band === "NOT_READY");
});

// ──────────────────────────────────────────────────────────────────
// Suite 2: Sparse data (3 questions per section, 100% correct)
// ──────────────────────────────────────────────────────────────────
// Expected calculation:
//   WTM = 1.0 (100% correct, weights sum to 1.0)
//   CDS = Σ min(3, depth)/depth × weight:
//     PHONETICS_SOUND:    min(3,2)/2  × 2/40 = 1.0  × 0.050 = 0.050
//     PHONETICS_STRESS:   min(3,2)/2  × 2/40 = 1.0  × 0.050 = 0.050
//     GRAMMAR_MCQ:        min(3,15)/15× 15/40= 0.2  × 0.375 = 0.075
//     ERROR_IDENTIFICATION:min(3,2)/2 × 2/40 = 1.0  × 0.050 = 0.050
//     WORD_FORMATION:     min(3,4)/4  × 4/40 = 0.75 × 0.100 = 0.075
//     CLOZE:              min(3,5)/5  × 5/40 = 0.6  × 0.125 = 0.075
//     READING_COMPREHENSION:min(3,5)/5× 5/40 = 0.6  × 0.125 = 0.075
//     SENTENCE_TRANSFORMATION:min(3,5)/5×5/40= 0.6  × 0.125 = 0.075
//   CDS = 0.525
//   score = round((1.0×0.6 + 0.525×0.4) × 100) = round(81) = 81 → NEARLY_READY

console.log("\nReadiness — sparse (3 per section, 100% correct)");

const sparseFullCorrect = ALL_SECTIONS.flatMap((type) =>
  [1, 2, 3].map(() => makeAttempt(type, "grammar", true))
);

test("readinessScore is 81 (WTM=1.0, CDS=0.525)", () => {
  const r = computeReadiness(sparseFullCorrect, [1]);
  assert(r.readinessScore === 81, `Expected 81, got ${r.readinessScore}`);
});

test("band is NEARLY_READY — sparse perfect data does not falsely reach EXAM_READY", () => {
  const r = computeReadiness(sparseFullCorrect, [1]);
  assert(r.band === "NEARLY_READY", `Expected NEARLY_READY, got ${r.band}`);
});

test("sparse 100% < full-depth 100% (CDS coverage drag works)", () => {
  const full100 = ALL_SECTIONS.flatMap((type) =>
    Array.from({ length: EXAM_SECTION_DEPTH[type] }, () => makeAttempt(type, "grammar", true))
  );
  const sparse = computeReadiness(sparseFullCorrect, [1]);
  const full = computeReadiness(full100, [1]);
  assert(sparse.readinessScore < full.readinessScore,
    `Expected sparse (${sparse.readinessScore}) < full (${full.readinessScore})`);
});

test("full-depth 100% gives readinessScore 100 (WTM=1.0, CDS=1.0)", () => {
  const full100 = ALL_SECTIONS.flatMap((type) =>
    Array.from({ length: EXAM_SECTION_DEPTH[type] }, () => makeAttempt(type, "grammar", true))
  );
  const r = computeReadiness(full100, [1]);
  assert(r.readinessScore === 100, `Expected 100, got ${r.readinessScore}`);
});

// ──────────────────────────────────────────────────────────────────
// Suite 3: Full depth at ~80% accuracy
// ──────────────────────────────────────────────────────────────────
// Expected calculation:
//   Both PHONETICS sections have depth 2: round(2×0.8)=2 correct → accuracy=1.0
//   ERROR_IDENTIFICATION depth 2: round(2×0.8)=2 correct → accuracy=1.0
//   GRAMMAR_MCQ depth 15: round(15×0.8)=12 correct → accuracy=0.8
//   WORD_FORMATION depth 4: round(4×0.8)=3 correct → accuracy=0.75
//   CLOZE, READING, SENTENCE depth 5: round(5×0.8)=4 correct → accuracy=0.8
//   WTM = (1.0×2 + 1.0×2 + 0.8×15 + 1.0×2 + 0.75×4 + 0.8×5 + 0.8×5 + 0.8×5) / 40
//       = (2+2+12+2+3+4+4+4)/40 = 33/40 = 0.825
//   CDS = 1.0 (all sections fully covered)
//   score = round((0.825×0.6 + 1.0×0.4)×100) = round(89.5) = 90 → EXAM_READY

console.log("\nReadiness — full depth (40 questions) at ~80% accuracy");

const fullDepthAttempts = ALL_SECTIONS.flatMap((type) => {
  const depth = EXAM_SECTION_DEPTH[type];
  return Array.from({ length: depth }, (_, i) =>
    makeAttempt(type, "grammar", i < Math.round(depth * 0.8))
  );
});

test("readinessScore is 90 (WTM=0.825, CDS=1.0)", () => {
  const r = computeReadiness(fullDepthAttempts, [1]);
  assert(r.readinessScore === 90, `Expected 90, got ${r.readinessScore}`);
});

test("band is EXAM_READY at full depth ~80%", () => {
  const r = computeReadiness(fullDepthAttempts, [1]);
  assert(r.band === "EXAM_READY", `Expected EXAM_READY, got ${r.band}`);
});

// ──────────────────────────────────────────────────────────────────
// Suite 4: Weakness signals
// ──────────────────────────────────────────────────────────────────

console.log("\nWeakness signals");

const weaknessAttempts = [
  makeAttempt("GRAMMAR_MCQ", "conditionals", false, "B"),
  makeAttempt("GRAMMAR_MCQ", "conditionals", false, "B"),
  makeAttempt("GRAMMAR_MCQ", "conditionals", false, "B"),
  makeAttempt("GRAMMAR_MCQ", "conditionals", true),
  makeAttempt("PHONETICS_SOUND", "phonetics", false, "C"),
  makeAttempt("PHONETICS_SOUND", "phonetics", false, "C"),
  makeAttempt("READING_COMPREHENSION", "reading", true),
];

test("returns at most 2 weakness topics (only 2 have errors)", () => {
  const r = computeWeaknessSignals(weaknessAttempts);
  assert(r.length === 2, `Expected 2 topics, got ${r.length}`);
});

test("grammar topic ranks first (higher riskScore)", () => {
  const r = computeWeaknessSignals(weaknessAttempts);
  assert(r[0].topic === "conditionals", `Expected conditionals first, got ${r[0].topic}`);
});

test("topic alias: 'conditional' normalizes to 'conditionals'", () => {
  assert(canonicalTopic("conditional") === "conditionals");
});

test("grammar pattern (B×3) → studentVisible: true", () => {
  const r = computeWeaknessSignals(weaknessAttempts);
  const g = r.find((x) => x.topic === "conditionals");
  assert(g?.patternObservation !== null, "Expected pattern observation");
  assert(g.patternObservation.occurrenceCount === 3);
  assert(g.patternObservation.studentVisible === true);
});

test("phonetics pattern (C×2) → studentVisible: false (tutor only)", () => {
  const r = computeWeaknessSignals(weaknessAttempts);
  const p = r.find((x) => x.topic === "phonetics");
  assert(p?.patternObservation !== null, "Expected pattern observation");
  assert(p.patternObservation.occurrenceCount === 2);
  assert(p.patternObservation.studentVisible === false);
});

// ──────────────────────────────────────────────────────────────────
// Suite 6: enrichWeaknessWithNotebook
// ──────────────────────────────────────────────────────────────────

console.log("\nenrichWeaknessWithNotebook");

test("matching notebook row populates notebookContext", () => {
  const weakness = [{ topic: "conditionals", notebookContext: null }];
  const rows = [{ topic: "conditionals", entryCount: 2, totalOccurrences: 5, isRemedialFlagged: false, mostRecentEntry: null }];
  const result = enrichWeaknessWithNotebook(weakness, rows);
  assert(result[0].notebookContext !== null);
  assert(result[0].notebookContext.entryCount === 2);
});

test("no matching row → notebookContext remains null", () => {
  const weakness = [{ topic: "tenses", notebookContext: null }];
  const result = enrichWeaknessWithNotebook(weakness, []);
  assert(result[0].notebookContext === null);
});

// ──────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Analytics engine: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
