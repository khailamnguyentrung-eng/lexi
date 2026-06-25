/**
 * test-recommendations-v2.mjs
 *
 * Validates mastery-aware computeRecommendations() and confidence helpers.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions from practiceRecommendation.ts (v2).
 *
 * Run: node scripts/test-recommendations-v2.mjs
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

// ── Inlined pure functions ────────────────────────────────────────────────────

function computeNotebookConfidence(s) {
  if (s.improvementSignal === "RECURRING" && s.totalOccurrences >= 3) return "HIGH";
  if (s.isRemedialFlagged && s.entryCount >= 2) return "HIGH";
  if (s.totalOccurrences <= 1 || s.improvementSignal === "NO_DATA") return "LOW";
  return "MEDIUM";
}

function computeWeaknessConfidence(accuracy) {
  if (accuracy < 0.5) return "HIGH";
  if (accuracy < 0.6) return "MEDIUM";
  return "LOW";
}

function computeRecommendations(ctx) {
  const seen = new Set();
  const results = [];
  const stableDueBucket = [];

  function getMastery(topic) {
    return ctx.masteryByTopic?.get(topic);
  }

  // Tier 1: RECURRING_MISTAKE — skip MASTERED and STABLE
  for (const s of ctx.topicSummaries) {
    if (s.improvementSignal !== "RECURRING") continue;
    const m = getMastery(s.topic);
    if (m === "MASTERED" || m === "STABLE") continue;
    if (seen.has(s.topic)) continue;
    seen.add(s.topic);
    results.push({
      topic: s.topic,
      label: s.label,
      reason: "Bạn đã ôn chủ đề này nhưng vẫn cần luyện thêm — thử lại sẽ giúp bạn vững hơn.",
      priority: 1,
      priorityLabel: "RECURRING_MISTAKE",
      suggestedAction: "PRACTICE_TOPIC",
      questionCount: ctx.questionCountByTopic.get(s.topic) ?? 0,
      confidence: computeNotebookConfidence(s),
    });
  }

  // Tier 2: DUE_REVIEW — skip MASTERED, defer STABLE to stableDueBucket
  for (const s of ctx.topicSummaries) {
    if (s.dueCount === 0) continue;
    const m = getMastery(s.topic);
    if (m === "MASTERED") continue;
    if (seen.has(s.topic)) continue;
    const rec = {
      topic: s.topic,
      label: s.label,
      reason: m === "STABLE"
        ? "Chủ đề này đang ổn định — ôn ngắn để giữ vững kiến thức."
        : "Đến lúc ôn lại chủ đề này rồi — đây là lịch ôn hôm nay của bạn.",
      priority: 2,
      priorityLabel: "DUE_REVIEW",
      suggestedAction: "REVIEW_NOTEBOOK",
      questionCount: ctx.questionCountByTopic.get(s.topic) ?? 0,
      confidence: computeNotebookConfidence(s),
    };
    if (m === "STABLE") {
      stableDueBucket.push(rec);
    } else {
      seen.add(s.topic);
      results.push(rec);
    }
  }

  // Tier 3: WEAKNESS_SIGNAL — skip MASTERED, allow STABLE (learning opportunity)
  for (const { topic, label, accuracy } of ctx.weaknessSignalTopics) {
    if (accuracy >= 0.7) continue;
    const m = getMastery(topic);
    if (m === "MASTERED") continue;
    if (seen.has(topic)) continue;
    seen.add(topic);
    const pct = Math.round(accuracy * 100);
    results.push({
      topic,
      label,
      reason: `Bạn trả lời đúng ${pct}% câu hỏi chủ đề này — luyện thêm sẽ giúp bạn vững hơn.`,
      priority: 3,
      priorityLabel: "WEAKNESS_SIGNAL",
      suggestedAction: "PRACTICE_TOPIC",
      questionCount: ctx.questionCountByTopic.get(topic) ?? 0,
      confidence: computeWeaknessConfidence(accuracy),
    });
  }

  // Tier 3.5: STABLE DUE_REVIEW (deferred) — insert after tier 3
  for (const rec of stableDueBucket) {
    if (!seen.has(rec.topic)) {
      seen.add(rec.topic);
      results.push(rec);
    }
  }

  // Tier 4: CURRICULUM_PROGRESS
  if (ctx.nextSessionNumber !== null) {
    const sessionTopic = `session_${ctx.nextSessionNumber}`;
    if (!seen.has(sessionTopic)) {
      results.push({
        topic: sessionTopic,
        label: ctx.nextSessionTitle ?? `Buổi ${ctx.nextSessionNumber}`,
        reason: "Tiếp tục lộ trình — buổi học tiếp theo đang chờ bạn.",
        priority: 4,
        priorityLabel: "CURRICULUM_PROGRESS",
        suggestedAction: "ADVANCE_SESSION",
        questionCount: 0,
        sessionNumber: ctx.nextSessionNumber,
        confidence: "MEDIUM",
      });
    }
  }

  return results.slice(0, 4);
}

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeSummary(overrides) {
  return {
    topic: "default",
    label: "Default",
    improvementSignal: "NO_DATA",
    dueCount: 0,
    entryCount: 1,
    totalOccurrences: 2,
    isRemedialFlagged: false,
    maxReviewStage: 0,
    postReviewAccuracy: null,
    ...overrides,
  };
}

function emptyCtx(overrides) {
  return {
    topicSummaries: [],
    weaknessSignalTopics: [],
    nextSessionNumber: null,
    nextSessionTitle: null,
    questionCountByTopic: new Map(),
    masteryByTopic: new Map(),
    ...overrides,
  };
}

// ── MASTERED: removed from all active tiers ───────────────────────────────────

console.log("\nMastered — removed from RECURRING_MISTAKE (tier 1)");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "RECURRING", totalOccurrences: 4 }),
    ],
    masteryByTopic: new Map([["conditionals", "MASTERED"]]),
    nextSessionNumber: 5,
    nextSessionTitle: "Session 5",
  });
  const recs = computeRecommendations(ctx);
  assert(
    "MASTERED RECURRING topic does not appear in tier 1",
    recs.every(r => r.topic !== "conditionals"),
    `got ${recs.map(r => r.topic).join(", ")}`
  );
  assert(
    "Falls back to CURRICULUM_PROGRESS only",
    recs.length === 1 && recs[0].priorityLabel === "CURRICULUM_PROGRESS"
  );
}

console.log("\nMastered — removed from DUE_REVIEW (tier 2)");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "passive_voice", label: "Passive Voice", dueCount: 3 }),
    ],
    masteryByTopic: new Map([["passive_voice", "MASTERED"]]),
  });
  const recs = computeRecommendations(ctx);
  assert(
    "MASTERED topic with dueCount does not appear",
    recs.length === 0,
    `got ${recs.map(r => r.topic).join(", ")}`
  );
}

console.log("\nMastered — removed from WEAKNESS_SIGNAL (tier 3)");
{
  const ctx = emptyCtx({
    weaknessSignalTopics: [{ topic: "tenses", label: "Tenses", accuracy: 0.4 }],
    masteryByTopic: new Map([["tenses", "MASTERED"]]),
  });
  const recs = computeRecommendations(ctx);
  assert(
    "MASTERED topic with low accuracy does not appear",
    recs.length === 0,
    `got ${recs.map(r => r.topic).join(", ")}`
  );
}

console.log("\nMastered — non-mastered topics unaffected");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "mastered_one", label: "M1", improvementSignal: "RECURRING", totalOccurrences: 5 }),
      makeSummary({ topic: "active_one",   label: "A1", improvementSignal: "RECURRING", totalOccurrences: 3 }),
    ],
    masteryByTopic: new Map([
      ["mastered_one", "MASTERED"],
      ["active_one",   "NEEDS_REVIEW"],
    ]),
  });
  const recs = computeRecommendations(ctx);
  assert("Only the NEEDS_REVIEW RECURRING topic appears", recs.length === 1);
  assert("Correct topic selected", recs[0].topic === "active_one");
  assert("Correct priority", recs[0].priorityLabel === "RECURRING_MISTAKE");
}

// ── STABLE: not shown as RECURRING_MISTAKE ────────────────────────────────────

console.log("\nStable — removed from RECURRING_MISTAKE (tier 1)");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "RECURRING", totalOccurrences: 4 }),
    ],
    masteryByTopic: new Map([["conditionals", "STABLE"]]),
    nextSessionNumber: 3,
    nextSessionTitle: "Session 3",
  });
  const recs = computeRecommendations(ctx);
  assert(
    "STABLE RECURRING topic does not appear in tier 1",
    recs.every(r => r.priorityLabel !== "RECURRING_MISTAKE"),
    `got ${recs.map(r => r.priorityLabel).join(", ")}`
  );
}

console.log("\nStable — DUE_REVIEW deferred to after tier 3");
{
  const stableSummary = makeSummary({ topic: "modals", label: "Modals", dueCount: 2 });
  const ctx = emptyCtx({
    topicSummaries: [stableSummary],
    weaknessSignalTopics: [{ topic: "gerunds", label: "Gerunds", accuracy: 0.45 }],
    masteryByTopic: new Map([
      ["modals",  "STABLE"],
      ["gerunds", "NEEDS_REVIEW"],
    ]),
    questionCountByTopic: new Map([["gerunds", 5]]),
  });
  const recs = computeRecommendations(ctx);
  assert("Returns 2 recommendations", recs.length === 2, `got ${recs.length}`);
  assert("Tier 3 WEAKNESS_SIGNAL appears first", recs[0].priorityLabel === "WEAKNESS_SIGNAL");
  assert("Deferred STABLE DUE_REVIEW appears after tier 3", recs[1].priorityLabel === "DUE_REVIEW");
  assert("Deferred item is for the STABLE topic", recs[1].topic === "modals");
}

console.log("\nStable — WEAKNESS_SIGNAL beats deferred DUE_REVIEW for same topic");
{
  // STABLE topic has BOTH dueCount > 0 (would be deferred) AND low accuracy (tier 3)
  // WEAKNESS_SIGNAL (PRACTICE_TOPIC) should win since it's more actionable.
  const stableSummary = makeSummary({ topic: "conditionals", label: "Conditionals", dueCount: 1 });
  const ctx = emptyCtx({
    topicSummaries: [stableSummary],
    weaknessSignalTopics: [{ topic: "conditionals", label: "Conditionals", accuracy: 0.5 }],
    masteryByTopic: new Map([["conditionals", "STABLE"]]),
  });
  const recs = computeRecommendations(ctx);
  assert("Returns exactly 1 recommendation (no duplicate)", recs.length === 1);
  assert(
    "WEAKNESS_SIGNAL (PRACTICE_TOPIC) wins over deferred DUE_REVIEW for STABLE topic",
    recs[0].priorityLabel === "WEAKNESS_SIGNAL",
    `got ${recs[0].priorityLabel}`
  );
  assert("Action is PRACTICE_TOPIC", recs[0].suggestedAction === "PRACTICE_TOPIC");
}

console.log("\nStable — kept as learning opportunity in tier 3");
{
  const ctx = emptyCtx({
    weaknessSignalTopics: [{ topic: "tenses", label: "Tenses", accuracy: 0.55 }],
    masteryByTopic: new Map([["tenses", "STABLE"]]),
  });
  const recs = computeRecommendations(ctx);
  assert("STABLE topic appears in tier 3 WEAKNESS_SIGNAL", recs.length === 1);
  assert("Priority is WEAKNESS_SIGNAL", recs[0].priorityLabel === "WEAKNESS_SIGNAL");
}

// ── IMPROVING / NEEDS_REVIEW: full priority unchanged ─────────────────────────

console.log("\nImproving — keeps full priority in all tiers");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "articles", label: "Articles", improvementSignal: "RECURRING", totalOccurrences: 3 }),
    ],
    masteryByTopic: new Map([["articles", "IMPROVING"]]),
  });
  const recs = computeRecommendations(ctx);
  assert("IMPROVING RECURRING topic appears in tier 1", recs.length === 1);
  assert("Priority is RECURRING_MISTAKE", recs[0].priorityLabel === "RECURRING_MISTAKE");
}

console.log("\nNeeds review — keeps full priority in all tiers");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "articles", label: "Articles", improvementSignal: "RECURRING", totalOccurrences: 3 }),
    ],
    masteryByTopic: new Map([["articles", "NEEDS_REVIEW"]]),
  });
  const recs = computeRecommendations(ctx);
  assert("NEEDS_REVIEW RECURRING topic appears in tier 1", recs.length === 1);
  assert("Priority is RECURRING_MISTAKE", recs[0].priorityLabel === "RECURRING_MISTAKE");
}

// ── RECURRING still highest when competing with other signals ─────────────────

console.log("\nRecurring beats DUE_REVIEW and WEAKNESS_SIGNAL for same priority ordering");
{
  const ctx = {
    topicSummaries: [
      makeSummary({ topic: "recurring_a", label: "Recurring A", improvementSignal: "RECURRING", totalOccurrences: 4 }),
      makeSummary({ topic: "due_b",       label: "Due B",       improvementSignal: "NO_DATA",   dueCount: 2 }),
    ],
    weaknessSignalTopics: [{ topic: "weak_c", label: "Weak C", accuracy: 0.4 }],
    nextSessionNumber: 7,
    nextSessionTitle: "Session 7",
    questionCountByTopic: new Map([["recurring_a", 5], ["due_b", 3], ["weak_c", 4]]),
    masteryByTopic: new Map([
      ["recurring_a", "NEEDS_REVIEW"],
      ["due_b",       "NEEDS_REVIEW"],
      ["weak_c",      "NEEDS_REVIEW"],
    ]),
  };
  const recs = computeRecommendations(ctx);
  assert("All 4 recommendations returned", recs.length === 4);
  assert("Tier 1 is RECURRING_MISTAKE", recs[0].priorityLabel === "RECURRING_MISTAKE");
  assert("Tier 2 is DUE_REVIEW",        recs[1].priorityLabel === "DUE_REVIEW");
  assert("Tier 3 is WEAKNESS_SIGNAL",   recs[2].priorityLabel === "WEAKNESS_SIGNAL");
  assert("Tier 4 is CURRICULUM_PROGRESS", recs[3].priorityLabel === "CURRICULUM_PROGRESS");
}

console.log("\nRecurring + STABLE filtered: non-STABLE recurring still wins");
{
  const ctx = emptyCtx({
    topicSummaries: [
      makeSummary({ topic: "stable_recurring",  label: "Stable R",  improvementSignal: "RECURRING", totalOccurrences: 5 }),
      makeSummary({ topic: "active_recurring",  label: "Active R",  improvementSignal: "RECURRING", totalOccurrences: 3 }),
      makeSummary({ topic: "due_normal",        label: "Due N",     improvementSignal: "NO_DATA", dueCount: 1 }),
    ],
    masteryByTopic: new Map([
      ["stable_recurring",  "STABLE"],
      ["active_recurring",  "NEEDS_REVIEW"],
      ["due_normal",        "NEEDS_REVIEW"],
    ]),
  });
  const recs = computeRecommendations(ctx);
  assert("First recommendation is the non-STABLE RECURRING topic", recs[0].topic === "active_recurring");
  assert("First recommendation is RECURRING_MISTAKE", recs[0].priorityLabel === "RECURRING_MISTAKE");
  assert("STABLE recurring topic does not appear in tier 1", recs.every(r => !(r.topic === "stable_recurring" && r.priorityLabel === "RECURRING_MISTAKE")));
}

// ── Confidence — notebook evidence ────────────────────────────────────────────

console.log("\nConfidence — notebook evidence (computeNotebookConfidence)");
{
  // HIGH: RECURRING + 3+ occurrences
  {
    const s = makeSummary({ improvementSignal: "RECURRING", totalOccurrences: 3 });
    assert("RECURRING + 3 occurrences → HIGH", computeNotebookConfidence(s) === "HIGH");
  }
  {
    const s = makeSummary({ improvementSignal: "RECURRING", totalOccurrences: 5 });
    assert("RECURRING + 5 occurrences → HIGH", computeNotebookConfidence(s) === "HIGH");
  }
  // HIGH: remedial-flagged + 2+ entries
  {
    const s = makeSummary({ isRemedialFlagged: true, entryCount: 2, improvementSignal: "IMPROVING", totalOccurrences: 2 });
    assert("Remedial + 2 entries → HIGH", computeNotebookConfidence(s) === "HIGH");
  }
  // LOW: single occurrence
  {
    const s = makeSummary({ totalOccurrences: 1, improvementSignal: "IMPROVING" });
    assert("totalOccurrences = 1 → LOW", computeNotebookConfidence(s) === "LOW");
  }
  // LOW: NO_DATA signal
  {
    const s = makeSummary({ improvementSignal: "NO_DATA", totalOccurrences: 3 });
    assert("NO_DATA signal → LOW", computeNotebookConfidence(s) === "LOW");
  }
  // MEDIUM: moderate evidence
  {
    const s = makeSummary({ improvementSignal: "IMPROVING", totalOccurrences: 2 });
    assert("IMPROVING + 2 occurrences → MEDIUM", computeNotebookConfidence(s) === "MEDIUM");
  }
  {
    const s = makeSummary({ improvementSignal: "IMPROVED", totalOccurrences: 4 });
    assert("IMPROVED + 4 occurrences → MEDIUM", computeNotebookConfidence(s) === "MEDIUM");
  }
  // RECURRING but < 3 occurrences → MEDIUM
  {
    const s = makeSummary({ improvementSignal: "RECURRING", totalOccurrences: 2 });
    assert("RECURRING + 2 occurrences → MEDIUM (not yet HIGH)", computeNotebookConfidence(s) === "MEDIUM");
  }
}

// ── Confidence — weakness signal ──────────────────────────────────────────────

console.log("\nConfidence — weakness accuracy (computeWeaknessConfidence)");
{
  assert("accuracy 0.40 → HIGH",  computeWeaknessConfidence(0.40) === "HIGH");
  assert("accuracy 0.49 → HIGH",  computeWeaknessConfidence(0.49) === "HIGH");
  assert("accuracy 0.50 → MEDIUM", computeWeaknessConfidence(0.50) === "MEDIUM");
  assert("accuracy 0.55 → MEDIUM", computeWeaknessConfidence(0.55) === "MEDIUM");
  assert("accuracy 0.59 → MEDIUM", computeWeaknessConfidence(0.59) === "MEDIUM");
  assert("accuracy 0.60 → LOW",   computeWeaknessConfidence(0.60) === "LOW");
  assert("accuracy 0.68 → LOW",   computeWeaknessConfidence(0.68) === "LOW");
}

// ── Confidence — attached to recommendations ──────────────────────────────────

console.log("\nConfidence — attached to each recommendation");
{
  // HIGH confidence RECURRING
  const highSummary = makeSummary({ topic: "articles", label: "Articles", improvementSignal: "RECURRING", totalOccurrences: 4 });
  const ctx1 = emptyCtx({ topicSummaries: [highSummary] });
  const recs1 = computeRecommendations(ctx1);
  assert("RECURRING + 4 occurrences → HIGH confidence on recommendation", recs1[0].confidence === "HIGH");

  // HIGH confidence weakness
  const ctx2 = emptyCtx({ weaknessSignalTopics: [{ topic: "tenses", label: "Tenses", accuracy: 0.35 }] });
  const recs2 = computeRecommendations(ctx2);
  assert("Weakness accuracy 0.35 → HIGH confidence on recommendation", recs2[0].confidence === "HIGH");

  // LOW confidence weakness
  const ctx3 = emptyCtx({ weaknessSignalTopics: [{ topic: "prepositions", label: "Prepositions", accuracy: 0.65 }] });
  const recs3 = computeRecommendations(ctx3);
  assert("Weakness accuracy 0.65 → LOW confidence on recommendation", recs3[0].confidence === "LOW");

  // MEDIUM for curriculum progress
  const ctx4 = emptyCtx({ nextSessionNumber: 5, nextSessionTitle: "Session 5" });
  const recs4 = computeRecommendations(ctx4);
  assert("CURRICULUM_PROGRESS → MEDIUM confidence", recs4[0].confidence === "MEDIUM");
}

// ── Backward compatibility: no masteryByTopic behaves like v1 ─────────────────

console.log("\nBackward compatibility — no masteryByTopic (v1 behavior preserved)");
{
  const ctx = {
    topicSummaries: [
      makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "RECURRING", totalOccurrences: 4 }),
    ],
    weaknessSignalTopics: [],
    nextSessionNumber: null,
    nextSessionTitle: null,
    questionCountByTopic: new Map(),
    // masteryByTopic intentionally absent
  };
  const recs = computeRecommendations(ctx);
  assert("Without masteryByTopic, RECURRING topic appears normally", recs.length === 1);
  assert("Correct priority", recs[0].priorityLabel === "RECURRING_MISTAKE");
}

{
  const ctx = {
    topicSummaries: [makeSummary({ topic: "tenses", label: "Tenses", dueCount: 2 })],
    weaknessSignalTopics: [],
    nextSessionNumber: null,
    nextSessionTitle: null,
    questionCountByTopic: new Map(),
    masteryByTopic: undefined,
  };
  const recs = computeRecommendations(ctx);
  assert("masteryByTopic=undefined: DUE_REVIEW topic appears normally", recs.length === 1);
  assert("DUE_REVIEW priority", recs[0].priorityLabel === "DUE_REVIEW");
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed${failed > 0 ? `, ${failed} FAILED` : ""}\n`);
if (failed > 0) process.exit(1);
