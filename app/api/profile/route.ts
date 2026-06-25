import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { targetScore, currentScore, strengths, weaknesses } = body;

  const profile = await prisma.learnerProfile.update({
    where: { userId: user.id },
    data: {
      targetScore: targetScore !== undefined ? Number(targetScore) : undefined,
      currentScore: currentScore !== undefined ? Number(currentScore) : undefined,
      strengths: strengths !== undefined ? JSON.stringify(strengths) : undefined,
      weaknesses: weaknesses !== undefined ? JSON.stringify(weaknesses) : undefined,
    },
  });

  return NextResponse.json({ profile });
}
