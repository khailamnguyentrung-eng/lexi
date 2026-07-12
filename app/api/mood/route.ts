import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseJsonBody } from "@/lib/api/parseJsonBody";

const VALID_MOODS = ["GREAT", "GOOD", "OKAY", "TIRED", "STRESSED"] as const;

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

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { mood, note } = body as Record<string, unknown>;

  if (typeof mood !== "string" || !(VALID_MOODS as readonly string[]).includes(mood)) {
    return NextResponse.json({ error: "Invalid mood." }, { status: 400 });
  }

  const entry = await prisma.moodEntry.create({
    data: {
      userId: user.id,
      mood: mood as (typeof VALID_MOODS)[number],
      note: typeof note === "string" && note ? note : null,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
