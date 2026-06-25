import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { selectedOption, timeSpentSec, curriculumSessionId } = await request.json();
  const isCorrect = selectedOption === question.correctOption;

  await prisma.questionAttempt.create({
    data: {
      userId: user.id,
      questionId: question.id,
      selectedOption,
      isCorrect,
      timeSpentSec: timeSpentSec ?? null,
      curriculumSessionId: curriculumSessionId ?? null,
    },
  });

  return NextResponse.json({
    isCorrect,
    correctOption: question.correctOption,
    explanationVi: question.explanationVi,
    commonMistake: question.commonMistake,
    concept: question.topic,
  });
}
