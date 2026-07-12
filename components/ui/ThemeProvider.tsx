"use client";

import React, { createContext, useContext, useState } from "react";
import type { ThemeConfig } from "@/lib/ui/theme/tokens";
import { themeToCssVars } from "@/lib/ui/theme/themes";
import { defaultTheme, availableThemes as builtInThemes } from "@/lib/ui/theme/themes";

// ─────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  availableThemes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeConfig;
  availableThemes?: ThemeConfig[];
}

/**
 * Wraps children in a div that carries all theme tokens as CSS custom properties
 * (--theme-bg, --theme-primary, etc.). Switch themes at runtime with setTheme().
 *
 * Rules:
 * - Themes affect visual experience only — no learning logic lives here.
 * - The default theme mirrors globals.css so existing pages are unaffected.
 * - Client component: server components inside the tree are still server-rendered.
 */
export function ThemeProvider({
  children,
  initialTheme = defaultTheme,
  availableThemes = builtInThemes,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeConfig>(initialTheme);
  const cssVars = themeToCssVars(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes }}>
      <div style={cssVars as React.CSSProperties} data-theme={theme.id}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be called inside <ThemeProvider>");
  return ctx;
}
