/**
 * test-ai-generation-integration.mjs
 *
 * Validates M4.2 pure logic:
 *   - contextBuilder: buildGenerationContext(), deriveCountFromGap()
 *   - aiDraftGenerator: toGeneratedDraft(), callGenerationProvider() with mock
 *   - Validation pipeline: validateGeneratedDrafts() on AI output
 *   - Failed provider handling: error path sets FAILED (simulated)
 *   - No Question creation: the pipeline stops at GeneratedQuestionDraft[]
 *   - mock provider: generateQuestions() returns labeled drafts
 *
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines all pure functions under test.
 *
 * Run: node scripts/test-ai-generation-integration.mjs
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

async function assertAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name} — threw: ${err.message}`);
    failed++;
  }
}

async function assertThrowsAsync(name, fn, expectedSubstring = "") {
  try {
    await fn();
    console.error(`  ✗ ${name} — expected throw but did not throw`);
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (expectedSubstring && !msg.includes(expectedSubstring)) {
      console.error(`  ✗ ${name} — threw but message "${msg}" doesn't include "${expectedSubstring}"`);
      failed++;
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  }
}

// ── Inlined pure functions ────────────────────────────────────────────────────

// From contextBuilder.ts
function deriveCountFromGap(gap, difficulty, requestedCount) {
  const bandMissing =
    difficulty === "EASY"
      ? gap.missing.easy
      : difficulty === "MEDIUM"
        ? gap.missing.medium
        : gap.missing.hard;
  return Math.min(requestedCount, bandMissing);
}

function buildObjective(topicLabel, topic, difficulty, count, bandMissing) {
  return `Generate ${count} ${difficulty} question(s) for '${topicLabel}' (${topic}). Knowledge bank is short ${bandMissing} ${difficulty} question(s) in this topic.`;
}

function buildGenerationContext(unit, gap, difficulty, requestedCount) {
  if (requestedCount < 1) throw new Error(`requestedCount must be >= 1, got ${requestedCount}`);
  const bandMissing =
    difficulty === "EASY" ? gap.missing.easy : difficulty === "MEDIUM" ? gap.missing.medium : gap.missing.hard;
  const count = Math.min(requestedCount, bandMissing);
  if (count === 0) throw new Error(`No gap exists for topic '${unit.topic}' at difficulty ${difficulty}`);
  return {
    topic: unit.topic,
    topicLabel: unit.label,
    difficulty,
    count,
    objective: buildObjective(unit.label, unit.topic, difficulty, count, bandMissing),
    missingCounts: { ...gap.missing },
  };
}

// From aiDraftGenerator.ts
function toGeneratedDraft(normalized) {
  return {
    topic: normalized.topic,
    difficulty: normalized.difficulty,
    promptText: normalized.promptText,
    optionA: normalized.optionA,
    optionB: normalized.optionB,
    optionC: normalized.optionC,
    optionD: normalized.optionD,
    correctOption: normalized.correctOption,
    explanationVi: normalized.explanationVi,
    commonMistake: normalized.commonMistake,
    learningObjective: normalized.learningObjective,
    source: normalized.source,
  };
}

async function callGenerationProvider(provider, context) {
  const result = await provider.generateQuestions({
    topic: context.topic,
    topicLabel: context.topicLabel,
    difficulty: context.difficulty,
    targetCount: context.count,
  });
  const drafts = result.drafts.map(toGeneratedDraft);
  return { drafts, retryCount: result.retryCount };
}

// From contentValidation.ts (inlined from M3.4 test)
const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

function deriveStatus(issues) {
  if (issues.some((i) => i.severity === "HIGH")) return "FAIL";
  if (issues.length > 0) return "WARNING";
  return "PASS";
}

function validateQuestionCompleteness(q) {
  const issues = [];
  if (!q.promptText?.trim()) issues.push({ type: "MISSING_PROMPT", severity: "HIGH", message: "No prompt" });
  const empty = ["A", "B", "C", "D"].filter((o) => !q[`option${o}`]?.trim());
  if (empty.length > 0) issues.push({ type: "MISSING_OPTION", severity: "HIGH", message: `Empty: ${empty.map((o) => `option${o}`).join(", ")}` });
  if (!VALID_OPTIONS.has(q.correctOption)) issues.push({ type: "INVALID_CORRECT_OPTION", severity: "HIGH", message: `correctOption '${q.correctOption}' not in A/B/C/D` });
  if (!q.explanationVi?.trim()) issues.push({ type: "MISSING_EXPLANATION", severity: "MEDIUM", message: "No explanationVi" });
  if (!q.topic?.trim()) issues.push({ type: "MISSING_TOPIC", severity: "HIGH", message: "No topic" });
  return issues;
}

function validateKnowledgeMappingQuality(q, unit) {
  const issues = [];
  if (!q.knowledgeUnitId) { issues.push({ type: "NOT_MAPPED", severity: "MEDIUM", message: "Not mapped" }); return issues; }
  if (!unit) { issues.push({ type: "UNIT_NOT_FOUND", severity: "HIGH", message: "Unit missing" }); return issues; }
  if (unit.topic !== q.topic) issues.push({ type: "TOPIC_MISMATCH", severity: "HIGH", message: "Topic mismatch" });
  return issues;
}

function validateQuestion(q, unit = null) {
  const issues = [...validateQuestionCompleteness(q), ...validateKnowledgeMappingQuality(q, unit)];
  return { questionId: q.id, status: deriveStatus(issues), issues };
}

function validateQuestions(questions, units) {
  const byId = new Map(units.map((u) => [u.id, u]));
  return questions.map((q) => {
    const unit = q.knowledgeUnitId ? (byId.get(q.knowledgeUnitId) ?? null) : null;
    return validateQuestion(q, unit);
  });
}

function toValidationInput(draft, syntheticId) {
  return {
    id: syntheticId,
    topic: draft.topic,
    promptText: draft.promptText,
    optionA: draft.optionA,
    optionB: draft.optionB,
    optionC: draft.optionC,
    optionD: draft.optionD,
    correctOption: draft.correctOption,
    explanationVi: draft.explanationVi,
    difficulty: draft.difficulty,
    knowledgeUnitId: null,
  };
}

function validateGeneratedDrafts(drafts, units) {
  const inputs = drafts.map((d, i) => toValidationInput(d, `generated:${i}`));
  return validateQuestions(inputs, units);
}

// ── Mock AI provider (inlined) ────────────────────────────────────────────────

function buildMockGeneratedDrafts(topic, topicLabel, difficulty, targetCount) {
  const prefix = topic.toUpperCase().replace(/_/g, "").slice(0, 8);
  const diffShort = difficulty.slice(0, 3);
  const source = `generated:${topic}:${difficulty}`;
  const count = Math.min(targetCount, 2);
  return Array.from({ length: count }, (_, i) => ({
    questionCode: `GEN_${prefix}_${diffShort}_${String(i + 1).padStart(2, "0")}`,
    type: "GRAMMAR_MCQ",
    skill: "VOCAB_GRAMMAR",
    difficulty,
    topic,
    promptText: `(mẫu AI demo — ${topicLabel}, ${difficulty}) Câu ${i + 1}: Chọn đáp án đúng.`,
    optionA: "Lựa chọn A (mẫu demo)",
    optionB: "Lựa chọn B (mẫu demo)",
    optionC: "Lựa chọn C (mẫu demo)",
    optionD: "Lựa chọn D (mẫu demo)",
    correctOption: "A",
    explanationVi: `Câu hỏi mẫu về ${topicLabel} ở mức ${difficulty}.`,
    commonMistake: null,
    learningObjective: `Ôn luyện ${topicLabel} ở mức ${difficulty}.`,
    source,
    sourceExam: null,
  }));
}

const mockProvider = {
  name: "mock",
  async generateQuestions({ topic, topicLabel, difficulty, targetCount }) {
    return { drafts: buildMockGeneratedDrafts(topic, topicLabel, difficulty, targetCount), retryCount: 0 };
  },
};

const failingProvider = {
  name: "mock",
  async generateQuestions() {
    throw new Error("Simulated AI provider failure");
  },
};

const emptyProvider = {
  name: "mock",
  async generateQuestions() {
    return { drafts: [], retryCount: 0 };
  },
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const unit = {
  id: "unit_pp",
  topic: "present_perfect",
  label: "Hiện tại hoàn thành",
  targetEasyCount: 5,
  targetMediumCount: 5,
  targetHardCount: 3,
};

const gap = {
  knowledgeUnitId: "unit_pp",
  topic: "present_perfect",
  label: "Hiện tại hoàn thành",
  missing: { easy: 2, medium: 3, hard: 3 },
  priority: "HIGH",
};

// ── deriveCountFromGap ────────────────────────────────────────────────────────

console.log("\n── deriveCountFromGap ───────────────────────────────────────");

{
  assert("EASY band: clamp to gap.missing.easy=2 when requested=5", deriveCountFromGap(gap, "EASY", 5) === 2);
  assert("MEDIUM band: clamp to gap.missing.medium=3", deriveCountFromGap(gap, "MEDIUM", 10) === 3);
  assert("HARD band: clamp to gap.missing.hard=3", deriveCountFromGap(gap, "HARD", 1) === 1);
  assert("requestedCount < bandMissing: use requestedCount", deriveCountFromGap(gap, "EASY", 1) === 1);
  assert("zero gap: returns 0", deriveCountFromGap({ ...gap, missing: { ...gap.missing, easy: 0 } }, "EASY", 5) === 0);
}

// ── buildGenerationContext ────────────────────────────────────────────────────

console.log("\n── buildGenerationContext ───────────────────────────────────");

{
  const ctx = buildGenerationContext(unit, gap, "HARD", 5);
  assert("topic propagated", ctx.topic === "present_perfect");
  assert("topicLabel propagated", ctx.topicLabel === "Hiện tại hoàn thành");
  assert("difficulty propagated", ctx.difficulty === "HARD");
  assert("count clamped to gap (3)", ctx.count === 3, `got ${ctx.count}`);
  assert("objective is a non-empty string", typeof ctx.objective === "string" && ctx.objective.length > 10);
  assert("objective mentions topic", ctx.objective.includes("Hiện tại hoàn thành"));
  assert("objective mentions difficulty", ctx.objective.includes("HARD"));
  assert("objective mentions count", ctx.objective.includes("3"));
  assert("missingCounts copied", ctx.missingCounts.easy === 2 && ctx.missingCounts.medium === 3 && ctx.missingCounts.hard === 3);
}

{
  const ctx = buildGenerationContext(unit, gap, "EASY", 1);
  assert("requestedCount=1 is honoured (< gap=2)", ctx.count === 1);
}

{
  const ctx = buildGenerationContext(unit, gap, "MEDIUM", 10);
  assert("MEDIUM count clamped to gap.missing.medium=3", ctx.count === 3);
}

// ── buildGenerationContext: error cases ───────────────────────────────────────

console.log("\n── buildGenerationContext: error cases ──────────────────────");

{
  let threw = false;
  try { buildGenerationContext(unit, gap, "EASY", 0); } catch { threw = true; }
  assert("requestedCount=0 throws", threw);
}

{
  const noGap = { ...gap, missing: { easy: 0, medium: 0, hard: 0 } };
  let threw = false;
  try { buildGenerationContext(unit, noGap, "EASY", 5); } catch { threw = true; }
  assert("zero-gap band throws (already at target)", threw);
}

{
  const noHardGap = { ...gap, missing: { easy: 2, medium: 3, hard: 0 } };
  let threw = false;
  try { buildGenerationContext(unit, noHardGap, "HARD", 3); } catch { threw = true; }
  assert("HARD band with 0 gap throws", threw);
}

// ── toGeneratedDraft ──────────────────────────────────────────────────────────

console.log("\n── toGeneratedDraft ─────────────────────────────────────────");

{
  const normalized = {
    questionCode: "GEN_PP_MED_01",
    type: "GRAMMAR_MCQ",
    skill: "VOCAB_GRAMMAR",
    difficulty: "MEDIUM",
    topic: "present_perfect",
    promptText: "She ___ in Hanoi since 2018.",
    optionA: "live",
    optionB: "lived",
    optionC: "has lived",
    optionD: "living",
    correctOption: "C",
    explanationVi: "Dùng hiện tại hoàn thành với 'since'.",
    commonMistake: "Chọn quá khứ đơn 'lived'.",
    learningObjective: "Phân biệt hiện tại hoàn thành và quá khứ đơn.",
    source: "generated:present_perfect:MEDIUM",
    sourceExam: null,
  };

  const draft = toGeneratedDraft(normalized);

  assert("topic propagated", draft.topic === "present_perfect");
  assert("difficulty propagated", draft.difficulty === "MEDIUM");
  assert("promptText propagated", draft.promptText === normalized.promptText);
  assert("options propagated", draft.optionA === "live" && draft.optionC === "has lived");
  assert("correctOption propagated", draft.correctOption === "C");
  assert("explanationVi propagated", draft.explanationVi === normalized.explanationVi);
  assert("commonMistake propagated", draft.commonMistake === normalized.commonMistake);
  assert("learningObjective propagated", draft.learningObjective === normalized.learningObjective);
  assert("source propagated", draft.source === "generated:present_perfect:MEDIUM");
  assert("no questionCode field", !("questionCode" in draft));
  assert("no type field", !("type" in draft));
  assert("no skill field", !("skill" in draft));
  assert("no sourceExam field", !("sourceExam" in draft));
}

// ── callGenerationProvider: mock provider ─────────────────────────────────────

console.log("\n── callGenerationProvider: mock provider ────────────────────");

await assertAsync("returns drafts array", async () => {
  const ctx = buildGenerationContext(unit, gap, "HARD", 5);
  const { drafts, retryCount } = await callGenerationProvider(mockProvider, ctx);
  assert("  drafts is array", Array.isArray(drafts));
  assert("  retryCount = 0 for mock", retryCount === 0);
  assert("  drafts.length >= 1", drafts.length >= 1, `got ${drafts.length}`);
  assert("  draft.topic = present_perfect", drafts[0].topic === "present_perfect");
  assert("  draft.difficulty = HARD", drafts[0].difficulty === "HARD");
  assert("  source starts with generated:", drafts[0].source.startsWith("generated:"));
  assert("  no questionCode on draft", !("questionCode" in drafts[0]));
});

await assertAsync("mock caps output at 2 even when count=3", async () => {
  const ctx = buildGenerationContext(unit, gap, "HARD", 3);
  const { drafts } = await callGenerationProvider(mockProvider, ctx);
  assert("  drafts.length <= 2 (mock cap)", drafts.length <= 2);
});

await assertAsync("different difficulties produce correct topic+difficulty", async () => {
  for (const diff of ["EASY", "MEDIUM", "HARD"]) {
    const gap2 = { ...gap, missing: { easy: 2, medium: 3, hard: 3 } };
    const ctx = buildGenerationContext(unit, gap2, diff, 2);
    const { drafts } = await callGenerationProvider(mockProvider, ctx);
    assert(`  ${diff}: draft.difficulty matches`, drafts.every((d) => d.difficulty === diff));
    assert(`  ${diff}: draft.topic matches`, drafts.every((d) => d.topic === "present_perfect"));
  }
});

// ── callGenerationProvider: failing provider ──────────────────────────────────

console.log("\n── callGenerationProvider: failing provider ─────────────────");

await assertThrowsAsync(
  "failing provider propagates error to caller",
  async () => {
    const ctx = buildGenerationContext(unit, gap, "HARD", 3);
    await callGenerationProvider(failingProvider, ctx);
  },
  "Simulated AI provider failure",
);

await assertAsync("empty provider returns empty drafts array", async () => {
  const ctx = buildGenerationContext(unit, gap, "HARD", 3);
  const { drafts } = await callGenerationProvider(emptyProvider, ctx);
  assert("  drafts is empty", drafts.length === 0);
});

// ── Validation pipeline integration ──────────────────────────────────────────

console.log("\n── Validation pipeline: mock provider output ────────────────");

await assertAsync("mock drafts pass completeness check (WARNING only, not FAIL)", async () => {
  const ctx = buildGenerationContext(unit, gap, "MEDIUM", 2);
  const { drafts } = await callGenerationProvider(mockProvider, ctx);
  const results = validateGeneratedDrafts(drafts, []);

  assert("  one validation result per draft", results.length === drafts.length);
  assert("  no FAIL (structural issues)", results.every((r) => r.status !== "FAIL"),
    `statuses: ${results.map((r) => r.status).join(", ")}`);
  assert("  WARNING due to NOT_MAPPED (no KU assigned)", results.every((r) => r.status === "WARNING"));
  assert("  only NOT_MAPPED issue on each draft",
    results.every((r) => r.issues.every((i) => i.type === "NOT_MAPPED")));
});

await assertAsync("structurally invalid draft produces FAIL", async () => {
  const badDraft = {
    topic: "present_perfect",
    difficulty: "EASY",
    promptText: "",              // MISSING_PROMPT (HIGH)
    optionA: "A", optionB: "B", optionC: "C", optionD: "D",
    correctOption: "X",          // INVALID_CORRECT_OPTION (HIGH)
    explanationVi: "",           // MISSING_EXPLANATION (MEDIUM)
    commonMistake: null, learningObjective: null,
    source: "generated:present_perfect:EASY",
  };
  const results = validateGeneratedDrafts([badDraft], []);
  assert("  FAIL status", results[0].status === "FAIL");
  assert("  has MISSING_PROMPT", results[0].issues.some((i) => i.type === "MISSING_PROMPT"));
  assert("  has INVALID_CORRECT_OPTION", results[0].issues.some((i) => i.type === "INVALID_CORRECT_OPTION"));
});

await assertAsync("valid draft (all fields) passes with PASS if KU assigned", async () => {
  const kuUnit = { id: "unit_pp", topic: "present_perfect", label: "HT hoàn thành", targetEasyCount: 5, targetMediumCount: 5, targetHardCount: 3 };
  const draft = {
    topic: "present_perfect",
    difficulty: "MEDIUM",
    promptText: "She ___ here since 2018.",
    optionA: "live", optionB: "lived", optionC: "has lived", optionD: "living",
    correctOption: "C",
    explanationVi: "Dùng HT hoàn thành với since.",
    commonMistake: null, learningObjective: null,
    source: "generated:present_perfect:MEDIUM",
    // Note: toValidationInput sets knowledgeUnitId = null, so this will be WARNING
    // even though the KU exists. PASS only possible when FK is set (post-approval).
  };
  const results = validateGeneratedDrafts([draft], [kuUnit]);
  // knowledgeUnitId is null in generated drafts → NOT_MAPPED → WARNING
  assert("  generated draft (no KU FK) → WARNING, not FAIL", results[0].status === "WARNING");
  assert("  only NOT_MAPPED issue", results[0].issues.length === 1 && results[0].issues[0].type === "NOT_MAPPED");
});

// ── No Question creation ──────────────────────────────────────────────────────

console.log("\n── No Question creation guarantee ───────────────────────────");

{
  // Structural: callGenerationProvider returns GeneratedQuestionDraft[]
  // which has no DB interaction. No prisma.question.create() call exists
  // in contextBuilder.ts or in the pure parts of aiDraftGenerator.ts.
  // We verify the draft shape has no 'id' field (no DB row was created).
  const ctx = buildGenerationContext(unit, gap, "EASY", 1);
  const { drafts } = await callGenerationProvider(mockProvider, ctx);
  assert("draft has no 'id' (no DB row created)", !("id" in drafts[0]));
  assert("draft has no 'questionId' field", !("questionId" in drafts[0]));
  assert("draft source encodes generation origin", drafts[0].source.startsWith("generated:"));
}

// ── End-to-end pipeline simulation ───────────────────────────────────────────

console.log("\n── End-to-end pipeline simulation ──────────────────────────");

await assertAsync("full flow: gap → context → provider → drafts → validation", async () => {
  // 1. Gap detected (from M3.2/M3.3 output)
  const detectedGap = {
    knowledgeUnitId: "unit_pv",
    topic: "passive_voice",
    label: "Câu bị động",
    missing: { easy: 1, medium: 2, hard: 3 },
    priority: "HIGH",
  };
  const ku = { id: "unit_pv", topic: "passive_voice", label: "Câu bị động", targetEasyCount: 5, targetMediumCount: 5, targetHardCount: 3 };

  // 2. Build context (admin requests 2 HARD questions)
  const ctx = buildGenerationContext(ku, detectedGap, "HARD", 2);
  assert("  count = min(2, gap.hard=3) = 2", ctx.count === 2);
  assert("  topic = passive_voice", ctx.topic === "passive_voice");

  // 3. Call AI (mock)
  const { drafts } = await callGenerationProvider(mockProvider, ctx);
  assert("  drafts.length >= 1", drafts.length >= 1);
  assert("  all drafts have correct topic", drafts.every((d) => d.topic === "passive_voice"));
  assert("  all drafts have HARD difficulty", drafts.every((d) => d.difficulty === "HARD"));

  // 4. Validate
  const results = validateGeneratedDrafts(drafts, [ku]);
  assert("  validation results match draft count", results.length === drafts.length);
  assert("  no FAIL results", results.every((r) => r.status !== "FAIL"));

  // 5. No Question row — drafts are in memory only
  assert("  no 'id' on draft (no DB row)", drafts.every((d) => !("id" in d)));
});

await assertAsync("error path: failing provider → empty drafts returned", async () => {
  const ctx = buildGenerationContext(unit, gap, "MEDIUM", 3);
  // Simulate the error catch in generateDraftsForGap (without DB):
  let drafts;
  try {
    const result = await callGenerationProvider(failingProvider, ctx);
    drafts = result.drafts;
  } catch {
    drafts = []; // error → empty result, job would be marked FAILED
  }
  assert("  empty drafts on error", drafts.length === 0);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`✓ All ${total} tests passed`);
} else {
  console.error(`✗ ${failed}/${total} tests failed`);
  process.exit(1);
}
