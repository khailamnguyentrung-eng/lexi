/**
 * test-exam-backfill.mjs
 *
 * Bài test QUAN TRỌNG NHẤT của kế hoạch A1: chứng minh backfill không làm lệch
 * phân bố kỹ năng.
 *
 * Cách kiểm: đếm câu hỏi theo từng SkillCategory (enum cũ), đếm câu hỏi theo
 * từng ExamSkill.code (bảng mới), rồi so khớp TỪNG CẶP. Vì ExamSkill.code cố ý
 * giữ đúng tên enum SkillCategory, hai bảng đếm này PHẢI trùng khớp hoàn toàn.
 *
 * Đây là thứ bắt được lỗi mà "chạy không báo lỗi" không bắt được: nếu backfill
 * suy examSkillId từ ExamSection thay vì từ Question.skill, các câu
 * COMMUNICATION sẽ bị gán nhầm sang VOCAB_GRAMMAR — tổng số vẫn đúng, không
 * exception nào, nhưng phân bố đã sai.
 *
 * KHÔNG tạo fixture: bài này đo chính dữ liệu thật đã backfill, nên không có
 * gì để dọn.
 *
 * Run: node --import tsx scripts/test-exam-backfill.mjs
 */
import { PrismaClient } from "@prisma/client";
import { HANOI_G10_SLUG } from "../lib/services/exam/seedExams.ts";

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
  console.log("\nKhông còn câu hỏi mồ côi");
  const orphanExam = await prisma.question.count({ where: { examId: null } });
  const orphanSkill = await prisma.question.count({ where: { examSkillId: null } });
  ok("0 câu hỏi có examId null", orphanExam === 0, `thực tế ${orphanExam}`);
  ok("0 câu hỏi có examSkillId null", orphanSkill === 0, `thực tế ${orphanSkill}`);

  console.log("\nPhân bố kỹ năng giữ nguyên trước/sau backfill");
  const bySkillEnum = await prisma.question.groupBy({
    by: ["skill"],
    _count: { _all: true },
  });
  const before = new Map(bySkillEnum.map((r) => [r.skill, r._count._all]));

  const exam = await prisma.exam.findUnique({
    where: { slug: HANOI_G10_SLUG },
    include: { skills: { include: { questions: { select: { id: true } } } } },
  });
  ok(`Exam "${HANOI_G10_SLUG}" tồn tại`, exam !== null);
  if (!exam) {
    console.log(`\n${passed} passed, ${failed} failed`);
    await prisma.$disconnect();
    process.exit(1);
  }
  const after = new Map(exam.skills.map((s) => [s.code, s.questions.length]));

  const allCodes = new Set([...before.keys(), ...after.keys()]);
  for (const code of [...allCodes].sort()) {
    const b = before.get(code) ?? 0;
    const a = after.get(code) ?? 0;
    ok(`${code}: enum ${b} === ExamSkill ${a}`, b === a);
  }

  console.log("\nBẫy COMMUNICATION (skill không có ExamSection nào)");
  const commEnum = before.get("COMMUNICATION") ?? 0;
  const commAfter = after.get("COMMUNICATION") ?? 0;
  ok(
    "có ít nhất 1 câu COMMUNICATION để bài test này có ý nghĩa",
    commEnum > 0,
    "nếu 0, dữ liệu đã đổi — xem lại giả định của kế hoạch",
  );
  ok(
    `cả ${commEnum} câu COMMUNICATION đều về đúng ExamSkill(COMMUNICATION), không bị nuốt sang VOCAB_GRAMMAR`,
    commEnum === commAfter,
    `enum ${commEnum} vs ExamSkill ${commAfter}`,
  );

  console.log("\nMọi câu hỏi đã gán kỳ thi đều thuộc hanoi-g10");
  const withExam = await prisma.question.count({ where: { examId: { not: null } } });
  const inExam = await prisma.question.count({ where: { examId: exam.id } });
  ok(
    `mọi câu hỏi đã gán kỳ thi đều thuộc hanoi-g10 (${withExam})`,
    withExam === inExam,
    `có examId: ${withExam}, thuộc hanoi-g10: ${inExam}`,
  );

  console.log("\nKhông có câu hỏi nào trỏ examSkillId sang ExamSkill của kỳ thi khác");
  // Question.examSkillId và Question.examId là hai FK độc lập — không ràng buộc
  // DB nào bảo đảm examSkill.examId === examId. Kiểm trực tiếp bất biến này.
  const crossExam = await prisma.question.count({
    where: { examSkill: { examId: { not: exam.id } } },
  });
  ok("0 câu trỏ tới ExamSkill của kỳ thi khác", crossExam === 0, `thực tế ${crossExam}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
