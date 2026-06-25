import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isFinalStage, nextReviewDate } from "@/lib/services/errorNotebook";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.errorNotebookEntry.findFirst({
    where: { id, userId: user.id },
    include: { question: true },
  });

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.errorNotebookEntry.findFirst({ where: { id, userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  if (body.action === "mark_reviewed") {
    const wasFinalStage = isFinalStage(entry.reviewStage);
    const newStage = Math.min(entry.reviewStage + 1, 4);

    const updated = await prisma.errorNotebookEntry.update({
      where: { id },
      data: {
        reviewStage: newStage,
        lastReviewedAt: new Date(),
        nextReviewAt: wasFinalStage ? null : nextReviewDate(newStage),
        status: wasFinalStage ? "MASTERED" : "REVIEWING",
      },
    });
    return NextResponse.json({ entry: updated });
  }

  const updated = await prisma.errorNotebookEntry.update({
    where: { id },
    data: {
      reason: body.reason ?? entry.reason,
      concept: body.concept ?? entry.concept,
      status: body.status ?? entry.status,
    },
  });
  return NextResponse.json({ entry: updated });
}
