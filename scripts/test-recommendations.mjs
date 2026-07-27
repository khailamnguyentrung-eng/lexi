/**
 * test-recommendations.mjs
 *
 * Validates computeRecommendations() and buildQuestionCountMap() logic.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions from practiceRecommendation.ts.
 *
 * Run: node scripts/test-recommendations.mjs
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

// ── Inlined pure functions (mirrors practiceRecommendation.ts) ────────────────

function canonicalTopic(raw) {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  // Minimal alias map for tests
  const ALIASES = { conditional: "conditionals" };
  return ALIASES[normalized] ?? normalized;
}

function buildQuestionCountMap(rawTopics) {
  const map = new Map();
  for (const raw of rawTopics) {
    const canonical = canonicalTopic(raw);
    map.set(canonical, (map.get(canonical) ?? 0) + 1);
  }
  return map;
}

function computeRecommendations(ctx) {
  const seen = new Set();
  const results = [];

  // Tier 1: RECURRING_MISTAKE
  for (const s of ctx.topicSummaries) {
    if (s.improvementSignal !== "RECURRING") continue;
    if (seen.has(s.topic)) continue;
    seen.add(s.topic);
    results.push({
      topic: s.topic,
      label: s.label,
      reason: "Bạn đã ôn chủ đề này nhưng vẫn cần luyện thêm.",
      priority: 1,
      priorityLabel: "RECURRING_MISTAKE",
      suggestedAction: "PRACTICE_TOPIC",
      questionCount: ctx.questionCountByTopic.get(s.topic) ?? 0,
    });
  }

  // Tier 2: DUE_REVIEW
  for (const s of ctx.topicSummaries) {
    if (s.dueCount === 0) continue;
    if (seen.has(s.topic)) continue;
    seen.add(s.topic);
    results.push({
      topic: s.topic,
      label: s.label,
      reason: "Đến lúc ôn lại chủ đề này rồi.",
      priority: 2,
      priorityLabel: "DUE_REVIEW",
      suggestedAction: "REVIEW_NOTEBOOK",
      questionCount: ctx.questionCountByTopic.get(s.topic) ?? 0,
    });
  }

  // Tier 3: WEAKNESS_SIGNAL (accuracy < 0.7 only)
  for (const { topic, label, accuracy } of ctx.weaknessSignalTopics) {
    if (accuracy >= 0.7) continue;
    if (seen.has(topic)) continue;
    seen.add(topic);
    const pct = Math.round(accuracy * 100);
    results.push({
      topic,
      label,
      reason: `Bạn trả lời đúng ${pct}% câu hỏi chủ đề này.`,
      priority: 3,
      priorityLabel: "WEAKNESS_SIGNAL",
      suggestedAction: "PRACTICE_TOPIC",
      questionCount: ctx.questionCountByTopic.get(topic) ?? 0,
    });
  }

  // Tier 4: CURRICULUM_PROGRESS
  if (ctx.nextMission !== null) {
    const missionTopic = `program_slot_${ctx.nextMission.order}`;
    if (!seen.has(missionTopic)) {
      results.push({
        topic: missionTopic,
        label: ctx.nextMission.title,
        reason: "Tiếp tục lộ trình.",
        priority: 4,
        priorityLabel: "CURRICULUM_PROGRESS",
        suggestedAction: "ADVANCE_SESSION",
        questionCount: 0,
        mission: ctx.nextMission,
      });
    }
  }

  return results.slice(0, 4);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSummary(overrides) {
  return {
    topic: "default",
    label: "Default",
    improvementSignal: "NO_DATA",
    dueCount: 0,
    ...overrides,
  };
}

function emptyCtx(overrides) {
  return {
    topicSummaries: [],
    weaknessSignalTopics: [],
    nextMission: null,
    questionCountByTopic: new Map(),
    ...overrides,
  };
}

// ── Test 1: RECURRING beats WEAKNESS_SIGNAL (deduplication) ──────────────────

console.log("\nTest 1: RECURRING_MISTAKE beats WEAKNESS_SIGNAL for same topic");
{
  const ctx = emptyCtx({
    topicSummaries: [makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "RECURRING" })],
    weaknessSignalTopics: [{ topic: "conditionals", label: "Conditionals", accuracy: 0.4 }],
  });
  const recs = computeRecommendations(ctx);
  assert("Returns exactly 1 recommendation", recs.length === 1);
  assert("Recommendation is RECURRING_MISTAKE (not WEAKNESS_SIGNAL)", recs[0].priorityLabel === "RECURRING_MISTAKE");
  assert("Action is PRACTICE_TOPIC", recs[0].suggestedAction === "PRACTICE_TOPIC");
}

// ── Test 2: DUE_REVIEW works ─────────────────────────────────────────────────

console.log("\nTest 2: DUE_REVIEW recommendation");
{
  const ctx = emptyCtx({
    topicSummaries: [makeSummary({ topic: "passive_voice", label: "Passive Voice", improvementSignal: "NO_DATA", dueCount: 3 })],
    questionCountByTopic: new Map([["passive_voice", 8]]),
  });
  const recs = computeRecommendations(ctx);
  assert("Returns 1 recommendation", recs.length === 1);
  assert("Priority is DUE_REVIEW", recs[0].priorityLabel === "DUE_REVIEW");
  assert("Action is REVIEW_NOTEBOOK", recs[0].suggestedAction === "REVIEW_NOTEBOOK");
  assert("Question count is provided", recs[0].questionCount === 8);
}

// ── Test 3: CURRICULUM_PROGRESS fallback ─────────────────────────────────────

console.log("\nTest 3: CURRICULUM_PROGRESS fallback when no other signals");
{
  const ctx = emptyCtx({ nextMission: { programSlug: "test-program", order: 7, title: "Câu điều kiện nâng cao", objective: null } });
  const recs = computeRecommendations(ctx);
  assert("Returns 1 recommendation", recs.length === 1);
  assert("Priority is CURRICULUM_PROGRESS", recs[0].priorityLabel === "CURRICULUM_PROGRESS");
  assert("Action is ADVANCE_SESSION", recs[0].suggestedAction === "ADVANCE_SESSION");
  assert("Session number is correct", recs[0].mission?.order === 7);
  assert("Label uses session title", recs[0].label === "Câu điều kiện nâng cao");
}

// ── Test 4: DUE_REVIEW topic not repeated at WEAKNESS tier ───────────────────

console.log("\nTest 4: DUE_REVIEW topic not repeated at WEAKNESS_SIGNAL tier");
{
  const ctx = emptyCtx({
    topicSummaries: [makeSummary({ topic: "tenses", label: "Tenses", improvementSignal: "IMPROVING", dueCount: 2 })],
    weaknessSignalTopics: [{ topic: "tenses", label: "Tenses", accuracy: 0.5 }],
  });
  const recs = computeRecommendations(ctx);
  assert("Returns exactly 1 recommendation (no duplicate)", recs.length === 1);
  assert("DUE_REVIEW takes precedence over WEAKNESS_SIGNAL", recs[0].priorityLabel === "DUE_REVIEW");
}

// ── Test 5: RECURRING also has dueCount — only tier 1 ────────────────────────

console.log("\nTest 5: RECURRING topic with dueCount appears only at tier 1");
{
  const ctx = emptyCtx({
    topicSummaries: [makeSummary({ topic: "both", label: "Both", improvementSignal: "RECURRING", dueCount: 2 })],
  });
  const recs = computeRecommendations(ctx);
  assert("Returns exactly 1 recommendation", recs.length === 1);
  assert("RECURRING_MISTAKE wins over DUE_REVIEW for same topic", recs[0].priorityLabel === "RECURRING_MISTAKE");
}

// ── Test 6: No next session → no CURRICULUM_PROGRESS ─────────────────────────

console.log("\nTest 6: No next session → no CURRICULUM_PROGRESS entry");
{
  const ctx = emptyCtx({ nextMission: null });
  const recs = computeRecommendations(ctx);
  assert("Empty recommendations when no signals and no session", recs.length === 0);
}

// ── Test 7: WEAKNESS_SIGNAL with accuracy ≥ 0.7 is excluded ──────────────────

console.log("\nTest 7: WEAKNESS_SIGNAL with accuracy >= 0.7 is skipped");
{
  const ctx = emptyCtx({
    weaknessSignalTopics: [
      { topic: "good_topic", label: "Good Topic", accuracy: 0.70 },
      { topic: "also_fine", label: "Also Fine",   accuracy: 0.85 },
    ],
    nextMission: null,
  });
  const recs = computeRecommendations(ctx);
  assert("High-accuracy weakness signals produce no recommendations", recs.length === 0);
}

// ── Test 8: All 4 tiers in correct priority order ────────────────────────────

console.log("\nTest 8: All 4 tiers produced in correct order");
{
  const ctx = {
    topicSummaries: [
      makeSummary({ topic: "hard",    label: "Hard",    improvementSignal: "RECURRING", dueCount: 0 }),
      makeSummary({ topic: "due_one", label: "Due One", improvementSignal: "NO_DATA",   dueCount: 1 }),
    ],
    weaknessSignalTopics: [{ topic: "weak", label: "Weak", accuracy: 0.4 }],
    nextMission: { programSlug: "test-program", order: 3, title: "Session Three", objective: null },
    questionCountByTopic: new Map([["hard", 5], ["due_one", 3], ["weak", 4]]),
  };
  const recs = computeRecommendations(ctx);
  assert("All 4 tiers produced", recs.length === 4);
  assert("Tier 1 is RECURRING_MISTAKE", recs[0].priorityLabel === "RECURRING_MISTAKE");
  assert("Tier 2 is DUE_REVIEW",        recs[1].priorityLabel === "DUE_REVIEW");
  assert("Tier 3 is WEAKNESS_SIGNAL",   recs[2].priorityLabel === "WEAKNESS_SIGNAL");
  assert("Tier 4 is CURRICULUM_PROGRESS", recs[3].priorityLabel === "CURRICULUM_PROGRESS");
}

// ── Test 9: Maximum 4 recommendations cap ────────────────────────────────────

console.log("\nTest 9: Maximum 4 recommendations returned (cap enforced)");
{
  const ctx = {
    topicSummaries: [
      makeSummary({ topic: "a", label: "A", improvementSignal: "RECURRING", dueCount: 0 }),
      makeSummary({ topic: "b", label: "B", improvementSignal: "RECURRING", dueCount: 0 }),
      makeSummary({ topic: "c", label: "C", improvementSignal: "NO_DATA",   dueCount: 1 }),
      makeSummary({ topic: "d", label: "D", improvementSignal: "NO_DATA",   dueCount: 1 }),
    ],
    weaknessSignalTopics: [{ topic: "e", label: "E", accuracy: 0.3 }],
    nextMission: { programSlug: "test-program", order: 5, title: "Session 5", objective: null },
    questionCountByTopic: new Map([["a", 3], ["b", 3], ["c", 3], ["d", 3], ["e", 3]]),
  };
  const recs = computeRecommendations(ctx);
  assert("Capped at 4 even when 5 signals exist", recs.length === 4);
}

// ── Test 10: No signals at all with a session → only CURRICULUM_PROGRESS ─────

console.log("\nTest 10: Empty signals + session → only CURRICULUM_PROGRESS");
{
  const ctx = emptyCtx({ nextMission: { programSlug: "test-program", order: 1, title: "Buổi 1", objective: null } });
  const recs = computeRecommendations(ctx);
  assert("Returns 1 recommendation", recs.length === 1);
  assert("Is CURRICULUM_PROGRESS", recs[0].priorityLabel === "CURRICULUM_PROGRESS");
}

// ── buildQuestionCountMap tests ───────────────────────────────────────────────

console.log("\nTest 11: buildQuestionCountMap — basic counting");
{
  const map = buildQuestionCountMap(["conditionals", "conditionals", "passive_voice"]);
  assert("Counts repeated topic correctly", map.get("conditionals") === 2);
  assert("Counts unique topic correctly",   map.get("passive_voice") === 1);
}

console.log("\nTest 12: buildQuestionCountMap — canonicalization (uppercase)");
{
  const map = buildQuestionCountMap(["CONDITIONALS", "conditionals", "Conditionals"]);
  assert("All 3 uppercase variants canonicalize to same key", map.get("conditionals") === 3);
}

console.log("\nTest 13: buildQuestionCountMap — spaces normalize to underscores");
{
  const map = buildQuestionCountMap(["passive voice", "passive_voice", "PASSIVE VOICE"]);
  assert("Space-separated and underscore forms count together", map.get("passive_voice") === 3);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed${failed > 0 ? `, ${failed} FAILED` : ""}\n`);
if (failed > 0) process.exit(1);
