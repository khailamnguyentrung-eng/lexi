"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartMockTestButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    const res = await fetch(`/api/mocktest/templates/${templateId}/start`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      router.push(`/mocktest/attempt/${data.attemptId}`);
    } else {
      setStarting(false);
    }
  }

  return (
    <button
      onClick={handleStart}
      disabled={starting}
      className="rounded-full bg-lexi-primary px-5 py-2 text-xs font-semibold text-white hover:bg-lexi-primary-dark disabled:opacity-50"
    >
      {starting ? "Đang chuẩn bị..." : "Bắt đầu thi thử"}
    </button>
  );
}
