import { cn } from "@/lib/ui/cn";

interface LensCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Generic card wrapper for any Lens view section.
 * Colors and radius come from theme CSS variables — no hardcoded values.
 */
export function LensCard({ title, subtitle, children, className }: LensCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      style={{
        background:   "var(--theme-card-bg, #ffffff)",
        border:       "1px solid var(--theme-card-border, #f4f4f5)",
        borderRadius: "var(--theme-radius-card, 1.5rem)",
        padding:      "var(--theme-card-padding, 1.5rem)",
        boxShadow:    "var(--theme-shadow-card, none)",
      }}
    >
      {(title || subtitle) && (
        <div className="flex flex-col gap-1">
          {title && (
            <h2
              className="font-semibold leading-snug"
              style={{
                fontSize: "var(--theme-scale-heading, 1.125rem)",
                color:    "var(--theme-fg, #2e2150)",
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              className="text-sm"
              style={{ color: "var(--theme-muted-fg, #71717a)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
