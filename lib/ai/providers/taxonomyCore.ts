/**
 * KU-1 part B, Path A — the prompt, parser, and retry wrapper for reading a
 * source and proposing candidate KnowledgeUnits. Mirrors
 * normalizationCore.ts's shape (system prompt + parseX + XWithRetry), but is
 * a separate file rather than added to it — same reasoning DECISION_LOG
 * already records for keeping generation IN normalizationCore ("reuses
 * parseDrafts()"): this does NOT reuse parseDrafts/NormalizedQuestionDraft at
 * all, the output shape is entirely different (topics, not questions), so
 * sharing a file would only be proximity, not reuse.
 *
 * The one thing this module does that normalizationCore's parseDrafts()
 * does not: verify each evidenceQuote is a literal substring of the source
 * text. A model can assert a topic exists in a document without actually
 * quoting it — parseDrafts() has no equivalent check because Question fields
 * (options, correctOption) aren't literal excerpts of anything to verify
 * against. Here they are, and PendingKnowledgeUnit.evidenceQuote is described
 * in its own schema comment as "load-bearing" for review — a quote that
 * isn't actually in the source would make that review meaningless while
 * looking legitimate, which is worse than an obviously-fabricated one.
 */

import type { ChatMessageInput } from "./types";
import { JSON_REPAIR_INSTRUCTION } from "./normalizationCore";

export const PROPOSE_TAXONOMY_SYSTEM_PROMPT = `Bạn là một chuyên gia phân tích tài liệu học tiếng Anh. Nhiệm vụ: đọc văn bản được cung cấp và đề xuất các CHỦ ĐIỂM KIẾN THỨC (KnowledgeUnit) — không phải câu hỏi, không phải bài học, mà là các khái niệm ngữ pháp/từ vựng/kỹ năng riêng biệt mà tài liệu này dạy hoặc kiểm tra.

Trả về MỘT MẢNG JSON, mỗi phần tử có đúng các trường sau:

- proposedTopic: string, snake_case, ngắn gọn, mô tả một khái niệm DUY NHẤT (ví dụ "present_perfect", "matching_headings", "conditionals_type_2")
- proposedLabel: string, nhãn hiển thị dễ hiểu cho con người (tiếng Việt nếu tài liệu tiếng Việt, tiếng Anh nếu tài liệu quốc tế — không ép dịch)
- evidenceQuote: string — PHẢI LÀ MỘT ĐOẠN TRÍCH NGUYÊN VĂN, CHÍNH XÁC TỪNG KÝ TỰ, LẤY THẲNG TỪ VĂN BẢN ĐƯỢC CUNG CẤP. Không diễn giải, không tóm tắt, không tự viết lại. Đây là bằng chứng cho người duyệt xác minh — nếu không tìm được trích dẫn thật, đừng đề xuất chủ điểm đó.
- evidenceLocation: string hoặc null — vị trí trong tài liệu nếu xác định được (ví dụ "Test 2, Reading Passage 1"), null nếu không rõ
- confidence: số từ 0 đến 1 — mức độ tự tin đây là một khái niệm riêng biệt, có thật trong tài liệu

QUAN TRỌNG:
- KHÔNG đề xuất lại các chủ điểm đã có trong danh mục (được liệt kê bên dưới trong yêu cầu) — chỉ đề xuất chủ điểm MỚI.
- Mỗi chủ điểm phải là một khái niệm THỰC SỰ RIÊNG BIỆT — không tách một khái niệm thành nhiều chủ điểm gần giống nhau, cũng không gộp nhiều khái niệm khác nhau vào một chủ điểm.
- evidenceQuote bắt buộc phải trích dẫn đúng nguyên văn — đề xuất sẽ bị loại bỏ nếu trích dẫn không khớp với văn bản gốc.
- Nếu văn bản không đủ rõ để xác định chủ điểm nào, trả về mảng rỗng "[]" — KHÔNG đoán bừa.
- KHÔNG thêm văn bản giải thích ngoài JSON, KHÔNG dùng markdown code fence.`;

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

export function buildProposeTaxonomyUserPrompt(rawText: string, existingTopics: string[]): string {
  const existingList =
    existingTopics.length > 0
      ? `Các chủ điểm ĐÃ CÓ trong danh mục (không đề xuất lại):\n${existingTopics.join(", ")}\n\n`
      : "";
  return `${existingList}Văn bản cần phân tích:\n\n${rawText}`;
}

export interface RawProposal {
  proposedTopic: string;
  proposedLabel: string;
  evidenceQuote: string;
  evidenceLocation: string | null;
  confidence: number;
}

/**
 * Parse the model's response. Throws on malformed JSON (caught once by
 * proposeTaxonomyWithRetry, same policy as parseDrafts). Does NOT throw on a
 * quote that fails verification — that is a per-item quality problem, not a
 * response-shape problem, so it is filtered rather than failing the whole
 * batch. verifyEvidenceQuotes() below does the filtering; kept separate so
 * a caller (or a test) can inspect what was rejected and why.
 */
export function parseTaxonomyProposals(rawResponse: string): RawProposal[] {
  const json = JSON.parse(stripCodeFence(rawResponse));
  if (!Array.isArray(json)) throw new Error("Model response was not a JSON array");

  return json.map((item, i): RawProposal => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Model response item ${i} is not an object`);
    }
    const obj = item as Record<string, unknown>;
    const confidence = typeof obj.confidence === "number" ? obj.confidence : 0;
    return {
      proposedTopic: typeof obj.proposedTopic === "string" ? obj.proposedTopic : "",
      proposedLabel: typeof obj.proposedLabel === "string" ? obj.proposedLabel : "",
      evidenceQuote: typeof obj.evidenceQuote === "string" ? obj.evidenceQuote : "",
      evidenceLocation: typeof obj.evidenceLocation === "string" ? obj.evidenceLocation : null,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  });
}

export interface VerifiedProposals {
  accepted: RawProposal[];
  rejected: { proposal: RawProposal; reason: string }[];
}

/**
 * Normalize whitespace before comparing — a model reproducing a quote across
 * a line-wrap or with a stray double space is not fabricating evidence, it's
 * reformatting it. Anything beyond whitespace (punctuation, wording) must
 * match exactly; see the file header for why this isn't loosened further.
 */
function normalizeForQuoteMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Reject any proposal missing required fields, or whose evidenceQuote is not
 * actually a substring of the source text — the anti-hallucination guard
 * this module exists for. Returns both lists (not just the accepted one) so
 * a caller can report rejections rather than silently dropping them.
 */
export function verifyEvidenceQuotes(proposals: RawProposal[], rawText: string): VerifiedProposals {
  const haystack = normalizeForQuoteMatch(rawText);
  const accepted: RawProposal[] = [];
  const rejected: VerifiedProposals["rejected"] = [];

  for (const p of proposals) {
    if (!p.proposedTopic || !p.proposedLabel) {
      rejected.push({ proposal: p, reason: "missing proposedTopic or proposedLabel" });
      continue;
    }
    if (!p.evidenceQuote) {
      rejected.push({ proposal: p, reason: "empty evidenceQuote" });
      continue;
    }
    if (!haystack.includes(normalizeForQuoteMatch(p.evidenceQuote))) {
      rejected.push({ proposal: p, reason: "evidenceQuote not found verbatim in source text" });
      continue;
    }
    accepted.push(p);
  }

  return { accepted, rejected };
}

export interface ProposeTaxonomyWithRetryResult {
  accepted: RawProposal[];
  rejected: VerifiedProposals["rejected"];
  retryCount: number;
}

/**
 * Generic retry-once-on-invalid-JSON wrapper, mirroring
 * normalizationCore.ts's normalizeWithRetry. Quote verification happens
 * AFTER parsing succeeds and is not itself a retry trigger — a well-formed
 * JSON response with a bad quote is a content problem the model won't fix by
 * being asked to repair JSON syntax; it is filtered instead (see
 * verifyEvidenceQuotes) and reported to the caller as `rejected`.
 */
export async function proposeTaxonomyWithRetry(
  callModel: (messages: ChatMessageInput[]) => Promise<string>,
  rawText: string,
  existingTopics: string[]
): Promise<ProposeTaxonomyWithRetryResult> {
  const userPrompt = buildProposeTaxonomyUserPrompt(rawText, existingTopics);
  const firstResponse = await callModel([{ role: "user", content: userPrompt }]);

  let parsed: RawProposal[];
  let retryCount = 0;
  try {
    parsed = parseTaxonomyProposals(firstResponse);
  } catch {
    const repairResponse = await callModel([
      { role: "user", content: userPrompt },
      { role: "assistant", content: firstResponse },
      { role: "user", content: JSON_REPAIR_INSTRUCTION },
    ]);
    // No third attempt — propagates if still malformed, same policy as
    // normalizeWithRetry.
    parsed = parseTaxonomyProposals(repairResponse);
    retryCount = 1;
  }

  const { accepted, rejected } = verifyEvidenceQuotes(parsed, rawText);
  return { accepted, rejected, retryCount };
}
