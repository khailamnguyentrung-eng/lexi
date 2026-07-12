import type { LensLearningContext, LensResponse, LensFlag, InteractionMode } from "./types";

// ─── EXPLAIN mode system prompt ─────────────────────────────────────────────

export const EXPLAIN_SYSTEM_PROMPT = `Bạn là Lexi — gia sư tiếng Anh thông minh và thân thiện. Học sinh đang học tiếng Anh ở Việt Nam.

Nhiệm vụ: Giải thích nội dung mà học sinh đã chọn (có thể là từ vựng, ngữ pháp, đoạn văn, hoặc câu hỏi tiếng Anh).

Hướng dẫn:
- Giải thích rõ ràng, dễ hiểu, phù hợp với trình độ học sinh.
- Dùng cả tiếng Việt và tiếng Anh: giải thích bằng tiếng Việt, ví dụ bằng tiếng Anh.
- Đưa ra 2–3 ví dụ cụ thể, thực tế.
- Liệt kê 1–3 chủ điểm liên quan (relatedTopics, dạng snake_case) học sinh nên tìm hiểu thêm.
- Tự đánh giá mức độ tự tin (confidence từ 0.0 đến 1.0).

QUAN TRỌNG — định dạng phản hồi:
Chỉ trả về JSON hợp lệ theo đúng cấu trúc sau — không kèm văn bản khác, không dùng markdown code fence:
{
  "explanation": "Giải thích đầy đủ bằng tiếng Việt và tiếng Anh...",
  "relatedTopics": ["topic_snake_case_1", "topic_snake_case_2"],
  "confidence": 0.85
}`;

// ─── User message builder ───────────────────────────────────────────────────

const DEPTH_LINES: Record<string, string> = {
  BEGINNER:
    "Học sinh còn mới — hãy dùng ngôn ngữ thật đơn giản, nhiều ví dụ minh họa cơ bản.",
  INTERMEDIATE:
    "Học sinh ở trình độ trung bình — giải thích cân bằng giữa lý thuyết và ví dụ.",
  ADVANCED:
    "Học sinh khá giỏi — có thể đi sâu vào sắc thái, ngoại lệ, và cách dùng nâng cao.",
};

/**
 * Builds the user-turn message for EXPLAIN mode.
 * Pure — no I/O. The system prompt is passed separately to provider.chat().
 */
export function buildExplainUserMessage(
  text: string,
  context: LensLearningContext,
): string {
  const depthLine = DEPTH_LINES[context.depthHint] ?? DEPTH_LINES.INTERMEDIATE;
  return `Nội dung học sinh chọn:\n\n"${text}"\n\n${depthLine}\n\nHãy giải thích nội dung trên.`;
}

// ─── Response parser ────────────────────────────────────────────────────────

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}

/**
 * Parses the AI's raw text response into a LensResponse.
 * - On valid JSON: extracts explanation, relatedTopics, confidence.
 * - On invalid JSON: uses raw text as explanation, adds AI_PARSE_ERROR flag.
 * Always adds ANONYMOUS_NO_PERSONALIZATION (Phase 7.1 has no profile integration).
 */
export function parseLensExplainResponse(
  rawText: string,
  requestId: string,
  mode: InteractionMode,
): LensResponse {
  const flags: LensFlag[] = ["ANONYMOUS_NO_PERSONALIZATION"];

  try {
    const parsed = JSON.parse(stripCodeFence(rawText)) as Record<string, unknown>;

    const explanation =
      typeof parsed.explanation === "string" ? parsed.explanation : rawText.trim();

    const relatedTopics = Array.isArray(parsed.relatedTopics)
      ? (parsed.relatedTopics as unknown[]).filter(
          (t): t is string => typeof t === "string",
        )
      : [];

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.7;

    return { requestId, mode, explanation, relatedTopics, confidence, flags };
  } catch {
    flags.push("AI_PARSE_ERROR");
    return {
      requestId,
      mode,
      explanation: rawText.trim(),
      relatedTopics: [],
      confidence: 0.5,
      flags,
    };
  }
}
