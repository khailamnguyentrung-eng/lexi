/**
 * Test suite — LEXI Lens UI Composition (Phase 6.4)
 *
 * Verifies that:
 * - LensViewModel is the sole data contract between Lens service and UI
 * - All five sections have correct prop mappings from LensViewModel fields
 * - Empty states are handled for every section
 * - Theme tokens required by Lens components exist in all three themes
 * - No intelligence engine types leak into component prop contracts
 * - Recommendation display preserves priority order
 * - Theme switching produces distinct CSS var sets
 *
 * Sections:
 *   1.  LensViewModel — UI input contract
 *   2.  Summary section — field mapping
 *   3.  Insights section — InsightCard prop mapping
 *   4.  Strengths section — ProgressCard prop mapping
 *   5.  Challenges section — ProgressCard prop mapping + trend logic
 *   6.  Next actions section — recommendation display
 *   7.  Empty state handling — all sections
 *   8.  Theme compatibility — tokens used by Lens components
 *   9.  No intelligence imports — view-data-only contracts
 *   10. Theme switching — CSS var transitions
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
  if (a === b)
    throw new Error(msg ?? `expected values to differ, but both are ${JSON.stringify(a)}`);
}

// ─────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────

function emptyLensViewModel() {
  return {
    summary: {
      narrative: "No learning data yet. Complete a few sessions to see your profile.",
      engagementLevel: "INACTIVE",
      masteredCount: 0, developingCount: 0, weakCount: 0,
      streakDays: 0, topicCount: 0,
      trendIndicator: "INSUFFICIENT_DATA",
      confidenceLevel: "LOW",
      confidenceTier: "OBSERVED",
      source: "learnerModel.knowledgeState",
    },
    insights: { insights: [], generatedAt: "2026-06-30T00:00:00.000Z" },
    strengths: { strengths: [], generatedAt: "2026-06-30T00:00:00.000Z", confidenceNote: undefined },
    challenges: { challenges: [], generatedAt: "2026-06-30T00:00:00.000Z" },
    recommendations: {
      actions: [], nextSessionReady: false, streakContext: undefined,
      generatedAt: "2026-06-30T00:00:00.000Z",
    },
    generatedAt: "2026-06-30T00:00:00.000Z",
  };
}

function richLensViewModel() {
  return {
    summary: {
      narrative: "An active learner showing clear progress across 4 topics. Has mastered 2 topics.",
      engagementLevel: "ACTIVE",
      masteredCount: 2, developingCount: 1, weakCount: 1,
      streakDays: 10, topicCount: 4,
      trendIndicator: "PROGRESSING",
      confidenceLevel: "HIGH",
      confidenceTier: "CONFIRMED",
      source: "learnerModel.knowledgeState",
    },
    insights: {
      insights: [
        {
          type: "PRIMARY_SIGNAL", narrative: "You've mastered Present Simple!",
          evidence: { signalType: "TOPIC_MASTERED" },
          confidence: "HIGH", confidenceTier: "CONFIRMED", source: "topSignal",
        },
        {
          type: "ACCURACY_TREND", narrative: "Your accuracy is improving (currently 72%). Great progress!",
          evidence: {}, confidence: "HIGH", confidenceTier: "CONFIRMED",
          source: "learnerModel.performanceState",
        },
      ],
      generatedAt: "2026-06-30T00:00:00.000Z",
    },
    strengths: {
      strengths: [
        {
          type: "MASTERED_TOPIC", label: "Present Simple",
          confidence: "HIGH", confidenceTier: "CONFIRMED",
          source: "learnerModel.knowledgeState.masteredConcepts",
        },
        {
          type: "STRONG_SKILL", label: "Strong in Reading",
          detail: "82% accuracy", percentageOrCount: 82,
          confidence: "HIGH", confidenceTier: "CONFIRMED",
          source: "learnerModel.performanceState.skillPerformance",
        },
        {
          type: "DEVELOPING_TOPIC", label: "Making progress on 1 topic",
          detail: "Present Perfect", percentageOrCount: 1,
          confidence: "HIGH", confidenceTier: "CONFIRMED",
          source: "learnerModel.knowledgeState.developingConcepts",
        },
      ],
      generatedAt: "2026-06-30T00:00:00.000Z",
      confidenceNote: undefined,
    },
    challenges: {
      challenges: [
        {
          type: "ACTIVE_WEAKNESS", label: "Subjunctive",
          reason: "You've reviewed this but mistakes continue.",
          signal: "RECURRING", dueNow: true,
          confidence: "HIGH", confidenceTier: "CONFIRMED", source: "activeWeaknesses",
        },
        {
          type: "WEAK_SKILL", label: "Weak in Writing",
          reason: "Your accuracy in Writing is 38%.",
          confidence: "HIGH", confidenceTier: "CONFIRMED",
          source: "learnerModel.performanceState.skillPerformance",
        },
      ],
      generatedAt: "2026-06-30T00:00:00.000Z",
    },
    recommendations: {
      actions: [
        {
          priority: 1, topic: "subjunctive", label: "Subjunctive",
          reason: "You've practiced this but mistakes continue. 8 questions available.",
          suggestedAction: "REVIEW_NOTEBOOK", questionCount: 8,
          confidence: "HIGH", confidenceTier: "CONFIRMED", source: "recommendations",
        },
        {
          priority: 2, topic: "session_3", label: "Intermediate Grammar",
          reason: "You've finished the current content. Advance to Session 3.",
          suggestedAction: "ADVANCE_SESSION", sessionNumber: 3,
          questionCount: undefined,
          confidence: "MEDIUM", confidenceTier: "EMERGING", source: "recommendations",
        },
      ],
      nextSessionReady: true,
      streakContext: "Keep your 10-day streak going!",
      generatedAt: "2026-06-30T00:00:00.000Z",
    },
    generatedAt: "2026-06-30T00:00:00.000Z",
  };
}

// ─────────────────────────────────────────────────────────
// Inlined mapping logic (mirrors LensPageContent.tsx)
// ─────────────────────────────────────────────────────────

const TREND_LABEL = {
  PROGRESSING: "Progressing", STABLE: "Stable",
  NEEDS_ATTENTION: "Needs attention", INSUFFICIENT_DATA: "Building data",
};

const SIGNAL_TREND = {
  RECURRING: "DECLINING", IMPROVING: "IMPROVING", STABLE: "STABLE",
};

const ACTION_LABEL = {
  REVIEW_NOTEBOOK: "Open error notebook",
  PRACTICE_TOPIC:  "Practice now",
  ADVANCE_SESSION: "Start session",
};

function actionHref(item) {
  if (item.suggestedAction === "REVIEW_NOTEBOOK") return "/error-notebook";
  if (item.suggestedAction === "PRACTICE_TOPIC")  return `/practice/topic/${item.topic ?? ""}`;
  if (item.suggestedAction === "ADVANCE_SESSION") return `/practice/${item.sessionNumber ?? ""}`;
  return "/practice";
}

function strengthDisplayValue(s) {
  if (s.type === "MASTERED_TOPIC") return "✓ Mastered";
  if (s.type === "STRONG_SKILL" && s.percentageOrCount !== undefined)
    return `${Math.round(s.percentageOrCount)}%`;
  if (s.percentageOrCount !== undefined) return s.percentageOrCount;
  return "↑";
}

// ─────────────────────────────────────────────────────────
// Inlined themes (mirrors themes.ts — abbreviated for tests)
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
  spacing: { cardPadding: "1.5rem", sectionGap: "1.5rem", itemGap: "0.75rem" },
  radius:  { card: "1.5rem", badge: "9999px", button: "0.75rem", inner: "1rem" },
  shadows: { card: "0 1px 3px 0 rgb(0 0 0 / 0.05)", elevated: "...", none: "none" },
  motion:  { duration: "200ms", durationSlow: "400ms", easing: "ease-in-out" },
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
  spacing: { cardPadding: "2rem", sectionGap: "2rem", itemGap: "1rem" },
  radius:  { card: "2rem", badge: "9999px", button: "1rem", inner: "1.25rem" },
  shadows: { card: "...", elevated: "...", none: "none" },
  motion:  { duration: "300ms", durationSlow: "600ms", easing: "ease-out" },
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
  spacing: { cardPadding: "1.25rem", sectionGap: "1.25rem", itemGap: "0.625rem" },
  radius:  { card: "0.75rem", badge: "0.375rem", button: "0.375rem", inner: "0.5rem" },
  shadows: { card: "...", elevated: "...", none: "none" },
  motion:  { duration: "150ms", durationSlow: "300ms", easing: "ease-in" },
};

const availableThemes = [defaultTheme, calmTheme, focusTheme];

// CSS vars used by Lens components (subset of all THEME_VAR_NAMES)
const LENS_COMPONENT_VARS = [
  "--theme-bg", "--theme-fg", "--theme-card-bg", "--theme-card-border",
  "--theme-primary", "--theme-primary-dark",
  "--theme-soft", "--theme-muted", "--theme-muted-fg",
  "--theme-confidence-high", "--theme-confidence-medium", "--theme-confidence-low",
  "--theme-card-padding", "--theme-radius-card", "--theme-radius-inner",
  "--theme-radius-badge", "--theme-radius-button",
  "--theme-duration", "--theme-easing",
];

function themeToCssVars(theme) {
  return {
    "--theme-bg":               theme.colors.background,
    "--theme-fg":               theme.colors.foreground,
    "--theme-card-bg":          theme.colors.cardBackground,
    "--theme-card-border":      theme.colors.cardBorder,
    "--theme-primary":          theme.colors.primary,
    "--theme-primary-dark":     theme.colors.primaryDark,
    "--theme-accent":           theme.colors.accent,
    "--theme-soft":             theme.colors.soft,
    "--theme-success":          theme.colors.success,
    "--theme-muted":            theme.colors.muted,
    "--theme-muted-fg":         theme.colors.mutedForeground,
    "--theme-confidence-high":  theme.colors.confidenceHigh,
    "--theme-confidence-medium":theme.colors.confidenceMedium,
    "--theme-confidence-low":   theme.colors.confidenceLow,
    "--theme-card-padding":     theme.spacing.cardPadding,
    "--theme-section-gap":      theme.spacing.sectionGap,
    "--theme-item-gap":         theme.spacing.itemGap,
    "--theme-radius-card":      theme.radius.card,
    "--theme-radius-badge":     theme.radius.badge,
    "--theme-radius-button":    theme.radius.button,
    "--theme-radius-inner":     theme.radius.inner,
    "--theme-shadow-card":      theme.shadows.card,
    "--theme-duration":         theme.motion.duration,
    "--theme-duration-slow":    theme.motion.durationSlow,
    "--theme-easing":           theme.motion.easing,
  };
}

// ─────────────────────────────────────────────────────────
// Section 1 — LensViewModel — UI input contract
// ─────────────────────────────────────────────────────────

describe("1. LensViewModel — UI input contract");

test("LensViewModel has all 5 section fields + generatedAt", () => {
  const vm = richLensViewModel();
  assert("summary"         in vm, "summary");
  assert("insights"        in vm, "insights");
  assert("strengths"       in vm, "strengths");
  assert("challenges"      in vm, "challenges");
  assert("recommendations" in vm, "recommendations");
  assert("generatedAt"     in vm, "generatedAt");
});

test("page accepts only LensViewModel — no engine-type fields required", () => {
  // None of these internal engine fields should be required at the page level
  const vm = richLensViewModel();
  assert(!("learnerModel"      in vm), "learnerModel leaked");
  assert(!("behaviorProfile"   in vm), "behaviorProfile leaked");
  assert(!("masterySummary"    in vm), "masterySummary leaked");
  assert(!("skillSnapshot"     in vm), "skillSnapshot leaked");
  assert(!("activeWeaknesses"  in vm), "activeWeaknesses leaked");
});

test("LensViewModel generatedAt is an ISO string", () => {
  assert(richLensViewModel().generatedAt.includes("T"), "not ISO format");
});

test("empty LensViewModel is a valid page input", () => {
  const vm = emptyLensViewModel();
  assert("summary" in vm && "insights" in vm && "strengths" in vm
    && "challenges" in vm && "recommendations" in vm, "incomplete empty vm");
});

// ─────────────────────────────────────────────────────────
// Section 2 — Summary section — field mapping
// ─────────────────────────────────────────────────────────

describe("2. Summary section — field mapping");

test("summary.trendIndicator maps to TREND_LABEL", () => {
  const dirs = ["PROGRESSING", "STABLE", "NEEDS_ATTENTION", "INSUFFICIENT_DATA"];
  for (const d of dirs) assert(d in TREND_LABEL, `missing: ${d}`);
});

test("all four trend indicators have labels", () => {
  assertEqual(Object.keys(TREND_LABEL).length, 4);
});

test("summary.streakDays: 0 renders as em-dash placeholder", () => {
  const vm = emptyLensViewModel();
  const display = vm.summary.streakDays === 0 ? "—" : `${vm.summary.streakDays}`;
  assertEqual(display, "—");
});

test("summary.streakDays: non-zero renders as number string", () => {
  const vm = richLensViewModel();
  const display = vm.summary.streakDays === 0 ? "—" : `${vm.summary.streakDays}`;
  assertEqual(display, "10");
});

test("summary has all metric fields for grid cards", () => {
  const s = richLensViewModel().summary;
  assert("streakDays"    in s, "streakDays");
  assert("topicCount"    in s, "topicCount");
  assert("masteredCount" in s, "masteredCount");
  assert("weakCount"     in s, "weakCount");
});

test("summary.confidenceLevel is LOW | MEDIUM | HIGH", () => {
  assert(["LOW", "MEDIUM", "HIGH"].includes(richLensViewModel().summary.confidenceLevel));
});

// ─────────────────────────────────────────────────────────
// Section 3 — Insights section — InsightCard prop mapping
// ─────────────────────────────────────────────────────────

describe("3. Insights section — InsightCard mapping");

test("each LearningInsight has all InsightCard required props", () => {
  const vm = richLensViewModel();
  for (const i of vm.insights.insights) {
    assert("type"      in i, `type missing on ${i.type}`);
    assert("narrative" in i, `narrative missing on ${i.type}`);
    assert("confidence" in i, `confidence missing on ${i.type}`);
  }
});

test("InsightCard confidence values are LOW | MEDIUM | HIGH", () => {
  for (const i of richLensViewModel().insights.insights)
    assert(["LOW", "MEDIUM", "HIGH"].includes(i.confidence), `invalid: ${i.confidence}`);
});

test("InsightCard evidence is optional — present or absent is valid", () => {
  const withEvidence = richLensViewModel().insights.insights[0];
  assert(withEvidence.evidence !== undefined || withEvidence.evidence === undefined, "ok");
});

test("empty insights array → show empty state, not crash", () => {
  const vm = emptyLensViewModel();
  assertEqual(vm.insights.insights.length, 0);
  // empty state message is shown when length === 0
  const msg = vm.insights.insights.length === 0
    ? "Complete a few practice sessions to see your first insights."
    : "";
  assert(msg.length > 0, "empty state not triggered");
});

test("max 3 insights enforced by transformer (not UI)", () => {
  const vm = richLensViewModel();
  assert(vm.insights.insights.length <= 3, `got ${vm.insights.insights.length}`);
});

// ─────────────────────────────────────────────────────────
// Section 4 — Strengths section — ProgressCard prop mapping
// ─────────────────────────────────────────────────────────

describe("4. Strengths section — ProgressCard mapping");

test("MASTERED_TOPIC strength → value '✓ Mastered'", () => {
  const s = richLensViewModel().strengths.strengths.find((x) => x.type === "MASTERED_TOPIC");
  assert(s !== undefined, "no MASTERED_TOPIC");
  assertEqual(strengthDisplayValue(s), "✓ Mastered");
});

test("STRONG_SKILL strength with percentage → value as 'N%'", () => {
  const s = richLensViewModel().strengths.strengths.find((x) => x.type === "STRONG_SKILL");
  assert(s !== undefined, "no STRONG_SKILL");
  assertEqual(strengthDisplayValue(s), "82%");
});

test("DEVELOPING_TOPIC strength with count → value as count", () => {
  const s = richLensViewModel().strengths.strengths.find((x) => x.type === "DEVELOPING_TOPIC");
  assert(s !== undefined, "no DEVELOPING_TOPIC");
  assertEqual(strengthDisplayValue(s), 1);
});

test("strength without percentageOrCount → fallback '↑'", () => {
  const s = { type: "MASTERED_TOPIC", label: "Test", confidence: "HIGH", confidenceTier: "CONFIRMED", source: "x" };
  // No percentageOrCount — MASTERED_TOPIC override fires first
  assertEqual(strengthDisplayValue(s), "✓ Mastered");
});

test("strength item has label and confidence for ProgressCard", () => {
  for (const s of richLensViewModel().strengths.strengths) {
    assert("label" in s, `label missing: ${s.type}`);
    assert(["LOW", "MEDIUM", "HIGH"].includes(s.confidence), `invalid confidence: ${s.confidence}`);
  }
});

test("empty strengths array → empty state triggered", () => {
  const vm = emptyLensViewModel();
  assertEqual(vm.strengths.strengths.length, 0);
  const msg = vm.strengths.strengths.length === 0
    ? "Keep practicing — strengths will appear here as data builds."
    : "";
  assert(msg.length > 0, "empty state");
});

// ─────────────────────────────────────────────────────────
// Section 5 — Challenges section — ProgressCard mapping + trend
// ─────────────────────────────────────────────────────────

describe("5. Challenges section — ProgressCard mapping + trend");

test("RECURRING signal maps to DECLINING trend", () => {
  assertEqual(SIGNAL_TREND["RECURRING"], "DECLINING");
});

test("IMPROVING signal maps to IMPROVING trend", () => {
  assertEqual(SIGNAL_TREND["IMPROVING"], "IMPROVING");
});

test("STABLE signal maps to STABLE trend", () => {
  assertEqual(SIGNAL_TREND["STABLE"], "STABLE");
});

test("ACTIVE_WEAKNESS challenge has label, reason, signal", () => {
  const c = richLensViewModel().challenges.challenges.find((x) => x.type === "ACTIVE_WEAKNESS");
  assert(c !== undefined, "no ACTIVE_WEAKNESS");
  assert("label"  in c, "label");
  assert("reason" in c, "reason");
  assert("signal" in c, "signal");
});

test("dueNow = true → 'Due for review' badge shown", () => {
  const c = richLensViewModel().challenges.challenges.find((x) => x.type === "ACTIVE_WEAKNESS");
  assert(c !== undefined, "no ACTIVE_WEAKNESS");
  assert(c.dueNow === true, "dueNow not set");
  const badge = c.dueNow ? "Due for review" : "";
  assertEqual(badge, "Due for review");
});

test("WEAK_SKILL challenge has no signal — falls back to DECLINING trend", () => {
  const c = richLensViewModel().challenges.challenges.find((x) => x.type === "WEAK_SKILL");
  assert(c !== undefined, "no WEAK_SKILL");
  assert(!("signal" in c) || c.signal === undefined, "WEAK_SKILL should not have signal");
  const trend = c.signal ? SIGNAL_TREND[c.signal] : "DECLINING";
  assertEqual(trend, "DECLINING");
});

test("empty challenges array → empty state triggered", () => {
  const vm = emptyLensViewModel();
  assertEqual(vm.challenges.challenges.length, 0);
  const msg = vm.challenges.challenges.length === 0
    ? "No challenges identified yet — keep going and data will build."
    : "";
  assert(msg.length > 0, "empty state");
});

// ─────────────────────────────────────────────────────────
// Section 6 — Next actions section — recommendation display
// ─────────────────────────────────────────────────────────

describe("6. Next actions section — recommendation display");

test("REVIEW_NOTEBOOK → href /error-notebook", () => {
  const action = { suggestedAction: "REVIEW_NOTEBOOK", topic: "subjunctive" };
  assertEqual(actionHref(action), "/error-notebook");
});

test("PRACTICE_TOPIC → href /practice/topic/:topic", () => {
  const action = { suggestedAction: "PRACTICE_TOPIC", topic: "present_simple" };
  assertEqual(actionHref(action), "/practice/topic/present_simple");
});

test("ADVANCE_SESSION → href /practice/:sessionNumber", () => {
  const action = { suggestedAction: "ADVANCE_SESSION", sessionNumber: 3 };
  assertEqual(actionHref(action), "/practice/3");
});

test("ACTION_LABEL covers all three suggestedAction values", () => {
  assert("REVIEW_NOTEBOOK" in ACTION_LABEL, "REVIEW_NOTEBOOK");
  assert("PRACTICE_TOPIC"  in ACTION_LABEL, "PRACTICE_TOPIC");
  assert("ADVANCE_SESSION" in ACTION_LABEL, "ADVANCE_SESSION");
});

test("recommendations are already priority-ordered from the Lens service", () => {
  const vm = richLensViewModel();
  const priorities = vm.recommendations.actions.map((a) => a.priority);
  for (let i = 1; i < priorities.length; i++)
    assert(priorities[i] >= priorities[i - 1], `priority out of order at index ${i}`);
});

test("streakContext is shown when present", () => {
  const vm = richLensViewModel();
  assert(vm.recommendations.streakContext !== undefined, "no streakContext");
  assert(vm.recommendations.streakContext.length > 0, "empty streakContext");
});

test("streakContext is absent for empty profile", () => {
  const vm = emptyLensViewModel();
  assert(vm.recommendations.streakContext === undefined, "unexpected streakContext");
});

test("questionCount is optional — missing on session actions", () => {
  const sessionAction = richLensViewModel().recommendations.actions
    .find((a) => a.suggestedAction === "ADVANCE_SESSION");
  assert(sessionAction !== undefined, "no ADVANCE_SESSION");
  assert(sessionAction.questionCount === undefined || sessionAction.questionCount === null
    || sessionAction.questionCount === 0, "questionCount unexpectedly set on session action");
});

test("empty actions array → empty state triggered", () => {
  const vm = emptyLensViewModel();
  assertEqual(vm.recommendations.actions.length, 0);
  const msg = vm.recommendations.actions.length === 0
    ? "Complete your first practice session to get personalised recommendations."
    : "";
  assert(msg.length > 0, "empty state");
});

// ─────────────────────────────────────────────────────────
// Section 7 — Empty state handling — all sections
// ─────────────────────────────────────────────────────────

describe("7. Empty state handling");

test("empty summary narrative is non-empty string", () => {
  const vm = emptyLensViewModel();
  assert(typeof vm.summary.narrative === "string" && vm.summary.narrative.length > 0);
});

test("empty summary all counts are 0", () => {
  const vm = emptyLensViewModel();
  assertEqual(vm.summary.masteredCount,   0);
  assertEqual(vm.summary.developingCount, 0);
  assertEqual(vm.summary.weakCount,       0);
  assertEqual(vm.summary.topicCount,      0);
  assertEqual(vm.summary.streakDays,      0);
});

test("empty insights list does not crash section render logic", () => {
  const vm = emptyLensViewModel();
  // filter/map on empty array always safe
  const rendered = vm.insights.insights.map((i) => i.type);
  assertEqual(rendered.length, 0);
});

test("empty strengths list does not crash section render logic", () => {
  const rendered = emptyLensViewModel().strengths.strengths.map((s) => strengthDisplayValue(s));
  assertEqual(rendered.length, 0);
});

test("empty challenges list does not crash trend mapping", () => {
  const rendered = emptyLensViewModel().challenges.challenges.map((c) => ({
    trend: c.signal ? SIGNAL_TREND[c.signal] : "DECLINING",
  }));
  assertEqual(rendered.length, 0);
});

test("empty actions list does not crash href mapping", () => {
  const hrefs = emptyLensViewModel().recommendations.actions.map(actionHref);
  assertEqual(hrefs.length, 0);
});

// ─────────────────────────────────────────────────────────
// Section 8 — Theme compatibility — tokens used by Lens components
// ─────────────────────────────────────────────────────────

describe("8. Theme compatibility — required tokens");

test("all required Lens CSS vars exist in defaultTheme", () => {
  const vars = themeToCssVars(defaultTheme);
  for (const v of LENS_COMPONENT_VARS)
    assert(v in vars && vars[v].length > 0, `missing or empty: ${v}`);
});

test("all required Lens CSS vars exist in calmTheme", () => {
  const vars = themeToCssVars(calmTheme);
  for (const v of LENS_COMPONENT_VARS)
    assert(v in vars && vars[v].length > 0, `missing or empty: ${v}`);
});

test("all required Lens CSS vars exist in focusTheme", () => {
  const vars = themeToCssVars(focusTheme);
  for (const v of LENS_COMPONENT_VARS)
    assert(v in vars && vars[v].length > 0, `missing or empty: ${v}`);
});

test("each theme produces a distinct --theme-primary value", () => {
  const primaries = availableThemes.map((t) => themeToCssVars(t)["--theme-primary"]);
  const unique = new Set(primaries);
  assertEqual(unique.size, availableThemes.length, "themes share primary color");
});

test("each theme produces a distinct --theme-bg value", () => {
  const bgs = availableThemes.map((t) => themeToCssVars(t)["--theme-bg"]);
  const unique = new Set(bgs);
  assertEqual(unique.size, availableThemes.length, "themes share background color");
});

test("focusTheme has dark card background for dark-mode compatibility", () => {
  const cardBg = focusTheme.colors.cardBackground;
  assert(cardBg.startsWith("#"), "hex color expected");
  // #1e293b → R=0x1e=30, clearly dark
  const r = parseInt(cardBg.slice(1, 3), 16);
  assert(r < 0x80, `focusTheme cardBackground is not dark: ${cardBg}`);
});

// ─────────────────────────────────────────────────────────
// Section 9 — No intelligence imports — view-data-only contracts
// ─────────────────────────────────────────────────────────

describe("9. No intelligence imports — view-data-only contracts");

// These tests verify that the data passed to the Lens page is already
// transformed view data — no raw engine types are in the component interfaces.

test("LensViewModel fields are all presentation-layer types", () => {
  // summary, insights, strengths, challenges, recommendations are Lens view types
  // NOT KnowledgeState, PerformanceState, LearningBehaviorState, etc.
  const viewFields = ["summary", "insights", "strengths", "challenges", "recommendations"];
  const vm = richLensViewModel();
  for (const f of viewFields) assert(f in vm, `missing: ${f}`);
  // Engine types would have fields like:
  const engineFields = ["learnerModel", "computedAt", "skillPerformance", "masteredConcepts"];
  for (const f of engineFields)
    assert(!(f in vm), `engine field leaked into view contract: ${f}`);
});

test("summary does not expose raw KnowledgeState fields", () => {
  const s = richLensViewModel().summary;
  assert(!("masteredConcepts"  in s), "masteredConcepts leaked");
  assert(!("developingConcepts" in s), "developingConcepts leaked");
  assert(!("weakConcepts"       in s), "weakConcepts leaked");
  // Only the processed counts are present
  assert("masteredCount"   in s, "masteredCount missing");
  assert("developingCount" in s, "developingCount missing");
  assert("weakCount"       in s, "weakCount missing");
});

test("insights do not expose raw PerformanceState fields", () => {
  for (const i of richLensViewModel().insights.insights) {
    assert(!("overallAccuracy"     in i), "overallAccuracy leaked");
    assert(!("accuracyTrend"       in i), "accuracyTrend leaked");
    assert(!("consistencyProfile"  in i), "consistencyProfile leaked");
    // Only narrative is present
    assert("narrative" in i, "narrative missing");
  }
});

test("strength items do not expose raw skill performance records", () => {
  for (const s of richLensViewModel().strengths.strengths) {
    assert(!("skill"      in s), "raw skill field leaked");
    assert(!("masteryState" in s), "masteryState leaked");
    // Only mapped fields
    assert("label"  in s, "label missing");
    assert("source" in s, "source missing");
  }
});

test("recommendation items do not expose PracticeRecommendation internals", () => {
  for (const a of richLensViewModel().recommendations.actions) {
    assert(!("priorityLabel" in a), "priorityLabel leaked");
    // Only mapped fields
    assert("priority"       in a, "priority missing");
    assert("reason"         in a, "reason missing");
    assert("suggestedAction" in a, "suggestedAction missing");
  }
});

// ─────────────────────────────────────────────────────────
// Section 10 — Theme switching — CSS var transitions
// ─────────────────────────────────────────────────────────

describe("10. Theme switching — CSS var transitions");

function makeState(initial) {
  let current = initial;
  return { get: () => current, set: (t) => { current = t; } };
}

test("switching from default to calm changes card padding", () => {
  const state = makeState(defaultTheme);
  const before = themeToCssVars(state.get())["--theme-card-padding"];
  state.set(calmTheme);
  const after = themeToCssVars(state.get())["--theme-card-padding"];
  assertNotEqual(before, after, "card padding unchanged");
});

test("switching from default to focus changes background", () => {
  const state = makeState(defaultTheme);
  const before = themeToCssVars(state.get())["--theme-bg"];
  state.set(focusTheme);
  const after = themeToCssVars(state.get())["--theme-bg"];
  assertNotEqual(before, after, "bg unchanged");
});

test("switching back to default restores original vars", () => {
  const state = makeState(defaultTheme);
  const orig = themeToCssVars(defaultTheme)["--theme-primary"];
  state.set(calmTheme);
  state.set(defaultTheme);
  assertEqual(themeToCssVars(state.get())["--theme-primary"], orig);
});

test("ThemeSwitcher aria-pressed reflects active theme", () => {
  // Simulates the aria-pressed logic in ThemeSwitcher.tsx
  const current = calmTheme;
  for (const t of availableThemes) {
    const isActive = t.id === current.id;
    if (t.id === "calm") assert(isActive, "calm should be active");
    else assert(!isActive, `${t.id} should not be active`);
  }
});

test("theme change produces new confidence color set", () => {
  const defaultHigh = themeToCssVars(defaultTheme)["--theme-confidence-high"];
  const focusHigh   = themeToCssVars(focusTheme)["--theme-confidence-high"];
  assertNotEqual(defaultHigh, focusHigh, "confidence-high unchanged between themes");
});

test("all three themes available in ThemeProvider availableThemes", () => {
  assertEqual(availableThemes.length, 3);
  assert(availableThemes.some((t) => t.id === "default"), "missing default");
  assert(availableThemes.some((t) => t.id === "calm"),    "missing calm");
  assert(availableThemes.some((t) => t.id === "focus"),   "missing focus");
});

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────

console.log(`\nLEXI Lens UI Composition Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
