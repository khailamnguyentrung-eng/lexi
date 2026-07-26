import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/program/slots/[programCurriculumId]/complete
 *
 * Complete a Program lesson slot. Mirrors
 * POST /api/curriculum/sessions/[sessionNumber]/complete's score
 * computation and upsert shape exactly, keyed by programCurriculumId.
 *
 * Deliberately does NOT call an SM-2/error-notebook equivalent
 * (applySM2ForSession() is CurriculumSession-only) — extending spaced
 * repetition to Program slots is a separate, not-yet-requested feature,
 * not an oversight. See docs/superpowers/plans/2026-07-26-user-program-progress.md.
 *
 * Response: { progress: UserProgramProgress }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ programCurriculumId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { programCurriculumId } = await params;
  const slot = await prisma.programCurriculum.findUnique({ where: { id: programCurriculumId } });
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attempts = await prisma.questionAttempt.findMany({
    where: { userId: user.id, programCurriculumId },
  });

  const scoreAchieved =
    attempts.length > 0 ? attempts.filter((a) => a.isCorrect).length / attempts.length : null;

  const progress = await prisma.userProgramProgress.upsert({
    where: { userId_programCurriculumId: { userId: user.id, programCurriculumId } },
    update: { status: "COMPLETED", completedAt: new Date(), scoreAchieved },
    create: {
      userId: user.id,
      programCurriculumId,
      status: "COMPLETED",
      completedAt: new Date(),
      scoreAchieved,
    },
  });

  return NextResponse.json({ progress });
}
