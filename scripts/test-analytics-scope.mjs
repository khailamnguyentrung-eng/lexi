/**
 * test-analytics-scope.mjs
 *
 * Live check (real dev.db, no mocks) that fetchSessionAttempts() and
 * getSessionAnalytics() correctly return only the attempts tagged with a
 * given ProgramCurriculum slot.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-analytics-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { fetchSessionAttempts } from "../lib/analytics/repository.ts";
import { getSessionAnalytics } from "../lib/analytics/service.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
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
  const user = await prisma.user.create({
    data: { email: `scope-test-${stamp}@lexi.local`, name: "Scope Test" },
  });
  const question = await prisma.question.create({
    data: {
      questionCode: `SCOPE_TEST_${stamp}`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      topic: "scope_test_topic",
      promptText: "Fixture question — not real content.",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctOption: "A",
      explanationVi: "n/a",
      source: "scope-test-fixture",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `scope-test-${stamp}`, title: "Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Scope Test Slot" },
  });
  const otherSlot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 2, title: "Other Scope Test Slot" },
  });

  const slotAttempt = await prisma.questionAttempt.create({
    data: {
      userId: user.id,
      questionId: question.id,
      selectedOption: "A",
      isCorrect: true,
      programCurriculumId: slot.id,
    },
  });
  await prisma.questionAttempt.create({
    data: {
      userId: user.id,
      questionId: question.id,
      selectedOption: "A",
      isCorrect: true,
      programCurriculumId: otherSlot.id,
    },
  });

  try {
    const byProgramScope = await fetchSessionAttempts(user.id, slot.id);
    assert(
      "returns exactly the slot-scoped attempt, not the other slot's",
      byProgramScope.length === 1 && byProgramScope[0].id === slotAttempt.id
    );

    const programAnalytics = await getSessionAnalytics(user.id, slot.id, slot.order);
    assert(
      "getSessionAnalytics echoes the caller-supplied label as sessionNumber",
      programAnalytics.sessionNumber === slot.order
    );
    assert(
      "getSessionAnalytics produces a readiness result",
      programAnalytics.readiness != null
    );
  } finally {
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.deleteMany({ where: { programId: program.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
