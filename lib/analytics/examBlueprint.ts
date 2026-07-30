/**
 * Hanoi Grade 10 English entrance exam blueprint.
 *
 * PURPOSE
 * -------
 * This file defines the expected structure of the *real* Hà Nội Grade 10
 * public English entrance exam ("đề thi tuyển sinh vào lớp 10 – Tiếng Anh")
 * for readiness analytics. Readiness measures exam preparation, not practice-
 * document completion — these values must reflect the official exam, not the
 * tutoring materials.
 *
 * KNOWN FACTS (verified)
 * ----------------------
 * • Total questions : 40 (multiple choice)
 * • Time allowed    : 60 minutes
 * • Format          : 100% multiple choice (A/B/C/D), machine-marked
 * Source: consistent across Hà Nội DOET exam guidance and multiple past papers.
 *
 * SECTION DEPTHS (estimated — see note below)
 * -------------------------------------------
 * The per-section question counts are estimated from the proportional
 * distribution found in Bo_de_test_Tieng_Anh_9.docx (3 practice papers,
 * 118 questions total) scaled to 40 questions and cross-checked against
 * common Hà Nội exam conventions.
 *
 * ⚠️  These estimates have NOT been verified against an official published
 *     Hà Nội Grade 10 English exam paper. When an official paper becomes
 *     available, update `HANOI_G10_SECTIONS` in
 *     `lib/services/exam/seedExams.ts` (and nowhere else — weights are
 *     derived automatically as questionCount / totalQuestions, both here in
 *     `loadExamBlueprint()` and in the DB row itself).
 *
 * | Section                    | Estimated | Basis                              |
 * |----------------------------|-----------|------------------------------------|
 * | Phonetics — sound          | 2         | Consistent across all 3 papers      |
 * | Phonetics — stress         | 2         | Consistent across all 3 papers      |
 * | Grammar / Vocabulary MCQ   | 15        | ~37–40% of 40q; includes commun.fn |
 * | Word Formation             | 4         | Consistent across all 3 papers      |
 * | Error Identification       | 2         | ~5% of 40q; lower-bound estimate   |
 * | Cloze reading              | 5         | ~12.5% of 40q                      |
 * | Reading Comprehension      | 5         | ~12.5% of 40q                      |
 * | Sentence Transformation    | 5         | ~12.5% of 40q                      |
 * | TOTAL                      | 40        |                                    |
 *
 * HOW TO UPDATE
 * -------------
 * 1. Obtain an official exam paper or DOET-published section breakdown.
 * 2. Update `HANOI_G10_SECTIONS` in `lib/services/exam/seedExams.ts` (must
 *    still sum to 40 questionCount). This file no longer holds the numbers —
 *    see "WHERE THE NUMBERS LIVE NOW" below.
 * 3. Remove or downgrade the ⚠️ estimate comment for verified sections.
 * 4. Re-seed (or update existing rows) and run:
 *    npm run test:exam-blueprint-parity  (checks the seeded DB against the
 *    hardcoded expectations in scripts/test-exam-blueprint-parity.mjs —
 *    update that file's expectations too when the real numbers change).
 *
 * Used by analytics to calculate CoverageDepthScore (how thoroughly each
 * section was sampled) and WeightedTopicMastery (accuracy weighted by section
 * importance).
 *
 * WHERE THE NUMBERS LIVE NOW (A2 Task 4)
 * ---------------------------------------
 * The constants that used to sit in this file (EXAM_SECTION_DEPTH,
 * EXAM_SECTION_WEIGHTS, SECTION_LABELS, ALL_SECTIONS, plus the private
 * TOTAL_EXAM_QUESTIONS) have been removed. The numbers above are no longer
 * dead documentation — they now live as rows in the `Exam`/`ExamSection`
 * tables, seeded by `lib/services/exam/seedExams.ts` (see
 * `HANOI_G10_SECTIONS` there), and read at runtime via `loadExamBlueprint()`
 * below. `scripts/test-exam-blueprint-parity.mjs` hardcodes this same table
 * independently and checks it against the DB, so this file drifting from the
 * seeded numbers would turn that test red.
 */

import { prisma } from "@/lib/db/prisma";

export interface ExamBlueprintSection {
  code: string; // trước là QuestionType; giờ chỉ là chuỗi
  label: string;
  questionCount: number;
  weight: number; // dẫn xuất: questionCount / totalQuestions
}

export interface ExamBlueprint {
  examId: string; // dùng để scope các truy vấn khác theo đúng kỳ thi này (xem C-2/templateAssembler.ts)
  slug: string;
  totalQuestions: number;
  timeAllowedMin: number;
  sections: ExamBlueprintSection[];
}

/**
 * Nạp blueprint của một kỳ thi từ bảng Exam/ExamSection.
 *
 * NÉM LỖI khi không tìm thấy kỳ thi, cố ý: trả về blueprint rỗng sẽ làm
 * coverage/readiness báo 0% một cách âm thầm, và không ai truy được vì sao.
 * Hỏng ồn ào tốt hơn hỏng im lặng.
 *
 * `weight` tính bằng questionCount / totalQuestions — đúng công thức
 * EXAM_SECTION_WEIGHTS cũ dùng, để số liệu không đổi khi cắt nguồn.
 */
export async function loadExamBlueprint(slug: string): Promise<ExamBlueprint> {
  const exam = await prisma.exam.findUnique({
    where: { slug },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  if (!exam) {
    throw new Error(
      `loadExamBlueprint: không tìm thấy Exam có slug "${slug}". ` +
        `Chạy \`npm run db:seed\` để seed kỳ thi, hoặc kiểm tra lại slug.`,
    );
  }

  return {
    examId: exam.id,
    slug: exam.slug,
    totalQuestions: exam.totalQuestions,
    timeAllowedMin: exam.timeAllowedMin,
    sections: exam.sections.map((s) => ({
      code: s.code,
      label: s.label,
      questionCount: s.questionCount,
      weight: s.questionCount / exam.totalQuestions,
    })),
  };
}
