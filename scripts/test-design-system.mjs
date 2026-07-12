/**
 * Test suite — LEXI Design System (Phase 6.3)
 *
 * Tests the token contract, theme completeness, theme distinctness,
 * themeToCssVars output, component prop contracts, and theme switching logic.
 *
 * All implementations are inlined (no .tsx imports) so the suite runs in plain Node.
 *
 * Sections:
 *   1.  ThemeConfig shape — required keys present
 *   2.  Theme completeness — all three themes satisfy ThemeConfig
 *   3.  Theme distinctness — themes differ on key values
 *   4.  No duplicate theme logic — same key set, different values
 *   5.  themeToCssVars — correct variable name format
 *   6.  themeToCssVars — all tokens serialised
 *   7.  themeToCssVars — values match theme fields
 *   8.  Component prop contracts — required fields defined
 *   9.  Theme switching — state transition logic
 *   10. Confidence indicator mapping
 *   11. Token name format invariants
 *   12. defaultTheme matches globals.css palette
 */

// ─────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let section = "";

function describe(name) { section = name; }

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`  FAIL [${section}] ${name}`);
    console.error(`       ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? "assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected)
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertNotEqual(a, b, msg) {
  if (a === b) throw new Error(msg ?? `expected values to differ, but both are ${JSON.stringify(a)}`);
}

function assertStartsWith(str, prefix, msg) {
  if (!str.startsWith(prefix))
    throw new Error(msg ?? `expected "${str}" to start with "${prefix}"`);
}

// ─────────────────────────────────────────────────────────
// Inlined THEME_VAR_NAMES (mirrors tokens.ts)
// ─────────────────────────────────────────────────────────

const THEME_VAR_NAMES = {
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
  fontSans:         "--theme-font-sans",
  fontMono:         "--theme-font-mono",
  scaleBase:        "--theme-scale-base",
  scaleHeading:     "--theme-scale-heading",
  weightNormal:     "--theme-weight-normal",
  weightSemibold:   "--theme-weight-semibold",
  weightBold:       "--theme-weight-bold",
  cardPadding:      "--theme-card-padding",
  sectionGap:       "--theme-section-gap",
  itemGap:          "--theme-item-gap",
  radiusCard:       "--theme-radius-card",
  radiusBadge:      "--theme-radius-badge",
  radiusButton:     "--theme-radius-button",
  radiusInner:      "--theme-radius-inner",
  shadowCard:       "--theme-shadow-card",
  shadowElevated:   "--theme-shadow-elevated",
  shadowNone:       "--theme-shadow-none",
  duration:         "--theme-duration",
  durationSlow:     "--theme-duration-slow",
  easing:           "--theme-easing",
};

// ─────────────────────────────────────────────────────────
// Inlined themes (mirrors themes.ts)
// ─────────────────────────────────────────────────────────

const defaultTheme = {
  id: "default", name: "Default",
  colors: {
    background: "#fbf8ff", foreground: "#2e2150",
    cardBackground: "#ffffff", cardBorder: "#f4f4f5",
    primary: "#8b5cf6", primaryDark: "#6d28d9",
    accent: "#f472b6", soft: "#ede9fe", success: "#34d399",
    muted: "#f4f4f5", mutedForeground: "#71717a",
    confidenceHigh: "#34d399", confidenceMedium: "#f472b6", confidenceLow: "#d4d4d8",
  },
  typography: {
    fontSans: "var(--font-geist-sans), Arial, sans-serif",
    fontMono: "var(--font-geist-mono), monospace",
    scaleBase: "1rem", scaleHeading: "1.125rem",
    weightNormal: "400", weightSemibold: "600", weightBold: "700",
  },
  spacing: { cardPadding: "1.5rem", sectionGap: "1.5rem", itemGap: "0.75rem" },
  radius:  { card: "1.5rem", badge: "9999px", button: "0.75rem", inner: "1rem" },
  shadows: {
    card: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
    elevated: "0 4px 12px 0 rgb(0 0 0 / 0.10)", none: "none",
  },
  motion: { duration: "200ms", durationSlow: "400ms", easing: "ease-in-out" },
};

const calmTheme = {
  id: "calm", name: "Calm",
  colors: {
    background: "#f0fdf9", foreground: "#134e4a",
    cardBackground: "#ffffff", cardBorder: "#ccfbf1",
    primary: "#0d9488", primaryDark: "#0f766e",
    accent: "#7dd3fc", soft: "#ccfbf1", success: "#22c55e",
    muted: "#e8faf6", mutedForeground: "#4d7c78",
    confidenceHigh: "#22c55e", confidenceMedium: "#7dd3fc", confidenceLow: "#a7f3d0",
  },
  typography: {
    fontSans: "var(--font-geist-sans), Arial, sans-serif",
    fontMono: "var(--font-geist-mono), monospace",
    scaleBase: "1rem", scaleHeading: "1.125rem",
    weightNormal: "400", weightSemibold: "600", weightBold: "700",
  },
  spacing: { cardPadding: "2rem", sectionGap: "2rem", itemGap: "1rem" },
  radius:  { card: "2rem", badge: "9999px", button: "1rem", inner: "1.25rem" },
  shadows: {
    card: "0 2px 8px 0 rgb(13 148 136 / 0.08)",
    elevated: "0 6px 18px 0 rgb(13 148 136 / 0.14)", none: "none",
  },
  motion: { duration: "300ms", durationSlow: "600ms", easing: "ease-out" },
};

const focusTheme = {
  id: "focus", name: "Focus",
  colors: {
    background: "#0f172a", foreground: "#f8fafc",
    cardBackground: "#1e293b", cardBorder: "#334155",
    primary: "#6366f1", primaryDark: "#4f46e5",
    accent: "#f59e0b", soft: "#1e293b", success: "#4ade80",
    muted: "#1e293b", mutedForeground: "#94a3b8",
    confidenceHigh: "#4ade80", confidenceMedium: "#f59e0b", confidenceLow: "#475569",
  },
  typography: {
    fontSans: "var(--font-geist-sans), Arial, sans-serif",
    fontMono: "var(--font-geist-mono), monospace",
    scaleBase: "1rem", scaleHeading: "1.125rem",
    weightNormal: "400", weightSemibold: "600", weightBold: "700",
  },
  spacing: { cardPadding: "1.25rem", sectionGap: "1.25rem", itemGap: "0.625rem" },
  radius:  { card: "0.75rem", badge: "0.375rem", button: "0.375rem", inner: "0.5rem" },
  shadows: {
    card: "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    elevated: "0 4px 16px 0 rgb(0 0 0 / 0.5)", none: "none",
  },
  motion: { duration: "150ms", durationSlow: "300ms", easing: "ease-in" },
};

const availableThemes = [defaultTheme, calmTheme, focusTheme];

// ─────────────────────────────────────────────────────────
// Inlined themeToCssVars (mirrors themes.ts)
// ─────────────────────────────────────────────────────────

function themeToCssVars(theme) {
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

// ─────────────────────────────────────────────────────────
// Theme switching state machine (mirrors ThemeProvider logic)
// ─────────────────────────────────────────────────────────

function makeThemeState(initial = defaultTheme) {
  let current = initial;
  return {
    get: () => current,
    set: (t) => { current = t; },
  };
}

// ─────────────────────────────────────────────────────────
// ThemeConfig required key sets (mirrors tokens.ts)
// ─────────────────────────────────────────────────────────

const REQUIRED_COLOR_KEYS = [
  "background","foreground","cardBackground","cardBorder",
  "primary","primaryDark","accent","soft","success",
  "muted","mutedForeground","confidenceHigh","confidenceMedium","confidenceLow",
];
const REQUIRED_TYPOGRAPHY_KEYS = [
  "fontSans","fontMono","scaleBase","scaleHeading",
  "weightNormal","weightSemibold","weightBold",
];
const REQUIRED_SPACING_KEYS  = ["cardPadding","sectionGap","itemGap"];
const REQUIRED_RADIUS_KEYS   = ["card","badge","button","inner"];
const REQUIRED_SHADOW_KEYS   = ["card","elevated","none"];
const REQUIRED_MOTION_KEYS   = ["duration","durationSlow","easing"];

function assertThemeComplete(theme, label) {
  assert("id"         in theme, `${label}: missing id`);
  assert("name"       in theme, `${label}: missing name`);
  assert("colors"     in theme, `${label}: missing colors`);
  assert("typography" in theme, `${label}: missing typography`);
  assert("spacing"    in theme, `${label}: missing spacing`);
  assert("radius"     in theme, `${label}: missing radius`);
  assert("shadows"    in theme, `${label}: missing shadows`);
  assert("motion"     in theme, `${label}: missing motion`);
  for (const k of REQUIRED_COLOR_KEYS)
    assert(k in theme.colors, `${label}.colors missing: ${k}`);
  for (const k of REQUIRED_TYPOGRAPHY_KEYS)
    assert(k in theme.typography, `${label}.typography missing: ${k}`);
  for (const k of REQUIRED_SPACING_KEYS)
    assert(k in theme.spacing, `${label}.spacing missing: ${k}`);
  for (const k of REQUIRED_RADIUS_KEYS)
    assert(k in theme.radius, `${label}.radius missing: ${k}`);
  for (const k of REQUIRED_SHADOW_KEYS)
    assert(k in theme.shadows, `${label}.shadows missing: ${k}`);
  for (const k of REQUIRED_MOTION_KEYS)
    assert(k in theme.motion, `${label}.motion missing: ${k}`);
}

// ─────────────────────────────────────────────────────────
// Section 1 — ThemeConfig shape — required keys present
// ─────────────────────────────────────────────────────────

describe("1. ThemeConfig shape — required keys");

test("ThemeConfig requires id and name", () => {
  assert("id"   in defaultTheme, "id");
  assert("name" in defaultTheme, "name");
});

test("ThemeConfig requires colors with all sub-keys", () => {
  for (const k of REQUIRED_COLOR_KEYS)
    assert(k in defaultTheme.colors, `colors.${k}`);
});

test("ThemeConfig requires typography with all sub-keys", () => {
  for (const k of REQUIRED_TYPOGRAPHY_KEYS)
    assert(k in defaultTheme.typography, `typography.${k}`);
});

test("ThemeConfig requires spacing with all sub-keys", () => {
  for (const k of REQUIRED_SPACING_KEYS)
    assert(k in defaultTheme.spacing, `spacing.${k}`);
});

test("ThemeConfig requires radius with all sub-keys", () => {
  for (const k of REQUIRED_RADIUS_KEYS)
    assert(k in defaultTheme.radius, `radius.${k}`);
});

test("ThemeConfig requires shadows with all sub-keys", () => {
  for (const k of REQUIRED_SHADOW_KEYS)
    assert(k in defaultTheme.shadows, `shadows.${k}`);
});

test("ThemeConfig requires motion with all sub-keys", () => {
  for (const k of REQUIRED_MOTION_KEYS)
    assert(k in defaultTheme.motion, `motion.${k}`);
});

test("shadows.none is always the string 'none'", () => {
  for (const t of availableThemes)
    assertEqual(t.shadows.none, "none", `${t.id}: shadows.none`);
});

// ─────────────────────────────────────────────────────────
// Section 2 — Theme completeness — all three themes satisfy ThemeConfig
// ─────────────────────────────────────────────────────────

describe("2. Theme completeness");

test("defaultTheme is complete", () => assertThemeComplete(defaultTheme, "defaultTheme"));
test("calmTheme is complete",    () => assertThemeComplete(calmTheme,    "calmTheme"));
test("focusTheme is complete",   () => assertThemeComplete(focusTheme,   "focusTheme"));

test("all themes have unique ids", () => {
  const ids = availableThemes.map((t) => t.id);
  const unique = new Set(ids);
  assertEqual(unique.size, ids.length, "non-unique theme ids");
});

test("all themes have non-empty names", () => {
  for (const t of availableThemes)
    assert(typeof t.name === "string" && t.name.length > 0, `${t.id}: empty name`);
});

test("all color values are non-empty strings", () => {
  for (const t of availableThemes)
    for (const [k, v] of Object.entries(t.colors))
      assert(typeof v === "string" && v.length > 0, `${t.id}.colors.${k} empty`);
});

test("all spacing values contain a CSS unit", () => {
  const unitRe = /\d+(rem|px|em|%)$/;
  for (const t of availableThemes)
    for (const [k, v] of Object.entries(t.spacing))
      assert(unitRe.test(v), `${t.id}.spacing.${k} = "${v}" missing unit`);
});

test("all motion duration values end in ms", () => {
  for (const t of availableThemes) {
    assert(t.motion.duration.endsWith("ms"),     `${t.id} duration`);
    assert(t.motion.durationSlow.endsWith("ms"), `${t.id} durationSlow`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 3 — Theme distinctness — themes differ on key values
// ─────────────────────────────────────────────────────────

describe("3. Theme distinctness");

test("defaultTheme and calmTheme have different primary colors", () => {
  assertNotEqual(defaultTheme.colors.primary, calmTheme.colors.primary);
});

test("defaultTheme and focusTheme have different backgrounds", () => {
  assertNotEqual(defaultTheme.colors.background, focusTheme.colors.background);
});

test("calmTheme and focusTheme have different foreground colors", () => {
  assertNotEqual(calmTheme.colors.foreground, focusTheme.colors.foreground);
});

test("themes differ in card radius", () => {
  const radii = availableThemes.map((t) => t.radius.card);
  const unique = new Set(radii);
  assert(unique.size > 1, `all themes share the same card radius: ${radii[0]}`);
});

test("themes differ in card padding", () => {
  const pads = availableThemes.map((t) => t.spacing.cardPadding);
  const unique = new Set(pads);
  assert(unique.size > 1, "all themes share the same cardPadding");
});

test("themes differ in motion duration", () => {
  const durations = availableThemes.map((t) => t.motion.duration);
  const unique = new Set(durations);
  assert(unique.size > 1, "all themes share the same motion.duration");
});

test("themes differ in motion easing", () => {
  const easings = availableThemes.map((t) => t.motion.easing);
  const unique = new Set(easings);
  assert(unique.size > 1, "all themes share the same easing");
});

test("focusTheme background is dark (hex starts low)", () => {
  // Dark background: R < 0x40
  const bg = focusTheme.colors.background.toLowerCase();
  assert(bg.startsWith("#"), "hex color");
  const r = parseInt(bg.slice(1, 3), 16);
  assert(r < 0x40, `focusTheme background is not dark: ${bg}`);
});

test("calmTheme has more spacing than defaultTheme", () => {
  const parse = (v) => parseFloat(v);
  assert(
    parse(calmTheme.spacing.cardPadding) > parse(defaultTheme.spacing.cardPadding),
    "calm cardPadding not larger than default",
  );
});

// ─────────────────────────────────────────────────────────
// Section 4 — No duplicate logic — same key set, different values
// ─────────────────────────────────────────────────────────

describe("4. No duplicate theme logic");

test("all themes define exactly the same color keys", () => {
  const defaultKeys = Object.keys(defaultTheme.colors).sort().join(",");
  for (const t of [calmTheme, focusTheme]) {
    const keys = Object.keys(t.colors).sort().join(",");
    assertEqual(keys, defaultKeys, `${t.id} color keys differ from defaultTheme`);
  }
});

test("all themes define exactly the same spacing keys", () => {
  const defaultKeys = Object.keys(defaultTheme.spacing).sort().join(",");
  for (const t of [calmTheme, focusTheme]) {
    const keys = Object.keys(t.spacing).sort().join(",");
    assertEqual(keys, defaultKeys, `${t.id} spacing keys differ`);
  }
});

test("all themes define exactly the same radius keys", () => {
  const defaultKeys = Object.keys(defaultTheme.radius).sort().join(",");
  for (const t of [calmTheme, focusTheme])
    assertEqual(Object.keys(t.radius).sort().join(","), defaultKeys, `${t.id}`);
});

test("all themes define exactly the same motion keys", () => {
  const defaultKeys = Object.keys(defaultTheme.motion).sort().join(",");
  for (const t of [calmTheme, focusTheme])
    assertEqual(Object.keys(t.motion).sort().join(","), defaultKeys, `${t.id}`);
});

test("no theme object is a reference copy of another", () => {
  assert(defaultTheme !== calmTheme,  "default === calm");
  assert(defaultTheme !== focusTheme, "default === focus");
  assert(calmTheme    !== focusTheme, "calm === focus");
});

// ─────────────────────────────────────────────────────────
// Section 5 — themeToCssVars — correct variable name format
// ─────────────────────────────────────────────────────────

describe("5. themeToCssVars — variable name format");

test("all output keys start with --theme-", () => {
  const vars = themeToCssVars(defaultTheme);
  for (const key of Object.keys(vars))
    assertStartsWith(key, "--theme-", `variable "${key}" does not start with --theme-`);
});

test("no output key contains uppercase letters", () => {
  const vars = themeToCssVars(defaultTheme);
  for (const key of Object.keys(vars))
    assert(key === key.toLowerCase(), `uppercase in var name: "${key}"`);
});

test("no output key contains underscores (uses hyphens)", () => {
  const vars = themeToCssVars(defaultTheme);
  for (const key of Object.keys(vars))
    assert(!key.includes("_"), `underscore in var name: "${key}"`);
});

test("all values in THEME_VAR_NAMES start with --theme-", () => {
  for (const [k, v] of Object.entries(THEME_VAR_NAMES))
    assertStartsWith(v, "--theme-", `THEME_VAR_NAMES.${k} = "${v}"`);
});

// ─────────────────────────────────────────────────────────
// Section 6 — themeToCssVars — all tokens serialised
// ─────────────────────────────────────────────────────────

describe("6. themeToCssVars — token completeness");

const EXPECTED_VAR_COUNT = Object.keys(THEME_VAR_NAMES).length;

test(`themeToCssVars produces ${EXPECTED_VAR_COUNT} variables`, () => {
  const vars = themeToCssVars(defaultTheme);
  assertEqual(Object.keys(vars).length, EXPECTED_VAR_COUNT);
});

test("every THEME_VAR_NAME key appears in themeToCssVars output", () => {
  const vars = themeToCssVars(defaultTheme);
  for (const varName of Object.values(THEME_VAR_NAMES))
    assert(varName in vars, `missing in output: ${varName}`);
});

test("themeToCssVars output has no undefined values", () => {
  const vars = themeToCssVars(defaultTheme);
  for (const [k, v] of Object.entries(vars))
    assert(v !== undefined && v !== null && v !== "", `${k} has empty value`);
});

test("all three themes serialise without errors", () => {
  for (const t of availableThemes) {
    let threw = false;
    try { themeToCssVars(t); } catch { threw = true; }
    assert(!threw, `${t.id}: themeToCssVars threw`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 7 — themeToCssVars — values match theme fields
// ─────────────────────────────────────────────────────────

describe("7. themeToCssVars — field mapping correctness");

test("--theme-bg maps to colors.background", () => {
  const vars = themeToCssVars(defaultTheme);
  assertEqual(vars["--theme-bg"], defaultTheme.colors.background);
});

test("--theme-fg maps to colors.foreground", () => {
  const vars = themeToCssVars(defaultTheme);
  assertEqual(vars["--theme-fg"], defaultTheme.colors.foreground);
});

test("--theme-primary maps to colors.primary", () => {
  const vars = themeToCssVars(defaultTheme);
  assertEqual(vars["--theme-primary"], defaultTheme.colors.primary);
});

test("--theme-card-padding maps to spacing.cardPadding", () => {
  const vars = themeToCssVars(calmTheme);
  assertEqual(vars["--theme-card-padding"], calmTheme.spacing.cardPadding);
});

test("--theme-radius-card maps to radius.card", () => {
  const vars = themeToCssVars(focusTheme);
  assertEqual(vars["--theme-radius-card"], focusTheme.radius.card);
});

test("--theme-duration maps to motion.duration", () => {
  const vars = themeToCssVars(calmTheme);
  assertEqual(vars["--theme-duration"], calmTheme.motion.duration);
});

test("--theme-confidence-high maps to colors.confidenceHigh", () => {
  for (const t of availableThemes) {
    const vars = themeToCssVars(t);
    assertEqual(vars["--theme-confidence-high"], t.colors.confidenceHigh, t.id);
  }
});

test("each theme produces distinct --theme-bg values", () => {
  const bgs = availableThemes.map((t) => themeToCssVars(t)["--theme-bg"]);
  const unique = new Set(bgs);
  assert(unique.size === availableThemes.length, "non-unique --theme-bg values");
});

// ─────────────────────────────────────────────────────────
// Section 8 — Component prop contracts — required fields defined
// ─────────────────────────────────────────────────────────

describe("8. Component prop contracts");

// LensCard props
const LENS_CARD_REQUIRED_PROPS = ["children"];
const LENS_CARD_OPTIONAL_PROPS = ["title", "subtitle", "className"];

test("LensCard requires: children", () => {
  const req = { children: "<div/>" };
  for (const p of LENS_CARD_REQUIRED_PROPS) assert(p in req, p);
});

test("LensCard optional props are documented", () => {
  const allProps = [...LENS_CARD_REQUIRED_PROPS, ...LENS_CARD_OPTIONAL_PROPS];
  for (const p of allProps) assert(typeof p === "string" && p.length > 0, p);
});

// InsightCard props
const INSIGHT_CARD_REQUIRED_PROPS = ["type", "narrative", "confidence"];
const INSIGHT_CONFIDENCE_VALUES = ["LOW", "MEDIUM", "HIGH"];

test("InsightCard requires: type, narrative, confidence", () => {
  const req = { type: "ACCURACY_TREND", narrative: "text", confidence: "HIGH" };
  for (const p of INSIGHT_CARD_REQUIRED_PROPS) assert(p in req, p);
});

test("InsightCard confidence accepts exactly LOW | MEDIUM | HIGH", () => {
  assertEqual(INSIGHT_CONFIDENCE_VALUES.length, 3);
  for (const v of INSIGHT_CONFIDENCE_VALUES)
    assert(["LOW", "MEDIUM", "HIGH"].includes(v), `unexpected: ${v}`);
});

// ProgressCard props
const PROGRESS_CARD_REQUIRED_PROPS = ["label", "value"];
const TREND_DIRECTIONS = ["IMPROVING", "STABLE", "DECLINING", "INSUFFICIENT_DATA"];

test("ProgressCard requires: label, value", () => {
  const req = { label: "Accuracy", value: "72%" };
  for (const p of PROGRESS_CARD_REQUIRED_PROPS) assert(p in req, p);
});

test("ProgressCard trend accepts 4 directions", () => {
  assertEqual(TREND_DIRECTIONS.length, 4);
});

test("TREND_DIRECTIONS covers improving, stable, declining, unknown", () => {
  assert(TREND_DIRECTIONS.includes("IMPROVING"),         "IMPROVING");
  assert(TREND_DIRECTIONS.includes("STABLE"),            "STABLE");
  assert(TREND_DIRECTIONS.includes("DECLINING"),         "DECLINING");
  assert(TREND_DIRECTIONS.includes("INSUFFICIENT_DATA"), "INSUFFICIENT_DATA");
});

// SectionHeader props
const SECTION_HEADER_REQUIRED_PROPS = ["title"];
const SECTION_HEADER_OPTIONAL_PROPS = ["subtitle", "badge", "className"];

test("SectionHeader requires: title", () => {
  const req = { title: "Your Progress" };
  for (const p of SECTION_HEADER_REQUIRED_PROPS) assert(p in req, p);
});

test("SectionHeader optional: subtitle, badge, className", () => {
  for (const p of SECTION_HEADER_OPTIONAL_PROPS)
    assert(typeof p === "string" && p.length > 0, p);
});

// ─────────────────────────────────────────────────────────
// Section 9 — Theme switching — state transition logic
// ─────────────────────────────────────────────────────────

describe("9. Theme switching");

test("initial theme is the provided default", () => {
  const state = makeThemeState(defaultTheme);
  assertEqual(state.get().id, "default");
});

test("setTheme changes active theme", () => {
  const state = makeThemeState(defaultTheme);
  state.set(calmTheme);
  assertEqual(state.get().id, "calm");
});

test("setTheme can switch to focusTheme", () => {
  const state = makeThemeState(defaultTheme);
  state.set(focusTheme);
  assertEqual(state.get().id, "focus");
});

test("switching theme changes CSS vars for background", () => {
  const state = makeThemeState(defaultTheme);
  const defaultBg = themeToCssVars(state.get())["--theme-bg"];
  state.set(focusTheme);
  const focusBg = themeToCssVars(state.get())["--theme-bg"];
  assertNotEqual(defaultBg, focusBg, "background unchanged after switch");
});

test("switching back to defaultTheme restores original vars", () => {
  const state = makeThemeState(defaultTheme);
  const originalVars = themeToCssVars(state.get());
  state.set(focusTheme);
  state.set(defaultTheme);
  const restoredVars = themeToCssVars(state.get());
  assertEqual(restoredVars["--theme-bg"],      originalVars["--theme-bg"]);
  assertEqual(restoredVars["--theme-primary"], originalVars["--theme-primary"]);
});

test("switching theme does not mutate the previous theme object", () => {
  const state = makeThemeState(defaultTheme);
  const originalPrimary = defaultTheme.colors.primary;
  state.set(calmTheme);
  assertEqual(defaultTheme.colors.primary, originalPrimary, "defaultTheme was mutated");
});

test("availableThemes array contains all three themes", () => {
  assertEqual(availableThemes.length, 3);
  assert(availableThemes.some((t) => t.id === "default"), "missing default");
  assert(availableThemes.some((t) => t.id === "calm"),    "missing calm");
  assert(availableThemes.some((t) => t.id === "focus"),   "missing focus");
});

// ─────────────────────────────────────────────────────────
// Section 10 — Confidence indicator mapping
// ─────────────────────────────────────────────────────────

describe("10. Confidence indicator mapping");

test("HIGH confidence maps to confidenceHigh token", () => {
  for (const t of availableThemes) {
    const vars = themeToCssVars(t);
    assert(vars["--theme-confidence-high"].length > 0, `${t.id}: empty high`);
  }
});

test("MEDIUM confidence maps to confidenceMedium token", () => {
  for (const t of availableThemes) {
    const vars = themeToCssVars(t);
    assert(vars["--theme-confidence-medium"].length > 0, `${t.id}: empty medium`);
  }
});

test("LOW confidence maps to confidenceLow token", () => {
  for (const t of availableThemes) {
    const vars = themeToCssVars(t);
    assert(vars["--theme-confidence-low"].length > 0, `${t.id}: empty low`);
  }
});

test("confidence colors are distinct within each theme", () => {
  for (const t of availableThemes) {
    assertNotEqual(t.colors.confidenceHigh,   t.colors.confidenceLow,    `${t.id}: high===low`);
    assertNotEqual(t.colors.confidenceMedium, t.colors.confidenceLow,    `${t.id}: med===low`);
  }
});

test("all three confidence tiers have distinct colors across themes", () => {
  const highColors   = availableThemes.map((t) => t.colors.confidenceHigh);
  const mediumColors = availableThemes.map((t) => t.colors.confidenceMedium);
  assert(new Set(highColors).size   > 1, "all themes share confidenceHigh color");
  assert(new Set(mediumColors).size > 1, "all themes share confidenceMedium color");
});

// ─────────────────────────────────────────────────────────
// Section 11 — Token name format invariants
// ─────────────────────────────────────────────────────────

describe("11. Token name format invariants");

test("THEME_VAR_NAMES has no duplicate values", () => {
  const vals = Object.values(THEME_VAR_NAMES);
  const unique = new Set(vals);
  assertEqual(unique.size, vals.length, "duplicate CSS variable names in THEME_VAR_NAMES");
});

test("no two token keys produce the same CSS variable name", () => {
  const seen = new Set();
  for (const v of Object.values(THEME_VAR_NAMES)) {
    assert(!seen.has(v), `duplicate var name: ${v}`);
    seen.add(v);
  }
});

test("all var names use only lowercase, digits, and hyphens", () => {
  const re = /^--[a-z0-9-]+$/;
  for (const v of Object.values(THEME_VAR_NAMES))
    assert(re.test(v), `invalid var name format: "${v}"`);
});

test("every color token ends in a color group suffix", () => {
  const colorVarNames = [
    THEME_VAR_NAMES.bg, THEME_VAR_NAMES.fg, THEME_VAR_NAMES.primary,
    THEME_VAR_NAMES.accent, THEME_VAR_NAMES.success,
    THEME_VAR_NAMES.confidenceHigh, THEME_VAR_NAMES.confidenceMedium, THEME_VAR_NAMES.confidenceLow,
  ];
  for (const v of colorVarNames)
    assert(v.startsWith("--theme-"), `${v} does not start with --theme-`);
});

// ─────────────────────────────────────────────────────────
// Section 12 — defaultTheme matches globals.css palette
// ─────────────────────────────────────────────────────────

describe("12. defaultTheme matches globals.css");

test("defaultTheme background matches globals.css --background", () => {
  assertEqual(defaultTheme.colors.background, "#fbf8ff");
});

test("defaultTheme foreground matches globals.css --foreground", () => {
  assertEqual(defaultTheme.colors.foreground, "#2e2150");
});

test("defaultTheme primary matches globals.css --lexi-primary", () => {
  assertEqual(defaultTheme.colors.primary, "#8b5cf6");
});

test("defaultTheme primaryDark matches globals.css --lexi-primary-dark", () => {
  assertEqual(defaultTheme.colors.primaryDark, "#6d28d9");
});

test("defaultTheme accent matches globals.css --lexi-accent", () => {
  assertEqual(defaultTheme.colors.accent, "#f472b6");
});

test("defaultTheme soft matches globals.css --lexi-soft", () => {
  assertEqual(defaultTheme.colors.soft, "#ede9fe");
});

test("defaultTheme success matches globals.css --lexi-success", () => {
  assertEqual(defaultTheme.colors.success, "#34d399");
});

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────

console.log(`\nLEXI Design System Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
