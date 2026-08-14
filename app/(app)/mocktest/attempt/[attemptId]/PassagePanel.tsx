"use client";

/**
 * Presentational only — MockTestPlayer owns the collapse state (keyed by
 * passageId, see attempt page) so it can reset it when the learner moves to
 * a different passage.
 */
export function PassagePanel({
  title,
  bodyText,
  collapsed,
  onToggleCollapsed,
}: {
  title: string | null;
  bodyText: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <div className="flex flex-col rounded-3xl border border-zinc-100 bg-white p-6 md:max-h-[calc(100vh-8rem)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-lexi-primary-dark">📖 {title ?? "Đoạn văn"}</p>
        <button
          onClick={onToggleCollapsed}
          className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium text-zinc-600 md:hidden"
        >
          {collapsed ? "Xem đoạn văn ▾" : "Thu gọn ▴"}
        </button>
      </div>
      <div
        className={`${collapsed ? "hidden" : "block"} max-h-[40vh] overflow-y-auto whitespace-pre-line text-sm text-foreground md:block md:max-h-[calc(100vh-10rem)] md:overflow-y-auto`}
      >
        {bodyText}
      </div>
    </div>
  );
}
