/**
 * test-analytics-scope.mjs
 *
 * Live check (real dev.db, no mocks) that fetchSessionAttempts() and
 * getSessionAnalytics() correctly branch on AttemptScope: a
 * curriculumSessionId scope must never return rows from a different
 * session/slot, and a programCurriculumId scope must return exactly the
 * attempts tagged with that slot.
 *
 * DEVIATION from most test-*.mjs scripts, same reasoning as
 * test-ku1-partb-review.mjs: creates its own fixtures (User, Question,
 * CurriculumPhase/Session, Program/ProgramCurriculum, two QuestionAttempt
 * rows) and tears them all down in `finally`, so it never touches any
 * pre-existing row.
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
  const phase = await prisma.curriculumPhase.create({
    data: { name: "Scope Test Phase", order: 9999, startSession: 9999, endSession: 9999, goal: "n/a" },
  });
  const session = await prisma.curriculumSession.create({
    data: {
      phaseId: phase.id,
      sessionNumber: 900000 + (stamp % 90000),
      title: "Scope Test Session",
      objective: "n/a",
      timeBlocks: "[]",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `scope-test-${stamp}`, title: "Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Scope Test Slot" },
  });

  const sessionAttempt = await prisma.questionAttempt.create({
    data: {
      userId: user.id,
      questionId: question.id,
      selectedOption: "A",
      isCorrect: true,
      curriculumSessionId: session.id,
    },
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

  try {
    const byProgramScope = await fetchSessionAttempts(user.id, { programCurriculumId: slot.id });
    assert(
      "programCurriculumId scope returns exactly the slot-scoped attempt",
      byProgramScope.length === 1 && byProgramScope[0].id === slotAttempt.id
    );

    const bySessionScope = await fetchSessionAttempts(user.id, { curriculumSessionId: session.id });
    assert(
      "curriculumSessionId scope returns exactly the session-scoped attempt",
      bySessionScope.length === 1 && bySessionScope[0].id === sessionAttempt.id
    );
    const programAnalytics = await getSessionAnalytics(user.id, { programCurriculumId: slot.id }, slot.order);
    assert(
      "getSessionAnalytics with programCurriculumId scope echoes the caller-supplied label as sessionNumber",
      programAnalytics.sessionNumber === slot.order
    );
    assert(
      "getSessionAnalytics with programCurriculumId scope produces a readiness result",
      programAnalytics.readiness != null
    );

    const sessionAnalytics = await getSessionAnalytics(
      user.id,
      { curriculumSessionId: session.id },
      session.sessionNumber
    );
    assert(
      "getSessionAnalytics with curriculumSessionId scope still works unchanged",
      sessionAnalytics.readiness != null
    );
  } finally {
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.delete({ where: { id: slot.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.curriculumSession.delete({ where: { id: session.id } });
    await prisma.curriculumPhase.delete({ where: { id: phase.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
