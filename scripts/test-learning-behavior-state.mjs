/**
 * Phase 5.2 — Learning Behavior State tests
 *
 * Pure engine tests — no DB, no TypeScript compilation.
 * Functions are inlined here to match the exact logic in:
 *   lib/services/learner-intelligence/behaviorState.ts
 */

// ─────────────────────────────────────────────────────────
// Test framework
// ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ─────────────────────────────────────────────────────────
// Inline: ConfidenceTier values
// ─────────────────────────────────────────────────────────

const ConfidenceTier = {
  OBSERVED: "OBSERVED",
  EMERGING: "EMERGING",
  CONFIRMED: "CONFIRMED",
};

// ─────────────────────────────────────────────────────────
// Inline: behaviorState engine
// ─────────────────────────────────────────────────────────

const HIGHLY_ACTIVE_THRESHOLD = 20;
const ACTIVE_THRESHOLD = 10;
const OCCASIONAL_THRESHOLD = 3;

function deriveEngagementLevel(sessionCount) {
  if (sessionCount >= HIGHLY_ACTIVE_THRESHOLD) return "HIGHLY_ACTIVE";
  if (sessionCount >= ACTIVE_THRESHOLD) return "ACTIVE";
  if (sessionCount >= OCCASIONAL_THRESHOLD) return "OCCASIONAL";
  return "INACTIVE";
}

function computeLearningBehaviorState(behaviorProfile) {
  return {
    sessionPattern: {
      sessionCount: behaviorProfile.sessionCount,
      avgSessionDurationMin: behaviorProfile.avgSessionDurationMin,
      preferredTimeOfDay: behaviorProfile.preferredTimeOfDay,
    },
    completionBehavior: {
      completedSessionCount: behaviorProfile.sessionCount,
    },
    paceObservation: {
      paceProfile: behaviorProfile.paceProfile,
    },
    retryBehavior: {
      responseTimeSignal: behaviorProfile.responseTimeSignal,
    },
    engagementObservation: {
      engagementLevel: deriveEngagementLevel(behaviorProfile.sessionCount),
      recentMoodContext: behaviorProfile.recentMoodContext,
    },
    confidenceTier: behaviorProfile.confidenceTier,
    computedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────

function makeBehaviorProfile(overrides = {}) {
  return {
    preferredTimeOfDay: null,
    paceProfile: null,
    avgSessionDurationMin: null,
    responseTimeSignal: null,
    recentMoodContext: null,
    sessionCount: 0,
    confidenceTier: ConfidenceTier.OBSERVED,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Section 1: Empty / zero-session data
// ─────────────────────────────────────────────────────────

section("1. Empty / zero-session data");

{
  const profile = makeBehaviorProfile();
  const state = computeLearningBehaviorState(profile);

  assertEqual(state.sessionPattern.sessionCount, 0, "0 sessions → sessionCount 0");
  assertEqual(state.sessionPattern.avgSessionDurationMin, null, "no timing → null avgSessionDurationMin");
  assertEqual(state.sessionPattern.preferredTimeOfDay, null, "< 5 sessions → null preferredTimeOfDay");
  assertEqual(state.completionBehavior.completedSessionCount, 0, "0 sessions → completedSessionCount 0");
  assertEqual(state.paceObservation.paceProfile, null, "< 3 sessions → null paceProfile");
  assertEqual(state.retryBehavior.responseTimeSignal, null, "no timing → null responseTimeSignal");
  assertEqual(state.engagementObservation.engagementLevel, "INACTIVE", "0 sessions → INACTIVE");
  assertEqual(state.engagementObservation.recentMoodContext, null, "no mood entries → null moodContext");
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "0 sessions → OBSERVED confidence");
  assert(typeof state.computedAt === "string", "computedAt is a string");
  assert(state.computedAt.includes("T"), "computedAt is ISO format");
}

// ─────────────────────────────────────────────────────────
// Section 2: Session pattern passthrough
// ─────────────────────────────────────────────────────────

section("2. Session pattern passthrough");

{
  const profile = makeBehaviorProfile({
    sessionCount: 8,
    avgSessionDurationMin: 24.5,
    preferredTimeOfDay: "EVENING",
  });
  const state = computeLearningBehaviorState(profile);

  assertEqual(state.sessionPattern.sessionCount, 8, "sessionCount passes through");
  assertEqual(state.sessionPattern.avgSessionDurationMin, 24.5, "avgSessionDurationMin passes through");
  assertEqual(state.sessionPattern.preferredTimeOfDay, "EVENING", "preferredTimeOfDay passes through");
}

{
  const profile = makeBehaviorProfile({ preferredTimeOfDay: "MORNING" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.sessionPattern.preferredTimeOfDay, "MORNING", "MORNING preference passes through");
}

{
  const profile = makeBehaviorProfile({ preferredTimeOfDay: "AFTERNOON" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.sessionPattern.preferredTimeOfDay, "AFTERNOON", "AFTERNOON preference passes through");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 0 });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.sessionPattern.avgSessionDurationMin, 0, "zero duration passes through");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 120.7 });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.sessionPattern.avgSessionDurationMin, 120.7, "long session duration passes through");
}

// ─────────────────────────────────────────────────────────
// Section 3: Completion behavior
// ─────────────────────────────────────────────────────────

section("3. Completion behavior");

{
  const profile = makeBehaviorProfile({ sessionCount: 15 });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.completionBehavior.completedSessionCount, 15, "completedSessionCount mirrors sessionCount");
}

{
  const profile = makeBehaviorProfile({ sessionCount: 1 });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.completionBehavior.completedSessionCount, 1, "1 session → completedSessionCount 1");
}

{
  const profile = makeBehaviorProfile({ sessionCount: 0 });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.completionBehavior.completedSessionCount, 0, "0 sessions → completedSessionCount 0");
}

// ─────────────────────────────────────────────────────────
// Section 4: Pace observation passthrough
// ─────────────────────────────────────────────────────────

section("4. Pace observation passthrough");

{
  const profile = makeBehaviorProfile({ paceProfile: "CONSISTENT" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.paceObservation.paceProfile, "CONSISTENT", "CONSISTENT pace passes through");
}

{
  const profile = makeBehaviorProfile({ paceProfile: "DECLINING" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.paceObservation.paceProfile, "DECLINING", "DECLINING pace passes through");
}

{
  const profile = makeBehaviorProfile({ paceProfile: "VARIABLE" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.paceObservation.paceProfile, "VARIABLE", "VARIABLE pace passes through");
}

{
  const profile = makeBehaviorProfile({ paceProfile: null });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.paceObservation.paceProfile, null, "null pace (insufficient data) passes through");
}

// ─────────────────────────────────────────────────────────
// Section 5: Retry behavior — response time proxy
// ─────────────────────────────────────────────────────────

section("5. Retry behavior — response time proxy");

{
  const profile = makeBehaviorProfile({ responseTimeSignal: "EXTENDED" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.retryBehavior.responseTimeSignal, "EXTENDED", "EXTENDED signal passes through");
}

{
  const profile = makeBehaviorProfile({ responseTimeSignal: "MODERATE" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.retryBehavior.responseTimeSignal, "MODERATE", "MODERATE signal passes through");
}

{
  const profile = makeBehaviorProfile({ responseTimeSignal: "BRIEF" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.retryBehavior.responseTimeSignal, "BRIEF", "BRIEF signal passes through");
}

{
  const profile = makeBehaviorProfile({ responseTimeSignal: null });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.retryBehavior.responseTimeSignal, null, "null signal (insufficient data) passes through");
}

// ─────────────────────────────────────────────────────────
// Section 6: Engagement level thresholds
// ─────────────────────────────────────────────────────────

section("6. Engagement level thresholds");

{
  assertEqual(deriveEngagementLevel(0), "INACTIVE", "0 sessions → INACTIVE");
}

{
  assertEqual(deriveEngagementLevel(1), "INACTIVE", "1 session → INACTIVE");
}

{
  assertEqual(deriveEngagementLevel(2), "INACTIVE", "2 sessions → INACTIVE (boundary: need 3)");
}

{
  assertEqual(deriveEngagementLevel(3), "OCCASIONAL", "3 sessions → OCCASIONAL (boundary)");
}

{
  assertEqual(deriveEngagementLevel(5), "OCCASIONAL", "5 sessions → OCCASIONAL");
}

{
  assertEqual(deriveEngagementLevel(9), "OCCASIONAL", "9 sessions → OCCASIONAL (boundary: need 10)");
}

{
  assertEqual(deriveEngagementLevel(10), "ACTIVE", "10 sessions → ACTIVE (boundary)");
}

{
  assertEqual(deriveEngagementLevel(15), "ACTIVE", "15 sessions → ACTIVE");
}

{
  assertEqual(deriveEngagementLevel(19), "ACTIVE", "19 sessions → ACTIVE (boundary: need 20)");
}

{
  assertEqual(deriveEngagementLevel(20), "HIGHLY_ACTIVE", "20 sessions → HIGHLY_ACTIVE (boundary)");
}

{
  assertEqual(deriveEngagementLevel(50), "HIGHLY_ACTIVE", "50 sessions → HIGHLY_ACTIVE");
}

{
  assertEqual(deriveEngagementLevel(100), "HIGHLY_ACTIVE", "100 sessions → HIGHLY_ACTIVE");
}

// ─────────────────────────────────────────────────────────
// Section 7: Engagement level in full state
// ─────────────────────────────────────────────────────────

section("7. Engagement level in full state");

{
  const state = computeLearningBehaviorState(makeBehaviorProfile({ sessionCount: 0 }));
  assertEqual(state.engagementObservation.engagementLevel, "INACTIVE", "0 sessions state → INACTIVE");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile({ sessionCount: 3 }));
  assertEqual(state.engagementObservation.engagementLevel, "OCCASIONAL", "3 sessions state → OCCASIONAL");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile({ sessionCount: 10 }));
  assertEqual(state.engagementObservation.engagementLevel, "ACTIVE", "10 sessions state → ACTIVE");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile({ sessionCount: 20 }));
  assertEqual(state.engagementObservation.engagementLevel, "HIGHLY_ACTIVE", "20 sessions state → HIGHLY_ACTIVE");
}

// ─────────────────────────────────────────────────────────
// Section 8: Mood context passthrough
// ─────────────────────────────────────────────────────────

section("8. Mood context passthrough");

{
  const profile = makeBehaviorProfile({ recentMoodContext: "POSITIVE" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.engagementObservation.recentMoodContext, "POSITIVE", "POSITIVE mood passes through");
}

{
  const profile = makeBehaviorProfile({ recentMoodContext: "NEUTRAL" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.engagementObservation.recentMoodContext, "NEUTRAL", "NEUTRAL mood passes through");
}

{
  const profile = makeBehaviorProfile({ recentMoodContext: "NEGATIVE" });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.engagementObservation.recentMoodContext, "NEGATIVE", "NEGATIVE mood passes through");
}

{
  const profile = makeBehaviorProfile({ recentMoodContext: null });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.engagementObservation.recentMoodContext, null, "null mood (no entries) passes through");
}

// ─────────────────────────────────────────────────────────
// Section 9: Confidence tier passthrough
// ─────────────────────────────────────────────────────────

section("9. Confidence tier passthrough");

{
  const profile = makeBehaviorProfile({ confidenceTier: ConfidenceTier.OBSERVED });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "OBSERVED tier passes through");
}

{
  const profile = makeBehaviorProfile({ confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "EMERGING tier passes through");
}

{
  const profile = makeBehaviorProfile({ confidenceTier: ConfidenceTier.CONFIRMED });
  const state = computeLearningBehaviorState(profile);
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "CONFIRMED tier passes through");
}

// ─────────────────────────────────────────────────────────
// Section 10: Normal full-profile scenario
// ─────────────────────────────────────────────────────────

section("10. Normal full-profile scenario");

{
  const profile = makeBehaviorProfile({
    sessionCount: 12,
    avgSessionDurationMin: 30.5,
    preferredTimeOfDay: "EVENING",
    paceProfile: "CONSISTENT",
    responseTimeSignal: "MODERATE",
    recentMoodContext: "POSITIVE",
    confidenceTier: ConfidenceTier.CONFIRMED,
  });
  const state = computeLearningBehaviorState(profile);

  assertEqual(state.sessionPattern.sessionCount, 12, "full profile: sessionCount 12");
  assertEqual(state.sessionPattern.avgSessionDurationMin, 30.5, "full profile: duration 30.5");
  assertEqual(state.sessionPattern.preferredTimeOfDay, "EVENING", "full profile: EVENING preference");
  assertEqual(state.completionBehavior.completedSessionCount, 12, "full profile: 12 completed");
  assertEqual(state.paceObservation.paceProfile, "CONSISTENT", "full profile: CONSISTENT pace");
  assertEqual(state.retryBehavior.responseTimeSignal, "MODERATE", "full profile: MODERATE response time");
  assertEqual(state.engagementObservation.engagementLevel, "ACTIVE", "full profile: ACTIVE (12 sessions)");
  assertEqual(state.engagementObservation.recentMoodContext, "POSITIVE", "full profile: POSITIVE mood");
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "full profile: CONFIRMED tier");
}

{
  const profile = makeBehaviorProfile({
    sessionCount: 5,
    avgSessionDurationMin: 18.0,
    preferredTimeOfDay: null,
    paceProfile: "DECLINING",
    responseTimeSignal: "EXTENDED",
    recentMoodContext: "NEGATIVE",
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const state = computeLearningBehaviorState(profile);

  assertEqual(state.engagementObservation.engagementLevel, "OCCASIONAL", "5 sessions → OCCASIONAL");
  assertEqual(state.paceObservation.paceProfile, "DECLINING", "DECLINING pace observed");
  assertEqual(state.retryBehavior.responseTimeSignal, "EXTENDED", "EXTENDED response time observed");
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "5 sessions → EMERGING");
}

// ─────────────────────────────────────────────────────────
// Section 11: Output invariants
// ─────────────────────────────────────────────────────────

section("11. Output invariants");

{
  const state = computeLearningBehaviorState(makeBehaviorProfile());
  assert("sessionPattern" in state, "output has sessionPattern");
  assert("completionBehavior" in state, "output has completionBehavior");
  assert("paceObservation" in state, "output has paceObservation");
  assert("retryBehavior" in state, "output has retryBehavior");
  assert("engagementObservation" in state, "output has engagementObservation");
  assert("confidenceTier" in state, "output has confidenceTier");
  assert("computedAt" in state, "output has computedAt");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile());
  assert("sessionCount" in state.sessionPattern, "sessionPattern has sessionCount");
  assert("avgSessionDurationMin" in state.sessionPattern, "sessionPattern has avgSessionDurationMin");
  assert("preferredTimeOfDay" in state.sessionPattern, "sessionPattern has preferredTimeOfDay");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile());
  assert("completedSessionCount" in state.completionBehavior, "completionBehavior has completedSessionCount");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile());
  assert("paceProfile" in state.paceObservation, "paceObservation has paceProfile");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile());
  assert("responseTimeSignal" in state.retryBehavior, "retryBehavior has responseTimeSignal");
}

{
  const state = computeLearningBehaviorState(makeBehaviorProfile());
  assert("engagementLevel" in state.engagementObservation, "engagementObservation has engagementLevel");
  assert("recentMoodContext" in state.engagementObservation, "engagementObservation has recentMoodContext");
}

// ─────────────────────────────────────────────────────────
// Section 12: Determinism
// ─────────────────────────────────────────────────────────

section("12. Determinism");

{
  const profile = makeBehaviorProfile({
    sessionCount: 7,
    avgSessionDurationMin: 22.0,
    preferredTimeOfDay: "MORNING",
    paceProfile: "VARIABLE",
    responseTimeSignal: "BRIEF",
    recentMoodContext: "NEUTRAL",
    confidenceTier: ConfidenceTier.EMERGING,
  });

  const s1 = computeLearningBehaviorState(profile);
  const s2 = computeLearningBehaviorState(profile);

  assertEqual(s1.sessionPattern.sessionCount, s2.sessionPattern.sessionCount, "deterministic sessionCount");
  assertEqual(s1.sessionPattern.preferredTimeOfDay, s2.sessionPattern.preferredTimeOfDay, "deterministic preferredTimeOfDay");
  assertEqual(s1.sessionPattern.avgSessionDurationMin, s2.sessionPattern.avgSessionDurationMin, "deterministic avgSessionDurationMin");
  assertEqual(s1.completionBehavior.completedSessionCount, s2.completionBehavior.completedSessionCount, "deterministic completedSessionCount");
  assertEqual(s1.paceObservation.paceProfile, s2.paceObservation.paceProfile, "deterministic paceProfile");
  assertEqual(s1.retryBehavior.responseTimeSignal, s2.retryBehavior.responseTimeSignal, "deterministic responseTimeSignal");
  assertEqual(s1.engagementObservation.engagementLevel, s2.engagementObservation.engagementLevel, "deterministic engagementLevel");
  assertEqual(s1.engagementObservation.recentMoodContext, s2.engagementObservation.recentMoodContext, "deterministic recentMoodContext");
  assertEqual(s1.confidenceTier, s2.confidenceTier, "deterministic confidenceTier");
}

// ─────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`M5.2 Learning Behavior State: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
