/**
 * Test suite — LEXI Lens Foundation (Phase 6.1)
 *
 * Tests the five Lens transformer functions:
 *   buildLearnerSummary, extractLearningInsights, deriveStrengths,
 *   deriveChallenges, buildLensRecommendations
 *
 * All logic is inlined here in JavaScript (mirrors the TypeScript implementation).
 * Sections:
 *   1.  mapConfidenceTier utility
 *   2.  mapSignalConfidence + mapRecommendationConfidence utilities
 *   3.  buildLearnerSummary — shape and basic values
 *   4.  buildLearnerSummary — empty / no topics
 *   5.  buildLearnerSummary — confidence handling
 *   6.  buildLearnerSummary — problem-solving narrative
 *   7.  extractLearningInsights — primary signal
 *   8.  extractLearningInsights — accuracy trend
 *   9.  extractLearningInsights — consistency + recovery
 *   10. extractLearningInsights — max 3 insights cap
 *   11. deriveStrengths — mastered topics
 *   12. deriveStrengths — developing topics and strong skills
 *   13. deriveStrengths — confidence gating
 *   14. deriveChallenges — active weaknesses
 *   15. deriveChallenges — weak skills, help seeking, error pattern
 *   16. buildLensRecommendations — transforms existing recommendations
 *   17. buildLensRecommendations — streak context and preference hints
 *   18. Determinism — same profile → same Lens output
 *   19. No inference — every item carries confidenceTier + source
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

function assertNotIncludes(str, sub, msg) {
  if (str.includes(sub)) {
    throw new Error(msg ?? `expected "${str}" NOT to include "${sub}"`);
  }
}

// ─────────────────────────────────────────────────────────
// ConfidenceTier enum (matches TypeScript enum at runtime)
// ─────────────────────────────────────────────────────────

const ConfidenceTier = {
  OBSERVED: "OBSERVED",
  EMERGING: "EMERGING",
  CONFIRMED: "CONFIRMED",
};

// ─────────────────────────────────────────────────────────
// Inlined Lens utility functions
// ─────────────────────────────────────────────────────────

function mapConfidenceTier(tier) {
  if (tier === ConfidenceTier.CONFIRMED) return "HIGH";
  if (tier === ConfidenceTier.EMERGING) return "MEDIUM";
  return "LOW";
}

function mapSignalConfidence(confidence) {
  if (confidence === "HIGH") return ConfidenceTier.CONFIRMED;
  if (confidence === "MEDIUM") return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function mapRecommendationConfidence(confidence) {
  if (confidence === "HIGH") return ConfidenceTier.CONFIRMED;
  if (confidence === "MEDIUM") return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

// ─────────────────────────────────────────────────────────
// Inlined buildLearnerSummary
// ─────────────────────────────────────────────────────────

function formatEngagementOpening(level) {
  switch (level) {
    case "HIGHLY_ACTIVE": return "A highly active learner";
    case "ACTIVE":        return "An active learner";
    case "OCCASIONAL":    return "An occasional learner";
    case "INACTIVE":      return "An inactive learner";
    default:              return "A learner";
  }
}

function formatTrendPhrase(trend, topicCount) {
  const ctx = topicCount > 0
    ? ` across ${topicCount} topic${topicCount !== 1 ? "s" : ""}`
    : "";
  switch (trend) {
    case "PROGRESSING":       return `showing clear progress${ctx}.`;
    case "STABLE":            return `holding steady${ctx}.`;
    case "NEEDS_ATTENTION":   return `with topics that need attention${ctx}.`;
    case "INSUFFICIENT_DATA": return "still building learning history.";
    default:                  return `with ${topicCount} active topics.`;
  }
}

function formatRetryPhrase(retry) {
  switch (retry) {
    case "FREQUENT_RETRIER":   return "Retries after errors frequently.";
    case "OCCASIONAL_RETRIER": return "Sometimes retries after errors.";
    case "RARELY_RETRIES":     return "Rarely revisits after errors.";
    default:                   return "";
  }
}

function formatRecoveryPhrase(recovery) {
  switch (recovery) {
    case "RECOVERS_QUICKLY": return "Typically corrects mistakes immediately.";
    case "GRADUAL_RECOVERY": return "Shows gradual improvement after errors.";
    case "SLOW_RECOVERY":    return "Slow to recover from errors.";
    default:                 return "";
  }
}

function formatKnowledgeLandscape(masteredCount, developingCount, topicCount, isLowConfidence) {
  if (isLowConfidence) return "Still building a picture of progress across topics.";
  if (masteredCount > 0) {
    const label = `${masteredCount} topic${masteredCount !== 1 ? "s" : ""}`;
    if (developingCount > 0) return `Has mastered ${label}, with ${developingCount} currently improving.`;
    return `Has mastered ${label}.`;
  }
  if (topicCount > 0) return `No mastered topics yet; all ${topicCount} are in active review.`;
  return "";
}

function buildLearnerSummary(profile) {
  const { learnerModel, learningTrend, currentStreak } = profile;
  const { knowledgeState, learningBehaviorState, problemSolvingState } = learnerModel;
  const { engagementObservation } = learningBehaviorState;
  const { engagementLevel, recentMoodContext } = engagementObservation;

  const topicCount = knowledgeState.topicCount;
  const masteredCount = knowledgeState.masteredConcepts.length;
  const developingCount = knowledgeState.developingConcepts.length;
  const weakCount = knowledgeState.weakConcepts.length;
  const confidenceTier = knowledgeState.confidenceTier;
  const isLowConfidence = confidenceTier === ConfidenceTier.OBSERVED;

  if (topicCount < 1) {
    return {
      narrative: "No learning data yet. Complete a few sessions to see your profile.",
      engagementLevel,
      masteredCount: 0,
      developingCount: 0,
      weakCount: 0,
      streakDays: currentStreak,
      topicCount: 0,
      trendIndicator: learningTrend,
      confidenceLevel: "LOW",
      confidenceTier,
      source: "learnerModel.knowledgeState",
    };
  }

  const parts = [];

  const opening = formatEngagementOpening(engagementLevel);
  const trendPhrase = formatTrendPhrase(learningTrend, topicCount);
  parts.push(`${opening} ${trendPhrase}`);

  const retryVal = problemSolvingState.retryPattern.value;
  const recoveryVal = problemSolvingState.feedbackRecovery.value;
  const retryPhrase = retryVal !== "UNKNOWN" ? formatRetryPhrase(retryVal) : "";
  const recoveryPhrase = recoveryVal !== "UNKNOWN" ? formatRecoveryPhrase(recoveryVal) : "";
  if (retryPhrase || recoveryPhrase) {
    parts.push([retryPhrase, recoveryPhrase].filter(Boolean).join(" "));
  }

  const landscape = formatKnowledgeLandscape(masteredCount, developingCount, topicCount, isLowConfidence);
  if (landscape) parts.push(landscape);

  if (recentMoodContext) parts.push(`Recent sessions show ${recentMoodContext} mood context.`);

  return {
    narrative: parts.join(" "),
    engagementLevel,
    masteredCount,
    developingCount,
    weakCount,
    streakDays: currentStreak,
    topicCount,
    trendIndicator: learningTrend,
    confidenceLevel: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.knowledgeState",
  };
}

// ─────────────────────────────────────────────────────────
// Inlined extractLearningInsights
// ─────────────────────────────────────────────────────────

function buildPrimarySignalInsight(profile) {
  const signal = profile.topSignal;
  if (!signal) return null;

  const confidenceTier = mapSignalConfidence(signal.confidence);
  const prefixObserved = confidenceTier === ConfidenceTier.OBSERVED ? "Early sign: " : "";

  let narrative = "";
  switch (signal.type) {
    case "FIRST_MASTERY":
      narrative = `${prefixObserved}You just mastered your first topic: ${signal.topicLabel}! This is a big milestone.`;
      break;
    case "TOPIC_MASTERED":
      narrative = `${prefixObserved}You've mastered ${signal.topicLabel}. Great progress!`;
      break;
    case "TOPIC_IMPROVING":
      narrative = `${prefixObserved}${signal.topicLabel} is improving. Keep practicing.`;
      break;
    case "RECURRING_WEAKNESS":
      narrative = `${prefixObserved}${signal.topicLabel} shows a recurring pattern. You've reviewed it multiple times but mistakes continue.`;
      break;
    case "RETENTION_RISK":
      narrative = `${prefixObserved}${signal.topicLabel} is at risk of being forgotten — these entries are due for review.`;
      break;
    case "LEARNING_MOMENTUM":
      narrative = `${prefixObserved}You're making overall progress. Keep up the momentum.`;
      break;
    case "PACE_OBSERVATION":
      narrative = `${prefixObserved}Your session pace has been declining. A short break or topic change might help.`;
      break;
    case "STREAK_MILESTONE":
      narrative = `You're on a ${signal.evidence.currentStreak}-day streak! Consistent daily practice is the fastest path to improvement.`;
      break;
    default:
      return null;
  }

  const evidence = {};
  if (signal.type === "STREAK_MILESTONE" && signal.evidence.currentStreak !== undefined) {
    evidence.streakDays = signal.evidence.currentStreak;
  }
  evidence.signalType = signal.type;

  return {
    type: "PRIMARY_SIGNAL",
    narrative,
    evidence,
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "topSignal",
  };
}

function buildAccuracyTrendInsight(profile) {
  const { performanceState } = profile.learnerModel;
  const { accuracyTrend, overallAccuracy, confidenceTier } = performanceState;

  if (accuracyTrend === "INSUFFICIENT_DATA") {
    return {
      type: "ACCURACY_TREND",
      narrative: "Too early to measure accuracy trends — complete a few more attempts.",
      evidence: {},
      confidence: "LOW",
      confidenceTier: ConfidenceTier.OBSERVED,
      source: "learnerModel.performanceState",
    };
  }

  const prefix = confidenceTier === ConfidenceTier.OBSERVED ? "Early observation: " : "";
  const accuracyStr = `${Math.round(overallAccuracy)}%`;

  let narrative = "";
  switch (accuracyTrend) {
    case "IMPROVING":
      narrative = `${prefix}Your accuracy is improving (currently ${accuracyStr}). Great progress!`;
      break;
    case "STABLE":
      narrative = `${prefix}You're holding steady at ${accuracyStr} accuracy — a solid foundation to build on.`;
      break;
    case "DECLINING":
      narrative = `${prefix}Your accuracy has been declining (currently ${accuracyStr}). Consider focusing on fundamentals.`;
      break;
    default:
      return null;
  }

  return {
    type: "ACCURACY_TREND",
    narrative,
    evidence: { attempts: undefined },
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.performanceState",
  };
}

function buildConsistencyInsight(profile) {
  const { performanceState } = profile.learnerModel;
  const { consistencyProfile, confidenceTier } = performanceState;

  if (consistencyProfile === "CONSISTENT") return null;
  if (confidenceTier === ConfidenceTier.OBSERVED) return null;

  const prefix = confidenceTier === ConfidenceTier.EMERGING ? "It looks like " : "";

  let narrative = "";
  if (consistencyProfile === "VARIABLE") {
    narrative = `${prefix}your performance varies session to session. Some days you're sharper than others.`;
  } else if (consistencyProfile === "ERRATIC") {
    narrative = `${prefix}your results are erratic. Something may be affecting your focus or preparation between sessions.`;
  } else {
    return null;
  }

  if (!prefix) {
    narrative = narrative.charAt(0).toUpperCase() + narrative.slice(1);
  }

  return {
    type: "CONSISTENCY",
    narrative,
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.performanceState.consistencyProfile",
  };
}

function buildRecoveryInsight(profile) {
  const { problemSolvingState } = profile.learnerModel;
  const { feedbackRecovery } = problemSolvingState;

  if (feedbackRecovery.value === "UNKNOWN") return null;

  const confidenceTier = problemSolvingState.confidenceTier;
  const prefix = confidenceTier === ConfidenceTier.OBSERVED ? "Early observation: " : "";

  let narrative = "";
  switch (feedbackRecovery.value) {
    case "RECOVERS_QUICKLY":
      narrative = `${prefix}When you make a mistake, you usually correct it immediately. Strong error recovery.`;
      break;
    case "GRADUAL_RECOVERY":
      narrative = `${prefix}You recover from errors gradually — taking a few extra attempts before getting it right.`;
      break;
    case "SLOW_RECOVERY":
      narrative = `${prefix}You recover from errors slowly. Consider reviewing the explanation after each mistake.`;
      break;
    default:
      return null;
  }

  return {
    type: "RECOVERY",
    narrative,
    confidence: mapConfidenceTier(confidenceTier),
    confidenceTier,
    source: "learnerModel.problemSolvingState.feedbackRecovery",
  };
}

function extractLearningInsights(profile) {
  const candidates = [
    buildPrimarySignalInsight(profile),
    buildAccuracyTrendInsight(profile),
    buildConsistencyInsight(profile),
    buildRecoveryInsight(profile),
  ];

  const insights = candidates.filter((i) => i !== null).slice(0, 3);

  return {
    insights,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Inlined deriveStrengths
// ─────────────────────────────────────────────────────────

function deriveStrengths(profile) {
  const { learnerModel } = profile;
  const { knowledgeState, performanceState, learningBehaviorState } = learnerModel;

  const knowledgeTier = knowledgeState.confidenceTier;
  const perfTier = performanceState.confidenceTier;
  const behaviorTier = learningBehaviorState.confidenceTier;
  const isKnowledgeObserved = knowledgeTier === ConfidenceTier.OBSERVED;
  const isPerfObserved = perfTier === ConfidenceTier.OBSERVED;

  const items = [];

  if (!isKnowledgeObserved) {
    const masteredList = knowledgeState.masteredConcepts.slice(0, 5);
    for (const concept of masteredList) {
      items.push({
        type: "MASTERED_TOPIC",
        label: concept.label,
        detail: "You've mastered this topic.",
        confidence: mapConfidenceTier(knowledgeTier),
        confidenceTier: knowledgeTier,
        source: "learnerModel.knowledgeState.masteredConcepts",
      });
    }
    if (knowledgeState.masteredConcepts.length > 5) {
      const overflow = knowledgeState.masteredConcepts.length - 5;
      items.push({
        type: "MASTERED_TOPIC",
        label: `+${overflow} more mastered topics`,
        percentageOrCount: overflow,
        confidence: mapConfidenceTier(knowledgeTier),
        confidenceTier: knowledgeTier,
        source: "learnerModel.knowledgeState.masteredConcepts",
      });
    }
  }

  const developing = knowledgeState.developingConcepts;
  if (developing.length > 0) {
    items.push({
      type: "DEVELOPING_TOPIC",
      label: `Making progress on ${developing.length} topic${developing.length !== 1 ? "s" : ""}`,
      detail: developing.slice(0, 3).map((c) => c.label).join(", "),
      percentageOrCount: developing.length,
      confidence: mapConfidenceTier(knowledgeTier),
      confidenceTier: knowledgeTier,
      source: "learnerModel.knowledgeState.developingConcepts",
    });
  }

  if (!isPerfObserved) {
    const strongSkills = performanceState.skillPerformance
      .filter((s) => s.tier === "STRONG")
      .slice(0, 3);

    for (const skill of strongSkills) {
      items.push({
        type: "STRONG_SKILL",
        label: `Strong in ${skill.label}`,
        detail: `${Math.round(skill.percentage)}% accuracy`,
        percentageOrCount: skill.percentage,
        confidence: mapConfidenceTier(perfTier),
        confidenceTier: perfTier,
        source: "learnerModel.performanceState.skillPerformance",
      });
    }
  }

  // Pacing momentum deferred — PaceProfile has no ACCELERATING value in current data model.

  const confidenceNote = isKnowledgeObserved
    ? "These are early observations based on limited data."
    : undefined;

  return {
    strengths: items.slice(0, 8),
    generatedAt: new Date().toISOString(),
    confidenceNote,
  };
}

// ─────────────────────────────────────────────────────────
// Inlined deriveChallenges
// ─────────────────────────────────────────────────────────

function signalReason(signal, dueCount, isRemedialFlagged) {
  const parts = [];
  switch (signal) {
    case "RECURRING": parts.push("You've reviewed this but mistakes continue."); break;
    case "IMPROVING": parts.push("Still working on this — recent progress shows improvement."); break;
    case "STABLE":    parts.push("No clear progress yet — may need a fresh approach."); break;
    default:          parts.push("Needs attention."); break;
  }
  if (dueCount > 0) parts.push("Due for review now.");
  if (isRemedialFlagged) parts.push("You've flagged this for extra help.");
  return parts.join(" ");
}

function deriveChallenges(profile) {
  const { learnerModel, activeWeaknesses } = profile;
  const { performanceState, problemSolvingState, knowledgeState } = learnerModel;

  const knowledgeTier = knowledgeState.confidenceTier;
  const perfTier = performanceState.confidenceTier;
  const problemTier = problemSolvingState.confidenceTier;
  const problemPrefix = problemTier === ConfidenceTier.OBSERVED ? "Early sign: " : "";

  const items = [];

  const relevantWeaknesses = activeWeaknesses.filter((w) => w.signal !== "IMPROVED");
  for (const w of relevantWeaknesses.slice(0, 5)) {
    items.push({
      type: "ACTIVE_WEAKNESS",
      label: w.label,
      reason: signalReason(w.signal, w.dueCount, w.isRemedialFlagged),
      signal: w.signal,
      dueNow: w.dueCount > 0,
      confidence: mapConfidenceTier(knowledgeTier),
      confidenceTier: knowledgeTier,
      source: "activeWeaknesses",
    });
  }

  const weakSkills = performanceState.skillPerformance
    .filter((s) => s.tier === "WEAK")
    .slice(0, 3);

  for (const skill of weakSkills) {
    items.push({
      type: "WEAK_SKILL",
      label: `Weak in ${skill.label}`,
      reason: `Your accuracy in ${skill.label} is ${Math.round(skill.percentage)}%. Practice this skill to improve.`,
      confidence: mapConfidenceTier(perfTier),
      confidenceTier: perfTier,
      source: "learnerModel.performanceState.skillPerformance",
    });
  }

  const helpSeeking = problemSolvingState.helpSeeking;
  const recurringCount = activeWeaknesses.filter((w) => w.signal === "RECURRING").length;
  if (helpSeeking.value === "LOW_ENGAGEMENT" && recurringCount > 0) {
    items.push({
      type: "HELP_SEEKING_GAP",
      label: "Low engagement with remediation",
      reason: `${problemPrefix}You haven't flagged topics for extra help, even though ${recurringCount} topic${recurringCount !== 1 ? "s" : ""} show recurring mistakes.`,
      actionHint: "Try reviewing the error notebook and marking topics for remediation.",
      confidence: mapConfidenceTier(problemTier),
      confidenceTier: problemTier,
      source: "learnerModel.problemSolvingState.helpSeeking",
    });
  }

  const errorCorrection = problemSolvingState.errorCorrection;
  if (errorCorrection.value === "ERRORS_PERSISTING") {
    items.push({
      type: "ERROR_PATTERN",
      label: "Errors not decreasing",
      reason: `${problemPrefix}Recorded errors are not decreasing. You're reviewing but not resolving the mistakes.`,
      actionHint: "This usually means the explanation needs to be different, or the topic needs more examples.",
      confidence: mapConfidenceTier(problemTier),
      confidenceTier: problemTier,
      source: "learnerModel.problemSolvingState.errorCorrection",
    });
  }

  return {
    challenges: items.slice(0, 7),
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Inlined buildLensRecommendations
// ─────────────────────────────────────────────────────────

function buildReason(rec) {
  switch (rec.priorityLabel) {
    case "RECURRING_MISTAKE":
      return `You've practiced this but mistakes continue. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`;
    case "DUE_REVIEW":
      return `It's been a while since your last review. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`;
    case "WEAKNESS_SIGNAL":
      return `Your recent accuracy was low on this topic. ${rec.questionCount} question${rec.questionCount !== 1 ? "s" : ""} available.`;
    case "CURRICULUM_PROGRESS":
      return rec.sessionNumber
        ? `You've finished the current content. Advance to Session ${rec.sessionNumber}${rec.label ? `: ${rec.label}` : ""}.`
        : "You've finished the current content. Advance to the next session.";
    default:
      return rec.reason;
  }
}

function addPreferenceHint(reason, rec, profile) {
  const pref = profile.learnerModel.learningPreferenceState;
  const practiceMode = pref.practiceMode.value;
  const sessionDuration = pref.sessionDuration.value;

  let hint = "";
  if (rec.priorityLabel === "CURRICULUM_PROGRESS" && practiceMode === "EXAM_SIMULATION") {
    hint = " Try a full-length exam simulation.";
  }
  if (sessionDuration === "SHORT" && (rec.priorityLabel === "RECURRING_MISTAKE" || rec.priorityLabel === "WEAKNESS_SIGNAL")) {
    hint = " Quick 5-question drill recommended.";
  }
  return reason + hint;
}

function buildLensRecommendations(profile) {
  const { recommendations, nextSessionNumber, currentStreak } = profile;

  const actions = recommendations.map((rec) => {
    const confidenceTier = mapRecommendationConfidence(rec.confidence);
    const baseReason = buildReason(rec);
    const enrichedReason = addPreferenceHint(baseReason, rec, profile);

    const item = {
      priority: rec.priority,
      topic: rec.topic,
      label: rec.label,
      reason: enrichedReason,
      suggestedAction: rec.suggestedAction,
      questionCount: rec.questionCount > 0 ? rec.questionCount : undefined,
      confidence: mapConfidenceTier(confidenceTier),
      confidenceTier,
      source: "recommendations",
    };

    if (rec.sessionNumber !== undefined) item.sessionNumber = rec.sessionNumber;
    if (rec.priorityLabel === "CURRICULUM_PROGRESS" && rec.label) item.sessionTitle = rec.label;

    return item;
  });

  const streakContext = currentStreak >= 7 ? `Keep your ${currentStreak}-day streak going!` : undefined;

  return {
    actions,
    nextSessionReady: nextSessionNumber !== null,
    streakContext,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────

const emptyKnowledgeState = {
  masteredConcepts: [],
  developingConcepts: [],
  weakConcepts: [],
  confidenceTier: "OBSERVED",
  topicCount: 0,
  computedAt: "2026-06-30T00:00:00.000Z",
};

const emptyPerformanceState = {
  accuracyTrend: "INSUFFICIENT_DATA",
  overallAccuracy: 0,
  consistencyProfile: "CONSISTENT",
  skillPerformance: [],
  confidenceTier: "OBSERVED",
  computedAt: "2026-06-30T00:00:00.000Z",
};

const emptyBehaviorState = {
  sessionPattern: { sessionCount: 0, avgSessionDurationMin: null, preferredTimeOfDay: null },
  completionBehavior: { completedSessionCount: 0 },
  paceObservation: { paceProfile: null },
  retryBehavior: { responseTimeSignal: null },
  engagementObservation: { engagementLevel: "INACTIVE", recentMoodContext: null },
  confidenceTier: "OBSERVED",
  computedAt: "2026-06-30T00:00:00.000Z",
};

const emptyPreferenceState = {
  practiceTime:       { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  sessionDuration:    { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  explanationDepth:   { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  hintFrequency:      { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  feedbackTiming:     { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  practiceMode:       { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  languagePreference: { value: "UNKNOWN", source: "NONE", confidenceTier: "OBSERVED" },
  computedAt:         "2026-06-30T00:00:00.000Z",
};

const emptyProblemSolvingState = {
  retryPattern:     { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
  feedbackRecovery: { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
  helpSeeking:      { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
  errorCorrection:  { value: "UNKNOWN", evidence: null, confidenceTier: "OBSERVED" },
  confidenceTier: "OBSERVED",
  computedAt: "2026-06-30T00:00:00.000Z",
};

function emptyLearnerModel() {
  return {
    knowledgeState: JSON.parse(JSON.stringify(emptyKnowledgeState)),
    performanceState: JSON.parse(JSON.stringify(emptyPerformanceState)),
    learningBehaviorState: JSON.parse(JSON.stringify(emptyBehaviorState)),
    learningPreferenceState: JSON.parse(JSON.stringify(emptyPreferenceState)),
    problemSolvingState: JSON.parse(JSON.stringify(emptyProblemSolvingState)),
    assembledAt: "2026-06-30T00:00:00.000Z",
  };
}

function emptyProfile() {
  return {
    userId: "u1",
    generatedAt: "2026-06-30T00:00:00.000Z",
    readiness: null,
    masterySummary: {
      totalTopics: 0,
      byState: { MASTERED: 0, IMPROVING: 0, STABLE: 0, NEEDS_REVIEW: 0 },
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
    behaviorProfile: {
      preferredTimeOfDay: null,
      paceProfile: null,
      avgSessionDurationMin: null,
      responseTimeSignal: null,
      recentMoodContext: null,
      sessionCount: 0,
      confidenceTier: "OBSERVED",
    },
    currentStreak: 0,
    topSignal: null,
    goalCountdown: null,
    learnerModel: emptyLearnerModel(),
  };
}

function richProfile() {
  const p = emptyProfile();
  p.learningTrend = "PROGRESSING";
  p.currentStreak = 10;

  p.learnerModel.knowledgeState = {
    masteredConcepts: [
      { topic: "present_simple", label: "Present Simple", masteryState: "MASTERED" },
      { topic: "past_simple", label: "Past Simple", masteryState: "MASTERED" },
    ],
    developingConcepts: [
      { topic: "present_perfect", label: "Present Perfect", masteryState: "IMPROVING" },
      { topic: "past_continuous", label: "Past Continuous", masteryState: "STABLE" },
    ],
    weakConcepts: [
      { topic: "subjunctive", label: "Subjunctive", masteryState: "NEEDS_REVIEW" },
    ],
    confidenceTier: "CONFIRMED",
    topicCount: 5,
    computedAt: "2026-06-30T00:00:00.000Z",
  };

  p.learnerModel.performanceState = {
    accuracyTrend: "IMPROVING",
    overallAccuracy: 72,
    consistencyProfile: "CONSISTENT",
    skillPerformance: [
      { skill: "reading",  label: "Reading",  percentage: 82, tier: "STRONG" },
      { skill: "grammar",  label: "Grammar",  percentage: 60, tier: "DEVELOPING" },
      { skill: "writing",  label: "Writing",  percentage: 38, tier: "WEAK" },
    ],
    confidenceTier: "CONFIRMED",
    computedAt: "2026-06-30T00:00:00.000Z",
  };

  p.learnerModel.learningBehaviorState.engagementObservation.engagementLevel = "ACTIVE";
  p.learnerModel.learningBehaviorState.confidenceTier = "CONFIRMED";

  p.learnerModel.problemSolvingState = {
    retryPattern:     { value: "FREQUENT_RETRIER",  evidence: "Retried after 8/10 errors.", confidenceTier: "CONFIRMED" },
    feedbackRecovery: { value: "RECOVERS_QUICKLY",  evidence: "70% post-error success.",    confidenceTier: "CONFIRMED" },
    helpSeeking:      { value: "SOME_ENGAGEMENT",   evidence: "3/5 flagged.",                confidenceTier: "CONFIRMED" },
    errorCorrection:  { value: "ERRORS_REDUCING",   evidence: "4/6 signals IMPROVED.",      confidenceTier: "CONFIRMED" },
    confidenceTier: "CONFIRMED",
    computedAt: "2026-06-30T00:00:00.000Z",
  };

  p.activeWeaknesses = [
    { topic: "subjunctive", label: "Subjunctive", signal: "RECURRING",
      isRemedialFlagged: false, dueCount: 2, masteryState: "NEEDS_REVIEW", totalOccurrences: 6 },
    { topic: "phrasal_verbs", label: "Phrasal Verbs", signal: "STABLE",
      isRemedialFlagged: true, dueCount: 0, masteryState: "NEEDS_REVIEW", totalOccurrences: 3 },
  ];

  p.recommendations = [
    { topic: "subjunctive", label: "Subjunctive", reason: "Recurring mistakes",
      priority: 1, priorityLabel: "RECURRING_MISTAKE", suggestedAction: "REVIEW_NOTEBOOK",
      questionCount: 8, confidence: "HIGH" },
    { topic: "phrasal_verbs", label: "Phrasal Verbs", reason: "Due for review",
      priority: 2, priorityLabel: "DUE_REVIEW", suggestedAction: "PRACTICE_TOPIC",
      questionCount: 5, confidence: "MEDIUM" },
  ];

  p.nextSessionNumber = 3;
  p.nextSessionTitle = "Intermediate Grammar";

  return p;
}

// ─────────────────────────────────────────────────────────
// Section 1 — mapConfidenceTier utility
// ─────────────────────────────────────────────────────────

describe("1. mapConfidenceTier");

test("CONFIRMED → HIGH", () => assertEqual(mapConfidenceTier("CONFIRMED"), "HIGH"));
test("EMERGING → MEDIUM", () => assertEqual(mapConfidenceTier("EMERGING"), "MEDIUM"));
test("OBSERVED → LOW", () => assertEqual(mapConfidenceTier("OBSERVED"), "LOW"));
test("unknown → LOW", () => assertEqual(mapConfidenceTier("SOMETHING"), "LOW"));

// ─────────────────────────────────────────────────────────
// Section 2 — mapSignalConfidence + mapRecommendationConfidence
// ─────────────────────────────────────────────────────────

describe("2. confidence mapping utilities");

test("signal HIGH → CONFIRMED", () => assertEqual(mapSignalConfidence("HIGH"), "CONFIRMED"));
test("signal MEDIUM → EMERGING", () => assertEqual(mapSignalConfidence("MEDIUM"), "EMERGING"));
test("signal LOW → OBSERVED", () => assertEqual(mapSignalConfidence("LOW"), "OBSERVED"));
test("recommendation HIGH → CONFIRMED", () => assertEqual(mapRecommendationConfidence("HIGH"), "CONFIRMED"));
test("recommendation MEDIUM → EMERGING", () => assertEqual(mapRecommendationConfidence("MEDIUM"), "EMERGING"));
test("recommendation LOW → OBSERVED", () => assertEqual(mapRecommendationConfidence("LOW"), "OBSERVED"));

// ─────────────────────────────────────────────────────────
// Section 3 — buildLearnerSummary shape and values
// ─────────────────────────────────────────────────────────

describe("3. buildLearnerSummary — shape");

test("returns all required fields", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assert(typeof s.narrative === "string", "narrative");
  assert(typeof s.engagementLevel === "string", "engagementLevel");
  assert(typeof s.masteredCount === "number", "masteredCount");
  assert(typeof s.developingCount === "number", "developingCount");
  assert(typeof s.weakCount === "number", "weakCount");
  assert(typeof s.streakDays === "number", "streakDays");
  assert(typeof s.topicCount === "number", "topicCount");
  assert(typeof s.trendIndicator === "string", "trendIndicator");
  assert(typeof s.confidenceLevel === "string", "confidenceLevel");
  assert(typeof s.confidenceTier === "string", "confidenceTier");
  assert(typeof s.source === "string", "source");
});

test("masteredCount matches knowledgeState.masteredConcepts.length", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.masteredCount, 2);
});

test("developingCount matches developingConcepts.length", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.developingCount, 2);
});

test("weakCount matches weakConcepts.length", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.weakCount, 1);
});

test("streakDays matches profile.currentStreak", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.streakDays, 10);
});

test("topicCount matches knowledgeState.topicCount", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.topicCount, 5);
});

test("trendIndicator matches learningTrend", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.trendIndicator, "PROGRESSING");
});

test("confidenceLevel is HIGH for CONFIRMED tier", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.confidenceLevel, "HIGH");
});

test("source is learnerModel.knowledgeState", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.source, "learnerModel.knowledgeState");
});

test("engagementLevel from behaviorState", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.engagementLevel, "ACTIVE");
});

test("narrative includes engagement opening", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "active learner");
});

test("narrative includes trend phrase", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "progress");
});

test("narrative includes mastered count", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "mastered");
});

test("narrative includes retry pattern", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "Retries after errors");
});

test("narrative includes recovery pattern", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "corrects mistakes immediately");
});

// ─────────────────────────────────────────────────────────
// Section 4 — buildLearnerSummary empty / no topics
// ─────────────────────────────────────────────────────────

describe("4. buildLearnerSummary — empty data");

test("topicCount 0 → early narrative", () => {
  const p = emptyProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "No learning data");
});

test("topicCount 0 → masteredCount 0", () => {
  const p = emptyProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.masteredCount, 0);
});

test("topicCount 0 → confidenceLevel LOW", () => {
  const p = emptyProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.confidenceLevel, "LOW");
});

test("topicCount 0 → trendIndicator INSUFFICIENT_DATA", () => {
  const p = emptyProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.trendIndicator, "INSUFFICIENT_DATA");
});

test("zero streak reflected in streakDays", () => {
  const p = emptyProfile();
  const s = buildLearnerSummary(p);
  assertEqual(s.streakDays, 0);
});

// ─────────────────────────────────────────────────────────
// Section 5 — buildLearnerSummary confidence handling
// ─────────────────────────────────────────────────────────

describe("5. buildLearnerSummary — confidence handling");

test("OBSERVED confidence → hedged knowledge landscape", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "OBSERVED";
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "Still building a picture");
});

test("OBSERVED confidence → NOT showing mastered count", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "OBSERVED";
  const s = buildLearnerSummary(p);
  assertNotIncludes(s.narrative, "Has mastered");
});

test("CONFIRMED confidence → direct mastered statement", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "Has mastered");
});

test("OBSERVED confidence → confidenceLevel LOW", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "OBSERVED";
  const s = buildLearnerSummary(p);
  assertEqual(s.confidenceLevel, "LOW");
});

test("EMERGING confidence → confidenceLevel MEDIUM", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "EMERGING";
  const s = buildLearnerSummary(p);
  assertEqual(s.confidenceLevel, "MEDIUM");
});

test("no mastered but topics present → shows all in review", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.masteredConcepts = [];
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "active review");
});

// ─────────────────────────────────────────────────────────
// Section 6 — buildLearnerSummary problem-solving narrative
// ─────────────────────────────────────────────────────────

describe("6. buildLearnerSummary — problem solving");

test("RARELY_RETRIES appears in narrative", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.retryPattern.value = "RARELY_RETRIES";
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "Rarely revisits");
});

test("SLOW_RECOVERY appears in narrative", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.feedbackRecovery.value = "SLOW_RECOVERY";
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "Slow to recover");
});

test("UNKNOWN retry → no retry phrase", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.retryPattern.value = "UNKNOWN";
  p.learnerModel.problemSolvingState.feedbackRecovery.value = "UNKNOWN";
  const s = buildLearnerSummary(p);
  assertNotIncludes(s.narrative, "Retries");
  assertNotIncludes(s.narrative, "corrects mistakes");
});

test("INACTIVE engagement → 'inactive learner' in narrative", () => {
  const p = richProfile();
  p.learnerModel.learningBehaviorState.engagementObservation.engagementLevel = "INACTIVE";
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "inactive learner");
});

test("mood context added to narrative when present", () => {
  const p = richProfile();
  p.learnerModel.learningBehaviorState.engagementObservation.recentMoodContext = "POSITIVE";
  const s = buildLearnerSummary(p);
  assertIncludes(s.narrative, "POSITIVE mood context");
});

// ─────────────────────────────────────────────────────────
// Section 7 — extractLearningInsights primary signal
// ─────────────────────────────────────────────────────────

describe("7. extractLearningInsights — primary signal");

test("no topSignal → no PRIMARY_SIGNAL insight", () => {
  const p = richProfile();
  p.topSignal = null;
  const result = extractLearningInsights(p);
  assert(!result.insights.some((i) => i.type === "PRIMARY_SIGNAL"), "no primary signal");
});

test("TOPIC_MASTERED signal → PRIMARY_SIGNAL insight", () => {
  const p = richProfile();
  p.topSignal = { type: "TOPIC_MASTERED", severity: "MEDIUM", topic: "present_simple",
    topicLabel: "Present Simple", evidence: { masteredCount: 2 }, confidence: "HIGH",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "TOPIC_MASTERED_Present Simple" };
  const result = extractLearningInsights(p);
  const primary = result.insights.find((i) => i.type === "PRIMARY_SIGNAL");
  assert(primary !== undefined, "primary signal exists");
  assertIncludes(primary.narrative, "Present Simple");
  assertEqual(primary.confidence, "HIGH");
  assertEqual(primary.source, "topSignal");
});

test("RECURRING_WEAKNESS signal narrative references topic", () => {
  const p = richProfile();
  p.topSignal = { type: "RECURRING_WEAKNESS", severity: "HIGH", topic: "subjunctive",
    topicLabel: "Subjunctive", evidence: { occurrenceCount: 6 }, confidence: "HIGH",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "RECURRING_WEAKNESS_subjunctive" };
  const result = extractLearningInsights(p);
  const primary = result.insights.find((i) => i.type === "PRIMARY_SIGNAL");
  assertIncludes(primary.narrative, "Subjunctive");
  assertIncludes(primary.narrative, "recurring pattern");
});

test("STREAK_MILESTONE signal includes streak evidence", () => {
  const p = richProfile();
  p.topSignal = { type: "STREAK_MILESTONE", severity: "MEDIUM", topic: null, topicLabel: null,
    evidence: { currentStreak: 7 }, confidence: "HIGH",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "STREAK_MILESTONE_7" };
  const result = extractLearningInsights(p);
  const primary = result.insights.find((i) => i.type === "PRIMARY_SIGNAL");
  assertEqual(primary.evidence.streakDays, 7);
});

test("LOW signal confidence → confidenceTier OBSERVED", () => {
  const p = richProfile();
  p.topSignal = { type: "TOPIC_IMPROVING", severity: "MEDIUM", topic: "present_perfect",
    topicLabel: "Present Perfect", evidence: { occurrenceCount: 1 }, confidence: "LOW",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "TOPIC_IMPROVING_present_perfect" };
  const result = extractLearningInsights(p);
  const primary = result.insights.find((i) => i.type === "PRIMARY_SIGNAL");
  assertEqual(primary.confidenceTier, "OBSERVED");
  assertIncludes(primary.narrative, "Early sign:");
});

// ─────────────────────────────────────────────────────────
// Section 8 — extractLearningInsights accuracy trend
// ─────────────────────────────────────────────────────────

describe("8. extractLearningInsights — accuracy trend");

test("INSUFFICIENT_DATA → low confidence ACCURACY_TREND", () => {
  const p = emptyProfile();
  const result = extractLearningInsights(p);
  const trend = result.insights.find((i) => i.type === "ACCURACY_TREND");
  assert(trend !== undefined, "accuracy trend insight exists");
  assertEqual(trend.confidence, "LOW");
  assertIncludes(trend.narrative, "Too early");
});

test("IMPROVING accuracyTrend → positive narrative", () => {
  const p = richProfile();
  const result = extractLearningInsights(p);
  const trend = result.insights.find((i) => i.type === "ACCURACY_TREND");
  assertIncludes(trend.narrative, "improving");
  assertIncludes(trend.narrative, "72%");
});

test("STABLE accuracyTrend → steady narrative", () => {
  const p = richProfile();
  p.learnerModel.performanceState.accuracyTrend = "STABLE";
  p.learnerModel.performanceState.overallAccuracy = 65;
  const result = extractLearningInsights(p);
  const trend = result.insights.find((i) => i.type === "ACCURACY_TREND");
  assertIncludes(trend.narrative, "holding steady");
  assertIncludes(trend.narrative, "65%");
});

test("DECLINING accuracyTrend → focus narrative", () => {
  const p = richProfile();
  p.learnerModel.performanceState.accuracyTrend = "DECLINING";
  p.learnerModel.performanceState.overallAccuracy = 48;
  const result = extractLearningInsights(p);
  const trend = result.insights.find((i) => i.type === "ACCURACY_TREND");
  assertIncludes(trend.narrative, "declining");
});

test("OBSERVED confidenceTier → Early observation prefix", () => {
  const p = richProfile();
  p.learnerModel.performanceState.confidenceTier = "OBSERVED";
  const result = extractLearningInsights(p);
  const trend = result.insights.find((i) => i.type === "ACCURACY_TREND");
  assertIncludes(trend.narrative, "Early observation:");
});

// ─────────────────────────────────────────────────────────
// Section 9 — extractLearningInsights consistency + recovery
// ─────────────────────────────────────────────────────────

describe("9. extractLearningInsights — consistency + recovery");

test("CONSISTENT profile → no CONSISTENCY insight", () => {
  const p = richProfile();
  p.learnerModel.performanceState.consistencyProfile = "CONSISTENT";
  const result = extractLearningInsights(p);
  assert(!result.insights.some((i) => i.type === "CONSISTENCY"), "no consistency insight for CONSISTENT");
});

test("VARIABLE + EMERGING → CONSISTENCY insight", () => {
  const p = richProfile();
  p.learnerModel.performanceState.consistencyProfile = "VARIABLE";
  p.learnerModel.performanceState.confidenceTier = "EMERGING";
  const result = extractLearningInsights(p);
  const cons = result.insights.find((i) => i.type === "CONSISTENCY");
  assert(cons !== undefined, "consistency insight exists");
  assertIncludes(cons.narrative, "varies");
});

test("ERRATIC + CONFIRMED → CONSISTENCY insight", () => {
  const p = richProfile();
  p.learnerModel.performanceState.consistencyProfile = "ERRATIC";
  p.learnerModel.performanceState.confidenceTier = "CONFIRMED";
  const result = extractLearningInsights(p);
  const cons = result.insights.find((i) => i.type === "CONSISTENCY");
  assertIncludes(cons.narrative, "erratic");
});

test("VARIABLE + OBSERVED → no consistency insight (gated)", () => {
  const p = richProfile();
  p.learnerModel.performanceState.consistencyProfile = "VARIABLE";
  p.learnerModel.performanceState.confidenceTier = "OBSERVED";
  const result = extractLearningInsights(p);
  assert(!result.insights.some((i) => i.type === "CONSISTENCY"), "suppressed at OBSERVED");
});

test("RECOVERS_QUICKLY → RECOVERY insight", () => {
  const p = richProfile();
  const result = extractLearningInsights(p);
  const rec = result.insights.find((i) => i.type === "RECOVERY");
  assert(rec !== undefined, "recovery insight exists");
  assertIncludes(rec.narrative, "correct it immediately");
});

test("UNKNOWN feedbackRecovery → no RECOVERY insight", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.feedbackRecovery.value = "UNKNOWN";
  const result = extractLearningInsights(p);
  assert(!result.insights.some((i) => i.type === "RECOVERY"), "no recovery insight");
});

test("SLOW_RECOVERY → suggests reviewing explanation", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.feedbackRecovery.value = "SLOW_RECOVERY";
  const result = extractLearningInsights(p);
  const rec = result.insights.find((i) => i.type === "RECOVERY");
  assertIncludes(rec.narrative, "reviewing the explanation");
});

// ─────────────────────────────────────────────────────────
// Section 10 — extractLearningInsights max 3 cap
// ─────────────────────────────────────────────────────────

describe("10. extractLearningInsights — max 3 cap");

test("at most 3 insights returned", () => {
  const p = richProfile();
  // Set up ERRATIC so consistency fires, plus all other signals
  p.topSignal = { type: "TOPIC_MASTERED", severity: "MEDIUM", topic: null,
    topicLabel: "Present Simple", evidence: { masteredCount: 2 }, confidence: "HIGH",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "x" };
  p.learnerModel.performanceState.consistencyProfile = "ERRATIC";
  p.learnerModel.performanceState.confidenceTier = "CONFIRMED";
  const result = extractLearningInsights(p);
  assert(result.insights.length <= 3, `expected ≤ 3, got ${result.insights.length}`);
});

test("priority order: PRIMARY_SIGNAL first", () => {
  const p = richProfile();
  p.topSignal = { type: "TOPIC_MASTERED", severity: "MEDIUM", topic: null,
    topicLabel: "Present Simple", evidence: { masteredCount: 2 }, confidence: "HIGH",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "x" };
  const result = extractLearningInsights(p);
  assert(result.insights.length > 0, "has insights");
  assertEqual(result.insights[0].type, "PRIMARY_SIGNAL");
});

test("generatedAt is ISO timestamp string", () => {
  const p = richProfile();
  const result = extractLearningInsights(p);
  assert(result.generatedAt.includes("T"), "ISO format");
});

// ─────────────────────────────────────────────────────────
// Section 11 — deriveStrengths mastered topics
// ─────────────────────────────────────────────────────────

describe("11. deriveStrengths — mastered topics");

test("CONFIRMED knowledge → mastered topics in strengths", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const mastered = result.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  assertEqual(mastered.length, 2);
});

test("mastered item label matches concept label", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const mastered = result.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  assertEqual(mastered[0].label, "Present Simple");
});

test("mastered item source is knowledgeState.masteredConcepts", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const mastered = result.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  assertEqual(mastered[0].source, "learnerModel.knowledgeState.masteredConcepts");
});

test("OBSERVED knowledge → mastered topics suppressed", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "OBSERVED";
  const result = deriveStrengths(p);
  const mastered = result.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  assertEqual(mastered.length, 0);
});

test("OBSERVED confidence → confidenceNote set", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "OBSERVED";
  const result = deriveStrengths(p);
  assert(result.confidenceNote !== undefined, "confidenceNote present");
  assertIncludes(result.confidenceNote, "early observations");
});

test("no confidenceNote when CONFIRMED", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  assert(result.confidenceNote === undefined, "no confidenceNote for CONFIRMED");
});

test("more than 5 mastered → overflow item added", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.masteredConcepts = [
    { topic: "t1", label: "T1", masteryState: "MASTERED" },
    { topic: "t2", label: "T2", masteryState: "MASTERED" },
    { topic: "t3", label: "T3", masteryState: "MASTERED" },
    { topic: "t4", label: "T4", masteryState: "MASTERED" },
    { topic: "t5", label: "T5", masteryState: "MASTERED" },
    { topic: "t6", label: "T6", masteryState: "MASTERED" },
  ];
  const result = deriveStrengths(p);
  const masteredItems = result.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  // 5 individual + 1 overflow = 6 items, but max 8 total
  const overflow = masteredItems.find((s) => s.label.startsWith("+"));
  assert(overflow !== undefined, "overflow item exists");
  assertEqual(overflow.percentageOrCount, 1);
});

// ─────────────────────────────────────────────────────────
// Section 12 — deriveStrengths developing + strong skills
// ─────────────────────────────────────────────────────────

describe("12. deriveStrengths — developing topics and strong skills");

test("developing concepts → DEVELOPING_TOPIC item", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const dev = result.strengths.find((s) => s.type === "DEVELOPING_TOPIC");
  assert(dev !== undefined, "developing topic item");
  assertEqual(dev.percentageOrCount, 2);
});

test("no developing concepts → no DEVELOPING_TOPIC item", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.developingConcepts = [];
  const result = deriveStrengths(p);
  assert(!result.strengths.some((s) => s.type === "DEVELOPING_TOPIC"), "no developing item");
});

test("developing topic source is knowledgeState.developingConcepts", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const dev = result.strengths.find((s) => s.type === "DEVELOPING_TOPIC");
  assertEqual(dev.source, "learnerModel.knowledgeState.developingConcepts");
});

test("STRONG skill → STRONG_SKILL item", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const strong = result.strengths.filter((s) => s.type === "STRONG_SKILL");
  assertEqual(strong.length, 1); // only Reading is STRONG
  assertIncludes(strong[0].label, "Reading");
});

test("STRONG_SKILL percentageOrCount matches skill percentage", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  const strong = result.strengths.find((s) => s.type === "STRONG_SKILL");
  assertEqual(strong.percentageOrCount, 82);
});

test("OBSERVED performance → strong skills suppressed", () => {
  const p = richProfile();
  p.learnerModel.performanceState.confidenceTier = "OBSERVED";
  const result = deriveStrengths(p);
  assert(!result.strengths.some((s) => s.type === "STRONG_SKILL"), "suppressed at OBSERVED perf");
});

test("DECLINING pace → no PACING_MOMENTUM (PaceProfile has no ACCELERATING value)", () => {
  const p = richProfile();
  p.learnerModel.learningBehaviorState.paceObservation.paceProfile = "DECLINING";
  const result = deriveStrengths(p);
  assert(!result.strengths.some((s) => s.type === "PACING_MOMENTUM"), "no pacing item");
});

test("CONSISTENT pace → no PACING_MOMENTUM", () => {
  const p = richProfile();
  p.learnerModel.learningBehaviorState.paceObservation.paceProfile = "CONSISTENT";
  const result = deriveStrengths(p);
  assert(!result.strengths.some((s) => s.type === "PACING_MOMENTUM"), "no pacing item");
});

test("strengths capped at 8", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.masteredConcepts = Array.from({ length: 10 }, (_, i) => ({
    topic: `t${i}`, label: `Topic ${i}`, masteryState: "MASTERED",
  }));
  const result = deriveStrengths(p);
  assert(result.strengths.length <= 8, `max 8: got ${result.strengths.length}`);
});

test("generatedAt is ISO timestamp", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  assert(result.generatedAt.includes("T"), "ISO format");
});

// ─────────────────────────────────────────────────────────
// Section 13 — deriveStrengths confidence gating
// ─────────────────────────────────────────────────────────

describe("13. deriveStrengths — confidence gating");

test("all empty → empty strengths list", () => {
  const p = emptyProfile();
  const result = deriveStrengths(p);
  assertEqual(result.strengths.length, 0);
});

test("EMERGING knowledge confidence allows mastered topics", () => {
  const p = richProfile();
  p.learnerModel.knowledgeState.confidenceTier = "EMERGING";
  const result = deriveStrengths(p);
  const mastered = result.strengths.filter((s) => s.type === "MASTERED_TOPIC");
  assertEqual(mastered.length, 2);
});

test("all confidence tiers present on strength items", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  for (const item of result.strengths) {
    assert(item.confidenceTier !== undefined, `confidenceTier missing on ${item.type}`);
    assert(item.source !== undefined, `source missing on ${item.type}`);
  }
});

// ─────────────────────────────────────────────────────────
// Section 14 — deriveChallenges active weaknesses
// ─────────────────────────────────────────────────────────

describe("14. deriveChallenges — active weaknesses");

test("active weaknesses → ACTIVE_WEAKNESS items", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const aw = result.challenges.filter((c) => c.type === "ACTIVE_WEAKNESS");
  assertEqual(aw.length, 2);
});

test("RECURRING signal reason describes recurring mistakes", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const recurring = result.challenges.find((c) => c.signal === "RECURRING");
  assertIncludes(recurring.reason, "mistakes continue");
});

test("dueNow true when dueCount > 0", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const withDue = result.challenges.find((c) => c.type === "ACTIVE_WEAKNESS" && c.dueNow);
  assert(withDue !== undefined, "dueNow item");
});

test("dueNow false when dueCount = 0", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const noDue = result.challenges.find(
    (c) => c.type === "ACTIVE_WEAKNESS" && c.label === "Phrasal Verbs"
  );
  assertEqual(noDue.dueNow, false);
});

test("isRemedialFlagged → reason includes remedial note", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const remedial = result.challenges.find(
    (c) => c.type === "ACTIVE_WEAKNESS" && c.label === "Phrasal Verbs"
  );
  assertIncludes(remedial.reason, "flagged this for extra help");
});

test("IMPROVED signal → excluded from challenges", () => {
  const p = richProfile();
  p.activeWeaknesses.push({
    topic: "articles", label: "Articles", signal: "IMPROVED",
    isRemedialFlagged: false, dueCount: 0, masteryState: "IMPROVING", totalOccurrences: 2,
  });
  const result = deriveChallenges(p);
  assert(!result.challenges.some((c) => c.label === "Articles"), "IMPROVED excluded");
});

test("ACTIVE_WEAKNESS source is activeWeaknesses", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const aw = result.challenges.find((c) => c.type === "ACTIVE_WEAKNESS");
  assertEqual(aw.source, "activeWeaknesses");
});

// ─────────────────────────────────────────────────────────
// Section 15 — deriveChallenges weak skills, help seeking, error pattern
// ─────────────────────────────────────────────────────────

describe("15. deriveChallenges — weak skills, help seeking, error pattern");

test("WEAK skill → WEAK_SKILL challenge", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const weak = result.challenges.filter((c) => c.type === "WEAK_SKILL");
  assertEqual(weak.length, 1); // Writing is WEAK
  assertIncludes(weak[0].label, "Writing");
});

test("WEAK_SKILL reason includes accuracy percentage", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const weak = result.challenges.find((c) => c.type === "WEAK_SKILL");
  assertIncludes(weak.reason, "38%");
});

test("WEAK_SKILL source is performanceState.skillPerformance", () => {
  const p = richProfile();
  const result = deriveChallenges(p);
  const weak = result.challenges.find((c) => c.type === "WEAK_SKILL");
  assertEqual(weak.source, "learnerModel.performanceState.skillPerformance");
});

test("LOW_ENGAGEMENT + recurring → HELP_SEEKING_GAP", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.helpSeeking.value = "LOW_ENGAGEMENT";
  const result = deriveChallenges(p);
  const gap = result.challenges.find((c) => c.type === "HELP_SEEKING_GAP");
  assert(gap !== undefined, "help seeking gap exists");
  assertIncludes(gap.reason, "1 topic");
});

test("LOW_ENGAGEMENT but no recurring → no HELP_SEEKING_GAP", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.helpSeeking.value = "LOW_ENGAGEMENT";
  p.activeWeaknesses = p.activeWeaknesses.map((w) => ({ ...w, signal: "STABLE" }));
  const result = deriveChallenges(p);
  assert(!result.challenges.some((c) => c.type === "HELP_SEEKING_GAP"), "no gap without recurring");
});

test("ERRORS_PERSISTING → ERROR_PATTERN challenge", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.errorCorrection.value = "ERRORS_PERSISTING";
  const result = deriveChallenges(p);
  const err = result.challenges.find((c) => c.type === "ERROR_PATTERN");
  assert(err !== undefined, "error pattern exists");
  assertIncludes(err.reason, "not decreasing");
});

test("ERRORS_PERSISTING + OBSERVED confidence → 'Early sign:' prefix", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.errorCorrection.value = "ERRORS_PERSISTING";
  p.learnerModel.problemSolvingState.confidenceTier = "OBSERVED";
  const result = deriveChallenges(p);
  const err = result.challenges.find((c) => c.type === "ERROR_PATTERN");
  assertIncludes(err.reason, "Early sign:");
});

test("challenges capped at 7", () => {
  const p = richProfile();
  p.activeWeaknesses = Array.from({ length: 6 }, (_, i) => ({
    topic: `t${i}`, label: `Topic ${i}`, signal: "RECURRING",
    isRemedialFlagged: false, dueCount: 1, masteryState: "NEEDS_REVIEW", totalOccurrences: 3,
  }));
  p.learnerModel.problemSolvingState.helpSeeking.value = "LOW_ENGAGEMENT";
  p.learnerModel.problemSolvingState.errorCorrection.value = "ERRORS_PERSISTING";
  const result = deriveChallenges(p);
  assert(result.challenges.length <= 7, `max 7: got ${result.challenges.length}`);
});

test("empty weaknesses → no ACTIVE_WEAKNESS challenges", () => {
  const p = emptyProfile();
  const result = deriveChallenges(p);
  assert(!result.challenges.some((c) => c.type === "ACTIVE_WEAKNESS"), "no active weakness");
});

// ─────────────────────────────────────────────────────────
// Section 16 — buildLensRecommendations
// ─────────────────────────────────────────────────────────

describe("16. buildLensRecommendations — transforms existing");

test("maps each recommendation to RecommendationItem", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.actions.length, 2);
});

test("priority preserved from PracticeRecommendation", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.actions[0].priority, 1);
  assertEqual(result.actions[1].priority, 2);
});

test("topic and label preserved", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.actions[0].topic, "subjunctive");
  assertEqual(result.actions[0].label, "Subjunctive");
});

test("RECURRING_MISTAKE → reason includes 'mistakes continue'", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertIncludes(result.actions[0].reason, "mistakes continue");
});

test("DUE_REVIEW → reason includes 'last review'", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertIncludes(result.actions[1].reason, "last review");
});

test("HIGH confidence → confidenceTier CONFIRMED", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.actions[0].confidenceTier, "CONFIRMED");
  assertEqual(result.actions[0].confidence, "HIGH");
});

test("MEDIUM confidence → confidenceTier EMERGING", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.actions[1].confidenceTier, "EMERGING");
  assertEqual(result.actions[1].confidence, "MEDIUM");
});

test("source is 'recommendations'", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  for (const action of result.actions) {
    assertEqual(action.source, "recommendations");
  }
});

test("nextSessionReady true when nextSessionNumber present", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.nextSessionReady, true);
});

test("nextSessionReady false when nextSessionNumber null", () => {
  const p = richProfile();
  p.nextSessionNumber = null;
  const result = buildLensRecommendations(p);
  assertEqual(result.nextSessionReady, false);
});

test("empty recommendations → empty actions", () => {
  const p = emptyProfile();
  const result = buildLensRecommendations(p);
  assertEqual(result.actions.length, 0);
});

test("questionCount 0 → undefined in output", () => {
  const p = richProfile();
  p.recommendations[0].questionCount = 0;
  const result = buildLensRecommendations(p);
  assertEqual(result.actions[0].questionCount, undefined);
});

test("CURRICULUM_PROGRESS includes session info", () => {
  const p = emptyProfile();
  p.recommendations = [{
    topic: "session_3", label: "Intermediate Grammar",
    reason: "Next session", priority: 1, priorityLabel: "CURRICULUM_PROGRESS",
    suggestedAction: "ADVANCE_SESSION", questionCount: 0,
    sessionNumber: 3, confidence: "MEDIUM",
  }];
  const result = buildLensRecommendations(p);
  assertIncludes(result.actions[0].reason, "Session 3");
  assertEqual(result.actions[0].sessionTitle, "Intermediate Grammar");
  assertEqual(result.actions[0].sessionNumber, 3);
});

// ─────────────────────────────────────────────────────────
// Section 17 — buildLensRecommendations streak + preference hints
// ─────────────────────────────────────────────────────────

describe("17. buildLensRecommendations — streak + preference");

test("streak >= 7 → streakContext set", () => {
  const p = richProfile();
  p.currentStreak = 10;
  const result = buildLensRecommendations(p);
  assert(result.streakContext !== undefined, "streakContext present");
  assertIncludes(result.streakContext, "10-day");
});

test("streak < 7 → no streakContext", () => {
  const p = richProfile();
  p.currentStreak = 5;
  const result = buildLensRecommendations(p);
  assertEqual(result.streakContext, undefined);
});

test("EXAM_SIMULATION + CURRICULUM_PROGRESS → exam hint in reason", () => {
  const p = emptyProfile();
  p.learnerModel.learningPreferenceState.practiceMode.value = "EXAM_SIMULATION";
  p.recommendations = [{
    topic: "session_3", label: "Grammar Session",
    reason: "Advance", priority: 1, priorityLabel: "CURRICULUM_PROGRESS",
    suggestedAction: "ADVANCE_SESSION", questionCount: 0,
    sessionNumber: 3, confidence: "MEDIUM",
  }];
  const result = buildLensRecommendations(p);
  assertIncludes(result.actions[0].reason, "exam simulation");
});

test("SHORT session + RECURRING_MISTAKE → quick drill hint", () => {
  const p = richProfile();
  p.learnerModel.learningPreferenceState.sessionDuration.value = "SHORT";
  const result = buildLensRecommendations(p);
  assertIncludes(result.actions[0].reason, "Quick 5-question drill");
});

test("no preference set → no hint added", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  assertNotIncludes(result.actions[0].reason, "drill");
  assertNotIncludes(result.actions[0].reason, "simulation");
});

// ─────────────────────────────────────────────────────────
// Section 18 — Determinism
// ─────────────────────────────────────────────────────────

describe("18. Determinism");

test("buildLearnerSummary is deterministic (same profile → same values)", () => {
  const p = richProfile();
  const s1 = buildLearnerSummary(p);
  const s2 = buildLearnerSummary(p);
  assertEqual(s1.masteredCount, s2.masteredCount);
  assertEqual(s1.engagementLevel, s2.engagementLevel);
  assertEqual(s1.trendIndicator, s2.trendIndicator);
  assertEqual(s1.confidenceTier, s2.confidenceTier);
  assertEqual(s1.narrative, s2.narrative);
});

test("deriveStrengths is deterministic (item count)", () => {
  const p = richProfile();
  const r1 = deriveStrengths(p);
  const r2 = deriveStrengths(p);
  assertEqual(r1.strengths.length, r2.strengths.length);
  for (let i = 0; i < r1.strengths.length; i++) {
    assertEqual(r1.strengths[i].type, r2.strengths[i].type);
    assertEqual(r1.strengths[i].label, r2.strengths[i].label);
    assertEqual(r1.strengths[i].confidenceTier, r2.strengths[i].confidenceTier);
  }
});

test("deriveChallenges is deterministic (item count and order)", () => {
  const p = richProfile();
  const r1 = deriveChallenges(p);
  const r2 = deriveChallenges(p);
  assertEqual(r1.challenges.length, r2.challenges.length);
  for (let i = 0; i < r1.challenges.length; i++) {
    assertEqual(r1.challenges[i].type, r2.challenges[i].type);
    assertEqual(r1.challenges[i].label, r2.challenges[i].label);
  }
});

test("buildLensRecommendations is deterministic (priority order)", () => {
  const p = richProfile();
  const r1 = buildLensRecommendations(p);
  const r2 = buildLensRecommendations(p);
  assertEqual(r1.actions.length, r2.actions.length);
  for (let i = 0; i < r1.actions.length; i++) {
    assertEqual(r1.actions[i].priority, r2.actions[i].priority);
    assertEqual(r1.actions[i].topic, r2.actions[i].topic);
    assertEqual(r1.actions[i].reason, r2.actions[i].reason);
  }
});

// ─────────────────────────────────────────────────────────
// Section 19 — confidenceTier + source on every item
// ─────────────────────────────────────────────────────────

describe("19. confidenceTier + source on every output item");

test("LearnerSummary has confidenceTier and source", () => {
  const p = richProfile();
  const s = buildLearnerSummary(p);
  assert(s.confidenceTier !== undefined, "confidenceTier");
  assert(typeof s.source === "string" && s.source.length > 0, "source");
});

test("every LearningInsight has confidenceTier and source", () => {
  const p = richProfile();
  p.topSignal = { type: "TOPIC_MASTERED", severity: "MEDIUM", topic: null,
    topicLabel: "Present Simple", evidence: { masteredCount: 2 }, confidence: "HIGH",
    generatedAt: "2026-06-30T00:00:00.000Z", suppressionKey: "x" };
  const result = extractLearningInsights(p);
  for (const insight of result.insights) {
    assert(insight.confidenceTier !== undefined, `confidenceTier missing on ${insight.type}`);
    assert(typeof insight.source === "string" && insight.source.length > 0,
      `source missing on ${insight.type}`);
  }
});

test("every StrengthItem has confidenceTier and source", () => {
  const p = richProfile();
  const result = deriveStrengths(p);
  for (const item of result.strengths) {
    assert(item.confidenceTier !== undefined, `confidenceTier missing on ${item.type}`);
    assert(typeof item.source === "string" && item.source.length > 0,
      `source missing on ${item.type}`);
  }
});

test("every ChallengeItem has confidenceTier and source", () => {
  const p = richProfile();
  p.learnerModel.problemSolvingState.helpSeeking.value = "LOW_ENGAGEMENT";
  p.learnerModel.problemSolvingState.errorCorrection.value = "ERRORS_PERSISTING";
  const result = deriveChallenges(p);
  for (const item of result.challenges) {
    assert(item.confidenceTier !== undefined, `confidenceTier missing on ${item.type}`);
    assert(typeof item.source === "string" && item.source.length > 0,
      `source missing on ${item.type}`);
  }
});

test("every RecommendationItem has confidenceTier and source", () => {
  const p = richProfile();
  const result = buildLensRecommendations(p);
  for (const action of result.actions) {
    assert(action.confidenceTier !== undefined, `confidenceTier missing`);
    assert(typeof action.source === "string" && action.source.length > 0, "source missing");
  }
});

test("sources are specific field paths (not generic)", () => {
  const p = richProfile();
  const strengths = deriveStrengths(p);
  const mastered = strengths.strengths.find((s) => s.type === "MASTERED_TOPIC");
  assert(mastered.source.includes("knowledgeState"), "mastered source references knowledgeState");
  const strong = strengths.strengths.find((s) => s.type === "STRONG_SKILL");
  assert(strong.source.includes("performanceState"), "strong skill source references performanceState");
});

test("challenge sources are specific", () => {
  const p = richProfile();
  const challenges = deriveChallenges(p);
  const aw = challenges.challenges.find((c) => c.type === "ACTIVE_WEAKNESS");
  assertEqual(aw.source, "activeWeaknesses");
  const ws = challenges.challenges.find((c) => c.type === "WEAK_SKILL");
  assert(ws.source.includes("performanceState"), "weak skill references performanceState");
});

test("insight sources are specific", () => {
  const p = richProfile();
  const insights = extractLearningInsights(p);
  for (const i of insights.insights) {
    assert(i.source.length > 0, "non-empty source");
    assertNotIncludes(i.source, " ", "no spaces in source path");
  }
});

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────

console.log(`\nLEXI Lens Foundation Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
