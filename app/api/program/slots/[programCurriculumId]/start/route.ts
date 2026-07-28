import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/program/slots/[programCurriculumId]/start
 *
 * Start a Program lesson slot for an authenticated student. Mirrors
 * POST /api/curriculum/sessions/[sessionNumber]/start, keyed directly by
 * the slot's own id rather than a slug+order lookup — same convention
 * POST /api/questions/[id]/attempt already uses for programCurriculumId.
 *
 * Genuinely idempotent: once startedAt is set, calling this again never
 * changes it. (The CurriculumSession equivalent this mirrors did NOT
 * actually have this property until the same change that added this
 * route fixed it — see docs/DECISION_LOG.md.)
 *
 * Response: { startedAt: ISO string | null }
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

  const existing = await prisma.userProgramProgress.findUnique({
    where: { userId_programCurriculumId: { userId: user.id, programCurriculumId } },
  });
  if (existing?.startedAt) {
    return NextResponse.json({ startedAt: existing.startedAt });
  }

  const result = await prisma.userProgramProgress.upsert({
    where: { userId_programCurriculumId: { userId: user.id, programCurriculumId } },
    update: { startedAt: new Date() },
    create: { userId: user.id, programCurriculumId, status: "IN_PROGRESS", startedAt: new Date() },
  });

  return NextResponse.json({ startedAt: result.startedAt });
}
