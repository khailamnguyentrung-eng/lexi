"use client";

import { useState } from "react";
import type { LensResponse, AssistanceStyle } from "@/lib/services/lens-ai/types";

const STYLE_LABEL: Record<AssistanceStyle, string> = {
  GUIDED_STEPS: "Hướng dẫn từng bước",
  VOCABULARY_MEANING: "Từ vựng",
  CONCEPT_EXPLANATION: "Giải thích",
  SUMMARY: "Tóm tắt",
  GENERAL_HELP: "Giải đáp",
};

type PanelStatus = "idle" | "loading" | "result" | "error";

interface LensAssistPanelProps {
  /** Text to pre-fill the input when the panel opens — e.g. the current question. */
  prefillText?: string;
}

export function LensAssistPanel({ prefillText }: LensAssistPanelProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [result, setResult] = useState<LensResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function openPanel() {
    setOpen(true);
    setInputText(prefillText ?? "");
    setStatus("idle");
    setResult(null);
    setErrorMsg(null);
  }

  function closePanel() {
    setOpen(false);
  }

  function reset() {
    setStatus("idle");
    setInputText(prefillText ?? "");
    setResult(null);
    setErrorMsg(null);
  }

  async function handleAsk() {
    const text = inputText.trim();
    if (!text) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/lens-ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Lỗi HTTP ${res.status}`);
      }
      const data = await res.json() as LensResponse;
      setResult(data);
      setStatus("result");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Trigger */}
      <button
        onClick={open ? closePanel : openPanel}
        className="self-start rounded-full border border-lexi-primary px-3 py-1.5 text-xs font-medium text-lexi-primary-dark transition hover:bg-lexi-soft"
      >
        🔍 {open ? "Đóng Lens" : "Hỏi Lens"}
      </button>

      {/* Panel */}
      {open && (
        <div className="rounded-2xl border border-lexi-primary/20 bg-lexi-soft p-4 text-sm">

          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-lexi-primary-dark">
            LEXI Lens
          </p>

          {/* ── Input ─────────────────────────────────────────────── */}
          {(status === "idle" || status === "loading" || status === "error") && (
            <div className="flex flex-col gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhập nội dung bạn muốn hỏi..."
                rows={3}
                disabled={status === "loading"}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-lexi-primary disabled:opacity-60"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAsk}
                  disabled={status === "loading" || !inputText.trim()}
                  className="rounded-full bg-lexi-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-lexi-primary-dark disabled:opacity-50"
                >
                  {status === "loading" ? "Đang hỏi..." : "Hỏi"}
                </button>
                {status === "error" && errorMsg && (
                  <p className="text-xs text-rose-600">{errorMsg}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Result ────────────────────────────────────────────── */}
          {status === "result" && result && (
            <div className="flex flex-col gap-3">

              {/* Assistance style badge */}
              {result.assistanceStyle && (
                <span className="inline-block self-start rounded-full bg-lexi-primary/10 px-2.5 py-0.5 text-xs font-medium text-lexi-primary-dark">
                  {STYLE_LABEL[result.assistanceStyle]}
                </span>
              )}

              {/* Guided steps */}
              {result.steps && result.steps.length > 0 ? (
                <ol className="flex flex-col gap-2.5">
                  {result.steps.map((step) => (
                    <li key={step.stepNumber} className="flex gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lexi-primary text-[10px] font-bold text-white">
                        {step.stepNumber}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{step.instruction}</span>
                        {step.reasoning && (
                          <span className="text-xs text-zinc-500">{step.reasoning}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : result.explanation ? (
                <p className="leading-relaxed text-foreground">{result.explanation}</p>
              ) : null}

              {/* Related topics */}
              {result.relatedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.relatedTopics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {/* Quality warnings */}
              {result.flags.includes("OCR_CONFIDENCE_LOW") && (
                <p className="text-xs text-amber-700">
                  Chất lượng hình ảnh thấp — kết quả có thể chưa chính xác.
                </p>
              )}
              {result.flags.includes("AI_PARSE_ERROR") && (
                <p className="text-xs text-zinc-500">
                  Lens không chắc về câu trả lời — hãy kiểm tra lại.
                </p>
              )}

              {/* Ask again */}
              <button
                onClick={reset}
                className="self-start rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition hover:border-zinc-400"
              >
                Hỏi lại
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
