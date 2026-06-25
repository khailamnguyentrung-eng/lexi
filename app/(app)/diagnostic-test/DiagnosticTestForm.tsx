"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiagnosticTestForm({ latestEstimatedLevel }: { latestEstimatedLevel: string | null }) {
  const router = useRouter();
  const [grammarScore, setGrammarScore] = useState("");
  const [vocabularyScore, setVocabularyScore] = useState("");
  const [readingScore, setReadingScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(latestEstimatedLevel);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/diagnostic-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grammarScore, vocabularyScore, readingScore }),
    });
    if (res.ok) {
      const data = await res.json();
      setResult(data.diagnosticTest.estimatedLevel);
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-zinc-100 bg-white p-6">
      <p className="text-sm text-zinc-600">
        Nhập điểm 3 phần của đề test đầu vào (thang điểm 0-10) để Lexi ước lượng trình độ hiện tại.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Ngữ pháp</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            required
            value={grammarScore}
            onChange={(e) => setGrammarScore(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Từ vựng</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            required
            value={vocabularyScore}
            onChange={(e) => setVocabularyScore(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Đọc hiểu</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            required
            value={readingScore}
            onChange={(e) => setReadingScore(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-xl bg-lexi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-lexi-primary-dark disabled:opacity-60"
      >
        {saving ? "Đang lưu..." : "Lưu kết quả"}
      </button>
      {result && (
        <p className="text-sm text-lexi-primary-dark">
          Trình độ ước lượng hiện tại: <span className="font-semibold">{result}</span>
        </p>
      )}
    </form>
  );
}
