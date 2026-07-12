/**
 * Phase 5.5 — StudentLearningProfile v3 / LearnerModel Assembly Tests
 *
 * Tests the assembleLearnerModel() function which composes all five
 * Phase 5 intelligence engines into a single LearnerModel snapshot.
 *
 * Strategy: inline full engine implementations (same logic as .ts files,
 * translated to pure JS) then test the assembly layer end-to-end.
 * Individual engine tests live in their own test scripts (P5.1–P5.4).
 *
 * Run: node scripts/test-learner-profile-v3.mjs
 */

// ─────────────────────────────────────────────────────────
// Constants (from types and engines)
// ─────────────────────────────────────────────────────────

const ConfidenceTier = { OBSERVED: "OBSERVED", EMERGING: "EMERGING", CONFIRMED: "CONFIRMED" };

// KnowledgeState constants
const CONFIRMED_TOPIC_THRESHOLD = 10;
const EMERGING_TOPIC_THRESHOLD = 3;
const SIGNAL_BOOST_THRESHOLD = 2;
const BEHAVIORAL_SIGNAL_TYPES = new Set([
  "RECURRING_WEAKNESS", "RETENTION_RISK", "TOPIC_IMPROVING", "TOPIC_MASTERED",
]);

// PerformanceState constants
const CONFIRMED_ATTEMPT_THRESHOLD_PERF = 50;
const EMERGING_ATTEMPT_THRESHOLD_PERF = 10;
const TREND_DELTA = 0.05;
const STRONG_SKILL_THRESHOLD = 75;
const DEVELOPING_SKILL_THRESHOLD = 50;
const CONSISTENCY_HIGH_VARIANCE = 0.15;
const CONSISTENCY_MED_VARIANCE = 0.08;

// ProblemSolvingState constants
const RETRY_WINDOW_MS = 10 * 60 * 1000;
const FREQUENT_RETRY_THRESHOLD = 0.6;
const OCCASIONAL_RETRY_THRESHOLD = 0.25;
const QUICK_RECOVERY_THRESHOLD = 0.65;
const GRADUAL_RECOVERY_THRESHOLD = 0.35;
const ACTIVE_ENGAGEMENT_THRESHOLD = 0.5;
const SOME_ENGAGEMENT_THRESHOLD = 0.2;
const IMPROVING_DOMINANT_THRESHOLD = 0.6;
const RECURRING_DOMINANT_THRESHOLD = 0.5;
const MIN_WRONG_FOR_RETRY_EMERGING = 5;
const MIN_WRONG_FOR_RETRY_CONFIRMED = 20;
const MIN_WEAKNESSES_FOR_EMERGING = 3;
const MIN_WEAKNESSES_FOR_CONFIRMED = 8;
const CONFIRMED_ATTEMPT_THRESHOLD_PS = 50;
const EMERGING_ATTEMPT_THRESHOLD_PS = 10;

// LearningBehaviorState constants
const HIGHLY_ACTIVE_THRESHOLD = 20;
const ACTIVE_THRESHOLD = 10;
const OCCASIONAL_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────
// Inlined engine implementations (pure JS)
// ─────────────────────────────────────────────────────────

// ── KnowledgeState engine ──────────────────────────────

function deriveKnowledgeConfidenceTier(topicCount, behavioralSignalCount) {
  if (topicCount >= CONFIRMED_TOPIC_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (topicCount >= EMERGING_TOPIC_THRESHOLD || behavioralSignalCount >= SIGNAL_BOOST_THRESHOLD)
    return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function computeKnowledgeState(masteryProfiles, activeWeaknesses, signals) {
  const behavioralSignalCount = signals.filter(s => BEHAVIORAL_SIGNAL_TYPES.has(s.type)).length;
  // remedialTopics used only for sort ordering of weakConcepts
  const remedialTopics = new Set(
    activeWeaknesses.filter(w => w.isRemedialFlagged).map(w => w.topic)
  );

  const masteredConcepts = masteryProfiles
    .filter(p => p.masteryState === "MASTERED")
    .map(p => ({ topic: p.topic, label: p.label, masteryState: p.masteryState }));

  const developingConcepts = masteryProfiles
    .filter(p => p.masteryState === "IMPROVING" || p.masteryState === "STABLE")
    .map(p => ({ topic: p.topic, label: p.label, masteryState: p.masteryState }));

  // weakConcepts derived from masteryProfiles NEEDS_REVIEW (not from activeWeaknesses directly)
  // sorted: remedial-flagged first, then by totalOccurrences from summary
  const weakRaw = masteryProfiles.filter(p => p.masteryState === "NEEDS_REVIEW");
  weakRaw.sort((a, b) => {
    const aRem = remedialTopics.has(a.topic) ? 1 : 0;
    const bRem = remedialTopics.has(b.topic) ? 1 : 0;
    if (aRem !== bRem) return bRem - aRem;
    return (b.summary?.totalOccurrences ?? 0) - (a.summary?.totalOccurrences ?? 0);
  });
  const weakConcepts = weakRaw.map(p => ({
    topic: p.topic,
    label: p.label,
    masteryState: p.masteryState,
  }));

  return {
    masteredConcepts,
    developingConcepts,
    weakConcepts,
    confidenceTier: deriveKnowledgeConfidenceTier(masteryProfiles.length, behavioralSignalCount),
    topicCount: masteryProfiles.length,
    computedAt: new Date().toISOString(),
  };
}

// ── PerformanceState engine ────────────────────────────

function computeAccuracy(attempts) {
  if (attempts.length === 0) return 0;
  return (attempts.filter(a => a.isCorrect).length / attempts.length) * 100;
}

function computeAccuracyTrend(attempts) {
  if (attempts.length < 10) return "INSUFFICIENT_DATA";
  const mid = Math.floor(attempts.length / 2);
  const firstHalf = attempts.slice(0, mid);
  const secondHalf = attempts.slice(mid);
  const firstAcc = computeAccuracy(firstHalf) / 100;
  const secondAcc = computeAccuracy(secondHalf) / 100;
  const delta = secondAcc - firstAcc;
  if (delta > TREND_DELTA) return "IMPROVING";
  if (delta < -TREND_DELTA) return "DECLINING";
  return "STABLE";
}

function computeConsistencyProfile(attempts) {
  if (attempts.length < 9) return "CONSISTENT";
  const windowSize = Math.floor(attempts.length / 3);
  const w1 = computeAccuracy(attempts.slice(0, windowSize)) / 100;
  const w2 = computeAccuracy(attempts.slice(windowSize, windowSize * 2)) / 100;
  const w3 = computeAccuracy(attempts.slice(windowSize * 2)) / 100;
  const mean = (w1 + w2 + w3) / 3;
  const variance = ((w1 - mean) ** 2 + (w2 - mean) ** 2 + (w3 - mean) ** 2) / 3;
  if (variance > CONSISTENCY_HIGH_VARIANCE) return "ERRATIC";
  if (variance > CONSISTENCY_MED_VARIANCE) return "VARIABLE";
  return "CONSISTENT";
}

function deriveSkillTier(percentage) {
  if (percentage >= STRONG_SKILL_THRESHOLD) return "STRONG";
  if (percentage >= DEVELOPING_SKILL_THRESHOLD) return "DEVELOPING";
  return "WEAK";
}

function derivePerfConfidenceTier(attemptCount) {
  if (attemptCount >= CONFIRMED_ATTEMPT_THRESHOLD_PERF) return ConfidenceTier.CONFIRMED;
  if (attemptCount >= EMERGING_ATTEMPT_THRESHOLD_PERF) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function computePerformanceState(attempts, skillAccuracies) {
  const sorted = [...attempts].sort((a, b) =>
    new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime()
  );
  return {
    accuracyTrend: computeAccuracyTrend(sorted),
    overallAccuracy: computeAccuracy(sorted),
    consistencyProfile: computeConsistencyProfile(sorted),
    skillPerformance: skillAccuracies.map(s => ({
      skill: s.skill,
      label: s.label,
      percentage: s.percentage,
      tier: deriveSkillTier(s.percentage),
    })),
    confidenceTier: derivePerfConfidenceTier(attempts.length),
    computedAt: new Date().toISOString(),
  };
}

// ── LearningBehaviorState engine ───────────────────────

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

// ── LearningPreferenceState engine ─────────────────────

function unknownEntry() {
  return { value: "UNKNOWN", source: "NONE", confidenceTier: ConfidenceTier.OBSERVED };
}

function mapPracticeTime(tod) {
  if (tod === "MORNING") return "MORNING";
  if (tod === "AFTERNOON") return "AFTERNOON";
  if (tod === "EVENING") return "EVENING";
  return null;
}

function mapSessionDuration(minutes) {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 15) return "SHORT";
  if (minutes <= 45) return "MEDIUM";
  return "LONG";
}

function computeLearningPreferenceState(behaviorProfile, explicitPreferences) {
  const ep = explicitPreferences ?? {};

  function resolvePreference(explicit, observed, tier) {
    if (explicit !== null && explicit !== undefined) {
      return { value: explicit, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED };
    }
    if (observed !== null && observed !== undefined) {
      return { value: observed, source: "OBSERVED", confidenceTier: tier };
    }
    return unknownEntry();
  }

  const observedPracticeTime = mapPracticeTime(behaviorProfile.preferredTimeOfDay);
  const observedDuration = mapSessionDuration(behaviorProfile.avgSessionDurationMin);
  const tier = behaviorProfile.confidenceTier;

  return {
    practiceTime: resolvePreference(ep.practiceTime, observedPracticeTime, tier),
    sessionDuration: resolvePreference(ep.sessionDuration, observedDuration, tier),
    explanationDepth: ep.explanationDepth != null
      ? { value: ep.explanationDepth, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED }
      : unknownEntry(),
    hintFrequency: ep.hintFrequency != null
      ? { value: ep.hintFrequency, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED }
      : unknownEntry(),
    feedbackTiming: ep.feedbackTiming != null
      ? { value: ep.feedbackTiming, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED }
      : unknownEntry(),
    practiceMode: ep.practiceMode != null
      ? { value: ep.practiceMode, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED }
      : unknownEntry(),
    languagePreference: ep.languagePreference != null
      ? { value: ep.languagePreference, source: "EXPLICIT", confidenceTier: ConfidenceTier.OBSERVED }
      : unknownEntry(),
    computedAt: new Date().toISOString(),
  };
}

// ── ProblemSolvingState engine ─────────────────────────

function scanRetryBehavior(attempts) {
  const sorted = [...attempts].sort((a, b) =>
    new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime()
  );
  let wrongCount = 0;
  let retryCount = 0;
  let retrySuccessCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].isCorrect) {
      wrongCount++;
      if (i + 1 < sorted.length) {
        const delta = new Date(sorted[i + 1].attemptedAt).getTime()
                    - new Date(sorted[i].attemptedAt).getTime();
        if (delta <= RETRY_WINDOW_MS) {
          retryCount++;
          if (sorted[i + 1].isCorrect) retrySuccessCount++;
        }
      }
    }
  }
  return { wrongCount, retryCount, retrySuccessCount };
}

function deriveRetryPatternConfidence(wrongCount) {
  if (wrongCount >= MIN_WRONG_FOR_RETRY_CONFIRMED) return ConfidenceTier.CONFIRMED;
  if (wrongCount >= MIN_WRONG_FOR_RETRY_EMERGING) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function deriveWeaknessConfidence(weaknessCount) {
  if (weaknessCount >= MIN_WEAKNESSES_FOR_CONFIRMED) return ConfidenceTier.CONFIRMED;
  if (weaknessCount >= MIN_WEAKNESSES_FOR_EMERGING) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function derivePSConfidenceTier(attemptCount) {
  if (attemptCount >= CONFIRMED_ATTEMPT_THRESHOLD_PS) return ConfidenceTier.CONFIRMED;
  if (attemptCount >= EMERGING_ATTEMPT_THRESHOLD_PS) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function unknownPattern(reason) {
  return { value: "UNKNOWN", evidence: reason, confidenceTier: ConfidenceTier.OBSERVED };
}

function computeProblemSolvingState(attempts, activeWeaknesses) {
  const scan = scanRetryBehavior(attempts);
  const { wrongCount, retryCount, retrySuccessCount } = scan;
  const totalAttempts = attempts.length;
  const n = activeWeaknesses.length;

  // Retry pattern
  let retryPattern;
  if (wrongCount === 0) {
    retryPattern = { value: "UNKNOWN", evidence: "No wrong answers recorded", confidenceTier: ConfidenceTier.OBSERVED };
  } else {
    const retryRate = retryCount / wrongCount;
    const tier = deriveRetryPatternConfidence(wrongCount);
    if (retryRate >= FREQUENT_RETRY_THRESHOLD) {
      retryPattern = { value: "FREQUENT_RETRIER", evidence: `Retried after ${Math.round(retryRate * 100)}% of wrong answers`, confidenceTier: tier };
    } else if (retryRate >= OCCASIONAL_RETRY_THRESHOLD) {
      retryPattern = { value: "OCCASIONAL_RETRIER", evidence: `Retried after ${Math.round(retryRate * 100)}% of wrong answers`, confidenceTier: tier };
    } else {
      retryPattern = { value: "RARELY_RETRIES", evidence: `Retried after ${Math.round(retryRate * 100)}% of wrong answers`, confidenceTier: tier };
    }
  }

  // Feedback recovery
  let feedbackRecovery;
  if (retryCount === 0) {
    feedbackRecovery = unknownPattern("No retry attempts recorded");
  } else {
    const successRate = retrySuccessCount / retryCount;
    const tier = deriveRetryPatternConfidence(wrongCount);
    if (successRate >= QUICK_RECOVERY_THRESHOLD) {
      feedbackRecovery = { value: "RECOVERS_QUICKLY", evidence: `Correct on ${Math.round(successRate * 100)}% of retry attempts`, confidenceTier: tier };
    } else if (successRate >= GRADUAL_RECOVERY_THRESHOLD) {
      feedbackRecovery = { value: "GRADUAL_RECOVERY", evidence: `Correct on ${Math.round(successRate * 100)}% of retry attempts`, confidenceTier: tier };
    } else {
      feedbackRecovery = { value: "SLOW_RECOVERY", evidence: `Correct on ${Math.round(successRate * 100)}% of retry attempts`, confidenceTier: tier };
    }
  }

  // Help seeking
  let helpSeeking;
  if (n === 0) {
    helpSeeking = unknownPattern("No error notebook entries");
  } else {
    const remedialCount = activeWeaknesses.filter(w => w.isRemedialFlagged).length;
    const rate = remedialCount / n;
    const tier = deriveWeaknessConfidence(n);
    if (rate >= ACTIVE_ENGAGEMENT_THRESHOLD) {
      helpSeeking = { value: "ACTIVE_ENGAGEMENT", evidence: `${remedialCount} of ${n} error topics flagged for remediation`, confidenceTier: tier };
    } else if (rate >= SOME_ENGAGEMENT_THRESHOLD) {
      helpSeeking = { value: "SOME_ENGAGEMENT", evidence: `${remedialCount} of ${n} error topics flagged for remediation`, confidenceTier: tier };
    } else {
      helpSeeking = { value: "LOW_ENGAGEMENT", evidence: `${remedialCount} of ${n} error topics flagged for remediation`, confidenceTier: tier };
    }
  }

  // Error correction
  let errorCorrection;
  if (n === 0) {
    errorCorrection = unknownPattern("No error notebook entries");
  } else {
    const improvingCount = activeWeaknesses.filter(w => w.signal === "IMPROVED" || w.signal === "IMPROVING").length;
    const recurringCount = activeWeaknesses.filter(w => w.signal === "RECURRING").length;
    const improvingRate = improvingCount / n;
    const recurringRate = recurringCount / n;
    const tier = deriveWeaknessConfidence(n);
    if (improvingRate >= IMPROVING_DOMINANT_THRESHOLD) {
      errorCorrection = { value: "ERRORS_REDUCING", evidence: `${improvingCount} of ${n} topics showing IMPROVED or IMPROVING signal`, confidenceTier: tier };
    } else if (recurringRate >= RECURRING_DOMINANT_THRESHOLD) {
      errorCorrection = { value: "ERRORS_PERSISTING", evidence: `${recurringCount} of ${n} topics showing RECURRING signal`, confidenceTier: tier };
    } else {
      errorCorrection = { value: "ERRORS_STABLE", evidence: `Mixed signals: ${improvingCount} improving, ${recurringCount} recurring of ${n} topics`, confidenceTier: tier };
    }
  }

  return {
    retryPattern,
    feedbackRecovery,
    helpSeeking,
    errorCorrection,
    confidenceTier: derivePSConfidenceTier(totalAttempts),
    computedAt: new Date().toISOString(),
  };
}

// ── assembleLearnerModel ───────────────────────────────

function assembleLearnerModel(input) {
  return {
    knowledgeState: computeKnowledgeState(
      input.masteryProfiles,
      input.activeWeaknesses,
      input.learningSignals,
    ),
    performanceState: computePerformanceState(
      input.attempts,
      input.skillAccuracies,
    ),
    learningBehaviorState: computeLearningBehaviorState(
      input.behaviorProfile,
    ),
    learningPreferenceState: computeLearningPreferenceState(
      input.behaviorProfile,
      input.explicitPreferences,
    ),
    problemSolvingState: computeProblemSolvingState(
      input.attempts,
      input.activeWeaknesses,
    ),
    assembledAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Test helpers / fixtures
// ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error(`  FAIL: ${label}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

function makeAttempt(isCorrect, minutesAgo) {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  return { isCorrect, attemptedAt: d.toISOString() };
}

function makeMasteryProfile(topic, masteryState) {
  return { topic, label: topic.replace(/_/g, " "), masteryState, summary: {} };
}

function makeWeakness(topic, signal = "RECURRING", isRemedialFlagged = false, totalOccurrences = 3, dueCount = 1) {
  return {
    topic,
    label: topic.replace(/_/g, " "),
    signal,
    isRemedialFlagged,
    dueCount,
    masteryState: "NEEDS_REVIEW",
    totalOccurrences,
  };
}

function makeSignal(type) {
  return { type, severity: "MEDIUM", topic: null, topicLabel: null, evidence: {}, confidence: "MEDIUM", generatedAt: new Date().toISOString(), suppressionKey: type };
}

function makeBehaviorProfile({
  sessionCount = 0,
  preferredTimeOfDay = null,
  avgSessionDurationMin = null,
  paceProfile = null,
  responseTimeSignal = null,
  recentMoodContext = null,
  confidenceTier = ConfidenceTier.OBSERVED,
} = {}) {
  return { sessionCount, preferredTimeOfDay, avgSessionDurationMin, paceProfile, responseTimeSignal, recentMoodContext, confidenceTier };
}

function makeSkillAccuracy(skill, percentage) {
  return { skill, label: skill, percentage };
}

function emptyInput() {
  return {
    masteryProfiles: [],
    activeWeaknesses: [],
    learningSignals: [],
    attempts: [],
    skillAccuracies: [],
    behaviorProfile: makeBehaviorProfile(),
    explicitPreferences: undefined,
  };
}

function isValidISO(str) {
  if (typeof str !== "string") return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.includes("T");
}

// ─────────────────────────────────────────────────────────
// Section 1 — Output shape invariants
// ─────────────────────────────────────────────────────────

section("Section 1 — Output shape invariants");

{
  const model = assembleLearnerModel(emptyInput());

  assert(typeof model === "object" && model !== null, "assembleLearnerModel returns object");
  assert("knowledgeState" in model, "output has knowledgeState");
  assert("performanceState" in model, "output has performanceState");
  assert("learningBehaviorState" in model, "output has learningBehaviorState");
  assert("learningPreferenceState" in model, "output has learningPreferenceState");
  assert("problemSolvingState" in model, "output has problemSolvingState");
  assert("assembledAt" in model, "output has assembledAt");
  assert(Object.keys(model).length === 6, "output has exactly 6 keys");
}

// ─────────────────────────────────────────────────────────
// Section 2 — assembledAt timestamp
// ─────────────────────────────────────────────────────────

section("Section 2 — assembledAt timestamp");

{
  const model = assembleLearnerModel(emptyInput());

  assert(isValidISO(model.assembledAt), "assembledAt is valid ISO string");
  assert(model.assembledAt.endsWith("Z"), "assembledAt is UTC (ends with Z)");

  const before = Date.now();
  const m2 = assembleLearnerModel(emptyInput());
  const after = Date.now();
  const ts = new Date(m2.assembledAt).getTime();
  assert(ts >= before && ts <= after + 1000, "assembledAt is close to current time");

  // Each engine also records computedAt
  assert(isValidISO(model.knowledgeState.computedAt), "knowledgeState.computedAt is valid ISO");
  assert(isValidISO(model.performanceState.computedAt), "performanceState.computedAt is valid ISO");
  assert(isValidISO(model.learningBehaviorState.computedAt), "learningBehaviorState.computedAt is valid ISO");
  assert(isValidISO(model.learningPreferenceState.computedAt), "learningPreferenceState.computedAt is valid ISO");
  assert(isValidISO(model.problemSolvingState.computedAt), "problemSolvingState.computedAt is valid ISO");
}

// ─────────────────────────────────────────────────────────
// Section 3 — Empty data — no throws
// ─────────────────────────────────────────────────────────

section("Section 3 — Empty data — no throws");

{
  let threw = false;
  try { assembleLearnerModel(emptyInput()); } catch { threw = true; }
  assert(!threw, "empty input does not throw");

  const model = assembleLearnerModel(emptyInput());

  // Knowledge state
  assert(model.knowledgeState.topicCount === 0, "empty: knowledgeState.topicCount = 0");
  assert(model.knowledgeState.masteredConcepts.length === 0, "empty: no masteredConcepts");
  assert(model.knowledgeState.developingConcepts.length === 0, "empty: no developingConcepts");
  assert(model.knowledgeState.weakConcepts.length === 0, "empty: no weakConcepts");
  assert(model.knowledgeState.confidenceTier === ConfidenceTier.OBSERVED, "empty: knowledgeState OBSERVED");

  // Performance state
  assert(model.performanceState.overallAccuracy === 0, "empty: overallAccuracy = 0");
  assert(model.performanceState.accuracyTrend === "INSUFFICIENT_DATA", "empty: INSUFFICIENT_DATA trend");
  assert(model.performanceState.skillPerformance.length === 0, "empty: no skill performance");
  assert(model.performanceState.confidenceTier === ConfidenceTier.OBSERVED, "empty: performanceState OBSERVED");

  // Behavior state
  assert(model.learningBehaviorState.sessionPattern.sessionCount === 0, "empty: sessionCount = 0");
  assert(model.learningBehaviorState.engagementObservation.engagementLevel === "INACTIVE", "empty: INACTIVE engagement");
  assert(model.learningBehaviorState.confidenceTier === ConfidenceTier.OBSERVED, "empty: behaviorState OBSERVED");

  // Preference state
  assert(model.learningPreferenceState.practiceTime.value === "UNKNOWN", "empty: practiceTime UNKNOWN");
  assert(model.learningPreferenceState.sessionDuration.value === "UNKNOWN", "empty: sessionDuration UNKNOWN");
  assert(model.learningPreferenceState.explanationDepth.value === "UNKNOWN", "empty: explanationDepth UNKNOWN");

  // Problem solving state
  assert(model.problemSolvingState.retryPattern.value === "UNKNOWN", "empty: retryPattern UNKNOWN");
  assert(model.problemSolvingState.helpSeeking.value === "UNKNOWN", "empty: helpSeeking UNKNOWN");
  assert(model.problemSolvingState.confidenceTier === ConfidenceTier.OBSERVED, "empty: problemSolvingState OBSERVED");
}

// ─────────────────────────────────────────────────────────
// Section 4 — KnowledgeState routing
// ─────────────────────────────────────────────────────────

section("Section 4 — KnowledgeState routing");

{
  // masteryProfiles → knowledgeState only
  const input = {
    ...emptyInput(),
    masteryProfiles: [
      makeMasteryProfile("present_simple", "MASTERED"),
      makeMasteryProfile("past_simple", "IMPROVING"),
      makeMasteryProfile("future_tense", "NEEDS_REVIEW"),
    ],
  };
  const model = assembleLearnerModel(input);

  assert(model.knowledgeState.topicCount === 3, "KS routing: topicCount = 3");
  assert(model.knowledgeState.masteredConcepts.length === 1, "KS routing: 1 mastered concept");
  assert(model.knowledgeState.masteredConcepts[0].topic === "present_simple", "KS routing: correct topic");
  assert(model.knowledgeState.developingConcepts.length === 1, "KS routing: 1 developing concept");
  // Performance state not affected by masteryProfiles
  assert(model.performanceState.overallAccuracy === 0, "KS isolation: performance unchanged by masteryProfiles");
  assert(model.problemSolvingState.errorCorrection.value === "UNKNOWN", "KS isolation: problem solving unchanged by masteryProfiles alone");
}

{
  // signals → knowledgeState confidence boost
  const input = {
    ...emptyInput(),
    masteryProfiles: [makeMasteryProfile("t1", "IMPROVING"), makeMasteryProfile("t2", "NEEDS_REVIEW")], // 2 topics → OBSERVED without signals
    learningSignals: [makeSignal("RECURRING_WEAKNESS"), makeSignal("RETENTION_RISK")],
  };
  const model = assembleLearnerModel(input);
  assert(model.knowledgeState.confidenceTier === ConfidenceTier.EMERGING,
    "KS routing: 2 behavioral signals boost confidence to EMERGING with 2 topics");
  // Signals must NOT affect performance or problem solving
  assert(model.performanceState.confidenceTier === ConfidenceTier.OBSERVED, "signals isolated to KS only");
}

// ─────────────────────────────────────────────────────────
// Section 5 — PerformanceState routing
// ─────────────────────────────────────────────────────────

section("Section 5 — PerformanceState routing");

{
  // 50 correct attempts → CONFIRMED confidence, high accuracy
  const attempts = Array.from({ length: 50 }, (_, i) => makeAttempt(true, 200 - i * 3));
  const input = {
    ...emptyInput(),
    attempts,
    skillAccuracies: [makeSkillAccuracy("grammar", 80), makeSkillAccuracy("vocabulary", 45)],
  };
  const model = assembleLearnerModel(input);

  assert(model.performanceState.overallAccuracy === 100, "PS routing: 100% accuracy on all correct");
  assert(model.performanceState.confidenceTier === ConfidenceTier.CONFIRMED, "PS routing: CONFIRMED at 50 attempts");
  assert(model.performanceState.skillPerformance.length === 2, "PS routing: 2 skill entries");
  assert(model.performanceState.skillPerformance[0].tier === "STRONG", "PS routing: 80% is STRONG");
  assert(model.performanceState.skillPerformance[1].tier === "WEAK", "PS routing: 45% is WEAK");

  // attempts feed problemSolving too — same array reused
  assert(model.problemSolvingState.retryPattern.value === "UNKNOWN", "PS reuse: all correct = no retry pattern");
}

{
  // attempts influence both performance and problem solving
  const wrongThenRetry = [
    makeAttempt(false, 120), // wrong
    makeAttempt(true, 119),  // retry within 1 min → success
    makeAttempt(false, 100), // wrong
    makeAttempt(true, 99),   // retry within 1 min → success
    makeAttempt(false, 80),  // wrong
    makeAttempt(true, 79),   // retry within 1 min → success
    makeAttempt(false, 60),  // wrong
    makeAttempt(true, 59),   // retry within 1 min → success
    makeAttempt(false, 40),  // wrong
    makeAttempt(true, 39),   // retry within 1 min → success
  ];
  const model = assembleLearnerModel({ ...emptyInput(), attempts: wrongThenRetry });

  // 5 wrong, 5 retries (all correct) → 100% retry rate → FREQUENT_RETRIER
  assert(model.problemSolvingState.retryPattern.value === "FREQUENT_RETRIER",
    "PS shared: wrong+retry pattern detected in problem solving");
  // 5 correct / 10 total = 50% accuracy
  assert(model.performanceState.overallAccuracy === 50,
    "PS shared: accuracy reflects same attempt array");
}

// ─────────────────────────────────────────────────────────
// Section 6 — BehaviorState routing
// ─────────────────────────────────────────────────────────

section("Section 6 — BehaviorState routing");

{
  // behaviorProfile → both behavior and preference engines
  const bp = makeBehaviorProfile({
    sessionCount: 25,
    preferredTimeOfDay: "MORNING",
    avgSessionDurationMin: 30,
    paceProfile: "STEADY",
    responseTimeSignal: "MODERATE",
    confidenceTier: ConfidenceTier.CONFIRMED,
  });
  const model = assembleLearnerModel({ ...emptyInput(), behaviorProfile: bp });

  // BehaviorState
  assert(model.learningBehaviorState.sessionPattern.sessionCount === 25,
    "BS routing: sessionCount passed through");
  assert(model.learningBehaviorState.engagementObservation.engagementLevel === "HIGHLY_ACTIVE",
    "BS routing: 25 sessions = HIGHLY_ACTIVE");
  assert(model.learningBehaviorState.paceObservation.paceProfile === "STEADY",
    "BS routing: paceProfile passed through");
  assert(model.learningBehaviorState.confidenceTier === ConfidenceTier.CONFIRMED,
    "BS routing: confidenceTier inherited from behaviorProfile");

  // PreferenceState also uses same behaviorProfile
  assert(model.learningPreferenceState.practiceTime.value === "MORNING",
    "Pref routing: preferredTimeOfDay → practiceTime MORNING");
  assert(model.learningPreferenceState.sessionDuration.value === "MEDIUM",
    "Pref routing: 30 min → MEDIUM session duration");
  assert(model.learningPreferenceState.practiceTime.source === "OBSERVED",
    "Pref routing: observed source for behavioral proxy");
}

{
  // EVENING preference + SHORT session
  const bp = makeBehaviorProfile({
    sessionCount: 3,
    preferredTimeOfDay: "EVENING",
    avgSessionDurationMin: 10,
    confidenceTier: ConfidenceTier.EMERGING,
  });
  const model = assembleLearnerModel({ ...emptyInput(), behaviorProfile: bp });

  assert(model.learningPreferenceState.practiceTime.value === "EVENING", "Pref routing: EVENING");
  assert(model.learningPreferenceState.sessionDuration.value === "SHORT", "Pref routing: 10 min = SHORT");
  assert(model.learningBehaviorState.engagementObservation.engagementLevel === "OCCASIONAL",
    "BS routing: 3 sessions = OCCASIONAL");
}

// ─────────────────────────────────────────────────────────
// Section 7 — ActiveWeaknesses routing
// ─────────────────────────────────────────────────────────

section("Section 7 — ActiveWeaknesses routing");

{
  const weaknesses = [
    makeWeakness("t1", "RECURRING", true, 5),   // remedial
    makeWeakness("t2", "IMPROVING", false, 3),  // not remedial
    makeWeakness("t3", "RECURRING", false, 2),  // not remedial
  ];
  const masteryProfiles = [
    makeMasteryProfile("t1", "NEEDS_REVIEW"),
    makeMasteryProfile("t2", "IMPROVING"),
    makeMasteryProfile("t3", "NEEDS_REVIEW"),
  ];
  const model = assembleLearnerModel({ ...emptyInput(), masteryProfiles, activeWeaknesses: weaknesses });

  // KnowledgeState uses activeWeaknesses for weakConcepts ordering
  assert(model.knowledgeState.weakConcepts.length === 2, "AW routing: 2 weak concepts (NEEDS_REVIEW)");
  assert(model.knowledgeState.weakConcepts[0].topic === "t1", "AW routing: remedial topic first");

  // ProblemSolving uses activeWeaknesses for helpSeeking
  // 1/3 remedial = 33% → SOME_ENGAGEMENT
  assert(model.problemSolvingState.helpSeeking.value === "SOME_ENGAGEMENT",
    "AW routing: 1 of 3 remedial = SOME_ENGAGEMENT");

  // ErrorCorrection: 1 IMPROVING, 2 RECURRING → recurringRate=2/3=67% → ERRORS_PERSISTING
  assert(model.problemSolvingState.errorCorrection.value === "ERRORS_PERSISTING",
    "AW routing: 2/3 RECURRING = ERRORS_PERSISTING");
}

{
  // 5 remedial out of 8 weaknesses → ACTIVE_ENGAGEMENT + CONFIRMED weakness confidence
  const weaknesses = Array.from({ length: 8 }, (_, i) =>
    makeWeakness(`t${i}`, "RECURRING", i < 5, i + 1)
  );
  const model = assembleLearnerModel({ ...emptyInput(), activeWeaknesses: weaknesses });

  assert(model.problemSolvingState.helpSeeking.value === "ACTIVE_ENGAGEMENT",
    "AW routing: 5/8 remedial = ACTIVE_ENGAGEMENT");
  assert(model.problemSolvingState.helpSeeking.confidenceTier === ConfidenceTier.CONFIRMED,
    "AW routing: 8 weaknesses = CONFIRMED confidence");
}

// ─────────────────────────────────────────────────────────
// Section 8 — Explicit preferences routing
// ─────────────────────────────────────────────────────────

section("Section 8 — Explicit preferences routing");

{
  const ep = {
    practiceTime: "AFTERNOON",
    explanationDepth: "DETAILED",
    languagePreference: "BILINGUAL",
  };
  const bp = makeBehaviorProfile({ preferredTimeOfDay: "MORNING" }); // observed says MORNING, explicit says AFTERNOON
  const model = assembleLearnerModel({ ...emptyInput(), behaviorProfile: bp, explicitPreferences: ep });

  // Explicit overrides observed
  assert(model.learningPreferenceState.practiceTime.value === "AFTERNOON",
    "EP routing: explicit overrides observed practiceTime");
  assert(model.learningPreferenceState.practiceTime.source === "EXPLICIT",
    "EP routing: source = EXPLICIT for override");
  assert(model.learningPreferenceState.explanationDepth.value === "DETAILED",
    "EP routing: explicit explanationDepth");
  assert(model.learningPreferenceState.languagePreference.value === "BILINGUAL",
    "EP routing: explicit languagePreference");
  // Unset explicit dimensions stay UNKNOWN
  assert(model.learningPreferenceState.hintFrequency.value === "UNKNOWN",
    "EP routing: unset explicit = UNKNOWN");

  // explicitPreferences must NOT affect any other engine
  assert(model.problemSolvingState.retryPattern.value === "UNKNOWN",
    "EP isolation: explicitPreferences don't affect problemSolving");
  assert(model.knowledgeState.topicCount === 0,
    "EP isolation: explicitPreferences don't affect knowledgeState");
}

// ─────────────────────────────────────────────────────────
// Section 9 — Confidence tier wiring
// ─────────────────────────────────────────────────────────

section("Section 9 — Confidence tier wiring");

{
  // Performance: exactly 10 attempts → EMERGING
  const attempts10 = Array.from({ length: 10 }, (_, i) => makeAttempt(i % 2 === 0, 100 - i * 5));
  const m10 = assembleLearnerModel({ ...emptyInput(), attempts: attempts10 });
  assert(m10.performanceState.confidenceTier === ConfidenceTier.EMERGING, "CT wiring: 10 attempts = EMERGING");

  // Performance: 50 attempts → CONFIRMED
  const attempts50 = Array.from({ length: 50 }, (_, i) => makeAttempt(true, 300 - i * 5));
  const m50 = assembleLearnerModel({ ...emptyInput(), attempts: attempts50 });
  assert(m50.performanceState.confidenceTier === ConfidenceTier.CONFIRMED, "CT wiring: 50 attempts = CONFIRMED");

  // Knowledge: 10 topics → CONFIRMED
  const profiles10 = Array.from({ length: 10 }, (_, i) => makeMasteryProfile(`t${i}`, "NEEDS_REVIEW"));
  const mk10 = assembleLearnerModel({ ...emptyInput(), masteryProfiles: profiles10 });
  assert(mk10.knowledgeState.confidenceTier === ConfidenceTier.CONFIRMED, "CT wiring: 10 topics = CONFIRMED");

  // Behavior: confidenceTier from behaviorProfile
  const bpConfirmed = makeBehaviorProfile({ sessionCount: 15, confidenceTier: ConfidenceTier.CONFIRMED });
  const mbp = assembleLearnerModel({ ...emptyInput(), behaviorProfile: bpConfirmed });
  assert(mbp.learningBehaviorState.confidenceTier === ConfidenceTier.CONFIRMED, "CT wiring: behavior inherits tier");

  // ProblemSolving: 50 attempts → CONFIRMED
  assert(m50.problemSolvingState.confidenceTier === ConfidenceTier.CONFIRMED, "CT wiring: PS 50 attempts = CONFIRMED");

  // ProblemSolving: weakness count for helpSeeking/errorCorrection confidence
  const weaknesses8 = Array.from({ length: 8 }, (_, i) => makeWeakness(`t${i}`, "RECURRING", false, i + 1));
  const mw8 = assembleLearnerModel({ ...emptyInput(), activeWeaknesses: weaknesses8 });
  assert(mw8.problemSolvingState.helpSeeking.confidenceTier === ConfidenceTier.CONFIRMED,
    "CT wiring: 8 weaknesses = CONFIRMED helpSeeking confidence");
}

// ─────────────────────────────────────────────────────────
// Section 10 — Determinism
// ─────────────────────────────────────────────────────────

section("Section 10 — Determinism");

{
  const input = {
    masteryProfiles: [
      makeMasteryProfile("t1", "MASTERED"),
      makeMasteryProfile("t2", "IMPROVING"),
      makeMasteryProfile("t3", "NEEDS_REVIEW"),
    ],
    activeWeaknesses: [makeWeakness("t3", "RECURRING", true, 5)],
    learningSignals: [makeSignal("TOPIC_MASTERED")],
    attempts: [makeAttempt(true, 60), makeAttempt(false, 30), makeAttempt(true, 10)],
    skillAccuracies: [makeSkillAccuracy("grammar", 70)],
    behaviorProfile: makeBehaviorProfile({
      sessionCount: 10,
      preferredTimeOfDay: "AFTERNOON",
      avgSessionDurationMin: 25,
      confidenceTier: ConfidenceTier.EMERGING,
    }),
    explicitPreferences: undefined,
  };

  const m1 = assembleLearnerModel(input);
  const m2 = assembleLearnerModel(input);

  assert(m1.knowledgeState.topicCount === m2.knowledgeState.topicCount, "Determinism: topicCount");
  assert(m1.knowledgeState.confidenceTier === m2.knowledgeState.confidenceTier, "Determinism: KS confidenceTier");
  assert(m1.performanceState.overallAccuracy === m2.performanceState.overallAccuracy, "Determinism: overallAccuracy");
  assert(m1.performanceState.accuracyTrend === m2.performanceState.accuracyTrend, "Determinism: accuracyTrend");
  assert(m1.learningBehaviorState.engagementObservation.engagementLevel === m2.learningBehaviorState.engagementObservation.engagementLevel, "Determinism: engagementLevel");
  assert(m1.learningPreferenceState.practiceTime.value === m2.learningPreferenceState.practiceTime.value, "Determinism: practiceTime");
  assert(m1.problemSolvingState.retryPattern.value === m2.problemSolvingState.retryPattern.value, "Determinism: retryPattern");
  assert(m1.problemSolvingState.helpSeeking.value === m2.problemSolvingState.helpSeeking.value, "Determinism: helpSeeking");
}

// ─────────────────────────────────────────────────────────
// Section 11 — Engine field shapes
// ─────────────────────────────────────────────────────────

section("Section 11 — Engine field shapes");

{
  const model = assembleLearnerModel({
    ...emptyInput(),
    masteryProfiles: [makeMasteryProfile("t1", "MASTERED")],
    activeWeaknesses: [makeWeakness("t2", "RECURRING", true, 3)],
    attempts: Array.from({ length: 15 }, (_, i) => makeAttempt(i % 3 !== 0, 200 - i * 10)),
    skillAccuracies: [makeSkillAccuracy("writing", 60)],
    behaviorProfile: makeBehaviorProfile({ sessionCount: 12, confidenceTier: ConfidenceTier.EMERGING }),
  });

  // KnowledgeState shape
  const ks = model.knowledgeState;
  assert(Array.isArray(ks.masteredConcepts), "KS shape: masteredConcepts is array");
  assert(Array.isArray(ks.developingConcepts), "KS shape: developingConcepts is array");
  assert(Array.isArray(ks.weakConcepts), "KS shape: weakConcepts is array");
  assert(typeof ks.topicCount === "number", "KS shape: topicCount is number");
  assert(Object.values(ConfidenceTier).includes(ks.confidenceTier), "KS shape: valid confidenceTier");

  // PerformanceState shape
  const ps = model.performanceState;
  assert(typeof ps.overallAccuracy === "number", "PS shape: overallAccuracy is number");
  assert(["IMPROVING", "STABLE", "DECLINING", "INSUFFICIENT_DATA"].includes(ps.accuracyTrend), "PS shape: valid accuracyTrend");
  assert(["CONSISTENT", "VARIABLE", "ERRATIC"].includes(ps.consistencyProfile), "PS shape: valid consistencyProfile");
  assert(Array.isArray(ps.skillPerformance), "PS shape: skillPerformance is array");

  // LearningBehaviorState shape
  const bs = model.learningBehaviorState;
  assert("sessionPattern" in bs, "BS shape: sessionPattern present");
  assert("completionBehavior" in bs, "BS shape: completionBehavior present");
  assert("paceObservation" in bs, "BS shape: paceObservation present");
  assert("retryBehavior" in bs, "BS shape: retryBehavior present");
  assert("engagementObservation" in bs, "BS shape: engagementObservation present");

  // LearningPreferenceState shape (7 dimensions)
  const pref = model.learningPreferenceState;
  assert("practiceTime" in pref, "Pref shape: practiceTime present");
  assert("sessionDuration" in pref, "Pref shape: sessionDuration present");
  assert("explanationDepth" in pref, "Pref shape: explanationDepth present");
  assert("hintFrequency" in pref, "Pref shape: hintFrequency present");
  assert("feedbackTiming" in pref, "Pref shape: feedbackTiming present");
  assert("practiceMode" in pref, "Pref shape: practiceMode present");
  assert("languagePreference" in pref, "Pref shape: languagePreference present");

  // ProblemSolvingState shape
  const prob = model.problemSolvingState;
  assert("retryPattern" in prob, "Prob shape: retryPattern present");
  assert("feedbackRecovery" in prob, "Prob shape: feedbackRecovery present");
  assert("helpSeeking" in prob, "Prob shape: helpSeeking present");
  assert("errorCorrection" in prob, "Prob shape: errorCorrection present");
  assert(Object.values(ConfidenceTier).includes(prob.confidenceTier), "Prob shape: valid overall confidenceTier");
}

// ─────────────────────────────────────────────────────────
// Section 12 — Full realistic scenario (CONFIRMED learner)
// ─────────────────────────────────────────────────────────

section("Section 12 — Full realistic scenario (CONFIRMED learner)");

{
  // 50 attempts total: improving trend (first 25 mostly wrong, last 25 mostly correct)
  const firstHalf = Array.from({ length: 25 }, (_, i) => makeAttempt(i % 4 !== 0, 500 - i * 10));
  const secondHalf = Array.from({ length: 25 }, (_, i) => makeAttempt(i % 6 !== 0, 250 - i * 8));
  // Add 10 all-correct retry pairs (wrong→correct within 1 min)
  const retryPairs = [];
  for (let i = 0; i < 10; i++) {
    retryPairs.push(makeAttempt(false, 600 + i * 15 + 5));
    retryPairs.push(makeAttempt(true, 600 + i * 15));
  }
  const allAttempts = [...retryPairs, ...firstHalf, ...secondHalf];

  const masteryProfiles = [
    makeMasteryProfile("present_simple", "MASTERED"),
    makeMasteryProfile("past_simple", "MASTERED"),
    makeMasteryProfile("future_tense", "IMPROVING"),
    makeMasteryProfile("conditionals", "STABLE"),
    makeMasteryProfile("present_perfect", "NEEDS_REVIEW"),
    makeMasteryProfile("passive_voice", "NEEDS_REVIEW"),
    makeMasteryProfile("relative_clauses", "NEEDS_REVIEW"),
    makeMasteryProfile("articles", "IMPROVING"),
    makeMasteryProfile("prepositions", "STABLE"),
    makeMasteryProfile("modal_verbs", "MASTERED"),
  ];

  const activeWeaknesses = [
    makeWeakness("present_perfect", "RECURRING", true, 8, 3),
    makeWeakness("passive_voice", "IMPROVING", true, 5, 2),
    makeWeakness("relative_clauses", "RECURRING", false, 4, 1),
    makeWeakness("articles", "IMPROVING", false, 3, 0),
  ];

  const signals = [
    makeSignal("TOPIC_MASTERED"),
    makeSignal("RECURRING_WEAKNESS"),
    makeSignal("TOPIC_IMPROVING"),
  ];

  const skillAccuracies = [
    makeSkillAccuracy("grammar", 72),
    makeSkillAccuracy("vocabulary", 85),
    makeSkillAccuracy("reading", 60),
  ];

  const behaviorProfile = makeBehaviorProfile({
    sessionCount: 20,
    preferredTimeOfDay: "MORNING",
    avgSessionDurationMin: 45,
    paceProfile: "STEADY",
    responseTimeSignal: "MODERATE",
    recentMoodContext: "POSITIVE",
    confidenceTier: ConfidenceTier.CONFIRMED,
  });

  const model = assembleLearnerModel({
    masteryProfiles,
    activeWeaknesses,
    learningSignals: signals,
    attempts: allAttempts,
    skillAccuracies,
    behaviorProfile,
    explicitPreferences: { explanationDepth: "DETAILED" },
  });

  // KnowledgeState
  assert(model.knowledgeState.topicCount === 10, "Realistic: topicCount = 10");
  assert(model.knowledgeState.confidenceTier === ConfidenceTier.CONFIRMED, "Realistic: KS CONFIRMED");
  assert(model.knowledgeState.masteredConcepts.length === 3, "Realistic: 3 mastered concepts");
  assert(model.knowledgeState.developingConcepts.length === 4, "Realistic: 4 developing (IMPROVING+STABLE)");

  // PerformanceState
  assert(model.performanceState.confidenceTier === ConfidenceTier.CONFIRMED, "Realistic: PS CONFIRMED (70 attempts)");
  assert(model.performanceState.skillPerformance.length === 3, "Realistic: 3 skills");
  const vocabEntry = model.performanceState.skillPerformance.find(s => s.skill === "vocabulary");
  assert(vocabEntry?.tier === "STRONG", "Realistic: 85% vocabulary = STRONG");
  const readingEntry = model.performanceState.skillPerformance.find(s => s.skill === "reading");
  assert(readingEntry?.tier === "DEVELOPING", "Realistic: 60% reading = DEVELOPING");

  // BehaviorState
  assert(model.learningBehaviorState.engagementObservation.engagementLevel === "HIGHLY_ACTIVE",
    "Realistic: 20 sessions = HIGHLY_ACTIVE");
  assert(model.learningBehaviorState.sessionPattern.preferredTimeOfDay === "MORNING", "Realistic: MORNING time");
  assert(model.learningBehaviorState.sessionPattern.avgSessionDurationMin === 45, "Realistic: 45 min sessions");

  // PreferenceState
  assert(model.learningPreferenceState.practiceTime.value === "MORNING", "Realistic: MORNING practice");
  assert(model.learningPreferenceState.sessionDuration.value === "MEDIUM", "Realistic: 45 min = MEDIUM");
  assert(model.learningPreferenceState.explanationDepth.value === "DETAILED", "Realistic: explicit explanationDepth");
  assert(model.learningPreferenceState.explanationDepth.source === "EXPLICIT", "Realistic: EXPLICIT source");

  // ProblemSolvingState
  // 10 retry pairs → 10 wrong with immediate correct retry → retryRate = 10/(10+10correct_in_pairs+some_from_halves)
  // wrongCount = 10 (from pairs) + wrongs in firstHalf + wrongs in secondHalf
  // retryCount = 10 (each pair has exactly 1 retry)
  assert(model.problemSolvingState.feedbackRecovery.value === "RECOVERS_QUICKLY",
    "Realistic: all retry pairs successful = RECOVERS_QUICKLY");
  // helpSeeking: 2/4 = 50% remedial → ACTIVE_ENGAGEMENT
  assert(model.problemSolvingState.helpSeeking.value === "ACTIVE_ENGAGEMENT",
    "Realistic: 2/4 remedial = ACTIVE_ENGAGEMENT");
  // errorCorrection: 2 IMPROVING, 2 RECURRING out of 4
  // improvingRate=50%, recurringRate=50% → ERRORS_PERSISTING (recurring ≥50%)
  assert(model.problemSolvingState.errorCorrection.value === "ERRORS_PERSISTING",
    "Realistic: 50% recurring = ERRORS_PERSISTING");
}

// ─────────────────────────────────────────────────────────
// Section 13 — No new inference / assembly purity
// ─────────────────────────────────────────────────────────

section("Section 13 — No new inference / assembly purity");

{
  // The assembly function adds NO new fields beyond what the 5 engines + assembledAt provide
  const model = assembleLearnerModel(emptyInput());
  const topLevelKeys = Object.keys(model).sort();
  const expectedKeys = ["assembledAt", "knowledgeState", "learningBehaviorState",
    "learningPreferenceState", "performanceState", "problemSolvingState"].sort();
  assert(JSON.stringify(topLevelKeys) === JSON.stringify(expectedKeys),
    "Purity: LearnerModel has exactly the 6 expected top-level keys");

  // assembleLearnerModel does not add any learner classification beyond engine outputs
  const prohibitedFields = [
    "learnerType", "learnerStyle", "motivationScore", "gritScore",
    "personalityType", "learnerCategory", "aptitudeScore",
  ];
  for (const field of prohibitedFields) {
    assert(!(field in model), `Purity: no prohibited field '${field}'`);
  }

  // Engine outputs should be structurally equal to direct engine calls (no transformation)
  const input = {
    masteryProfiles: [makeMasteryProfile("t1", "MASTERED")],
    activeWeaknesses: [],
    learningSignals: [],
    attempts: [],
    skillAccuracies: [],
    behaviorProfile: makeBehaviorProfile({ sessionCount: 5, confidenceTier: ConfidenceTier.EMERGING }),
    explicitPreferences: undefined,
  };
  const assembled = assembleLearnerModel(input);
  const directKS = computeKnowledgeState(input.masteryProfiles, input.activeWeaknesses, input.learningSignals);
  const directPS = computePerformanceState(input.attempts, input.skillAccuracies);

  assert(assembled.knowledgeState.topicCount === directKS.topicCount,
    "Purity: assembled KS topicCount equals direct engine call");
  assert(assembled.knowledgeState.masteredConcepts.length === directKS.masteredConcepts.length,
    "Purity: assembled KS masteredConcepts equals direct engine call");
  assert(assembled.performanceState.overallAccuracy === directPS.overallAccuracy,
    "Purity: assembled PS overallAccuracy equals direct engine call");
  assert(assembled.performanceState.confidenceTier === directPS.confidenceTier,
    "Purity: assembled PS confidenceTier equals direct engine call");
}

// ─────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(`PASS — all ${passed} tests passed`);
} else {
  console.log(`FAIL — ${failed} of ${passed + failed} tests failed`);
  failures.forEach(f => console.log(`  • ${f}`));
  process.exit(1);
}
