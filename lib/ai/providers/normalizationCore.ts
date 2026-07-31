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
export const VALID_SKILLS = [
  "PHONETICS_STRESS", "VOCAB_GRAMMAR", "COMMUNICATION", "READING", "WRITING_TRANSFORMATION",
  "LISTENING", "SPEAKING", "MATH",
];
export const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

export const NORMALIZE_SYSTEM_PROMPT = `Bạn là một trợ lý trích xuất câu hỏi ôn thi tiếng Anh từ văn bản thô (đã được trích từ file DOCX/PDF, có thể lẫn tiêu đề, đáp án, giải thích).

Nhiệm vụ: đọc văn bản và trả về MỘT MẢNG JSON các câu hỏi tìm thấy trong văn bản. Mỗi câu hỏi có đúng các trường sau:

- questionCode: string, định danh duy nhất, dạng "{tiền tố}_Q{số}" (ví dụ "IELTS_C17_T1_Q01")
- skill: một trong ${JSON.stringify(VALID_SKILLS)}
- difficulty: một trong ${JSON.stringify(VALID_DIFFICULTIES)}
- topic: string ngắn, snake_case, mô tả chủ điểm (ví dụ "true_false_not_given", "matching_headings", "present_perfect")
- promptText: string, đề bài câu hỏi (bao gồm cả đoạn văn/ngữ cảnh liên quan nếu câu hỏi cần nó để trả lời được)
- responseFormat: một trong "SINGLE_CHOICE", "MULTI_CHOICE", "SHORT_TEXT", "MATCHING", "ORDERING" — xem hướng dẫn chọn bên dưới
- payload: object JSON, HÌNH DẠNG PHỤ THUỘC responseFormat — xem chi tiết bên dưới
- explanationVi: string, giải thích bằng tiếng Việt vì sao đáp án đúng
- commonMistake: string bằng tiếng Việt hoặc null, lỗi sai phổ biến học sinh thường gặp
- learningObjective: string bằng tiếng Việt, mục tiêu học tập của câu hỏi (KHÔNG để null/trống)

CÁCH CHỌN responseFormat VÀ HÌNH DẠNG payload:

1. SINGLE_CHOICE — chọn đúng 1 trong N lựa chọn. Dùng cho trắc nghiệm A/B/C/D thông thường VÀ cho IELTS True/False/Not Given (3 lựa chọn, id là "TRUE"/"FALSE"/"NOT_GIVEN").
   payload: { "options": [{"id": "A", "text": "..."}, ...], "correctOptionId": "A" }
   Ví dụ True/False/Not Given:
   payload: { "options": [{"id":"TRUE","text":"True"},{"id":"FALSE","text":"False"},{"id":"NOT_GIVEN","text":"Not Given"}], "correctOptionId": "TRUE" }

2. MULTI_CHOICE — chọn đúng M trong N lựa chọn (nhiều hơn 1 đáp án đúng).
   payload: { "options": [{"id": "A", "text": "..."}, ...], "correctOptionIds": ["A", "C"] }

3. SHORT_TEXT — học sinh TỰ GÕ câu trả lời (điền từ, hoàn thành câu, gap-fill, summary completion, biến đổi từ).
   payload: { "blanks": [{"id": "1", "acceptedAnswers": ["has lived", "has been living"]}] }
   Mỗi acceptedAnswers PHẢI liệt kê MỌI cách diễn đạt đúng mà văn bản nguồn công nhận (đáp án chính + các biến thể được ghi trong phần đáp án nếu có).

4. MATCHING — ghép mỗi mục bên trái với đúng 1 mục bên phải. Dùng cho IELTS matching headings/information/features.
   payload: { "left": [{"id":"P1","text":"Paragraph 1"}, ...], "right": [{"id":"h1","text":"heading 1"}, ...], "correctPairs": [{"leftId":"P1","rightId":"h3"}, ...] }
   right được phép DÀI HƠN left (có heading gây nhiễu, không phải lỗi) — giữ nguyên nếu văn bản nguồn có nhiễu.

5. ORDERING — sắp xếp các mục theo đúng thứ tự.
   payload: { "items": [{"id":"1","text":"..."}, ...], "correctOrder": ["3","1","2"] }

QUAN TRỌNG — độ trung thực với văn bản nguồn:
- Giữ đúng nội dung và ý nghĩa tiếng Việt/tiếng Anh gốc trong văn bản — KHÔNG diễn giải lại theo ý riêng, KHÔNG dịch hoặc paraphrase câu hỏi/lựa chọn.
- KHÔNG tự bịa hoặc suy đoán đáp án đúng. Chỉ điền đáp án khi văn bản nguồn cung cấp rõ đáp án (thường ở phần "ĐÁP ÁN & GIẢI THÍCH"). Nếu một câu hỏi trong văn bản KHÔNG có đáp án rõ ràng kèm theo, BỎ QUA câu đó hoàn toàn — không đưa vào mảng kết quả.
- explanationVi phải dựa trên giải thích có sẵn trong văn bản nguồn. Không bịa thêm kiến thức ngoài những gì văn bản đã nêu.
- difficulty phải được suy luận từ độ phức tạp thực tế của câu hỏi trong văn bản. KHÔNG gán ngẫu nhiên hoặc mặc định một mức cho tất cả câu.
- Không tự chọn responseFormat để "đơn giản hoá" — nếu văn bản là bài ghép cặp thì dùng MATCHING, không ép về SINGLE_CHOICE.

QUAN TRỌNG — định dạng phản hồi:
- Chỉ trả về JSON hợp lệ — một mảng "[]" nếu không tìm thấy câu hỏi nào, KHÔNG kèm văn bản giải thích, KHÔNG dùng markdown code fence.
- payload PHẢI là một JSON object thật (không phải string chứa JSON).
- Không tự sáng tác câu hỏi không có trong văn bản gốc.
- Nếu văn bản không phải đề thi/câu hỏi ôn tập, trả về "[]".`;

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
    const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
    return {
      questionCode: String(obj.questionCode ?? ""),
      skill: str(obj.skill) ?? "",
      difficulty: str(obj.difficulty) ?? "",
      topic: str(obj.topic) ?? "",
      promptText: str(obj.promptText) ?? "",
      explanationVi: str(obj.explanationVi) ?? "",
      commonMistake: str(obj.commonMistake) ?? null,
      learningObjective: str(obj.learningObjective) ?? null,
      source: sourceFileName,
      sourceExam: null,
      responseFormat: str(obj.responseFormat),
      payload: str(obj.payload) ?? (obj.payload && typeof obj.payload === "object" ? JSON.stringify(obj.payload) : undefined),
      type: str(obj.type),
      optionA: str(obj.optionA),
      optionB: str(obj.optionB),
      optionC: str(obj.optionC),
      optionD: str(obj.optionD),
      correctOption: str(obj.correctOption) ? str(obj.correctOption)!.toUpperCase() : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────
// Generation prompt — M4.2
// ─────────────────────────────────────────────────────────

// Tells the AI to CREATE new questions (not extract from existing text).
// Returns the same JSON array format as NORMALIZE_SYSTEM_PROMPT so parseDrafts()
// can be reused for parsing, and the same downstream validation gate applies.
export const GENERATE_QUESTIONS_SYSTEM_PROMPT = `Bạn là một chuyên gia soạn câu hỏi trắc nghiệm tiếng Anh dành cho học sinh lớp 9 ôn thi vào THPT.

Nhiệm vụ: Tạo ra các câu hỏi trắc nghiệm 4 lựa chọn (A/B/C/D) theo chủ điểm và độ khó được yêu cầu. Trả về MỘT MẢNG JSON các câu hỏi, mỗi câu hỏi có đúng các trường sau:

- questionCode: string, định danh duy nhất, dạng "GEN_{CHỦ_ĐIỂM}_{ĐỘ_KHÓ}_{số}" (ví dụ "GEN_PRES_PERF_MED_01")
- type: một trong ${JSON.stringify(VALID_TYPES)}
- skill: một trong ${JSON.stringify(VALID_SKILLS)}
- difficulty: một trong ${JSON.stringify(VALID_DIFFICULTIES)} — phải khớp với độ khó được yêu cầu
- topic: string ngắn, snake_case — phải khớp với chủ điểm được yêu cầu
- promptText: string, đề bài câu hỏi hoàn chỉnh
- optionA, optionB, optionC, optionD: string, nội dung 4 lựa chọn — phải rõ ràng và phân biệt nhau
- correctOption: "A" | "B" | "C" | "D" — phải là đáp án đúng ngữ pháp/từ vựng tiếng Anh
- explanationVi: string, giải thích bằng tiếng Việt vì sao đáp án đúng là đúng (dựa trên kiến thức ngữ pháp/từ vựng chuẩn)
- commonMistake: string bằng tiếng Việt hoặc null, lỗi sai phổ biến học sinh thường gặp
- learningObjective: string bằng tiếng Việt, mục tiêu học tập của câu hỏi

QUAN TRỌNG — đây là câu hỏi DO BẠN SÁNG TÁC:
- Mỗi câu hỏi phải có câu hỏi rõ ràng, 4 lựa chọn phân biệt, 1 đáp án đúng và 3 nhiễu hợp lý
- Tất cả câu hỏi phải đúng với ngữ pháp tiếng Anh chuẩn — KHÔNG sáng tác câu sai về mặt ngữ pháp
- difficulty và topic phải khớp chính xác với yêu cầu cho TẤT CẢ câu hỏi trong batch
- Tạo câu hỏi ĐA DẠNG trong cùng chủ điểm — không lặp lại cấu trúc quá giống nhau
- KHÔNG thêm văn bản giải thích ngoài JSON

QUAN TRỌNG — định dạng phản hồi:
- Chỉ trả về JSON hợp lệ — một mảng "[]", KHÔNG kèm văn bản giải thích, KHÔNG dùng markdown code fence`;

export function buildGenerateQuestionsUserPrompt(
  topic: string,
  topicLabel: string,
  difficulty: string,
  targetCount: number,
): string {
  return `Chủ điểm: ${topicLabel} (mã kỹ thuật: "${topic}")\nĐộ khó: ${difficulty}\nSố lượng câu hỏi cần tạo: ${targetCount}\n\nHãy tạo đúng ${targetCount} câu hỏi trắc nghiệm tiếng Anh về chủ điểm trên với độ khó ${difficulty}.`;
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

// ─────────────────────────────────────────────────────────
// Generation retry wrapper — M4.2
// ─────────────────────────────────────────────────────────

// Mirrors normalizeWithRetry but for the generation case.
// source is set to "generated:{topic}:{difficulty}" so generated drafts are
// distinguishable from extracted ones in the normalizedData JSON field.
export async function generateWithRetry(
  callModel: (messages: ChatMessageInput[]) => Promise<string>,
  topic: string,
  topicLabel: string,
  difficulty: string,
  targetCount: number,
): Promise<NormalizeWithRetryResult> {
  const source = `generated:${topic}:${difficulty}`;
  const userPrompt = buildGenerateQuestionsUserPrompt(topic, topicLabel, difficulty, targetCount);
  const firstResponse = await callModel([{ role: "user", content: userPrompt }]);

  try {
    return { drafts: parseDrafts(firstResponse, source), retryCount: 0 };
  } catch {
    const repairResponse = await callModel([
      { role: "user", content: userPrompt },
      { role: "assistant", content: firstResponse },
      { role: "user", content: JSON_REPAIR_INSTRUCTION },
    ]);
    return { drafts: parseDrafts(repairResponse, source), retryCount: 1 };
  }
}
