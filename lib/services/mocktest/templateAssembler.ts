/**
 * Assemble a MockTestTemplate from the real question bank, matching the
 * structure `lib/analytics/examBlueprint.ts` already records for the actual
 * Hà Nội Grade-10 entrance exam (40 questions / 60 minutes / 8 sections with
 * known depths). That blueprint existed for readiness analytics only —
 * nothing ever turned it into a paper a learner could sit. This does.
 *
 * Deliberately loads the blueprint via `loadExamBlueprint()` (backed by the
 * `Exam`/`ExamSection` tables) rather than defining a new mock-test-specific
 * structure: it is already the one place in the codebase this exam's real
 * shape is recorded (and already carries its own caveat — depths are
 * estimated, not verified against an official paper — which applies here
 * identically and is not restated).
 */

import { prisma } from "@/lib/db/prisma";
import { loadExamBlueprint } from "@/lib/analytics/examBlueprint";
import type { QuestionType } from "@prisma/client";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface AssembleResult {
  templateId: string;
  totalQuestions: number;
  shortfalls: { type: QuestionType; needed: number; available: number }[];
}

/**
 * Build one new MockTestTemplate by randomly selecting, per section, exactly
 * `section.questionCount` questions from the real bank (without
 * replacement), in the section order `loadExamBlueprint()` returns (already
 * sorted by `ExamSection.order`).
 *
 * If the bank has fewer questions of a type than the blueprint calls for,
 * takes whatever is available and reports the shortfall — never throws and
 * never silently pads with fewer questions while claiming a full paper. A
 * real learner sitting a "40-question, 60-minute" test that quietly has 35
 * questions is exactly the kind of truthfulness gap this codebase's own
 * AIStatusLine fix (DECISION_LOG) already had to correct once elsewhere.
 */
export async function assembleBlueprintTemplate(title: string): Promise<AssembleResult> {
  const shortfalls: AssembleResult["shortfalls"] = [];
  const selectedQuestionIds: string[] = [];

  const blueprint = await loadExamBlueprint("hanoi-g10");

  for (const section of blueprint.sections) {
    // Cast an toàn CHỈ VÌ hanoi-g10 được seed sao cho ExamSection.code trùng
    // khít giá trị QuestionType (seedExams.ts tạo section thẳng từ
    // ALL_SECTIONS). Đây là tính chất riêng của kỳ thi này, không phải bất
    // biến của ExamBlueprintSection.code — kiểu của trường đó cố ý là
    // `string` để chấp nhận kỳ thi khác có section code bất kỳ.
    //
    // Kỳ thi khác (vd ielts-academic) hoàn toàn có thể có section code nằm
    // ngoài 8 giá trị QuestionType, và Prisma sẽ ném lỗi validate ngay khi
    // query bên dưới. Muốn dùng hàm này cho kỳ thi khác thì phải đổi cả cơ
    // chế chọn câu — không thể chỉ đổi slug "hanoi-g10" ở trên. Đường đi
    // đúng khi đó là lọc theo Question.examSectionId (chưa tồn tại).
    //
    // KHÔNG thay bằng ExamSection.examSkillId: đó là kỹ năng CHÍNH của cả
    // section, không phải của từng câu — section GRAMMAR_MCQ chứa cả câu
    // COMMUNICATION, nên lọc theo skill sẽ bỏ sót chúng.
    const type = section.code as QuestionType;
    const needed = section.questionCount;
    const candidates = await prisma.question.findMany({
      where: { type },
      select: { id: true },
    });
    const picked = shuffle(candidates).slice(0, needed);
    if (picked.length < needed) {
      shortfalls.push({ type, needed, available: picked.length });
    }
    selectedQuestionIds.push(...picked.map((q) => q.id));
  }

  const timeLimitMin = blueprint.timeAllowedMin;
  const template = await prisma.mockTestTemplate.create({
    data: {
      title,
      description: "Mô phỏng cấu trúc đề thi tuyển sinh vào lớp 10 (Hà Nội) — xem lib/analytics/examBlueprint.ts",
      timeLimitMin,
      totalQuestions: selectedQuestionIds.length,
      questions: {
        create: selectedQuestionIds.map((questionId, i) => ({ questionId, order: i + 1 })),
      },
    },
  });

  return { templateId: template.id, totalQuestions: selectedQuestionIds.length, shortfalls };
}
