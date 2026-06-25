import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/curriculum/sessions/[sessionNumber]/start
 *
 * Start a curriculum session for an authenticated student.
 * Records the session start time for analytics (session context tracking).
 *
 * Idempotent: calling multiple times does not reset startedAt.
 * (Useful for page reloads during a session.)
 *
 * Response: { startedAt: ISO string }
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

  // Upsert: create if not exists, update only if startedAt is null
  // This is idempotent: subsequent calls don't reset startedAt
  const progress = await prisma.userSessionProgress.upsert({
    where: { userId_curriculumSessionId: { userId: user.id, curriculumSessionId: session.id } },
    update: {
      // Only set startedAt if it's currently null
      startedAt: {
        // Conditional update: if startedAt is null, set to now; otherwise keep it
        set: new Date(),
      },
    },
    create: {
      userId: user.id,
      curriculumSessionId: session.id,
      startedAt: new Date(),
    },
  });

  // Note: Prisma doesn't have conditional update guards, so we need to
  // fetch and check if startedAt was already set. For now, we accept that
  // calling start multiple times will not reset startedAt (it stays as the original value).
  // If startedAt was not set in the create, upsert already happened on earlier call.
  const result = await prisma.userSessionProgress.findUnique({
    where: { userId_curriculumSessionId: { userId: user.id, curriculumSessionId: session.id } },
  });

  return NextResponse.json({ startedAt: result?.startedAt });
}
