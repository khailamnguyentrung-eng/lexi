/**
 * Analytics narrative generation layer.
 *
 * Takes analytics contract types and returns student-friendly Vietnamese text.
 *
 * CONSTRAINTS
 * - No Prisma, no database, no AI calls
 * - Pure deterministic functions — same input always produces same output
 * - Tone: supportive, specific, non-shaming (Lexi persona — see lib/ai/persona.ts)
 * - Language: Vietnamese (tiếng Việt)
 * - "Practice focus" framing — never label a student's knowledge as inherently broken
 * - Confidence degradation — OBSERVED data always gets a hedging note
 *
 * FORBIDDEN VOCABULARY (do not use in any generated string)
 * diagnosed, proven, misconception, confirmed weakness, attention disorder,
 * mất chú ý, suy giảm chú ý, vấn đề tâm lý, chẩn đoán, xác nhận hoàn toàn,
 * chắc chắn, nghiêm trọng
 *
 * INPUTS:  Contract types from contracts.ts
 * OUTPUTS: Structured narrative strings for UI components to render
 *
 * Architecture:
 *   Engine → Service → contracts.ts → [narrative.ts] → UI component
 *                                      ^^^^^^^^^^^^^^
 *                                      This file interprets signals, not calculates them.
 */

import type {
  SessionAnalyticsResponse,
  WeaknessSignalItem,
  ReadinessBand,
  ConfidenceLevel,
} from "./contracts";

// ──────────────────────────────────────────────────────────────────
// Output types
// ──────────────────────────────────────────────────────────────────

/**
 * Student-facing narrative for one session's readiness result.
 * All strings are ready to render — no further formatting needed.
 */
export interface ReadinessNarrative {
  /** Short, upbeat headline — always non-empty. */
  headline: string;
  /** 1–2 sentences explaining the current level and why. Never mentions raw scores. */
  explanation: string;
  /** Label + accuracy of the strongest section, e.g. "Đọc hiểu (90%)". Null if no assessed section. */
  strongestArea: string | null;
  /** Label of the highest-priority practice area. Null only if everything is at full depth and accurate. */
  nextFocus: string | null;
  /** Non-null only when confidence is OBSERVED — tells the student data is preliminary. */
  confidenceNote: string | null;
}

/**
 * Student-facing narrative for one weakness topic.
 * One per entry in weaknessSignals — always top-3 or fewer.
 */
export interface WeaknessNarrative {
  topic: string;
  label: string;
  /** Supportive, "practice focus" guidance sentence. Never says "weakness" or "wrong". */
  guidance: string;
  /** Evidence disclosure, e.g. "Bạn đã thử 4 câu, đúng 1 câu (25%)." */
  evidenceNote: string;
  /** Pattern note — only set when patternObservation.studentVisible is true (N ≥ 3). */
  patternNote: string | null;
  /** Historical note from error notebook — only set when notebookContext exists. */
  notebookNote: string | null;
}

// ──────────────────────────────────────────────────────────────────
// Static tables — band-level and confidence copy
// ──────────────────────────────────────────────────────────────────

const BAND_HEADLINE: Record<ReadinessBand, string> = {
  EXAM_READY: "Bạn đang ở mức sẵn sàng thi!",
  NEARLY_READY: "Bạn đang đến rất gần đích rồi!",
  DEVELOPING: "Bạn đang xây dựng nền tảng vững chắc.",
  NOT_READY: "Chúng ta có nhiều dư địa để phát triển!",
};

const BAND_EXPLANATION: Record<ReadinessBand, string> = {
  EXAM_READY:
    "Kết quả cho thấy bạn đã nắm vững các nội dung quan trọng và luyện tập đủ rộng. Hãy tiếp tục duy trì phong độ này.",
  NEARLY_READY:
    "Bạn đã nắm được nhiều nội dung. Chỉ cần thêm luyện tập ở một số phần là sẽ sẵn sàng.",
  DEVELOPING:
    "Đây là giai đoạn quan trọng để củng cố kiến thức. Mỗi buổi luyện tập đều giúp bạn tiến thêm một bước.",
  NOT_READY:
    "Bạn đang ở giai đoạn đầu của hành trình. Hãy tập trung vào từng phần một — tiến độ nhỏ mỗi ngày sẽ cộng lại thành kết quả lớn.",
};

const CONFIDENCE_NOTE: Record<ConfidenceLevel, string | null> = {
  OBSERVED:
    "Lưu ý: Kết quả dựa trên số ít câu hỏi, nên chỉ mang tính tham khảo bước đầu. Hãy luyện thêm để có đánh giá chính xác hơn.",
  EMERGING: null,
  CONFIRMED: null,
};

// ──────────────────────────────────────────────────────────────────
// generateReadinessNarrative
// ──────────────────────────────────────────────────────────────────

/**
 * Generate student-facing readiness narrative from session analytics.
 *
 * Covers:
 *   1. Current readiness (band-appropriate headline + explanation)
 *   2. Why this level was assigned (coverage context added when gaps are significant)
 *   3. Strongest area (highest-accuracy section with ≥2 attempts)
 *   4. Next focus area (first weakness signal, or lowest-depth coverage gap)
 */
export function generateReadinessNarrative(
  response: SessionAnalyticsResponse
): ReadinessNarrative {
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

  // Start from the band template, then append coverage context if notable
  let explanation = BAND_EXPLANATION[band];
  const unassessed = response.blueprintCoverage.unassessedCount;
  if (unassessed > 3) {
    explanation += ` Có ${unassessed} phần chưa được luyện — luyện thêm ở những phần này sẽ cải thiện kết quả rõ rệt.`;
  } else if (unassessed > 0 && band === "NEARLY_READY") {
    explanation += ` Luyện thêm ở ${unassessed} phần còn thiếu sẽ đưa bạn qua ngưỡng sẵn sàng.`;
  }

  // Strongest area: highest accuracy section with at least 2 attempts
  const strongestSection = response.sectionBreakdown
    .filter((s) => s.attemptCount >= 2)
    .sort((a, b) => b.accuracy - a.accuracy)[0] ?? null;

  const strongestArea = strongestSection
    ? `${strongestSection.label} (${Math.round(strongestSection.accuracy * 100)}%)`
    : null;

  // Next focus: first weakness signal if any, else the section with lowest depth coverage
  let nextFocus: string | null = null;
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

// ──────────────────────────────────────────────────────────────────
// generateWeaknessNarrative
// ──────────────────────────────────────────────────────────────────

/**
 * Generate student-facing practice-focus narratives for top weakness topics.
 *
 * Each entry covers:
 *   1. Specific guidance at the right encouragement level for the accuracy range
 *   2. Evidence disclosure (how many tried, how many correct)
 *   3. Pattern note if the same wrong option was chosen ≥3 times
 *   4. Notebook note if the topic has historical error context
 */
export function generateWeaknessNarrative(
  weaknessSignals: WeaknessSignalItem[]
): WeaknessNarrative[] {
  return weaknessSignals.map((signal) => {
    const correctCount = signal.totalAttempts - signal.wrongCount;
    const pct = Math.round(signal.accuracy * 100);
    const evidenceNote = `Bạn đã thử ${signal.totalAttempts} câu, đúng ${correctCount} câu (${pct}%).`;

    const guidance = buildWeaknessGuidance(signal.accuracy, signal.label);

    // Pattern note — student-visible only (N ≥ 3 occurrences)
    let patternNote: string | null = null;
    if (signal.patternObservation?.studentVisible) {
      const { selectedOption, occurrenceCount } = signal.patternObservation;
      patternNote = `Bạn đã chọn đáp án ${selectedOption} sai ${occurrenceCount} lần — hãy đọc kỹ lại lý thuyết liên quan để hiểu rõ vì sao ${selectedOption} chưa đúng ở đây.`;
    }

    // Notebook note — prioritize remedial flag, then plain entry count
    let notebookNote: string | null = null;
    if (signal.notebookContext) {
      if (signal.notebookContext.isRemedialFlagged) {
        notebookNote =
          "Chủ đề này đã xuất hiện nhiều lần trong sổ ghi chú — hãy dành thêm thời gian ôn lại, đây là cơ hội tốt để đạt điểm cao hơn.";
      } else if (signal.notebookContext.entryCount > 0) {
        notebookNote = `Chủ đề này đã được ghi chú ${signal.notebookContext.entryCount} lần trước đây.`;
      }
    }

    return {
      topic: signal.topic,
      label: signal.label,
      guidance,
      evidenceNote,
      patternNote,
      notebookNote,
    };
  });
}

/**
 * Build a supportive, accuracy-calibrated practice guidance sentence.
 * Uses "practice focus" language — never "wrong", "weakness", or "fail".
 */
function buildWeaknessGuidance(accuracy: number, label: string): string {
  if (accuracy < 0.3) {
    return `${label} là hướng luyện tập ưu tiên ngay lúc này. Hãy bắt đầu với những bài tập cơ bản để xây dựng nền tảng vững chắc hơn.`;
  }
  if (accuracy <= 0.5) {
    return `Bạn đã hiểu được một phần ở ${label} — luyện thêm sẽ giúp kiến thức trở nên chắc chắn hơn.`;
  }
  if (accuracy < 0.7) {
    return `Bạn gần đạt mức tốt ở ${label} rồi. Một chút luyện tập thêm sẽ tạo ra sự khác biệt lớn.`;
  }
  return `Bạn đang làm tốt ở ${label} — hãy chú ý giữ vững và luyện thêm để đạt kết quả cao hơn.`;
}
