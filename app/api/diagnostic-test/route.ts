import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { estimateLevel } from "@/lib/services/diagnosticTest";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const latest = await prisma.diagnosticTest.findFirst({
    where: { userId: user.id },
    orderBy: { takenAt: "desc" },
  });

  return NextResponse.json({ diagnosticTest: latest });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const grammarScore = Number(body.grammarScore);
  const vocabularyScore = Number(body.vocabularyScore);
  const readingScore = Number(body.readingScore);

  if ([grammarScore, vocabularyScore, readingScore].some((n) => Number.isNaN(n) || n < 0 || n > 10)) {
    return NextResponse.json({ error: "Scores must be numbers between 0 and 10." }, { status: 400 });
  }

  const estimatedLevel = estimateLevel(grammarScore, vocabularyScore, readingScore);

  const diagnosticTest = await prisma.diagnosticTest.create({
    data: { userId: user.id, grammarScore, vocabularyScore, readingScore, estimatedLevel },
  });

  // Diagnostic average becomes the profile's baseline score if none set yet.
  const average = (grammarScore + vocabularyScore + readingScore) / 3;
  await prisma.learnerProfile.update({
    where: { userId: user.id },
    data: { diagnosticScore: average },
  });

  return NextResponse.json({ diagnosticTest }, { status: 201 });
}
