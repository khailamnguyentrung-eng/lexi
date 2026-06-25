"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunExtractionButton({ contentSourceId }: { contentSourceId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function handleClick() {
    setRunning(true);
    await fetch(`/api/admin/content-sources/${contentSourceId}/extract`, { method: "POST" });
    setRunning(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={running}
      className="rounded-full bg-lexi-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-lexi-primary-dark disabled:opacity-60"
    >
      {running ? "Đang trích xuất..." : "Chạy trích xuất"}
    </button>
  );
}
