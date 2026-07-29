/**
 * Seed kỳ thi "hanoi-g10" — chuyển các hằng số đóng cứng trong
 * lib/analytics/examBlueprint.ts thành dữ liệu trong bảng Exam/ExamSkill/
 * ExamSection.
 *
 * CỐ Ý import thẳng hằng số từ examBlueprint.ts thay vì chép số sang đây
 * (hoặc sang một file JSON): trong cửa sổ migration, examBlueprint.ts vẫn là
 * nguồn sự thật đang phục vụ analytics. Import bảo đảm hai bên KHÔNG THỂ lệch
 * nhau — nếu chép tay, một lần sửa blueprint mà quên sửa seed là đủ để hai
 * nguồn nói khác nhau mà không có gì phát hiện.
 *
 * DEVIATION so với brief gốc (task-2-brief.md): brief liệt kê
 * `TOTAL_EXAM_QUESTIONS` trong danh sách import từ examBlueprint.ts, nhưng
 * hằng số đó trong file thật KHÔNG có từ khoá `export` (chỉ EXAM_SECTION_DEPTH,
 * EXAM_SECTION_WEIGHTS, SECTION_LABELS, ALL_SECTIONS được export) — import
 * thẳng sẽ vỡ tsc ("has no exported member"). Ràng buộc "KHÔNG được sửa
 * examBlueprint.ts" loại bỏ phương án thêm `export`. Vì vậy tổng số câu được
 * TÍNH bằng cách cộng dồn EXAM_SECTION_DEPTH (vẫn là hằng số export từ chính
 * examBlueprint.ts, không phải số chép tay) — giữ nguyên tinh thần "một nguồn
 * sự thật", chỉ khác brief ở CHỖ lấy con số 40 (derive thay vì import thẳng).
 *
 * Idempotent: chạy lại không tạo trùng, không sửa dữ liệu đã có (cùng kỷ luật
 * với seedDemoProgram()).
 */
import { prisma } from "@/lib/db/prisma";
import {
  EXAM_SECTION_DEPTH,
  SECTION_LABELS,
  ALL_SECTIONS,
} from "@/lib/analytics/examBlueprint";

export const HANOI_G10_SLUG = "hanoi-g10";

/**
 * Derived, không chép tay: tổng của EXAM_SECTION_DEPTH (export thật từ
 * examBlueprint.ts). Xem DEVIATION note ở đầu file — examBlueprint.ts không
 * export TOTAL_EXAM_QUESTIONS nên không thể import thẳng như brief viết.
 */
export const TOTAL_EXAM_QUESTIONS_FROM_BLUEPRINT: number = Object.values(
  EXAM_SECTION_DEPTH,
).reduce((sum, n) => sum + n, 0);

/**
 * 5 kỹ năng của kỳ thi vào 10 Hà Nội — ánh xạ 1-1 từ enum SkillCategory.
 * `code` giữ ĐÚNG tên enum để Task 3 backfill đối chiếu được, và để
 * test-exam-backfill.mjs so khớp từng cặp trước/sau.
 *
 * COMMUNICATION có mặt ở đây dù KHÔNG section nào thuộc về nó — examBlueprint.ts
 * ghi rõ phần chức năng giao tiếp đã gộp vào GRAMMAR_MCQ. Vẫn phải tạo vì có
 * câu hỏi thật mang skill này (3 câu, đo 2026-07-28) cần chỗ để về.
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
        "Kỳ thi tuyển sinh vào lớp 10 môn Tiếng Anh của Sở GD&ĐT Hà Nội. Dữ liệu chuyển từ lib/analytics/examBlueprint.ts.",
      totalQuestions: TOTAL_EXAM_QUESTIONS_FROM_BLUEPRINT,
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
  for (const [i, sectionCode] of ALL_SECTIONS.entries()) {
    const skillCode = SECTION_PRIMARY_SKILL[sectionCode];
    const examSkillId = skillIdByCode.get(skillCode);
    if (!examSkillId) {
      throw new Error(
        `seedHanoiG10Exam: section "${sectionCode}" trỏ tới skill "${skillCode}" không tồn tại trong HANOI_G10_SKILLS`,
      );
    }
    await prisma.examSection.create({
      data: {
        examId: exam.id,
        examSkillId,
        code: sectionCode,
        label: SECTION_LABELS[sectionCode],
        order: i + 1,
        questionCount: EXAM_SECTION_DEPTH[sectionCode],
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
