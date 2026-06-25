// Model-agnostic question-normalization recipe shared by every real
// AIProvider (claudeProvider, geminiProvider, ...). Each provider only
// supplies its own "send these messages under this system prompt, get
// text back" call — this file owns the prompt content, JSON parsing, and
// the retry-once-on-invalid-JSON policy, so adding a new provider never
// means re-deriving (and risking drift in) any of that.
import type { ChatMessageInput, NormalizedQuestionDraft } from "./types";

export const VALID_TYPES = [
  "PHONETICS_SOUND",
  "PHONETICS_STRESS",
  "GRAMMAR_MCQ",
  "WORD_FORMATION",
  "ERROR_IDENTIFICATION",
  "CLOZE",
  "READING_COMPREHENSION",
  "SENTENCE_TRANSFORMATION",
];
export const VALID_SKILLS = ["PHONETICS_STRESS", "VOCAB_GRAMMAR", "COMMUNICATION", "READING", "WRITING_TRANSFORMATION"];
export const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

export const NORMALIZE_SYSTEM_PROMPT = `Bạn là một trợ lý trích xuất câu hỏi trắc nghiệm tiếng Anh từ văn bản thô (đã được trích từ file DOCX/PDF, có thể lẫn tiêu đề, đáp án, giải thích).

Nhiệm vụ: đọc văn bản và trả về MỘT MẢNG JSON các câu hỏi trắc nghiệm 4 lựa chọn (A/B/C/D) tìm thấy trong văn bản, mỗi câu hỏi có đúng các trường sau:

- questionCode: string, định danh duy nhất, dạng "{tiền tố}_Q{số}" (ví dụ "DIAG36_Q01")
- type: một trong ${JSON.stringify(VALID_TYPES)}
- skill: một trong ${JSON.stringify(VALID_SKILLS)}
- difficulty: một trong ${JSON.stringify(VALID_DIFFICULTIES)}
- topic: string ngắn, snake_case, mô tả chủ điểm ngữ pháp/từ vựng (ví dụ "present_perfect")
- promptText: string, đề bài câu hỏi
- optionA, optionB, optionC, optionD: string, nội dung 4 lựa chọn
- correctOption: "A" | "B" | "C" | "D"
- explanationVi: string, giải thích bằng tiếng Việt vì sao đáp án đúng
- commonMistake: string bằng tiếng Việt hoặc null, lỗi sai phổ biến học sinh thường gặp
- learningObjective: string bằng tiếng Việt, mục tiêu học tập của câu hỏi (KHÔNG để null/trống)

QUAN TRỌNG — độ trung thực với văn bản nguồn:
- Giữ đúng nội dung và ý nghĩa tiếng Việt gốc trong văn bản — KHÔNG diễn giải lại theo ý riêng, KHÔNG dịch hoặc paraphrase câu hỏi/lựa chọn.
- KHÔNG tự bịa hoặc suy đoán đáp án đúng. Chỉ điền correctOption khi văn bản nguồn cung cấp rõ đáp án (thường ở phần "ĐÁP ÁN & GIẢI THÍCH"). Nếu một câu hỏi trong văn bản KHÔNG có đáp án rõ ràng kèm theo, BỎ QUA câu đó hoàn toàn — không đưa vào mảng kết quả.
- explanationVi phải dựa trên giải thích có sẵn trong văn bản nguồn (phần đáp án/giải thích đi kèm câu hỏi đó). Không bịa thêm kiến thức ngữ pháp ngoài những gì văn bản đã nêu.
- difficulty phải được suy luận từ độ phức tạp thực tế của câu hỏi trong văn bản (ví dụ: nhận biết âm/trọng âm cơ bản → EASY; ngữ pháp/từ vựng thông dụng → MEDIUM; đọc hiểu suy luận, cấu trúc câu phức, từ vựng hiếm → HARD). KHÔNG gán ngẫu nhiên hoặc mặc định một mức cho tất cả câu.

QUAN TRỌNG — định dạng phản hồi:
- Chỉ trả về JSON hợp lệ — một mảng "[]" nếu không tìm thấy câu hỏi nào, KHÔNG kèm văn bản giải thích, KHÔNG dùng markdown code fence.
- Không tự sáng tác câu hỏi không có trong văn bản gốc.
- Nếu văn bản không phải đề thi/câu hỏi trắc nghiệm, trả về "[]".`;

export const JSON_REPAIR_INSTRUCTION =
  "Phản hồi trên không phải JSON hợp lệ (hoặc không đúng định dạng mảng các object). Hãy trả lại CHỈ một mảng JSON hợp lệ theo đúng schema đã yêu cầu — không kèm văn bản khác, không dùng markdown code fence, không có dấu phẩy dư hoặc thiếu.";

export function buildNormalizeUserPrompt(rawText: string, sourceFileName: string): string {
  return `Tên file nguồn: ${sourceFileName}\n\nVăn bản:\n${rawText}`;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

// Best-effort parse of a model's response into the candidate-draft shape.
// Throws on anything malformed — the caller (normalizeWithRetry below)
// catches this once to retry with a repair prompt; if it still fails the
// error propagates up to be surfaced as a FAILED ImportJob (full pipeline)
// or a per-batch error (normalizeLargeDocument's dry run), never silently
// turned into a fabricated draft. Per-field correctness is checked
// separately by validator.ts.
export function parseDrafts(rawResponse: string, sourceFileName: string): NormalizedQuestionDraft[] {
  const json = JSON.parse(stripCodeFence(rawResponse));
  if (!Array.isArray(json)) throw new Error("Model response was not a JSON array");

  return json.map((item, i): NormalizedQuestionDraft => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Model response item ${i} is not an object`);
    }
    const obj = item as Record<string, unknown>;
    return {
      questionCode: String(obj.questionCode ?? ""),
      type: typeof obj.type === "string" ? obj.type : "",
      skill: typeof obj.skill === "string" ? obj.skill : "",
      difficulty: typeof obj.difficulty === "string" ? obj.difficulty : "",
      topic: typeof obj.topic === "string" ? obj.topic : "",
      promptText: typeof obj.promptText === "string" ? obj.promptText : "",
      optionA: typeof obj.optionA === "string" ? obj.optionA : "",
      optionB: typeof obj.optionB === "string" ? obj.optionB : "",
      optionC: typeof obj.optionC === "string" ? obj.optionC : "",
      optionD: typeof obj.optionD === "string" ? obj.optionD : "",
      correctOption: typeof obj.correctOption === "string" ? obj.correctOption.toUpperCase() : "",
      explanationVi: typeof obj.explanationVi === "string" ? obj.explanationVi : "",
      commonMistake: typeof obj.commonMistake === "string" ? obj.commonMistake : null,
      learningObjective: typeof obj.learningObjective === "string" ? obj.learningObjective : null,
      source: sourceFileName,
      sourceExam: null,
    };
  });
}

export interface NormalizeWithRetryResult {
  drafts: NormalizedQuestionDraft[];
  retryCount: number; // 0 if the first response parsed cleanly, 1 if the repair prompt was needed
}

// Generic retry-once-on-invalid-JSON wrapper. `callModel` is whatever a
// specific provider needs to do to turn a message list into response
// text (e.g. claudeProvider wraps the Anthropic SDK, geminiProvider wraps
// @google/genai) — this function doesn't know or care which. Reports
// retryCount so callers can surface it in run reports (see Task 4 in
// PROJECT_STATUS.md) without each provider having to track it separately.
export async function normalizeWithRetry(
  callModel: (messages: ChatMessageInput[]) => Promise<string>,
  rawText: string,
  sourceFileName: string,
): Promise<NormalizeWithRetryResult> {
  const userPrompt = buildNormalizeUserPrompt(rawText, sourceFileName);
  const firstResponse = await callModel([{ role: "user", content: userPrompt }]);

  try {
    return { drafts: parseDrafts(firstResponse, sourceFileName), retryCount: 0 };
  } catch {
    const repairResponse = await callModel([
      { role: "user", content: userPrompt },
      { role: "assistant", content: firstResponse },
      { role: "user", content: JSON_REPAIR_INSTRUCTION },
    ]);
    // If this second attempt also fails to parse, let the error
    // propagate — no third attempt, no fabricated fallback data.
    return { drafts: parseDrafts(repairResponse, sourceFileName), retryCount: 1 };
  }
}
