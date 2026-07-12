/**
 * Phase 5.1 — Learner State Foundation tests
 *
 * Pure engine tests — no DB, no TypeScript compilation.
 * Functions are inlined here to match the exact logic in:
 *   lib/services/learner-intelligence/knowledgeState.ts
 *   lib/services/learner-intelligence/performanceState.ts
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
    failed();
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
// Inline: knowledgeState engine
// ─────────────────────────────────────────────────────────

const CONFIRMED_TOPIC_THRESHOLD = 10;
const EMERGING_TOPIC_THRESHOLD = 3;
const SIGNAL_BOOST_THRESHOLD = 2;
const BEHAVIORAL_SIGNAL_TYPES = new Set([
  "RECURRING_WEAKNESS",
  "RETENTION_RISK",
  "TOPIC_IMPROVING",
  "TOPIC_MASTERED",
]);

function deriveKnowledgeConfidenceTier(topicCount, behavioralSignalCount) {
  if (topicCount >= CONFIRMED_TOPIC_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (
    topicCount >= EMERGING_TOPIC_THRESHOLD ||
    behavioralSignalCount >= SIGNAL_BOOST_THRESHOLD
  ) {
    return ConfidenceTier.EMERGING;
  }
  return ConfidenceTier.OBSERVED;
}

function computeKnowledgeState(masteryProfiles, activeWeaknesses, signals) {
  const remedialTopics = new Set(
    activeWeaknesses.filter((w) => w.isRemedialFlagged).map((w) => w.topic),
  );

  const masteredConcepts = masteryProfiles
    .filter((p) => p.masteryState === "MASTERED")
    .map((p) => ({ topic: p.topic, label: p.label, masteryState: p.masteryState }));

  const developingConcepts = masteryProfiles
    .filter((p) => p.masteryState === "IMPROVING" || p.masteryState === "STABLE")
    .map((p) => ({ topic: p.topic, label: p.label, masteryState: p.masteryState }));

  const weakRaw = masteryProfiles.filter((p) => p.masteryState === "NEEDS_REVIEW");
  weakRaw.sort((a, b) => {
    const aRemedial = remedialTopics.has(a.topic) ? 1 : 0;
    const bRemedial = remedialTopics.has(b.topic) ? 1 : 0;
    if (aRemedial !== bRemedial) return bRemedial - aRemedial;
    return b.summary.totalOccurrences - a.summary.totalOccurrences;
  });
  const weakConcepts = weakRaw.map((p) => ({
    topic: p.topic,
    label: p.label,
    masteryState: p.masteryState,
  }));

  const topicCount = masteryProfiles.length;
  const behavioralSignalCount = signals.filter((s) =>
    BEHAVIORAL_SIGNAL_TYPES.has(s.type),
  ).length;
  const confidenceTier = deriveKnowledgeConfidenceTier(topicCount, behavioralSignalCount);

  return {
    masteredConcepts,
    developingConcepts,
    weakConcepts,
    confidenceTier,
    topicCount,
    computedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Inline: performanceState engine
// ─────────────────────────────────────────────────────────

const MIN_ATTEMPTS_FOR_TREND = 5;
const MIN_ATTEMPTS_FOR_CONSISTENCY = 10;
const TREND_DELTA_THRESHOLD = 0.05;
const CONSISTENT_VARIANCE_MAX = 0.0025;
const VARIABLE_VARIANCE_MAX = 0.0225;
const CONFIRMED_ATTEMPT_THRESHOLD = 50;
const EMERGING_ATTEMPT_THRESHOLD = 10;
const STRONG_SKILL_THRESHOLD = 75;
const DEVELOPING_SKILL_THRESHOLD = 50;

function sortedByDate(attempts) {
  return [...attempts].sort(
    (a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime(),
  );
}

function accuracy(slice) {
  if (slice.length === 0) return 0;
  return slice.filter((a) => a.isCorrect).length / slice.length;
}

function computeAccuracyTrend(attempts) {
  if (attempts.length < MIN_ATTEMPTS_FOR_TREND) return "INSUFFICIENT_DATA";
  const sorted = sortedByDate(attempts);
  const half = Math.floor(sorted.length / 2);
  const earlierAcc = accuracy(sorted.slice(0, half));
  const laterAcc = accuracy(sorted.slice(sorted.length - half));
  if (laterAcc - earlierAcc >= TREND_DELTA_THRESHOLD) return "IMPROVING";
  if (earlierAcc - laterAcc >= TREND_DELTA_THRESHOLD) return "DECLINING";
  return "STABLE";
}

function computeConsistencyProfile(attempts) {
  if (attempts.length < MIN_ATTEMPTS_FOR_CONSISTENCY) return "CONSISTENT";
  const sorted = sortedByDate(attempts);
  const windowSize = Math.floor(sorted.length / 3);
  const windows = [
    sorted.slice(0, windowSize),
    sorted.slice(windowSize, 2 * windowSize),
    sorted.slice(2 * windowSize),
  ];
  const accuracies = windows.map((w) => accuracy(w));
  const mean = accuracies.reduce((s, v) => s + v, 0) / accuracies.length;
  const variance =
    accuracies.reduce((s, v) => s + (v - mean) ** 2, 0) / accuracies.length;
  if (variance <= CONSISTENT_VARIANCE_MAX) return "CONSISTENT";
  if (variance <= VARIABLE_VARIANCE_MAX) return "VARIABLE";
  return "ERRATIC";
}

function derivePerformanceConfidenceTier(attemptCount) {
  if (attemptCount >= CONFIRMED_ATTEMPT_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (attemptCount >= EMERGING_ATTEMPT_THRESHOLD) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function classifySkillTier(percentage) {
  if (percentage >= STRONG_SKILL_THRESHOLD) return "STRONG";
  if (percentage >= DEVELOPING_SKILL_THRESHOLD) return "DEVELOPING";
  return "WEAK";
}

function computePerformanceState(attempts, skillAccuracies) {
  const overallAccuracy =
    attempts.length === 0
      ? 0
      : Math.round(
          (attempts.filter((a) => a.isCorrect).length / attempts.length) * 100,
        );
  const accuracyTrend = computeAccuracyTrend(attempts);
  const consistencyProfile = computeConsistencyProfile(attempts);
  const confidenceTier = derivePerformanceConfidenceTier(attempts.length);
  const skillPerformance = skillAccuracies.map((s) => ({
    skill: s.skill,
    label: s.label,
    percentage: s.percentage,
    tier: classifySkillTier(s.percentage),
  }));
  return {
    accuracyTrend,
    overallAccuracy,
    consistencyProfile,
    skillPerformance,
    confidenceTier,
    computedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────

function makeMasteryProfile(topic, masteryState, totalOccurrences = 2) {
  return {
    topic,
    label: topic.replace(/_/g, " "),
    masteryState,
    summary: { totalOccurrences },
  };
}

function makeAttempt(isCorrect, daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { isCorrect, attemptedAt: d.toISOString() };
}

function makeSignal(type) {
  return { type, severity: "MEDIUM", topic: "some_topic", topicLabel: "Some Topic", evidence: {}, confidence: "MEDIUM", generatedAt: new Date().toISOString(), suppressionKey: type };
}

// ─────────────────────────────────────────────────────────
// Section 1: Knowledge State — concept classification
// ─────────────────────────────────────────────────────────

section("1. Knowledge State — concept classification");

{
  const profiles = [
    makeMasteryProfile("present_perfect", "MASTERED"),
    makeMasteryProfile("past_simple", "IMPROVING"),
    makeMasteryProfile("conditionals", "STABLE"),
    makeMasteryProfile("passive_voice", "NEEDS_REVIEW"),
  ];
  const state = computeKnowledgeState(profiles, [], []);

  assertEqual(state.masteredConcepts.length, 1, "MASTERED goes to masteredConcepts");
  assertEqual(state.masteredConcepts[0].topic, "present_perfect", "correct MASTERED topic");
  assertEqual(state.developingConcepts.length, 2, "IMPROVING + STABLE go to developingConcepts");
  assertEqual(state.weakConcepts.length, 1, "NEEDS_REVIEW goes to weakConcepts");
  assertEqual(state.topicCount, 4, "topicCount equals total profiles");
}

{
  const profiles = [
    makeMasteryProfile("a", "MASTERED"),
    makeMasteryProfile("b", "MASTERED"),
    makeMasteryProfile("c", "MASTERED"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.masteredConcepts.length, 3, "all MASTERED → 3 mastered concepts");
  assertEqual(state.developingConcepts.length, 0, "no developing concepts");
  assertEqual(state.weakConcepts.length, 0, "no weak concepts");
}

{
  const profiles = [
    makeMasteryProfile("a", "IMPROVING"),
    makeMasteryProfile("b", "STABLE"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.masteredConcepts.length, 0, "no mastered — IMPROVING + STABLE only");
  assertEqual(state.developingConcepts.length, 2, "both IMPROVING + STABLE developing");
  assertEqual(state.weakConcepts.length, 0, "no weak");
}

{
  const profiles = [
    makeMasteryProfile("a", "NEEDS_REVIEW"),
    makeMasteryProfile("b", "NEEDS_REVIEW"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.weakConcepts.length, 2, "both NEEDS_REVIEW are weak");
  assertEqual(state.masteredConcepts.length, 0, "no mastered");
  assertEqual(state.developingConcepts.length, 0, "no developing");
}

// ─────────────────────────────────────────────────────────
// Section 2: Knowledge State — confidence tier
// ─────────────────────────────────────────────────────────

section("2. Knowledge State — confidence tier");

{
  const state = computeKnowledgeState([], [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "0 topics → OBSERVED");
}

{
  const profiles = [makeMasteryProfile("a", "MASTERED"), makeMasteryProfile("b", "IMPROVING")];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "2 topics, no signals → OBSERVED");
}

{
  const profiles = [
    makeMasteryProfile("a", "MASTERED"),
    makeMasteryProfile("b", "IMPROVING"),
    makeMasteryProfile("c", "NEEDS_REVIEW"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "3 topics → EMERGING");
}

{
  const profiles = Array.from({ length: 9 }, (_, i) =>
    makeMasteryProfile(`topic_${i}`, "NEEDS_REVIEW"),
  );
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "9 topics → EMERGING");
}

{
  const profiles = Array.from({ length: 10 }, (_, i) =>
    makeMasteryProfile(`topic_${i}`, "NEEDS_REVIEW"),
  );
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "10 topics → CONFIRMED");
}

{
  const profiles = Array.from({ length: 15 }, (_, i) =>
    makeMasteryProfile(`topic_${i}`, "MASTERED"),
  );
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "15 topics → CONFIRMED");
}

// ─────────────────────────────────────────────────────────
// Section 3: Knowledge State — signal boost to confidence
// ─────────────────────────────────────────────────────────

section("3. Knowledge State — signal boost to confidence");

{
  // 1 topic + 1 behavioral signal → still OBSERVED (need 2 signals to boost)
  const profiles = [makeMasteryProfile("a", "NEEDS_REVIEW")];
  const signals = [makeSignal("RECURRING_WEAKNESS")];
  const state = computeKnowledgeState(profiles, [], signals);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "1 topic + 1 signal → still OBSERVED");
}

{
  // 1 topic + 2 behavioral signals → EMERGING (signal boost)
  const profiles = [makeMasteryProfile("a", "NEEDS_REVIEW")];
  const signals = [makeSignal("RECURRING_WEAKNESS"), makeSignal("RETENTION_RISK")];
  const state = computeKnowledgeState(profiles, [], signals);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "1 topic + 2 behavioral signals → EMERGING");
}

{
  // 0 topics + 3 behavioral signals → EMERGING (signal boost works with 0 topics too)
  const signals = [makeSignal("RECURRING_WEAKNESS"), makeSignal("TOPIC_MASTERED"), makeSignal("TOPIC_IMPROVING")];
  const state = computeKnowledgeState([], [], signals);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "0 topics + 3 behavioral signals → EMERGING");
}

{
  // Non-behavioral signals don't boost
  const profiles = [makeMasteryProfile("a", "NEEDS_REVIEW")];
  const signals = [makeSignal("LEARNING_MOMENTUM"), makeSignal("PACE_OBSERVATION"), makeSignal("STREAK_MILESTONE")];
  const state = computeKnowledgeState(profiles, [], signals);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "non-behavioral signals don't boost tier");
}

{
  // 10 topics always CONFIRMED regardless of signals
  const profiles = Array.from({ length: 10 }, (_, i) => makeMasteryProfile(`t${i}`, "IMPROVING"));
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "10 topics → CONFIRMED regardless of signals");
}

// ─────────────────────────────────────────────────────────
// Section 4: Knowledge State — weak concept ordering
// ─────────────────────────────────────────────────────────

section("4. Knowledge State — weak concept ordering");

{
  // Remedial-flagged comes before non-remedial
  const profiles = [
    makeMasteryProfile("common", "NEEDS_REVIEW", 10),
    makeMasteryProfile("remedial_topic", "NEEDS_REVIEW", 1),
  ];
  const weaknesses = [{ topic: "remedial_topic", isRemedialFlagged: true, dueCount: 0, masteryState: "NEEDS_REVIEW", signal: "RECURRING", label: "Remedial Topic", totalOccurrences: 1 }];
  const state = computeKnowledgeState(profiles, weaknesses, []);
  assertEqual(state.weakConcepts[0].topic, "remedial_topic", "remedial-flagged topic comes first even with fewer occurrences");
}

{
  // Among non-remedial, higher occurrence count comes first
  const profiles = [
    makeMasteryProfile("rare", "NEEDS_REVIEW", 1),
    makeMasteryProfile("frequent", "NEEDS_REVIEW", 8),
    makeMasteryProfile("medium", "NEEDS_REVIEW", 4),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.weakConcepts[0].topic, "frequent", "highest occurrence count first among non-remedial");
  assertEqual(state.weakConcepts[1].topic, "medium", "medium occurrence count second");
  assertEqual(state.weakConcepts[2].topic, "rare", "lowest occurrence count last");
}

{
  // Remedial topics come before non-remedial regardless of occurrence count
  const profiles = [
    makeMasteryProfile("popular", "NEEDS_REVIEW", 20),
    makeMasteryProfile("remedial_a", "NEEDS_REVIEW", 2),
    makeMasteryProfile("remedial_b", "NEEDS_REVIEW", 5),
  ];
  const weaknesses = [
    { topic: "remedial_a", isRemedialFlagged: true },
    { topic: "remedial_b", isRemedialFlagged: true },
  ];
  const state = computeKnowledgeState(profiles, weaknesses, []);
  assert(
    state.weakConcepts[0].topic === "remedial_a" || state.weakConcepts[0].topic === "remedial_b",
    "first weak concept is one of the remedial topics"
  );
  assert(
    state.weakConcepts[1].topic === "remedial_a" || state.weakConcepts[1].topic === "remedial_b",
    "second weak concept is the other remedial topic"
  );
  assertEqual(state.weakConcepts[2].topic, "popular", "non-remedial topic is last despite highest occurrences");
}

// ─────────────────────────────────────────────────────────
// Section 5: Knowledge State — output invariants
// ─────────────────────────────────────────────────────────

section("5. Knowledge State — output invariants");

{
  const profiles = [
    makeMasteryProfile("a", "MASTERED"),
    makeMasteryProfile("b", "IMPROVING"),
    makeMasteryProfile("c", "NEEDS_REVIEW"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assert(typeof state.computedAt === "string", "computedAt is a string");
  assert(state.computedAt.includes("T"), "computedAt is ISO format");
  assert(typeof state.topicCount === "number", "topicCount is a number");
  assertEqual(
    state.masteredConcepts.length + state.developingConcepts.length + state.weakConcepts.length,
    state.topicCount,
    "concept buckets sum to topicCount"
  );
}

{
  // IMPROVING and STABLE both map to developingConcepts
  const profiles = [
    makeMasteryProfile("imp", "IMPROVING"),
    makeMasteryProfile("stab", "STABLE"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  const devTopics = state.developingConcepts.map((c) => c.topic);
  assert(devTopics.includes("imp"), "IMPROVING maps to developingConcepts");
  assert(devTopics.includes("stab"), "STABLE maps to developingConcepts");
}

{
  // ConceptEntry preserves masteryState from input
  const profiles = [makeMasteryProfile("grammar", "STABLE")];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.developingConcepts[0].masteryState, "STABLE", "masteryState preserved in ConceptEntry");
}

// ─────────────────────────────────────────────────────────
// Section 6: Performance State — accuracy trend
// ─────────────────────────────────────────────────────────

section("6. Performance State — accuracy trend");

{
  const state = computePerformanceState([], []);
  assertEqual(state.accuracyTrend, "INSUFFICIENT_DATA", "0 attempts → INSUFFICIENT_DATA");
}

{
  const attempts = [makeAttempt(true, 5), makeAttempt(false, 4), makeAttempt(true, 3)];
  const state = computePerformanceState(attempts, []);
  assertEqual(state.accuracyTrend, "INSUFFICIENT_DATA", "4 attempts < 5 → INSUFFICIENT_DATA");
}

{
  // 10 recent correct, 10 older wrong → IMPROVING
  const attempts = [
    ...Array.from({ length: 10 }, (_, i) => makeAttempt(false, 20 - i)), // older, wrong
    ...Array.from({ length: 10 }, (_, i) => makeAttempt(true, 9 - i)),   // recent, correct
  ];
  const state = computePerformanceState(attempts, []);
  assertEqual(state.accuracyTrend, "IMPROVING", "later correct > earlier correct by >5pp → IMPROVING");
}

{
  // 10 older correct, 10 recent wrong → DECLINING
  const attempts = [
    ...Array.from({ length: 10 }, (_, i) => makeAttempt(true, 20 - i)),  // older, correct
    ...Array.from({ length: 10 }, (_, i) => makeAttempt(false, 9 - i)),  // recent, wrong
  ];
  const state = computePerformanceState(attempts, []);
  assertEqual(state.accuracyTrend, "DECLINING", "earlier correct > later correct by >5pp → DECLINING");
}

{
  // Equal accuracy in both halves → STABLE
  // Earlier half (days 10-6): 3 correct, 2 wrong = 60%
  // Later half  (days 5-1):  3 correct, 2 wrong = 60%  → diff 0 → STABLE
  const attempts = [
    makeAttempt(true, 10), makeAttempt(true, 9), makeAttempt(true, 8),
    makeAttempt(false, 7), makeAttempt(false, 6),
    makeAttempt(true, 5), makeAttempt(true, 4), makeAttempt(true, 3),
    makeAttempt(false, 2), makeAttempt(false, 1),
  ];
  const state = computePerformanceState(attempts, []);
  assertEqual(state.accuracyTrend, "STABLE", "equal accuracy in both halves → STABLE");
}

{
  // Exactly 5 attempts — minimum for trend
  const attempts = Array.from({ length: 5 }, (_, i) => makeAttempt(true, 5 - i));
  const state = computePerformanceState(attempts, []);
  assert(state.accuracyTrend !== "INSUFFICIENT_DATA", "5 attempts is enough for trend");
}

// ─────────────────────────────────────────────────────────
// Section 7: Performance State — consistency profile
// ─────────────────────────────────────────────────────────

section("7. Performance State — consistency profile");

{
  // < 10 attempts → CONSISTENT by default
  const attempts = Array.from({ length: 9 }, (_, i) => makeAttempt(true, 9 - i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.consistencyProfile, "CONSISTENT", "< 10 attempts → CONSISTENT default");
}

{
  // Uniformly correct across 12 attempts → CONSISTENT
  const attempts = Array.from({ length: 12 }, (_, i) => makeAttempt(true, 12 - i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.consistencyProfile, "CONSISTENT", "all correct → low variance → CONSISTENT");
}

{
  // 4 correct then 4 wrong then 4 correct → moderate swing → VARIABLE or ERRATIC
  const attempts = [
    ...Array.from({ length: 4 }, (_, i) => makeAttempt(true, 24 + i)),  // window 1: all correct
    ...Array.from({ length: 4 }, (_, i) => makeAttempt(false, 16 + i)), // window 2: all wrong
    ...Array.from({ length: 4 }, (_, i) => makeAttempt(true, 8 + i)),   // window 3: all correct
  ];
  const state = computePerformanceState(attempts, []);
  assert(
    state.consistencyProfile === "VARIABLE" || state.consistencyProfile === "ERRATIC",
    "swinging pattern → not CONSISTENT"
  );
}

{
  // Perfect alternation across 30 attempts → CONSISTENT (overall ~50% each window)
  const attempts = Array.from({ length: 30 }, (_, i) => makeAttempt(i % 2 === 0, 30 - i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.consistencyProfile, "CONSISTENT", "perfectly alternating → same accuracy each window → CONSISTENT");
}

// ─────────────────────────────────────────────────────────
// Section 8: Performance State — skill performance tiers
// ─────────────────────────────────────────────────────────

section("8. Performance State — skill performance tiers");

{
  const skills = [
    { skill: "VOCAB_GRAMMAR", label: "Vocabulary", percentage: 80 },
    { skill: "READING", label: "Reading", percentage: 60 },
    { skill: "WRITING_TRANSFORMATION", label: "Writing", percentage: 40 },
  ];
  const state = computePerformanceState([], skills);
  assertEqual(state.skillPerformance[0].tier, "STRONG", "80% → STRONG");
  assertEqual(state.skillPerformance[1].tier, "DEVELOPING", "60% → DEVELOPING");
  assertEqual(state.skillPerformance[2].tier, "WEAK", "40% → WEAK");
}

{
  // Boundary values
  const skills = [
    { skill: "A", label: "A", percentage: 75 },
    { skill: "B", label: "B", percentage: 74 },
    { skill: "C", label: "C", percentage: 50 },
    { skill: "D", label: "D", percentage: 49 },
    { skill: "E", label: "E", percentage: 0 },
  ];
  const state = computePerformanceState([], skills);
  assertEqual(state.skillPerformance[0].tier, "STRONG", "75% → STRONG (boundary)");
  assertEqual(state.skillPerformance[1].tier, "DEVELOPING", "74% → DEVELOPING (boundary)");
  assertEqual(state.skillPerformance[2].tier, "DEVELOPING", "50% → DEVELOPING (boundary)");
  assertEqual(state.skillPerformance[3].tier, "WEAK", "49% → WEAK (boundary)");
  assertEqual(state.skillPerformance[4].tier, "WEAK", "0% → WEAK");
}

{
  // All skills 100%
  const skills = [
    { skill: "A", label: "A", percentage: 100 },
    { skill: "B", label: "B", percentage: 100 },
  ];
  const state = computePerformanceState([], skills);
  assert(state.skillPerformance.every((s) => s.tier === "STRONG"), "all 100% → all STRONG");
}

{
  // Preserves skill and label passthrough
  const skills = [{ skill: "PHONETICS_STRESS", label: "Phonetics", percentage: 55 }];
  const state = computePerformanceState([], skills);
  assertEqual(state.skillPerformance[0].skill, "PHONETICS_STRESS", "skill key preserved");
  assertEqual(state.skillPerformance[0].label, "Phonetics", "label preserved");
  assertEqual(state.skillPerformance[0].percentage, 55, "percentage preserved");
}

// ─────────────────────────────────────────────────────────
// Section 9: Performance State — confidence tier
// ─────────────────────────────────────────────────────────

section("9. Performance State — confidence tier");

{
  const state = computePerformanceState([], []);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "0 attempts → OBSERVED");
}

{
  const attempts = Array.from({ length: 9 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "9 attempts → OBSERVED");
}

{
  const attempts = Array.from({ length: 10 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "10 attempts → EMERGING");
}

{
  const attempts = Array.from({ length: 49 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "49 attempts → EMERGING");
}

{
  const attempts = Array.from({ length: 50 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "50 attempts → CONFIRMED");
}

{
  const attempts = Array.from({ length: 200 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "200 attempts → CONFIRMED");
}

// ─────────────────────────────────────────────────────────
// Section 10: Performance State — overall accuracy
// ─────────────────────────────────────────────────────────

section("10. Performance State — overall accuracy");

{
  const state = computePerformanceState([], []);
  assertEqual(state.overallAccuracy, 0, "no attempts → 0% accuracy");
}

{
  const attempts = Array.from({ length: 10 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.overallAccuracy, 100, "all correct → 100%");
}

{
  const attempts = Array.from({ length: 10 }, (_, i) => makeAttempt(false, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.overallAccuracy, 0, "all wrong → 0%");
}

{
  // 3 correct out of 4 → 75%
  const attempts = [
    makeAttempt(true, 4),
    makeAttempt(true, 3),
    makeAttempt(true, 2),
    makeAttempt(false, 1),
  ];
  const state = computePerformanceState(attempts, []);
  assertEqual(state.overallAccuracy, 75, "3/4 correct → 75%");
}

{
  // 1 correct out of 3 → 33% (rounds to 33)
  const attempts = [makeAttempt(true, 3), makeAttempt(false, 2), makeAttempt(false, 1)];
  const state = computePerformanceState(attempts, []);
  assertEqual(state.overallAccuracy, 33, "1/3 correct → 33%");
}

// ─────────────────────────────────────────────────────────
// Section 11: Empty data handling
// ─────────────────────────────────────────────────────────

section("11. Empty data handling");

{
  const state = computeKnowledgeState([], [], []);
  assertEqual(state.masteredConcepts.length, 0, "empty profiles → no mastered concepts");
  assertEqual(state.developingConcepts.length, 0, "empty profiles → no developing concepts");
  assertEqual(state.weakConcepts.length, 0, "empty profiles → no weak concepts");
  assertEqual(state.topicCount, 0, "empty profiles → topicCount 0");
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "empty profiles → OBSERVED");
  assert(typeof state.computedAt === "string", "empty input still produces computedAt");
}

{
  const state = computePerformanceState([], []);
  assertEqual(state.accuracyTrend, "INSUFFICIENT_DATA", "empty attempts → INSUFFICIENT_DATA");
  assertEqual(state.overallAccuracy, 0, "empty attempts → 0% accuracy");
  assertEqual(state.consistencyProfile, "CONSISTENT", "empty attempts → CONSISTENT default");
  assertEqual(state.skillPerformance.length, 0, "empty skills → empty skillPerformance");
  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "empty attempts → OBSERVED");
  assert(typeof state.computedAt === "string", "empty input still produces computedAt");
}

{
  // Empty weaknesses → no remedial boosting but engine doesn't throw
  const profiles = [
    makeMasteryProfile("a", "NEEDS_REVIEW", 5),
    makeMasteryProfile("b", "NEEDS_REVIEW", 3),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  assertEqual(state.weakConcepts.length, 2, "no weaknesses input still produces weak concepts from profiles");
  assertEqual(state.weakConcepts[0].topic, "a", "ordered by occurrence count when no remedial info");
}

{
  // Empty skill accuracies with real attempts
  const attempts = Array.from({ length: 10 }, (_, i) => makeAttempt(true, i));
  const state = computePerformanceState(attempts, []);
  assertEqual(state.skillPerformance.length, 0, "no skill input → empty skill performance");
  assertEqual(state.confidenceTier, ConfidenceTier.EMERGING, "skill input independent from attempt confidence");
}

// ─────────────────────────────────────────────────────────
// Section 12: Engine invariants
// ─────────────────────────────────────────────────────────

section("12. Engine invariants");

{
  // computeKnowledgeState: concept buckets are mutually exclusive
  const profiles = [
    makeMasteryProfile("a", "MASTERED"),
    makeMasteryProfile("b", "IMPROVING"),
    makeMasteryProfile("c", "STABLE"),
    makeMasteryProfile("d", "NEEDS_REVIEW"),
  ];
  const state = computeKnowledgeState(profiles, [], []);
  const allTopics = [
    ...state.masteredConcepts.map((c) => c.topic),
    ...state.developingConcepts.map((c) => c.topic),
    ...state.weakConcepts.map((c) => c.topic),
  ];
  const uniqueTopics = new Set(allTopics);
  assertEqual(uniqueTopics.size, allTopics.length, "no topic appears in multiple concept buckets");
}

{
  // computeKnowledgeState: sum of buckets equals topicCount
  const profiles = Array.from({ length: 7 }, (_, i) =>
    makeMasteryProfile(`t${i}`, ["MASTERED", "IMPROVING", "STABLE", "NEEDS_REVIEW"][i % 4]),
  );
  const state = computeKnowledgeState(profiles, [], []);
  const sum = state.masteredConcepts.length + state.developingConcepts.length + state.weakConcepts.length;
  assertEqual(sum, state.topicCount, "bucket sum equals topicCount");
}

{
  // computePerformanceState: overallAccuracy is always 0–100
  const attempts50 = Array.from({ length: 50 }, (_, i) => makeAttempt(i % 3 !== 0, i));
  const state = computePerformanceState(attempts50, []);
  assert(state.overallAccuracy >= 0 && state.overallAccuracy <= 100, "overallAccuracy in [0, 100]");
}

{
  // computePerformanceState: skillPerformance count matches input
  const skills = [
    { skill: "A", label: "A", percentage: 80 },
    { skill: "B", label: "B", percentage: 50 },
    { skill: "C", label: "C", percentage: 20 },
  ];
  const state = computePerformanceState([], skills);
  assertEqual(state.skillPerformance.length, 3, "skillPerformance count matches input count");
}

{
  // computeKnowledgeState is pure — same input → structurally equal output
  const profiles = [makeMasteryProfile("x", "MASTERED"), makeMasteryProfile("y", "NEEDS_REVIEW")];
  const s1 = computeKnowledgeState(profiles, [], []);
  const s2 = computeKnowledgeState(profiles, [], []);
  assertEqual(s1.masteredConcepts.length, s2.masteredConcepts.length, "deterministic mastered count");
  assertEqual(s1.weakConcepts.length, s2.weakConcepts.length, "deterministic weak count");
  assertEqual(s1.confidenceTier, s2.confidenceTier, "deterministic confidence tier");
  assertEqual(s1.topicCount, s2.topicCount, "deterministic topic count");
}

{
  // computePerformanceState is pure — same input → same non-time fields
  const attempts = Array.from({ length: 20 }, (_, i) => makeAttempt(i % 2 === 0, 20 - i));
  const s1 = computePerformanceState(attempts, []);
  const s2 = computePerformanceState(attempts, []);
  assertEqual(s1.accuracyTrend, s2.accuracyTrend, "deterministic accuracy trend");
  assertEqual(s1.consistencyProfile, s2.consistencyProfile, "deterministic consistency profile");
  assertEqual(s1.overallAccuracy, s2.overallAccuracy, "deterministic overall accuracy");
  assertEqual(s1.confidenceTier, s2.confidenceTier, "deterministic confidence tier");
}

// ─────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
