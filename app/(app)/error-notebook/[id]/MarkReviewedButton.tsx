"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkReviewedButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch(`/api/error-notebook/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_reviewed" }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-xl bg-lexi-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {loading ? "Đang lưu..." : "Mình đã hiểu rồi, ôn xong!"}
    </button>
  );
}
