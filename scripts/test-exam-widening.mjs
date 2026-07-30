/**
 * test-exam-widening.mjs
 *
 * Chứng minh chặn đã gỡ THẬT, không phải chỉ đúng trên giấy: chèn được một
 * Question mang skill = "LISTENING" (giá trị enum mới) và type = null, đúng
 * hình dạng mà một câu IELTS Listening sẽ có khi tiểu dự án B nhập tài liệu.
 *
 * Tự tạo và tự dọn fixture trong `finally`.
 *
 * Run: node --import tsx scripts/test-exam-widening.mjs
 */
import { PrismaClient } from "@prisma/client";

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
  let created = null;

  try {
    console.log("\nChèn câu hỏi hình dạng IELTS Listening");
    created = await prisma.question.create({
      data: {
        questionCode: `WIDEN_TEST_${stamp}`,
        type: null, // di sản, để trống cho kỳ thi ngoài vào-10
        skill: "LISTENING", // giá trị enum mới
        topic: "widen_test_topic",
        promptText: "Fixture question — not real content.",
        optionA: "a",
        optionB: "b",
        optionC: "c",
        optionD: "d",
        correctOption: "A",
        explanationVi: "n/a",
        source: "widen-test-fixture",
      },
    });
    ok("chèn được Question với skill = LISTENING", created.skill === "LISTENING");
    ok("chèn được Question với type = null", created.type === null);

    console.log("\nĐọc lại từ DB");
    const read = await prisma.question.findUniqueOrThrow({ where: { id: created.id } });
    ok("đọc lại vẫn là LISTENING", read.skill === "LISTENING");
    ok("đọc lại vẫn là null", read.type === null);

    console.log("\nHai giá trị enum mới còn lại cũng dùng được");
    for (const skill of ["SPEAKING", "MATH"]) {
      const q = await prisma.question.create({
        data: {
          questionCode: `WIDEN_TEST_${skill}_${stamp}`,
          type: null,
          skill,
          topic: "widen_test_topic",
          promptText: "Fixture question — not real content.",
          optionA: "a",
          optionB: "b",
          optionC: "c",
          optionD: "d",
          correctOption: "A",
          explanationVi: "n/a",
          source: "widen-test-fixture",
        },
      });
      ok(`chèn được skill = ${skill}`, q.skill === skill);
    }
  } finally {
    await prisma.question.deleteMany({ where: { source: "widen-test-fixture" } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async (e) => {
    console.error("\nFATAL:", e);
    await prisma.question.deleteMany({ where: { source: "widen-test-fixture" } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
