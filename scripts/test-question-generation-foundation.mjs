/**
 * test-question-generation-foundation.mjs
 *
 * Validates M4.1 pure logic:
 *   - VALID_JOB_TRANSITIONS (state machine)
 *   - isValidTransition()
 *   - GenerationJobInput validation guards
 *   - generateDraftQuestions() — placeholder contract
 *   - toValidationInput() — draft → validation shape conversion
 *   - validateGeneratedDrafts() — validation integration with contentValidation
 *
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines all pure functions under test.
 *
 * Run: node scripts/test-question-generation-foundation.mjs
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

const VALID_JOB_TRANSITIONS = {
  PENDING:    ["GENERATING", "FAILED"],
  GENERATING: ["REVIEWING",  "FAILED"],
  REVIEWING:  ["COMPLETED",  "FAILED"],
  COMPLETED:  [],
  FAILED:     [],
};

function isValidTransition(from, to) {
  return (VALID_JOB_TRANSITIONS[from] ?? []).includes(to);
}

function generateDraftQuestions(input) {
  void input;
  return { drafts: [], generatorUsed: "PLACEHOLDER", jobId: input.jobId };
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

// Inlined from contentValidation.ts
const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

function deriveStatus(issues) {
  if (issues.some((i) => i.severity === "HIGH")) return "FAIL";
  if (issues.length > 0) return "WARNING";
  return "PASS";
}

function validateQuestionCompleteness(q) {
  const issues = [];
  if (!q.promptText?.trim()) issues.push({ type: "MISSING_PROMPT", severity: "HIGH", message: "Question has no prompt text" });
  const emptyOptions = ["A","B","C","D"].filter((opt) => !q[`option${opt}`]?.trim());
  if (emptyOptions.length > 0) issues.push({ type: "MISSING_OPTION", severity: "HIGH", message: `Empty: ${emptyOptions.map((o) => `option${o}`).join(", ")}` });
  if (!VALID_OPTIONS.has(q.correctOption)) issues.push({ type: "INVALID_CORRECT_OPTION", severity: "HIGH", message: `correctOption '${q.correctOption}' is not A/B/C/D` });
  if (!q.explanationVi?.trim()) issues.push({ type: "MISSING_EXPLANATION", severity: "MEDIUM", message: "Missing explanationVi" });
  if (!q.topic?.trim()) issues.push({ type: "MISSING_TOPIC", severity: "HIGH", message: "Missing topic" });
  return issues;
}

function validateKnowledgeMappingQuality(q, unit) {
  const issues = [];
  if (!q.knowledgeUnitId) {
    issues.push({ type: "NOT_MAPPED", severity: "MEDIUM", message: `Not mapped: ${q.topic}` });
    return issues;
  }
  if (!unit) { issues.push({ type: "UNIT_NOT_FOUND", severity: "HIGH", message: "Unit missing" }); return issues; }
  if (unit.topic !== q.topic) issues.push({ type: "TOPIC_MISMATCH", severity: "HIGH", message: `Mismatch: ${q.topic} vs ${unit.topic}` });
  return issues;
}

function validateQuestion(q, unit = null) {
  const issues = [...validateQuestionCompleteness(q), ...validateKnowledgeMappingQuality(q, unit)];
  return { questionId: q.id, status: deriveStatus(issues), issues };
}

function validateQuestions(questions, units) {
  const unitById = new Map(units.map((u) => [u.id, u]));
  return questions.map((q) => {
    const unit = q.knowledgeUnitId ? (unitById.get(q.knowledgeUnitId) ?? null) : null;
    return validateQuestion(q, unit);
  });
}

function validateGeneratedDrafts(drafts, units) {
  const inputs = drafts.map((d, i) => toValidationInput(d, `generated:${i}`));
  return validateQuestions(inputs, units);
}

// Simulate the job input guard from generationJob.ts
function validateJobInput(input) {
  const errors = [];
  if (!input.topic?.trim()) errors.push("topic is required");
  if (!["EASY","MEDIUM","HARD"].includes(input.difficulty)) errors.push(`Invalid difficulty: ${input.difficulty}`);
  if (typeof input.targetCount !== "number" || input.targetCount < 1) errors.push("targetCount must be >= 1");
  return errors;
}

function clampTargetCount(n) {
  return Math.min(20, Math.max(1, n));
}

// ── Job status machine ────────────────────────────────────────────────────────

console.log("\n── VALID_JOB_TRANSITIONS: structure ─────────────────────────");

{
  const statuses = ["PENDING","GENERATING","REVIEWING","COMPLETED","FAILED"];
  for (const s of statuses) {
    assert(`${s} has a transitions entry`, Array.isArray(VALID_JOB_TRANSITIONS[s]));
  }
}

{
  assert("COMPLETED is terminal (no outbound)", VALID_JOB_TRANSITIONS.COMPLETED.length === 0);
  assert("FAILED is terminal (no outbound)",    VALID_JOB_TRANSITIONS.FAILED.length   === 0);
}

console.log("\n── isValidTransition: valid paths ───────────────────────────");

{
  assert("PENDING → GENERATING",   isValidTransition("PENDING",    "GENERATING"));
  assert("PENDING → FAILED",       isValidTransition("PENDING",    "FAILED"));
  assert("GENERATING → REVIEWING", isValidTransition("GENERATING", "REVIEWING"));
  assert("GENERATING → FAILED",    isValidTransition("GENERATING", "FAILED"));
  assert("REVIEWING → COMPLETED",  isValidTransition("REVIEWING",  "COMPLETED"));
  assert("REVIEWING → FAILED",     isValidTransition("REVIEWING",  "FAILED"));
}

console.log("\n── isValidTransition: invalid paths ─────────────────────────");

{
  assert("PENDING → REVIEWING (skip) rejected",  !isValidTransition("PENDING",    "REVIEWING"));
  assert("PENDING → COMPLETED (skip) rejected",  !isValidTransition("PENDING",    "COMPLETED"));
  assert("GENERATING → PENDING (backward) rejected", !isValidTransition("GENERATING","PENDING"));
  assert("COMPLETED → anything rejected",        !isValidTransition("COMPLETED",  "PENDING"));
  assert("COMPLETED → FAILED rejected",          !isValidTransition("COMPLETED",  "FAILED"));
  assert("FAILED → anything rejected",           !isValidTransition("FAILED",     "PENDING"));
  assert("FAILED → GENERATING rejected",         !isValidTransition("FAILED",     "GENERATING"));
  assert("REVIEWING → PENDING (backward) rejected", !isValidTransition("REVIEWING", "PENDING"));
  assert("REVIEWING → GENERATING (backward) rejected", !isValidTransition("REVIEWING","GENERATING"));
}

console.log("\n── isValidTransition: self-transitions ──────────────────────");

{
  for (const s of ["PENDING","GENERATING","REVIEWING","COMPLETED","FAILED"]) {
    assert(`${s} → ${s} (self) rejected`, !isValidTransition(s, s));
  }
}

// ── Job creation guards ───────────────────────────────────────────────────────

console.log("\n── GenerationJobInput validation ────────────────────────────");

{
  const errs = validateJobInput({ topic: "present_perfect", difficulty: "EASY", targetCount: 5 });
  assert("valid input → no errors", errs.length === 0, errs.join("; "));
}

{
  const errs = validateJobInput({ topic: "", difficulty: "EASY", targetCount: 5 });
  assert("empty topic → error", errs.some((e) => e.includes("topic")));
}

{
  const errs = validateJobInput({ topic: "present_perfect", difficulty: "EXTREME", targetCount: 5 });
  assert("invalid difficulty → error", errs.some((e) => e.includes("difficulty")));
}

{
  const errs = validateJobInput({ topic: "present_perfect", difficulty: "MEDIUM", targetCount: 0 });
  assert("targetCount 0 → error", errs.some((e) => e.includes("targetCount")));
}

{
  assert("targetCount clamped to 1 minimum",  clampTargetCount(0)   === 1);
  assert("targetCount clamped to 20 maximum", clampTargetCount(999) === 20);
  assert("targetCount 10 unchanged",          clampTargetCount(10)  === 10);
}

// ── Placeholder generator ─────────────────────────────────────────────────────

console.log("\n── generateDraftQuestions: placeholder contract ─────────────");

{
  const result = generateDraftQuestions({
    jobId: "job_1",
    topic: "present_perfect",
    knowledgeUnitLabel: "Present Perfect",
    difficulty: "MEDIUM",
    targetCount: 3,
  });
  assert("returns GenerationResult shape",  typeof result === "object");
  assert("generatorUsed = PLACEHOLDER",     result.generatorUsed === "PLACEHOLDER");
  assert("drafts is an array",              Array.isArray(result.drafts));
  assert("drafts is empty (M4.1)",          result.drafts.length === 0,
    "placeholder returns no content — real generation wired in M4.2");
  assert("jobId propagated",                result.jobId === "job_1");
}

{
  // Different inputs — always returns same placeholder shape
  for (const diff of ["EASY","MEDIUM","HARD"]) {
    const result = generateDraftQuestions({
      jobId: `job_${diff}`, topic: "passive_voice",
      knowledgeUnitLabel: "Passive Voice",
      difficulty: diff, targetCount: 5,
    });
    assert(`placeholder is stable for ${diff}`,
      result.generatorUsed === "PLACEHOLDER" && result.drafts.length === 0);
  }
}

// ── toValidationInput ─────────────────────────────────────────────────────────

console.log("\n── toValidationInput: draft → validation shape ───────────────");

{
  const draft = {
    topic: "present_perfect",
    difficulty: "MEDIUM",
    promptText: "Which is correct?",
    optionA: "I have went.",
    optionB: "I have gone.",
    optionC: "I went.",
    optionD: "I goed.",
    correctOption: "B",
    explanationVi: "Present Perfect dùng 'have + past participle'.",
    commonMistake: null,
    learningObjective: null,
    source: "generated:present_perfect:MEDIUM",
  };

  const input = toValidationInput(draft, "generated:0");

  assert("id = synthetic id", input.id === "generated:0");
  assert("topic propagated",       input.topic === "present_perfect");
  assert("promptText propagated",  input.promptText === draft.promptText);
  assert("optionA propagated",     input.optionA === draft.optionA);
  assert("optionB propagated",     input.optionB === draft.optionB);
  assert("optionC propagated",     input.optionC === draft.optionC);
  assert("optionD propagated",     input.optionD === draft.optionD);
  assert("correctOption propagated", input.correctOption === "B");
  assert("explanationVi propagated", input.explanationVi === draft.explanationVi);
  assert("difficulty propagated",  input.difficulty === "MEDIUM");
  assert("knowledgeUnitId is null (not yet FK-assigned)", input.knowledgeUnitId === null);
}

// ── validateGeneratedDrafts: validation integration ───────────────────────────

console.log("\n── validateGeneratedDrafts: empty draft list ─────────────────");

{
  const results = validateGeneratedDrafts([], []);
  assert("no drafts → no validation results", results.length === 0);
}

console.log("\n── validateGeneratedDrafts: valid draft ──────────────────────");

{
  const draft = {
    topic: "present_perfect", difficulty: "MEDIUM",
    promptText: "Which sentence uses Present Perfect correctly?",
    optionA: "I have gone.",   optionB: "I gone.",
    optionC: "I have went.",   optionD: "I goed.",
    correctOption: "A",
    explanationVi: "Have + past participle.",
    commonMistake: null, learningObjective: null,
    source: "generated:present_perfect:MEDIUM",
  };

  const results = validateGeneratedDrafts([draft], []);
  assert("one result for one draft", results.length === 1);
  assert("id = generated:0", results[0].questionId === "generated:0");
  // No KU assigned yet → NOT_MAPPED (MEDIUM) → WARNING (not FAIL)
  assert("unmapped generated draft → WARNING (not FAIL)", results[0].status === "WARNING");
  assert("only NOT_MAPPED issue", results[0].issues.length === 1);
  assert("issue type = NOT_MAPPED", results[0].issues[0].type === "NOT_MAPPED");
  assert("NOT_MAPPED severity = MEDIUM", results[0].issues[0].severity === "MEDIUM");
}

console.log("\n── validateGeneratedDrafts: structurally invalid draft ───────");

{
  const badDraft = {
    topic: "present_perfect", difficulty: "EASY",
    promptText: "",           // MISSING_PROMPT (HIGH)
    optionA: "A", optionB: "B", optionC: "C", optionD: "D",
    correctOption: "X",       // INVALID_CORRECT_OPTION (HIGH)
    explanationVi: "",        // MISSING_EXPLANATION (MEDIUM)
    commonMistake: null, learningObjective: null,
    source: "generated:present_perfect:EASY",
  };

  const results = validateGeneratedDrafts([badDraft], []);
  assert("invalid draft → FAIL", results[0].status === "FAIL");
  assert("has MISSING_PROMPT",          results[0].issues.some((i) => i.type === "MISSING_PROMPT"));
  assert("has INVALID_CORRECT_OPTION",  results[0].issues.some((i) => i.type === "INVALID_CORRECT_OPTION"));
  assert("has MISSING_EXPLANATION",     results[0].issues.some((i) => i.type === "MISSING_EXPLANATION"));
  assert("has NOT_MAPPED",              results[0].issues.some((i) => i.type === "NOT_MAPPED"));
}

console.log("\n── validateGeneratedDrafts: batch mixed results ──────────────");

{
  const goodDraft = {
    topic: "passive_voice", difficulty: "HARD",
    promptText: "Choose the correct passive voice form.",
    optionA: "The letter is written by her.",
    optionB: "The letter was wrote by her.",
    optionC: "The letter written by her.",
    optionD: "The letter be written by her.",
    correctOption: "A", explanationVi: "Passive: be + past participle.",
    commonMistake: null, learningObjective: null,
    source: "generated:passive_voice:HARD",
  };
  const emptyPromptDraft = {
    ...goodDraft, promptText: "", source: "generated:passive_voice:EASY",
  };

  const results = validateGeneratedDrafts([goodDraft, emptyPromptDraft], []);
  assert("batch: 2 results",                  results.length === 2);
  assert("draft 0 (good) → WARNING (not mapped only)", results[0].status === "WARNING");
  assert("draft 1 (bad prompt) → FAIL",       results[1].status === "FAIL");
  assert("ids are indexed correctly: generated:0", results[0].questionId === "generated:0");
  assert("ids are indexed correctly: generated:1", results[1].questionId === "generated:1");
}

// ── Pipeline contract: gap → job → generate → validate ───────────────────────

console.log("\n── end-to-end pipeline simulation ───────────────────────────");

{
  // Simulate the full M4.1 workflow boundary (no Prisma, no AI):
  // 1. Admin identifies a gap (topic + difficulty)
  // 2. A job is created (PENDING)
  // 3. Job transitions to GENERATING
  // 4. generateDraftQuestions() returns empty (placeholder)
  // 5. Drafts are validated (none in M4.1)
  // 6. Job transitions to REVIEWING (would be skipped in M4.1 with 0 drafts)

  const jobInput = { topic: "conditionals", difficulty: "HARD", targetCount: 3 };
  const errs = validateJobInput(jobInput);
  assert("step 1: job input valid", errs.length === 0);

  // Simulate job creation → PENDING
  const jobId = "sim_job_1";
  let currentStatus = "PENDING";
  assert("step 2: initial status = PENDING", currentStatus === "PENDING");

  // Simulate transition to GENERATING
  assert("step 3: PENDING→GENERATING valid", isValidTransition(currentStatus, "GENERATING"));
  currentStatus = "GENERATING";

  // Simulate draft generation (placeholder)
  const generationInput = { jobId, topic: "conditionals", knowledgeUnitLabel: "Conditionals", difficulty: "HARD", targetCount: 3 };
  const result = generateDraftQuestions(generationInput);
  assert("step 4: placeholder produces 0 drafts", result.drafts.length === 0);
  assert("step 4: generator = PLACEHOLDER", result.generatorUsed === "PLACEHOLDER");

  // Validate drafts (empty list)
  const validationResults = validateGeneratedDrafts(result.drafts, []);
  assert("step 5: 0 drafts → 0 validation results", validationResults.length === 0);

  // With 0 drafts, job can still transition (M4.2 will produce real drafts)
  assert("step 6: GENERATING→REVIEWING valid", isValidTransition(currentStatus, "REVIEWING"));
  currentStatus = "REVIEWING";
  assert("status = REVIEWING", currentStatus === "REVIEWING");

  // Terminal transition
  assert("REVIEWING→COMPLETED valid", isValidTransition(currentStatus, "COMPLETED"));
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
