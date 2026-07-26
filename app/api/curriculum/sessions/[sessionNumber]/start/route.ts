import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/curriculum/sessions/[sessionNumber]/start
 *
 * Start a curriculum session for an authenticated student.
 * Records the session start time for analytics (session context tracking).
 *
 * Genuinely idempotent: once startedAt is set, calling this again never
 * changes it — fixed 2026-07-26 (the previous version's upsert always
 * overwrote startedAt on every call despite this same docstring claiming
 * otherwise; uncaught because this route had zero callers until this
 * change wired it into PracticeQuiz.tsx).
 *
 * Response: { startedAt: ISO string | null }
 */
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

  const existing = await prisma.userSessionProgress.findUnique({
    where: { userId_curriculumSessionId: { userId: user.id, curriculumSessionId: session.id } },
  });
  if (existing?.startedAt) {
    return NextResponse.json({ startedAt: existing.startedAt });
  }

  const result = await prisma.userSessionProgress.upsert({
    where: { userId_curriculumSessionId: { userId: user.id, curriculumSessionId: session.id } },
    update: { startedAt: new Date(), status: "IN_PROGRESS" },
    create: { userId: user.id, curriculumSessionId: session.id, status: "IN_PROGRESS", startedAt: new Date() },
  });

  return NextResponse.json({ startedAt: result.startedAt });
}
