"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DraftAnswerSummary } from "./DraftAnswerSummary";

interface DraftPreview {
  promptText: string;
  topic: string;
  responseFormat?: string;
  payload?: string;
}

export function DraftReviewCard({ draftId, data }: { draftId: string; data: DraftPreview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    await fetch(`/api/admin/import-drafts/${draftId}/approve`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  async function handleReject() {
    setBusy(true);
    await fetch(`/api/admin/import-drafts/${draftId}/reject`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{data.topic}</p>
      <p className="mt-1 text-sm text-foreground">{data.promptText}</p>
      <DraftAnswerSummary responseFormat={data.responseFormat} payload={data.payload} />
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="rounded-full bg-lexi-success px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          Duyệt
        </button>
        <button
          onClick={handleReject}
          disabled={busy}
          className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-60"
        >
          Từ chối
        </button>
      </div>
    </div>
  );
}
