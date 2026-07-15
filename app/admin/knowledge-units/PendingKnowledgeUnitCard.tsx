"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ExistingKnowledgeUnit {
  id: string;
  topic: string;
  label: string;
}

interface PendingProposal {
  id: string;
  proposedTopic: string;
  proposedLabel: string;
  evidenceQuote: string;
  evidenceLocation: string | null;
  contentSource: { fileName: string; sourceLabel: string | null };
}

export function PendingKnowledgeUnitCard({
  proposal,
  existingUnits,
}: {
  proposal: PendingProposal;
  existingUnits: ExistingKnowledgeUnit[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "rename" | "merge">("idle");
  const [topic, setTopic] = useState(proposal.proposedTopic);
  const [label, setLabel] = useState(proposal.proposedLabel);
  const [mergeTargetId, setMergeTargetId] = useState(existingUnits[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body?: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Lỗi ${res.status}`);
      setBusy(false);
      return false;
    }
    setBusy(false);
    router.refresh();
    return true;
  }

  async function handleApprove() {
    await call(`/api/admin/pending-knowledge-units/${proposal.id}/approve`);
  }

  async function handleApplyRename() {
    const ok = await call(`/api/admin/pending-knowledge-units/${proposal.id}/approve`, { topic, label });
    if (ok) setMode("idle");
  }

  async function handleApplyMerge() {
    if (!mergeTargetId) return;
    const ok = await call(`/api/admin/pending-knowledge-units/${proposal.id}/merge`, {
      targetKnowledgeUnitId: mergeTargetId,
    });
    if (ok) setMode("idle");
  }

  async function handleReject() {
    await call(`/api/admin/pending-knowledge-units/${proposal.id}/reject`);
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{proposal.proposedTopic}</p>
        <p className="text-[11px] text-zinc-400">
          {proposal.contentSource.sourceLabel ?? proposal.contentSource.fileName}
        </p>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{proposal.proposedLabel}</p>

      <div className="mt-2 rounded-xl bg-zinc-50 p-2 text-xs text-zinc-600">
        <p className="font-medium text-zinc-400">Bằng chứng từ nguồn:</p>
        <p className="mt-0.5 italic">&ldquo;{proposal.evidenceQuote}&rdquo;</p>
        {proposal.evidenceLocation && <p className="mt-0.5 text-zinc-400">{proposal.evidenceLocation}</p>}
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {mode === "idle" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="rounded-full bg-lexi-success px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            Duyệt (tạo KU mới)
          </button>
          <button
            onClick={() => setMode("rename")}
            disabled={busy}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 disabled:opacity-60"
          >
            Đổi tên rồi duyệt
          </button>
          {existingUnits.length > 0 && (
            <button
              onClick={() => setMode("merge")}
              disabled={busy}
              className="rounded-full border border-lexi-primary-dark px-3 py-1.5 text-xs font-medium text-lexi-primary-dark disabled:opacity-60"
            >
              Gộp vào KU có sẵn
            </button>
          )}
          <button
            onClick={handleReject}
            disabled={busy}
            className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-60"
          >
            Từ chối
          </button>
        </div>
      )}

      {mode === "rename" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="topic (snake_case)"
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nhãn hiển thị"
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={handleApplyRename}
              disabled={busy || !topic || !label}
              className="rounded-full bg-lexi-success px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Lưu và duyệt
            </button>
            <button
              onClick={() => setMode("idle")}
              disabled={busy}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {mode === "merge" && (
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
          >
            {existingUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.topic})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleApplyMerge}
              disabled={busy}
              className="rounded-full bg-lexi-primary-dark px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Gộp
            </button>
            <button
              onClick={() => setMode("idle")}
              disabled={busy}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
