"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TaxonomyJobResult {
  taxonomyJobId: string;
  sourceReadId: string;
  proposalsCreated: number;
  duplicatesSkipped: number;
  alreadyInRegistry: number;
  rejectedByVerification: number;
  servedBy: "claude" | "gemini" | "mock";
  fallbackReason: string | null;
  retryCount: number;
}

// KU-1 part B, Path A. Mirrors SampleTestButton's shape but reports
// PendingKnowledgeUnit proposals, not question drafts — this never creates a
// Question. servedBy/fallbackReason are surfaced with the same truthfulness
// discipline as AIStatusLine: a Gemini quota failure must show as "Mock served
// this and here's why", never a silent, confident "Gemini ✅".
export function ProposeTaxonomyButton({ contentSourceId }: { contentSourceId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<TaxonomyJobResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/admin/content-sources/${contentSourceId}/propose-taxonomy`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Lỗi không xác định");
      setRunning(false);
      return;
    }
    setResult(data);
    setRunning(false);
    router.refresh(); // so /admin/knowledge-units picks up the new proposals next visit
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={running}
        className="rounded-full border border-lexi-primary px-3 py-1.5 text-xs font-medium text-lexi-primary-dark disabled:opacity-60"
      >
        {running ? "Đang đọc để đề xuất chủ điểm..." : "Đề xuất Knowledge Unit (Path A)"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-xs">
          <p className="font-medium text-zinc-700">
            {result.servedBy === "mock" && result.fallbackReason ? (
              <span className="text-amber-700">⚠️ {result.fallbackReason}</span>
            ) : (
              `Được xử lý bởi: ${result.servedBy}${result.retryCount > 0 ? ` (đã thử lại ${result.retryCount} lần do JSON lỗi)` : ""}`
            )}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-zinc-600">
            <li>✅ Đề xuất mới: {result.proposalsCreated}</li>
            <li>🔁 Trùng với đề xuất đang chờ: {result.duplicatesSkipped}</li>
            <li>📚 Đã có trong danh mục: {result.alreadyInRegistry}</li>
            <li>🚫 Bị loại (trích dẫn không khớp văn bản gốc): {result.rejectedByVerification}</li>
          </ul>
          {result.proposalsCreated > 0 && (
            <p className="mt-2 text-emerald-700">
              Xem và duyệt tại{" "}
              <a href="/admin/knowledge-units" className="underline">
                Knowledge Units
              </a>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
