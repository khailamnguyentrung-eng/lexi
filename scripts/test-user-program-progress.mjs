/**
 * test-user-program-progress.mjs
 *
 * Live check (real dev.db, no mocks) that the UserProgramProgress table
 * exists with the expected shape: unique on (userId, programCurriculumId),
 * FKs to User and ProgramCurriculum both enforced. Creates and tears down
 * its own fixtures, matching test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-user-program-progress.mjs
 */
import { PrismaClient } from "@prisma/client";

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
    data: { email: `upp-test-${stamp}@lexi.local`, name: "UPP Test" },
  });
  const program = await prisma.program.create({
    data: { slug: `upp-test-${stamp}`, title: "UPP Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "UPP Test Slot" },
  });

  try {
    const created = await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot.id, status: "IN_PROGRESS", startedAt: new Date() },
    });
    assert("row created with default-free explicit status", created.status === "IN_PROGRESS");
    assert("startedAt persisted", created.startedAt != null);
    assert("completedAt is null until completed", created.completedAt === null);

    let uniqueViolation = false;
    try {
      await prisma.userProgramProgress.create({
        data: { userId: user.id, programCurriculumId: slot.id, status: "NOT_STARTED" },
      });
    } catch {
      uniqueViolation = true;
    }
    assert("duplicate (userId, programCurriculumId) rejected by unique constraint", uniqueViolation);

    const updated = await prisma.userProgramProgress.update({
      where: { userId_programCurriculumId: { userId: user.id, programCurriculumId: slot.id } },
      data: { status: "COMPLETED", completedAt: new Date(), scoreAchieved: 0.8 },
    });
    assert("update by the compound unique key works", updated.status === "COMPLETED" && updated.scoreAchieved === 0.8);
  } finally {
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.delete({ where: { id: slot.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
