/**
 * test-recent-completed-scope.mjs
 *
 * Live check (real dev.db, no mocks) that findMostRecentlyCompletedScope()
 * picks the most recently completed ProgramCurriculum slot, correctly
 * preferring a later completedAt over an earlier one across 2 slots.
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
  const program = await prisma.program.create({
    data: { slug: `recent-scope-test-${stamp}`, title: "Recent Scope Test Program" },
  });
  const earlierSlot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 3, title: "Earlier Slot" },
  });
  const laterSlot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 7, title: "Later Slot" },
  });

  const earlier = new Date(Date.now() - 60 * 60 * 1000);
  const later = new Date();

  try {
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: earlierSlot.id, status: "COMPLETED", completedAt: earlier },
    });
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: laterSlot.id, status: "COMPLETED", completedAt: later },
    });

    const result = await findMostRecentlyCompletedScope(user.id);
    assert(
      "picks the later-completed slot",
      result !== null && result.programCurriculumId === laterSlot.id
    );
    assert("label is the slot's order", result?.label === 7);
  } finally {
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.deleteMany({ where: { programId: program.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
