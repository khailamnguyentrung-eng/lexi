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

    // RV-1 (Ch.3 §3.3 Inv 5 / §3.1 "Consumed"): the learner's own response to a
    // due review is recorded as append-only Evidence. Additive by design — the
    // in-place retention update above is an Understanding-layer projection and
    // stays as-is. Values come from `entry`, fetched before the update, so they
    // are the true pre-review state; `concept` is snapshotted because the
    // non-review branch below can edit it later.
    //
    // Never blocks the learner (Constitution 5.4): the learner's "I reviewed
    // this" must take effect even if recording it fails, so a write failure
    // leaves an Evidence gap rather than failing the action. Logged, not thrown.
    try {
      await prisma.reviewEngagement.create({
        data: {
          userId: user.id,
          errorNotebookEntryId: id,
          concept: entry.concept,
          reviewStageBefore: entry.reviewStage,
          reviewStageAfter: newStage,
          reachedMastery: wasFinalStage,
        },
      });
    } catch (err) {
      console.error("[RV-1] Failed to record ReviewEngagement Evidence", err);
    }

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
