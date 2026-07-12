/**
 * LEXI Design System — Token Contract (Phase 6.3)
 *
 * ThemeConfig defines every token the design system exposes.
 * Components reference CSS variables injected by ThemeProvider — never hardcoded values.
 * All three top-level tokens (colors, typography, spacing, …) must be present in every theme.
 */

export interface ThemeColors {
  // Surface
  background: string;
  foreground: string;
  cardBackground: string;
  cardBorder: string;
  // Brand
  primary: string;
  primaryDark: string;
  accent: string;
  soft: string;
  success: string;
  // Semantic / muted
  muted: string;
  mutedForeground: string;
  // Confidence tier indicators
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
}

export interface ThemeTypography {
  fontSans: string;
  fontMono: string;
  scaleBase: string;
  scaleHeading: string;
  weightNormal: string;
  weightSemibold: string;
  weightBold: string;
}

export interface ThemeSpacing {
  cardPadding: string;
  sectionGap: string;
  itemGap: string;
}

export interface ThemeRadius {
  card: string;
  badge: string;
  button: string;
  inner: string;
}

export interface ThemeShadows {
  card: string;
  elevated: string;
  none: string;
}

export interface ThemeMotion {
  duration: string;
  durationSlow: string;
  easing: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  motion: ThemeMotion;
}

/**
 * All CSS variable names emitted by themeToCssVars().
 * Lens components reference these via var(--theme-*).
 */
export const THEME_VAR_NAMES = {
  // Colors
  bg:               "--theme-bg",
  fg:               "--theme-fg",
  cardBg:           "--theme-card-bg",
  cardBorder:       "--theme-card-border",
  primary:          "--theme-primary",
  primaryDark:      "--theme-primary-dark",
  accent:           "--theme-accent",
  soft:             "--theme-soft",
  success:          "--theme-success",
  muted:            "--theme-muted",
  mutedFg:          "--theme-muted-fg",
  confidenceHigh:   "--theme-confidence-high",
  confidenceMedium: "--theme-confidence-medium",
  confidenceLow:    "--theme-confidence-low",
  // Typography
  fontSans:         "--theme-font-sans",
  fontMono:         "--theme-font-mono",
  scaleBase:        "--theme-scale-base",
  scaleHeading:     "--theme-scale-heading",
  weightNormal:     "--theme-weight-normal",
  weightSemibold:   "--theme-weight-semibold",
  weightBold:       "--theme-weight-bold",
  // Spacing
  cardPadding:      "--theme-card-padding",
  sectionGap:       "--theme-section-gap",
  itemGap:          "--theme-item-gap",
  // Radius
  radiusCard:       "--theme-radius-card",
  radiusBadge:      "--theme-radius-badge",
  radiusButton:     "--theme-radius-button",
  radiusInner:      "--theme-radius-inner",
  // Shadows
  shadowCard:       "--theme-shadow-card",
  shadowElevated:   "--theme-shadow-elevated",
  shadowNone:       "--theme-shadow-none",
  // Motion
  duration:         "--theme-duration",
  durationSlow:     "--theme-duration-slow",
  easing:           "--theme-easing",
} as const;

export type ThemeVarName = (typeof THEME_VAR_NAMES)[keyof typeof THEME_VAR_NAMES];
