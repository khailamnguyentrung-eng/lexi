/**
 * test-profile-v2.mjs
 *
 * Validates M2.5 additions to StudentLearningProfile:
 *   - computeGoalCountdown() pure function
 *   - currentStreak, topSignal, goalCountdown fields in buildLearningProfile()
 *
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions under test.
 *
 * Run: node scripts/test-profile-v2.mjs
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

// ── Inlined computeGoalCountdown ──────────────────────────────────────────────

function computeGoalCountdown(targetGoalDate, now) {
  if (!targetGoalDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((targetGoalDate.getTime() - now.getTime()) / msPerDay);
  return {
    targetGoalDate: targetGoalDate.toISOString().split("T")[0],
    daysRemaining,
    isUrgent: daysRemaining > 0 && daysRemaining <= 30,
  };
}

// ── Inlined buildLearningProfile (with M2.5 additions) ───────────────────────

function countByMasteryState(profiles) {
  const counts = { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 0 };
  for (const p of profiles) counts[p.masteryState] += 1;
  return counts;
}

function buildMasterySummary(profiles) {
  const byState = countByMasteryState(profiles);
  return {
    totalTopics: profiles.length,
    byState,
    masteredTopics: profiles.filter(p => p.masteryState === "MASTERED").map(p => p.label),
    needsReviewTopics: profiles.filter(p => p.masteryState === "NEEDS_REVIEW").map(p => p.label).slice(0, 5),
  };
}

function deriveLearningTrend(profiles, recurringCount) {
  if (profiles.length === 0) return "INSUFFICIENT_DATA";
  const counts = countByMasteryState(profiles);
  const positiveCount = counts.MASTERED + counts.STABLE + counts.IMPROVING;
  if (recurringCount > 0 || counts.NEEDS_REVIEW > positiveCount) return "NEEDS_ATTENTION";
  if (counts.MASTERED > 0 || counts.IMPROVING >= counts.NEEDS_REVIEW) return "PROGRESSING";
  return "STABLE";
}

function buildActiveWeaknesses(summaries, masteryByTopic) {
  const weaknesses = [];
  for (const s of summaries) {
    if (weaknesses.length >= 5) break;
    const masteryState = masteryByTopic.get(s.topic) ?? "NEEDS_REVIEW";
    if (masteryState === "MASTERED") continue;
    if (s.improvementSignal === "RECURRING" || masteryState === "NEEDS_REVIEW") {
      weaknesses.push({
        topic: s.topic, label: s.label, signal: s.improvementSignal,
        isRemedialFlagged: s.isRemedialFlagged, dueCount: s.dueCount,
        masteryState, totalOccurrences: s.totalOccurrences,
      });
    }
  }
  return weaknesses;
}

function buildLearningProfile(ctx) {
  const masterySummary = buildMasterySummary(ctx.masteryProfiles);
  const recurringCount = ctx.topicSummaries.filter(s => s.improvementSignal === "RECURRING").length;
  const learningTrend = deriveLearningTrend(ctx.masteryProfiles, recurringCount);
  const activeWeaknesses = buildActiveWeaknesses(ctx.topicSummaries, ctx.masteryByTopic);
  const improvingTopics = ctx.masteryProfiles.filter(
    p => p.masteryState === "IMPROVING" || p.masteryState === "STABLE"
  );
  return {
    userId: ctx.userId,
    generatedAt: ctx.generatedAt,
    readiness: ctx.readiness,
    masterySummary,
    skillSnapshot: ctx.skillSnapshot,
    learningTrend,
    improvingTopics,
    activeWeaknesses,
    recommendations: ctx.recommendations,
    nextMission: ctx.nextMission,
    behaviorProfile: ctx.behaviorProfile,
    // M2.5 fields
    currentStreak: ctx.currentStreak,
    goalCountdown: computeGoalCountdown(ctx.targetGoalDate, new Date()),
    topSignal: null, // overridden by two-pass in service; null in pure builder
  };
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeBehaviorProfile(overrides = {}) {
  return {
    preferredTimeOfDay: null, paceProfile: null, avgSessionDurationMin: null,
    responseTimeSignal: null, recentMoodContext: null, sessionCount: 0,
    confidenceTier: "OBSERVED", ...overrides,
  };
}

function emptyCtx(overrides = {}) {
  return {
    userId: "test-user",
    generatedAt: new Date().toISOString(),
    topicSummaries: [],
    masteryProfiles: [],
    masteryByTopic: new Map(),
    recommendations: [],
    readiness: null,
    skillSnapshot: [],
    nextMission: null,
    behaviorProfile: makeBehaviorProfile(),
    currentStreak: 0,
    targetGoalDate: null,
    ...overrides,
  };
}

// ── computeGoalCountdown ──────────────────────────────────────────────────────

console.log("\n── computeGoalCountdown: null input ─────────────────────────────");

assert("null targetGoalDate → null output", computeGoalCountdown(null, new Date()) === null);

console.log("\n── computeGoalCountdown: future dates ───────────────────────────");

{
  const now = new Date("2026-06-29T12:00:00Z");
  const future = new Date("2026-08-13T00:00:00Z"); // 45 days later
  const result = computeGoalCountdown(future, now);
  assert("future date → non-null", result !== null);
  assert("daysRemaining is positive for future date", result.daysRemaining > 0);
  assert("daysRemaining = 45", result.daysRemaining === 45);
  assert("isUrgent = false for 45 days", result.isUrgent === false);
  assert("targetGoalDate is YYYY-MM-DD string", result.targetGoalDate === "2026-08-13");
}

{
  // 20 days remaining → urgent
  const now = new Date("2026-06-29T00:00:00Z");
  const future = new Date("2026-07-19T00:00:00Z");
  const result = computeGoalCountdown(future, now);
  assert("20 days remaining → isUrgent = true", result.isUrgent === true);
  assert("20 days remaining → daysRemaining = 20", result.daysRemaining === 20);
}

{
  // 30 days remaining → urgent (boundary)
  const now = new Date("2026-06-29T00:00:00Z");
  const future = new Date("2026-07-29T00:00:00Z");
  const result = computeGoalCountdown(future, now);
  assert("30 days remaining → isUrgent = true (boundary inclusive)", result.isUrgent === true);
}

{
  // 31 days remaining → not urgent (just above boundary)
  const now = new Date("2026-06-29T00:00:00Z");
  const future = new Date("2026-07-30T00:00:00Z");
  const result = computeGoalCountdown(future, now);
  assert("31 days remaining → isUrgent = false (just above boundary)", result.isUrgent === false);
}

console.log("\n── computeGoalCountdown: past and boundary dates ────────────────");

{
  // Past date → daysRemaining negative
  const now = new Date("2026-06-29T12:00:00Z");
  const past = new Date("2026-06-19T00:00:00Z");
  const result = computeGoalCountdown(past, now);
  assert("past date → daysRemaining negative", result.daysRemaining < 0);
  assert("past date → isUrgent = false (exam already passed)", result.isUrgent === false);
}

{
  // daysRemaining = 0 → not urgent (goal date is today)
  const now = new Date("2026-07-01T12:00:00Z");
  const today = new Date("2026-07-01T00:00:00Z");
  // Math.ceil((today - now) / msPerDay) = ceil(-0.5) = 0
  const result = computeGoalCountdown(today, now);
  assert("daysRemaining = 0 → isUrgent = false", result.isUrgent === false);
}

{
  // Less than 24h remaining → Math.ceil rounds UP to 1 day
  const now = new Date("2026-07-01T06:00:00Z");
  const tomorrow = new Date("2026-07-02T00:00:00Z"); // 18h away
  const result = computeGoalCountdown(tomorrow, now);
  assert("18h remaining → daysRemaining = 1 (ceil rounds up)", result.daysRemaining === 1);
  assert("18h remaining → isUrgent = true", result.isUrgent === true);
}

// ── buildLearningProfile — M2.5 new fields ────────────────────────────────────

console.log("\n── buildLearningProfile: currentStreak on profile ───────────────");

{
  const ctx = emptyCtx({ currentStreak: 7 });
  const profile = buildLearningProfile(ctx);
  assert("currentStreak = 7 on profile", profile.currentStreak === 7);
}

{
  const ctx = emptyCtx({ currentStreak: 0 });
  const profile = buildLearningProfile(ctx);
  assert("currentStreak = 0 for new student", profile.currentStreak === 0);
}

console.log("\n── buildLearningProfile: topSignal placeholder ──────────────────");

{
  // topSignal is null from buildLearningProfile (two-pass override happens in service)
  const ctx = emptyCtx({ currentStreak: 3 });
  const profile = buildLearningProfile(ctx);
  assert("topSignal = null from buildLearningProfile (placeholder)", profile.topSignal === null);
}

console.log("\n── buildLearningProfile: goalCountdown ──────────────────────────");

{
  const ctx = emptyCtx({ targetGoalDate: null });
  const profile = buildLearningProfile(ctx);
  assert("goalCountdown = null when targetGoalDate not set", profile.goalCountdown === null);
}

{
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 20); // 20 days from now
  const ctx = emptyCtx({ targetGoalDate: futureDate });
  const profile = buildLearningProfile(ctx);
  assert("goalCountdown non-null when targetGoalDate is set", profile.goalCountdown !== null);
  assert("goalCountdown.isUrgent = true for 20 days", profile.goalCountdown.isUrgent === true);
  assert("goalCountdown.daysRemaining > 0", profile.goalCountdown.daysRemaining > 0);
}

{
  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 90);
  const ctx = emptyCtx({ targetGoalDate: farFuture });
  const profile = buildLearningProfile(ctx);
  assert("goalCountdown.isUrgent = false for 90 days", profile.goalCountdown.isUrgent === false);
  assert("goalCountdown.targetGoalDate is a string", typeof profile.goalCountdown.targetGoalDate === "string");
}

console.log("\n── existing profile fields unchanged by M2.5 ────────────────────");

{
  const ctx = emptyCtx({
    currentStreak: 5,
    nextMission: { programSlug: "test-program", order: 3, title: "Bài 3", objective: "Learn tenses" },
  });
  const profile = buildLearningProfile(ctx);
  assert("userId still on profile", profile.userId === "test-user");
  assert("nextMission.order on profile", profile.nextMission?.order === 3);
  assert("nextMission.title on profile", profile.nextMission?.title === "Bài 3");
  assert("nextMission.objective on profile", profile.nextMission?.objective === "Learn tenses");
  assert("behaviorProfile still on profile", profile.behaviorProfile !== undefined);
  assert("learningTrend still on profile", profile.learningTrend === "INSUFFICIENT_DATA");
  assert("activeWeaknesses still on profile", Array.isArray(profile.activeWeaknesses));
  assert("improvingTopics still on profile", Array.isArray(profile.improvingTopics));
  assert("recommendations still on profile", Array.isArray(profile.recommendations));
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
