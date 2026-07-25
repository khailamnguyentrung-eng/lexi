import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startAttempt } from "@/lib/services/mocktest/attempts";

export async function POST(_request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId } = await params;
  const started = await startAttempt(user.id, templateId);
  return NextResponse.json(started);
}
