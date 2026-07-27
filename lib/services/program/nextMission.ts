import { prisma } from "@/lib/db/prisma";

/**
 * The next thing a student should do, resolved from the Program/
 * ProgramCurriculum spine (v2) — replaces the retired CurriculumSession-based
 * getCurrentMission(). Per PV-1 (docs/V1_V2_RECONCILIATION.md), Program is a
 * replacement for CurriculumSession, not an additive layer; this is the
 * "next mission" signal for the whole v2 spine now.
 */
export interface NextMission {
  programSlug: string;
  order: number;
  title: string;
  objective: string | null;
}

/**
 * Resolve the next uncompleted ProgramCurriculum slot for this user.
 *
 * Resolves "the one Program" via findFirst() with no slug filter — a
 * deliberate v1 simplification (only one Program exists today), but
 * deliberately NOT via seedDemoProgram.ts's DEMO_PROGRAM_SLUG constant:
 * that constant exists for functions that seed/grow that specific named
 * Program; this is a generic read that should resolve whichever Program
 * exists, including an isolated test fixture's own Program under a
 * different slug.
 *
 * Falls back to the first slot if every slot is already completed (mirrors
 * the retired getCurrentMission()'s "never leave the student with nothing
 * to do" behavior). Returns null only in the true degenerate case — no
 * Program at all, or a Program with zero slots (neither should happen given
 * assembleProgramGaps.ts's auto-growth, but the type stays nullable
 * defensively, same as its predecessor).
 */
export async function getNextMission(userId: string): Promise<NextMission | null> {
  // ⚠️ IMPORTANT: orderBy: { createdAt: "desc" } is required here. SQLite's
  // findFirst() with no orderBy does not guarantee a specific row when multiple
  // exist (may return oldest-first, newest-first, or arbitrary), making test
  // isolation impossible. This orders by newest-first (desc).
  //
  // Trade-off: This assumes only ONE Program exists in practice (the current
  // v1 invariant). If that invariant is ever violated — e.g. a leaked test/
  // debug Program row that didn't get cleaned up — this function will silently
  // serve the newest (wrong) one to real users rather than erroring. Future
  // readers: if you see multiple Programs in production, this is a footgun;
  // add an explicit slug parameter or a stricter query before that happens.
  const program = await prisma.program.findFirst({
    select: { id: true, slug: true },
    orderBy: { createdAt: "desc" },
  });
  if (!program) return null;

  const [slots, completed] = await Promise.all([
    prisma.programCurriculum.findMany({
      where: { programId: program.id },
      orderBy: { order: "asc" },
      select: { id: true, order: true, title: true, objective: true },
    }),
    prisma.userProgramProgress.findMany({
      where: {
        userId,
        status: "COMPLETED",
        programCurriculum: { programId: program.id },
      },
      select: { programCurriculumId: true },
    }),
  ]);

  if (slots.length === 0) return null;

  const completedIds = new Set(completed.map((c) => c.programCurriculumId));
  const next = slots.find((s) => !completedIds.has(s.id));
  const chosen = next ?? slots[0];

  return {
    programSlug: program.slug,
    order: chosen.order,
    title: chosen.title,
    objective: chosen.objective,
  };
}
