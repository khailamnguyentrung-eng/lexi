import { cn } from "@/lib/ui/cn";

export type InsightConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface InsightCardProps {
  type: string;
  narrative: string;
  confidence: InsightConfidence;
  evidence?: {
    signalType?: string;
    streakDays?: number;
    attempts?: number;
    accuracyChange?: number;
  };
  className?: string;
}

const CONFIDENCE_LABEL: Record<InsightConfidence, string> = {
  HIGH:   "Confirmed",
  MEDIUM: "Emerging",
  LOW:    "Early observation",
};

const TYPE_LABEL: Record<string, string> = {
  PRIMARY_SIGNAL: "Signal",
  ACCURACY_TREND: "Accuracy",
  CONSISTENCY:    "Consistency",
  RECOVERY:       "Recovery",
};

/**
 * Renders a single LearningInsight from the Lens view.
 * Confidence color comes from theme tokens — no hardcoded colors.
 * Accepts only data props; contains no intelligence or inference logic.
 */
export function InsightCard({ type, narrative, confidence, evidence, className }: InsightCardProps) {
  const confidenceVar =
    confidence === "HIGH"   ? "var(--theme-confidence-high,   #34d399)" :
    confidence === "MEDIUM" ? "var(--theme-confidence-medium, #f472b6)" :
                              "var(--theme-confidence-low,    #d4d4d8)";

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      style={{
        background:   "var(--theme-card-bg, #ffffff)",
        border:       "1px solid var(--theme-card-border, #f4f4f5)",
        borderRadius: "var(--theme-radius-inner, 1rem)",
        padding:      "var(--theme-item-gap, 0.75rem) var(--theme-card-padding, 1.5rem)",
        borderLeftWidth: "3px",
        borderLeftColor: confidenceVar,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-medium px-2 py-0.5"
          style={{
            background:   "var(--theme-muted, #f4f4f5)",
            color:        "var(--theme-muted-fg, #71717a)",
            borderRadius: "var(--theme-radius-badge, 9999px)",
          }}
        >
          {TYPE_LABEL[type] ?? type}
        </span>
        <span
          className="text-xs"
          style={{ color: confidenceVar }}
        >
          {CONFIDENCE_LABEL[confidence]}
        </span>
      </div>

      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--theme-fg, #2e2150)" }}
      >
        {narrative}
      </p>

      {evidence && (evidence.streakDays !== undefined || evidence.attempts !== undefined) && (
        <p
          className="text-xs"
          style={{ color: "var(--theme-muted-fg, #71717a)" }}
        >
          {evidence.streakDays !== undefined && `${evidence.streakDays}-day streak`}
          {evidence.attempts    !== undefined && `${evidence.attempts} attempts`}
        </p>
      )}
    </div>
  );
}
