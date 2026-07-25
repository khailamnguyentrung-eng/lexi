import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { parseJsonBody } from "@/lib/api/parseJsonBody";
import { submitAnswer, MockTestStateError } from "@/lib/services/mocktest/attempts";
import type { QuestionResponse } from "@/lib/services/question-format";

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { questionId, response, timeSpentSec } = body as Record<string, unknown>;
  if (typeof questionId !== "string" || response === null || typeof response !== "object") {
    return NextResponse.json({ error: "questionId and response are required" }, { status: 400 });
  }
  const timeSpent =
    typeof timeSpentSec === "number" && Number.isFinite(timeSpentSec) && timeSpentSec >= 0
      ? Math.round(timeSpentSec)
      : null;

  try {
    // No correctness in the response — deliberate, see submitAnswer's docstring.
    await submitAnswer(user.id, attemptId, questionId, response as QuestionResponse, timeSpent);
    return NextResponse.json({ recorded: true });
  } catch (err) {
    if (err instanceof MockTestStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
