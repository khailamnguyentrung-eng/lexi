import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nextReviewDate } from "@/lib/services/errorNotebook";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.errorNotebookEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ nextReviewAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { questionId, studentAnswer, correctAnswer, reason, concept } = body;

  if (!studentAnswer || !correctAnswer || !reason || !concept) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.errorNotebookEntry.findFirst({
    where: { userId: user.id, concept, studentAnswer, status: { not: "MASTERED" } },
  });

  if (existing) {
    const updated = await prisma.errorNotebookEntry.update({
      where: { id: existing.id },
      data: { occurrenceCount: { increment: 1 }, isRemedialFlagged: existing.occurrenceCount + 1 > 2 },
    });
    return NextResponse.json({ entry: updated });
  }

  const entry = await prisma.errorNotebookEntry.create({
    data: {
      userId: user.id,
      questionId: questionId ?? null,
      studentAnswer,
      correctAnswer,
      reason,
      concept,
      nextReviewAt: nextReviewDate(0),
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
