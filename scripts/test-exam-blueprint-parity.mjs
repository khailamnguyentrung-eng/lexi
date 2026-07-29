/**
 * test-exam-blueprint-parity.mjs
 *
 * Lưới an toàn của cả kế hoạch A2: chứng minh loadExamBlueprint("hanoi-g10")
 * đọc từ DB ra ĐÚNG những con số mà examBlueprint.ts từng đóng cứng trong code.
 *
 * CỐ Ý đóng cứng số kỳ vọng bên dưới thay vì import hằng số cũ. Hai lý do:
 *   1. Task 4 xoá các hằng số đó — nếu import, bài test này chết theo.
 *   2. Import chỉ chứng minh "hai thứ bằng nhau", không chứng minh "bằng đúng
 *      giá trị lịch sử". Đóng cứng biến nó thành bản ghi độc lập.
 * Các số này chép từ examBlueprint.ts tại commit a9206f2 (trước A2).
 *
 * Run: node --import tsx scripts/test-exam-blueprint-parity.mjs
 */
import { PrismaClient } from "@prisma/client";
import { loadExamBlueprint } from "../lib/analytics/examBlueprint.ts";

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

// Giá trị lịch sử của examBlueprint.ts, theo đúng thứ tự ALL_SECTIONS cũ.
const EXPECTED_TOTAL = 40;
const EXPECTED_TIME_MIN = 60;
const EXPECTED_SECTIONS = [
  { code: "PHONETICS_SOUND", label: "Ngữ âm — âm thanh", questionCount: 2 },
  { code: "PHONETICS_STRESS", label: "Ngữ âm — trọng âm", questionCount: 2 },
  { code: "GRAMMAR_MCQ", label: "Ngữ pháp / Từ vựng", questionCount: 15 },
  { code: "ERROR_IDENTIFICATION", label: "Nhận diện lỗi sai", questionCount: 2 },
  { code: "WORD_FORMATION", label: "Hình thành từ", questionCount: 4 },
  { code: "CLOZE", label: "Điền vào chỗ trống", questionCount: 5 },
  { code: "READING_COMPREHENSION", label: "Đọc hiểu", questionCount: 5 },
  { code: "SENTENCE_TRANSFORMATION", label: "Viết lại câu", questionCount: 5 },
];

async function main() {
  console.log("\nloadExamBlueprint('hanoi-g10') khớp giá trị lịch sử");
  const bp = await loadExamBlueprint("hanoi-g10");

  ok(`slug là "hanoi-g10"`, bp.slug === "hanoi-g10", bp.slug);
  ok(`totalQuestions = ${EXPECTED_TOTAL}`, bp.totalQuestions === EXPECTED_TOTAL, `thực tế ${bp.totalQuestions}`);
  ok(`timeAllowedMin = ${EXPECTED_TIME_MIN}`, bp.timeAllowedMin === EXPECTED_TIME_MIN, `thực tế ${bp.timeAllowedMin}`);
  ok(
    `có đúng ${EXPECTED_SECTIONS.length} section`,
    bp.sections.length === EXPECTED_SECTIONS.length,
    `thực tế ${bp.sections.length}`,
  );

  for (const [i, exp] of EXPECTED_SECTIONS.entries()) {
    const got = bp.sections[i];
    if (!got) {
      ok(`section #${i + 1} (${exp.code}) tồn tại`, false, "thiếu hẳn");
      continue;
    }
    ok(`section #${i + 1} đúng code ${exp.code}`, got.code === exp.code, `thực tế ${got.code}`);
    ok(`  ${exp.code} đúng label`, got.label === exp.label, `thực tế "${got.label}"`);
    ok(
      `  ${exp.code} questionCount = ${exp.questionCount}`,
      got.questionCount === exp.questionCount,
      `thực tế ${got.questionCount}`,
    );
    const expWeight = exp.questionCount / EXPECTED_TOTAL;
    ok(
      `  ${exp.code} weight = ${expWeight.toFixed(4)}`,
      Math.abs(got.weight - expWeight) < 1e-9,
      `thực tế ${got.weight}`,
    );
  }

  const sum = bp.sections.reduce((acc, s) => acc + s.questionCount, 0);
  ok(`tổng questionCount = ${EXPECTED_TOTAL}`, sum === EXPECTED_TOTAL, `thực tế ${sum}`);

  const weightSum = bp.sections.reduce((acc, s) => acc + s.weight, 0);
  ok("tổng weight = 1.0", Math.abs(weightSum - 1) < 1e-9, `thực tế ${weightSum}`);

  console.log("\nKỳ thi không tồn tại thì NÉM LỖI, không trả rỗng");
  let threw = false;
  try {
    await loadExamBlueprint("khong-ton-tai-dau");
  } catch {
    threw = true;
  }
  ok("loadExamBlueprint ném lỗi với slug không tồn tại", threw);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async (e) => {
    console.error("\nFATAL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
