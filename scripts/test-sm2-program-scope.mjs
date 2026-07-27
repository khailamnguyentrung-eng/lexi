/**
 * test-sm2-program-scope.mjs
 *
 * Live check (real dev.db, no mocks) that applySM2ForSession() correctly
 * applies an SM-2 update for BOTH a CurriculumSession-scoped call (regression
 * — the pre-existing behavior) and a ProgramCurriculum-scoped call (the new
 * behavior this task adds).
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-sm2-program-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { applySM2ForSession } from "../lib/services/errorNotebook.ts";

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
    data: { email: `sm2-scope-test-${stamp}@lexi.local`, name: "SM2 Scope Test" },
  });
  const question = await prisma.question.create({
    data: {
      questionCode: `SM2_SCOPE_TEST_${stamp}`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      topic: "sm2_scope_test_topic",
      promptText: "Fixture question — not real content.",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctOption: "A",
      explanationVi: "n/a",
      source: "sm2-scope-test-fixture",
    },
  });
  const phase = await prisma.curriculumPhase.create({
    data: { name: "SM2 Scope Test Phase", order: 9996, startSession: 9996, endSession: 9996, goal: "n/a" },
  });
  const session = await prisma.curriculumSession.create({
    data: {
      phaseId: phase.id,
      sessionNumber: 600000 + (stamp % 90000),
      title: "SM2 Scope Test Session",
      objective: "n/a",
      timeBlocks: "[]",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `sm2-scope-test-${stamp}`, title: "SM2 Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "SM2 Scope Test Slot" },
  });

  const reviewedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const entry = await prisma.errorNotebookEntry.create({
    data: {
      userId: user.id,
      studentAnswer: "B",
      correctAnswer: "A",
      reason: "fixture",
      concept: "sm2_scope_test_topic",
      status: "OPEN",
      reviewStage: 0,
      easeFactor: 2.5,
      lastReviewedAt: reviewedAt,
    },
  });

  try {
    // Case 1: CurriculumSession-scoped call (regression check).
    await prisma.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption: "A",
        isCorrect: true,
        curriculumSessionId: session.id,
      },
    });
    await applySM2ForSession(user.id, { curriculumSessionId: session.id });

    const afterCurriculum = await prisma.errorNotebookEntry.findUniqueOrThrow({ where: { id: entry.id } });
    assert(
      "CurriculumSession-scoped call advances reviewStage (regression check)",
      afterCurriculum.reviewStage === 1
    );
    assert("CurriculumSession-scoped call sets nextReviewAt", afterCurriculum.nextReviewAt !== null);

    // Reset the entry's SM-2 state before Case 2, so Case 2's assertions
    // are unambiguous about the Program-scoped call causing the change.
    await prisma.errorNotebookEntry.update({
      where: { id: entry.id },
      data: { reviewStage: 0, easeFactor: 2.5, nextReviewAt: null },
    });

    // Case 2: ProgramCurriculum-scoped call (the new behavior).
    await prisma.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption: "A",
        isCorrect: true,
        programCurriculumId: slot.id,
      },
    });
    await applySM2ForSession(user.id, { programCurriculumId: slot.id });

    const afterProgram = await prisma.errorNotebookEntry.findUniqueOrThrow({ where: { id: entry.id } });
    assert("ProgramCurriculum-scoped call advances reviewStage", afterProgram.reviewStage === 1);
    assert("ProgramCurriculum-scoped call sets nextReviewAt", afterProgram.nextReviewAt !== null);
  } finally {
    await prisma.errorNotebookEntry.delete({ where: { id: entry.id } });
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
