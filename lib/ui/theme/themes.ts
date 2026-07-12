/**
 * LEXI Design System — Theme Definitions (Phase 6.3)
 *
 * Three themes. Each changes visual experience only — no learning logic.
 *
 * defaultTheme: matches the existing globals.css palette (no visual change for current users).
 * calmTheme:    soft teal-blue palette with more spacing and breathing room.
 * focusTheme:   high-contrast dark palette with bold accents and sharper radius.
 *
 * themeToCssVars() serialises any ThemeConfig into a flat Record<string, string>
 * suitable for React's style prop. ThemeProvider applies it to a wrapper element.
 */

import type { ThemeConfig } from "./tokens";
import { THEME_VAR_NAMES } from "./tokens";

// ─────────────────────────────────────────────────────────
// defaultTheme — violet/purple, white cards
// Values mirror the existing :root variables in globals.css
// so existing pages are unaffected when ThemeProvider wraps them.
// ─────────────────────────────────────────────────────────

export const defaultTheme: ThemeConfig = {
  id: "default",
  name: "Default",
  colors: {
    background:       "#fbf8ff",
    foreground:       "#2e2150",
    cardBackground:   "#ffffff",
    cardBorder:       "#f4f4f5",
    primary:          "#8b5cf6",
    primaryDark:      "#6d28d9",
    accent:           "#f472b6",
    soft:             "#ede9fe",
    success:          "#34d399",
    muted:            "#f4f4f5",
    mutedForeground:  "#71717a",
    confidenceHigh:   "#34d399",
    confidenceMedium: "#f472b6",
    confidenceLow:    "#d4d4d8",
  },
  typography: {
    fontSans:      "var(--font-geist-sans), Arial, sans-serif",
    fontMono:      "var(--font-geist-mono), monospace",
    scaleBase:     "1rem",
    scaleHeading:  "1.125rem",
    weightNormal:  "400",
    weightSemibold:"600",
    weightBold:    "700",
  },
  spacing: {
    cardPadding: "1.5rem",
    sectionGap:  "1.5rem",
    itemGap:     "0.75rem",
  },
  radius: {
    card:   "1.5rem",
    badge:  "9999px",
    button: "0.75rem",
    inner:  "1rem",
  },
  shadows: {
    card:     "0 1px 3px 0 rgb(0 0 0 / 0.05)",
    elevated: "0 4px 12px 0 rgb(0 0 0 / 0.10)",
    none:     "none",
  },
  motion: {
    duration:     "200ms",
    durationSlow: "400ms",
    easing:       "ease-in-out",
  },
};

// ─────────────────────────────────────────────────────────
// calmTheme — soft teal-blue, more space, gentler transitions
// ─────────────────────────────────────────────────────────

export const calmTheme: ThemeConfig = {
  id: "calm",
  name: "Calm",
  colors: {
    background:       "#f0fdf9",
    foreground:       "#134e4a",
    cardBackground:   "#ffffff",
    cardBorder:       "#ccfbf1",
    primary:          "#0d9488",
    primaryDark:      "#0f766e",
    accent:           "#7dd3fc",
    soft:             "#ccfbf1",
    success:          "#22c55e",
    muted:            "#e8faf6",
    mutedForeground:  "#4d7c78",
    confidenceHigh:   "#22c55e",
    confidenceMedium: "#7dd3fc",
    confidenceLow:    "#a7f3d0",
  },
  typography: {
    fontSans:      "var(--font-geist-sans), Arial, sans-serif",
    fontMono:      "var(--font-geist-mono), monospace",
    scaleBase:     "1rem",
    scaleHeading:  "1.125rem",
    weightNormal:  "400",
    weightSemibold:"600",
    weightBold:    "700",
  },
  spacing: {
    cardPadding: "2rem",
    sectionGap:  "2rem",
    itemGap:     "1rem",
  },
  radius: {
    card:   "2rem",
    badge:  "9999px",
    button: "1rem",
    inner:  "1.25rem",
  },
  shadows: {
    card:     "0 2px 8px 0 rgb(13 148 136 / 0.08)",
    elevated: "0 6px 18px 0 rgb(13 148 136 / 0.14)",
    none:     "none",
  },
  motion: {
    duration:     "300ms",
    durationSlow: "600ms",
    easing:       "ease-out",
  },
};

// ─────────────────────────────────────────────────────────
// focusTheme — high-contrast dark, bold indigo/amber accents
// ─────────────────────────────────────────────────────────

export const focusTheme: ThemeConfig = {
  id: "focus",
  name: "Focus",
  colors: {
    background:       "#0f172a",
    foreground:       "#f8fafc",
    cardBackground:   "#1e293b",
    cardBorder:       "#334155",
    primary:          "#6366f1",
    primaryDark:      "#4f46e5",
    accent:           "#f59e0b",
    soft:             "#1e293b",
    success:          "#4ade80",
    muted:            "#1e293b",
    mutedForeground:  "#94a3b8",
    confidenceHigh:   "#4ade80",
    confidenceMedium: "#f59e0b",
    confidenceLow:    "#475569",
  },
  typography: {
    fontSans:      "var(--font-geist-sans), Arial, sans-serif",
    fontMono:      "var(--font-geist-mono), monospace",
    scaleBase:     "1rem",
    scaleHeading:  "1.125rem",
    weightNormal:  "400",
    weightSemibold:"600",
    weightBold:    "700",
  },
  spacing: {
    cardPadding: "1.25rem",
    sectionGap:  "1.25rem",
    itemGap:     "0.625rem",
  },
  radius: {
    card:   "0.75rem",
    badge:  "0.375rem",
    button: "0.375rem",
    inner:  "0.5rem",
  },
  shadows: {
    card:     "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    elevated: "0 4px 16px 0 rgb(0 0 0 / 0.5)",
    none:     "none",
  },
  motion: {
    duration:     "150ms",
    durationSlow: "300ms",
    easing:       "ease-in",
  },
};

// ─────────────────────────────────────────────────────────
// All available themes — order determines UI display order
// ─────────────────────────────────────────────────────────

export const availableThemes: ThemeConfig[] = [defaultTheme, calmTheme, focusTheme];

// ─────────────────────────────────────────────────────────
// themeToCssVars — serialise a ThemeConfig into CSS custom properties
// ─────────────────────────────────────────────────────────

export function themeToCssVars(theme: ThemeConfig): Record<string, string> {
  const v = THEME_VAR_NAMES;
  return {
    [v.bg]:               theme.colors.background,
    [v.fg]:               theme.colors.foreground,
    [v.cardBg]:           theme.colors.cardBackground,
    [v.cardBorder]:       theme.colors.cardBorder,
    [v.primary]:          theme.colors.primary,
    [v.primaryDark]:      theme.colors.primaryDark,
    [v.accent]:           theme.colors.accent,
    [v.soft]:             theme.colors.soft,
    [v.success]:          theme.colors.success,
    [v.muted]:            theme.colors.muted,
    [v.mutedFg]:          theme.colors.mutedForeground,
    [v.confidenceHigh]:   theme.colors.confidenceHigh,
    [v.confidenceMedium]: theme.colors.confidenceMedium,
    [v.confidenceLow]:    theme.colors.confidenceLow,
    [v.fontSans]:         theme.typography.fontSans,
    [v.fontMono]:         theme.typography.fontMono,
    [v.scaleBase]:        theme.typography.scaleBase,
    [v.scaleHeading]:     theme.typography.scaleHeading,
    [v.weightNormal]:     theme.typography.weightNormal,
    [v.weightSemibold]:   theme.typography.weightSemibold,
    [v.weightBold]:       theme.typography.weightBold,
    [v.cardPadding]:      theme.spacing.cardPadding,
    [v.sectionGap]:       theme.spacing.sectionGap,
    [v.itemGap]:          theme.spacing.itemGap,
    [v.radiusCard]:       theme.radius.card,
    [v.radiusBadge]:      theme.radius.badge,
    [v.radiusButton]:     theme.radius.button,
    [v.radiusInner]:      theme.radius.inner,
    [v.shadowCard]:       theme.shadows.card,
    [v.shadowElevated]:   theme.shadows.elevated,
    [v.shadowNone]:       theme.shadows.none,
    [v.duration]:         theme.motion.duration,
    [v.durationSlow]:     theme.motion.durationSlow,
    [v.easing]:           theme.motion.easing,
  };
}
