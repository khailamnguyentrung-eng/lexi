/**
 * Phase 5.3 — Learning Preference State tests
 *
 * Pure engine tests — no DB, no TypeScript compilation.
 * Functions are inlined here to match the exact logic in:
 *   lib/services/learner-intelligence/preferenceState.ts
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
// Inline: preferenceState engine
// ─────────────────────────────────────────────────────────

const SHORT_SESSION_MAX_MIN = 15;
const LONG_SESSION_MIN_MIN = 45;

function unknownPreference() {
  return { value: "UNKNOWN", source: "NONE", confidenceTier: ConfidenceTier.OBSERVED };
}

function explicitPreference(value) {
  return { value, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED };
}

function observedPreference(value, tier) {
  return { value, source: "OBSERVED", confidenceTier: tier };
}

function resolvePreference(explicit, observed, observedTier) {
  if (explicit != null) return explicitPreference(explicit);
  if (observed != null) return observedPreference(observed, observedTier);
  return unknownPreference();
}

function classifySessionDuration(avgMin) {
  if (avgMin === null || avgMin === undefined) return null;
  if (avgMin < SHORT_SESSION_MAX_MIN) return "SHORT";
  if (avgMin > LONG_SESSION_MIN_MIN) return "LONG";
  return "MEDIUM";
}

function computeLearningPreferenceState(behaviorProfile, explicitPreferences) {
  const ep = explicitPreferences ?? {};
  const tier = behaviorProfile.confidenceTier;
  const observedDuration = classifySessionDuration(behaviorProfile.avgSessionDurationMin);

  return {
    practiceTime: resolvePreference(ep.practiceTime, behaviorProfile.preferredTimeOfDay, tier),
    sessionDuration: resolvePreference(ep.sessionDuration, observedDuration, tier),
    explanationDepth: resolvePreference(ep.explanationDepth, null, tier),
    hintFrequency: resolvePreference(ep.hintFrequency, null, tier),
    feedbackTiming: resolvePreference(ep.feedbackTiming, null, tier),
    practiceMode: resolvePreference(ep.practiceMode, null, tier),
    languagePreference: resolvePreference(ep.languagePreference, null, tier),
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
// Section 1: No data — all UNKNOWN
// ─────────────────────────────────────────────────────────

section("1. No data — all dimensions UNKNOWN");

{
  const state = computeLearningPreferenceState(makeBehaviorProfile());

  assertEqual(state.practiceTime.value, "UNKNOWN", "practiceTime value → UNKNOWN");
  assertEqual(state.practiceTime.source, "NONE", "practiceTime source → NONE");
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.OBSERVED, "practiceTime tier → OBSERVED");

  assertEqual(state.sessionDuration.value, "UNKNOWN", "sessionDuration value → UNKNOWN");
  assertEqual(state.sessionDuration.source, "NONE", "sessionDuration source → NONE");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.OBSERVED, "sessionDuration tier → OBSERVED");

  assertEqual(state.explanationDepth.value, "UNKNOWN", "explanationDepth value → UNKNOWN");
  assertEqual(state.explanationDepth.source, "NONE", "explanationDepth source → NONE");

  assertEqual(state.hintFrequency.value, "UNKNOWN", "hintFrequency value → UNKNOWN");
  assertEqual(state.hintFrequency.source, "NONE", "hintFrequency source → NONE");

  assertEqual(state.feedbackTiming.value, "UNKNOWN", "feedbackTiming value → UNKNOWN");
  assertEqual(state.feedbackTiming.source, "NONE", "feedbackTiming source → NONE");

  assertEqual(state.practiceMode.value, "UNKNOWN", "practiceMode value → UNKNOWN");
  assertEqual(state.practiceMode.source, "NONE", "practiceMode source → NONE");

  assertEqual(state.languagePreference.value, "UNKNOWN", "languagePreference value → UNKNOWN");
  assertEqual(state.languagePreference.source, "NONE", "languagePreference source → NONE");

  assert(typeof state.computedAt === "string", "computedAt is a string");
  assert(state.computedAt.includes("T"), "computedAt is ISO format");
}

// ─────────────────────────────────────────────────────────
// Section 2: practiceTime from observed behavior
// ─────────────────────────────────────────────────────────

section("2. practiceTime from observed behavior");

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "MORNING",
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const state = computeLearningPreferenceState(profile);

  assertEqual(state.practiceTime.value, "MORNING", "MORNING preferredTimeOfDay → practiceTime MORNING");
  assertEqual(state.practiceTime.source, "OBSERVED", "behavioral preference → OBSERVED source");
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.EMERGING, "inherits behavior tier EMERGING");
}

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "AFTERNOON",
    confidenceTier: ConfidenceTier.CONFIRMED,
  });
  const state = computeLearningPreferenceState(profile);

  assertEqual(state.practiceTime.value, "AFTERNOON", "AFTERNOON → practiceTime AFTERNOON");
  assertEqual(state.practiceTime.source, "OBSERVED", "OBSERVED source");
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.CONFIRMED, "inherits CONFIRMED tier");
}

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "EVENING",
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.practiceTime.value, "EVENING", "EVENING → practiceTime EVENING");
}

{
  // null preferredTimeOfDay → UNKNOWN even with sessions
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: null,
    sessionCount: 8,
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.practiceTime.value, "UNKNOWN", "null preferredTimeOfDay → UNKNOWN");
  assertEqual(state.practiceTime.source, "NONE", "null preferredTimeOfDay → NONE source");
}

// ─────────────────────────────────────────────────────────
// Section 3: sessionDuration from observed behavior
// ─────────────────────────────────────────────────────────

section("3. sessionDuration from observed behavior");

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 10, confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "SHORT", "10 min → SHORT");
  assertEqual(state.sessionDuration.source, "OBSERVED", "OBSERVED source");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 14.9, confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "SHORT", "14.9 min → SHORT (boundary: < 15)");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 15, confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "MEDIUM", "15 min → MEDIUM (boundary: >= 15)");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 30, confidenceTier: ConfidenceTier.CONFIRMED });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "MEDIUM", "30 min → MEDIUM");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.CONFIRMED, "inherits CONFIRMED tier");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 45, confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "MEDIUM", "45 min → MEDIUM (boundary: not > 45)");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 45.1, confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "LONG", "45.1 min → LONG (boundary: > 45)");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 90, confidenceTier: ConfidenceTier.CONFIRMED });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "LONG", "90 min → LONG");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: null });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.sessionDuration.value, "UNKNOWN", "null avgSessionDurationMin → UNKNOWN");
  assertEqual(state.sessionDuration.source, "NONE", "null → NONE source");
}

// ─────────────────────────────────────────────────────────
// Section 4: Explicit preference overrides
// ─────────────────────────────────────────────────────────

section("4. Explicit preference overrides — all dimensions");

{
  const profile = makeBehaviorProfile({ preferredTimeOfDay: "MORNING", confidenceTier: ConfidenceTier.CONFIRMED });
  const explicit = { practiceTime: "EVENING" };
  const state = computeLearningPreferenceState(profile, explicit);

  assertEqual(state.practiceTime.value, "EVENING", "explicit EVENING overrides observed MORNING");
  assertEqual(state.practiceTime.source, "EXPLICIT", "explicit override → EXPLICIT source");
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.OBSERVED, "explicit always OBSERVED confidence");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 90 });
  const explicit = { sessionDuration: "SHORT" };
  const state = computeLearningPreferenceState(profile, explicit);

  assertEqual(state.sessionDuration.value, "SHORT", "explicit SHORT overrides observed LONG");
  assertEqual(state.sessionDuration.source, "EXPLICIT", "EXPLICIT source");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.OBSERVED, "explicit → OBSERVED confidence");
}

{
  const state = computeLearningPreferenceState(
    makeBehaviorProfile(),
    { explanationDepth: "DETAILED" },
  );
  assertEqual(state.explanationDepth.value, "DETAILED", "explicit explanationDepth DETAILED");
  assertEqual(state.explanationDepth.source, "EXPLICIT", "EXPLICIT source");
  assertEqual(state.explanationDepth.confidenceTier, ConfidenceTier.OBSERVED, "OBSERVED confidence");
}

{
  const state = computeLearningPreferenceState(
    makeBehaviorProfile(),
    { hintFrequency: "ON_REQUEST" },
  );
  assertEqual(state.hintFrequency.value, "ON_REQUEST", "explicit hintFrequency ON_REQUEST");
  assertEqual(state.hintFrequency.source, "EXPLICIT", "EXPLICIT source");
}

{
  const state = computeLearningPreferenceState(
    makeBehaviorProfile(),
    { feedbackTiming: "IMMEDIATE" },
  );
  assertEqual(state.feedbackTiming.value, "IMMEDIATE", "explicit feedbackTiming IMMEDIATE");
  assertEqual(state.feedbackTiming.source, "EXPLICIT", "EXPLICIT source");
}

{
  const state = computeLearningPreferenceState(
    makeBehaviorProfile(),
    { practiceMode: "TOPIC_FOCUSED" },
  );
  assertEqual(state.practiceMode.value, "TOPIC_FOCUSED", "explicit practiceMode TOPIC_FOCUSED");
  assertEqual(state.practiceMode.source, "EXPLICIT", "EXPLICIT source");
}

{
  const state = computeLearningPreferenceState(
    makeBehaviorProfile(),
    { languagePreference: "BILINGUAL" },
  );
  assertEqual(state.languagePreference.value, "BILINGUAL", "explicit languagePreference BILINGUAL");
  assertEqual(state.languagePreference.source, "EXPLICIT", "EXPLICIT source");
}

// ─────────────────────────────────────────────────────────
// Section 5: Explicit confidence is always OBSERVED
// ─────────────────────────────────────────────────────────

section("5. Explicit preferences always have OBSERVED confidence");

{
  // Even a CONFIRMED behavior profile does not elevate explicit confidence
  const profile = makeBehaviorProfile({ confidenceTier: ConfidenceTier.CONFIRMED });
  const explicit = {
    practiceTime: "MORNING",
    sessionDuration: "MEDIUM",
    explanationDepth: "STEP_BY_STEP",
    hintFrequency: "PROACTIVE",
    feedbackTiming: "END_OF_SESSION",
    practiceMode: "EXAM_SIMULATION",
    languagePreference: "VIETNAMESE",
  };
  const state = computeLearningPreferenceState(profile, explicit);

  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.OBSERVED, "explicit practiceTime → OBSERVED tier");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.OBSERVED, "explicit sessionDuration → OBSERVED tier");
  assertEqual(state.explanationDepth.confidenceTier, ConfidenceTier.OBSERVED, "explicit explanationDepth → OBSERVED tier");
  assertEqual(state.hintFrequency.confidenceTier, ConfidenceTier.OBSERVED, "explicit hintFrequency → OBSERVED tier");
  assertEqual(state.feedbackTiming.confidenceTier, ConfidenceTier.OBSERVED, "explicit feedbackTiming → OBSERVED tier");
  assertEqual(state.practiceMode.confidenceTier, ConfidenceTier.OBSERVED, "explicit practiceMode → OBSERVED tier");
  assertEqual(state.languagePreference.confidenceTier, ConfidenceTier.OBSERVED, "explicit languagePreference → OBSERVED tier");
}

// ─────────────────────────────────────────────────────────
// Section 6: Observed confidence inherits from BehaviorProfile
// ─────────────────────────────────────────────────────────

section("6. Observed preferences inherit BehaviorProfile confidence tier");

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "EVENING",
    avgSessionDurationMin: 25,
    confidenceTier: ConfidenceTier.OBSERVED,
  });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.OBSERVED, "OBSERVED profile → OBSERVED preference tier");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.OBSERVED, "OBSERVED profile → OBSERVED sessionDuration tier");
}

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "MORNING",
    avgSessionDurationMin: 30,
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.EMERGING, "EMERGING profile → EMERGING practiceTime tier");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.EMERGING, "EMERGING profile → EMERGING sessionDuration tier");
}

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "AFTERNOON",
    avgSessionDurationMin: 50,
    confidenceTier: ConfidenceTier.CONFIRMED,
  });
  const state = computeLearningPreferenceState(profile);
  assertEqual(state.practiceTime.confidenceTier, ConfidenceTier.CONFIRMED, "CONFIRMED profile → CONFIRMED practiceTime tier");
  assertEqual(state.sessionDuration.confidenceTier, ConfidenceTier.CONFIRMED, "CONFIRMED profile → CONFIRMED sessionDuration tier");
}

// ─────────────────────────────────────────────────────────
// Section 7: null explicit value treated as not set (falls through to observed)
// ─────────────────────────────────────────────────────────

section("7. null explicit value treated as not set");

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "MORNING",
    confidenceTier: ConfidenceTier.EMERGING,
  });
  // null explicitly passed — should fall through to observed
  const state = computeLearningPreferenceState(profile, { practiceTime: null });
  assertEqual(state.practiceTime.value, "MORNING", "null explicit practiceTime → falls through to observed");
  assertEqual(state.practiceTime.source, "OBSERVED", "null explicit → OBSERVED source (from behavior)");
}

{
  const profile = makeBehaviorProfile({ avgSessionDurationMin: 20, confidenceTier: ConfidenceTier.EMERGING });
  const state = computeLearningPreferenceState(profile, { sessionDuration: null });
  assertEqual(state.sessionDuration.value, "MEDIUM", "null explicit sessionDuration → falls through to observed");
  assertEqual(state.sessionDuration.source, "OBSERVED", "null explicit → OBSERVED source");
}

{
  // null explicit with no observed fallback → UNKNOWN
  const state = computeLearningPreferenceState(makeBehaviorProfile(), { explanationDepth: null });
  assertEqual(state.explanationDepth.value, "UNKNOWN", "null explicit + no observed → UNKNOWN");
  assertEqual(state.explanationDepth.source, "NONE", "null explicit + no observed → NONE source");
}

// ─────────────────────────────────────────────────────────
// Section 8: Mixed — some explicit, some observed, some UNKNOWN
// ─────────────────────────────────────────────────────────

section("8. Mixed — some explicit, some observed, some UNKNOWN");

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "EVENING",
    avgSessionDurationMin: 35,
    confidenceTier: ConfidenceTier.CONFIRMED,
  });
  const explicit = {
    explanationDepth: "BRIEF",
    hintFrequency: "NEVER",
  };
  const state = computeLearningPreferenceState(profile, explicit);

  // Explicit
  assertEqual(state.explanationDepth.value, "BRIEF", "mixed: explicit explanationDepth BRIEF");
  assertEqual(state.explanationDepth.source, "EXPLICIT", "mixed: EXPLICIT source");
  assertEqual(state.hintFrequency.value, "NEVER", "mixed: explicit hintFrequency NEVER");

  // Observed
  assertEqual(state.practiceTime.value, "EVENING", "mixed: observed practiceTime EVENING");
  assertEqual(state.practiceTime.source, "OBSERVED", "mixed: OBSERVED source");
  assertEqual(state.sessionDuration.value, "MEDIUM", "mixed: observed sessionDuration MEDIUM (35min)");

  // UNKNOWN
  assertEqual(state.feedbackTiming.value, "UNKNOWN", "mixed: feedbackTiming UNKNOWN");
  assertEqual(state.practiceMode.value, "UNKNOWN", "mixed: practiceMode UNKNOWN");
  assertEqual(state.languagePreference.value, "UNKNOWN", "mixed: languagePreference UNKNOWN");
}

// ─────────────────────────────────────────────────────────
// Section 9: No inference — dimensions with no data stay UNKNOWN
// ─────────────────────────────────────────────────────────

section("9. No inference — unexplained dimensions stay UNKNOWN");

{
  // Even a CONFIRMED behavior profile cannot populate explanation/hint/feedback/mode/language
  // without explicit settings — these require data sources that don't exist yet
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "MORNING",
    avgSessionDurationMin: 30,
    confidenceTier: ConfidenceTier.CONFIRMED,
    paceProfile: "CONSISTENT",
    responseTimeSignal: "EXTENDED",
    recentMoodContext: "POSITIVE",
  });
  const state = computeLearningPreferenceState(profile);

  assertEqual(state.explanationDepth.value, "UNKNOWN", "CONFIRMED profile cannot infer explanationDepth");
  assertEqual(state.hintFrequency.value, "UNKNOWN", "CONFIRMED profile cannot infer hintFrequency");
  assertEqual(state.feedbackTiming.value, "UNKNOWN", "CONFIRMED profile cannot infer feedbackTiming");
  assertEqual(state.practiceMode.value, "UNKNOWN", "CONFIRMED profile cannot infer practiceMode");
  assertEqual(state.languagePreference.value, "UNKNOWN", "CONFIRMED profile cannot infer languagePreference");

  // But observed dimensions ARE populated
  assertEqual(state.practiceTime.value, "MORNING", "observed practiceTime still populated");
  assertEqual(state.sessionDuration.value, "MEDIUM", "observed sessionDuration still populated");
}

// ─────────────────────────────────────────────────────────
// Section 10: sessionDuration boundary values
// ─────────────────────────────────────────────────────────

section("10. sessionDuration boundary values");

{
  assertEqual(classifySessionDuration(null), null, "null → null");
  assertEqual(classifySessionDuration(0), "SHORT", "0 min → SHORT");
  assertEqual(classifySessionDuration(1), "SHORT", "1 min → SHORT");
  assertEqual(classifySessionDuration(14), "SHORT", "14 min → SHORT");
  assertEqual(classifySessionDuration(14.99), "SHORT", "14.99 min → SHORT");
  assertEqual(classifySessionDuration(15), "MEDIUM", "15 min → MEDIUM (exact boundary)");
  assertEqual(classifySessionDuration(16), "MEDIUM", "16 min → MEDIUM");
  assertEqual(classifySessionDuration(44), "MEDIUM", "44 min → MEDIUM");
  assertEqual(classifySessionDuration(45), "MEDIUM", "45 min → MEDIUM (exact boundary)");
  assertEqual(classifySessionDuration(46), "LONG", "46 min → LONG");
  assertEqual(classifySessionDuration(120), "LONG", "120 min → LONG");
}

// ─────────────────────────────────────────────────────────
// Section 11: Output structure invariants
// ─────────────────────────────────────────────────────────

section("11. Output structure invariants");

{
  const state = computeLearningPreferenceState(makeBehaviorProfile());
  const dims = ["practiceTime", "sessionDuration", "explanationDepth", "hintFrequency",
    "feedbackTiming", "practiceMode", "languagePreference"];

  for (const dim of dims) {
    assert(dim in state, `output has ${dim}`);
    assert("value" in state[dim], `${dim} has value`);
    assert("source" in state[dim], `${dim} has source`);
    assert("confidenceTier" in state[dim], `${dim} has confidenceTier`);
  }
  assert("computedAt" in state, "output has computedAt");
}

{
  // Source is always one of the three valid values
  const state = computeLearningPreferenceState(
    makeBehaviorProfile({ preferredTimeOfDay: "MORNING", avgSessionDurationMin: 30, confidenceTier: ConfidenceTier.EMERGING }),
    { explanationDepth: "DETAILED" },
  );
  const validSources = new Set(["EXPLICIT", "OBSERVED", "NONE"]);
  const dims = ["practiceTime", "sessionDuration", "explanationDepth", "hintFrequency",
    "feedbackTiming", "practiceMode", "languagePreference"];
  for (const dim of dims) {
    assert(validSources.has(state[dim].source), `${dim}.source is a valid PreferenceSource`);
  }
}

{
  // ConfidenceTier is always one of the three valid values
  const validTiers = new Set(["OBSERVED", "EMERGING", "CONFIRMED"]);
  const state = computeLearningPreferenceState(
    makeBehaviorProfile({ preferredTimeOfDay: "EVENING", confidenceTier: ConfidenceTier.CONFIRMED }),
    { hintFrequency: "ON_REQUEST" },
  );
  const dims = ["practiceTime", "sessionDuration", "explanationDepth", "hintFrequency",
    "feedbackTiming", "practiceMode", "languagePreference"];
  for (const dim of dims) {
    assert(validTiers.has(state[dim].confidenceTier), `${dim}.confidenceTier is a valid ConfidenceTier`);
  }
}

// ─────────────────────────────────────────────────────────
// Section 12: Determinism
// ─────────────────────────────────────────────────────────

section("12. Determinism");

{
  const profile = makeBehaviorProfile({
    preferredTimeOfDay: "AFTERNOON",
    avgSessionDurationMin: 22,
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const explicit = { explanationDepth: "DETAILED", practiceMode: "TOPIC_FOCUSED" };

  const s1 = computeLearningPreferenceState(profile, explicit);
  const s2 = computeLearningPreferenceState(profile, explicit);

  assertEqual(s1.practiceTime.value, s2.practiceTime.value, "deterministic practiceTime value");
  assertEqual(s1.practiceTime.source, s2.practiceTime.source, "deterministic practiceTime source");
  assertEqual(s1.practiceTime.confidenceTier, s2.practiceTime.confidenceTier, "deterministic practiceTime tier");

  assertEqual(s1.sessionDuration.value, s2.sessionDuration.value, "deterministic sessionDuration value");
  assertEqual(s1.explanationDepth.value, s2.explanationDepth.value, "deterministic explanationDepth value");
  assertEqual(s1.explanationDepth.source, s2.explanationDepth.source, "deterministic explanationDepth source");
  assertEqual(s1.practiceMode.value, s2.practiceMode.value, "deterministic practiceMode value");
  assertEqual(s1.hintFrequency.value, s2.hintFrequency.value, "deterministic hintFrequency value");
  assertEqual(s1.feedbackTiming.value, s2.feedbackTiming.value, "deterministic feedbackTiming value");
  assertEqual(s1.languagePreference.value, s2.languagePreference.value, "deterministic languagePreference value");
}

// ─────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`M5.3 Learning Preference State: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
