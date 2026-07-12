import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nextReviewDate } from "@/lib/services/errorNotebook";
import { parseJsonBody } from "@/lib/api/parseJsonBody";

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

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { questionId, studentAnswer, correctAnswer, reason, concept } = body as Record<string, unknown>;

  if (
    typeof studentAnswer !== "string" || !studentAnswer ||
    typeof correctAnswer !== "string" || !correctAnswer ||
    typeof reason !== "string" || !reason ||
    typeof concept !== "string" || !concept
  ) {
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
      questionId: typeof questionId === "string" ? questionId : null,
      studentAnswer,
      correctAnswer,
      reason,
      concept,
      nextReviewAt: nextReviewDate(0),
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
