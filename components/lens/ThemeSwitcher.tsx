"use client";

import { useTheme } from "@/components/ui/ThemeProvider";

/**
 * Demo control for switching between available themes at runtime.
 * Uses ThemeContext — must be rendered inside a ThemeProvider.
 */
export function ThemeSwitcher() {
  const { theme, setTheme, availableThemes } = useTheme();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Switch theme">
      <span
        className="mr-1 text-xs"
        style={{ color: "var(--theme-muted-fg, #71717a)" }}
      >
        Theme:
      </span>
      {availableThemes.map((t) => {
        const isActive = t.id === theme.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t)}
            aria-pressed={isActive}
            className="px-3 py-1 text-xs font-medium transition-all"
            style={{
              background:   isActive ? "var(--theme-primary, #8b5cf6)"  : "var(--theme-muted, #f4f4f5)",
              color:        isActive ? "#ffffff"                          : "var(--theme-muted-fg, #71717a)",
              borderRadius: "var(--theme-radius-button, 0.75rem)",
              border:       "none",
              cursor:       "pointer",
              transition:   "background var(--theme-duration, 200ms) var(--theme-easing, ease-in-out)",
            }}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
