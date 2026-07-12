/**
 * test-learning-signals.mjs
 *
 * Validates all pure functions from lib/analytics/learningSignalEngine.ts.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions and their helpers.
 *
 * Run: node scripts/test-learning-signals.mjs
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

// ── Inlined constants ─────────────────────────────────────────────────────────

const SIGNAL_CAP = 5;
const STREAK_MILESTONES = new Set([3, 7, 14, 30]);
const SEVERITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// ── Inlined helpers ───────────────────────────────────────────────────────────

function confidenceFromTier(tier) {
  if (tier === "CONFIRMED") return "HIGH";
  if (tier === "EMERGING") return "MEDIUM";
  return "LOW";
}

function confidenceFromOccurrences(count) {
  if (count >= 5) return "HIGH";
  if (count >= 3) return "MEDIUM";
  return "LOW";
}

// ── Inlined signal derivation helpers ────────────────────────────────────────

function deriveFirstMasterySignal(profile, ts) {
  if (profile.masterySummary.masteredTopics.length !== 1) return null;
  return {
    type: "FIRST_MASTERY",
    severity: "HIGH",
    topic: null,
    topicLabel: profile.masterySummary.masteredTopics[0],
    evidence: { masteredCount: 1 },
    confidence: "HIGH",
    generatedAt: ts,
    suppressionKey: "FIRST_MASTERY",
  };
}

function deriveMasteredSignals(profile, ts) {
  if (profile.masterySummary.masteredTopics.length <= 1) return [];
  const total = profile.masterySummary.masteredTopics.length;
  return profile.masterySummary.masteredTopics.map((label) => ({
    type: "TOPIC_MASTERED",
    severity: "MEDIUM",
    topic: null,
    topicLabel: label,
    evidence: { masteredCount: total },
    confidence: "HIGH",
    generatedAt: ts,
    suppressionKey: `TOPIC_MASTERED_${label}`,
  }));
}

function deriveImprovingSignals(profile, ts) {
  return profile.improvingTopics
    .filter((p) => p.masteryState === "IMPROVING")
    .map((p) => ({
      type: "TOPIC_IMPROVING",
      severity: "MEDIUM",
      topic: p.topic,
      topicLabel: p.label,
      evidence: { occurrenceCount: p.summary.totalOccurrences },
      confidence: confidenceFromOccurrences(p.summary.totalOccurrences),
      generatedAt: ts,
      suppressionKey: `TOPIC_IMPROVING_${p.topic}`,
    }));
}

function deriveRecurringWeaknessSignals(profile, ts) {
  return profile.activeWeaknesses
    .filter((w) => w.signal === "RECURRING" && w.totalOccurrences >= 3)
    .map((w) => ({
      type: "RECURRING_WEAKNESS",
      severity: "HIGH",
      topic: w.topic,
      topicLabel: w.label,
      evidence: { occurrenceCount: w.totalOccurrences },
      confidence: confidenceFromOccurrences(w.totalOccurrences),
      generatedAt: ts,
      suppressionKey: `RECURRING_WEAKNESS_${w.topic}`,
    }));
}

function deriveRetentionRiskSignals(profile, ts) {
  return profile.activeWeaknesses
    .filter((w) => w.dueCount > 0 && w.signal !== "RECURRING")
    .map((w) => {
      const confidence =
        w.dueCount >= 3 ? "HIGH" : w.dueCount === 2 ? "MEDIUM" : "LOW";
      return {
        type: "RETENTION_RISK",
        severity: "MEDIUM",
        topic: w.topic,
        topicLabel: w.label,
        evidence: { dueCount: w.dueCount },
        confidence,
        generatedAt: ts,
        suppressionKey: `RETENTION_RISK_${w.topic}`,
      };
    });
}

function deriveLearningMomentumSignal(profile, ts) {
  if (profile.learningTrend !== "PROGRESSING") return null;
  return {
    type: "LEARNING_MOMENTUM",
    severity: "MEDIUM",
    topic: null,
    topicLabel: null,
    evidence: { sessionsAnalyzed: profile.behaviorProfile.sessionCount },
    confidence: confidenceFromTier(profile.behaviorProfile.confidenceTier),
    generatedAt: ts,
    suppressionKey: "LEARNING_MOMENTUM",
  };
}

function derivePaceObservationSignal(profile, ts) {
  const bp = profile.behaviorProfile;
  if (bp.paceProfile !== "DECLINING" || bp.sessionCount < 3) return null;
  return {
    type: "PACE_OBSERVATION",
    severity: "LOW",
    topic: null,
    topicLabel: null,
    evidence: { sessionsAnalyzed: bp.sessionCount },
    confidence: "LOW",
    generatedAt: ts,
    suppressionKey: "PACE_OBSERVATION",
  };
}

function deriveStreakMilestoneSignal(currentStreak, ts) {
  if (!STREAK_MILESTONES.has(currentStreak)) return null;
  return {
    type: "STREAK_MILESTONE",
    severity: "MEDIUM",
    topic: null,
    topicLabel: null,
    evidence: { currentStreak },
    confidence: "HIGH",
    generatedAt: ts,
    suppressionKey: `STREAK_MILESTONE_${currentStreak}`,
  };
}

function computeLearningSignals(profile, currentStreak) {
  const ts = new Date().toISOString();
  const candidates = [];

  const firstMastery = deriveFirstMasterySignal(profile, ts);
  if (firstMastery) candidates.push(firstMastery);

  candidates.push(...deriveMasteredSignals(profile, ts));
  candidates.push(...deriveImprovingSignals(profile, ts));
  candidates.push(...deriveRecurringWeaknessSignals(profile, ts));
  candidates.push(...deriveRetentionRiskSignals(profile, ts));

  const momentum = deriveLearningMomentumSignal(profile, ts);
  if (momentum) candidates.push(momentum);

  const pace = derivePaceObservationSignal(profile, ts);
  if (pace) candidates.push(pace);

  const streak = deriveStreakMilestoneSignal(currentStreak, ts);
  if (streak) candidates.push(streak);

  candidates.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sevDiff !== 0) return sevDiff;
    if (a.topic !== null && b.topic === null) return -1;
    if (a.topic === null && b.topic !== null) return 1;
    return 0;
  });

  return candidates.slice(0, SIGNAL_CAP);
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeBehaviorProfile(overrides = {}) {
  return {
    preferredTimeOfDay: null,
    paceProfile: null,
    avgSessionDurationMin: null,
    responseTimeSignal: null,
    recentMoodContext: null,
    sessionCount: 0,
    confidenceTier: "OBSERVED",
    ...overrides,
  };
}

function makeProfile(overrides = {}) {
  return {
    userId: "test-user",
    generatedAt: new Date().toISOString(),
    readiness: null,
    masterySummary: {
      totalTopics: 0,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 0 },
      masteredTopics: [],
      needsReviewTopics: [],
    },
    skillSnapshot: [],
    learningTrend: "INSUFFICIENT_DATA",
    improvingTopics: [],
    activeWeaknesses: [],
    recommendations: [],
    nextSessionNumber: null,
    nextSessionTitle: null,
    nextSessionObjective: null,
    behaviorProfile: makeBehaviorProfile(),
    ...overrides,
  };
}

function makeMasteryProfile(topic, masteryState, totalOccurrences = 4) {
  const label = topic.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    topic,
    label,
    masteryState,
    summary: {
      topic, label,
      entryCount: 2,
      totalOccurrences,
      isRemedialFlagged: false,
      maxReviewStage: 2,
      lastReviewedAt: new Date(),
      dueCount: 0,
      masteredCount: 0,
      improvementSignal: "IMPROVING",
      preReviewAccuracy: 0.4,
      postReviewAccuracy: 0.65,
    },
  };
}

function makeWeakness(topic, signal, totalOccurrences = 4, dueCount = 0) {
  const label = topic.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    topic,
    label,
    signal,
    isRemedialFlagged: false,
    dueCount,
    masteryState: "NEEDS_REVIEW",
    totalOccurrences,
  };
}

// ── FIRST_MASTERY ─────────────────────────────────────────────────────────────

console.log("\n── FIRST_MASTERY ────────────────────────────────────────────────");

{
  const profile = makeProfile({
    masterySummary: {
      totalTopics: 1,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 1 },
      masteredTopics: ["Conditionals"],
      needsReviewTopics: [],
    },
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "FIRST_MASTERY");
  assert("exactly 1 mastered → FIRST_MASTERY fires", s !== undefined);
  assert("FIRST_MASTERY severity = HIGH", s?.severity === "HIGH");
  assert("FIRST_MASTERY topicLabel = mastered topic label", s?.topicLabel === "Conditionals");
  assert("FIRST_MASTERY topic = null (global signal)", s?.topic === null);
  assert("FIRST_MASTERY suppressionKey = 'FIRST_MASTERY'", s?.suppressionKey === "FIRST_MASTERY");
}

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 0);
  assert("0 mastered → no FIRST_MASTERY", !signals.find((s) => s.type === "FIRST_MASTERY"));
}

{
  const profile = makeProfile({
    masterySummary: {
      totalTopics: 2,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 2 },
      masteredTopics: ["Conditionals", "Present Perfect"],
      needsReviewTopics: [],
    },
  });
  const signals = computeLearningSignals(profile, 0);
  assert("2 mastered → no FIRST_MASTERY (fires TOPIC_MASTERED instead)",
    !signals.find((s) => s.type === "FIRST_MASTERY"));
}

// ── TOPIC_MASTERED ────────────────────────────────────────────────────────────

console.log("\n── TOPIC_MASTERED ───────────────────────────────────────────────");

{
  const profile = makeProfile({
    masterySummary: {
      totalTopics: 1,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 1 },
      masteredTopics: ["Conditionals"],
      needsReviewTopics: [],
    },
  });
  const signals = computeLearningSignals(profile, 0);
  assert("1 mastered → no TOPIC_MASTERED (FIRST_MASTERY fires instead)",
    !signals.find((s) => s.type === "TOPIC_MASTERED"));
}

{
  const profile = makeProfile({
    masterySummary: {
      totalTopics: 2,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 2 },
      masteredTopics: ["Conditionals", "Present Perfect"],
      needsReviewTopics: [],
    },
  });
  const signals = computeLearningSignals(profile, 0);
  const mastered = signals.filter((s) => s.type === "TOPIC_MASTERED");
  assert("2 mastered → 2 TOPIC_MASTERED signals", mastered.length === 2);
  assert("TOPIC_MASTERED confidence = HIGH", mastered.every((s) => s.confidence === "HIGH"));
  assert("TOPIC_MASTERED evidence.masteredCount = 2",
    mastered.every((s) => s.evidence.masteredCount === 2));
}

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 0);
  assert("0 mastered → no TOPIC_MASTERED", !signals.find((s) => s.type === "TOPIC_MASTERED"));
}

// ── TOPIC_IMPROVING ───────────────────────────────────────────────────────────

console.log("\n── TOPIC_IMPROVING ──────────────────────────────────────────────");

{
  const profile = makeProfile({
    improvingTopics: [makeMasteryProfile("conditionals", "IMPROVING", 5)],
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "TOPIC_IMPROVING");
  assert("IMPROVING masteryState → TOPIC_IMPROVING fires", s !== undefined);
  assert("TOPIC_IMPROVING topic key set", s?.topic === "conditionals");
  assert("TOPIC_IMPROVING confidence HIGH for ≥5 occurrences", s?.confidence === "HIGH");
}

{
  const profile = makeProfile({
    improvingTopics: [makeMasteryProfile("present_perfect", "IMPROVING", 3)],
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "TOPIC_IMPROVING");
  assert("TOPIC_IMPROVING confidence MEDIUM for 3 occurrences", s?.confidence === "MEDIUM");
}

{
  const profile = makeProfile({
    improvingTopics: [makeMasteryProfile("articles", "STABLE", 6)],
  });
  const signals = computeLearningSignals(profile, 0);
  assert("STABLE masteryState → no TOPIC_IMPROVING",
    !signals.find((s) => s.type === "TOPIC_IMPROVING"));
}

{
  const profile = makeProfile({
    improvingTopics: [
      makeMasteryProfile("conditionals", "IMPROVING", 5),
      makeMasteryProfile("present_perfect", "IMPROVING", 3),
      makeMasteryProfile("articles", "STABLE", 4),
    ],
  });
  const signals = computeLearningSignals(profile, 0);
  const improving = signals.filter((s) => s.type === "TOPIC_IMPROVING");
  assert("2 IMPROVING topics → 2 TOPIC_IMPROVING signals (STABLE excluded)",
    improving.length === 2);
}

// ── RECURRING_WEAKNESS ────────────────────────────────────────────────────────

console.log("\n── RECURRING_WEAKNESS ───────────────────────────────────────────");

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("conditionals", "RECURRING", 5)],
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "RECURRING_WEAKNESS");
  assert("RECURRING + ≥3 occurrences → signal fires", s !== undefined);
  assert("RECURRING_WEAKNESS severity = HIGH", s?.severity === "HIGH");
  assert("RECURRING_WEAKNESS confidence HIGH for 5 occurrences", s?.confidence === "HIGH");
  assert("RECURRING_WEAKNESS suppressionKey includes topic",
    s?.suppressionKey === "RECURRING_WEAKNESS_conditionals");
}

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("articles", "RECURRING", 2)],
  });
  const signals = computeLearningSignals(profile, 0);
  assert("RECURRING + 2 occurrences (< 3) → no signal",
    !signals.find((s) => s.type === "RECURRING_WEAKNESS"));
}

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("present_perfect", "IMPROVING", 5)],
  });
  const signals = computeLearningSignals(profile, 0);
  assert("IMPROVING signal (not RECURRING) → no RECURRING_WEAKNESS",
    !signals.find((s) => s.type === "RECURRING_WEAKNESS"));
}

{
  const profile = makeProfile({
    activeWeaknesses: [
      makeWeakness("conditionals", "RECURRING", 5),
      makeWeakness("articles", "RECURRING", 3),
    ],
  });
  const signals = computeLearningSignals(profile, 0);
  const rw = signals.filter((s) => s.type === "RECURRING_WEAKNESS");
  assert("2 recurring topics → 2 RECURRING_WEAKNESS signals", rw.length === 2);
}

// ── RETENTION_RISK ────────────────────────────────────────────────────────────

console.log("\n── RETENTION_RISK ───────────────────────────────────────────────");

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("conditionals", "IMPROVING", 3, 2)],
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "RETENTION_RISK");
  assert("dueCount=2 + non-RECURRING → RETENTION_RISK fires", s !== undefined);
  assert("RETENTION_RISK confidence MEDIUM for dueCount=2", s?.confidence === "MEDIUM");
}

{
  // RECURRING topic with dueCount > 0 — captured by RECURRING_WEAKNESS, not RETENTION_RISK
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("conditionals", "RECURRING", 5, 3)],
  });
  const signals = computeLearningSignals(profile, 0);
  assert("RECURRING + dueCount>0 → RECURRING_WEAKNESS (not RETENTION_RISK)",
    !signals.find((s) => s.type === "RETENTION_RISK"));
}

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("conditionals", "IMPROVING", 3, 0)],
  });
  const signals = computeLearningSignals(profile, 0);
  assert("dueCount=0 → no RETENTION_RISK",
    !signals.find((s) => s.type === "RETENTION_RISK"));
}

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("present_perfect", "IMPROVING", 3, 3)],
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "RETENTION_RISK");
  assert("dueCount≥3 → RETENTION_RISK confidence HIGH", s?.confidence === "HIGH");
}

// ── LEARNING_MOMENTUM ─────────────────────────────────────────────────────────

console.log("\n── LEARNING_MOMENTUM ────────────────────────────────────────────");

{
  const profile = makeProfile({
    learningTrend: "PROGRESSING",
    behaviorProfile: makeBehaviorProfile({ confidenceTier: "CONFIRMED", sessionCount: 12 }),
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "LEARNING_MOMENTUM");
  assert("PROGRESSING trend → LEARNING_MOMENTUM fires", s !== undefined);
  assert("LEARNING_MOMENTUM confidence HIGH for CONFIRMED tier", s?.confidence === "HIGH");
}

{
  const profile = makeProfile({
    learningTrend: "PROGRESSING",
    behaviorProfile: makeBehaviorProfile({ confidenceTier: "EMERGING", sessionCount: 6 }),
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "LEARNING_MOMENTUM");
  assert("LEARNING_MOMENTUM confidence MEDIUM for EMERGING tier", s?.confidence === "MEDIUM");
}

{
  const profile = makeProfile({ learningTrend: "STABLE" });
  const signals = computeLearningSignals(profile, 0);
  assert("STABLE trend → no LEARNING_MOMENTUM",
    !signals.find((s) => s.type === "LEARNING_MOMENTUM"));
}

{
  const profile = makeProfile({ learningTrend: "NEEDS_ATTENTION" });
  const signals = computeLearningSignals(profile, 0);
  assert("NEEDS_ATTENTION trend → no LEARNING_MOMENTUM",
    !signals.find((s) => s.type === "LEARNING_MOMENTUM"));
}

// ── PACE_OBSERVATION ──────────────────────────────────────────────────────────

console.log("\n── PACE_OBSERVATION ─────────────────────────────────────────────");

{
  const profile = makeProfile({
    behaviorProfile: makeBehaviorProfile({ paceProfile: "DECLINING", sessionCount: 5 }),
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "PACE_OBSERVATION");
  assert("DECLINING + sessionCount≥3 → PACE_OBSERVATION fires", s !== undefined);
  assert("PACE_OBSERVATION severity = LOW", s?.severity === "LOW");
  assert("PACE_OBSERVATION confidence = LOW", s?.confidence === "LOW");
}

{
  const profile = makeProfile({
    behaviorProfile: makeBehaviorProfile({ paceProfile: "DECLINING", sessionCount: 2 }),
  });
  const signals = computeLearningSignals(profile, 0);
  assert("DECLINING + sessionCount=2 (< 3) → no signal",
    !signals.find((s) => s.type === "PACE_OBSERVATION"));
}

{
  const profile = makeProfile({
    behaviorProfile: makeBehaviorProfile({ paceProfile: "CONSISTENT", sessionCount: 10 }),
  });
  const signals = computeLearningSignals(profile, 0);
  assert("CONSISTENT paceProfile → no PACE_OBSERVATION",
    !signals.find((s) => s.type === "PACE_OBSERVATION"));
}

{
  const profile = makeProfile({
    behaviorProfile: makeBehaviorProfile({ paceProfile: null, sessionCount: 10 }),
  });
  const signals = computeLearningSignals(profile, 0);
  assert("null paceProfile → no PACE_OBSERVATION",
    !signals.find((s) => s.type === "PACE_OBSERVATION"));
}

// ── STREAK_MILESTONE ──────────────────────────────────────────────────────────

console.log("\n── STREAK_MILESTONE ─────────────────────────────────────────────");

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 7);
  const s = signals.find((s) => s.type === "STREAK_MILESTONE");
  assert("streak=7 → STREAK_MILESTONE fires", s !== undefined);
  assert("STREAK_MILESTONE confidence = HIGH", s?.confidence === "HIGH");
  assert("STREAK_MILESTONE suppressionKey = 'STREAK_MILESTONE_7'",
    s?.suppressionKey === "STREAK_MILESTONE_7");
  assert("STREAK_MILESTONE evidence.currentStreak = 7",
    s?.evidence.currentStreak === 7);
}

{
  const profile = makeProfile();
  assert("streak=5 (not a milestone) → no signal",
    !computeLearningSignals(profile, 5).find((s) => s.type === "STREAK_MILESTONE"));
}

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 30);
  assert("streak=30 → STREAK_MILESTONE fires",
    signals.find((s) => s.type === "STREAK_MILESTONE") !== undefined);
}

{
  const profile = makeProfile();
  assert("streak=3 (first milestone) → STREAK_MILESTONE fires",
    computeLearningSignals(profile, 3).find((s) => s.type === "STREAK_MILESTONE") !== undefined);
}

// ── Sorting ───────────────────────────────────────────────────────────────────

console.log("\n── Sorting ──────────────────────────────────────────────────────");

{
  // HIGH (RECURRING_WEAKNESS) should come before MEDIUM (TOPIC_IMPROVING) and LOW (PACE_OBSERVATION)
  const profile = makeProfile({
    learningTrend: "PROGRESSING",
    improvingTopics: [makeMasteryProfile("present_perfect", "IMPROVING", 5)],
    activeWeaknesses: [makeWeakness("conditionals", "RECURRING", 5)],
    behaviorProfile: makeBehaviorProfile({ paceProfile: "DECLINING", sessionCount: 5 }),
  });
  const signals = computeLearningSignals(profile, 0);
  const severities = signals.map((s) => s.severity);
  const firstHigh = severities.indexOf("HIGH");
  const firstMedium = severities.indexOf("MEDIUM");
  const firstLow = severities.indexOf("LOW");
  assert("HIGH signals appear before MEDIUM",
    firstHigh === -1 || firstMedium === -1 || firstHigh < firstMedium);
  assert("MEDIUM signals appear before LOW",
    firstMedium === -1 || firstLow === -1 || firstMedium < firstLow);
}

{
  // At the same severity (MEDIUM), topic-specific before global
  const profile = makeProfile({
    learningTrend: "PROGRESSING",
    improvingTopics: [makeMasteryProfile("present_perfect", "IMPROVING", 5)],
    behaviorProfile: makeBehaviorProfile({ confidenceTier: "CONFIRMED", sessionCount: 12 }),
  });
  const signals = computeLearningSignals(profile, 7);
  const mediumSignals = signals.filter((s) => s.severity === "MEDIUM");
  const firstTopicSpecific = mediumSignals.findIndex((s) => s.topic !== null);
  const firstGlobal = mediumSignals.findIndex((s) => s.topic === null);
  assert("topic-specific MEDIUM signals appear before global MEDIUM signals",
    firstTopicSpecific === -1 || firstGlobal === -1 || firstTopicSpecific < firstGlobal);
}

// ── Signal cap ────────────────────────────────────────────────────────────────

console.log("\n── Signal cap ───────────────────────────────────────────────────");

{
  // Create 7+ conditions to trigger cap
  const profile = makeProfile({
    masterySummary: {
      totalTopics: 3,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 1, STABLE: 0, MASTERED: 3 },
      masteredTopics: ["Conditionals", "Present Perfect", "Articles"],
      needsReviewTopics: [],
    },
    learningTrend: "PROGRESSING",
    improvingTopics: [makeMasteryProfile("passive_voice", "IMPROVING", 5)],
    activeWeaknesses: [
      makeWeakness("tense_review", "RECURRING", 5),
      makeWeakness("reported_speech", "IMPROVING", 3, 2),
    ],
    behaviorProfile: makeBehaviorProfile({
      paceProfile: "DECLINING",
      sessionCount: 5,
      confidenceTier: "CONFIRMED",
    }),
  });
  const signals = computeLearningSignals(profile, 7);
  assert(`signal cap: at most ${SIGNAL_CAP} signals returned`,
    signals.length <= SIGNAL_CAP,
    `got ${signals.length}`);
}

// ── Empty profile ─────────────────────────────────────────────────────────────

console.log("\n── Empty profile ────────────────────────────────────────────────");

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 0);
  assert("new student with 0 streak and no data → no signals", signals.length === 0);
}

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 3);
  assert("new student with streak=3 → only STREAK_MILESTONE",
    signals.length === 1 && signals[0].type === "STREAK_MILESTONE");
}

// ── generatedAt ──────────────────────────────────────────────────────────────

console.log("\n── generatedAt ──────────────────────────────────────────────────");

{
  const profile = makeProfile({
    masterySummary: {
      totalTopics: 1,
      byState: { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 1 },
      masteredTopics: ["Conditionals"],
      needsReviewTopics: [],
    },
  });
  const signals = computeLearningSignals(profile, 0);
  assert("all signals share the same generatedAt timestamp",
    new Set(signals.map((s) => s.generatedAt)).size === 1);
  assert("generatedAt is a valid ISO string",
    signals.length === 0 || !isNaN(Date.parse(signals[0].generatedAt)));
}

// ── suppressionKey format ─────────────────────────────────────────────────────

console.log("\n── suppressionKey format ────────────────────────────────────────");

{
  const profile = makeProfile({
    activeWeaknesses: [makeWeakness("present_perfect", "RECURRING", 5)],
  });
  const signals = computeLearningSignals(profile, 0);
  const s = signals.find((s) => s.type === "RECURRING_WEAKNESS");
  assert("RECURRING_WEAKNESS suppressionKey = 'RECURRING_WEAKNESS_{topic}'",
    s?.suppressionKey === "RECURRING_WEAKNESS_present_perfect");
}

{
  const profile = makeProfile();
  const signals = computeLearningSignals(profile, 14);
  const s = signals.find((s) => s.type === "STREAK_MILESTONE");
  assert("STREAK_MILESTONE suppressionKey = 'STREAK_MILESTONE_{n}'",
    s?.suppressionKey === "STREAK_MILESTONE_14");
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
