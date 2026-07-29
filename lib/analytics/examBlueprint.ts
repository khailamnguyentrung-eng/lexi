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
 *     available, update EXAM_SECTION_DEPTH (and nowhere else — weights are
 *     derived automatically as depth / TOTAL_EXAM_QUESTIONS).
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
 * 2. Update EXAM_SECTION_DEPTH values below (must still sum to 40).
 * 3. Remove or downgrade the ⚠️ estimate comment for verified sections.
 * 4. Run: npm run test:analytics  (weight-sum and depth-sum tests will catch errors)
 *
 * Used by analytics to calculate CoverageDepthScore (how thoroughly each
 * section was sampled) and WeightedTopicMastery (accuracy weighted by section
 * importance).
 */

import { QuestionType } from "@prisma/client";

/** Total questions on the real Hanoi Grade 10 English entrance exam. */
const TOTAL_EXAM_QUESTIONS = 40;

/**
 * Expected number of questions per section on the real exam.
 * Must sum to TOTAL_EXAM_QUESTIONS (40). Each value is the depth target
 * used by CoverageDepthScore.
 *
 * ⚠️  Section depths are estimated — see file header for verification status.
 */
export const EXAM_SECTION_DEPTH: Record<QuestionType, number> = {
  PHONETICS_SOUND: 2,
  PHONETICS_STRESS: 2,
  GRAMMAR_MCQ: 15, // includes communicative-function MCQs (same format)
  ERROR_IDENTIFICATION: 2,
  WORD_FORMATION: 4,
  CLOZE: 5,
  READING_COMPREHENSION: 5,
  SENTENCE_TRANSFORMATION: 5,
};

/**
 * Exam section weights — each section's proportion of the 40-question exam.
 * Derived directly from EXAM_SECTION_DEPTH / TOTAL_EXAM_QUESTIONS.
 * Guaranteed to sum to exactly 1.0 as long as depths sum to 40.
 * Never edit these directly — update EXAM_SECTION_DEPTH instead.
 */
export const EXAM_SECTION_WEIGHTS: Record<QuestionType, number> = {
  PHONETICS_SOUND: EXAM_SECTION_DEPTH.PHONETICS_SOUND / TOTAL_EXAM_QUESTIONS,
  PHONETICS_STRESS: EXAM_SECTION_DEPTH.PHONETICS_STRESS / TOTAL_EXAM_QUESTIONS,
  GRAMMAR_MCQ: EXAM_SECTION_DEPTH.GRAMMAR_MCQ / TOTAL_EXAM_QUESTIONS,
  ERROR_IDENTIFICATION: EXAM_SECTION_DEPTH.ERROR_IDENTIFICATION / TOTAL_EXAM_QUESTIONS,
  WORD_FORMATION: EXAM_SECTION_DEPTH.WORD_FORMATION / TOTAL_EXAM_QUESTIONS,
  CLOZE: EXAM_SECTION_DEPTH.CLOZE / TOTAL_EXAM_QUESTIONS,
  READING_COMPREHENSION: EXAM_SECTION_DEPTH.READING_COMPREHENSION / TOTAL_EXAM_QUESTIONS,
  SENTENCE_TRANSFORMATION: EXAM_SECTION_DEPTH.SENTENCE_TRANSFORMATION / TOTAL_EXAM_QUESTIONS,
};

/**
 * Human-readable section labels in Vietnamese.
 * Used in UI to display which sections were covered.
 */
export const SECTION_LABELS: Record<QuestionType, string> = {
  PHONETICS_SOUND: "Ngữ âm — âm thanh",
  PHONETICS_STRESS: "Ngữ âm — trọng âm",
  GRAMMAR_MCQ: "Ngữ pháp / Từ vựng",
  ERROR_IDENTIFICATION: "Nhận diện lỗi sai",
  WORD_FORMATION: "Hình thành từ",
  CLOZE: "Điền vào chỗ trống",
  READING_COMPREHENSION: "Đọc hiểu",
  SENTENCE_TRANSFORMATION: "Viết lại câu",
};

/**
 * All QuestionType values in the order they appear on the real exam.
 * Used for UI rendering and analytics iteration.
 */
export const ALL_SECTIONS: QuestionType[] = [
  "PHONETICS_SOUND" as QuestionType,
  "PHONETICS_STRESS" as QuestionType,
  "GRAMMAR_MCQ" as QuestionType,
  "ERROR_IDENTIFICATION" as QuestionType,
  "WORD_FORMATION" as QuestionType,
  "CLOZE" as QuestionType,
  "READING_COMPREHENSION" as QuestionType,
  "SENTENCE_TRANSFORMATION" as QuestionType,
];

// ──────────────────────────────────────────────────────────────────
// A2 — blueprint đọc từ DB
// ──────────────────────────────────────────────────────────────────
// docs/superpowers/specs/2026-07-29-a2-blueprint-from-db-design.md
//
// Các hằng số phía trên là blueprint của MỘT kỳ thi, đóng cứng trong code.
// Ba kiểu Record<QuestionType, …> của chúng chính là thứ chặn việc thêm kỳ
// thi mới: nới enum QuestionType là gãy tsc ngay tại 3 chỗ đó.
//
// ExamBlueprint dùng `code: string` thay cho QuestionType — đó là toàn bộ
// điểm mấu chốt. Hằng số cũ vẫn còn trong cửa sổ migration này; Task 4 xoá
// chúng sau khi mọi reader đã chuyển sang đây.

import { prisma } from "@/lib/db/prisma";

export interface ExamBlueprintSection {
  code: string; // trước là QuestionType; giờ chỉ là chuỗi
  label: string;
  questionCount: number;
  weight: number; // dẫn xuất: questionCount / totalQuestions
}

export interface ExamBlueprint {
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
