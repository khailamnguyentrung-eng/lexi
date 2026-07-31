// Validates AI-produced (or mock-produced) drafts before they're persisted
// as ExtractedQuestionDraft rows. Invalid drafts are still recorded (for
// audit/debugging — nothing silently disappears) but importer.ts marks
// them REJECTED on creation so they can never appear in the admin's
// pending-review list and can never be approved into a real Question.
//
// Sub-project B: rewritten to validate the extraction-path shape
// (responseFormat + payload) instead of the legacy A/B/C/D columns.
// Payload-shape checking is delegated to
// lib/services/question-format/validate.ts's validatePayload() — that
// module already has one validator per ResponseFormat, pure and tested;
// this file must not reimplement it.
import { prisma } from "@/lib/db/prisma";
import type { NormalizedQuestionDraft } from "./normalizer";
import { validatePayload, RESPONSE_FORMATS, type ResponseFormatName, type QuestionPayload } from "@/lib/services/question-format";

export const VALID_SKILLS = [
  "PHONETICS_STRESS", "VOCAB_GRAMMAR", "COMMUNICATION", "READING", "WRITING_TRANSFORMATION",
  "LISTENING", "SPEAKING", "MATH",
];
const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

export interface ValidatedDraft {
  draft: NormalizedQuestionDraft;
  isValid: boolean;
  errors: string[];
}

export async function validateDrafts(drafts: NormalizedQuestionDraft[]): Promise<ValidatedDraft[]> {
  const existing = await prisma.question.findMany({ select: { questionCode: true } });
  const existingCodes = new Set(existing.map((q) => q.questionCode));
  const seenInBatch = new Set<string>();

  return drafts.map((draft) => {
    const errors: string[] = [];
    const code = draft.questionCode?.trim();

    if (!code) {
      errors.push("Thiếu questionCode");
    } else if (existingCodes.has(code)) {
      errors.push(`Trùng questionCode với câu hỏi đã có trong ngân hàng: ${code}`);
    } else if (seenInBatch.has(code)) {
      errors.push(`Trùng questionCode với câu hỏi khác trong cùng lô trích xuất: ${code}`);
    } else {
      seenInBatch.add(code);
    }

    if (!draft.topic?.trim()) {
      errors.push("Thiếu topic");
    }
    if (!draft.skill || !VALID_SKILLS.includes(draft.skill)) errors.push(`skill không hợp lệ: "${draft.skill}"`);
    if (!draft.difficulty || !VALID_DIFFICULTIES.includes(draft.difficulty)) {
      errors.push(`difficulty không hợp lệ: "${draft.difficulty}"`);
    }
    if (!draft.promptText?.trim()) errors.push("Thiếu promptText");
    if (!draft.explanationVi?.trim()) errors.push("Thiếu explanationVi");
    if (!draft.learningObjective?.trim()) errors.push("Thiếu learningObjective");

    if (!draft.responseFormat || !RESPONSE_FORMATS.includes(draft.responseFormat as ResponseFormatName)) {
      errors.push(`responseFormat không hợp lệ: "${draft.responseFormat}"`);
    } else if (!draft.payload) {
      errors.push("Thiếu payload");
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(draft.payload);
      } catch {
        errors.push("payload không phải JSON hợp lệ");
      }
      if (parsed !== undefined) {
        const result = validatePayload(draft.responseFormat as ResponseFormatName, parsed as QuestionPayload);
        if (!result.valid) {
          for (const issue of result.issues) errors.push(`payload.${issue.field}: ${issue.message}`);
        }
      }
    }

    return { draft, isValid: errors.length === 0, errors };
  });
}
