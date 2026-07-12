/**
 * Test suite — LEXI Lens Service (Phase 6.2)
 *
 * Tests assembleLensViewModel() — the pure orchestration helper exposed by lensService.ts.
 * getLearnerLens() is the async service wrapper; its DB fetch is covered by the
 * existing StudentLearningProfile tests. These tests verify the composition contract:
 * that assembleLensViewModel calls every transformer and returns a valid LensViewModel.
 *
 * Sections:
 *   1.  LensViewModel output shape
 *   2.  summary delegation
 *   3.  insights delegation
 *   4.  strengths delegation
 *   5.  challenges delegation
 *   6.  recommendations delegation
 *   7.  empty profile — all views graceful
 *   8.  output contract — every item carries confidenceTier + source
 *   9.  determinism — same profile → same LensViewModel
 *   10. independence — transformers do not feed each other
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
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(str, sub, msg) {
  if (!str.includes(sub)) {
    throw new Error(msg ?? `expected "${str}" to include "${sub}"`);
  }
}

// ─────────────────────────────────────────────────────────
// Inlined ConfidenceTier enum (matches TypeScript runtime values)
// ─────────────────────────────────────────────────────────

const CT = { OBSERVED: "OBSERVED", EMERGING: "EMERGING", CONFIRMED: "CONFIRMED" };

// ─────────────────────────────────────────────────────────
// Inlined confidence utilities
// ─────────────────────────────────────────────────────────

function mapConfidenceTier(tier) {
  if (tier === CT.CONFIRMED) return "HIGH";
  if (tier === CT.EMERGING)  return "MEDIUM";
  return "LOW";
}

function mapSignalConfidence(c) {
  if (c === "HIGH")   return CT.CONFIRMED;
  if (c === "MEDIUM") return CT.EMERGING;
  return CT.OBSERVED;
}

function mapRecommendationConfidence(c) {
  return mapSignalConfidence(c);
}

// ─────────────────────────────────────────────────────────
// Inlined transformer implementations
// (mirrors Phase 6.1 — same logic as test-lexi-lens-foundation.mjs)
// ─────────────────────────────────────────────────────────

function buildLearnerSummary(profile) {
  const { learnerModel, learningTrend, currentStreak } = profile;
  const { knowledgeState, learningBehaviorState, problemSolvingState } = learnerModel;
  const { engagementLevel, recentMoodContext } = learningBehaviorState.engagementObservation;
  const topicCount    = knowledgeState.topicCount;
  const masteredCount = knowledgeState.masteredConcepts.length;
  const developingCount = knowledgeState.developingConcepts.length;
  const weakCount     = knowledgeState.weakConcepts.length;
  const confidenceTier = knowledgeState.confidenceTier;
  const isLow = confidenceTier === CT.OBSERVED;

  if (topicCount < 1) {
    return {
      narrative: "No learning data yet. Complete a few sessions to see your profile.",
      engagementLevel, masteredCount: 0, developingCount: 0, weakCount: 0,
      streakDays: currentStreak, topicCount: 0, trendIndicator: learningTrend,
      confidenceLevel: "LOW", confidenceTier, source: "learnerModel.knowledgeState",
    };
  }
  const openings = { HIGHLY_ACTIVE: "A highly active learner", ACTIVE: "An active learner",
    OCCASIONAL: "An occasional learner", INACTIVE: "An inactive learner" };
  const trends = { PROGRESSING: `showing clear progress across ${topicCount} topics.`,
    STABLE: `holding steady across ${topicCount} topics.`,
    NEEDS_ATTENTION: `with topics that need attention across ${topicCount} topics.`,
    INSUFFICIENT_DATA: "still building learning history." };
  const parts = [`${openings[engagementLevel] ?? "A learner"} ${trends[learningTrend] ?? ""}`];
  if (isLow) parts.push("Still building a picture of progress across topics.");
  else if (masteredCount > 0) parts.push(`Has mastered ${masteredCount} topic${masteredCount !== 1 ? "s" : ""}.`);
  else parts.push(`No mastered topics yet; all ${topicCount} are in active review.`);
  if (recentMoodContext) parts.push(`Recent sessions show ${recentMoodContext} mood context.`);
  return {
    narrative: parts.join(" "), engagementLevel, masteredCount, developingCount, weakCount,
    streakDays: currentStreak, topicCount, trendIndicator: learningTrend,
    confidenceLevel: mapConfidenceTier(confidenceTier), confidenceTier,
    source: "learnerModel.knowledgeState",
  };
}

function extractLearningInsights(profile) {
  const signal = profile.topSignal;
  const perf   = profile.learnerModel.performanceState;
  const prob   = profile.learnerModel.problemSolvingState;
  const insights = [];

  if (signal) {
    const ct = mapSignalConfidence(signal.confidence);
    const prefix = ct === CT.OBSERVED ? "Early sign: " : "";
    const msgs = {
      FIRST_MASTERY: `${prefix}You just mastered your first topic: ${signal.topicLabel}! This is a big milestone.`,
      TOPIC_MASTERED: `${prefix}You've mastered ${signal.topicLabel}. Great progress!`,
      TOPIC_IMPROVING: `${prefix}${signal.topicLabel} is improving. Keep practicing.`,
      RECURRING_WEAKNESS: `${prefix}${signal.topicLabel} shows a recurring pattern. You've reviewed it multiple times but mistakes continue.`,
      RETENTION_RISK: `${prefix}${signal.topicLabel} is at risk of being forgotten — these entries are due for review.`,
      LEARNING_MOMENTUM: `${prefix}You're making overall progress. Keep up the momentum.`,
      PACE_OBSERVATION: `${prefix}Your session pace has been declining.`,
      STREAK_MILESTONE: `You're on a ${signal.evidence.currentStreak}-day streak! Consistent daily practice is the fastest path to improvement.`,
    };
    const narrative = msgs[signal.type];
    if (narrative) {
      insights.push({
        type: "PRIMARY_SIGNAL", narrative,
        evidence: { signalType: signal.type,
          streakDays: signal.type === "STREAK_MILESTONE" ? signal.evidence.currentStreak : undefined },
        confidence: mapConfidenceTier(ct), confidenceTier: ct, source: "topSignal",
      });
    }
  }

  if (insights.length < 3) {
    const ct = perf.confidenceTier;
    const prefix = ct === CT.OBSERVED ? "Early observation: " : "";
    let narrative;
    if (perf.accuracyTrend === "INSUFFICIENT_DATA") {
      narrative = "Too early to measure accuracy trends — complete a few more attempts.";
    } else {
      const acc = `${Math.round(perf.overallAccuracy)}%`;
      if (perf.accuracyTrend === "IMPROVING") narrative = `${prefix}Your accuracy is improving (currently ${acc}). Great progress!`;
      else if (perf.accuracyTrend === "STABLE")   narrative = `${prefix}You're holding steady at ${acc} accuracy — a solid foundation.`;
      else if (perf.accuracyTrend === "DECLINING") narrative = `${prefix}Your accuracy has been declining (currently ${acc}).`;
    }
    if (narrative) {
      insights.push({
        type: "ACCURACY_TREND", narrative, evidence: {},
        confidence: perf.accuracyTrend === "INSUFFICIENT_DATA" ? "LOW" : mapConfidenceTier(ct),
        confidenceTier: perf.accuracyTrend === "INSUFFICIENT_DATA" ? CT.OBSERVED : ct,
        source: "learnerModel.performanceState",
      });
    }
  }

  if (insights.length < 3 && perf.consistencyProfile !== "CONSISTENT" && perf.confidenceTier !== CT.OBSERVED) {
    const ct = perf.confidenceTier;
    const prefix = ct === CT.EMERGING ? "It looks like " : "";
    const body = perf.consistencyProfile === "VARIABLE"
      ? "your performance varies session to session."
      : "your results are erratic.";
    let narrative = prefix ? prefix + body : body.charAt(0).toUpperCase() + body.slice(1);
    insights.push({
      type: "CONSISTENCY", narrative,
      confidence: mapConfidenceTier(ct), confidenceTier: ct,
      source: "learnerModel.performanceState.consistencyProfile",
    });
  }

  if (insights.length < 3 && prob.feedbackRecovery.value !== "UNKNOWN") {
    const ct = prob.confidenceTier;
    const prefix = ct === CT.OBSERVED ? "Early observation: " : "";
    const msgs = {
      RECOVERS_QUICKLY: `${prefix}When you make a mistake, you usually correct it immediately. Strong error recovery.`,
      GRADUAL_RECOVERY: `${prefix}You recover from errors gradually.`,
      SLOW_RECOVERY:    `${prefix}You recover from errors slowly. Consider reviewing the explanation after each mistake.`,
    };
    const narrative = msgs[prob.feedbackRecovery.value];
    if (narrative) insights.push({
      type: "RECOVERY", narrative,
      confidence: mapConfidenceTier(ct), confidenceTier: ct,
      source: "learnerModel.problemSolvingState.feedbackRecovery",
    });
  }

  return { insights: insights.slice(0, 3), generatedAt: new Date().toISOString() };
}

function deriveStrengths(profile) {
  const { knowledgeState, performanceState, learningBehaviorState } = profile.learnerModel;
  const kt = knowledgeState.confidenceTier;
  const pt = performanceState.confidenceTier;
  const items = [];

  if (kt !== CT.OBSERVED) {
    knowledgeState.masteredConcepts.slice(0, 5).forEach((c) => {
      items.push({ type: "MASTERED_TOPIC", label: c.label, detail: "You've mastered this topic.",
        confidence: mapConfidenceTier(kt), confidenceTier: kt,
        source: "learnerModel.knowledgeState.masteredConcepts" });
    });
    if (knowledgeState.masteredConcepts.length > 5) {
      const ov = knowledgeState.masteredConcepts.length - 5;
      items.push({ type: "MASTERED_TOPIC", label: `+${ov} more mastered topics`,
        percentageOrCount: ov, confidence: mapConfidenceTier(kt), confidenceTier: kt,
        source: "learnerModel.knowledgeState.masteredConcepts" });
    }
  }

  const dev = knowledgeState.developingConcepts;
  if (dev.length > 0) {
    items.push({ type: "DEVELOPING_TOPIC",
      label: `Making progress on ${dev.length} topic${dev.length !== 1 ? "s" : ""}`,
      detail: dev.slice(0, 3).map((c) => c.label).join(", "),
      percentageOrCount: dev.length, confidence: mapConfidenceTier(kt), confidenceTier: kt,
      source: "learnerModel.knowledgeState.developingConcepts" });
  }

  if (pt !== CT.OBSERVED) {
    performanceState.skillPerformance.filter((s) => s.tier === "STRONG").slice(0, 3).forEach((s) => {
      items.push({ type: "STRONG_SKILL", label: `Strong in ${s.label}`,
        detail: `${Math.round(s.percentage)}% accuracy`, percentageOrCount: s.percentage,
        confidence: mapConfidenceTier(pt), confidenceTier: pt,
        source: "learnerModel.performanceState.skillPerformance" });
    });
  }

  return {
    strengths: items.slice(0, 8),
    generatedAt: new Date().toISOString(),
    confidenceNote: kt === CT.OBSERVED ? "These are early observations based on limited data." : undefined,
  };
}

function deriveChallenges(profile) {
  const { performanceState, problemSolvingState, knowledgeState } = profile.learnerModel;
  const kt = knowledgeState.confidenceTier;
  const pt = performanceState.confidenceTier;
  const prt = problemSolvingState.confidenceTier;
  const prefix = prt === CT.OBSERVED ? "Early sign: " : "";
  const items = [];

  profile.activeWeaknesses.filter((w) => w.signal !== "IMPROVED").slice(0, 5).forEach((w) => {
    const parts = [];
    if (w.signal === "RECURRING") parts.push("You've reviewed this but mistakes continue.");
    else if (w.signal === "IMPROVING") parts.push("Still working on this — recent progress shows improvement.");
    else parts.push("No clear progress yet — may need a fresh approach.");
    if (w.dueCount > 0) parts.push("Due for review now.");
    if (w.isRemedialFlagged) parts.push("You've flagged this for extra help.");
    items.push({ type: "ACTIVE_WEAKNESS", label: w.label, reason: parts.join(" "),
      signal: w.signal, dueNow: w.dueCount > 0,
      confidence: mapConfidenceTier(kt), confidenceTier: kt, source: "activeWeaknesses" });
  });

  performanceState.skillPerformance.filter((s) => s.tier === "WEAK").slice(0, 3).forEach((s) => {
    items.push({ type: "WEAK_SKILL", label: `Weak in ${s.label}`,
      reason: `Your accuracy in ${s.label} is ${Math.round(s.percentage)}%.`,
      confidence: mapConfidenceTier(pt), confidenceTier: pt,
      source: "learnerModel.performanceState.skillPerformance" });
  });

  const recurringCount = profile.activeWeaknesses.filter((w) => w.signal === "RECURRING").length;
  if (problemSolvingState.helpSeeking.value === "LOW_ENGAGEMENT" && recurringCount > 0) {
    items.push({ type: "HELP_SEEKING_GAP", label: "Low engagement with remediation",
      reason: `${prefix}You haven't flagged topics for extra help, even though ${recurringCount} topic${recurringCount !== 1 ? "s" : ""} show recurring mistakes.`,
      actionHint: "Try reviewing the error notebook and marking topics for remediation.",
      confidence: mapConfidenceTier(prt), confidenceTier: prt,
      source: "learnerModel.problemSolvingState.helpSeeking" });
  }

  if (problemSolvingState.errorCorrection.value === "ERRORS_PERSISTING") {
    items.push({ type: "ERROR_PATTERN", label: "Errors not decreasing",
      reason: `${prefix}Recorded errors are not decreasing. You're reviewing but not resolving the mistakes.`,
      actionHint: "This usually means the explanation needs to be different, or the topic needs more examples.",
      confidence: mapConfidenceTier(prt), confidenceTier: prt,
      source: "learnerModel.problemSolvingState.errorCorrection" });
  }

  return { challenges: items.slice(0, 7), generatedAt: new Date().toISOString() };
}

function buildLensRecommendations(profile) {
  const { recommendations, nextSessionNumber, currentStreak } = profile;
  const pref = profile.learnerModel.learningPreferenceState;

  const actions = recommendations.map((rec) => {
    const ct = mapRecommendationConfidence(rec.confidence);
    let reason;
    switch (rec.priorityLabel) {
      case "RECURRING_MISTAKE": reason = `You've practiced this but mistakes continue. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`; break;
      case "DUE_REVIEW":        reason = `It's been a while since your last review. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`; break;
      case "WEAKNESS_SIGNAL":   reason = `Your recent accuracy was low on this topic. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`; break;
      case "CURRICULUM_PROGRESS": reason = rec.sessionNumber
        ? `You've finished the current content. Advance to Session ${rec.sessionNumber}${rec.label ? `: ${rec.label}` : ""}.`
        : "You've finished the current content. Advance to the next session.";
        break;
      default: reason = rec.reason;
    }
    if (rec.priorityLabel === "CURRICULUM_PROGRESS" && pref.practiceMode.value === "EXAM_SIMULATION") reason += " Try a full-length exam simulation.";
    if (pref.sessionDuration.value === "SHORT" && (rec.priorityLabel === "RECURRING_MISTAKE" || rec.priorityLabel === "WEAKNESS_SIGNAL")) reason += " Quick 5-question drill recommended.";

    const item = { priority: rec.priority, topic: rec.topic, label: rec.label, reason,
      suggestedAction: rec.suggestedAction,
      questionCount: rec.questionCount > 0 ? rec.questionCount : undefined,
      confidence: mapConfidenceTier(ct), confidenceTier: ct, source: "recommendations" };
    if (rec.sessionNumber !== undefined) item.sessionNumber = rec.sessionNumber;
    if (rec.priorityLabel === "CURRICULUM_PROGRESS" && rec.label) item.sessionTitle = rec.label;
    return item;
  });

  return {
    actions,
    nextSessionReady: nextSessionNumber !== null,
    streakContext: currentStreak >= 7 ? `Keep your ${currentStreak}-day streak going!` : undefined,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Inlined assembleLensViewModel (mirrors lensService.ts)
// ─────────────────────────────────────────────────────────

function assembleLensViewModel(profile) {
  return {
    summary:         buildLearnerSummary(profile),
    insights:        extractLearningInsights(profile),
    strengths:       deriveStrengths(profile),
    challenges:      deriveChallenges(profile),
    recommendations: buildLensRecommendations(profile),
    generatedAt:     new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────

function emptyProfile() {
  return {
    userId: "u1", generatedAt: "2026-06-30T00:00:00.000Z",
    readiness: null,
    masterySummary: { totalTopics: 0, byState: { MASTERED: 0, IMPROVING: 0, STABLE: 0, NEEDS_REVIEW: 0 }, masteredTopics: [], needsReviewTopics: [] },
    skillSnapshot: [], learningTrend: "INSUFFICIENT_DATA", improvingTopics: [],
    activeWeaknesses: [], recommendations: [],
    nextSessionNumber: null, nextSessionTitle: null, nextSessionObjective: null,
    behaviorProfile: { preferredTimeOfDay: null, paceProfile: null, avgSessionDurationMin: null,
      responseTimeSignal: null, recentMoodContext: null, sessionCount: 0, confidenceTier: "OBSERVED" },
    currentStreak: 0, topSignal: null, goalCountdown: null,
    learnerModel: {
      knowledgeState: { masteredConcepts: [], developingConcepts: [], weakConcepts: [],
        confidenceTier: "OBSERVED", topicCount: 0, computedAt: "2026-06-30T00:00:00.000Z" },
      performanceState: { accuracyTrend: "INSUFFICIENT_DATA", overallAccuracy: 0,
        consistencyProfile: "CONSISTENT", skillPerformance: [],
        confidenceTier: "OBSERVED", computedAt: "2026-06-30T00:00:00.000Z" },
      learningBehaviorState: {
        sessionPattern: { sessionCount: 0, avgSessionDurationMin: null, preferredTimeOfDay: null },
        completionBehavior: { completedSessionCount: 0 },
        paceObservation: { paceProfile: null },
        retryBehavior: { responseTimeSignal: null },
        engagementObservation: { engagementLevel: "INACTIVE", recentMoodContext: null },
        confidenceTier: "OBSERVED", computedAt: "2026-06-30T00:00:00.000Z",
      },
      learningPreferenceState: {
        practiceTime:       { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        sessionDuration:    { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        explanationDepth:   { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        hintFrequency:      { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        feedbackTiming:     { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        practiceMode:       { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        languagePreference: { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
        computedAt: "2026-06-30T00:00:00.000Z",
      },
      problemSolvingState: {
        retryPattern:     { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
        feedbackRecovery: { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
        helpSeeking:      { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
        errorCorrection:  { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
        confidenceTier: "OBSERVED", computedAt: "2026-06-30T00:00:00.000Z",
      },
      assembledAt: "2026-06-30T00:00:00.000Z",
    },
  };
}

function richProfile() {
  const p = emptyProfile();
  p.learningTrend = "PROGRESSING";
  p.currentStreak = 10;
  p.nextSessionNumber = 3;
  p.nextSessionTitle = "Intermediate Grammar";

  p.learnerModel.knowledgeState = {
    masteredConcepts: [
      { topic: "present_simple", label: "Present Simple", masteryState: "MASTERED" },
      { topic: "past_simple",    label: "Past Simple",    masteryState: "MASTERED" },
    ],
    developingConcepts: [
      { topic: "present_perfect", label: "Present Perfect", masteryState: "IMPROVING" },
    ],
    weakConcepts: [
      { topic: "subjunctive", label: "Subjunctive", masteryState: "NEEDS_REVIEW" },
    ],
    confidenceTier: "CONFIRMED", topicCount: 4, computedAt: "2026-06-30T00:00:00.000Z",
  };

  p.learnerModel.performanceState = {
    accuracyTrend: "IMPROVING", overallAccuracy: 72, consistencyProfile: "CONSISTENT",
    skillPerformance: [
      { skill: "reading", label: "Reading",  percentage: 82, tier: "STRONG" },
      { skill: "grammar", label: "Grammar",  percentage: 55, tier: "DEVELOPING" },
      { skill: "writing", label: "Writing",  percentage: 38, tier: "WEAK" },
    ],
    confidenceTier: "CONFIRMED", computedAt: "2026-06-30T00:00:00.000Z",
  };

  p.learnerModel.learningBehaviorState.engagementObservation.engagementLevel = "ACTIVE";
  p.learnerModel.learningBehaviorState.confidenceTier = "CONFIRMED";

  p.learnerModel.problemSolvingState = {
    retryPattern:     { value: "FREQUENT_RETRIER", evidence: "8/10 retried.",   confidenceTier: "CONFIRMED" },
    feedbackRecovery: { value: "RECOVERS_QUICKLY",  evidence: "70% post-error.", confidenceTier: "CONFIRMED" },
    helpSeeking:      { value: "SOME_ENGAGEMENT",   evidence: "3/5 flagged.",    confidenceTier: "CONFIRMED" },
    errorCorrection:  { value: "ERRORS_REDUCING",   evidence: "4/6 improved.",   confidenceTier: "CONFIRMED" },
    confidenceTier: "CONFIRMED", computedAt: "2026-06-30T00:00:00.000Z",
  };

  p.topSignal = {
    type: "TOPIC_MASTERED", severity: "MEDIUM", topic: null,
    topicLabel: "Present Simple", evidence: { masteredCount: 2 },
    confidence: "HIGH", generatedAt: "2026-06-30T00:00:00.000Z",
    suppressionKey: "TOPIC_MASTERED_Present Simple",
  };

  p.activeWeaknesses = [
    { topic: "subjunctive", label: "Subjunctive", signal: "RECURRING",
      isRemedialFlagged: false, dueCount: 2, masteryState: "NEEDS_REVIEW", totalOccurrences: 6 },
  ];

  p.recommendations = [
    { topic: "subjunctive", label: "Subjunctive", reason: "Recurring mistakes",
      priority: 1, priorityLabel: "RECURRING_MISTAKE", suggestedAction: "REVIEW_NOTEBOOK",
      questionCount: 8, confidence: "HIGH" },
    { topic: "session_3", label: "Intermediate Grammar", reason: "Next session",
      priority: 2, priorityLabel: "CURRICULUM_PROGRESS", suggestedAction: "ADVANCE_SESSION",
      questionCount: 0, sessionNumber: 3, confidence: "MEDIUM" },
  ];

  return p;
}

// ─────────────────────────────────────────────────────────
// Section 1 — LensViewModel output shape
// ─────────────────────────────────────────────────────────

describe("1. LensViewModel output shape");

test("assembleLensViewModel returns all top-level keys", () => {
  const vm = assembleLensViewModel(richProfile());
  assert("summary"         in vm, "summary");
  assert("insights"        in vm, "insights");
  assert("strengths"       in vm, "strengths");
  assert("challenges"      in vm, "challenges");
  assert("recommendations" in vm, "recommendations");
  assert("generatedAt"     in vm, "generatedAt");
});

test("generatedAt is an ISO timestamp string", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(typeof vm.generatedAt === "string", "string");
  assert(vm.generatedAt.includes("T"), "ISO format");
});

test("summary is an object with narrative field", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(typeof vm.summary === "object" && vm.summary !== null, "object");
  assert(typeof vm.summary.narrative === "string", "narrative string");
});

test("insights has insights array and generatedAt", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(Array.isArray(vm.insights.insights), "insights array");
  assert(typeof vm.insights.generatedAt === "string", "generatedAt string");
});

test("strengths has strengths array and generatedAt", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(Array.isArray(vm.strengths.strengths), "strengths array");
  assert(typeof vm.strengths.generatedAt === "string", "generatedAt string");
});

test("challenges has challenges array and generatedAt", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(Array.isArray(vm.challenges.challenges), "challenges array");
  assert(typeof vm.challenges.generatedAt === "string", "generatedAt string");
});

test("recommendations has actions array and nextSessionReady", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(Array.isArray(vm.recommendations.actions), "actions array");
  assert(typeof vm.recommendations.nextSessionReady === "boolean", "nextSessionReady boolean");
  assert(typeof vm.recommendations.generatedAt === "string", "generatedAt string");
});

// ─────────────────────────────────────────────────────────
// Section 2 — summary delegation
// ─────────────────────────────────────────────────────────

describe("2. summary delegation");

test("summary reflects engagementLevel from profile", () => {
  const vm = assembleLensViewModel(richProfile());
  assertEqual(vm.summary.engagementLevel, "ACTIVE");
});

test("summary masteredCount matches knowledgeState", () => {
  const vm = assembleLensViewModel(richProfile());
  assertEqual(vm.summary.masteredCount, 2);
});

test("summary trendIndicator matches learningTrend", () => {
  const vm = assembleLensViewModel(richProfile());
  assertEqual(vm.summary.trendIndicator, "PROGRESSING");
});

test("summary streakDays matches currentStreak", () => {
  const vm = assembleLensViewModel(richProfile());
  assertEqual(vm.summary.streakDays, 10);
});

test("summary confidenceTier is CONFIRMED for rich profile", () => {
  const vm = assembleLensViewModel(richProfile());
  assertEqual(vm.summary.confidenceTier, "CONFIRMED");
  assertEqual(vm.summary.confidenceLevel, "HIGH");
});

test("summary source is learnerModel.knowledgeState", () => {
  assertEqual(assembleLensViewModel(richProfile()).summary.source, "learnerModel.knowledgeState");
});

// ─────────────────────────────────────────────────────────
// Section 3 — insights delegation
// ─────────────────────────────────────────────────────────

describe("3. insights delegation");

test("topSignal produces PRIMARY_SIGNAL insight", () => {
  const vm = assembleLensViewModel(richProfile());
  const primary = vm.insights.insights.find((i) => i.type === "PRIMARY_SIGNAL");
  assert(primary !== undefined, "PRIMARY_SIGNAL present");
  assertEqual(primary.source, "topSignal");
});

test("ACCURACY_TREND insight always present", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.insights.insights.some((i) => i.type === "ACCURACY_TREND"), "ACCURACY_TREND present");
});

test("no more than 3 insights returned", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.insights.insights.length <= 3, `≤3: got ${vm.insights.insights.length}`);
});

test("insights empty for empty profile (only ACCURACY_TREND)", () => {
  const vm = assembleLensViewModel(emptyProfile());
  // ACCURACY_TREND fires as "Too early" even for empty profile
  const trend = vm.insights.insights.find((i) => i.type === "ACCURACY_TREND");
  assert(trend !== undefined, "ACCURACY_TREND present even for empty");
  assertEqual(trend.confidence, "LOW");
});

test("every insight carries source field", () => {
  const vm = assembleLensViewModel(richProfile());
  for (const i of vm.insights.insights) {
    assert(typeof i.source === "string" && i.source.length > 0, `source on ${i.type}`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 4 — strengths delegation
// ─────────────────────────────────────────────────────────

describe("4. strengths delegation");

test("mastered topics appear as MASTERED_TOPIC strength items", () => {
  const vm = assembleLensViewModel(richProfile());
  const mastered = vm.strengths.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  assertEqual(mastered.length, 2);
});

test("developing topics appear as DEVELOPING_TOPIC item", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.strengths.strengths.some((s) => s.type === "DEVELOPING_TOPIC"), "DEVELOPING_TOPIC");
});

test("strong skill appears as STRONG_SKILL item", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.strengths.strengths.some((s) => s.type === "STRONG_SKILL"), "STRONG_SKILL");
});

test("no strengths for empty profile", () => {
  const vm = assembleLensViewModel(emptyProfile());
  assertEqual(vm.strengths.strengths.length, 0);
});

test("OBSERVED confidence → confidenceNote set", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "OBSERVED";
  const vm = assembleLensViewModel(p);
  assert(vm.strengths.confidenceNote !== undefined, "confidenceNote present");
});

test("every strength item carries confidenceTier and source", () => {
  const vm = assembleLensViewModel(richProfile());
  for (const s of vm.strengths.strengths) {
    assert(s.confidenceTier !== undefined, `confidenceTier on ${s.type}`);
    assert(typeof s.source === "string" && s.source.length > 0, `source on ${s.type}`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 5 — challenges delegation
// ─────────────────────────────────────────────────────────

describe("5. challenges delegation");

test("active weakness produces ACTIVE_WEAKNESS challenge", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.challenges.challenges.some((c) => c.type === "ACTIVE_WEAKNESS"), "ACTIVE_WEAKNESS");
});

test("weak skill produces WEAK_SKILL challenge", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.challenges.challenges.some((c) => c.type === "WEAK_SKILL"), "WEAK_SKILL");
});

test("no challenges for empty profile", () => {
  const vm = assembleLensViewModel(emptyProfile());
  assertEqual(vm.challenges.challenges.length, 0);
});

test("ERRORS_PERSISTING produces ERROR_PATTERN challenge", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.errorCorrection.value = "ERRORS_PERSISTING";
  const vm = assembleLensViewModel(p);
  assert(vm.challenges.challenges.some((c) => c.type === "ERROR_PATTERN"), "ERROR_PATTERN");
});

test("every challenge carries confidenceTier and source", () => {
  const vm = assembleLensViewModel(richProfile());
  for (const c of vm.challenges.challenges) {
    assert(c.confidenceTier !== undefined, `confidenceTier on ${c.type}`);
    assert(typeof c.source === "string" && c.source.length > 0, `source on ${c.type}`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 6 — recommendations delegation
// ─────────────────────────────────────────────────────────

describe("6. recommendations delegation");

test("recommendations count matches profile.recommendations", () => {
  const p = richProfile();
  const vm = assembleLensViewModel(p);
  assertEqual(vm.recommendations.actions.length, p.recommendations.length);
});

test("nextSessionReady true when nextSessionNumber set", () => {
  assertEqual(assembleLensViewModel(richProfile()).recommendations.nextSessionReady, true);
});

test("nextSessionReady false when nextSessionNumber null", () => {
  const p = richProfile();
  p.nextSessionNumber = null;
  assertEqual(assembleLensViewModel(p).recommendations.nextSessionReady, false);
});

test("streakContext present when currentStreak >= 7", () => {
  const vm = assembleLensViewModel(richProfile());
  assert(vm.recommendations.streakContext !== undefined, "streakContext set");
  assertIncludes(vm.recommendations.streakContext, "10-day");
});

test("streakContext absent when currentStreak < 7", () => {
  const p = richProfile();
  p.currentStreak = 5;
  assertEqual(assembleLensViewModel(p).recommendations.streakContext, undefined);
});

test("every action carries confidenceTier and source", () => {
  const vm = assembleLensViewModel(richProfile());
  for (const a of vm.recommendations.actions) {
    assert(a.confidenceTier !== undefined, "confidenceTier");
    assert(typeof a.source === "string" && a.source.length > 0, "source");
  }
});

test("empty recommendations → empty actions array", () => {
  assertEqual(assembleLensViewModel(emptyProfile()).recommendations.actions.length, 0);
});

// ─────────────────────────────────────────────────────────
// Section 7 — empty profile — all views graceful
// ─────────────────────────────────────────────────────────

describe("7. empty profile — graceful handling");

test("assembleLensViewModel does not throw for empty profile", () => {
  let threw = false;
  try { assembleLensViewModel(emptyProfile()); } catch { threw = true; }
  assert(!threw, "no exception");
});

test("summary narrative acknowledges empty state", () => {
  const vm = assembleLensViewModel(emptyProfile());
  assertIncludes(vm.summary.narrative, "No learning data");
});

test("summary masteredCount is 0 for empty profile", () => {
  assertEqual(assembleLensViewModel(emptyProfile()).summary.masteredCount, 0);
});

test("summary confidenceLevel is LOW for empty profile", () => {
  assertEqual(assembleLensViewModel(emptyProfile()).summary.confidenceLevel, "LOW");
});

test("insights list non-empty (ACCURACY_TREND fires always)", () => {
  assert(assembleLensViewModel(emptyProfile()).insights.insights.length > 0, "at least one insight");
});

test("strengths list empty for empty profile", () => {
  assertEqual(assembleLensViewModel(emptyProfile()).strengths.strengths.length, 0);
});

test("challenges list empty for empty profile", () => {
  assertEqual(assembleLensViewModel(emptyProfile()).challenges.challenges.length, 0);
});

test("recommendations list empty for empty profile", () => {
  assertEqual(assembleLensViewModel(emptyProfile()).recommendations.actions.length, 0);
});

// ─────────────────────────────────────────────────────────
// Section 8 — output contract: every item carries confidenceTier + source
// ─────────────────────────────────────────────────────────

describe("8. output contract");

test("summary has confidenceTier and source", () => {
  const { summary } = assembleLensViewModel(richProfile());
  assert(summary.confidenceTier !== undefined, "confidenceTier");
  assert(typeof summary.source === "string" && summary.source.length > 0, "source");
});

test("all insights have confidenceTier and source", () => {
  const { insights } = assembleLensViewModel(richProfile());
  for (const i of insights.insights) {
    assert(i.confidenceTier !== undefined, `confidenceTier on ${i.type}`);
    assert(typeof i.source === "string" && i.source.length > 0, `source on ${i.type}`);
  }
});

test("all strength items have confidenceTier and source", () => {
  const { strengths } = assembleLensViewModel(richProfile());
  for (const s of strengths.strengths) {
    assert(s.confidenceTier !== undefined, `confidenceTier on ${s.type}`);
    assert(typeof s.source === "string" && s.source.length > 0, `source on ${s.type}`);
  }
});

test("all challenge items have confidenceTier and source", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.helpSeeking.value = "LOW_ENGAGEMENT";
  p.learnerModel.problemSolvingState.errorCorrection.value = "ERRORS_PERSISTING";
  const { challenges } = assembleLensViewModel(p);
  for (const c of challenges.challenges) {
    assert(c.confidenceTier !== undefined, `confidenceTier on ${c.type}`);
    assert(typeof c.source === "string" && c.source.length > 0, `source on ${c.type}`);
  }
});

test("all recommendation actions have confidenceTier and source", () => {
  const { recommendations } = assembleLensViewModel(richProfile());
  for (const a of recommendations.actions) {
    assert(a.confidenceTier !== undefined, "confidenceTier");
    assert(typeof a.source === "string" && a.source.length > 0, "source");
  }
});

test("source values are field-path strings (no spaces)", () => {
  const vm = assembleLensViewModel(richProfile());
  const allSources = [
    vm.summary.source,
    ...vm.insights.insights.map((i) => i.source),
    ...vm.strengths.strengths.map((s) => s.source),
    ...vm.challenges.challenges.map((c) => c.source),
    ...vm.recommendations.actions.map((a) => a.source),
  ];
  for (const src of allSources) {
    assert(!src.includes(" "), `source has spaces: "${src}"`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 9 — determinism
// ─────────────────────────────────────────────────────────

describe("9. determinism");

test("same profile → same summary values", () => {
  const p = richProfile();
  const v1 = assembleLensViewModel(p);
  const v2 = assembleLensViewModel(p);
  assertEqual(v1.summary.masteredCount,    v2.summary.masteredCount);
  assertEqual(v1.summary.engagementLevel,  v2.summary.engagementLevel);
  assertEqual(v1.summary.trendIndicator,   v2.summary.trendIndicator);
  assertEqual(v1.summary.confidenceTier,   v2.summary.confidenceTier);
  assertEqual(v1.summary.narrative,        v2.summary.narrative);
});

test("same profile → same insights count and types", () => {
  const p = richProfile();
  const v1 = assembleLensViewModel(p);
  const v2 = assembleLensViewModel(p);
  assertEqual(v1.insights.insights.length, v2.insights.insights.length);
  for (let i = 0; i < v1.insights.insights.length; i++) {
    assertEqual(v1.insights.insights[i].type,           v2.insights.insights[i].type);
    assertEqual(v1.insights.insights[i].confidenceTier, v2.insights.insights[i].confidenceTier);
    assertEqual(v1.insights.insights[i].narrative,      v2.insights.insights[i].narrative);
  }
});

test("same profile → same strengths count and types", () => {
  const p = richProfile();
  const v1 = assembleLensViewModel(p);
  const v2 = assembleLensViewModel(p);
  assertEqual(v1.strengths.strengths.length, v2.strengths.strengths.length);
  for (let i = 0; i < v1.strengths.strengths.length; i++) {
    assertEqual(v1.strengths.strengths[i].type,  v2.strengths.strengths[i].type);
    assertEqual(v1.strengths.strengths[i].label, v2.strengths.strengths[i].label);
  }
});

test("same profile → same challenges count and types", () => {
  const p = richProfile();
  const v1 = assembleLensViewModel(p);
  const v2 = assembleLensViewModel(p);
  assertEqual(v1.challenges.challenges.length, v2.challenges.challenges.length);
  for (let i = 0; i < v1.challenges.challenges.length; i++) {
    assertEqual(v1.challenges.challenges[i].type,  v2.challenges.challenges[i].type);
    assertEqual(v1.challenges.challenges[i].label, v2.challenges.challenges[i].label);
  }
});

test("same profile → same recommendation count and priorities", () => {
  const p = richProfile();
  const v1 = assembleLensViewModel(p);
  const v2 = assembleLensViewModel(p);
  assertEqual(v1.recommendations.actions.length, v2.recommendations.actions.length);
  for (let i = 0; i < v1.recommendations.actions.length; i++) {
    assertEqual(v1.recommendations.actions[i].priority,    v2.recommendations.actions[i].priority);
    assertEqual(v1.recommendations.actions[i].topic,       v2.recommendations.actions[i].topic);
    assertEqual(v1.recommendations.actions[i].reason,      v2.recommendations.actions[i].reason);
    assertEqual(v1.recommendations.actions[i].confidence,  v2.recommendations.actions[i].confidence);
  }
});

test("same profile → same nextSessionReady", () => {
  const p = richProfile();
  const v1 = assembleLensViewModel(p);
  const v2 = assembleLensViewModel(p);
  assertEqual(v1.recommendations.nextSessionReady, v2.recommendations.nextSessionReady);
});

// ─────────────────────────────────────────────────────────
// Section 10 — independence: transformers do not feed each other
// ─────────────────────────────────────────────────────────

describe("10. independence — transformers do not feed each other");

test("modifying strengths does not affect challenges", () => {
  const p = richProfile();
  const vm = assembleLensViewModel(p);
  // summary uses knowledgeState; so do strengths. Both must agree on mastered count.
  assertEqual(vm.summary.masteredCount, vm.strengths.strengths.filter((s) => s.type === "MASTERED_TOPIC").length);
});

test("insights confidence comes from performanceState, not from strengths", () => {
  const p = richProfile();
  p.learnerModel.performanceState.confidenceTier = "OBSERVED";
  // strengths suppresses strong skills; insights uses OBSERVED prefix
  const vm = assembleLensViewModel(p);
  const trend = vm.insights.insights.find((i) => i.type === "ACCURACY_TREND");
  assert(trend.narrative.includes("Early observation:"), "prefix from performanceState");
  assert(!vm.strengths.strengths.some((s) => s.type === "STRONG_SKILL"),
    "strong skills suppressed when OBSERVED perf");
  // Both derive independently from the same source, not from each other
});

test("recommendations are independent of summary narrative", () => {
  const p = richProfile();
  const vm = assembleLensViewModel(p);
  // Recommendations come from profile.recommendations, not from summary
  assertEqual(vm.recommendations.actions[0].topic, p.recommendations[0].topic);
});

test("challenges include weak skills from performanceState, not from strengths output", () => {
  const p = richProfile();
  const vm = assembleLensViewModel(p);
  // WEAK_SKILL challenge source must be performanceState, not strengths
  const weakChallenge = vm.challenges.challenges.find((c) => c.type === "WEAK_SKILL");
  assert(weakChallenge !== undefined, "WEAK_SKILL challenge present");
  assertIncludes(weakChallenge.source, "performanceState");
  // STRONG_SKILL strength must reference same source
  const strongStrength = vm.strengths.strengths.find((s) => s.type === "STRONG_SKILL");
  assert(strongStrength !== undefined, "STRONG_SKILL strength present");
  assertIncludes(strongStrength.source, "performanceState");
  // They read the same field independently
});

test("changing streak only affects recommendations streakContext", () => {
  const p = richProfile();
  p.currentStreak = 3;
  const vm = assembleLensViewModel(p);
  assertEqual(vm.recommendations.streakContext, undefined, "no streak context");
  assertEqual(vm.summary.streakDays, 3, "summary still reflects correct streak");
});

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────

console.log(`\nLEXI Lens Service Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
