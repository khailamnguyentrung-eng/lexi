"use client";

import { useState } from "react";
import type { LensResponse } from "@/lib/services/lens-ai/types";
import { LensButton } from "./LensButton";
import { LensOverlay, type CapturedImage } from "./LensOverlay";
import { LensResultCard } from "./LensResultCard";

type LensPhase =
  | { type: "idle" }
  | { type: "capturing" }
  | { type: "analyzing"; imageData: CapturedImage }
  | { type: "result"; response: LensResponse }
  | { type: "error"; message: string; imageData: CapturedImage };

export function LensFloatingAssistant() {
  const [phase, setPhase] = useState<LensPhase>({ type: "idle" });

  async function analyze(imageData: CapturedImage) {
    setPhase({ type: "analyzing", imageData });
    try {
      const res = await fetch("/api/lens-ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: {
            base64: imageData.base64,
            widthPx: imageData.widthPx,
            heightPx: imageData.heightPx,
          },
          mimeType: "image/png",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Lỗi ${res.status}`);
      }

      const response = await res.json() as LensResponse;
      setPhase({ type: "result", response });
    } catch (err) {
      setPhase({
        type: "error",
        message: err instanceof Error ? err.message : "Đã xảy ra lỗi",
        imageData,
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Trigger */}
      {phase.type === "idle" && (
        <LensButton onClick={() => setPhase({ type: "capturing" })} />
      )}

      {/* Capture overlay — portal, no inline space consumed */}
      {phase.type === "capturing" && (
        <LensOverlay
          onCapture={(img) => analyze(img)}
          onClose={() => setPhase({ type: "idle" })}
        />
      )}

      {/* Analyzing */}
      {phase.type === "analyzing" && (
        <div className="flex items-center gap-2 rounded-2xl border border-lexi-primary/20 bg-lexi-soft px-4 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-lexi-primary border-t-transparent" />
          <span className="text-xs text-lexi-primary-dark">Lexi đang phân tích...</span>
        </div>
      )}

      {/* Result */}
      {phase.type === "result" && (
        <LensResultCard
          response={phase.response}
          onContinue={() => setPhase({ type: "idle" })}
          onRetry={() => setPhase({ type: "capturing" })}
        />
      )}

      {/* API error */}
      {phase.type === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm">
          <p className="font-medium text-rose-700">Lexi không thể phân tích được</p>
          <p className="mt-1 text-xs text-rose-600">{phase.message}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => analyze(phase.imageData)}
              className="rounded-full bg-lexi-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-lexi-primary-dark"
            >
              Thử lại
            </button>
            <button
              onClick={() => setPhase({ type: "idle" })}
              className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs text-zinc-600 hover:border-zinc-300"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
