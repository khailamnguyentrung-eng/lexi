"use client";

import { useRef, useState } from "react";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type DragMode = "create" | "move" | `resize-${ResizeHandle}`;

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  initialRect: SelectionRect;
}

const HANDLE_HALF = 6;
const HANDLE_HIT = 14;
const MIN_SIZE = 20;

const HANDLES: Array<{ id: ResizeHandle; fx: number; fy: number; cursor: string }> = [
  { id: "nw", fx: 0,   fy: 0,   cursor: "nw-resize" },
  { id: "n",  fx: 0.5, fy: 0,   cursor: "ns-resize" },
  { id: "ne", fx: 1,   fy: 0,   cursor: "ne-resize" },
  { id: "e",  fx: 1,   fy: 0.5, cursor: "ew-resize" },
  { id: "se", fx: 1,   fy: 1,   cursor: "se-resize" },
  { id: "s",  fx: 0.5, fy: 1,   cursor: "ns-resize" },
  { id: "sw", fx: 0,   fy: 1,   cursor: "sw-resize" },
  { id: "w",  fx: 0,   fy: 0.5, cursor: "ew-resize" },
];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function computeResize(
  mode: `resize-${ResizeHandle}`,
  dx: number,
  dy: number,
  ir: SelectionRect,
  maxW: number,
  maxH: number,
): SelectionRect {
  const { x, y, width, height } = ir;
  switch (mode) {
    case "resize-nw": {
      const nx = clamp(ir.x + dx, 0, ir.x + ir.width - MIN_SIZE);
      const ny = clamp(ir.y + dy, 0, ir.y + ir.height - MIN_SIZE);
      return { x: nx, y: ny, width: ir.x + ir.width - nx, height: ir.y + ir.height - ny };
    }
    case "resize-n": {
      const ny = clamp(ir.y + dy, 0, ir.y + ir.height - MIN_SIZE);
      return { x, y: ny, width, height: ir.y + ir.height - ny };
    }
    case "resize-ne": {
      const ny = clamp(ir.y + dy, 0, ir.y + ir.height - MIN_SIZE);
      return { x, y: ny, width: clamp(ir.width + dx, MIN_SIZE, maxW - x), height: ir.y + ir.height - ny };
    }
    case "resize-e":
      return { x, y, width: clamp(ir.width + dx, MIN_SIZE, maxW - x), height };
    case "resize-se":
      return { x, y, width: clamp(ir.width + dx, MIN_SIZE, maxW - x), height: clamp(ir.height + dy, MIN_SIZE, maxH - y) };
    case "resize-s":
      return { x, y, width, height: clamp(ir.height + dy, MIN_SIZE, maxH - y) };
    case "resize-sw": {
      const nx = clamp(ir.x + dx, 0, ir.x + ir.width - MIN_SIZE);
      return { x: nx, y, width: ir.x + ir.width - nx, height: clamp(ir.height + dy, MIN_SIZE, maxH - y) };
    }
    case "resize-w": {
      const nx = clamp(ir.x + dx, 0, ir.x + ir.width - MIN_SIZE);
      return { x: nx, y, width: ir.x + ir.width - nx, height };
    }
  }
}

interface LensSelectorProps {
  containerWidth: number;
  containerHeight: number;
  onChange: (rect: SelectionRect | null) => void;
}

export function LensSelector({ containerWidth, containerHeight, onChange }: LensSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);

  function getCoords(e: React.PointerEvent): { x: number; y: number } {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function applyRect(rect: SelectionRect) {
    setSelection(rect);
    onChange(rect);
  }

  function hitTestHandle(sel: SelectionRect, cx: number, cy: number): ResizeHandle | null {
    for (const h of HANDLES) {
      const hx = sel.x + h.fx * sel.width;
      const hy = sel.y + h.fy * sel.height;
      if (Math.abs(cx - hx) <= HANDLE_HIT && Math.abs(cy - hy) <= HANDLE_HIT) return h.id;
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCoords(e);

    if (selection) {
      const handle = hitTestHandle(selection, x, y);
      if (handle) {
        dragRef.current = { mode: `resize-${handle}`, startX: x, startY: y, initialRect: { ...selection } };
        return;
      }
      if (x >= selection.x && x <= selection.x + selection.width &&
          y >= selection.y && y <= selection.y + selection.height) {
        dragRef.current = { mode: "move", startX: x, startY: y, initialRect: { ...selection } };
        return;
      }
    }

    dragRef.current = { mode: "create", startX: x, startY: y, initialRect: { x, y, width: 0, height: 0 } };
    setSelection(null);
    onChange(null);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const { x, y } = getCoords(e);
    const { mode, startX, startY, initialRect: ir } = dragRef.current;
    const W = containerWidth;
    const H = containerHeight;

    let rect: SelectionRect;
    if (mode === "create") {
      const left   = clamp(Math.min(startX, x), 0, W);
      const top    = clamp(Math.min(startY, y), 0, H);
      const right  = clamp(Math.max(startX, x), 0, W);
      const bottom = clamp(Math.max(startY, y), 0, H);
      rect = { x: left, y: top, width: right - left, height: bottom - top };
    } else if (mode === "move") {
      rect = {
        x: clamp(ir.x + (x - startX), 0, W - ir.width),
        y: clamp(ir.y + (y - startY), 0, H - ir.height),
        width: ir.width,
        height: ir.height,
      };
    } else {
      rect = computeResize(mode as `resize-${ResizeHandle}`, x - startX, y - startY, ir, W, H);
    }

    applyRect(rect);
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  const sel = selection;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: "crosshair", userSelect: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dim mask outside selection */}
      {sel ? (
        <svg
          className="pointer-events-none absolute inset-0"
          width={containerWidth}
          height={containerHeight}
          style={{ display: "block" }}
        >
          <defs>
            <mask id="lens-sel-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={sel.x} y={sel.y} width={sel.width} height={sel.height} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#lens-sel-mask)" />
        </svg>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
      )}

      {/* Selection rectangle + handles — pointer-events so CSS cursors apply on hover */}
      {sel && (
        <div
          className="absolute border-2 border-white"
          style={{ left: sel.x, top: sel.y, width: sel.width, height: sel.height, cursor: "move" }}
        >
          {HANDLES.map(({ id, fx, fy, cursor }) => (
            <div
              key={id}
              className="absolute rounded-sm bg-white"
              style={{
                left:   `calc(${fx * 100}% - ${HANDLE_HALF}px)`,
                top:    `calc(${fy * 100}% - ${HANDLE_HALF}px)`,
                width:  HANDLE_HALF * 2,
                height: HANDLE_HALF * 2,
                border: "2px solid #8b5cf6",
                cursor,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
