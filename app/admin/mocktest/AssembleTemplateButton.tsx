"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AssembleResult {
  templateId: string;
  totalQuestions: number;
  shortfalls: { type: string; needed: number; available: number }[];
}

export function AssembleTemplateButton() {
  const router = useRouter();
  const [result, setResult] = useState<AssembleResult | null>(null);
  const [running, setRunning] = useState(false);

  async function handleClick() {
    setRunning(true);
    const res = await fetch("/api/admin/mocktest/assemble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Thi thử vào 10 — Hà Nội" }),
    });
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
        {running ? "Đang tạo đề..." : "Tạo đề theo khung Hà Nội (examBlueprint.ts)"}
      </button>
      {result && (
        <div className="mt-2 rounded-xl bg-zinc-50 p-3 text-xs">
          <p>
            Đã tạo đề <strong>{result.totalQuestions}</strong> câu.
          </p>
          {result.shortfalls.length > 0 && (
            <div className="mt-1 text-amber-700">
              <p className="font-medium">⚠️ Thiếu câu ở một số phần (ngân hàng chưa đủ):</p>
              <ul className="list-disc pl-4">
                {result.shortfalls.map((s) => (
                  <li key={s.type}>
                    {s.type}: cần {s.needed}, chỉ có {s.available}
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
