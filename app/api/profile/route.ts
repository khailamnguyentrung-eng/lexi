import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseJsonBody } from "@/lib/api/parseJsonBody";

// Scores are on the same 0–10 scale as DiagnosticTest's grammar/vocabulary/reading scores.
function isValidScore(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 10;
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { targetScore, currentScore, strengths, weaknesses } = body as Record<string, unknown>;

  // targetScore is a required Float column — undefined (not provided) is fine,
  // but null or an out-of-range value is not.
  let parsedTarget: number | undefined;
  if (targetScore !== undefined) {
    const n = Number(targetScore);
    if (!isValidScore(n)) {
      return NextResponse.json({ error: "targetScore must be a number between 0 and 10." }, { status: 400 });
    }
    parsedTarget = n;
  }

  // currentScore is a nullable Float column — null explicitly clears it.
  let parsedCurrent: number | null | undefined;
  if (currentScore !== undefined) {
    if (currentScore === null) {
      parsedCurrent = null;
    } else {
      const n = Number(currentScore);
      if (!isValidScore(n)) {
        return NextResponse.json({ error: "currentScore must be a number between 0 and 10." }, { status: 400 });
      }
      parsedCurrent = n;
    }
  }

  const profile = await prisma.learnerProfile.update({
    where: { userId: user.id },
    data: {
      targetScore: parsedTarget,
      currentScore: parsedCurrent,
      strengths: strengths !== undefined ? JSON.stringify(strengths) : undefined,
      weaknesses: weaknesses !== undefined ? JSON.stringify(weaknesses) : undefined,
    },
  });

  return NextResponse.json({ profile });
}
