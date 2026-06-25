import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const VALID_MOODS = ["GREAT", "GOOD", "OKAY", "TIRED", "STRESSED"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.moodEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 7,
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { mood, note } = body;

  if (!VALID_MOODS.includes(mood)) {
    return NextResponse.json({ error: "Invalid mood." }, { status: 400 });
  }

  const entry = await prisma.moodEntry.create({
    data: { userId: user.id, mood, note: note || null },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
