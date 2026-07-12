import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseJsonBody } from "@/lib/api/parseJsonBody";

const VALID_OPTIONS = ["A", "B", "C", "D"];

// A duplicate submission (double-click, retried request) within this window
// is treated as the same attempt rather than recorded twice — prevents
// double-submits from skewing skill-matrix and SM-2 accuracy calculations.
const DUPLICATE_WINDOW_MS = 5000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { selectedOption, timeSpentSec, curriculumSessionId } = body as Record<string, unknown>;

  if (typeof selectedOption !== "string" || !VALID_OPTIONS.includes(selectedOption)) {
    return NextResponse.json({ error: "selectedOption must be one of A, B, C, D" }, { status: 400 });
  }

  const sessionId = typeof curriculumSessionId === "string" ? curriculumSessionId : null;
  const timeSpent =
    typeof timeSpentSec === "number" && Number.isFinite(timeSpentSec) && timeSpentSec >= 0
      ? Math.round(timeSpentSec)
      : null;

  // Wrapped in a transaction so the check-then-create is atomic under SQLite's
  // exclusive write-lock — without this, two truly concurrent requests (e.g.
  // a programmatic double-fire, not just a slow double-click) can both pass
  // the check before either commits, creating two rows for one submission.
  const isCorrect = await prisma.$transaction(async (tx) => {
    const recent = await tx.questionAttempt.findFirst({
      where: {
        userId: user.id,
        questionId: question.id,
        curriculumSessionId: sessionId,
        attemptedAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { attemptedAt: "desc" },
    });

    if (recent) return recent.isCorrect;

    const correct = selectedOption === question.correctOption;
    await tx.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption,
        isCorrect: correct,
        timeSpentSec: timeSpent,
        curriculumSessionId: sessionId,
      },
    });
    return correct;
  });

  return NextResponse.json({
    isCorrect,
    correctOption: question.correctOption,
    explanationVi: question.explanationVi,
    commonMistake: question.commonMistake,
    concept: question.topic,
  });
}
