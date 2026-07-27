import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { applySM2ForSession } from "@/lib/services/errorNotebook";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionNumber: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionNumber } = await params;
  const session = await prisma.curriculumSession.findUnique({
    where: { sessionNumber: Number(sessionNumber) },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Compute session score: accuracy across all attempts in this session context
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId: user.id, curriculumSessionId: session.id },
  });

  const scoreAchieved =
    attempts.length > 0 ? attempts.filter((a) => a.isCorrect).length / attempts.length : null;

  const progress = await prisma.userSessionProgress.upsert({
    where: { userId_curriculumSessionId: { userId: user.id, curriculumSessionId: session.id } },
    update: {
      status: "COMPLETED",
      completedAt: new Date(),
      scoreAchieved,
    },
    create: {
      userId: user.id,
      curriculumSessionId: session.id,
      status: "COMPLETED",
      completedAt: new Date(),
      scoreAchieved,
    },
  });

  try {
    await applySM2ForSession(user.id, { curriculumSessionId: session.id });
  } catch (e) {
    console.error("[SM-2] applySM2ForSession failed silently:", e);
  }

  return NextResponse.json({ progress });
}
