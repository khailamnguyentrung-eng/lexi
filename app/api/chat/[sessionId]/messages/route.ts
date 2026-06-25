import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assembleContext } from "@/lib/ai/contextAssembler";
import { modeRegistry } from "@/lib/ai/modes";
import { LEXI_PERSONA_BASE } from "@/lib/ai/persona";
import { getAIProvider } from "@/lib/ai/providers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content } = await request.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const userMessage = await prisma.chatMessage.create({
    data: { chatSessionId: session.id, role: "USER", content },
  });

  const handler = modeRegistry[session.mode];

  if (!handler.isAvailable) {
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: "ASSISTANT",
        content: "Chế độ này sắp ra mắt! Lexi sẽ sớm có thể giúp bạn ở đây. 🦄",
      },
    });
    return NextResponse.json({ userMessage, assistantMessage });
  }

  const context = await assembleContext(user.id);
  const systemPrompt = `${LEXI_PERSONA_BASE}\n\n${handler.buildSystemPrompt(context)}`;

  const history = [...session.messages, userMessage].map((m) => ({
    role: m.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  try {
    const provider = getAIProvider();
    const replyText = await provider.chat({ system: systemPrompt, messages: history });

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: "ASSISTANT",
        content: replyText || "Lexi chưa nghĩ ra câu trả lời, bạn thử hỏi lại nhé!",
      },
    });

    return NextResponse.json({ userMessage, assistantMessage });
  } catch {
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: "ASSISTANT",
        content: "Lexi đang gặp chút trục trặc, bạn thử lại sau ít phút nhé.",
      },
    });

    return NextResponse.json({ userMessage, assistantMessage });
  }
}
