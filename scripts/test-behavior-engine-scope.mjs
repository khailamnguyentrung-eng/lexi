/**
 * test-behavior-engine-scope.mjs
 *
 * Live check (real dev.db, no mocks) that getBehaviorProfile():
 *   1. Actually finds QuestionAttempt rows for a completed CurriculumSession
 *      (proves the id-vs-curriculumSessionId mismatch bug is fixed — before
 *      this fix, attemptsBySession was keyed by the wrong id and this would
 *      always come back empty).
 *   2. Also picks up a completed ProgramCurriculum slot's attempts (the
 *      union this task adds).
 *   3. sessionCount reflects both spines combined.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-behavior-engine-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { getBehaviorProfile } from "../lib/analytics/behaviorEngine.ts";

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
    data: { email: `behavior-scope-test-${stamp}@lexi.local`, name: "Behavior Scope Test" },
  });
  const question = await prisma.question.create({
    data: {
      questionCode: `BEHAVIOR_SCOPE_TEST_${stamp}`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      topic: "behavior_scope_test_topic",
      promptText: "Fixture question — not real content.",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctOption: "A",
      explanationVi: "n/a",
      source: "behavior-scope-test-fixture",
    },
  });
  const phase = await prisma.curriculumPhase.create({
    data: { name: "Behavior Scope Test Phase", order: 9998, startSession: 9998, endSession: 9998, goal: "n/a" },
  });
  const session = await prisma.curriculumSession.create({
    data: {
      phaseId: phase.id,
      sessionNumber: 800000 + (stamp % 90000),
      title: "Behavior Scope Test Session",
      objective: "n/a",
      timeBlocks: "[]",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `behavior-scope-test-${stamp}`, title: "Behavior Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Behavior Scope Test Slot" },
  });

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  await prisma.userSessionProgress.create({
    data: {
      userId: user.id,
      curriculumSessionId: session.id,
      status: "COMPLETED",
      startedAt: tenMinAgo,
      completedAt: now,
    },
  });
  await prisma.userProgramProgress.create({
    data: {
      userId: user.id,
      programCurriculumId: slot.id,
      status: "COMPLETED",
      startedAt: tenMinAgo,
      completedAt: now,
    },
  });

  // 3 attempts per spine (derivePaceProfile needs >= 3 attempts to count a session)
  for (let i = 0; i < 3; i++) {
    await prisma.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption: "A",
        isCorrect: i !== 1,
        timeSpentSec: 15,
        curriculumSessionId: session.id,
      },
    });
    await prisma.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption: "A",
        isCorrect: i !== 1,
        timeSpentSec: 15,
        programCurriculumId: slot.id,
      },
    });
  }

  try {
    const profile = await getBehaviorProfile(user.id);
    assert("sessionCount counts both the CurriculumSession and the ProgramCurriculum slot", profile.sessionCount === 2);
    assert(
      "avgSessionDurationMin is computed (proves startedAt/completedAt pairs from both spines feed in)",
      profile.avgSessionDurationMin !== null && profile.avgSessionDurationMin > 0
    );
    assert(
      "responseTimeSignal is MODERATE (proves attempts from BOTH spines actually reached the engine, not just their startedAt/completedAt timestamps)",
      profile.responseTimeSignal === "MODERATE"
    );
  } finally {
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.userSessionProgress.deleteMany({ where: { userId: user.id } });
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
