/**
 * Standalone narrative layer verification.
 * Tests pure functions only — no DB, no network, no imports.
 *
 * Run: node scripts/test-narrative.mjs
 *
 * Inlines all narrative logic (mirrors narrative.ts) so this script
 * runs without TypeScript compilation. Keep in sync with narrative.ts.
 */

// ──────────────────────────────────────────────────────────────────
// Inlined narrative logic (mirrors lib/analytics/narrative.ts)
// ──────────────────────────────────────────────────────────────────

const BAND_HEADLINE = {
  EXAM_READY: "Bạn đang ở mức sẵn sàng thi!",
  NEARLY_READY: "Bạn đang đến rất gần đích rồi!",
  DEVELOPING: "Bạn đang xây dựng nền tảng vững chắc.",
  NOT_READY: "Chúng ta có nhiều dư địa để phát triển!",
};

const BAND_EXPLANATION = {
  EXAM_READY:
    "Kết quả cho thấy bạn đã nắm vững các nội dung quan trọng và luyện tập đủ rộng. Hãy tiếp tục duy trì phong độ này.",
  NEARLY_READY:
    "Bạn đã nắm được nhiều nội dung. Chỉ cần thêm luyện tập ở một số phần là sẽ sẵn sàng.",
  DEVELOPING:
    "Đây là giai đoạn quan trọng để củng cố kiến thức. Mỗi buổi luyện tập đều giúp bạn tiến thêm một bước.",
  NOT_READY:
    "Bạn đang ở giai đoạn đầu của hành trình. Hãy tập trung vào từng phần một — tiến độ nhỏ mỗi ngày sẽ cộng lại thành kết quả lớn.",
};

const CONFIDENCE_NOTE = {
  OBSERVED:
    "Lưu ý: Kết quả dựa trên số ít câu hỏi, nên chỉ mang tính tham khảo bước đầu. Hãy luyện thêm để có đánh giá chính xác hơn.",
  EMERGING: null,
  CONFIRMED: null,
};

function generateReadinessNarrative(response) {
  if (response.readiness.insufficientData) {
    return {
      headline: "Hãy bắt đầu luyện tập để xem kết quả của bạn!",
      explanation:
        "Chưa có đủ dữ liệu để phân tích. Hãy hoàn thành một số câu hỏi trong buổi học này để Lexi có thể đưa ra nhận xét chính xác hơn.",
      strongestArea: null,
      nextFocus: null,
      confidenceNote: null,
    };
  }

  const { band, confidence } = response.readiness;

  let explanation = BAND_EXPLANATION[band];
  const unassessed = response.blueprintCoverage.unassessedCount;
  if (unassessed > 3) {
    explanation += ` Có ${unassessed} phần chưa được luyện — luyện thêm ở những phần này sẽ cải thiện kết quả rõ rệt.`;
  } else if (unassessed > 0 && band === "NEARLY_READY") {
    explanation += ` Luyện thêm ở ${unassessed} phần còn thiếu sẽ đưa bạn qua ngưỡng sẵn sàng.`;
  }

  const strongestSection = response.sectionBreakdown
    .filter((s) => s.attemptCount >= 2)
    .sort((a, b) => b.accuracy - a.accuracy)[0] ?? null;

  const strongestArea = strongestSection
    ? `${strongestSection.label} (${Math.round(strongestSection.accuracy * 100)}%)`
    : null;

  let nextFocus = null;
  if (response.weaknessSignals.length > 0) {
    nextFocus = response.weaknessSignals[0].label;
  } else {
    const lowestDepth = response.sectionBreakdown
      .filter((s) => s.depthRatio < 1.0)
      .sort((a, b) => a.depthRatio - b.depthRatio)[0] ?? null;
    nextFocus = lowestDepth ? lowestDepth.label : null;
  }

  return {
    headline: BAND_HEADLINE[band],
    explanation,
    strongestArea,
    nextFocus,
    confidenceNote: CONFIDENCE_NOTE[confidence],
  };
}

function buildWeaknessGuidance(accuracy, label) {
  if (accuracy < 0.3) return `${label} là hướng luyện tập ưu tiên ngay lúc này. Hãy bắt đầu với những bài tập cơ bản để xây dựng nền tảng vững chắc hơn.`;
  if (accuracy <= 0.5) return `Bạn đã hiểu được một phần ở ${label} — luyện thêm sẽ giúp kiến thức trở nên chắc chắn hơn.`;
  if (accuracy < 0.7) return `Bạn gần đạt mức tốt ở ${label} rồi. Một chút luyện tập thêm sẽ tạo ra sự khác biệt lớn.`;
  return `Bạn đang làm tốt ở ${label} — hãy chú ý giữ vững và luyện thêm để đạt kết quả cao hơn.`;
}

function generateWeaknessNarrative(weaknessSignals) {
  return weaknessSignals.map((signal) => {
    const correctCount = signal.totalAttempts - signal.wrongCount;
    const pct = Math.round(signal.accuracy * 100);
    const evidenceNote = `Bạn đã thử ${signal.totalAttempts} câu, đúng ${correctCount} câu (${pct}%).`;
    const guidance = buildWeaknessGuidance(signal.accuracy, signal.label);

    let patternNote = null;
    if (signal.patternObservation?.studentVisible) {
      const { selectedOption, occurrenceCount } = signal.patternObservation;
      patternNote = `Bạn đã chọn đáp án ${selectedOption} sai ${occurrenceCount} lần — hãy đọc kỹ lại lý thuyết liên quan để hiểu rõ vì sao ${selectedOption} chưa đúng ở đây.`;
    }

    let notebookNote = null;
    if (signal.notebookContext) {
      if (signal.notebookContext.isRemedialFlagged) {
        notebookNote = "Chủ đề này đã xuất hiện nhiều lần trong sổ ghi chú — hãy dành thêm thời gian ôn lại, đây là cơ hội tốt để đạt điểm cao hơn.";
      } else if (signal.notebookContext.entryCount > 0) {
        notebookNote = `Chủ đề này đã được ghi chú ${signal.notebookContext.entryCount} lần trước đây.`;
      }
    }

    return { topic: signal.topic, label: signal.label, guidance, evidenceNote, patternNote, notebookNote };
  });
}

// ──────────────────────────────────────────────────────────────────
// Mock contract data
// ──────────────────────────────────────────────────────────────────

const ALL_SECTIONS_BREAKDOWN = [
  { section: "PHONETICS_SOUND",       label: "Ngữ âm — âm thanh",    accuracy: 1.0,  attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0 },
  { section: "PHONETICS_STRESS",      label: "Ngữ âm — trọng âm",    accuracy: 0.85, attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0 },
  { section: "GRAMMAR_MCQ",           label: "Ngữ pháp / Từ vựng",   accuracy: 0.8,  attemptCount: 15, expectedDepth: 15, examWeight: 0.375, depthRatio: 1.0 },
  { section: "ERROR_IDENTIFICATION",  label: "Nhận diện lỗi sai",     accuracy: 0.9,  attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0 },
  { section: "WORD_FORMATION",        label: "Hình thành từ",          accuracy: 0.75, attemptCount: 4,  expectedDepth: 4,  examWeight: 0.1,   depthRatio: 1.0 },
  { section: "CLOZE",                 label: "Điền vào chỗ trống",    accuracy: 0.8,  attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0 },
  { section: "READING_COMPREHENSION", label: "Đọc hiểu",               accuracy: 0.9,  attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0 },
  { section: "SENTENCE_TRANSFORMATION",label: "Viết lại câu",          accuracy: 0.8,  attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0 },
];

const HIGH_READINESS_RESPONSE = {
  sessionNumber: 22,
  generatedAt: new Date().toISOString(),
  confidence: "CONFIRMED",
  readiness: { score: 90, band: "EXAM_READY", confidence: "CONFIRMED", insufficientData: false },
  blueprintCoverage: { assessedCount: 8, partialCount: 0, unassessedCount: 0, sections: [] },
  weaknessSignals: [],
  sectionBreakdown: ALL_SECTIONS_BREAKDOWN,
};

const LOW_CONFIDENCE_RESPONSE = {
  sessionNumber: 1,
  generatedAt: new Date().toISOString(),
  confidence: "OBSERVED",
  readiness: { score: 60, band: "DEVELOPING", confidence: "OBSERVED", insufficientData: false },
  blueprintCoverage: { assessedCount: 2, partialCount: 2, unassessedCount: 4, sections: [] },
  weaknessSignals: [
    {
      topic: "conditionals",
      label: "Conditionals",
      riskScore: 0.375,
      wrongCount: 2,
      totalAttempts: 3,
      accuracy: 1 / 3,
      confidence: "OBSERVED",
      patternObservation: null,
      notebookContext: null,
      wrongAnswers: [],
    },
  ],
  sectionBreakdown: [
    { section: "PHONETICS_SOUND",  label: "Ngữ âm — âm thanh",  accuracy: 1.0, attemptCount: 2, expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0 },
    { section: "GRAMMAR_MCQ",      label: "Ngữ pháp / Từ vựng", accuracy: 0.5, attemptCount: 3, expectedDepth: 15, examWeight: 0.375, depthRatio: 0.2 },
    { section: "CLOZE",            label: "Điền vào chỗ trống", accuracy: 0.0, attemptCount: 0, expectedDepth: 5,  examWeight: 0.125, depthRatio: 0.0 },
    { section: "READING_COMPREHENSION", label: "Đọc hiểu",      accuracy: 0.0, attemptCount: 0, expectedDepth: 5,  examWeight: 0.125, depthRatio: 0.0 },
    { section: "WORD_FORMATION",   label: "Hình thành từ",       accuracy: 0.75, attemptCount: 2, expectedDepth: 4, examWeight: 0.1,  depthRatio: 0.5 },
    { section: "SENTENCE_TRANSFORMATION", label: "Viết lại câu", accuracy: 0.0, attemptCount: 0, expectedDepth: 5, examWeight: 0.125, depthRatio: 0.0 },
    { section: "PHONETICS_STRESS", label: "Ngữ âm — trọng âm",  accuracy: 0.0, attemptCount: 0, expectedDepth: 2,  examWeight: 0.05,  depthRatio: 0.0 },
    { section: "ERROR_IDENTIFICATION", label: "Nhận diện lỗi sai", accuracy: 0.0, attemptCount: 0, expectedDepth: 2, examWeight: 0.05, depthRatio: 0.0 },
  ],
};

const INSUFFICIENT_DATA_RESPONSE = {
  sessionNumber: 5,
  generatedAt: new Date().toISOString(),
  confidence: "OBSERVED",
  readiness: { score: 0, band: "NOT_READY", confidence: "OBSERVED", insufficientData: true },
  blueprintCoverage: { assessedCount: 0, partialCount: 0, unassessedCount: 8, sections: [] },
  weaknessSignals: [],
  sectionBreakdown: [],
};

const WEAKNESS_WITH_PATTERN = [
  {
    topic: "conditionals",
    label: "Conditionals",
    riskScore: 0.375,
    wrongCount: 3,
    totalAttempts: 4,
    accuracy: 0.25,
    confidence: "OBSERVED",
    patternObservation: { selectedOption: "B", occurrenceCount: 3, exampleOptionText: "...", confidence: "OBSERVED", studentVisible: true },
    notebookContext: { entryCount: 2, totalOccurrences: 5, isRemedialFlagged: true, mostRecentEntry: null },
    wrongAnswers: [],
  },
];

const WEAKNESS_NO_PATTERN = [
  {
    topic: "passive_voice",
    label: "Passive Voice",
    riskScore: 0.2,
    wrongCount: 1,
    totalAttempts: 2,
    accuracy: 0.5,
    confidence: "OBSERVED",
    patternObservation: null,
    notebookContext: null,
    wrongAnswers: [],
  },
];

// ──────────────────────────────────────────────────────────────────
// Test harness
// ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

function assertContains(str, substring, label) {
  if (!str.includes(substring)) throw new Error(`${label}: expected "${str}" to contain "${substring}"`);
}

function assertNotContains(str, word, label) {
  if (str.includes(word)) throw new Error(`${label}: "${word}" found in "${str}" (forbidden vocabulary)`);
}

// ──────────────────────────────────────────────────────────────────
// Suite 1: High readiness (EXAM_READY, CONFIRMED)
// ──────────────────────────────────────────────────────────────────

console.log("\nReadiness narrative — high (EXAM_READY, CONFIRMED)");

test("headline matches EXAM_READY template", () => {
  const n = generateReadinessNarrative(HIGH_READINESS_RESPONSE);
  assert(n.headline === BAND_HEADLINE["EXAM_READY"], `Got: "${n.headline}"`);
});

test("no confidence note when CONFIRMED", () => {
  const n = generateReadinessNarrative(HIGH_READINESS_RESPONSE);
  assert(n.confidenceNote === null, `Expected null, got: "${n.confidenceNote}"`);
});

test("strongestArea is the highest-accuracy assessed section (Ngữ âm — âm thanh 100%)", () => {
  const n = generateReadinessNarrative(HIGH_READINESS_RESPONSE);
  assert(n.strongestArea !== null, "Expected strongestArea to be set");
  assertContains(n.strongestArea, "100%", "strongestArea accuracy");
  assertContains(n.strongestArea, "Ngữ âm — âm thanh", "strongestArea label");
});

test("nextFocus is null when no weaknessSignals and all at full depth", () => {
  const n = generateReadinessNarrative(HIGH_READINESS_RESPONSE);
  assert(n.nextFocus === null, `Expected null nextFocus, got: "${n.nextFocus}"`);
});

test("explanation is non-empty string", () => {
  const n = generateReadinessNarrative(HIGH_READINESS_RESPONSE);
  assert(typeof n.explanation === "string" && n.explanation.length > 10);
});

// ──────────────────────────────────────────────────────────────────
// Suite 2: Low confidence (DEVELOPING, OBSERVED)
// ──────────────────────────────────────────────────────────────────

console.log("\nReadiness narrative — low confidence (DEVELOPING, OBSERVED)");

test("headline matches DEVELOPING template", () => {
  const n = generateReadinessNarrative(LOW_CONFIDENCE_RESPONSE);
  assert(n.headline === BAND_HEADLINE["DEVELOPING"], `Got: "${n.headline}"`);
});

test("confidenceNote is set when OBSERVED", () => {
  const n = generateReadinessNarrative(LOW_CONFIDENCE_RESPONSE);
  assert(n.confidenceNote !== null, "Expected a confidence note for OBSERVED data");
  assertContains(n.confidenceNote, "Lưu ý", "confidenceNote prefix");
});

test("nextFocus is first weaknessSignal label when signals exist", () => {
  const n = generateReadinessNarrative(LOW_CONFIDENCE_RESPONSE);
  assert(n.nextFocus === "Conditionals", `Expected "Conditionals", got: "${n.nextFocus}"`);
});

test("no coverage note appended when unassessedCount ≤ 3 and band is not NEARLY_READY", () => {
  // LOW_CONFIDENCE_RESPONSE has unassessedCount=4, band=DEVELOPING
  // unassessed > 3 so the coverage note SHOULD be appended
  const n = generateReadinessNarrative(LOW_CONFIDENCE_RESPONSE);
  assertContains(n.explanation, "phần chưa được luyện", "coverage note");
});

// ──────────────────────────────────────────────────────────────────
// Suite 3: Insufficient data
// ──────────────────────────────────────────────────────────────────

console.log("\nReadiness narrative — insufficient data");

test("returns 'start practicing' headline", () => {
  const n = generateReadinessNarrative(INSUFFICIENT_DATA_RESPONSE);
  assertContains(n.headline, "bắt đầu luyện tập", "insufficient data headline");
});

test("strongestArea is null", () => {
  const n = generateReadinessNarrative(INSUFFICIENT_DATA_RESPONSE);
  assert(n.strongestArea === null, `Expected null, got: "${n.strongestArea}"`);
});

test("nextFocus is null", () => {
  const n = generateReadinessNarrative(INSUFFICIENT_DATA_RESPONSE);
  assert(n.nextFocus === null, `Expected null, got: "${n.nextFocus}"`);
});

test("confidenceNote is null (not relevant when no data)", () => {
  const n = generateReadinessNarrative(INSUFFICIENT_DATA_RESPONSE);
  assert(n.confidenceNote === null, "Expected no confidence note for empty session");
});

// ──────────────────────────────────────────────────────────────────
// Suite 4: Weakness narratives
// ──────────────────────────────────────────────────────────────────

console.log("\nWeakness narrative");

test("evidence note includes attempt count and correct count", () => {
  const results = generateWeaknessNarrative(WEAKNESS_WITH_PATTERN);
  const w = results[0];
  assertContains(w.evidenceNote, "4 câu", "attempt count");
  assertContains(w.evidenceNote, "đúng 1 câu", "correct count");
  assertContains(w.evidenceNote, "25%", "percentage");
});

test("pattern note set when studentVisible=true (B×3)", () => {
  const results = generateWeaknessNarrative(WEAKNESS_WITH_PATTERN);
  assert(results[0].patternNote !== null, "Expected pattern note");
  assertContains(results[0].patternNote, "B", "selected option in pattern note");
  assertContains(results[0].patternNote, "3 lần", "occurrence count in pattern note");
});

test("notebook note uses remedial-flagged copy when isRemedialFlagged=true", () => {
  const results = generateWeaknessNarrative(WEAKNESS_WITH_PATTERN);
  assert(results[0].notebookNote !== null, "Expected notebook note");
  assertContains(results[0].notebookNote, "nhiều lần", "remedial flag copy");
});

test("guidance uses 'practice focus' language — no negative labels", () => {
  const results = generateWeaknessNarrative(WEAKNESS_WITH_PATTERN);
  const g = results[0].guidance;
  assertNotContains(g, "sai", "guidance avoids 'sai'");
  assertNotContains(g, "thất bại", "guidance avoids 'thất bại'");
  assertNotContains(g, "nghiêm trọng", "guidance avoids 'nghiêm trọng'");
});

test("guidance uses low-accuracy framing when accuracy < 0.3 (0.25)", () => {
  const results = generateWeaknessNarrative(WEAKNESS_WITH_PATTERN);
  assertContains(results[0].guidance, "ưu tiên", "low accuracy guidance contains 'ưu tiên'");
});

test("pattern note is null when patternObservation is null", () => {
  const results = generateWeaknessNarrative(WEAKNESS_NO_PATTERN);
  assert(results[0].patternNote === null, "Expected null patternNote");
});

test("notebookNote is null when notebookContext is null", () => {
  const results = generateWeaknessNarrative(WEAKNESS_NO_PATTERN);
  assert(results[0].notebookNote === null, "Expected null notebookNote");
});

test("guidance uses mid-accuracy framing when accuracy ≤ 0.5 (exactly 0.5)", () => {
  const results = generateWeaknessNarrative(WEAKNESS_NO_PATTERN);
  assertContains(results[0].guidance, "hiểu được một phần", "mid accuracy guidance");
});

// ──────────────────────────────────────────────────────────────────
// Suite 6: Persona compliance (forbidden vocabulary)
// ──────────────────────────────────────────────────────────────────

console.log("\nPersona compliance — forbidden vocabulary");

const ALL_NARRATIVES_TEXT = (() => {
  const rHigh = generateReadinessNarrative(HIGH_READINESS_RESPONSE);
  const rLow = generateReadinessNarrative(LOW_CONFIDENCE_RESPONSE);
  const rInsufficient = generateReadinessNarrative(INSUFFICIENT_DATA_RESPONSE);
  const w = generateWeaknessNarrative(WEAKNESS_WITH_PATTERN);

  return [
    rHigh.headline, rHigh.explanation ?? "", rHigh.strongestArea ?? "", rHigh.nextFocus ?? "",
    rLow.headline, rLow.explanation ?? "", rLow.confidenceNote ?? "",
    rInsufficient.headline, rInsufficient.explanation ?? "",
    ...(w.flatMap(x => [x.guidance, x.evidenceNote, x.patternNote ?? "", x.notebookNote ?? ""])),
  ].join(" ");
})();

const FORBIDDEN = [
  "chẩn đoán", "xác nhận hoàn toàn", "nghiêm trọng",
  "mất chú ý", "suy giảm chú ý", "vấn đề tâm lý",
  "thất bại", "kém", "tệ",
];

for (const word of FORBIDDEN) {
  test(`does not contain forbidden word: "${word}"`, () => {
    assertNotContains(ALL_NARRATIVES_TEXT, word, "combined output");
  });
}

// ──────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Narrative layer: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
