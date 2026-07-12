"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LensSelector, type SelectionRect } from "./LensSelector";

export interface CapturedImage {
  base64: string;
  widthPx: number;
  heightPx: number;
}

interface LensOverlayProps {
  onCapture: (image: CapturedImage) => void;
  onClose: () => void;
}

type SnapshotPhase = "loading" | "ready" | "error";

export function LensOverlay({ onCapture, onClose }: LensOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionRef = useRef<SelectionRect | null>(null);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<SnapshotPhase>("loading");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function run() {
      setPhase("loading");
      setSnapshotUrl(null);
      setCanvasSize(null);
      snapshotCanvasRef.current = null;
      selectionRef.current = null;
      setHasSelection(false);

      try {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(document.body, {
          x: window.scrollX,
          y: window.scrollY,
          width: window.innerWidth,
          height: window.innerHeight,
          useCORS: true,
          allowTaint: false,
          scale: 1,
          logging: false,
          ignoreElements: (el: Element) =>
            overlayRef.current !== null &&
            (el === overlayRef.current || overlayRef.current.contains(el)),
        });

        if (cancelled) return;
        snapshotCanvasRef.current = canvas;
        setSnapshotUrl(canvas.toDataURL("image/png"));
        setCanvasSize({ w: canvas.width, h: canvas.height });
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [mounted, retryCount]);

  function handleSelectionChange(rect: SelectionRect | null) {
    selectionRef.current = rect;
    setHasSelection(rect !== null && rect.width >= MIN_CAPTURE && rect.height >= MIN_CAPTURE);
  }

  function handleAnalyze() {
    const sel = selectionRef.current;
    const srcCanvas = snapshotCanvasRef.current;
    if (!sel || !srcCanvas) return;

    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(sel.width));
    crop.height = Math.max(1, Math.round(sel.height));
    const ctx = crop.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      srcCanvas,
      Math.round(sel.x), Math.round(sel.y), Math.round(sel.width), Math.round(sel.height),
      0, 0, crop.width, crop.height,
    );

    const base64 = crop.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    onCapture({ base64, widthPx: crop.width, heightPx: crop.height });
  }

  function handleRetry() {
    setRetryCount(c => c + 1);
  }

  if (!mounted) return null;

  const content = (
    <div ref={overlayRef} className="fixed inset-0 z-[9999]" style={{ userSelect: "none" }}>

      {/* × close — always visible */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-zinc-700 shadow-md hover:bg-white"
        aria-label="Đóng"
      >
        ×
      </button>

      {/* Loading */}
      {phase === "loading" && (
        <div className="flex h-full items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <p className="text-sm">Đang tải...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="flex h-full items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-xl">
            <p className="font-semibold text-foreground">Không thể chụp vùng này</p>
            <p className="text-sm text-zinc-500">Trình duyệt không cho phép chụp màn hình tại đây.</p>
            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                className="rounded-full bg-lexi-primary px-5 py-2 text-sm font-semibold text-white hover:bg-lexi-primary-dark"
              >
                Thử lại
              </button>
              <button
                onClick={onClose}
                className="rounded-full border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:border-zinc-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ready — snapshot + selector */}
      {phase === "ready" && snapshotUrl && canvasSize && (
        <div className="relative overflow-hidden" style={{ width: canvasSize.w, height: canvasSize.h }}>
          <img
            src={snapshotUrl}
            alt=""
            draggable={false}
            style={{ width: canvasSize.w, height: canvasSize.h, display: "block" }}
          />
          <LensSelector
            key={retryCount}
            containerWidth={canvasSize.w}
            containerHeight={canvasSize.h}
            onChange={handleSelectionChange}
          />
        </div>
      )}

      {/* Toolbar */}
      {phase === "ready" && (
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3">
          {hasSelection ? (
            <button
              onClick={handleAnalyze}
              className="rounded-full bg-lexi-primary px-7 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-lexi-primary-dark"
            >
              Phân tích
            </button>
          ) : (
            <div className="rounded-full bg-black/50 px-4 py-2.5 text-sm text-white shadow">
              Kéo để chọn vùng cần hỏi
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

const MIN_CAPTURE = 20;
