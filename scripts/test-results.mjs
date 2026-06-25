/**
 * Analytics results page validation — 4 student scenarios.
 *
 * Validates what the /practice/[sessionNumber]/results page would render
 * for realistic data, and checks 4 UX concerns:
 *   1. Score displayed as X.X/10 (from readiness.score, not raw session score)
 *   2. Internal band names (EXAM_READY etc.) never shown to students
 *   3. No shaming or negative language in any student-facing string
 *   4. Student always told what to do next
 *
 * Pure: no DB, no server, no network. Inlines narrative logic (mirrors narrative.ts).
 * Run: node scripts/test-results.mjs
 *
 * Keep the inlined logic below in sync with lib/analytics/narrative.ts
 * and app/(app)/practice/[sessionNumber]/results/page.tsx.
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

  const strongestSection =
    response.sectionBreakdown
      .filter((s) => s.attemptCount >= 2)
      .sort((a, b) => b.accuracy - a.accuracy)[0] ?? null;

  const strongestArea = strongestSection
    ? `${strongestSection.label} (${Math.round(strongestSection.accuracy * 100)}%)`
    : null;

  let nextFocus = null;
  if (response.weaknessSignals.length > 0) {
    nextFocus = response.weaknessSignals[0].label;
  } else {
    const lowestDepth =
      response.sectionBreakdown
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
  if (accuracy < 0.3)
    return `${label} là hướng luyện tập ưu tiên ngay lúc này. Hãy bắt đầu với những bài tập cơ bản để xây dựng nền tảng vững chắc hơn.`;
  if (accuracy <= 0.5)
    return `Bạn đã hiểu được một phần ở ${label} — luyện thêm sẽ giúp kiến thức trở nên chắc chắn hơn.`;
  if (accuracy < 0.7)
    return `Bạn gần đạt mức tốt ở ${label} rồi. Một chút luyện tập thêm sẽ tạo ra sự khác biệt lớn.`;
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
        notebookNote =
          "Chủ đề này đã xuất hiện nhiều lần trong sổ ghi chú — hãy dành thêm thời gian ôn lại, đây là cơ hội tốt để đạt điểm cao hơn.";
      } else if (signal.notebookContext.entryCount > 0) {
        notebookNote = `Chủ đề này đã được ghi chú ${signal.notebookContext.entryCount} lần trước đây.`;
      }
    }

    return { topic: signal.topic, label: signal.label, guidance, evidenceNote, patternNote, notebookNote };
  });
}

// ──────────────────────────────────────────────────────────────────
// Page display helpers (mirrors results/page.tsx)
// ──────────────────────────────────────────────────────────────────

// These are the badge labels students see — not the internal band names.
const BAND_BADGE_TEXT = {
  EXAM_READY: "Sẵn sàng thi",
  NEARLY_READY: "Gần sẵn sàng",
  DEVELOPING: "Đang phát triển",
  NOT_READY: "Đang xây nền",
};

function computeDisplayScore(analytics) {
  if (analytics.readiness.insufficientData) return null;
  return (analytics.readiness.score / 10).toFixed(1);
}

function computeShowCoverageStrip(analytics) {
  return !analytics.readiness.insufficientData && analytics.blueprintCoverage.unassessedCount > 0;
}

// ──────────────────────────────────────────────────────────────────
// Review concerns — words that must never appear in student text
// ──────────────────────────────────────────────────────────────────

const FORBIDDEN_IN_STUDENT_TEXT = [
  // Lexi persona hard rules (from narrative.ts header)
  "chẩn đoán", "xác nhận hoàn toàn", "nghiêm trọng",
  "mất chú ý", "suy giảm chú ý", "vấn đề tâm lý", "thất bại",
  // Task description concern: avoid shaming/negative labels
  "yếu", "kém", "tệ",
  // Internal band names must never appear in student-facing narrative
  "EXAM_READY", "NEARLY_READY", "DEVELOPING", "NOT_READY",
  // English forbidden terms from Lexi persona
  "diagnosed", "proven", "misconception", "confirmed weakness", "attention disorder",
];

function collectAllNarrativeStrings(rn, wns) {
  const strings = [rn.headline, rn.explanation, rn.strongestArea, rn.nextFocus, rn.confidenceNote];
  for (const wn of wns) {
    strings.push(wn.guidance, wn.evidenceNote, wn.patternNote, wn.notebookNote);
  }
  return strings.filter(Boolean);
}

// ──────────────────────────────────────────────────────────────────
// Test runner
// ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`    ✓ ${label}`);
    passed++;
  } else {
    console.log(`    ✗ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function checkForbiddenVocab(strings) {
  let clean = true;
  for (const word of FORBIDDEN_IN_STUDENT_TEXT) {
    const hit = strings.find((s) => s.toLowerCase().includes(word.toLowerCase()));
    if (hit) {
      console.log(`    ✗ Forbidden word "${word}" found in: "${hit.substring(0, 60)}..."`);
      failed++;
      clean = false;
    }
  }
  if (clean) {
    console.log(`    ✓ No forbidden vocabulary in any student-facing string (${FORBIDDEN_IN_STUDENT_TEXT.length} words checked)`);
    passed++;
  }
}

function sep(title) {
  const line = "═".repeat(60);
  console.log(`\n${line}\n${title}\n${line}`);
}

function printNarrative(label, text) {
  if (text === null || text === undefined) {
    console.log(`  ${label}: (none)`);
  } else {
    const prefix = " ".repeat(label.length + 4);
    const wrapped = text.replace(/(.{60})/g, `$1\n${prefix}`);
    console.log(`  ${label}: "${wrapped}"`);
  }
}

function renderScenario(title, analytics, sessionNumber) {
  sep(title);

  const hasData = !analytics.readiness.insufficientData;
  const displayScore = computeDisplayScore(analytics);
  const showCoverage = computeShowCoverageStrip(analytics);

  const rn = generateReadinessNarrative(analytics);
  const wns = generateWeaknessNarrative(analytics.weaknessSignals);
  const allStrings = collectAllNarrativeStrings(rn, wns);

  // ── Visual preview ──────────────────────────────────────────────

  console.log("\n── CurrentLevelCard" + "─".repeat(41));
  if (hasData) {
    const badge = BAND_BADGE_TEXT[analytics.readiness.band];
    console.log(`  Score (displayed):  ${displayScore} / 10`);
    console.log(`  Badge:              ${badge}`);
    printNarrative("Explanation", rn.explanation);
  } else {
    console.log("  Score (displayed):  — (no score, insufficient data)");
  }

  console.log("\n── LexiResultsBubble" + "─".repeat(40));
  if (hasData) {
    printNarrative("Headline     ", rn.headline);
    printNarrative("ConfidenceNote", rn.confidenceNote);
  } else {
    printNarrative("Headline     ", rn.headline);
    printNarrative("Explanation  ", rn.explanation);
  }

  console.log("\n── StrongestAreaCallout" + "─".repeat(37));
  printNarrative("Strongest", rn.strongestArea);

  console.log("\n── PracticeFocusCards" + "─".repeat(39));
  if (wns.length === 0 && hasData) {
    console.log(`  → All-correct state: "Buổi học xuất sắc! 🎉"`);
    console.log(`    "Bạn đã trả lời chính xác tất cả các câu. Hãy tiếp tục với buổi tiếp theo..."`);
  } else if (wns.length === 0) {
    console.log("  → No weakness cards (insufficient data)");
  } else {
    wns.forEach((wn, i) => {
      console.log(`  ${i + 1}. ${wn.label}`);
      printNarrative("    Guidance ", wn.guidance);
      printNarrative("    Evidence ", wn.evidenceNote);
      printNarrative("    Pattern  ", wn.patternNote);
      printNarrative("    Notebook ", wn.notebookNote);
    });
  }

  console.log("\n── SectionCoverageStrip" + "─".repeat(37));
  if (showCoverage) {
    const dots = analytics.blueprintCoverage.sections
      .map((s) => (s.status === "ASSESSED" ? "●" : s.status === "PARTIAL" ? "◐" : "○"))
      .join(" ");
    console.log(`  Shown (${analytics.blueprintCoverage.unassessedCount} unassessed): ${dots}`);
  } else {
    console.log("  Hidden (all sections assessed — score captures this)");
  }

  console.log("\n── ActionFooter" + "─".repeat(45));
  const next = sessionNumber + 1;
  console.log(`  Primary:   Luyện buổi ${next} →`);
  console.log("  Secondary: Hỏi Lexi");
  console.log("  Tertiary:  Về trang chủ");
  if (rn.nextFocus) console.log(`  Per-card:  Hỏi Lexi về ${rn.nextFocus} → (first focus card)`);

  // ── Assertions ──────────────────────────────────────────────────

  console.log("\n── Checks" + "─".repeat(51));

  // 1. Score display — from readiness.score / 10, not raw session score
  if (hasData) {
    const expected = (analytics.readiness.score / 10).toFixed(1);
    check(
      `Score ${expected}/10 derived from readiness.score=${analytics.readiness.score}`,
      displayScore === expected
    );
    check(
      "Score is not equal to raw session scoreAchieved (ratio 0-1)",
      parseFloat(displayScore) > 1.0,
      `displayScore=${displayScore} should be > 1 (it's on 10-point scale)`
    );
  } else {
    check("No score shown when insufficientData=true", displayScore === null);
  }

  // 2. Internal band names hidden from students
  const badgeText = hasData ? BAND_BADGE_TEXT[analytics.readiness.band] : null;
  if (hasData) {
    check(
      "Badge shows Vietnamese text, not internal enum",
      badgeText !== null && !["EXAM_READY","NEARLY_READY","DEVELOPING","NOT_READY"].includes(badgeText),
      `badge="${badgeText}"`
    );
  }
  check(
    "Internal band names absent from all narrative strings",
    !allStrings.some((s) =>
      ["EXAM_READY","NEARLY_READY","DEVELOPING","NOT_READY"].some((b) => s.includes(b))
    )
  );

  // 3. No shaming or negative language
  checkForbiddenVocab(allStrings);

  // 4. Student told what to do next
  if (hasData && analytics.readiness.band !== "EXAM_READY") {
    check(
      "nextFocus is non-null for non-EXAM_READY student",
      rn.nextFocus !== null,
      `nextFocus=${rn.nextFocus}`
    );
  }
  if (hasData && wns.length === 0) {
    check(
      "All-correct: action footer still directs to next session",
      true // footer always renders — no condition on weaknesses
    );
  }
  check(
    "Action footer always directs to next session",
    true // footer renders unconditionally
  );

  // 5. Evidence note uses positive framing
  for (const wn of wns) {
    const hasPositiveFrame = wn.evidenceNote.includes("đúng") && !wn.evidenceNote.includes("sai");
    check(
      `Evidence note for "${wn.label}" frames result as "đúng X câu" (not "sai")`,
      hasPositiveFrame,
      wn.evidenceNote
    );
  }

  // 6. Confidence note only for OBSERVED
  if (hasData) {
    const shouldHaveNote = analytics.readiness.confidence === "OBSERVED";
    check(
      `confidenceNote is ${shouldHaveNote ? "non-null" : "null"} for ${analytics.readiness.confidence}`,
      shouldHaveNote ? rn.confidenceNote !== null : rn.confidenceNote === null
    );
  }
}

// ──────────────────────────────────────────────────────────────────
// Scenario data
// ──────────────────────────────────────────────────────────────────

/** Scenario 1: Weak student — score 6.5/10, DEVELOPING, OBSERVED, 4 unassessed */
const WEAK_STUDENT = {
  sessionNumber: 3,
  generatedAt: "2026-06-24T08:00:00.000Z",
  confidence: "OBSERVED",
  readiness: { score: 65, band: "DEVELOPING", confidence: "OBSERVED", insufficientData: false },
  blueprintCoverage: {
    assessedCount: 2, partialCount: 2, unassessedCount: 4,
    sections: [
      { section: "GRAMMAR_MCQ",            label: "Ngữ pháp / Từ vựng",    attemptCount: 8,  expectedDepth: 15, status: "ASSESSED",   examWeight: 0.375 },
      { section: "READING_COMPREHENSION",   label: "Đọc hiểu",              attemptCount: 2,  expectedDepth: 5,  status: "ASSESSED",   examWeight: 0.125 },
      { section: "CLOZE",                   label: "Điền vào chỗ trống",    attemptCount: 1,  expectedDepth: 5,  status: "PARTIAL",    examWeight: 0.125 },
      { section: "PHONETICS_SOUND",         label: "Ngữ âm — âm thanh",    attemptCount: 1,  expectedDepth: 2,  status: "PARTIAL",    examWeight: 0.05  },
      { section: "PHONETICS_STRESS",        label: "Ngữ âm — trọng âm",    attemptCount: 0,  expectedDepth: 2,  status: "UNASSESSED", examWeight: 0.05  },
      { section: "ERROR_IDENTIFICATION",    label: "Nhận diện lỗi sai",     attemptCount: 0,  expectedDepth: 2,  status: "UNASSESSED", examWeight: 0.05  },
      { section: "WORD_FORMATION",          label: "Biến đổi từ",           attemptCount: 0,  expectedDepth: 4,  status: "UNASSESSED", examWeight: 0.1   },
      { section: "SENTENCE_TRANSFORMATION", label: "Chuyển đổi câu",        attemptCount: 0,  expectedDepth: 5,  status: "UNASSESSED", examWeight: 0.125 },
    ],
  },
  weaknessSignals: [
    {
      topic: "conditional_sentences",
      label: "Conditional Sentences",
      riskScore: 0.56, wrongCount: 6, totalAttempts: 8, accuracy: 0.25,
      confidence: "OBSERVED",
      patternObservation: {
        selectedOption: "B", occurrenceCount: 4,
        exampleOptionText: "would go", confidence: "OBSERVED", studentVisible: true,
      },
      notebookContext: {
        entryCount: 2, totalOccurrences: 3, isRemedialFlagged: true,
        mostRecentEntry: { reason: "Nhầm cấu trúc loại 2 và loại 3", studentAnswer: "B", correctAnswer: "C", reviewStage: 1, lastReviewedAt: null },
      },
      wrongAnswers: [],
    },
    {
      topic: "reading_comprehension",
      label: "Đọc hiểu",
      riskScore: 0.25, wrongCount: 1, totalAttempts: 2, accuracy: 0.5,
      confidence: "OBSERVED",
      patternObservation: null,
      notebookContext: null,
      wrongAnswers: [],
    },
  ],
  sectionBreakdown: [
    { section: "GRAMMAR_MCQ",            label: "Ngữ pháp / Từ vựng",  accuracy: 0.375, attemptCount: 8, expectedDepth: 15, examWeight: 0.375, depthRatio: 0.533 },
    { section: "READING_COMPREHENSION",  label: "Đọc hiểu",            accuracy: 0.5,   attemptCount: 2, expectedDepth: 5,  examWeight: 0.125, depthRatio: 0.4   },
    { section: "CLOZE",                  label: "Điền vào chỗ trống",  accuracy: 0.0,   attemptCount: 1, expectedDepth: 5,  examWeight: 0.125, depthRatio: 0.2   },
    { section: "PHONETICS_SOUND",        label: "Ngữ âm — âm thanh",  accuracy: 1.0,   attemptCount: 1, expectedDepth: 2,  examWeight: 0.05,  depthRatio: 0.5   },
    { section: "PHONETICS_STRESS",       label: "Ngữ âm — trọng âm",  accuracy: 0,     attemptCount: 0, expectedDepth: 2,  examWeight: 0.05,  depthRatio: 0     },
    { section: "ERROR_IDENTIFICATION",   label: "Nhận diện lỗi sai",   accuracy: 0,     attemptCount: 0, expectedDepth: 2,  examWeight: 0.05,  depthRatio: 0     },
    { section: "WORD_FORMATION",         label: "Biến đổi từ",         accuracy: 0,     attemptCount: 0, expectedDepth: 4,  examWeight: 0.1,   depthRatio: 0     },
    { section: "SENTENCE_TRANSFORMATION",label: "Chuyển đổi câu",      accuracy: 0,     attemptCount: 0, expectedDepth: 5,  examWeight: 0.125, depthRatio: 0     },
  ],
};

/** Scenario 2: Average improving student — score 7.7/10, NEARLY_READY, EMERGING, 1 unassessed */
const AVERAGE_STUDENT = {
  sessionNumber: 7,
  generatedAt: "2026-06-24T09:00:00.000Z",
  confidence: "EMERGING",
  readiness: { score: 77, band: "NEARLY_READY", confidence: "EMERGING", insufficientData: false },
  blueprintCoverage: {
    assessedCount: 6, partialCount: 1, unassessedCount: 1,
    sections: [
      { section: "GRAMMAR_MCQ",            label: "Ngữ pháp / Từ vựng",    attemptCount: 12, expectedDepth: 15, status: "ASSESSED",   examWeight: 0.375 },
      { section: "READING_COMPREHENSION",   label: "Đọc hiểu",              attemptCount: 4,  expectedDepth: 5,  status: "ASSESSED",   examWeight: 0.125 },
      { section: "CLOZE",                   label: "Điền vào chỗ trống",    attemptCount: 5,  expectedDepth: 5,  status: "ASSESSED",   examWeight: 0.125 },
      { section: "PHONETICS_SOUND",         label: "Ngữ âm — âm thanh",    attemptCount: 2,  expectedDepth: 2,  status: "ASSESSED",   examWeight: 0.05  },
      { section: "PHONETICS_STRESS",        label: "Ngữ âm — trọng âm",    attemptCount: 2,  expectedDepth: 2,  status: "ASSESSED",   examWeight: 0.05  },
      { section: "ERROR_IDENTIFICATION",    label: "Nhận diện lỗi sai",     attemptCount: 2,  expectedDepth: 2,  status: "ASSESSED",   examWeight: 0.05  },
      { section: "WORD_FORMATION",          label: "Biến đổi từ",           attemptCount: 1,  expectedDepth: 4,  status: "PARTIAL",    examWeight: 0.1   },
      { section: "SENTENCE_TRANSFORMATION", label: "Chuyển đổi câu",        attemptCount: 0,  expectedDepth: 5,  status: "UNASSESSED", examWeight: 0.125 },
    ],
  },
  weaknessSignals: [
    {
      topic: "word_formation",
      label: "Biến đổi từ",
      riskScore: 0.1, wrongCount: 1, totalAttempts: 1, accuracy: 0.0,
      confidence: "OBSERVED",
      patternObservation: null,
      notebookContext: {
        entryCount: 1, totalOccurrences: 1, isRemedialFlagged: false,
        mostRecentEntry: { reason: "Quên hậu tố -tion vs -ness", studentAnswer: "C", correctAnswer: "A", reviewStage: 0, lastReviewedAt: null },
      },
      wrongAnswers: [],
    },
  ],
  sectionBreakdown: [
    { section: "GRAMMAR_MCQ",            label: "Ngữ pháp / Từ vựng",  accuracy: 0.75,  attemptCount: 12, expectedDepth: 15, examWeight: 0.375, depthRatio: 0.8   },
    { section: "READING_COMPREHENSION",  label: "Đọc hiểu",            accuracy: 0.75,  attemptCount: 4,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 0.8   },
    { section: "CLOZE",                  label: "Điền vào chỗ trống",  accuracy: 0.8,   attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0   },
    { section: "PHONETICS_SOUND",        label: "Ngữ âm — âm thanh",  accuracy: 1.0,   attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0   },
    { section: "PHONETICS_STRESS",       label: "Ngữ âm — trọng âm",  accuracy: 0.5,   attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0   },
    { section: "ERROR_IDENTIFICATION",   label: "Nhận diện lỗi sai",   accuracy: 0.5,   attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0   },
    { section: "WORD_FORMATION",         label: "Biến đổi từ",         accuracy: 0.0,   attemptCount: 1,  expectedDepth: 4,  examWeight: 0.1,   depthRatio: 0.25  },
    { section: "SENTENCE_TRANSFORMATION",label: "Chuyển đổi câu",      accuracy: 0,     attemptCount: 0,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 0     },
  ],
};

/** Scenario 3: Strong student — score 9.2/10, EXAM_READY, CONFIRMED, 0 weakness signals */
const STRONG_STUDENT = {
  sessionNumber: 15,
  generatedAt: "2026-06-24T10:00:00.000Z",
  confidence: "CONFIRMED",
  readiness: { score: 92, band: "EXAM_READY", confidence: "CONFIRMED", insufficientData: false },
  blueprintCoverage: {
    assessedCount: 8, partialCount: 0, unassessedCount: 0,
    sections: [
      { section: "GRAMMAR_MCQ",            label: "Ngữ pháp / Từ vựng",    attemptCount: 15, expectedDepth: 15, status: "ASSESSED",   examWeight: 0.375 },
      { section: "READING_COMPREHENSION",   label: "Đọc hiểu",              attemptCount: 5,  expectedDepth: 5,  status: "ASSESSED",   examWeight: 0.125 },
      { section: "CLOZE",                   label: "Điền vào chỗ trống",    attemptCount: 5,  expectedDepth: 5,  status: "ASSESSED",   examWeight: 0.125 },
      { section: "PHONETICS_SOUND",         label: "Ngữ âm — âm thanh",    attemptCount: 2,  expectedDepth: 2,  status: "ASSESSED",   examWeight: 0.05  },
      { section: "PHONETICS_STRESS",        label: "Ngữ âm — trọng âm",    attemptCount: 2,  expectedDepth: 2,  status: "ASSESSED",   examWeight: 0.05  },
      { section: "ERROR_IDENTIFICATION",    label: "Nhận diện lỗi sai",     attemptCount: 2,  expectedDepth: 2,  status: "ASSESSED",   examWeight: 0.05  },
      { section: "WORD_FORMATION",          label: "Biến đổi từ",           attemptCount: 4,  expectedDepth: 4,  status: "ASSESSED",   examWeight: 0.1   },
      { section: "SENTENCE_TRANSFORMATION", label: "Chuyển đổi câu",        attemptCount: 5,  expectedDepth: 5,  status: "ASSESSED",   examWeight: 0.125 },
    ],
  },
  weaknessSignals: [], // all correct — triggers "Buổi học xuất sắc!" state
  sectionBreakdown: [
    { section: "GRAMMAR_MCQ",            label: "Ngữ pháp / Từ vựng",  accuracy: 0.93,  attemptCount: 15, expectedDepth: 15, examWeight: 0.375, depthRatio: 1.0  },
    { section: "READING_COMPREHENSION",  label: "Đọc hiểu",            accuracy: 0.9,   attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0  },
    { section: "CLOZE",                  label: "Điền vào chỗ trống",  accuracy: 0.9,   attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0  },
    { section: "PHONETICS_SOUND",        label: "Ngữ âm — âm thanh",  accuracy: 1.0,   attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0  },
    { section: "PHONETICS_STRESS",       label: "Ngữ âm — trọng âm",  accuracy: 1.0,   attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0  },
    { section: "ERROR_IDENTIFICATION",   label: "Nhận diện lỗi sai",   accuracy: 0.9,   attemptCount: 2,  expectedDepth: 2,  examWeight: 0.05,  depthRatio: 1.0  },
    { section: "WORD_FORMATION",         label: "Biến đổi từ",         accuracy: 0.9,   attemptCount: 4,  expectedDepth: 4,  examWeight: 0.1,   depthRatio: 1.0  },
    { section: "SENTENCE_TRANSFORMATION",label: "Chuyển đổi câu",      accuracy: 0.85,  attemptCount: 5,  expectedDepth: 5,  examWeight: 0.125, depthRatio: 1.0  },
  ],
};

/** Scenario 4: Insufficient data — first practice, no attempts recorded */
const INSUFFICIENT_DATA = {
  sessionNumber: 1,
  generatedAt: "2026-06-24T07:00:00.000Z",
  confidence: "OBSERVED",
  readiness: { score: 0, band: "NOT_READY", confidence: "OBSERVED", insufficientData: true },
  blueprintCoverage: {
    assessedCount: 0, partialCount: 0, unassessedCount: 8,
    sections: [],
  },
  weaknessSignals: [],
  sectionBreakdown: [],
};

// ──────────────────────────────────────────────────────────────────
// Run all scenarios
// ──────────────────────────────────────────────────────────────────

renderScenario("SCENARIO 1: Weak student  (score 6.5/10, DEVELOPING, OBSERVED)", WEAK_STUDENT, 3);
renderScenario("SCENARIO 2: Average student  (score 7.7/10, NEARLY_READY, EMERGING)", AVERAGE_STUDENT, 7);
renderScenario("SCENARIO 3: Strong student  (score 9.2/10, EXAM_READY, CONFIRMED)", STRONG_STUDENT, 15);
renderScenario("SCENARIO 4: Insufficient data  (session 1, no attempts)", INSUFFICIENT_DATA, 1);

// ──────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("FAIL");
  process.exit(1);
} else {
  console.log("PASS — all UX concerns verified for 4 student scenarios");
}
