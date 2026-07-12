/**
 * Phase 5.4 — Problem Solving Pattern State tests
 *
 * Pure engine tests — no DB, no TypeScript compilation.
 * Functions are inlined here to match the exact logic in:
 *   lib/services/learner-intelligence/problemSolvingState.ts
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
// Inline: problemSolvingState engine
// ─────────────────────────────────────────────────────────

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
const CONFIRMED_ATTEMPT_THRESHOLD = 50;
const EMERGING_ATTEMPT_THRESHOLD = 10;

function pct(numerator, denominator) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function unknownPattern(reason) {
  return { value: "UNKNOWN", evidence: reason, confidenceTier: ConfidenceTier.OBSERVED };
}

function retryConfidenceTier(wrongCount) {
  if (wrongCount >= MIN_WRONG_FOR_RETRY_CONFIRMED) return ConfidenceTier.CONFIRMED;
  if (wrongCount >= MIN_WRONG_FOR_RETRY_EMERGING) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function weaknessConfidenceTier(count) {
  if (count >= MIN_WEAKNESSES_FOR_CONFIRMED) return ConfidenceTier.CONFIRMED;
  if (count >= MIN_WEAKNESSES_FOR_EMERGING) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function scanRetryBehavior(attempts) {
  const sorted = [...attempts].sort(
    (a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime(),
  );
  let wrongCount = 0;
  let retryCount = 0;
  let correctRetryCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].isCorrect) {
      wrongCount++;
      if (i < sorted.length - 1) {
        const delta = new Date(sorted[i + 1].attemptedAt).getTime() - new Date(sorted[i].attemptedAt).getTime();
        if (delta <= RETRY_WINDOW_MS) {
          retryCount++;
          if (sorted[i + 1].isCorrect) correctRetryCount++;
        }
      }
    }
  }
  return { wrongCount, retryCount, correctRetryCount };
}

function buildRetryPattern(scan) {
  const { wrongCount, retryCount } = scan;
  if (wrongCount === 0) return unknownPattern("No wrong answers recorded");
  const tier = retryConfidenceTier(wrongCount);
  const rate = retryCount / wrongCount;
  const ratePct = pct(retryCount, wrongCount);
  const evidence = `Retried after ${retryCount} of ${wrongCount} wrong answers (${ratePct}%)`;
  if (rate >= FREQUENT_RETRY_THRESHOLD) return { value: "FREQUENT_RETRIER", evidence, confidenceTier: tier };
  if (rate >= OCCASIONAL_RETRY_THRESHOLD) return { value: "OCCASIONAL_RETRIER", evidence, confidenceTier: tier };
  return { value: "RARELY_RETRIES", evidence, confidenceTier: tier };
}

function buildFeedbackRecovery(scan) {
  const { wrongCount, retryCount, correctRetryCount } = scan;
  if (retryCount === 0) {
    const reason = wrongCount === 0 ? null : "No retries detected after wrong answers";
    return unknownPattern(reason);
  }
  const tier = retryConfidenceTier(wrongCount);
  const rate = correctRetryCount / retryCount;
  const ratePct = pct(correctRetryCount, retryCount);
  const evidence = `${correctRetryCount} of ${retryCount} post-error retries were correct (${ratePct}%)`;
  if (rate >= QUICK_RECOVERY_THRESHOLD) return { value: "RECOVERS_QUICKLY", evidence, confidenceTier: tier };
  if (rate >= GRADUAL_RECOVERY_THRESHOLD) return { value: "GRADUAL_RECOVERY", evidence, confidenceTier: tier };
  return { value: "SLOW_RECOVERY", evidence, confidenceTier: tier };
}

function buildHelpSeeking(activeWeaknesses) {
  const total = activeWeaknesses.length;
  if (total === 0) return unknownPattern("No error topics recorded");
  const flagged = activeWeaknesses.filter(w => w.isRemedialFlagged).length;
  const rate = flagged / total;
  const ratePct = pct(flagged, total);
  const evidence = `${flagged} of ${total} error topics flagged for active remediation (${ratePct}%)`;
  const tier = weaknessConfidenceTier(total);
  if (rate >= ACTIVE_ENGAGEMENT_THRESHOLD) return { value: "ACTIVE_ENGAGEMENT", evidence, confidenceTier: tier };
  if (rate >= SOME_ENGAGEMENT_THRESHOLD) return { value: "SOME_ENGAGEMENT", evidence, confidenceTier: tier };
  return { value: "LOW_ENGAGEMENT", evidence, confidenceTier: tier };
}

function buildErrorCorrection(activeWeaknesses) {
  const withSignal = activeWeaknesses.filter(w => w.signal !== "NO_DATA");
  const total = withSignal.length;
  if (total === 0) {
    return unknownPattern(
      activeWeaknesses.length === 0
        ? "No error topics recorded"
        : "No improvement signal data available",
    );
  }
  const recurringCount = withSignal.filter(w => w.signal === "RECURRING").length;
  const improvingCount = withSignal.filter(w => w.signal === "IMPROVED" || w.signal === "IMPROVING").length;
  const improvingRate = improvingCount / total;
  const recurringRate = recurringCount / total;
  const evidence = `${recurringCount} recurring, ${improvingCount} improving across ${total} error topics with signal data`;
  const tier = weaknessConfidenceTier(total);
  if (improvingRate >= IMPROVING_DOMINANT_THRESHOLD) return { value: "ERRORS_REDUCING", evidence, confidenceTier: tier };
  if (recurringRate >= RECURRING_DOMINANT_THRESHOLD) return { value: "ERRORS_PERSISTING", evidence, confidenceTier: tier };
  return { value: "ERRORS_STABLE", evidence, confidenceTier: tier };
}

function deriveOverallConfidenceTier(attemptCount) {
  if (attemptCount >= CONFIRMED_ATTEMPT_THRESHOLD) return ConfidenceTier.CONFIRMED;
  if (attemptCount >= EMERGING_ATTEMPT_THRESHOLD) return ConfidenceTier.EMERGING;
  return ConfidenceTier.OBSERVED;
}

function computeProblemSolvingState(attempts, activeWeaknesses) {
  const scan = scanRetryBehavior(attempts);
  return {
    retryPattern: buildRetryPattern(scan),
    feedbackRecovery: buildFeedbackRecovery(scan),
    helpSeeking: buildHelpSeeking(activeWeaknesses),
    errorCorrection: buildErrorCorrection(activeWeaknesses),
    confidenceTier: deriveOverallConfidenceTier(attempts.length),
    computedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────

function makeAttempt(isCorrect, minutesAgo) {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  return { isCorrect, attemptedAt: d.toISOString() };
}

// Attempts where wrong is followed by retry within 10 min
function retryPair(minutesAgo, retryCorrect) {
  return [
    makeAttempt(false, minutesAgo + 5),      // wrong
    makeAttempt(retryCorrect, minutesAgo),   // retry within 5 min
  ];
}

function makeWeakness(signal, isRemedialFlagged = false) {
  return {
    topic: `topic_${Math.random()}`,
    label: "Test Topic",
    signal,
    isRemedialFlagged,
    dueCount: 0,
    masteryState: "NEEDS_REVIEW",
    totalOccurrences: 2,
  };
}

// ─────────────────────────────────────────────────────────
// Section 1: Empty data — all UNKNOWN
// ─────────────────────────────────────────────────────────

section("1. Empty data — all UNKNOWN");

{
  const state = computeProblemSolvingState([], []);

  assertEqual(state.retryPattern.value, "UNKNOWN", "empty attempts → retryPattern UNKNOWN");
  // When attempts is empty, wrongCount = 0 → same as all-correct path
  assertEqual(state.retryPattern.evidence, "No wrong answers recorded", "empty attempts → retryPattern evidence");
  assertEqual(state.retryPattern.confidenceTier, ConfidenceTier.OBSERVED, "retryPattern tier OBSERVED");

  assertEqual(state.feedbackRecovery.value, "UNKNOWN", "empty attempts → feedbackRecovery UNKNOWN");
  assertEqual(state.feedbackRecovery.evidence, null, "empty attempts → feedbackRecovery evidence null");

  assertEqual(state.helpSeeking.value, "UNKNOWN", "empty weaknesses → helpSeeking UNKNOWN");
  assertEqual(state.helpSeeking.evidence, "No error topics recorded", "helpSeeking evidence: no topics");

  assertEqual(state.errorCorrection.value, "UNKNOWN", "empty weaknesses → errorCorrection UNKNOWN");
  assertEqual(state.errorCorrection.evidence, "No error topics recorded", "errorCorrection evidence: no topics");

  assertEqual(state.confidenceTier, ConfidenceTier.OBSERVED, "0 attempts → OBSERVED overall");

  assert(typeof state.computedAt === "string", "computedAt is a string");
  assert(state.computedAt.includes("T"), "computedAt is ISO format");
}

// ─────────────────────────────────────────────────────────
// Section 2: All correct attempts — no wrong → retryPattern UNKNOWN
// ─────────────────────────────────────────────────────────

section("2. All correct attempts — no wrong answers");

{
  const attempts = [
    makeAttempt(true, 30), makeAttempt(true, 25),
    makeAttempt(true, 20), makeAttempt(true, 15),
    makeAttempt(true, 10), makeAttempt(true, 5),
  ];
  const state = computeProblemSolvingState(attempts, []);

  assertEqual(state.retryPattern.value, "UNKNOWN", "all correct → retryPattern UNKNOWN");
  assertEqual(state.retryPattern.evidence, "No wrong answers recorded", "evidence: no wrong answers");
  assertEqual(state.feedbackRecovery.value, "UNKNOWN", "all correct → feedbackRecovery UNKNOWN");
  assertEqual(state.feedbackRecovery.evidence, null, "feedbackRecovery evidence null (no wrongs)");
}

// ─────────────────────────────────────────────────────────
// Section 3: Retry pattern — FREQUENT_RETRIER
// ─────────────────────────────────────────────────────────

section("3. Retry pattern — FREQUENT_RETRIER");

{
  // 6 wrong answers, 4 retried within window → 4/6 = 67% → FREQUENT_RETRIER
  // Use all-correct retries so retry attempts don't also count as wrong answers.
  // Lone wrongs have 20+ min gap to next attempt → no accidental retry window.
  const attempts = [
    ...retryPair(200, true),  // wrong@205, correct@200 (5 min) → retry ✓
    ...retryPair(160, true),  // wrong@165, correct@160 (5 min) → retry ✓
    ...retryPair(120, true),  // wrong@125, correct@120 (5 min) → retry ✓
    ...retryPair(80, true),   // wrong@85, correct@80 (5 min) → retry ✓
    makeAttempt(false, 40),   // lone wrong@40; next is correct@20 → 20 min gap, no retry
    makeAttempt(true, 20),
    makeAttempt(false, 1),    // lone wrong@1, no following attempt
  ];
  // wrongCount = 6 (4 pair initiators + 2 lone), retryCount = 4 → 67%
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.value, "FREQUENT_RETRIER", "67% retry rate → FREQUENT_RETRIER");
  assert(state.retryPattern.evidence !== null, "evidence is not null");
  assert(state.retryPattern.evidence.includes("4 of 6"), "evidence includes retry counts");
}

// ─────────────────────────────────────────────────────────
// Section 4: Retry pattern — OCCASIONAL_RETRIER
// ─────────────────────────────────────────────────────────

section("4. Retry pattern — OCCASIONAL_RETRIER");

{
  // 8 wrong answers, 3 retried → 37.5% → OCCASIONAL_RETRIER
  const attempts = [
    ...retryPair(200, true),
    ...retryPair(180, false),
    ...retryPair(160, true),
    makeAttempt(false, 140),
    makeAttempt(true, 120),
    makeAttempt(false, 100),
    makeAttempt(true, 80),
    makeAttempt(false, 60),
    makeAttempt(true, 40),
    makeAttempt(false, 20),
    makeAttempt(false, 1),
  ];
  const scan = scanRetryBehavior(attempts);
  // 8 wrong: the 3 retryPairs + the 5 lone wrong answers
  // retries = 3 (from retryPairs)
  // rate = 3/8 = 37.5%
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.value, "OCCASIONAL_RETRIER", "37.5% retry rate → OCCASIONAL_RETRIER");
}

// ─────────────────────────────────────────────────────────
// Section 5: Retry pattern — RARELY_RETRIES
// ─────────────────────────────────────────────────────────

section("5. Retry pattern — RARELY_RETRIES");

{
  // 8 wrong answers, 1 retried → 12.5% → RARELY_RETRIES
  const attempts = [
    ...retryPair(200, true),   // 1 retry
    makeAttempt(false, 180),
    makeAttempt(true, 160),
    makeAttempt(false, 140),
    makeAttempt(true, 120),
    makeAttempt(false, 100),
    makeAttempt(true, 80),
    makeAttempt(false, 60),
    makeAttempt(true, 40),
    makeAttempt(false, 20),
    makeAttempt(false, 1),
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.value, "RARELY_RETRIES", "12.5% retry rate → RARELY_RETRIES");
}

// ─────────────────────────────────────────────────────────
// Section 6: Retry pattern boundary — exactly 60% is FREQUENT
// ─────────────────────────────────────────────────────────

section("6. Retry pattern boundaries");

{
  // 5 wrong, 3 retried = 60% → FREQUENT_RETRIER (≥ threshold)
  const attempts = [
    ...retryPair(100, true),
    ...retryPair(80, false),
    ...retryPair(60, true),
    makeAttempt(false, 40),
    makeAttempt(true, 30),
    makeAttempt(false, 1),
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.value, "FREQUENT_RETRIER", "exactly 60% → FREQUENT_RETRIER");
}

{
  // 4 wrong, 1 retried = 25% → OCCASIONAL_RETRIER (≥ threshold)
  // Lone wrongs have 20+ min gap to next attempt to avoid accidental retry window.
  const attempts = [
    ...retryPair(200, true),   // 1 retry (25%)
    makeAttempt(false, 160),   // lone wrong; next correct@120 → 40 min → no retry
    makeAttempt(true, 120),
    makeAttempt(false, 80),    // lone wrong; next correct@40 → 40 min → no retry
    makeAttempt(true, 40),
    makeAttempt(false, 1),     // lone wrong, no following
  ];
  // wrongCount = 4, retryCount = 1 → 25%
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.value, "OCCASIONAL_RETRIER", "exactly 25% → OCCASIONAL_RETRIER");
}

// ─────────────────────────────────────────────────────────
// Section 7: Feedback recovery — RECOVERS_QUICKLY
// ─────────────────────────────────────────────────────────

section("7. Feedback recovery thresholds");

{
  // 4 retries, 3 correct → 75% → RECOVERS_QUICKLY
  const attempts = [
    ...retryPair(100, true),
    ...retryPair(80, true),
    ...retryPair(60, true),
    ...retryPair(40, false),
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.feedbackRecovery.value, "RECOVERS_QUICKLY", "75% post-error success → RECOVERS_QUICKLY");
  assert(state.feedbackRecovery.evidence.includes("3 of 4"), "evidence includes correct/total");
}

{
  // 4 retries, 2 correct → 50% → GRADUAL_RECOVERY
  const attempts = [
    ...retryPair(100, true),
    ...retryPair(80, true),
    ...retryPair(60, false),
    ...retryPair(40, false),
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.feedbackRecovery.value, "GRADUAL_RECOVERY", "50% post-error success → GRADUAL_RECOVERY");
}

{
  // 4 retries, 1 correct → 25% → SLOW_RECOVERY
  const attempts = [
    ...retryPair(100, true),
    ...retryPair(80, false),
    ...retryPair(60, false),
    ...retryPair(40, false),
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.feedbackRecovery.value, "SLOW_RECOVERY", "25% post-error success → SLOW_RECOVERY");
}

{
  // 0% correct → SLOW_RECOVERY (0 < 35%)
  const attempts = [
    ...retryPair(100, false),
    ...retryPair(80, false),
    ...retryPair(60, false),
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.feedbackRecovery.value, "SLOW_RECOVERY", "0% correct retries → SLOW_RECOVERY");
}

{
  // Wrong but no retry (15min gap) → feedbackRecovery UNKNOWN
  const attempts = [
    makeAttempt(false, 30),
    makeAttempt(true, 14),   // 16 min gap — outside window
  ];
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.value, "RARELY_RETRIES", "no in-window retry → RARELY_RETRIES");
  assertEqual(state.feedbackRecovery.value, "UNKNOWN", "no retries → feedbackRecovery UNKNOWN");
  assertEqual(state.feedbackRecovery.evidence, "No retries detected after wrong answers", "evidence: no retries");
}

// ─────────────────────────────────────────────────────────
// Section 8: Retry window boundary (exactly 10 min)
// ─────────────────────────────────────────────────────────

section("8. Retry window boundary");

{
  // Exactly 10 min = 600,000ms → counts as retry
  const base = new Date(Date.now() - 20 * 60 * 1000);
  const wrongAt = base.toISOString();
  const retryAt = new Date(base.getTime() + 10 * 60 * 1000).toISOString(); // exactly 10 min later
  const attempts = [
    { isCorrect: false, attemptedAt: wrongAt },
    { isCorrect: true, attemptedAt: retryAt },
  ];
  const scan = scanRetryBehavior(attempts);
  assertEqual(scan.retryCount, 1, "exactly 10-min gap counts as retry");
}

{
  // 10 min + 1ms → NOT a retry
  const base = new Date(Date.now() - 20 * 60 * 1000);
  const wrongAt = base.toISOString();
  const retryAt = new Date(base.getTime() + 10 * 60 * 1000 + 1).toISOString();
  const attempts = [
    { isCorrect: false, attemptedAt: wrongAt },
    { isCorrect: true, attemptedAt: retryAt },
  ];
  const scan = scanRetryBehavior(attempts);
  assertEqual(scan.retryCount, 0, "10min+1ms gap is NOT a retry");
}

// ─────────────────────────────────────────────────────────
// Section 9: Help seeking — remedial flag thresholds
// ─────────────────────────────────────────────────────────

section("9. Help seeking — remedial engagement");

{
  // 5 topics, 3 flagged → 60% → ACTIVE_ENGAGEMENT
  const weaknesses = [
    makeWeakness("RECURRING", true),
    makeWeakness("RECURRING", true),
    makeWeakness("IMPROVING", true),
    makeWeakness("RECURRING", false),
    makeWeakness("NO_DATA", false),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.helpSeeking.value, "ACTIVE_ENGAGEMENT", "60% flagged → ACTIVE_ENGAGEMENT");
  assert(state.helpSeeking.evidence.includes("3 of 5"), "evidence includes counts");
}

{
  // 5 topics, 2 flagged → 40% → SOME_ENGAGEMENT
  const weaknesses = [
    makeWeakness("RECURRING", true),
    makeWeakness("IMPROVING", true),
    makeWeakness("RECURRING", false),
    makeWeakness("RECURRING", false),
    makeWeakness("NO_DATA", false),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.helpSeeking.value, "SOME_ENGAGEMENT", "40% flagged → SOME_ENGAGEMENT");
}

{
  // 5 topics, 0 flagged → 0% → LOW_ENGAGEMENT
  const weaknesses = [
    makeWeakness("RECURRING", false),
    makeWeakness("RECURRING", false),
    makeWeakness("IMPROVING", false),
    makeWeakness("NO_DATA", false),
    makeWeakness("IMPROVED", false),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.helpSeeking.value, "LOW_ENGAGEMENT", "0% flagged → LOW_ENGAGEMENT");
}

{
  // 4 topics, 2 flagged → 50% → ACTIVE_ENGAGEMENT (exactly at threshold)
  const weaknesses = [
    makeWeakness("RECURRING", true),
    makeWeakness("IMPROVING", true),
    makeWeakness("RECURRING", false),
    makeWeakness("NO_DATA", false),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.helpSeeking.value, "ACTIVE_ENGAGEMENT", "50% flagged → ACTIVE_ENGAGEMENT (boundary)");
}

{
  // 5 topics, 1 flagged → 20% → SOME_ENGAGEMENT (exactly at threshold)
  const weaknesses = [
    makeWeakness("RECURRING", true),
    makeWeakness("RECURRING", false),
    makeWeakness("IMPROVING", false),
    makeWeakness("NO_DATA", false),
    makeWeakness("IMPROVED", false),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.helpSeeking.value, "SOME_ENGAGEMENT", "20% flagged → SOME_ENGAGEMENT (boundary)");
}

// ─────────────────────────────────────────────────────────
// Section 10: Error correction — signal-based
// ─────────────────────────────────────────────────────────

section("10. Error correction — improvement signals");

{
  // 5 topics with signal: 3 improving, 1 recurring, 1 improved → 4/5 = 80% improving → ERRORS_REDUCING
  const weaknesses = [
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVED"),
    makeWeakness("IMPROVING"),
    makeWeakness("RECURRING"),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.errorCorrection.value, "ERRORS_REDUCING", "80% improving → ERRORS_REDUCING");
  assert(state.errorCorrection.evidence.includes("1 recurring, 4 improving"), "evidence shows counts");
}

{
  // 7 topics: 3 recurring, 4 improving → 43% recurring (<50%), 57% improving (<60%) → ERRORS_STABLE
  // Neither threshold is met: not enough recurring for PERSISTING, not enough improving for REDUCING
  const weaknesses = [
    makeWeakness("RECURRING"),
    makeWeakness("RECURRING"),
    makeWeakness("RECURRING"),
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVED"),
    makeWeakness("IMPROVING"),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.errorCorrection.value, "ERRORS_STABLE", "43%/57% split → ERRORS_STABLE");
}

{
  // 4 topics: 3 recurring, 1 improving → 75% recurring → ERRORS_PERSISTING
  const weaknesses = [
    makeWeakness("RECURRING"),
    makeWeakness("RECURRING"),
    makeWeakness("RECURRING"),
    makeWeakness("IMPROVING"),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.errorCorrection.value, "ERRORS_PERSISTING", "75% recurring → ERRORS_PERSISTING");
  assert(state.errorCorrection.evidence.includes("3 recurring, 1 improving"), "evidence shows counts");
}

{
  // All NO_DATA → UNKNOWN
  const weaknesses = [
    makeWeakness("NO_DATA"),
    makeWeakness("NO_DATA"),
    makeWeakness("NO_DATA"),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.errorCorrection.value, "UNKNOWN", "all NO_DATA → UNKNOWN");
  assertEqual(state.errorCorrection.evidence, "No improvement signal data available",
    "evidence: no signal data");
}

{
  // Exactly 60% improving → ERRORS_REDUCING (boundary)
  const weaknesses = [
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVING"),
    makeWeakness("RECURRING"),
    makeWeakness("RECURRING"),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  assertEqual(state.errorCorrection.value, "ERRORS_REDUCING", "60% improving → ERRORS_REDUCING (boundary)");
}

{
  // Exactly 50% recurring → ERRORS_PERSISTING (boundary)
  const weaknesses = [
    makeWeakness("RECURRING"),
    makeWeakness("RECURRING"),
    makeWeakness("IMPROVING"),
    makeWeakness("IMPROVED"),
  ];
  const state = computeProblemSolvingState([], weaknesses);
  // 2/4 = 50% recurring → ERRORS_PERSISTING; but improvingRate = 50% < 60% so not ERRORS_REDUCING
  assertEqual(state.errorCorrection.value, "ERRORS_PERSISTING", "50% recurring → ERRORS_PERSISTING (boundary)");
}

// ─────────────────────────────────────────────────────────
// Section 11: Confidence tiers
// ─────────────────────────────────────────────────────────

section("11. Confidence tiers");

// Overall confidence from attempt count
{
  assertEqual(deriveOverallConfidenceTier(0), ConfidenceTier.OBSERVED, "0 attempts → OBSERVED");
  assertEqual(deriveOverallConfidenceTier(9), ConfidenceTier.OBSERVED, "9 attempts → OBSERVED");
  assertEqual(deriveOverallConfidenceTier(10), ConfidenceTier.EMERGING, "10 attempts → EMERGING");
  assertEqual(deriveOverallConfidenceTier(49), ConfidenceTier.EMERGING, "49 attempts → EMERGING");
  assertEqual(deriveOverallConfidenceTier(50), ConfidenceTier.CONFIRMED, "50 attempts → CONFIRMED");
  assertEqual(deriveOverallConfidenceTier(100), ConfidenceTier.CONFIRMED, "100 attempts → CONFIRMED");
}

// retryPattern confidence from wrong count
{
  assertEqual(retryConfidenceTier(0), ConfidenceTier.OBSERVED, "0 wrong → OBSERVED");
  assertEqual(retryConfidenceTier(4), ConfidenceTier.OBSERVED, "4 wrong → OBSERVED");
  assertEqual(retryConfidenceTier(5), ConfidenceTier.EMERGING, "5 wrong → EMERGING");
  assertEqual(retryConfidenceTier(19), ConfidenceTier.EMERGING, "19 wrong → EMERGING");
  assertEqual(retryConfidenceTier(20), ConfidenceTier.CONFIRMED, "20 wrong → CONFIRMED");
}

// helpSeeking / errorCorrection confidence from weakness count
{
  assertEqual(weaknessConfidenceTier(0), ConfidenceTier.OBSERVED, "0 weaknesses → OBSERVED");
  assertEqual(weaknessConfidenceTier(2), ConfidenceTier.OBSERVED, "2 weaknesses → OBSERVED");
  assertEqual(weaknessConfidenceTier(3), ConfidenceTier.EMERGING, "3 weaknesses → EMERGING");
  assertEqual(weaknessConfidenceTier(7), ConfidenceTier.EMERGING, "7 weaknesses → EMERGING");
  assertEqual(weaknessConfidenceTier(8), ConfidenceTier.CONFIRMED, "8 weaknesses → CONFIRMED");
}

// End-to-end: 20 wrong attempts → retry confidence CONFIRMED
{
  const attempts = [];
  for (let i = 0; i < 20; i++) {
    attempts.push(...retryPair(i * 15 + 5, i % 3 === 0));
  }
  const state = computeProblemSolvingState(attempts, []);
  assertEqual(state.retryPattern.confidenceTier, ConfidenceTier.CONFIRMED, "20+ wrong → CONFIRMED retry tier");
}

// ─────────────────────────────────────────────────────────
// Section 12: No psychological inference — value labels
// ─────────────────────────────────────────────────────────

section("12. No psychological inference — value labels");

{
  // Verify value labels are behavioral descriptions, not personality traits
  const BEHAVIORAL_VALUES = new Set([
    "FREQUENT_RETRIER", "OCCASIONAL_RETRIER", "RARELY_RETRIES",
    "RECOVERS_QUICKLY", "GRADUAL_RECOVERY", "SLOW_RECOVERY",
    "ACTIVE_ENGAGEMENT", "SOME_ENGAGEMENT", "LOW_ENGAGEMENT",
    "ERRORS_REDUCING", "ERRORS_STABLE", "ERRORS_PERSISTING",
    "UNKNOWN",
  ]);

  // Values that would be psychological labels (must NOT appear)
  const PROHIBITED_VALUES = [
    "PERSISTENT", "MOTIVATED", "RESILIENT", "GRITTY", "DETERMINED",
    "LAZY", "UNMOTIVATED", "DISENGAGED", "STRUGGLING",
    "INTELLIGENT", "CAPABLE", "WEAK",
  ];

  const attempts = [...retryPair(100, true), ...retryPair(80, false)];
  const weaknesses = [makeWeakness("RECURRING", true), makeWeakness("IMPROVING", false)];
  const state = computeProblemSolvingState(attempts, weaknesses);

  const actualValues = [
    state.retryPattern.value,
    state.feedbackRecovery.value,
    state.helpSeeking.value,
    state.errorCorrection.value,
  ];

  for (const v of actualValues) {
    assert(BEHAVIORAL_VALUES.has(v), `value "${v}" is a behavioral label (not a trait)`);
    for (const prohibited of PROHIBITED_VALUES) {
      assert(!v.includes(prohibited), `value "${v}" does not contain prohibited trait label "${prohibited}"`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Section 13: Attempts ordering — scan is order-independent
// ─────────────────────────────────────────────────────────

section("13. Attempt ordering — scan sorts chronologically");

{
  // Provide attempts in reverse order — result should be the same
  const attempts_forward = [
    makeAttempt(false, 10),  // wrong (earlier)
    makeAttempt(true, 5),    // retry (5 min later)
    makeAttempt(false, 1),   // wrong (no retry)
  ];
  const attempts_reversed = [...attempts_forward].reverse();

  const scan_f = scanRetryBehavior(attempts_forward);
  const scan_r = scanRetryBehavior(attempts_reversed);

  assertEqual(scan_f.wrongCount, scan_r.wrongCount, "wrong count independent of input order");
  assertEqual(scan_f.retryCount, scan_r.retryCount, "retry count independent of input order");
  assertEqual(scan_f.correctRetryCount, scan_r.correctRetryCount, "correct retries independent of order");
}

// ─────────────────────────────────────────────────────────
// Section 14: Output structure invariants
// ─────────────────────────────────────────────────────────

section("14. Output structure invariants");

{
  const state = computeProblemSolvingState([], []);
  const dims = ["retryPattern", "feedbackRecovery", "helpSeeking", "errorCorrection"];

  for (const dim of dims) {
    assert(dim in state, `output has ${dim}`);
    assert("value" in state[dim], `${dim} has value`);
    assert("evidence" in state[dim], `${dim} has evidence`);
    assert("confidenceTier" in state[dim], `${dim} has confidenceTier`);
  }
  assert("confidenceTier" in state, "output has top-level confidenceTier");
  assert("computedAt" in state, "output has computedAt");
}

{
  // All value fields are strings (including "UNKNOWN")
  const state = computeProblemSolvingState(
    [...retryPair(100, true)],
    [makeWeakness("RECURRING", true)],
  );
  const dims = ["retryPattern", "feedbackRecovery", "helpSeeking", "errorCorrection"];
  for (const dim of dims) {
    assert(typeof state[dim].value === "string", `${dim}.value is a string`);
  }
}

{
  // ConfidenceTier is one of the three valid values
  const validTiers = new Set(["OBSERVED", "EMERGING", "CONFIRMED"]);
  const state = computeProblemSolvingState(
    [...retryPair(100, true), ...retryPair(80, false)],
    [makeWeakness("IMPROVING", true), makeWeakness("RECURRING", false)],
  );
  const dims = ["retryPattern", "feedbackRecovery", "helpSeeking", "errorCorrection"];
  for (const dim of dims) {
    assert(validTiers.has(state[dim].confidenceTier), `${dim}.confidenceTier is valid`);
  }
  assert(validTiers.has(state.confidenceTier), "top-level confidenceTier is valid");
}

// ─────────────────────────────────────────────────────────
// Section 15: Determinism
// ─────────────────────────────────────────────────────────

section("15. Determinism");

{
  const attempts = [
    ...retryPair(100, true),
    ...retryPair(80, true),
    ...retryPair(60, false),
    makeAttempt(false, 30),
    makeAttempt(true, 10),
  ];
  const weaknesses = [
    makeWeakness("RECURRING", true),
    makeWeakness("IMPROVING", false),
    makeWeakness("IMPROVED", true),
  ];

  const s1 = computeProblemSolvingState(attempts, weaknesses);
  const s2 = computeProblemSolvingState(attempts, weaknesses);

  assertEqual(s1.retryPattern.value, s2.retryPattern.value, "deterministic retryPattern value");
  assertEqual(s1.retryPattern.confidenceTier, s2.retryPattern.confidenceTier, "deterministic retryPattern tier");
  assertEqual(s1.feedbackRecovery.value, s2.feedbackRecovery.value, "deterministic feedbackRecovery value");
  assertEqual(s1.helpSeeking.value, s2.helpSeeking.value, "deterministic helpSeeking value");
  assertEqual(s1.errorCorrection.value, s2.errorCorrection.value, "deterministic errorCorrection value");
  assertEqual(s1.confidenceTier, s2.confidenceTier, "deterministic overall tier");
}

// ─────────────────────────────────────────────────────────
// Section 16: Evidence strings are descriptive when data exists
// ─────────────────────────────────────────────────────────

section("16. Evidence strings when data exists");

{
  const attempts = [...retryPair(100, true), ...retryPair(80, false)];
  const weaknesses = [makeWeakness("RECURRING", true), makeWeakness("IMPROVING", false)];
  const state = computeProblemSolvingState(attempts, weaknesses);

  assert(state.retryPattern.evidence !== null, "retryPattern evidence is not null");
  assert(state.retryPattern.evidence.includes("%"), "retryPattern evidence includes percentage");

  assert(state.feedbackRecovery.evidence !== null, "feedbackRecovery evidence is not null");
  assert(state.feedbackRecovery.evidence.includes("post-error"), "feedbackRecovery evidence is descriptive");

  assert(state.helpSeeking.evidence !== null, "helpSeeking evidence is not null");
  assert(state.helpSeeking.evidence.includes("remediation"), "helpSeeking evidence mentions remediation");

  assert(state.errorCorrection.evidence !== null, "errorCorrection evidence is not null");
  assert(state.errorCorrection.evidence.includes("recurring"), "errorCorrection evidence mentions recurring");
}

// ─────────────────────────────────────────────────────────
// Section 17: Mixed scenario — full learner
// ─────────────────────────────────────────────────────────

section("17. Mixed scenario — full learner state");

{
  // Design targets (all-correct retry pairs to keep wrong count unambiguous):
  //   15 correct retry pairs: 15 wrong initiators + 15 correct retries = 30 attempts
  //   10 lone wrong (each 20+ min gap to next attempt): 10 attempts
  //   10 correct answers (in a distinct time cluster, not near any wrong): 10 attempts
  //   Total = 50 → CONFIRMED overall ✓
  //   wrongCount = 25, retryCount = 15 → retryRate = 60% → FREQUENT_RETRIER ✓
  //   correctRetries = 15/15 = 100% → RECOVERS_QUICKLY ✓
  const attempts = [];
  // 15 correct retry pairs at 15-min intervals (minutesAgo 200–410)
  for (let i = 0; i < 15; i++) {
    attempts.push(...retryPair(i * 15 + 200, true));
  }
  // 10 lone wrong at 25-min intervals (minutesAgo 1–226); far from retry pairs and from each other
  // Each lone wrong next attempt: the next lone wrong is 25 min later, so no retry window overlap
  for (let i = 0; i < 10; i++) {
    attempts.push(makeAttempt(false, i * 25 + 1));
  }
  // 10 correct answers in a distant cluster (minutesAgo 800–1070)
  for (let i = 0; i < 10; i++) {
    attempts.push(makeAttempt(true, i * 30 + 800));
  }

  const weaknesses = [
    makeWeakness("IMPROVING", true),
    makeWeakness("IMPROVED", true),
    makeWeakness("IMPROVING", true),
    makeWeakness("RECURRING", false),
    makeWeakness("IMPROVING", false),
  ];

  const state = computeProblemSolvingState(attempts, weaknesses);

  assertEqual(state.confidenceTier, ConfidenceTier.CONFIRMED, "50 attempts → CONFIRMED overall");
  assertEqual(state.retryPattern.value, "FREQUENT_RETRIER", "15/25 retried → FREQUENT_RETRIER (60%)");
  assertEqual(state.retryPattern.confidenceTier, ConfidenceTier.CONFIRMED, "25 wrong → CONFIRMED retry tier");
  assertEqual(state.feedbackRecovery.value, "RECOVERS_QUICKLY", "15/15 correct retries → RECOVERS_QUICKLY");
  assertEqual(state.helpSeeking.value, "ACTIVE_ENGAGEMENT", "3/5 flagged → ACTIVE_ENGAGEMENT");
  assertEqual(state.errorCorrection.value, "ERRORS_REDUCING", "4/5 improving → ERRORS_REDUCING");
}

// ─────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`M5.4 Problem Solving State: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
