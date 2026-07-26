/**
 * test-recent-completed-scope.mjs
 *
 * Live check (real dev.db, no mocks) that findMostRecentlyCompletedScope()
 * correctly picks whichever spine's completion is truly most recent by
 * completedAt, in both directions — not just "whichever spine happens to
 * run first in the Promise.all".
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-recent-completed-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { findMostRecentlyCompletedScope } from "../lib/analytics/repository.ts";

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
    data: { email: `recent-scope-test-${stamp}@lexi.local`, name: "Recent Scope Test" },
  });
  const phase = await prisma.curriculumPhase.create({
    data: { name: "Recent Scope Test Phase", order: 9997, startSession: 9997, endSession: 9997, goal: "n/a" },
  });
  const session = await prisma.curriculumSession.create({
    data: {
      phaseId: phase.id,
      sessionNumber: 700000 + (stamp % 90000),
      title: "Recent Scope Test Session",
      objective: "n/a",
      timeBlocks: "[]",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `recent-scope-test-${stamp}`, title: "Recent Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 7, title: "Recent Scope Test Slot" },
  });

  const earlier = new Date(Date.now() - 60 * 60 * 1000);
  const later = new Date();

  try {
    // Case 1: CurriculumSession completed EARLIER, Program slot completed LATER
    // — expect the Program slot to win.
    await prisma.userSessionProgress.create({
      data: { userId: user.id, curriculumSessionId: session.id, status: "COMPLETED", completedAt: earlier },
    });
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot.id, status: "COMPLETED", completedAt: later },
    });

    const resultA = await findMostRecentlyCompletedScope(user.id);
    assert(
      "picks the Program slot when it completed later",
      resultA !== null && "programCurriculumId" in resultA.scope && resultA.scope.programCurriculumId === slot.id
    );
    assert("label is the slot's order, not a session number", resultA?.label === 7);

    // Case 2: flip which one is later — expect CurriculumSession to win now.
    await prisma.userSessionProgress.update({
      where: { userId_curriculumSessionId: { userId: user.id, curriculumSessionId: session.id } },
      data: { completedAt: later },
    });
    await prisma.userProgramProgress.update({
      where: { userId_programCurriculumId: { userId: user.id, programCurriculumId: slot.id } },
      data: { completedAt: earlier },
    });

    const resultB = await findMostRecentlyCompletedScope(user.id);
    assert(
      "picks the CurriculumSession when it completed later",
      resultB !== null && "curriculumSessionId" in resultB.scope && resultB.scope.curriculumSessionId === session.id
    );
  } finally {
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.userSessionProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.delete({ where: { id: slot.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.curriculumSession.delete({ where: { id: session.id } });
    await prisma.curriculumPhase.delete({ where: { id: phase.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
