import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assembleContext } from "@/lib/ai/contextAssembler";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.chatSession.findFirst({
    where: { userId: user.id, mode: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ session });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = await assembleContext(user.id);
  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      mode: "TEACHER",
      contextSnapshot: JSON.stringify(context),
    },
    include: { messages: true },
  });

  return NextResponse.json({ session }, { status: 201 });
}
