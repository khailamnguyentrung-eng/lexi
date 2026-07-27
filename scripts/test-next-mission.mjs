/**
 * test-next-mission.mjs
 *
 * Live check (real dev.db, no mocks) that getNextMission() resolves the
 * next uncompleted ProgramCurriculum slot correctly: first slot for a new
 * user, next slot after completing one, wraps back to the first slot once
 * everything is completed.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention. Uses its own freshly-created
 * Program (a different slug than the real demo Program) — proving
 * getNextMission() does NOT hardcode a slug, per this plan's Global
 * Constraints.
 *
 * Run: node --import tsx scripts/test-next-mission.mjs
 */
import { PrismaClient } from "@prisma/client";
import { getNextMission } from "../lib/services/program/nextMission.ts";

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
    data: { email: `next-mission-test-${stamp}@lexi.local`, name: "Next Mission Test" },
  });
  const program = await prisma.program.create({
    data: { slug: `next-mission-test-${stamp}`, title: "Next Mission Test Program" },
  });
  const slot1 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Slot One", objective: "Objective one" },
  });
  const slot2 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 2, title: "Slot Two" },
  });

  try {
    const missionA = await getNextMission(user.id);
    assert(
      "a user with zero completed slots gets slot 1 back",
      missionA !== null && missionA.order === 1 && missionA.title === "Slot One"
    );
    assert("programSlug matches this fixture's Program, not any hardcoded slug", missionA?.programSlug === program.slug);
    assert("objective passes through", missionA?.objective === "Objective one");

    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot1.id, status: "COMPLETED", completedAt: new Date() },
    });

    const missionB = await getNextMission(user.id);
    assert("after completing slot 1, next mission is slot 2", missionB !== null && missionB.order === 2);

    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot2.id, status: "COMPLETED", completedAt: new Date() },
    });

    const missionC = await getNextMission(user.id);
    assert(
      "after completing every slot, wraps back to slot 1",
      missionC !== null && missionC.order === 1
    );
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
