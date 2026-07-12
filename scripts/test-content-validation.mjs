/**
 * test-content-validation.mjs
 *
 * Validates M3.4 pure engine functions:
 *   - validateQuestionCompleteness()
 *   - validateKnowledgeMappingQuality()
 *   - validateDifficultyDistribution()
 *   - validateQuestion() (composite)
 *   - validateQuestions() (batch)
 *   - deriveStatus logic (PASS / WARNING / FAIL)
 *
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions under test.
 *
 * Run: node scripts/test-content-validation.mjs
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

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

function deriveStatus(issues) {
  if (issues.some((i) => i.severity === "HIGH")) return "FAIL";
  if (issues.length > 0) return "WARNING";
  return "PASS";
}

function validateQuestionCompleteness(q) {
  const issues = [];
  if (!q.promptText?.trim())
    issues.push({ type: "MISSING_PROMPT", severity: "HIGH", message: "Question has no prompt text" });
  const emptyOptions = ["A", "B", "C", "D"].filter((opt) => !q[`option${opt}`]?.trim());
  if (emptyOptions.length > 0)
    issues.push({ type: "MISSING_OPTION", severity: "HIGH", message: `Answer option(s) are empty: ${emptyOptions.map((o) => `option${o}`).join(", ")}` });
  if (!VALID_OPTIONS.has(q.correctOption))
    issues.push({ type: "INVALID_CORRECT_OPTION", severity: "HIGH", message: `correctOption '${q.correctOption}' is not one of A, B, C, D` });
  if (!q.explanationVi?.trim())
    issues.push({ type: "MISSING_EXPLANATION", severity: "MEDIUM", message: "Question has no Vietnamese explanation (explanationVi is blank)" });
  if (!q.topic?.trim())
    issues.push({ type: "MISSING_TOPIC", severity: "HIGH", message: "Question has no topic" });
  return issues;
}

function validateKnowledgeMappingQuality(q, unit) {
  const issues = [];
  if (!q.knowledgeUnitId) {
    issues.push({ type: "NOT_MAPPED", severity: "MEDIUM", message: `Question topic '${q.topic}' is not formally assigned to a KnowledgeUnit` });
    return issues;
  }
  if (!unit) {
    issues.push({ type: "UNIT_NOT_FOUND", severity: "HIGH", message: `KnowledgeUnit '${q.knowledgeUnitId}' referenced by question does not exist` });
    return issues;
  }
  if (unit.topic !== q.topic)
    issues.push({ type: "TOPIC_MISMATCH", severity: "HIGH", message: `Question topic '${q.topic}' does not match KnowledgeUnit topic '${unit.topic}'` });
  return issues;
}

function validateDifficultyDistribution({ unit, actual }) {
  const issues = [];
  const missingHard   = Math.max(0, unit.targetHardCount   - actual.hard);
  const missingMedium = Math.max(0, unit.targetMediumCount - actual.medium);
  const missingEasy   = Math.max(0, unit.targetEasyCount   - actual.easy);
  if (missingHard   > 0) issues.push({ type: "MISSING_HARD_QUESTIONS",   severity: "HIGH",   message: `'${unit.label}' needs ${missingHard} more HARD question(s) (has ${actual.hard}, target ${unit.targetHardCount})` });
  if (missingMedium > 0) issues.push({ type: "MISSING_MEDIUM_QUESTIONS", severity: "MEDIUM", message: `'${unit.label}' needs ${missingMedium} more MEDIUM question(s) (has ${actual.medium}, target ${unit.targetMediumCount})` });
  if (missingEasy   > 0) issues.push({ type: "MISSING_EASY_QUESTIONS",   severity: "LOW",    message: `'${unit.label}' needs ${missingEasy} more EASY question(s) (has ${actual.easy}, target ${unit.targetEasyCount})` });
  return { unitId: unit.id, topic: unit.topic, label: unit.label, status: deriveStatus(issues), issues };
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides = {}) {
  return {
    id: "q_1",
    topic: "present_perfect",
    promptText: "Which sentence uses Present Perfect correctly?",
    optionA: "I have seen him yesterday.",
    optionB: "I have never been to Paris.",
    optionC: "She has went to school.",
    optionD: "We has finished the work.",
    correctOption: "B",
    explanationVi: "Present Perfect dùng để nói về kinh nghiệm chưa xác định thời điểm.",
    difficulty: "MEDIUM",
    knowledgeUnitId: "ku_1",
    ...overrides,
  };
}

function makeUnit(overrides = {}) {
  return {
    id: "ku_1",
    topic: "present_perfect",
    label: "Present Perfect",
    targetEasyCount: 5,
    targetMediumCount: 5,
    targetHardCount: 3,
    ...overrides,
  };
}

// ── Check 1: Question completeness ────────────────────────────────────────────

console.log("\n── validateQuestionCompleteness: valid question ─────────────");

{
  const issues = validateQuestionCompleteness(makeQuestion());
  assert("valid question → zero issues", issues.length === 0, `got ${issues.length}`);
}

console.log("\n── validateQuestionCompleteness: missing promptText ─────────");

{
  const issues = validateQuestionCompleteness(makeQuestion({ promptText: "" }));
  assert("empty promptText → 1 issue", issues.length === 1);
  assert("issue type = MISSING_PROMPT", issues[0].type === "MISSING_PROMPT");
  assert("severity = HIGH", issues[0].severity === "HIGH");
}

{
  const issues = validateQuestionCompleteness(makeQuestion({ promptText: "   " }));
  assert("whitespace-only promptText → MISSING_PROMPT", issues[0]?.type === "MISSING_PROMPT");
}

console.log("\n── validateQuestionCompleteness: missing option ─────────────");

{
  const issues = validateQuestionCompleteness(makeQuestion({ optionB: "" }));
  const opt = issues.find((i) => i.type === "MISSING_OPTION");
  assert("empty optionB → MISSING_OPTION issue", !!opt);
  assert("severity = HIGH", opt?.severity === "HIGH");
  assert("message names optionB", opt?.message.includes("optionB"));
}

{
  const issues = validateQuestionCompleteness(makeQuestion({ optionA: "", optionC: "" }));
  const opt = issues.find((i) => i.type === "MISSING_OPTION");
  assert("two empty options → one MISSING_OPTION issue", !!opt);
  assert("message names both optionA and optionC", opt?.message.includes("optionA") && opt?.message.includes("optionC"));
}

console.log("\n── validateQuestionCompleteness: invalid correctOption ───────");

{
  const issues = validateQuestionCompleteness(makeQuestion({ correctOption: "E" }));
  const issue = issues.find((i) => i.type === "INVALID_CORRECT_OPTION");
  assert("correctOption 'E' → INVALID_CORRECT_OPTION", !!issue);
  assert("severity = HIGH", issue?.severity === "HIGH");
  assert("message mentions 'E'", issue?.message.includes("'E'"));
}

{
  const issues = validateQuestionCompleteness(makeQuestion({ correctOption: "" }));
  assert("empty correctOption → INVALID_CORRECT_OPTION", issues.some((i) => i.type === "INVALID_CORRECT_OPTION"));
}

{
  const issues = validateQuestionCompleteness(makeQuestion({ correctOption: "b" }));
  assert("lowercase 'b' → INVALID_CORRECT_OPTION (case-sensitive)", issues.some((i) => i.type === "INVALID_CORRECT_OPTION"));
}

{
  for (const opt of ["A", "B", "C", "D"]) {
    const issues = validateQuestionCompleteness(makeQuestion({ correctOption: opt }));
    assert(`correctOption '${opt}' is valid`, !issues.some((i) => i.type === "INVALID_CORRECT_OPTION"));
  }
}

console.log("\n── validateQuestionCompleteness: missing explanation ─────────");

{
  const issues = validateQuestionCompleteness(makeQuestion({ explanationVi: "" }));
  const issue = issues.find((i) => i.type === "MISSING_EXPLANATION");
  assert("empty explanationVi → MISSING_EXPLANATION", !!issue);
  assert("severity = MEDIUM (not HIGH)", issue?.severity === "MEDIUM");
}

{
  const issues = validateQuestionCompleteness(makeQuestion({ explanationVi: "" }));
  assert("missing explanation alone → WARNING (not FAIL)", deriveStatus(issues) === "WARNING");
}

console.log("\n── validateQuestionCompleteness: missing topic ───────────────");

{
  const issues = validateQuestionCompleteness(makeQuestion({ topic: "" }));
  const issue = issues.find((i) => i.type === "MISSING_TOPIC");
  assert("empty topic → MISSING_TOPIC", !!issue);
  assert("severity = HIGH", issue?.severity === "HIGH");
}

// ── Check 2: Knowledge mapping quality ────────────────────────────────────────

console.log("\n── validateKnowledgeMappingQuality: mapped correctly ─────────");

{
  const issues = validateKnowledgeMappingQuality(makeQuestion(), makeUnit());
  assert("matched topic + unit → zero issues", issues.length === 0);
}

console.log("\n── validateKnowledgeMappingQuality: not mapped ──────────────");

{
  const issues = validateKnowledgeMappingQuality(makeQuestion({ knowledgeUnitId: null }), null);
  assert("null knowledgeUnitId → NOT_MAPPED issue", issues[0]?.type === "NOT_MAPPED");
  assert("severity = MEDIUM", issues[0]?.severity === "MEDIUM");
  assert("only one issue (no further checks)", issues.length === 1);
}

console.log("\n── validateKnowledgeMappingQuality: stale FK ────────────────");

{
  // knowledgeUnitId is set but the unit doesn't exist (e.g. deleted)
  const issues = validateKnowledgeMappingQuality(makeQuestion({ knowledgeUnitId: "ku_deleted" }), null);
  assert("missing unit → UNIT_NOT_FOUND", issues[0]?.type === "UNIT_NOT_FOUND");
  assert("severity = HIGH", issues[0]?.severity === "HIGH");
  assert("only one issue (returns early)", issues.length === 1);
}

console.log("\n── validateKnowledgeMappingQuality: topic mismatch ──────────");

{
  const unit = makeUnit({ topic: "past_simple" }); // different from question's "present_perfect"
  const issues = validateKnowledgeMappingQuality(makeQuestion(), unit);
  assert("topic mismatch → TOPIC_MISMATCH", issues[0]?.type === "TOPIC_MISMATCH");
  assert("severity = HIGH", issues[0]?.severity === "HIGH");
  assert("message names question topic", issues[0]?.message.includes("present_perfect"));
  assert("message names unit topic", issues[0]?.message.includes("past_simple"));
}

// ── Check 3: Difficulty distribution ─────────────────────────────────────────

console.log("\n── validateDifficultyDistribution: targets met ──────────────");

{
  const result = validateDifficultyDistribution({
    unit: makeUnit(),
    actual: { easy: 5, medium: 5, hard: 3 },
  });
  assert("all targets met → status PASS", result.status === "PASS");
  assert("no issues", result.issues.length === 0);
}

{
  // Surplus questions do not produce issues
  const result = validateDifficultyDistribution({
    unit: makeUnit(),
    actual: { easy: 10, medium: 8, hard: 5 },
  });
  assert("surplus questions → still PASS (no issue for excess)", result.status === "PASS");
}

console.log("\n── validateDifficultyDistribution: missing hard ─────────────");

{
  const result = validateDifficultyDistribution({
    unit: makeUnit(),
    actual: { easy: 5, medium: 5, hard: 0 },
  });
  const issue = result.issues.find((i) => i.type === "MISSING_HARD_QUESTIONS");
  assert("missing hard → MISSING_HARD_QUESTIONS", !!issue);
  assert("severity = HIGH", issue?.severity === "HIGH");
  assert("message says needs 3", issue?.message.includes("3"));
  assert("status = FAIL", result.status === "FAIL");
}

console.log("\n── validateDifficultyDistribution: missing medium ───────────");

{
  const result = validateDifficultyDistribution({
    unit: makeUnit(),
    actual: { easy: 5, medium: 2, hard: 3 },
  });
  const issue = result.issues.find((i) => i.type === "MISSING_MEDIUM_QUESTIONS");
  assert("missing medium → MISSING_MEDIUM_QUESTIONS", !!issue);
  assert("severity = MEDIUM", issue?.severity === "MEDIUM");
  assert("message says needs 3 more", issue?.message.includes("3"));
  assert("status = WARNING (no hard gap)", result.status === "WARNING");
}

console.log("\n── validateDifficultyDistribution: missing easy only ─────────");

{
  const result = validateDifficultyDistribution({
    unit: makeUnit(),
    actual: { easy: 2, medium: 5, hard: 3 },
  });
  const issue = result.issues.find((i) => i.type === "MISSING_EASY_QUESTIONS");
  assert("missing easy → MISSING_EASY_QUESTIONS", !!issue);
  assert("severity = LOW", issue?.severity === "LOW");
  assert("status = WARNING", result.status === "WARNING");
}

console.log("\n── validateDifficultyDistribution: multiple gaps ────────────");

{
  const result = validateDifficultyDistribution({
    unit: makeUnit(),
    actual: { easy: 0, medium: 0, hard: 0 },
  });
  assert("all gaps → 3 issues", result.issues.length === 3);
  assert("has MISSING_HARD (HIGH)", result.issues.some((i) => i.type === "MISSING_HARD_QUESTIONS" && i.severity === "HIGH"));
  assert("has MISSING_MEDIUM (MEDIUM)", result.issues.some((i) => i.type === "MISSING_MEDIUM_QUESTIONS" && i.severity === "MEDIUM"));
  assert("has MISSING_EASY (LOW)", result.issues.some((i) => i.type === "MISSING_EASY_QUESTIONS" && i.severity === "LOW"));
  assert("status = FAIL (HIGH present)", result.status === "FAIL");
}

console.log("\n── validateDifficultyDistribution: metadata propagation ─────");

{
  const result = validateDifficultyDistribution({
    unit: makeUnit({ id: "ku_abc", topic: "conditionals", label: "Conditionals" }),
    actual: { easy: 5, medium: 5, hard: 3 },
  });
  assert("unitId propagated", result.unitId === "ku_abc");
  assert("topic propagated", result.topic === "conditionals");
  assert("label propagated", result.label === "Conditionals");
}

// ── validateQuestion (composite) ──────────────────────────────────────────────

console.log("\n── validateQuestion: composite ──────────────────────────────");

{
  const result = validateQuestion(makeQuestion(), makeUnit());
  assert("valid question + correct unit → PASS", result.status === "PASS");
  assert("questionId propagated", result.questionId === "q_1");
  assert("no issues", result.issues.length === 0);
}

{
  // HIGH from completeness + MEDIUM from mapping: status = FAIL
  const result = validateQuestion(makeQuestion({ promptText: "", knowledgeUnitId: null }), null);
  assert("missing prompt + not mapped → FAIL (HIGH wins)", result.status === "FAIL");
  assert("has MISSING_PROMPT and NOT_MAPPED issues", result.issues.length === 2);
  assert("MISSING_PROMPT present", result.issues.some((i) => i.type === "MISSING_PROMPT"));
  assert("NOT_MAPPED present", result.issues.some((i) => i.type === "NOT_MAPPED"));
}

{
  // MEDIUM from mapping only: status = WARNING
  const result = validateQuestion(makeQuestion({ knowledgeUnitId: null }), null);
  assert("not mapped only → WARNING", result.status === "WARNING");
}

{
  // Topic mismatch (HIGH from mapping): status = FAIL
  const result = validateQuestion(makeQuestion(), makeUnit({ topic: "past_simple" }));
  assert("topic mismatch → FAIL", result.status === "FAIL");
}

// ── validateQuestions (batch) ─────────────────────────────────────────────────

console.log("\n── validateQuestions: batch ─────────────────────────────────");

{
  const questions = [
    makeQuestion({ id: "q_a", knowledgeUnitId: "ku_1" }),                  // PASS
    makeQuestion({ id: "q_b", promptText: "", knowledgeUnitId: "ku_1" }),   // FAIL
    makeQuestion({ id: "q_c", knowledgeUnitId: null }),                     // WARNING
  ];
  const units = [makeUnit()];
  const results = validateQuestions(questions, units);

  assert("batch returns 3 results", results.length === 3);
  assert("q_a → PASS", results.find((r) => r.questionId === "q_a")?.status === "PASS");
  assert("q_b → FAIL", results.find((r) => r.questionId === "q_b")?.status === "FAIL");
  assert("q_c → WARNING", results.find((r) => r.questionId === "q_c")?.status === "WARNING");
}

{
  // Unknown knowledgeUnitId in batch (unit not in provided list)
  const questions = [makeQuestion({ id: "q_x", knowledgeUnitId: "ku_nonexistent" })];
  const results = validateQuestions(questions, [makeUnit()]);
  assert("unknown kuId → UNIT_NOT_FOUND (HIGH) → FAIL", results[0].status === "FAIL");
  assert("issue is UNIT_NOT_FOUND", results[0].issues.some((i) => i.type === "UNIT_NOT_FOUND"));
}

{
  // Empty batch
  const results = validateQuestions([], [makeUnit()]);
  assert("empty question list → empty results", results.length === 0);
}

// ── deriveStatus edge cases ───────────────────────────────────────────────────

console.log("\n── deriveStatus ─────────────────────────────────────────────");

{
  assert("no issues → PASS", deriveStatus([]) === "PASS");
  assert("LOW only → WARNING", deriveStatus([{ severity: "LOW" }]) === "WARNING");
  assert("MEDIUM only → WARNING", deriveStatus([{ severity: "MEDIUM" }]) === "WARNING");
  assert("HIGH only → FAIL", deriveStatus([{ severity: "HIGH" }]) === "FAIL");
  assert("LOW + MEDIUM → WARNING", deriveStatus([{ severity: "LOW" }, { severity: "MEDIUM" }]) === "WARNING");
  assert("LOW + HIGH → FAIL (HIGH wins)", deriveStatus([{ severity: "LOW" }, { severity: "HIGH" }]) === "FAIL");
  assert("MEDIUM + HIGH → FAIL (HIGH wins)", deriveStatus([{ severity: "MEDIUM" }, { severity: "HIGH" }]) === "FAIL");
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
