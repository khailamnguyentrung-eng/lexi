/**
 * test-program-progress-summary.mjs
 *
 * Live check (real dev.db, no mocks) that getProgramProgressSummary()
 * correctly counts completed vs total ProgramCurriculum slots for a user.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-program-progress-summary.mjs
 */
import { PrismaClient } from "@prisma/client";
import { getProgramProgressSummary } from "../lib/services/program/nextMission.ts";

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
    data: { email: `progress-summary-test-${stamp}@lexi.local`, name: "Progress Summary Test" },
  });
  const program = await prisma.program.create({
    data: { slug: `progress-summary-test-${stamp}`, title: "Progress Summary Test Program" },
  });
  const slot1 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Slot One" },
  });
  const slot2 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 2, title: "Slot Two" },
  });
  const slot3 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 3, title: "Slot Three" },
  });

  try {
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot1.id, status: "COMPLETED", completedAt: new Date() },
    });
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot2.id, status: "IN_PROGRESS" },
    });
    // slot3 has no progress row at all — not started.

    const summary = await getProgramProgressSummary(user.id);
    assert("totalSlots counts every slot for the Program, regardless of status", summary.totalSlots >= 3);
    assert("completedSlots counts only COMPLETED rows for this user", summary.completedSlots === 1);
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
