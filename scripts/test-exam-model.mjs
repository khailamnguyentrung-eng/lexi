/**
 * test-exam-model.mjs
 *
 * Kiểm chứng sống (dev.db thật, không mock) các ràng buộc của 3 bảng mới:
 *   - @@unique([examId, code]) chặn trùng kỹ năng trong cùng kỳ thi
 *   - @@unique([examId, code]) chặn trùng section trong cùng kỳ thi
 *   - onDelete: Restrict chặn xoá Exam khi còn ExamSkill trỏ về
 *   - dữ liệu hanoi-g10 seed ra khớp ĐÚNG HANOI_G10_SECTIONS
 *
 * Tự tạo và tự dọn fixture trong `finally`, theo đúng quy ước
 * test-ku1-partb-review.mjs.
 *
 * CẬP NHẬT (A2 Task 4): trước đây file này import `EXAM_SECTION_DEPTH` và
 * `ALL_SECTIONS` từ lib/analytics/examBlueprint.ts (xem DEVIATION cũ về
 * TOTAL_EXAM_QUESTIONS không export — lý do đó vẫn đúng lúc đó). Task 4 di
 * dời các hằng số này (và tổng số câu) sang lib/services/exam/seedExams.ts
 * làm nguồn sự thật duy nhất — grep xác nhận reader trước khi xoá phát hiện
 * chính file này là một reader thật ngoài phạm vi app/lib mà brief Task 4
 * quét (grep gốc không bao scripts/*.mjs). Import lại đổi sang seedExams.ts,
 * không hardcode song song — vai trò "hardcode độc lập để đối chiếu DB" đã
 * có scripts/test-exam-blueprint-parity.mjs đảm nhiệm.
 *
 * Run: node --import tsx scripts/test-exam-model.mjs
 */
import { PrismaClient } from "@prisma/client";
import { HANOI_G10_SLUG, HANOI_G10_SECTIONS, TOTAL_EXAM_QUESTIONS } from "../lib/services/exam/seedExams.ts";

const sectionByCode = new Map(HANOI_G10_SECTIONS.map((s) => [s.code, s]));

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function ok(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  const stamp = Date.now();
  const exam = await prisma.exam.create({
    data: {
      slug: `exam-model-test-${stamp}`,
      name: "Exam Model Test",
      totalQuestions: 10,
      timeAllowedMin: 30,
    },
  });

  try {
    console.log("\nRàng buộc unique");
    const skill = await prisma.examSkill.create({
      data: { examId: exam.id, code: "READING", label: "Đọc", order: 1 },
    });
    let dupSkillRejected = false;
    try {
      await prisma.examSkill.create({
        data: { examId: exam.id, code: "READING", label: "Đọc (trùng)", order: 2 },
      });
    } catch {
      dupSkillRejected = true;
    }
    ok("trùng ExamSkill.code trong cùng Exam bị chặn", dupSkillRejected);

    await prisma.examSection.create({
      data: {
        examId: exam.id,
        examSkillId: skill.id,
        code: "PASSAGE_1",
        label: "Bài đọc 1",
        order: 1,
        questionCount: 10,
      },
    });
    let dupSectionRejected = false;
    try {
      await prisma.examSection.create({
        data: {
          examId: exam.id,
          examSkillId: skill.id,
          code: "PASSAGE_1",
          label: "Bài đọc 1 (trùng)",
          order: 2,
          questionCount: 5,
        },
      });
    } catch {
      dupSectionRejected = true;
    }
    ok("trùng ExamSection.code trong cùng Exam bị chặn", dupSectionRejected);

    console.log("\nonDelete: Restrict — nội dung không bị xoá theo container");
    let deleteRejected = false;
    try {
      await prisma.exam.delete({ where: { id: exam.id } });
    } catch {
      deleteRejected = true;
    }
    ok("xoá Exam khi còn ExamSkill/ExamSection bị chặn", deleteRejected);

    console.log("\nhanoi-g10 khớp HANOI_G10_SECTIONS (seedExams.ts)");
    const seeded = await prisma.exam.findUnique({
      where: { slug: HANOI_G10_SLUG },
      include: { sections: true, skills: true },
    });
    ok("Exam hanoi-g10 tồn tại (db:seed đã chạy)", seeded !== null);
    if (seeded) {
      ok(
        `totalQuestions = TOTAL_EXAM_QUESTIONS (${TOTAL_EXAM_QUESTIONS})`,
        seeded.totalQuestions === TOTAL_EXAM_QUESTIONS,
        `thực tế ${seeded.totalQuestions}`,
      );
      ok(
        `số section = số phần trong HANOI_G10_SECTIONS (${HANOI_G10_SECTIONS.length})`,
        seeded.sections.length === HANOI_G10_SECTIONS.length,
        `thực tế ${seeded.sections.length}`,
      );
      ok("có đủ 5 ExamSkill", seeded.skills.length === 5, `thực tế ${seeded.skills.length}`);
      ok(
        "hanoi-g10 thi liền một mạch nên mọi ExamSkill để null timeAllowedMin/questionCount (con số nằm ở Exam)",
        seeded.skills.every((s) => s.timeAllowedMin === null && s.questionCount === null),
        seeded.skills
          .filter((s) => s.timeAllowedMin !== null || s.questionCount !== null)
          .map((s) => `${s.code}: ${s.timeAllowedMin}/${s.questionCount}`)
          .join(", "),
      );
      ok(
        "COMMUNICATION tồn tại dù không section nào thuộc về nó",
        seeded.skills.some((s) => s.code === "COMMUNICATION"),
      );
      const depthMismatch = seeded.sections.filter(
        (s) => s.questionCount !== sectionByCode.get(s.code)?.questionCount,
      );
      ok(
        "questionCount từng section khớp HANOI_G10_SECTIONS",
        depthMismatch.length === 0,
        depthMismatch.map((s) => `${s.code}=${s.questionCount}`).join(", "),
      );
      const sum = seeded.sections.reduce((acc, s) => acc + s.questionCount, 0);
      ok(`tổng questionCount = ${TOTAL_EXAM_QUESTIONS}`, sum === TOTAL_EXAM_QUESTIONS, `thực tế ${sum}`);
    }
  } finally {
    await prisma.examSection.deleteMany({ where: { examId: exam.id } });
    await prisma.examSkill.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error("test-exam-model thất bại:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
