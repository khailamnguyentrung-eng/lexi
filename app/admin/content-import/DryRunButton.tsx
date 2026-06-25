"use client";

import { useState } from "react";
import { RunReportPanel } from "./RunReportPanel";
import type { AIRunReport } from "@/lib/services/content-import/runReport";

interface BatchResult {
  batchIndex: number;
  label: string;
  rawTextLength: number;
  drafts: { draft: Record<string, unknown>; isValid: boolean; errors: string[] }[];
  error: string | null;
  oversizedChunkWarning: boolean;
  retryCount: number;
  processingTimeMs: number;
}

interface DryRunResult {
  report: AIRunReport;
  batches: BatchResult[];
  totalDrafts: number;
  validCount: number;
  invalidCount: number;
  failedBatchCount: number;
  duplicateQuestionCodesAcrossBatches: string[];
}

export function DryRunButton({ contentSourceId }: { contentSourceId: string }) {
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/admin/content-sources/${contentSourceId}/normalize-dry-run`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Lỗi không xác định");
      setRunning(false);
      return;
    }
    setResult(data);
    setRunning(false);
  }

  const sampleDrafts = result?.batches.flatMap((b) => b.drafts.filter((d) => d.isValid)).slice(0, 3) ?? [];

  return (
    <div className="mt-2">
      <button
        onClick={handleClick}
        disabled={running}
        className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-60"
      >
        {running ? "Đang chạy thử toàn bộ đề..." : "Chạy thử toàn bộ đề bằng AI (dry run — không lưu)"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-medium">Dry run — KHÔNG tạo Question hoặc lưu draft nào.</p>
          <RunReportPanel report={result.report} />
          <ul className="mt-2 list-disc pl-4">
            <li>Số batch lỗi hoàn toàn: {result.failedBatchCount} / {result.batches.length}</li>
            <li>
              QuestionCode trùng giữa các batch: {result.duplicateQuestionCodesAcrossBatches.length || "không có"}
              {result.duplicateQuestionCodesAcrossBatches.length > 0 &&
                ` (${result.duplicateQuestionCodesAcrossBatches.join(", ")})`}
            </li>
          </ul>

          <div className="mt-3 flex flex-col gap-2">
            {result.batches.map((b) => (
              <div key={b.batchIndex} className="rounded-xl bg-white p-3">
                <p className="font-medium text-zinc-700">
                  Batch {b.batchIndex} — {b.label} ({b.rawTextLength} ký tự
                  {b.oversizedChunkWarning ? ", ⚠ lớn hơn ngưỡng cảnh báo" : ""})
                </p>
                {b.error ? (
                  <p className="mt-1 text-rose-600">Lỗi batch: {b.error}</p>
                ) : (
                  <p className="mt-1 text-zinc-600">
                    {b.drafts.length} câu — {b.drafts.filter((d) => d.isValid).length} hợp lệ,{" "}
                    {b.drafts.filter((d) => !d.isValid).length} không hợp lệ · thử lại JSON: {b.retryCount} ·{" "}
                    {(b.processingTimeMs / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
            ))}
          </div>

          {sampleDrafts.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-medium text-zinc-700">
                Xem mẫu kết quả ({sampleDrafts.length} câu hợp lệ đầu tiên)
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-zinc-700">
                {JSON.stringify(sampleDrafts.map((d) => d.draft), null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
