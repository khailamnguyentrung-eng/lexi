import { cn } from "@/lib/ui/cn";

export type TrendDirection = "IMPROVING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";
export type ProgressConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface ProgressCardProps {
  label: string;
  value: string | number;
  trend?: TrendDirection;
  confidenceLevel?: ProgressConfidence;
  detail?: string;
  className?: string;
}

const TREND_SYMBOL: Record<TrendDirection, string> = {
  IMPROVING:          "↑",
  STABLE:             "→",
  DECLINING:          "↓",
  INSUFFICIENT_DATA:  "–",
};

const TREND_COLOR: Record<TrendDirection, string> = {
  IMPROVING:         "var(--theme-success,           #34d399)",
  STABLE:            "var(--theme-muted-fg,          #71717a)",
  DECLINING:         "var(--theme-accent,            #f472b6)",
  INSUFFICIENT_DATA: "var(--theme-confidence-low,   #d4d4d8)",
};

/**
 * Renders a single metric with optional trend direction.
 * All colors come from theme tokens. No intelligence logic.
 */
export function ProgressCard({
  label,
  value,
  trend,
  confidenceLevel,
  detail,
  className,
}: ProgressCardProps) {
  const trendColor = trend ? TREND_COLOR[trend] : "var(--theme-muted-fg, #71717a)";
  const trendSymbol = trend ? TREND_SYMBOL[trend] : "";

  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      style={{
        background:   "var(--theme-card-bg, #ffffff)",
        border:       "1px solid var(--theme-card-border, #f4f4f5)",
        borderRadius: "var(--theme-radius-inner, 1rem)",
        padding:      "var(--theme-item-gap, 0.75rem)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-xs font-medium truncate"
          style={{ color: "var(--theme-muted-fg, #71717a)" }}
        >
          {label}
        </span>
        {trend && (
          <span
            className="text-sm font-semibold shrink-0"
            style={{ color: trendColor }}
            aria-label={trend}
          >
            {trendSymbol}
          </span>
        )}
      </div>

      <span
        className="text-2xl font-bold leading-none"
        style={{ color: "var(--theme-fg, #2e2150)" }}
      >
        {value}
      </span>

      {(detail || confidenceLevel) && (
        <p
          className="text-xs"
          style={{ color: "var(--theme-muted-fg, #71717a)" }}
        >
          {detail}
          {confidenceLevel === "LOW" && !detail && "Early data — picture is building."}
        </p>
      )}
    </div>
  );
}
