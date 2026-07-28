/**
 * test-behavior-engine-scope.mjs
 *
 * Live check (real dev.db, no mocks) that getBehaviorProfile() correctly
 * finds QuestionAttempt rows for a completed ProgramCurriculum slot.
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
  const program = await prisma.program.create({
    data: { slug: `behavior-scope-test-${stamp}`, title: "Behavior Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Behavior Scope Test Slot" },
  });

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  await prisma.userProgramProgress.create({
    data: {
      userId: user.id,
      programCurriculumId: slot.id,
      status: "COMPLETED",
      startedAt: tenMinAgo,
      completedAt: now,
    },
  });

  // 5 attempts (derivePaceProfile needs >= 3 attempts to count a session;
  // deriveResponseTimeSignal needs >= 5 non-null timeSpentSec records)
  for (let i = 0; i < 5; i++) {
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
    assert("sessionCount counts the completed ProgramCurriculum slot", profile.sessionCount === 1);
    assert(
      "avgSessionDurationMin is computed from the startedAt/completedAt pair",
      profile.avgSessionDurationMin !== null && profile.avgSessionDurationMin > 0
    );
    assert(
      "responseTimeSignal is MODERATE (proves attempts reached the engine)",
      profile.responseTimeSignal === "MODERATE"
    );
  } finally {
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.delete({ where: { id: slot.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
