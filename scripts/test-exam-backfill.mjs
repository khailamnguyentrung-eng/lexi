/**
 * test-exam-backfill.mjs
 *
 * Bài test QUAN TRỌNG NHẤT của kế hoạch A1: chứng minh backfill không làm lệch
 * phân bố kỹ năng.
 *
 * Cách kiểm: so hai TRỤC DỮ LIỆU ĐỘC LẬP, cả hai đọc SAU khi backfill đã chạy —
 * cột enum cũ `Question.skill` (bySkillEnum) và cột FK mới `Question.examSkillId`
 * đi qua quan hệ `ExamSkill` (byExamSkill). Đây KHÔNG phải so trước/sau backfill
 * theo thời gian — cả hai phép đếm đều chạy trong cùng một cửa sổ, sau backfill.
 * Phép so vẫn có giá trị vì backfill không bao giờ ghi vào `Question.skill`
 * (script chỉ ghi examId/examSkillId), nên cột enum vẫn là bản ghi nguyên trạng,
 * độc lập với cột FK, để đối chiếu. Vì ExamSkill.code cố ý giữ đúng tên enum
 * SkillCategory, hai trục đếm này PHẢI trùng khớp hoàn toàn.
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
  console.log("\nKhông còn câu hỏi mồ côi (chỉ tính trong phạm vi thế giới hanoi-g10 cũ)");
  // RESCOPED sau tiểu dự án B (2026-07-31): assertion gốc đếm TOÀN BỘ bảng
  // Question, đúng tại A1 vì khi đó mọi câu hỏi đều thuộc thế giới hanoi-g10 và
  // PHẢI có examId/examSkillId sau backfill. Thiết kế đã duyệt của tiểu dự án B
  // (content-import) cố ý để examId/examSkillId = null cho câu hỏi nhập vào kho
  // chung (không gắn với Exam nào) — đó KHÔNG phải câu hỏi mồ côi, đó là trạng
  // thái hợp lệ theo thiết kế. Đếm toàn bộ bảng như cũ sẽ luôn đỏ kể từ lần
  // import thật đầu tiên, mãi mãi — không phải regression của backfill.
  //
  // Phân biệt hai tập bằng `Question.type`: approveDraft() (luồng import,
  // lib/services/content-import/importer.ts) ghi `type: null` một cách tường
  // minh cho MỌI câu hỏi nó tạo ra; luồng generate (aiDraftGenerator.ts) và
  // toàn bộ câu hỏi hanoi-g10 cũ luôn có `type` khác null (xác nhận bằng truy
  // vấn trực tiếp dev.db trước khi sửa: 120/120 câu type-not-null đều đã có
  // examId + examSkillId; câu type-null duy nhất từng tồn tại — do live-check
  // của Task 9 tạo ra — có examId null, đúng như thiết kế). Vậy `type IS NOT
  // NULL` là ranh giới đáng tin cho "thuộc thế giới hanoi-g10 cũ, phải được
  // backfill"; bất biến mồ côi CHỈ áp dụng cho tập con này.
  const legacyWorld = { type: { not: null } };
  const orphanExam = await prisma.question.count({ where: { ...legacyWorld, examId: null } });
  const orphanSkill = await prisma.question.count({ where: { ...legacyWorld, examSkillId: null } });
  ok(
    "0 câu hỏi (type khác null, tức thế giới hanoi-g10 cũ) có examId null",
    orphanExam === 0,
    `thực tế ${orphanExam}`,
  );
  ok(
    "0 câu hỏi (type khác null, tức thế giới hanoi-g10 cũ) có examSkillId null",
    orphanSkill === 0,
    `thực tế ${orphanSkill}`,
  );

  console.log("\nCâu hỏi type=null (kho chung, tiểu dự án B) không lẫn examId/examSkillId bất ngờ");
  // Bổ sung: xác nhận TẤT CẢ câu hỏi type=null đều đúng là "kho chung" (examId
  // null) — nếu một câu type=null lại có examId, đó là dữ liệu bất thường đáng
  // xem lại (không khớp giả định approveDraft() ghi cả hai cùng null).
  const typeNullTotal = await prisma.question.count({ where: { type: null } });
  const typeNullWithExam = await prisma.question.count({ where: { type: null, examId: { not: null } } });
  ok(
    `mọi câu hỏi type=null (${typeNullTotal}) đều thuộc kho chung (examId null), không câu nào có examId bất ngờ`,
    typeNullWithExam === 0,
    `type=null: ${typeNullTotal}, trong đó có examId: ${typeNullWithExam}`,
  );

  console.log("\nHai trục dữ liệu độc lập khớp nhau: cột enum vs cột FK qua ExamSkill");
  const bySkillEnumRows = await prisma.question.groupBy({
    by: ["skill"],
    _count: { _all: true },
  });
  const bySkillEnum = new Map(bySkillEnumRows.map((r) => [r.skill, r._count._all]));

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
  const byExamSkill = new Map(exam.skills.map((s) => [s.code, s.questions.length]));

  const allCodes = new Set([...bySkillEnum.keys(), ...byExamSkill.keys()]);
  for (const code of [...allCodes].sort()) {
    const b = bySkillEnum.get(code) ?? 0;
    const a = byExamSkill.get(code) ?? 0;
    ok(`${code}: enum ${b} === ExamSkill ${a}`, b === a);
  }

  console.log("\nBẫy COMMUNICATION (skill không có ExamSection nào)");
  const commEnum = bySkillEnum.get("COMMUNICATION") ?? 0;
  const commAfter = byExamSkill.get("COMMUNICATION") ?? 0;
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
  // TRIPWIRE CỐ Ý: assertion này giả định hanoi-g10 là kỳ thi DUY NHẤT có câu
  // hỏi (đúng tại A1). Khi tiểu dự án B nhập kỳ thi thứ hai và gán câu hỏi cho
  // nó, withExam sẽ > inExam và assertion này sẽ ĐỎ — đó là tín hiệu phải viết
  // lại cả suite này cho đa kỳ thi (so khớp theo từng kỳ thi, không còn giả
  // định "mọi câu hỏi = hanoi-g10"), KHÔNG phải dấu hiệu backfill bị lỗi.
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
  // Viết dạng không phụ thuộc kỳ thi nào (không đóng cứng theo `exam.id`) nên
  // assertion này sống sót qua kỳ thi thứ hai, khác với assertion tripwire ở
  // trên. $queryRaw trên SQLite trả COUNT(*) dạng BigInt — Number() để so sánh.
  const crossRows = await prisma.$queryRaw`
    SELECT COUNT(*) AS n FROM "Question" q
    JOIN "ExamSkill" s ON q."examSkillId" = s."id"
    WHERE q."examId" <> s."examId"
  `;
  const crossExam = Number(crossRows[0].n);
  ok(
    "0 câu có examSkill thuộc kỳ thi khác với examId của chính nó",
    crossExam === 0,
    `thực tế ${crossExam}`,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error("test-exam-backfill thất bại:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
