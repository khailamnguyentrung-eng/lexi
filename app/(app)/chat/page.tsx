import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assembleContext } from "@/lib/ai/contextAssembler";
import { getAIProviderStatus } from "@/lib/ai/providers";
import { ChatWindow } from "./ChatWindow";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const aiStatus = getAIProviderStatus();

  let session = await prisma.chatSession.findFirst({
    where: { userId: user.id, mode: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!session) {
    const context = await assembleContext(user.id);
    session = await prisma.chatSession.create({
      data: { userId: user.id, mode: "TEACHER", contextSnapshot: JSON.stringify(context) },
      include: { messages: true },
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col">
      <h1 className="mb-3 text-xl font-semibold text-lexi-primary-dark">Hỏi Lexi</h1>
      {aiStatus.name === "mock" && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          🦄 Lexi đang ở chế độ demo (chưa có AI thật). Bạn vẫn có thể trò chuyện, nhưng câu trả lời sẽ là mẫu.
          {aiStatus.fallbackReason && (
            <span className="mt-1 block text-xs text-amber-700">
              {aiStatus.fallbackReason} (quản trị viên: xem README để cấu hình{" "}
              <code className="rounded bg-amber-100 px-1">GOOGLE_GEMINI_API_KEY</code> hoặc{" "}
              <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code>).
            </span>
          )}
        </div>
      )}
      <ChatWindow
        sessionId={session.id}
        initialMessages={session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))}
      />
    </div>
  );
}
