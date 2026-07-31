// Validates AI-produced (or mock-produced) drafts before they're persisted
// as ExtractedQuestionDraft rows. Invalid drafts are still recorded (for
// audit/debugging — nothing silently disappears) but importer.ts marks
// them REJECTED on creation so they can never appear in the admin's
// pending-review list and can never be approved into a real Question.
import { prisma } from "@/lib/db/prisma";
import type { NormalizedQuestionDraft } from "./normalizer";

const VALID_OPTIONS = ["A", "B", "C", "D"];
const VALID_TYPES = [
  "PHONETICS_SOUND",
  "PHONETICS_STRESS",
  "GRAMMAR_MCQ",
  "WORD_FORMATION",
  "ERROR_IDENTIFICATION",
  "CLOZE",
  "READING_COMPREHENSION",
  "SENTENCE_TRANSFORMATION",
];
const VALID_SKILLS = [
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
    const correctOption = draft.correctOption?.trim().toUpperCase();

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

    if (!correctOption || !VALID_OPTIONS.includes(correctOption)) {
      errors.push(`correctOption không hợp lệ: "${draft.correctOption}" (phải là A/B/C/D)`);
    } else {
      // Task 2 note: optionA-D are now optional on NormalizedQuestionDraft
      // (see normalizer.ts) since the extraction path may populate
      // responseFormat/payload instead. This validator still only checks
      // the legacy MCQ shape — Task 4 widens it for responseFormat/payload.
      const optionByLetter: Record<string, string | undefined> = {
        A: draft.optionA,
        B: draft.optionB,
        C: draft.optionC,
        D: draft.optionD,
      };
      if (!optionByLetter[correctOption]?.trim()) {
        errors.push(`Thiếu nội dung đáp án cho correctOption "${correctOption}"`);
      }
    }

    if (![draft.optionA, draft.optionB, draft.optionC, draft.optionD].every((opt) => opt?.trim())) {
      errors.push("Thiếu nội dung một hoặc nhiều lựa chọn A/B/C/D");
    }

    if (!draft.type || !VALID_TYPES.includes(draft.type)) errors.push(`type không hợp lệ: "${draft.type}"`);
    if (!draft.skill || !VALID_SKILLS.includes(draft.skill)) errors.push(`skill không hợp lệ: "${draft.skill}"`);
    if (!draft.difficulty || !VALID_DIFFICULTIES.includes(draft.difficulty)) {
      errors.push(`difficulty không hợp lệ: "${draft.difficulty}"`);
    }
    if (!draft.promptText?.trim()) errors.push("Thiếu promptText");
    if (!draft.explanationVi?.trim()) errors.push("Thiếu explanationVi");
    if (!draft.learningObjective?.trim()) errors.push("Thiếu learningObjective");

    return { draft, isValid: errors.length === 0, errors };
  });
}
