import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseJsonBody } from "@/lib/api/parseJsonBody";
import {
  getQuestionPayload,
  gradeResponse,
  type QuestionFormatFields,
  type QuestionResponse,
  type SingleChoiceResponse,
} from "@/lib/services/question-format";

// A duplicate submission (double-click, retried request) within this window
// is treated as the same attempt rather than recorded twice — prevents
// double-submits from skewing skill-matrix and SM-2 accuracy calculations.
const DUPLICATE_WINDOW_MS = 5000;

/**
 * `QuestionAttempt.selectedOption` is a legacy, required NOT NULL string
 * column several analytics readers still assume is a bare "A"/"B"/"C"/"D"
 * letter (lib/analytics/sessionAnalytics.ts, contracts.ts, repository.ts —
 * all typed `selectedOption: string // A/B/C/D`). For SINGLE_CHOICE, this
 * keeps writing exactly that, so those readers see zero behaviour change.
 * For every other format there is no letter to write — storing one would be
 * fabricated, and storing the full response JSON here would look like a
 * plausible-but-wrong letter to a reader that doesn't check `responseFormat`
 * first. A bracketed format tag is neither: unmistakably not an option
 * letter, so a reader assuming A-D fails legibly instead of silently
 * misreading it as an answer. QM-1 already flagged that a proper analytics
 * reform for non-MCQ formats is real, separate follow-up work
 * (docs/QUESTION_MODEL_REFORM.md §7) — not attempted here.
 */
function deriveLegacySelectedOption(
  responseFormat: QuestionFormatFields["responseFormat"],
  response: QuestionResponse
): string {
  if (responseFormat === "SINGLE_CHOICE") {
    return (response as SingleChoiceResponse)?.optionId ?? "";
  }
  return `[${responseFormat}]`;
}

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

  const { response, timeSpentSec, curriculumSessionId } = body as Record<string, unknown>;
  if (response === null || typeof response !== "object") {
    return NextResponse.json({ error: "response must be an object" }, { status: 400 });
  }

  const payload = getQuestionPayload(question as unknown as QuestionFormatFields);
  if (!payload) {
    // A stored payload that fails validation, or a non-SINGLE_CHOICE question
    // with no payload at all — either way there is nothing gradeable here.
    // Surfacing this as a 500 rather than silently grading "wrong" (which
    // would look like a real graded attempt, not a data problem).
    return NextResponse.json({ error: "Question has no gradeable payload" }, { status: 500 });
  }

  const sessionId = typeof curriculumSessionId === "string" ? curriculumSessionId : null;
  const timeSpent =
    typeof timeSpentSec === "number" && Number.isFinite(timeSpentSec) && timeSpentSec >= 0
      ? Math.round(timeSpentSec)
      : null;

  const grade = gradeResponse(question.responseFormat, payload, response as QuestionResponse);
  const selectedOption = deriveLegacySelectedOption(question.responseFormat, response as QuestionResponse);

  // Wrapped in a transaction so the check-then-create is atomic under SQLite's
  // exclusive write-lock — without this, two truly concurrent requests (e.g.
  // a programmatic double-fire, not just a slow double-click) can both pass
  // the check before either commits, creating two rows for one submission.
  const result = await prisma.$transaction(async (tx) => {
    const recent = await tx.questionAttempt.findFirst({
      where: {
        userId: user.id,
        questionId: question.id,
        curriculumSessionId: sessionId,
        attemptedAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { attemptedAt: "desc" },
    });

    if (recent) return { isCorrect: recent.isCorrect, score: recent.score ?? (recent.isCorrect ? 1 : 0) };

    await tx.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption,
        response: JSON.stringify(response),
        isCorrect: grade.isCorrect,
        score: grade.score,
        timeSpentSec: timeSpent,
        curriculumSessionId: sessionId,
      },
    });
    return { isCorrect: grade.isCorrect, score: grade.score };
  });

  return NextResponse.json({
    isCorrect: result.isCorrect,
    score: result.score,
    detail: grade.detail ?? null,
    // The full answer-bearing payload — safe only now, post-submission. The
    // client reads whichever fields its format needs (correctOptionId,
    // correctOptionIds, blanks[].acceptedAnswers, correctPairs, correctOrder).
    correctPayload: payload,
    explanationVi: question.explanationVi,
    commonMistake: question.commonMistake,
    concept: question.topic,
  });
}
