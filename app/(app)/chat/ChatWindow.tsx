"use client";

import { useState } from "react";
import Link from "next/link";

interface Message {
  id: string;
  role: string;
  content: string;
}

export function ChatWindow({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const optimisticUser: Message = { id: `tmp-${Date.now()}`, role: "USER", content: input };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setSending(true);

    const res = await fetch(`/api/chat/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: optimisticUser.content }),
    });
    const data = await res.json();

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== optimisticUser.id),
      data.userMessage,
      data.assistantMessage,
    ]);
    setSending(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="rounded-2xl bg-lexi-soft p-3 text-sm text-zinc-600">
            🦄 Chào bạn! Hỏi Lexi bất cứ điều gì về ngữ pháp, từ vựng hay bài học hôm nay nhé.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <div
                className={`rounded-2xl px-4 py-2 text-sm ${
                  m.role === "USER"
                    ? "bg-lexi-primary text-white"
                    : "bg-lexi-soft text-foreground"
                }`}
              >
                {m.content}
              </div>
              {m.role === "ASSISTANT" && !m.id.startsWith("tmp-") && (
                <Link
                  href={`/error-notebook/new?reason=${encodeURIComponent(m.content.slice(0, 280))}`}
                  className="mt-1 inline-block text-xs text-zinc-400 hover:text-lexi-primary-dark"
                >
                  Ghi lại lỗi này vào sổ
                </Link>
              )}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-zinc-400">Lexi đang trả lời...</p>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-zinc-100 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi cho Lexi..."
          className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-lexi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-lexi-primary-dark disabled:opacity-60"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
