import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isFinalStage, nextReviewDate } from "@/lib/services/errorNotebook";
import { parseJsonBody } from "@/lib/api/parseJsonBody";

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

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if ((body as Record<string, unknown>).action === "mark_reviewed") {
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

  const patch = body as Record<string, unknown>;
  const VALID_STATUSES = ["OPEN", "REVIEWING", "MASTERED"] as const;
  const status: (typeof VALID_STATUSES)[number] | typeof entry.status =
    typeof patch.status === "string" &&
    (VALID_STATUSES as readonly string[]).includes(patch.status)
      ? (patch.status as (typeof VALID_STATUSES)[number])
      : entry.status;

  const updated = await prisma.errorNotebookEntry.update({
    where: { id },
    data: {
      reason: typeof patch.reason === "string" && patch.reason ? patch.reason : entry.reason,
      concept: typeof patch.concept === "string" && patch.concept ? patch.concept : entry.concept,
      status,
    },
  });
  return NextResponse.json({ entry: updated });
}
