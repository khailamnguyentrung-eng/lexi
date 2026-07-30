/**
 * Seed kỳ thi "hanoi-g10" — tạo bảng Exam/ExamSkill/ExamSection từ cấu trúc
 * đề thi thật (8 phần, 40 câu, 60 phút).
 *
 * Cấu trúc đề thi được DI DỜI về đây từ lib/analytics/examBlueprint.ts (A2
 * Task 4, quyết định phạm vi kế hoạch). Trước đó các con số nằm ở
 * examBlueprint.ts dưới dạng Record<QuestionType, …> và seeder này import
 * thẳng chúng — trong cửa sổ migration đó, examBlueprint.ts vẫn là nguồn sự
 * thật đang phục vụ analytics, import bảo đảm hai bên KHÔNG THỂ lệch nhau.
 *
 * Sau khi mọi reader (analytics, mock test) chuyển sang đọc bảng Exam/
 * ExamSection qua loadExamBlueprint(), seeder này là nơi DUY NHẤT còn cần các
 * con số gốc — nên chúng được di dời hẳn về đây, thoát khỏi kiểu
 * Record<QuestionType,…> (đó chính là thứ chặn việc nới enum QuestionType
 * cho các kỳ thi khác).
 *
 * Đây giờ là nguồn sự thật DUY NHẤT của các con số này trong code; bảng DB
 * dẫn xuất từ đây. scripts/test-exam-blueprint-parity.mjs ghim cứng cùng bộ
 * số một cách độc lập và đối chiếu với DB — sửa lệch ở đây sẽ làm test đó đỏ.
 *
 * Idempotent: chạy lại không tạo trùng, không sửa dữ liệu đã có (cùng kỷ luật
 * với seedDemoProgram()).
 */
import { prisma } from "@/lib/db/prisma";

export const HANOI_G10_SLUG = "hanoi-g10";

/**
 * Cấu trúc đề thi vào 10 Hà Nội — 8 phần, tổng 40 câu, 60 phút.
 *
 * Trước A2 các con số này nằm ở lib/analytics/examBlueprint.ts dưới dạng
 * Record<QuestionType, …>. Chúng được DI DỜI về đây vì: (a) seeder là thứ
 * duy nhất còn cần chúng — mọi nơi khác giờ đọc bảng Exam/ExamSection qua
 * loadExamBlueprint(); (b) kiểu Record<QuestionType,…> chính là thứ chặn
 * việc nới enum QuestionType cho các kỳ thi khác, nên mảng phẳng dùng
 * `code: string` là có chủ đích, không phải tiện tay.
 *
 * Đây là nguồn sự thật DUY NHẤT của các con số này trong code; DB dẫn xuất
 * từ đây. scripts/test-exam-blueprint-parity.mjs ghim cứng cùng bộ số một
 * cách độc lập và đối chiếu với DB, nên sửa lệch ở đây sẽ làm test đó đỏ.
 * scripts/test-exam-model.mjs cũng đọc mảng này (không hardcode song song)
 * để canh số section/tổng câu của hanoi-g10 khớp DB.
 *
 * `code` trùng khít giá trị enum QuestionType là tính chất riêng của kỳ thi
 * này (xem comment ở templateAssembler.ts) — không phải ràng buộc của kiểu.
 */
export const HANOI_G10_SECTIONS: { code: string; label: string; questionCount: number }[] = [
  { code: "PHONETICS_SOUND", label: "Ngữ âm — âm thanh", questionCount: 2 },
  { code: "PHONETICS_STRESS", label: "Ngữ âm — trọng âm", questionCount: 2 },
  { code: "GRAMMAR_MCQ", label: "Ngữ pháp / Từ vựng", questionCount: 15 },
  { code: "ERROR_IDENTIFICATION", label: "Nhận diện lỗi sai", questionCount: 2 },
  { code: "WORD_FORMATION", label: "Hình thành từ", questionCount: 4 },
  { code: "CLOZE", label: "Điền vào chỗ trống", questionCount: 5 },
  { code: "READING_COMPREHENSION", label: "Đọc hiểu", questionCount: 5 },
  { code: "SENTENCE_TRANSFORMATION", label: "Viết lại câu", questionCount: 5 },
];

/**
 * Derived, không chép tay: tổng questionCount của HANOI_G10_SECTIONS.
 * Giữ bất biến "tổng section = tổng đề" mà không hardcode 40.
 */
export const TOTAL_EXAM_QUESTIONS: number = HANOI_G10_SECTIONS.reduce(
  (sum, s) => sum + s.questionCount,
  0,
);

/**
 * 5 kỹ năng của kỳ thi vào 10 Hà Nội — ánh xạ 1-1 từ enum SkillCategory.
 * `code` giữ ĐÚNG tên enum để Task 3 backfill đối chiếu được, và để
 * test-exam-backfill.mjs so khớp từng cặp trước/sau.
 *
 * COMMUNICATION có mặt ở đây dù KHÔNG section nào thuộc về nó — phần chức
 * năng giao tiếp đã gộp vào GRAMMAR_MCQ. Vẫn phải tạo vì có câu hỏi thật mang
 * skill này (3 câu, đo 2026-07-28) cần chỗ để về.
 */
const HANOI_G10_SKILLS: { code: string; label: string }[] = [
  { code: "PHONETICS_STRESS", label: "Ngữ âm & Trọng âm" },
  { code: "VOCAB_GRAMMAR", label: "Từ vựng & Ngữ pháp" },
  { code: "COMMUNICATION", label: "Giao tiếp" },
  { code: "READING", label: "Đọc hiểu" },
  { code: "WRITING_TRANSFORMATION", label: "Viết & Biến đổi câu" },
];

/**
 * Kỹ năng CHÍNH của từng section. Không phải kỹ năng của từng câu hỏi trong
 * section đó — section GRAMMAR_MCQ có kỹ năng chính VOCAB_GRAMMAR nhưng vẫn
 * chứa câu COMMUNICATION. Hai trục độc lập; Task 3 backfill câu hỏi theo
 * Question.skill, KHÔNG theo bảng này.
 */
const SECTION_PRIMARY_SKILL: Record<string, string> = {
  PHONETICS_SOUND: "PHONETICS_STRESS",
  PHONETICS_STRESS: "PHONETICS_STRESS",
  GRAMMAR_MCQ: "VOCAB_GRAMMAR",
  ERROR_IDENTIFICATION: "VOCAB_GRAMMAR",
  WORD_FORMATION: "VOCAB_GRAMMAR",
  CLOZE: "READING",
  READING_COMPREHENSION: "READING",
  SENTENCE_TRANSFORMATION: "WRITING_TRANSFORMATION",
};

export interface SeedExamResult {
  examId: string;
  slug: string;
  skillsCreated: number;
  sectionsCreated: number;
  alreadyExisted: boolean;
}

export async function seedHanoiG10Exam(): Promise<SeedExamResult> {
  const existing = await prisma.exam.findUnique({ where: { slug: HANOI_G10_SLUG } });
  if (existing) {
    return {
      examId: existing.id,
      slug: existing.slug,
      skillsCreated: 0,
      sectionsCreated: 0,
      alreadyExisted: true,
    };
  }

  const exam = await prisma.exam.create({
    data: {
      slug: HANOI_G10_SLUG,
      name: "Thi vào 10 — Tiếng Anh — Hà Nội",
      description:
        "Kỳ thi tuyển sinh vào lớp 10 môn Tiếng Anh của Sở GD&ĐT Hà Nội. Cấu trúc đề định nghĩa ở HANOI_G10_SECTIONS trong chính file này.",
      totalQuestions: TOTAL_EXAM_QUESTIONS,
      timeAllowedMin: 60,
    },
  });

  const skillIdByCode = new Map<string, string>();
  for (const [i, s] of HANOI_G10_SKILLS.entries()) {
    const created = await prisma.examSkill.create({
      data: { examId: exam.id, code: s.code, label: s.label, order: i + 1 },
    });
    skillIdByCode.set(s.code, created.id);
  }

  let sectionsCreated = 0;
  for (const [i, section] of HANOI_G10_SECTIONS.entries()) {
    const skillCode = SECTION_PRIMARY_SKILL[section.code];
    const examSkillId = skillIdByCode.get(skillCode);
    if (!examSkillId) {
      throw new Error(
        `seedHanoiG10Exam: section "${section.code}" trỏ tới skill "${skillCode}" không tồn tại trong HANOI_G10_SKILLS`,
      );
    }
    await prisma.examSection.create({
      data: {
        examId: exam.id,
        examSkillId,
        code: section.code,
        label: section.label,
        order: i + 1,
        questionCount: section.questionCount,
        timeAllowedMin: null, // vào-10 thi trọn gói 60 phút, không luyện lẻ từng phần
      },
    });
    sectionsCreated++;
  }

  return {
    examId: exam.id,
    slug: exam.slug,
    skillsCreated: HANOI_G10_SKILLS.length,
    sectionsCreated,
    alreadyExisted: false,
  };
}
