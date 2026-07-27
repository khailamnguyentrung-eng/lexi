/**
 * test-learning-profile.mjs
 *
 * Validates pure functions from studentLearningProfile.ts.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions under test.
 *
 * Run: node scripts/test-learning-profile.mjs
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

function countByMasteryState(profiles) {
  const counts = { NEEDS_REVIEW: 0, IMPROVING: 0, STABLE: 0, MASTERED: 0 };
  for (const p of profiles) counts[p.masteryState] += 1;
  return counts;
}

function buildMasterySummary(profiles) {
  const byState = countByMasteryState(profiles);
  return {
    totalTopics: profiles.length,
    byState,
    masteredTopics: profiles.filter(p => p.masteryState === "MASTERED").map(p => p.label),
    needsReviewTopics: profiles.filter(p => p.masteryState === "NEEDS_REVIEW").map(p => p.label).slice(0, 5),
  };
}

function buildActiveWeaknesses(summaries, masteryByTopic) {
  const weaknesses = [];
  for (const s of summaries) {
    if (weaknesses.length >= 5) break;
    const masteryState = masteryByTopic.get(s.topic) ?? "NEEDS_REVIEW";
    if (masteryState === "MASTERED") continue;
    if (s.improvementSignal === "RECURRING" || masteryState === "NEEDS_REVIEW") {
      weaknesses.push({
        topic: s.topic,
        label: s.label,
        signal: s.improvementSignal,
        isRemedialFlagged: s.isRemedialFlagged,
        dueCount: s.dueCount,
        masteryState,
        totalOccurrences: s.totalOccurrences,
      });
    }
  }
  return weaknesses;
}

function deriveLearningTrend(profiles, recurringCount) {
  if (profiles.length === 0) return "INSUFFICIENT_DATA";
  const counts = countByMasteryState(profiles);
  const positiveCount = counts.MASTERED + counts.STABLE + counts.IMPROVING;
  if (recurringCount > 0 || counts.NEEDS_REVIEW > positiveCount) return "NEEDS_ATTENTION";
  if (counts.MASTERED > 0 || counts.IMPROVING >= counts.NEEDS_REVIEW) return "PROGRESSING";
  return "STABLE";
}

function buildLearningProfile(ctx) {
  const masterySummary = buildMasterySummary(ctx.masteryProfiles);
  const recurringCount = ctx.topicSummaries.filter(s => s.improvementSignal === "RECURRING").length;
  const learningTrend = deriveLearningTrend(ctx.masteryProfiles, recurringCount);
  const activeWeaknesses = buildActiveWeaknesses(ctx.topicSummaries, ctx.masteryByTopic);
  const improvingTopics = ctx.masteryProfiles.filter(
    p => p.masteryState === "IMPROVING" || p.masteryState === "STABLE"
  );
  return {
    userId: ctx.userId,
    generatedAt: ctx.generatedAt,
    readiness: ctx.readiness,
    masterySummary,
    skillSnapshot: ctx.skillSnapshot,
    learningTrend,
    improvingTopics,
    activeWeaknesses,
    recommendations: ctx.recommendations,
    nextMission: ctx.nextMission,
  };
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
    masteredCount: 0,
    lastReviewedAt: new Date("2026-06-20"),
    ...overrides,
  };
}

function makeProfile(topic, label, masteryState, summaryOverrides) {
  return {
    topic,
    label,
    masteryState,
    summary: makeSummary({ topic, label, ...summaryOverrides }),
  };
}

function emptyCtx(overrides) {
  return {
    userId: "user_test",
    generatedAt: "2026-06-25T10:00:00.000Z",
    topicSummaries: [],
    masteryProfiles: [],
    masteryByTopic: new Map(),
    recommendations: [],
    readiness: null,
    skillSnapshot: [],
    nextMission: null,
    ...overrides,
  };
}

// ── buildMasterySummary ───────────────────────────────────────────────────────

console.log("\nbuildMasterySummary — basic counts");
{
  const profiles = [
    makeProfile("conditionals", "Conditionals", "MASTERED"),
    makeProfile("tenses",       "Tenses",       "STABLE"),
    makeProfile("modals",       "Modals",        "IMPROVING"),
    makeProfile("articles",     "Articles",      "NEEDS_REVIEW"),
    makeProfile("prepositions", "Prepositions",  "NEEDS_REVIEW"),
  ];
  const summary = buildMasterySummary(profiles);
  assert("totalTopics = 5",           summary.totalTopics === 5);
  assert("MASTERED count = 1",        summary.byState.MASTERED === 1);
  assert("STABLE count = 1",          summary.byState.STABLE === 1);
  assert("IMPROVING count = 1",       summary.byState.IMPROVING === 1);
  assert("NEEDS_REVIEW count = 2",    summary.byState.NEEDS_REVIEW === 2);
  assert("masteredTopics includes Conditionals", summary.masteredTopics.includes("Conditionals"));
  assert("needsReviewTopics includes Articles",  summary.needsReviewTopics.includes("Articles"));
  assert("needsReviewTopics includes Prepositions", summary.needsReviewTopics.includes("Prepositions"));
}

console.log("\nbuildMasterySummary — empty profiles");
{
  const summary = buildMasterySummary([]);
  assert("totalTopics = 0",      summary.totalTopics === 0);
  assert("all states = 0",       Object.values(summary.byState).every(n => n === 0));
  assert("masteredTopics empty", summary.masteredTopics.length === 0);
  assert("needsReview empty",    summary.needsReviewTopics.length === 0);
}

console.log("\nbuildMasterySummary — needsReviewTopics capped at 5");
{
  const profiles = Array.from({ length: 7 }, (_, i) =>
    makeProfile(`topic_${i}`, `Topic ${i}`, "NEEDS_REVIEW")
  );
  const summary = buildMasterySummary(profiles);
  assert("NEEDS_REVIEW byState = 7",     summary.byState.NEEDS_REVIEW === 7);
  assert("needsReviewTopics capped at 5", summary.needsReviewTopics.length === 5);
}

// ── buildActiveWeaknesses ─────────────────────────────────────────────────────

console.log("\nbuildActiveWeaknesses — RECURRING topics included");
{
  const summaries = [
    makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "RECURRING", totalOccurrences: 4 }),
  ];
  const masteryByTopic = new Map([["conditionals", "NEEDS_REVIEW"]]);
  const weaknesses = buildActiveWeaknesses(summaries, masteryByTopic);
  assert("RECURRING topic is a weakness",    weaknesses.length === 1);
  assert("Correct topic",                    weaknesses[0].topic === "conditionals");
  assert("Signal is RECURRING",             weaknesses[0].signal === "RECURRING");
  assert("masteryState correct",             weaknesses[0].masteryState === "NEEDS_REVIEW");
  assert("totalOccurrences carried through", weaknesses[0].totalOccurrences === 4);
}

console.log("\nbuildActiveWeaknesses — MASTERED topics excluded");
{
  const summaries = [
    makeSummary({ topic: "mastered",    label: "Mastered",    improvementSignal: "IMPROVED",  totalOccurrences: 3 }),
    makeSummary({ topic: "still_weak",  label: "Still Weak",  improvementSignal: "RECURRING",  totalOccurrences: 2 }),
  ];
  const masteryByTopic = new Map([
    ["mastered",   "MASTERED"],
    ["still_weak", "NEEDS_REVIEW"],
  ]);
  const weaknesses = buildActiveWeaknesses(summaries, masteryByTopic);
  assert("Only 1 weakness (MASTERED excluded)", weaknesses.length === 1);
  assert("Non-mastered topic appears",           weaknesses[0].topic === "still_weak");
}

console.log("\nbuildActiveWeaknesses — NEEDS_REVIEW (non-RECURRING) included");
{
  const summaries = [
    makeSummary({ topic: "tenses", label: "Tenses", improvementSignal: "NO_DATA", dueCount: 2 }),
  ];
  const masteryByTopic = new Map([["tenses", "NEEDS_REVIEW"]]);
  const weaknesses = buildActiveWeaknesses(summaries, masteryByTopic);
  assert("NEEDS_REVIEW topic with NO_DATA signal is a weakness", weaknesses.length === 1);
  assert("dueCount carried through", weaknesses[0].dueCount === 2);
}

console.log("\nbuildActiveWeaknesses — IMPROVING / STABLE not included (only RECURRING check)");
{
  const summaries = [
    makeSummary({ topic: "articles", label: "Articles", improvementSignal: "IMPROVING" }),
  ];
  const masteryByTopic = new Map([["articles", "IMPROVING"]]);
  const weaknesses = buildActiveWeaknesses(summaries, masteryByTopic);
  assert("IMPROVING non-RECURRING topic not a weakness", weaknesses.length === 0);
}

console.log("\nbuildActiveWeaknesses — capped at 5");
{
  const summaries = Array.from({ length: 8 }, (_, i) =>
    makeSummary({ topic: `topic_${i}`, label: `Topic ${i}`, improvementSignal: "RECURRING" })
  );
  const masteryByTopic = new Map(summaries.map(s => [s.topic, "NEEDS_REVIEW"]));
  const weaknesses = buildActiveWeaknesses(summaries, masteryByTopic);
  assert("Capped at 5 weaknesses", weaknesses.length === 5);
}

console.log("\nbuildActiveWeaknesses — STABLE + RECURRING is a weakness");
{
  // STABLE topic with RECURRING signal — still needs attention despite STABLE mastery
  const summaries = [
    makeSummary({ topic: "stable_recurring", label: "Stable Recurring", improvementSignal: "RECURRING" }),
  ];
  const masteryByTopic = new Map([["stable_recurring", "STABLE"]]);
  const weaknesses = buildActiveWeaknesses(summaries, masteryByTopic);
  assert("STABLE + RECURRING counts as active weakness", weaknesses.length === 1);
  assert("masteryState is STABLE", weaknesses[0].masteryState === "STABLE");
}

// ── deriveLearningTrend ───────────────────────────────────────────────────────

console.log("\nderiveLearningTrend — INSUFFICIENT_DATA (no profiles)");
{
  assert("Empty profiles → INSUFFICIENT_DATA", deriveLearningTrend([], 0) === "INSUFFICIENT_DATA");
}

console.log("\nderiveLearningTrend — NEEDS_ATTENTION (recurring mistakes present)");
{
  const profiles = [makeProfile("a", "A", "STABLE"), makeProfile("b", "B", "IMPROVING")];
  assert(
    "Any recurring count → NEEDS_ATTENTION",
    deriveLearningTrend(profiles, 1) === "NEEDS_ATTENTION"
  );
}

console.log("\nderiveLearningTrend — NEEDS_ATTENTION (NEEDS_REVIEW majority)");
{
  const profiles = [
    makeProfile("a", "A", "NEEDS_REVIEW"),
    makeProfile("b", "B", "NEEDS_REVIEW"),
    makeProfile("c", "C", "IMPROVING"),
  ];
  // NEEDS_REVIEW (2) > positive (1) → NEEDS_ATTENTION
  assert(
    "NEEDS_REVIEW majority → NEEDS_ATTENTION",
    deriveLearningTrend(profiles, 0) === "NEEDS_ATTENTION"
  );
}

console.log("\nderiveLearningTrend — PROGRESSING (has MASTERED topics)");
{
  const profiles = [
    makeProfile("a", "A", "MASTERED"),
    makeProfile("b", "B", "NEEDS_REVIEW"),
    makeProfile("c", "C", "STABLE"),
  ];
  // NEEDS_REVIEW (1) not > positive (2) → not NEEDS_ATTENTION
  // MASTERED > 0 → PROGRESSING
  assert(
    "Has MASTERED topics → PROGRESSING",
    deriveLearningTrend(profiles, 0) === "PROGRESSING"
  );
}

console.log("\nderiveLearningTrend — PROGRESSING (IMPROVING >= NEEDS_REVIEW)");
{
  const profiles = [
    makeProfile("a", "A", "IMPROVING"),
    makeProfile("b", "B", "IMPROVING"),
    makeProfile("c", "C", "NEEDS_REVIEW"),
  ];
  // NEEDS_REVIEW (1) not > positive (2) → not NEEDS_ATTENTION
  // MASTERED === 0, IMPROVING (2) >= NEEDS_REVIEW (1) → PROGRESSING
  assert(
    "IMPROVING count ≥ NEEDS_REVIEW → PROGRESSING",
    deriveLearningTrend(profiles, 0) === "PROGRESSING"
  );
}

console.log("\nderiveLearningTrend — STABLE (balanced, no urgency)");
{
  const profiles = [
    makeProfile("a", "A", "STABLE"),
    makeProfile("b", "B", "STABLE"),
    makeProfile("c", "C", "NEEDS_REVIEW"),
  ];
  // NEEDS_REVIEW (1) not > positive (2) → not NEEDS_ATTENTION
  // MASTERED === 0, IMPROVING (0) < NEEDS_REVIEW (1) → not PROGRESSING
  // → STABLE
  assert(
    "Mostly STABLE, balanced → STABLE",
    deriveLearningTrend(profiles, 0) === "STABLE"
  );
}

console.log("\nderiveLearningTrend — NEEDS_ATTENTION beats all else when recurring > 0");
{
  const profiles = [
    makeProfile("a", "A", "MASTERED"),
    makeProfile("b", "B", "MASTERED"),
    makeProfile("c", "C", "STABLE"),
  ];
  // Even with 2 MASTERED, a recurring mistake overrides to NEEDS_ATTENTION
  assert(
    "Recurring count > 0 overrides even positive mastery distribution",
    deriveLearningTrend(profiles, 2) === "NEEDS_ATTENTION"
  );
}

// ── buildLearningProfile — profile with weak topics ───────────────────────────

console.log("\nbuildLearningProfile — profile with weak topics");
{
  const topicSummaries = [
    makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "RECURRING", totalOccurrences: 4 }),
    makeSummary({ topic: "tenses",       label: "Tenses",       improvementSignal: "NO_DATA",   dueCount: 2 }),
  ];
  const masteryProfiles = [
    makeProfile("conditionals", "Conditionals", "NEEDS_REVIEW"),
    makeProfile("tenses",       "Tenses",       "NEEDS_REVIEW"),
  ];
  const masteryByTopic = new Map([
    ["conditionals", "NEEDS_REVIEW"],
    ["tenses",       "NEEDS_REVIEW"],
  ]);
  const ctx = emptyCtx({
    topicSummaries,
    masteryProfiles,
    masteryByTopic,
    nextMission: { programSlug: "test-program", order: 5, title: "Session Five", objective: null },
    recommendations: [
      { topic: "conditionals", label: "Conditionals", reason: "...", priority: 1, priorityLabel: "RECURRING_MISTAKE", suggestedAction: "PRACTICE_TOPIC", questionCount: 5, confidence: "HIGH" },
    ],
  });
  const profile = buildLearningProfile(ctx);

  assert("userId set",                       profile.userId === "user_test");
  assert("generatedAt set",                  typeof profile.generatedAt === "string");
  assert("learningTrend is NEEDS_ATTENTION", profile.learningTrend === "NEEDS_ATTENTION");
  assert("activeWeaknesses has 2 topics",    profile.activeWeaknesses.length === 2);
  assert("first weakness is conditionals",   profile.activeWeaknesses[0].topic === "conditionals");
  assert("improvingTopics is empty",         profile.improvingTopics.length === 0);
  assert("masterySummary.totalTopics = 2",   profile.masterySummary.totalTopics === 2);
  assert("masterySummary NEEDS_REVIEW = 2",  profile.masterySummary.byState.NEEDS_REVIEW === 2);
  assert("recommendation included",          profile.recommendations.length === 1);
  assert("nextMission.order = 5",            profile.nextMission?.order === 5);
  assert("nextMission.title set",            profile.nextMission?.title === "Session Five");
}

// ── buildLearningProfile — profile with mastered topics ───────────────────────

console.log("\nbuildLearningProfile — profile with mastered topics");
{
  const topicSummaries = [
    makeSummary({ topic: "conditionals", label: "Conditionals", improvementSignal: "IMPROVED" }),
    makeSummary({ topic: "tenses",       label: "Tenses",       improvementSignal: "IMPROVING" }),
  ];
  const masteryProfiles = [
    makeProfile("conditionals", "Conditionals", "MASTERED"),
    makeProfile("tenses",       "Tenses",       "IMPROVING"),
  ];
  const masteryByTopic = new Map([
    ["conditionals", "MASTERED"],
    ["tenses",       "IMPROVING"],
  ]);
  const ctx = emptyCtx({ topicSummaries, masteryProfiles, masteryByTopic });
  const profile = buildLearningProfile(ctx);

  assert("learningTrend is PROGRESSING (has MASTERED)",  profile.learningTrend === "PROGRESSING");
  assert("MASTERED topic not in activeWeaknesses",        profile.activeWeaknesses.every(w => w.topic !== "conditionals"));
  assert("masterySummary.masteredTopics = [Conditionals]", profile.masterySummary.masteredTopics.includes("Conditionals"));
  assert("improvingTopics includes Tenses",               profile.improvingTopics.some(p => p.topic === "tenses"));
  assert("MASTERED topic in masterySummary.byState",      profile.masterySummary.byState.MASTERED === 1);
}

// ── buildLearningProfile — profile with no data ───────────────────────────────

console.log("\nbuildLearningProfile — no data (new student)");
{
  const ctx = emptyCtx({ nextMission: { programSlug: "test-program", order: 1, title: "Bài 1", objective: null } });
  const profile = buildLearningProfile(ctx);

  assert("learningTrend is INSUFFICIENT_DATA",  profile.learningTrend === "INSUFFICIENT_DATA");
  assert("activeWeaknesses is empty",           profile.activeWeaknesses.length === 0);
  assert("improvingTopics is empty",            profile.improvingTopics.length === 0);
  assert("masterySummary.totalTopics = 0",      profile.masterySummary.totalTopics === 0);
  assert("recommendations empty",               profile.recommendations.length === 0);
  assert("readiness is null",                   profile.readiness === null);
  assert("nextMission.order = 1",               profile.nextMission?.order === 1);
}

// ── buildLearningProfile — recommendations included correctly ─────────────────

console.log("\nbuildLearningProfile — recommendations passed through correctly");
{
  const recs = [
    { topic: "conditionals", label: "Conditionals", reason: "...", priority: 1, priorityLabel: "RECURRING_MISTAKE", suggestedAction: "PRACTICE_TOPIC", questionCount: 5, confidence: "HIGH" },
    { topic: "tenses",       label: "Tenses",       reason: "...", priority: 2, priorityLabel: "DUE_REVIEW",        suggestedAction: "REVIEW_NOTEBOOK", questionCount: 3, confidence: "MEDIUM" },
  ];
  const ctx = emptyCtx({ recommendations: recs });
  const profile = buildLearningProfile(ctx);

  assert("All recommendations passed through",    profile.recommendations.length === 2);
  assert("First rec is RECURRING_MISTAKE",        profile.recommendations[0].priorityLabel === "RECURRING_MISTAKE");
  assert("Second rec is DUE_REVIEW",              profile.recommendations[1].priorityLabel === "DUE_REVIEW");
  assert("Confidence preserved on first rec",     profile.recommendations[0].confidence === "HIGH");
  assert("Confidence preserved on second rec",    profile.recommendations[1].confidence === "MEDIUM");
}

// ── buildLearningProfile — readiness carried through ─────────────────────────

console.log("\nbuildLearningProfile — readiness carried through");
{
  const mockReadiness = {
    readinessScore: 72,
    band: "NEARLY_READY",
    insufficientData: false,
    weightedTopicMastery: 0.72,
    coverageDepthScore: 0.80,
    sessionsIncluded: [5],
    sectionBreakdown: [],
    confidence: "CONFIRMED",
  };
  const ctx = emptyCtx({ readiness: mockReadiness });
  const profile = buildLearningProfile(ctx);

  assert("readiness carried through",         profile.readiness === mockReadiness);
  assert("readiness.band correct",            profile.readiness.band === "NEARLY_READY");
  assert("readiness.readinessScore correct",  profile.readiness.readinessScore === 72);
}

// ── buildLearningProfile — skillSnapshot carried through ──────────────────────

console.log("\nbuildLearningProfile — skillSnapshot carried through");
{
  const skills = [
    { skill: "VOCAB_GRAMMAR", label: "Từ vựng & Ngữ pháp", percentage: 75 },
    { skill: "READING",       label: "Đọc hiểu",            percentage: 60 },
  ];
  const ctx = emptyCtx({ skillSnapshot: skills });
  const profile = buildLearningProfile(ctx);

  assert("skillSnapshot length = 2",        profile.skillSnapshot.length === 2);
  assert("First skill is VOCAB_GRAMMAR",    profile.skillSnapshot[0].skill === "VOCAB_GRAMMAR");
  assert("Percentage carried through",      profile.skillSnapshot[0].percentage === 75);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed${failed > 0 ? `, ${failed} FAILED` : ""}\n`);
if (failed > 0) process.exit(1);
