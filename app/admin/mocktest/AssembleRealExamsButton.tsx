"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AssembleResult {
  created: { title: string; totalQuestions: number; timeLimitMin: number }[];
  skipped: { title: string; reason: string }[];
}

export function AssembleRealExamsButton() {
  const router = useRouter();
  const [result, setResult] = useState<AssembleResult | null>(null);
  const [running, setRunning] = useState(false);

  async function handleClick() {
    setRunning(true);
    const res = await fetch("/api/admin/mocktest/assemble", { method: "POST" });
    const data = await res.json();
    setResult(data);
    setRunning(false);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={running}
        className="rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {running ? "Đang tạo đề..." : "Tạo đề từ nguồn thật"}
      </button>
      {result && (
        <div className="mt-2 rounded-xl bg-zinc-50 p-3 text-xs">
          <p>
            Đã tạo <strong>{result.created.length}</strong> đề mới.
          </p>
          {result.created.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {result.created.map((c) => (
                <li key={c.title}>
                  {c.title} — {c.totalQuestions} câu, {c.timeLimitMin} phút
                </li>
              ))}
            </ul>
          )}
          {result.skipped.length > 0 && (
            <div className="mt-2 text-zinc-500">
              <p className="font-medium">Bỏ qua ({result.skipped.length}):</p>
              <ul className="list-disc pl-4">
                {result.skipped.map((s) => (
                  <li key={s.title}>
                    {s.title} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
