"use client";

import { useState } from "react";
import { RunReportPanel } from "./RunReportPanel";
import { EvaluationChecklist } from "./EvaluationChecklist";
import { DraftAnswerSummary } from "./DraftAnswerSummary";
import type { AIRunReport } from "@/lib/services/content-import/runReport";

interface SampleDraft {
  id: string;
  normalizedData: string;
  reviewStatus: string;
  reviewNote: string | null;
}

interface SampleResult {
  job: { rawExtractedText: string | null; drafts: SampleDraft[] };
  report: AIRunReport;
}

export function SampleTestButton({ contentSourceId }: { contentSourceId: string }) {
  const [result, setResult] = useState<SampleResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/admin/content-sources/${contentSourceId}/normalize-sample`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Lỗi không xác định");
      setRunning(false);
      return;
    }
    setResult(data);
    setRunning(false);
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={running}
        className="rounded-full border border-lexi-primary px-3 py-1.5 text-xs font-medium text-lexi-primary-dark disabled:opacity-60"
      >
        {running ? "Đang chạy mẫu AI..." : "Chạy mẫu AI (5 câu đầu)"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {result && (
        <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-xs">
          <RunReportPanel report={result.report} />

          <details className="mt-2">
            <summary className="cursor-pointer font-medium text-zinc-600">
              Văn bản trích xuất (5 câu đầu — đối chiếu với kết quả AI bên dưới)
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-zinc-700">
              {result.job.rawExtractedText}
            </pre>
          </details>

          <div className="mt-3 flex flex-col gap-2">
            {result.job.drafts.map((d) => {
              const draft = JSON.parse(d.normalizedData);
              const isRejected = d.reviewStatus === "REJECTED";
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border p-3 ${isRejected ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}
                >
                  <p className="font-medium">
                    {draft.questionCode} — {isRejected ? "❌ Không hợp lệ" : "✅ Hợp lệ (chờ duyệt)"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    topic: {draft.topic} · skill: {draft.skill} · difficulty:{" "}
                    {draft.difficulty}
                  </p>
                  <p className="mt-1 text-zinc-700">{draft.promptText}</p>
                  <DraftAnswerSummary responseFormat={draft.responseFormat} payload={draft.payload} />
                  <p className="mt-1 text-zinc-600">Giải thích: {draft.explanationVi}</p>
                  {draft.learningObjective && (
                    <p className="mt-1 text-zinc-500">Mục tiêu học: {draft.learningObjective}</p>
                  )}
                  {d.reviewNote && <p className="mt-1 text-rose-700">{d.reviewNote}</p>}
                </div>
              );
            })}
          </div>

          <EvaluationChecklist allValid={result.job.drafts.every((d) => d.reviewStatus !== "REJECTED")} />
        </div>
      )}
    </div>
  );
}
