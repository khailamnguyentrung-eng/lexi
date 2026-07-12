/**
 * test-behavior-engine.mjs
 *
 * Validates all pure functions from lib/analytics/behaviorEngine.ts.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions and derivation helpers.
 *
 * Run: node scripts/test-behavior-engine.mjs
 */

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ── Inlined helpers (mirrors lib/analytics/behaviorEngine.ts) ────────────────

function deriveTimeOfDay(sessions) {
  const withStart = sessions.filter((s) => s.startedAt != null);
  if (withStart.length < 5) return null;
  const buckets = { MORNING: 0, AFTERNOON: 0, EVENING: 0 };
  for (const s of withStart) {
    const hour = s.startedAt.getHours();
    if (hour >= 6 && hour < 12) buckets.MORNING++;
    else if (hour >= 12 && hour < 18) buckets.AFTERNOON++;
    else buckets.EVENING++;
  }
  const dominant = Object.entries(buckets).reduce((a, b) => (b[1] > a[1] ? b : a));
  return dominant[1] > withStart.length / 2 ? dominant[0] : null;
}

function derivePaceProfile(sessions) {
  const withAttempts = sessions.filter((s) => s.attempts.length >= 3);
  if (withAttempts.length < 3) return null;
  let decliningCount = 0;
  let consistentCount = 0;
  for (const s of withAttempts) {
    const sorted = [...s.attempts].sort(
      (a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime()
    );
    const third = Math.max(1, Math.floor(sorted.length / 3));
    const first = sorted.slice(0, third);
    const last = sorted.slice(sorted.length - third);
    const firstAcc = first.filter((a) => a.isCorrect).length / first.length;
    const lastAcc = last.filter((a) => a.isCorrect).length / last.length;
    const delta = firstAcc - lastAcc;
    if (delta >= 0.15) decliningCount++;
    else if (Math.abs(delta) < 0.15) consistentCount++;
  }
  const total = withAttempts.length;
  const majority = total / 2;
  if (decliningCount > majority) return "DECLINING";
  if (consistentCount > majority) return "CONSISTENT";
  return "VARIABLE";
}

function deriveAvgDuration(sessions) {
  const durations = [];
  for (const s of sessions) {
    if (s.startedAt != null && s.completedAt != null) {
      const mins = (s.completedAt.getTime() - s.startedAt.getTime()) / 60000;
      if (mins > 0 && mins < 300) durations.push(mins);
    }
  }
  if (durations.length === 0) return null;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(avg * 10) / 10;
}

function deriveResponseTimeSignal(sessions) {
  const timings = [];
  for (const s of sessions) {
    for (const a of s.attempts) {
      if (a.timeSpentSec != null) timings.push(a.timeSpentSec);
    }
  }
  if (timings.length < 5) return null;
  const sorted = [...timings].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  if (median >= 30) return "EXTENDED";
  if (median >= 10) return "MODERATE";
  return "BRIEF";
}

function deriveMoodContext(moodEntries) {
  if (moodEntries.length < 5) return null;
  const recent = moodEntries.slice(0, 7);
  const positive = recent.filter((m) => m.mood === "GREAT" || m.mood === "GOOD").length;
  const negative = recent.filter((m) => m.mood === "TIRED" || m.mood === "STRESSED").length;
  const majority = recent.length / 2;
  if (positive > majority) return "POSITIVE";
  if (negative > majority) return "NEGATIVE";
  return "NEUTRAL";
}

function deriveConfidenceTier(sessionCount) {
  if (sessionCount >= 10) return "CONFIRMED";
  if (sessionCount >= 5) return "EMERGING";
  return "OBSERVED";
}

function computeBehaviorProfile(sessions, moodEntries) {
  return {
    preferredTimeOfDay: deriveTimeOfDay(sessions),
    paceProfile: derivePaceProfile(sessions),
    avgSessionDurationMin: deriveAvgDuration(sessions),
    responseTimeSignal: deriveResponseTimeSignal(sessions),
    recentMoodContext: deriveMoodContext(moodEntries),
    sessionCount: sessions.length,
    confidenceTier: deriveConfidenceTier(sessions.length),
  };
}

// ── Helpers for building test data ───────────────────────────────────────────

function makeDate(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

function makeSession(startHour, endHour, attempts) {
  return {
    startedAt: startHour != null ? makeDate(startHour) : null,
    completedAt: endHour != null ? makeDate(endHour) : null,
    attempts: attempts ?? [],
  };
}

function makeAttempt(isCorrect, timeSpentSec = null, offsetMs = 0) {
  return {
    isCorrect,
    timeSpentSec,
    attemptedAt: new Date(Date.now() + offsetMs),
  };
}

function makeMood(mood) {
  return { mood, createdAt: new Date() };
}

// ── deriveTimeOfDay ───────────────────────────────────────────────────────────

console.log("\n── deriveTimeOfDay ──────────────────────────────────────────────");

{
  const sessions = Array.from({ length: 6 }, () => makeSession(9, 10, []));
  assert("6 morning sessions → MORNING", deriveTimeOfDay(sessions) === "MORNING");
}
{
  const sessions = Array.from({ length: 6 }, () => makeSession(15, 16, []));
  assert("6 afternoon sessions → AFTERNOON", deriveTimeOfDay(sessions) === "AFTERNOON");
}
{
  const sessions = Array.from({ length: 6 }, () => makeSession(20, 21, []));
  assert("6 evening sessions → EVENING", deriveTimeOfDay(sessions) === "EVENING");
}
{
  const sessions = Array.from({ length: 4 }, () => makeSession(9, 10, []));
  assert("< 5 sessions → null", deriveTimeOfDay(sessions) === null);
}
{
  const sessions = Array.from({ length: 6 }, () => makeSession(null, null, []));
  assert("no startedAt → null", deriveTimeOfDay(sessions) === null);
}
{
  // 3 morning + 2 afternoon + 1 evening = no majority
  const sessions = [
    makeSession(9, 10, []),
    makeSession(9, 10, []),
    makeSession(9, 10, []),
    makeSession(14, 15, []),
    makeSession(14, 15, []),
    makeSession(20, 21, []),
  ];
  assert("no dominant bucket → null", deriveTimeOfDay(sessions) === null);
}

// ── derivePaceProfile ─────────────────────────────────────────────────────────

console.log("\n── derivePaceProfile ────────────────────────────────────────────");

function makeSessionWithAccuracy(firstThirdCorrect, lastThirdCorrect, n = 9) {
  // n must be divisible by 3 for clean thirds
  const third = n / 3;
  const attempts = [];
  for (let i = 0; i < third; i++) {
    attempts.push(makeAttempt(i < firstThirdCorrect * third, null, i * 100));
  }
  for (let i = 0; i < third; i++) {
    attempts.push(makeAttempt(false, null, (third + i) * 100)); // middle
  }
  for (let i = 0; i < third; i++) {
    attempts.push(makeAttempt(i < lastThirdCorrect * third, null, (third * 2 + i) * 100));
  }
  return makeSession(9, 10, attempts);
}

{
  // All sessions: first=0.9 last=0.9 (delta < 0.15 → consistent)
  const sessions = Array.from({ length: 4 }, () =>
    makeSessionWithAccuracy(1.0, 1.0)
  );
  assert("all consistent sessions → CONSISTENT", derivePaceProfile(sessions) === "CONSISTENT");
}
{
  // All sessions: first=0.9 last=0.4 (delta = 0.5 → declining)
  const sessions = Array.from({ length: 4 }, () =>
    makeSessionWithAccuracy(1.0, 0.33)
  );
  assert("all declining sessions → DECLINING", derivePaceProfile(sessions) === "DECLINING");
}
{
  // Mix: 2 consistent, 1 declining, 1 variable — no majority
  const sessions = [
    makeSessionWithAccuracy(1.0, 1.0),
    makeSessionWithAccuracy(1.0, 1.0),
    makeSessionWithAccuracy(1.0, 0.0),
    makeSessionWithAccuracy(0.5, 1.0), // improving, counts as neither
  ];
  assert("no majority pattern → VARIABLE", derivePaceProfile(sessions) === "VARIABLE");
}
{
  const sessions = Array.from({ length: 2 }, () => makeSessionWithAccuracy(1.0, 1.0));
  assert("< 3 sessions → null", derivePaceProfile(sessions) === null);
}
{
  // Sessions with fewer than 3 attempts are excluded
  const sessions = Array.from({ length: 5 }, () => makeSession(9, 10, [makeAttempt(true)]));
  assert("sessions with < 3 attempts excluded → null", derivePaceProfile(sessions) === null);
}

// ── deriveAvgDuration ─────────────────────────────────────────────────────────

console.log("\n── deriveAvgDuration ────────────────────────────────────────────");

{
  // 20 min session + 40 min session → avg 30
  const start = new Date("2026-06-01T09:00:00Z");
  const end20 = new Date("2026-06-01T09:20:00Z");
  const end40 = new Date("2026-06-01T09:40:00Z");
  const sessions = [
    { startedAt: start, completedAt: end20, attempts: [] },
    { startedAt: start, completedAt: end40, attempts: [] },
  ];
  assert("avg of 20 and 40 min → 30", deriveAvgDuration(sessions) === 30);
}
{
  const sessions = [makeSession(null, null, []), makeSession(9, null, [])];
  assert("no startedAt/completedAt pairs → null", deriveAvgDuration(sessions) === null);
}
{
  // Implausibly long session (> 300 min) should be discarded
  const start = new Date("2026-06-01T09:00:00Z");
  const badEnd = new Date("2026-06-01T15:00:00Z"); // 360 min
  const goodEnd = new Date("2026-06-01T09:20:00Z"); // 20 min
  const sessions = [
    { startedAt: start, completedAt: badEnd, attempts: [] },
    { startedAt: start, completedAt: goodEnd, attempts: [] },
  ];
  assert("implausible duration discarded → avg of valid only",
    deriveAvgDuration(sessions) === 20);
}

// ── deriveResponseTimeSignal ──────────────────────────────────────────────────

console.log("\n── deriveResponseTimeSignal ─────────────────────────────────────");

function makeSessionWithTimings(timings) {
  return makeSession(9, 10, timings.map((t) => makeAttempt(true, t)));
}

{
  const sessions = [makeSessionWithTimings([45, 50, 40, 60, 35])];
  assert("median = 45s → EXTENDED", deriveResponseTimeSignal(sessions) === "EXTENDED");
}
{
  const sessions = [makeSessionWithTimings([18, 20, 22, 15, 19])];
  assert("median = 19s → MODERATE", deriveResponseTimeSignal(sessions) === "MODERATE");
}
{
  const sessions = [makeSessionWithTimings([3, 5, 7, 4, 6])];
  assert("median = 5s → BRIEF", deriveResponseTimeSignal(sessions) === "BRIEF");
}
{
  const sessions = [makeSessionWithTimings([30, 40, 50, 45])]; // only 4 records
  assert("< 5 non-null records → null", deriveResponseTimeSignal(sessions) === null);
}
{
  const sessions = [makeSession(9, 10, [
    makeAttempt(true, null),
    makeAttempt(true, null),
    makeAttempt(true, null),
    makeAttempt(true, null),
    makeAttempt(true, null),
  ])];
  assert("all timeSpentSec null → null", deriveResponseTimeSignal(sessions) === null);
}
{
  // Even-count median: [10, 20] → (10+20)/2 = 15 → MODERATE
  const sessions = [makeSessionWithTimings([10, 20, 15, 18, 12, 14])];
  assert("even count median works correctly",
    deriveResponseTimeSignal(sessions) === "MODERATE");
}

// ── deriveMoodContext ─────────────────────────────────────────────────────────

console.log("\n── deriveMoodContext ────────────────────────────────────────────");

{
  const moods = [
    makeMood("GREAT"),
    makeMood("GREAT"),
    makeMood("GOOD"),
    makeMood("GOOD"),
    makeMood("OKAY"),
  ];
  assert("4 positive out of 5 → POSITIVE", deriveMoodContext(moods) === "POSITIVE");
}
{
  const moods = [
    makeMood("TIRED"),
    makeMood("STRESSED"),
    makeMood("TIRED"),
    makeMood("STRESSED"),
    makeMood("OKAY"),
  ];
  assert("4 negative out of 5 → NEGATIVE", deriveMoodContext(moods) === "NEGATIVE");
}
{
  const moods = [
    makeMood("OKAY"),
    makeMood("OKAY"),
    makeMood("GOOD"),
    makeMood("TIRED"),
    makeMood("OKAY"),
  ];
  assert("mixed → NEUTRAL", deriveMoodContext(moods) === "NEUTRAL");
}
{
  const moods = [makeMood("GREAT"), makeMood("GOOD"), makeMood("GREAT"), makeMood("GOOD")];
  assert("< 5 entries → null", deriveMoodContext(moods) === null);
}
{
  // Exactly 7 provided — should use all 7
  const moods = [
    makeMood("GREAT"),
    makeMood("GREAT"),
    makeMood("GREAT"),
    makeMood("GREAT"),
    makeMood("OKAY"),
    makeMood("OKAY"),
    makeMood("OKAY"),
  ];
  assert("4 of 7 positive → POSITIVE", deriveMoodContext(moods) === "POSITIVE");
}

// ── deriveConfidenceTier ──────────────────────────────────────────────────────

console.log("\n── deriveConfidenceTier ─────────────────────────────────────────");

assert("0 sessions → OBSERVED",  deriveConfidenceTier(0)  === "OBSERVED");
assert("4 sessions → OBSERVED",  deriveConfidenceTier(4)  === "OBSERVED");
assert("5 sessions → EMERGING",  deriveConfidenceTier(5)  === "EMERGING");
assert("9 sessions → EMERGING",  deriveConfidenceTier(9)  === "EMERGING");
assert("10 sessions → CONFIRMED", deriveConfidenceTier(10) === "CONFIRMED");
assert("20 sessions → CONFIRMED", deriveConfidenceTier(20) === "CONFIRMED");

// ── computeBehaviorProfile: all-null scenario ─────────────────────────────────

console.log("\n── computeBehaviorProfile: all-null / empty ─────────────────────");

{
  const profile = computeBehaviorProfile([], []);
  assert("empty: preferredTimeOfDay null",  profile.preferredTimeOfDay === null);
  assert("empty: paceProfile null",         profile.paceProfile === null);
  assert("empty: avgSessionDurationMin null", profile.avgSessionDurationMin === null);
  assert("empty: responseTimeSignal null",  profile.responseTimeSignal === null);
  assert("empty: recentMoodContext null",   profile.recentMoodContext === null);
  assert("empty: sessionCount = 0",         profile.sessionCount === 0);
  assert("empty: confidenceTier OBSERVED",  profile.confidenceTier === "OBSERVED");
}

// ── computeBehaviorProfile: full data ────────────────────────────────────────

console.log("\n── computeBehaviorProfile: full data scenario ───────────────────");

{
  const start = makeDate(9);
  const end = new Date(start.getTime() + 30 * 60000);

  const sessions = Array.from({ length: 10 }, () => ({
    startedAt: start,
    completedAt: end,
    attempts: [
      makeAttempt(true, 35, 0),
      makeAttempt(true, 40, 1000),
      makeAttempt(true, 38, 2000),
      makeAttempt(true, 35, 3000),
      makeAttempt(true, 42, 4000),
      makeAttempt(true, 36, 5000),
      makeAttempt(true, 35, 6000),
      makeAttempt(true, 38, 7000),
      makeAttempt(true, 40, 8000),
    ],
  }));

  const moods = Array.from({ length: 7 }, () => makeMood("GREAT"));

  const profile = computeBehaviorProfile(sessions, moods);
  assert("full: sessionCount = 10",          profile.sessionCount === 10);
  assert("full: confidenceTier CONFIRMED",   profile.confidenceTier === "CONFIRMED");
  assert("full: preferredTimeOfDay MORNING", profile.preferredTimeOfDay === "MORNING");
  assert("full: avgSessionDurationMin = 30", profile.avgSessionDurationMin === 30);
  assert("full: responseTimeSignal EXTENDED",profile.responseTimeSignal === "EXTENDED");
  assert("full: recentMoodContext POSITIVE", profile.recentMoodContext === "POSITIVE");
  assert("full: paceProfile not null",       profile.paceProfile !== null);
}

// ── computeBehaviorProfile: partial data ─────────────────────────────────────

console.log("\n── computeBehaviorProfile: partial data ─────────────────────────");

{
  // Sessions exist but no startedAt — duration and time-of-day null
  const sessions = Array.from({ length: 6 }, () =>
    makeSession(null, null, [
      makeAttempt(true, 25, 0),
      makeAttempt(true, 20, 1000),
      makeAttempt(true, 30, 2000),
      makeAttempt(true, 22, 3000),
      makeAttempt(true, 28, 4000),
    ])
  );
  const profile = computeBehaviorProfile(sessions, []);
  assert("partial: preferredTimeOfDay null (no startedAt)", profile.preferredTimeOfDay === null);
  assert("partial: avgSessionDurationMin null (no timestamps)", profile.avgSessionDurationMin === null);
  assert("partial: responseTimeSignal computed (timings present)",
    profile.responseTimeSignal !== null);
  assert("partial: recentMoodContext null (no moods)", profile.recentMoodContext === null);
  assert("partial: sessionCount = 6", profile.sessionCount === 6);
  assert("partial: confidenceTier EMERGING", profile.confidenceTier === "EMERGING");
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`✓ All ${total} tests passed`);
} else {
  console.error(`✗ ${failed}/${total} tests failed`);
  process.exit(1);
}
