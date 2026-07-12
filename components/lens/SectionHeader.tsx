import { cn } from "@/lib/ui/cn";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

/**
 * Section heading with optional subtitle and badge.
 * Used above LensCard groups. All colors from theme tokens.
 */
export function SectionHeader({ title, subtitle, badge, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <h1
          className="font-bold leading-tight"
          style={{
            fontSize: "var(--theme-scale-heading, 1.125rem)",
            color:    "var(--theme-fg, #2e2150)",
          }}
        >
          {title}
        </h1>
        {badge && (
          <span
            className="text-xs font-medium px-2 py-0.5"
            style={{
              background:   "var(--theme-soft, #ede9fe)",
              color:        "var(--theme-primary, #8b5cf6)",
              borderRadius: "var(--theme-radius-badge, 9999px)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <p
          className="text-sm"
          style={{ color: "var(--theme-muted-fg, #71717a)" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
