/**
 * test-exam-model.mjs
 *
 * Kiểm chứng sống (dev.db thật, không mock) các ràng buộc của 3 bảng mới:
 *   - @@unique([examId, code]) chặn trùng kỹ năng trong cùng kỳ thi
 *   - @@unique([examId, code]) chặn trùng section trong cùng kỳ thi
 *   - onDelete: Restrict chặn xoá Exam khi còn ExamSkill trỏ về
 *   - dữ liệu hanoi-g10 seed ra khớp ĐÚNG hằng số examBlueprint.ts
 *
 * Tự tạo và tự dọn fixture trong `finally`, theo đúng quy ước
 * test-ku1-partb-review.mjs.
 *
 * DEVIATION so với task-2-brief.md: brief import thẳng `TOTAL_EXAM_QUESTIONS`
 * từ examBlueprint.ts, nhưng hằng số đó trong file thật không có `export`
 * (chỉ EXAM_SECTION_DEPTH/EXAM_SECTION_WEIGHTS/SECTION_LABELS/ALL_SECTIONS
 * được export) và examBlueprint.ts không được sửa. Nên bài test này tính lại
 * tổng bằng cách cộng EXAM_SECTION_DEPTH (vẫn từ export thật của
 * examBlueprint.ts) — cùng cách seedExams.ts đã làm — thay vì import một tên
 * không tồn tại.
 *
 * Run: node --import tsx scripts/test-exam-model.mjs
 */
import { PrismaClient } from "@prisma/client";
import { EXAM_SECTION_DEPTH, ALL_SECTIONS } from "../lib/analytics/examBlueprint.ts";
import { HANOI_G10_SLUG } from "../lib/services/exam/seedExams.ts";

const TOTAL_EXAM_QUESTIONS = Object.values(EXAM_SECTION_DEPTH).reduce((sum, n) => sum + n, 0);

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

    console.log("\nhanoi-g10 khớp hằng số examBlueprint.ts");
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
        `số section = số phần trong ALL_SECTIONS (${ALL_SECTIONS.length})`,
        seeded.sections.length === ALL_SECTIONS.length,
        `thực tế ${seeded.sections.length}`,
      );
      ok("có đủ 5 ExamSkill", seeded.skills.length === 5, `thực tế ${seeded.skills.length}`);
      ok(
        "COMMUNICATION tồn tại dù không section nào thuộc về nó",
        seeded.skills.some((s) => s.code === "COMMUNICATION"),
      );
      const depthMismatch = seeded.sections.filter(
        (s) => s.questionCount !== EXAM_SECTION_DEPTH[s.code],
      );
      ok(
        "questionCount từng section khớp EXAM_SECTION_DEPTH",
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

main();
