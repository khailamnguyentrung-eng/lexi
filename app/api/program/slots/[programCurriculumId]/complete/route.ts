import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { applySM2ForSession } from "@/lib/services/errorNotebook";

/**
 * POST /api/program/slots/[programCurriculumId]/complete
 *
 * Complete a Program lesson slot. Mirrors
 * POST /api/curriculum/sessions/[sessionNumber]/complete's score
 * computation and upsert shape exactly, keyed by programCurriculumId —
 * including its SM-2/error-notebook update, now that applySM2ForSession()
 * accepts either spine (see docs/superpowers/plans/2026-07-27-sm2-program-scope.md).
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

  const priorProgress = await prisma.userProgramProgress.findUnique({
    where: { userId_programCurriculumId: { userId: user.id, programCurriculumId } },
    select: { status: true },
  });
  const wasAlreadyCompleted = priorProgress?.status === "COMPLETED";

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

  // SM-2 advances reviewStage on every call — it is deliberately not
  // idempotent. Only apply it on the transition INTO completed, so replaying
  // an already-finished slot (reachable in one click from the program index,
  // which links every slot unconditionally) cannot double-advance a notebook
  // entry's spaced-repetition schedule.
  if (!wasAlreadyCompleted) {
    try {
      await applySM2ForSession(user.id, programCurriculumId);
    } catch (e) {
      console.error("[SM-2] applySM2ForSession failed silently:", e);
    }
  }

  return NextResponse.json({ progress });
}
