import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { submitAttempt, MockTestStateError } from "@/lib/services/mocktest/attempts";

export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await params;
  try {
    const results = await submitAttempt(user.id, attemptId);
    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof MockTestStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
