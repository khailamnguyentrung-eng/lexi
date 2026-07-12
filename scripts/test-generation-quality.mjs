/**
 * test-generation-quality.mjs — M4.4
 *
 * Tests the deterministic generation quality evaluation engine.
 * Pure logic inlined — no DB, no AI, no TypeScript compilation.
 *
 * Covers:
 *   1. checkDuplicates — exact code, exact prompt, normalized prompt, no match
 *   2. checkTopicAlignment — match and mismatch
 *   3. checkDifficultyConsistency — under target, at target, no target
 *   4. computeScore — deduction table, clamping
 *   5. evaluateDraft — end-to-end consolidated report
 *   6. Edge cases — empty existing list, multiple issues, mixed severities
 *
 * Run: node scripts/test-generation-quality.mjs
 */

// ─────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ─────────────────────────────────────────────────────────
// Inline pure logic from qualityEvaluation.ts
// ─────────────────────────────────────────────────────────

const SCORE_DEDUCTIONS = { HIGH: 30, MEDIUM: 15, LOW: 5 };

function normalizePrompt(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function getTarget(unit, difficulty) {
  if (difficulty === "EASY")   return unit.targetEasyCount;
  if (difficulty === "MEDIUM") return unit.targetMediumCount;
  return unit.targetHardCount;
}

function getActual(unit, difficulty) {
  if (difficulty === "EASY")   return unit.actualEasyCount;
  if (difficulty === "MEDIUM") return unit.actualMediumCount;
  return unit.actualHardCount;
}

function checkDuplicates(draft, existing) {
  const issues = [];
  const draftNorm = normalizePrompt(draft.promptText);
  let exactPromptFound = false;

  for (const entry of existing) {
    if (entry.questionCode === draft.questionCode) {
      issues.push({ type: "DUPLICATE_CODE", severity: "HIGH",
        message: `Question code "${draft.questionCode}" already exists in the content bank.` });
    }

    if (entry.promptText === draft.promptText) {
      exactPromptFound = true;
      issues.push({ type: "DUPLICATE_PROMPT", severity: "HIGH",
        message: "An identical prompt text already exists." });
    } else if (!exactPromptFound && normalizePrompt(entry.promptText) === draftNorm) {
      issues.push({ type: "DUPLICATE_PROMPT_NORMALIZED", severity: "MEDIUM",
        message: "A near-identical prompt was found (same content, different whitespace/capitalisation)." });
    }
  }

  return issues;
}

function checkTopicAlignment(draft, unit) {
  if (draft.topic !== unit.topic) {
    return [{ type: "TOPIC_MISMATCH", severity: "HIGH",
      message: `Draft topic "${draft.topic}" does not match the target KnowledgeUnit topic "${unit.topic}".` }];
  }
  return [];
}

function checkDifficultyConsistency(draft, unit) {
  const target = getTarget(unit, draft.difficulty);
  const actual = getActual(unit, draft.difficulty);

  if (target === 0) {
    return [{ type: "DIFFICULTY_NO_TARGET", severity: "HIGH",
      message: `KnowledgeUnit has no target for ${draft.difficulty} questions (targetCount = 0).` }];
  }
  if (actual >= target) {
    return [{ type: "DIFFICULTY_BAND_AT_TARGET", severity: "MEDIUM",
      message: `The ${draft.difficulty} band already has ${actual} question(s), meeting its target of ${target}.` }];
  }
  return [];
}

function computeScore(issues) {
  const deduction = issues.reduce((sum, issue) => sum + SCORE_DEDUCTIONS[issue.severity], 0);
  return Math.max(0, 100 - deduction);
}

function evaluateDraft(draft, existing, unit) {
  const issues = [
    ...checkDuplicates(draft, existing),
    ...checkTopicAlignment(draft, unit),
    ...checkDifficultyConsistency(draft, unit),
  ];
  return { draftId: draft.draftId, score: computeScore(issues), issues };
}

// ─────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────

function makeDraft(overrides = {}) {
  return {
    draftId: "draft_001",
    questionCode: "GEN_PRESPERF_MED_01",
    promptText: "She __ already finished her homework.",
    topic: "present_perfect",
    difficulty: "MEDIUM",
    ...overrides,
  };
}

function makeUnit(overrides = {}) {
  return {
    topic: "present_perfect",
    targetEasyCount: 5,
    targetMediumCount: 5,
    targetHardCount: 3,
    actualEasyCount: 2,
    actualMediumCount: 1,
    actualHardCount: 0,
    ...overrides,
  };
}

function makeSnapshot(overrides = {}) {
  return {
    questionCode: "EXISTING_Q01",
    promptText: "He __ just arrived at the airport.",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// 1. checkDuplicates
// ─────────────────────────────────────────────────────────

section("1. checkDuplicates — exact code match");

{
  const draft = makeDraft();
  const existing = [makeSnapshot({ questionCode: "GEN_PRESPERF_MED_01" })]; // same code
  const issues = checkDuplicates(draft, existing);

  assert("issue type is DUPLICATE_CODE", issues.some(i => i.type === "DUPLICATE_CODE"));
  assert("severity is HIGH", issues.find(i => i.type === "DUPLICATE_CODE")?.severity === "HIGH");
  assert("message mentions the code", issues.find(i => i.type === "DUPLICATE_CODE")?.message.includes("GEN_PRESPERF_MED_01"));
}

section("1. checkDuplicates — exact prompt match");

{
  const draft = makeDraft();
  const existing = [makeSnapshot({ promptText: "She __ already finished her homework." })]; // same prompt
  const issues = checkDuplicates(draft, existing);

  assert("issue type is DUPLICATE_PROMPT", issues.some(i => i.type === "DUPLICATE_PROMPT"));
  assert("severity is HIGH", issues.find(i => i.type === "DUPLICATE_PROMPT")?.severity === "HIGH");
  assert("no NORMALIZED issue when exact match found", !issues.some(i => i.type === "DUPLICATE_PROMPT_NORMALIZED"));
}

section("1. checkDuplicates — normalized prompt match (whitespace diff)");

{
  const draft = makeDraft({ promptText: "She has  already  finished." }); // extra spaces
  const existing = [makeSnapshot({ promptText: "She has already finished." })]; // normalised same
  const issues = checkDuplicates(draft, existing);

  assert("no exact DUPLICATE_PROMPT (raw strings differ)", !issues.some(i => i.type === "DUPLICATE_PROMPT"));
  assert("DUPLICATE_PROMPT_NORMALIZED raised", issues.some(i => i.type === "DUPLICATE_PROMPT_NORMALIZED"));
  assert("severity is MEDIUM", issues.find(i => i.type === "DUPLICATE_PROMPT_NORMALIZED")?.severity === "MEDIUM");
}

section("1. checkDuplicates — normalized match (case diff)");

{
  const draft = makeDraft({ promptText: "SHE HAS ALREADY FINISHED." });
  const existing = [makeSnapshot({ promptText: "she has already finished." })];
  const issues = checkDuplicates(draft, existing);

  assert("case-only diff detected as NORMALIZED", issues.some(i => i.type === "DUPLICATE_PROMPT_NORMALIZED"));
}

section("1. checkDuplicates — no existing content");

{
  const draft = makeDraft();
  const issues = checkDuplicates(draft, []);

  assert("no issues when existing is empty", issues.length === 0);
}

section("1. checkDuplicates — no match");

{
  const draft = makeDraft();
  const existing = [makeSnapshot()]; // different code and prompt
  const issues = checkDuplicates(draft, existing);

  assert("no issues when no match", issues.length === 0);
}

section("1. checkDuplicates — code and prompt collision on different entries");

{
  const draft = makeDraft();
  const existing = [
    makeSnapshot({ questionCode: "GEN_PRESPERF_MED_01" }), // code match on entry 0
    makeSnapshot({ questionCode: "OTHER_Q01", promptText: "She __ already finished her homework." }), // prompt match on entry 1
  ];
  const issues = checkDuplicates(draft, existing);

  assert("DUPLICATE_CODE raised", issues.some(i => i.type === "DUPLICATE_CODE"));
  assert("DUPLICATE_PROMPT raised", issues.some(i => i.type === "DUPLICATE_PROMPT"));
  assert("total 2 issues", issues.length === 2);
}

section("1. checkDuplicates — exact prompt match suppresses normalized on same entry");

{
  const prompt = "She __ already finished her homework.";
  const draft = makeDraft({ promptText: prompt });
  // Only one entry; same exact prompt, same normalized — should see only DUPLICATE_PROMPT
  const existing = [makeSnapshot({ promptText: prompt })];
  const issues = checkDuplicates(draft, existing);

  assert("DUPLICATE_PROMPT raised", issues.some(i => i.type === "DUPLICATE_PROMPT"));
  assert("NORMALIZED not raised (exact already found)", !issues.some(i => i.type === "DUPLICATE_PROMPT_NORMALIZED"));
}

section("1. checkDuplicates — multiple entries, only normalized match exists");

{
  const draft = makeDraft({ promptText: "   She has finished.   " });
  const existing = [
    makeSnapshot({ promptText: "She has finished." }),  // normalized match
    makeSnapshot({ questionCode: "Q99", promptText: "Completely different question." }),
  ];
  const issues = checkDuplicates(draft, existing);

  assert("one MEDIUM normalized issue", issues.filter(i => i.type === "DUPLICATE_PROMPT_NORMALIZED").length === 1);
}

// ─────────────────────────────────────────────────────────
// 2. checkTopicAlignment
// ─────────────────────────────────────────────────────────

section("2. checkTopicAlignment — matching topic");

{
  const draft = makeDraft({ topic: "present_perfect" });
  const unit = makeUnit({ topic: "present_perfect" });
  const issues = checkTopicAlignment(draft, unit);

  assert("no issues on topic match", issues.length === 0);
}

section("2. checkTopicAlignment — mismatched topic");

{
  const draft = makeDraft({ topic: "past_simple" });
  const unit = makeUnit({ topic: "present_perfect" });
  const issues = checkTopicAlignment(draft, unit);

  assert("TOPIC_MISMATCH raised", issues.some(i => i.type === "TOPIC_MISMATCH"));
  assert("severity is HIGH", issues.find(i => i.type === "TOPIC_MISMATCH")?.severity === "HIGH");
  assert("message contains draft topic", issues[0].message.includes("past_simple"));
  assert("message contains unit topic", issues[0].message.includes("present_perfect"));
}

section("2. checkTopicAlignment — case-sensitive match");

{
  // topic is snake_case by convention; case mismatch is a real mismatch
  const draft = makeDraft({ topic: "Present_Perfect" });
  const unit = makeUnit({ topic: "present_perfect" });
  const issues = checkTopicAlignment(draft, unit);

  assert("case difference is a mismatch", issues.some(i => i.type === "TOPIC_MISMATCH"));
}

section("2. checkTopicAlignment — different topic families");

{
  const cases = [
    ["present_perfect", "past_perfect"],
    ["conditional_type_1", "conditional_type_2"],
    ["reported_speech", "passive_voice"],
  ];

  for (const [draftTopic, unitTopic] of cases) {
    const issues = checkTopicAlignment({ topic: draftTopic }, { topic: unitTopic });
    assert(`mismatch detected: ${draftTopic} vs ${unitTopic}`, issues.some(i => i.type === "TOPIC_MISMATCH"));
  }
}

// ─────────────────────────────────────────────────────────
// 3. checkDifficultyConsistency
// ─────────────────────────────────────────────────────────

section("3. checkDifficultyConsistency — band has gap (no issue)");

{
  const draft = makeDraft({ difficulty: "MEDIUM" });
  const unit = makeUnit({ targetMediumCount: 5, actualMediumCount: 2 }); // gap of 3
  const issues = checkDifficultyConsistency(draft, unit);

  assert("no issue when gap exists", issues.length === 0);
}

section("3. checkDifficultyConsistency — band exactly at target");

{
  const draft = makeDraft({ difficulty: "MEDIUM" });
  const unit = makeUnit({ targetMediumCount: 5, actualMediumCount: 5 }); // at target
  const issues = checkDifficultyConsistency(draft, unit);

  assert("DIFFICULTY_BAND_AT_TARGET raised", issues.some(i => i.type === "DIFFICULTY_BAND_AT_TARGET"));
  assert("severity is MEDIUM", issues.find(i => i.type === "DIFFICULTY_BAND_AT_TARGET")?.severity === "MEDIUM");
  assert("message mentions actual count", issues[0].message.includes("5"));
}

section("3. checkDifficultyConsistency — band above target");

{
  const draft = makeDraft({ difficulty: "EASY" });
  const unit = makeUnit({ targetEasyCount: 5, actualEasyCount: 7 }); // over target
  const issues = checkDifficultyConsistency(draft, unit);

  assert("DIFFICULTY_BAND_AT_TARGET raised when actual > target", issues.some(i => i.type === "DIFFICULTY_BAND_AT_TARGET"));
}

section("3. checkDifficultyConsistency — target is zero (HIGH)");

{
  const draft = makeDraft({ difficulty: "HARD" });
  const unit = makeUnit({ targetHardCount: 0, actualHardCount: 0 });
  const issues = checkDifficultyConsistency(draft, unit);

  assert("DIFFICULTY_NO_TARGET raised", issues.some(i => i.type === "DIFFICULTY_NO_TARGET"));
  assert("severity is HIGH", issues.find(i => i.type === "DIFFICULTY_NO_TARGET")?.severity === "HIGH");
  assert("message mentions HARD", issues[0].message.includes("HARD"));
}

section("3. checkDifficultyConsistency — all three bands checked independently");

{
  const unitDef = makeUnit({
    targetEasyCount: 0,   // no easy target
    targetMediumCount: 5, // has gap
    targetHardCount: 3,   // at target
    actualEasyCount: 0,
    actualMediumCount: 2,
    actualHardCount: 3,
  });

  const easyIssues = checkDifficultyConsistency({ difficulty: "EASY" }, unitDef);
  const medIssues  = checkDifficultyConsistency({ difficulty: "MEDIUM" }, unitDef);
  const hardIssues = checkDifficultyConsistency({ difficulty: "HARD" }, unitDef);

  assert("EASY band: DIFFICULTY_NO_TARGET (target=0)", easyIssues.some(i => i.type === "DIFFICULTY_NO_TARGET"));
  assert("MEDIUM band: no issue (gap exists)", medIssues.length === 0);
  assert("HARD band: DIFFICULTY_BAND_AT_TARGET (actual=target)", hardIssues.some(i => i.type === "DIFFICULTY_BAND_AT_TARGET"));
}

// ─────────────────────────────────────────────────────────
// 4. computeScore
// ─────────────────────────────────────────────────────────

section("4. computeScore — score table");

{
  assert("no issues → 100", computeScore([]) === 100);

  assert("one HIGH → 70",   computeScore([{ severity: "HIGH" }]) === 70);
  assert("one MEDIUM → 85", computeScore([{ severity: "MEDIUM" }]) === 85);
  assert("one LOW → 95",    computeScore([{ severity: "LOW" }]) === 95);

  assert("two HIGH → 40",   computeScore([{ severity: "HIGH" }, { severity: "HIGH" }]) === 40);
  assert("HIGH + MEDIUM → 55", computeScore([{ severity: "HIGH" }, { severity: "MEDIUM" }]) === 55);
  assert("MEDIUM + LOW → 80", computeScore([{ severity: "MEDIUM" }, { severity: "LOW" }]) === 80);
}

section("4. computeScore — clamped to 0");

{
  // 4 HIGHs = 120 deduction → clamped to 0
  const issues = Array.from({ length: 4 }, () => ({ severity: "HIGH" }));
  assert("score clamped to 0 (not negative)", computeScore(issues) === 0);

  // 3 HIGHs = 90 deduction
  const issues3 = Array.from({ length: 3 }, () => ({ severity: "HIGH" }));
  assert("3 HIGHs → 10", computeScore(issues3) === 10);
}

section("4. computeScore — boundary values");

{
  // exactly 100 deduction = 0
  const exact100 = [
    { severity: "HIGH" }, { severity: "HIGH" }, { severity: "HIGH" }, // 90
    { severity: "LOW" }, { severity: "LOW" },                          // 10
  ];
  assert("deductions summing to 100 → score 0", computeScore(exact100) === 0);

  // 99 deduction = score 1
  const ninety9 = [
    { severity: "HIGH" }, { severity: "HIGH" }, { severity: "HIGH" }, // 90
    { severity: "MEDIUM" },                                            // 15 → total 105 → 0 actually
  ];
  assert("deductions > 100 still clamps to 0", computeScore(ninety9) === 0);
}

// ─────────────────────────────────────────────────────────
// 5. evaluateDraft — end-to-end
// ─────────────────────────────────────────────────────────

section("5. evaluateDraft — clean draft (all checks pass)");

{
  const draft = makeDraft();
  const unit = makeUnit();
  const report = evaluateDraft(draft, [], unit);

  assert("draftId preserved", report.draftId === "draft_001");
  assert("score is 100 with no issues", report.score === 100);
  assert("issues array is empty", report.issues.length === 0);
}

section("5. evaluateDraft — duplicate code only");

{
  const draft = makeDraft();
  const existing = [makeSnapshot({ questionCode: draft.questionCode })];
  const unit = makeUnit();
  const report = evaluateDraft(draft, existing, unit);

  assert("DUPLICATE_CODE in issues", report.issues.some(i => i.type === "DUPLICATE_CODE"));
  assert("score deducted by 30 (HIGH)", report.score === 70);
}

section("5. evaluateDraft — topic mismatch only");

{
  const draft = makeDraft({ topic: "past_simple" });
  const unit = makeUnit({ topic: "present_perfect" });
  const report = evaluateDraft(draft, [], unit);

  assert("TOPIC_MISMATCH in issues", report.issues.some(i => i.type === "TOPIC_MISMATCH"));
  assert("score is 70 (one HIGH)", report.score === 70);
}

section("5. evaluateDraft — difficulty at target only");

{
  const draft = makeDraft({ difficulty: "MEDIUM" });
  const unit = makeUnit({ targetMediumCount: 5, actualMediumCount: 5 });
  const report = evaluateDraft(draft, [], unit);

  assert("DIFFICULTY_BAND_AT_TARGET in issues", report.issues.some(i => i.type === "DIFFICULTY_BAND_AT_TARGET"));
  assert("score is 85 (one MEDIUM)", report.score === 85);
}

section("5. evaluateDraft — multiple checks failing simultaneously");

{
  const draft = makeDraft({ topic: "past_simple", difficulty: "HARD" });
  const existing = [makeSnapshot({ questionCode: draft.questionCode })]; // code dup
  const unit = makeUnit({
    topic: "present_perfect",      // topic mismatch → HIGH
    targetHardCount: 0,            // no target → HIGH
    actualHardCount: 0,
  });
  const report = evaluateDraft(draft, existing, unit);

  // 3 HIGHs: DUPLICATE_CODE + TOPIC_MISMATCH + DIFFICULTY_NO_TARGET = -90 → score 10
  assert("three HIGH issues detected", report.issues.filter(i => i.severity === "HIGH").length === 3);
  assert("score reflects all three HIGHs (100 - 90 = 10)", report.score === 10);
}

section("5. evaluateDraft — normalized duplicate + at-target difficulty");

{
  const draft = makeDraft({ promptText: "  she has finished her work.  " });
  const existing = [makeSnapshot({ promptText: "she has finished her work." })]; // normalized match
  const unit = makeUnit({ targetMediumCount: 5, actualMediumCount: 5 }); // at target
  const report = evaluateDraft(draft, existing, unit);

  // MEDIUM (normalized dup) + MEDIUM (at target) = 15 + 15 = 30 deduction → 70
  assert("NORMALIZED and AT_TARGET both in issues", report.issues.length === 2);
  assert("both are MEDIUM severity", report.issues.every(i => i.severity === "MEDIUM"));
  assert("score is 70 (two MEDIUMs)", report.score === 70);
}

section("5. evaluateDraft — report structure invariants");

{
  const draft = makeDraft();
  const report = evaluateDraft(draft, [], makeUnit());

  assert("report has draftId field", "draftId" in report);
  assert("report has score field", "score" in report);
  assert("report has issues field", "issues" in report);
  assert("issues is an array", Array.isArray(report.issues));
  assert("score is a number", typeof report.score === "number");
  assert("score is in range [0,100]", report.score >= 0 && report.score <= 100);
}

// ─────────────────────────────────────────────────────────
// 6. Edge cases
// ─────────────────────────────────────────────────────────

section("6. Edge cases — empty promptText normalized equality");

{
  // Two empty prompts — exact match, not normalized
  const draft = makeDraft({ promptText: "" });
  const existing = [makeSnapshot({ promptText: "" })];
  const issues = checkDuplicates(draft, existing);

  assert("empty prompt exact match → DUPLICATE_PROMPT (HIGH)", issues.some(i => i.type === "DUPLICATE_PROMPT"));
}

section("6. Edge cases — whitespace-only prompts treated as equal to empty after normalize");

{
  const draft = makeDraft({ promptText: "   " });
  const existing = [makeSnapshot({ promptText: "" })];
  const issues = checkDuplicates(draft, existing);

  // "   " normalizes to "" and "" normalizes to "" → normalized match (MEDIUM)
  // (exact raw strings differ: "   " vs "")
  assert("whitespace-only vs empty: normalized MEDIUM match", issues.some(i => i.type === "DUPLICATE_PROMPT_NORMALIZED"));
}

section("6. Edge cases — EASY/MEDIUM/HARD target helpers are consistent");

{
  const unit = makeUnit({
    targetEasyCount: 5, targetMediumCount: 10, targetHardCount: 3,
    actualEasyCount: 1, actualMediumCount: 10, actualHardCount: 0,
  });

  assert("EASY getTarget=5",   getTarget(unit, "EASY")   === 5);
  assert("MEDIUM getTarget=10", getTarget(unit, "MEDIUM") === 10);
  assert("HARD getTarget=3",   getTarget(unit, "HARD")   === 3);

  assert("EASY getActual=1",   getActual(unit, "EASY")   === 1);
  assert("MEDIUM getActual=10", getActual(unit, "MEDIUM") === 10);
  assert("HARD getActual=0",   getActual(unit, "HARD")   === 0);
}

section("6. Edge cases — large existing list, no duplicates");

{
  const draft = makeDraft();
  const existing = Array.from({ length: 50 }, (_, i) => ({
    questionCode: `OTHER_Q${String(i).padStart(2, "0")}`,
    promptText: `Question ${i}: Choose the correct form.`,
  }));
  const issues = checkDuplicates(draft, existing);

  assert("no false positives in 50-entry list", issues.length === 0);
}

section("6. Edge cases — quality is assistive, not gating (pure informational)");

{
  // Verify: evaluateDraft returns a report but does NOT throw or mutate state.
  // A draft with maximum issues still produces a valid report (not an exception).
  const terrible = makeDraft({ topic: "wrong_topic", difficulty: "HARD" });
  const existing = [makeSnapshot({ questionCode: terrible.questionCode,
                                   promptText: terrible.promptText })];
  const unit = makeUnit({ topic: "correct_topic", targetHardCount: 0, actualHardCount: 0 });

  let report;
  let threw = false;
  try {
    report = evaluateDraft(terrible, existing, unit);
  } catch {
    threw = true;
  }

  assert("evaluateDraft never throws (informational only)", !threw);
  assert("report still has draftId even with max issues", report?.draftId === terrible.draftId);
  assert("report score clamped to 0 with catastrophic issues", report?.score === 0);
}

// ─────────────────────────────────────────────────────────
// 7. AI invariants — no auto-action, no new model calls
// ─────────────────────────────────────────────────────────

section("7. Engine invariants — pure, synchronous, no side effects");

{
  // All exported functions are synchronous (not Promise-returning).
  const draft = makeDraft();
  const unit = makeUnit();

  const r1 = checkDuplicates(draft, []);
  const r2 = checkTopicAlignment(draft, unit);
  const r3 = checkDifficultyConsistency(draft, unit);
  const r4 = computeScore([]);
  const r5 = evaluateDraft(draft, [], unit);

  assert("checkDuplicates is synchronous (not a Promise)", !(r1 instanceof Promise));
  assert("checkTopicAlignment is synchronous", !(r2 instanceof Promise));
  assert("checkDifficultyConsistency is synchronous", !(r3 instanceof Promise));
  assert("computeScore is synchronous", !(r4 instanceof Promise));
  assert("evaluateDraft is synchronous", !(r5 instanceof Promise));
}

{
  // Calling evaluateDraft twice on same input produces identical output — no state.
  const draft = makeDraft();
  const existing = [makeSnapshot({ questionCode: draft.questionCode })];
  const unit = makeUnit();

  const a = evaluateDraft(draft, existing, unit);
  const b = evaluateDraft(draft, existing, unit);

  assert("same inputs → same score (deterministic)", a.score === b.score);
  assert("same inputs → same issue count (deterministic)", a.issues.length === b.issues.length);
}

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`M4.4 Generation Quality Evaluation: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
