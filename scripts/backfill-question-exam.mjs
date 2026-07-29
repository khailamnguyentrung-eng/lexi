/**
 * backfill-question-exam.mjs
 *
 * Điền Question.examId + Question.examSkillId cho toàn bộ câu hỏi hiện có,
 * đưa tất cả về kỳ thi hanoi-g10 (tại thời điểm chạy, đây là kỳ thi DUY NHẤT
 * có câu hỏi — IELTS/SAT/THPT chưa nhập, đó là tiểu dự án B).
 *
 * ⚠️ examSkillId suy từ CHÍNH Question.skill, KHÔNG suy từ ExamSection.
 * Section và skill là hai trục độc lập: section GRAMMAR_MCQ chứa cả câu
 * VOCAB_GRAMMAR lẫn câu COMMUNICATION (46 và 3, đo 2026-07-28). Backfill duyệt
 * theo section sẽ gán nhầm 3 câu COMMUNICATION mà không báo lỗi gì.
 *
 * Idempotent: chỉ ghi vào hàng còn null, chạy lại là no-op.
 *
 * Run: node --import tsx scripts/backfill-question-exam.mjs
 */
import { PrismaClient } from "@prisma/client";
import { HANOI_G10_SLUG } from "../lib/services/exam/seedExams.ts";

const prisma = new PrismaClient();

async function main() {
  const exam = await prisma.exam.findUnique({
    where: { slug: HANOI_G10_SLUG },
    include: { skills: true },
  });
  if (!exam) {
    console.error(
      `Không tìm thấy Exam "${HANOI_G10_SLUG}". Chạy \`npm run db:seed\` trước.`,
    );
    process.exit(1);
  }

  // Script này gán MỌI câu hỏi chưa có examId về hanoi-g10, dựa trên giả định
  // hanoi-g10 là kỳ thi DUY NHẤT có câu hỏi. Ngay khi tiểu dự án B nhập câu hỏi
  // của kỳ thi khác (IELTS/SAT/THPT), giả định đó không còn đúng — chạy tiếp
  // sẽ gắn nhãn sai câu hỏi của kỳ thi khác thành hanoi-g10 mà không ném lỗi
  // nào. Dừng hẳn thay vì gán mù.
  const examCount = await prisma.exam.count();
  if (examCount > 1) {
    console.error(
      `DỪNG: có ${examCount} Exam trong DB. Script này gán MỌI câu hỏi chưa có examId về "${HANOI_G10_SLUG}",\n` +
        `giả định hanoi-g10 là kỳ thi duy nhất có câu hỏi. Giả định đó không còn đúng.\n` +
        `Câu hỏi của kỳ thi khác sẽ bị gắn nhãn sai mà không có lỗi nào báo.\n` +
        `Hãy sửa script để nhận kỳ thi tường minh trước khi chạy tiếp.`,
    );
    process.exit(1);
  }

  const skillIdByCode = new Map(exam.skills.map((s) => [s.code, s.id]));

  const pending = await prisma.question.findMany({
    where: { OR: [{ examId: null }, { examSkillId: null }] },
    select: { id: true, skill: true },
  });

  if (pending.length === 0) {
    console.log("Không có câu hỏi nào cần backfill — mọi hàng đã có examId + examSkillId.");
    await prisma.$disconnect();
    return;
  }

  const counts = new Map();
  let updated = 0;
  for (const q of pending) {
    const examSkillId = skillIdByCode.get(q.skill);
    if (!examSkillId) {
      // Dừng hẳn thay vì bỏ qua: một SkillCategory không có ExamSkill tương ứng
      // nghĩa là bộ seed thiếu, và bỏ qua sẽ để lại câu hỏi mồ côi âm thầm.
      console.error(
        `DỪNG: Question ${q.id} có skill "${q.skill}" nhưng hanoi-g10 không có ExamSkill nào mang code đó.`,
      );
      process.exit(1);
    }
    await prisma.question.update({
      where: { id: q.id },
      data: { examId: exam.id, examSkillId },
    });
    counts.set(q.skill, (counts.get(q.skill) ?? 0) + 1);
    updated++;
  }

  console.log(`Đã backfill ${updated} câu hỏi về "${HANOI_G10_SLUG}":`);
  for (const [skill, n] of [...counts].sort()) console.log(`  ${skill.padEnd(24)} ${n}`);

  await prisma.$disconnect();
}

main();
