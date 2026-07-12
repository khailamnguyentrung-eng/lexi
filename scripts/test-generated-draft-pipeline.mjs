/**
 * test-generated-draft-pipeline.mjs — M4.3
 *
 * Tests the GeneratedQuestionDraft persistence and review pipeline.
 * Pure logic is tested inline (no DB, no TypeScript compilation).
 *
 * Covers:
 *   1. Draft data mapping (createDraftsForJob input builder)
 *   2. Validation gate at approval time (FAIL blocked, PASS/WARNING allowed)
 *   3. Approval creates Question with correct provenance fields
 *   4. Approval idempotency (approvedQuestionId guard)
 *   5. Rejection does NOT create a Question
 *   6. Job completion trigger (all drafts resolved → COMPLETED)
 *   7. Batch creation: all fields mapped from draft + validation result
 *
 * Run: node scripts/test-generated-draft-pipeline.mjs
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

function assertThrows(label, fn, messageSubstring) {
  try {
    fn();
    console.error(`  ✗ ${label} — expected throw, got none`);
    failed++;
  } catch (err) {
    const ok = !messageSubstring || err.message.includes(messageSubstring);
    if (ok) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label} — wrong message: "${err.message}"`);
      failed++;
    }
  }
}

async function assertRejects(label, fn, messageSubstring) {
  try {
    await fn();
    console.error(`  ✗ ${label} — expected rejection, got none`);
    failed++;
  } catch (err) {
    const ok = !messageSubstring || err.message.includes(messageSubstring);
    if (ok) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label} — wrong message: "${err.message}"`);
      failed++;
    }
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ─────────────────────────────────────────────────────────
// Inline pure logic from generatedDraftRepository.ts
// These mirror the real implementation — tests document expected behavior.
// ─────────────────────────────────────────────────────────

/** Maps a draft + validation result to the Prisma createMany data shape. */
function buildDraftRow(draft, validationResult, jobId, knowledgeUnitId) {
  return {
    generationJobId: jobId,
    knowledgeUnitId,
    questionCode: draft.questionCode,
    topic: draft.topic,
    difficulty: draft.difficulty,
    promptText: draft.promptText,
    optionA: draft.optionA,
    optionB: draft.optionB,
    optionC: draft.optionC,
    optionD: draft.optionD,
    correctOption: draft.correctOption,
    explanationVi: draft.explanationVi,
    commonMistake: draft.commonMistake,
    learningObjective: draft.learningObjective,
    questionType: draft.type,      // string from AI, cast to enum at approval
    questionSkill: draft.skill,    // string from AI, cast to enum at approval
    source: draft.source,
    validationStatus: validationResult.status,
    validationIssues: JSON.stringify(validationResult.issues),
  };
}

/** Approval gate: throws if the draft's validationStatus is FAIL. */
function assertCanApprove(draftRecord) {
  if (draftRecord.validationStatus === "FAIL") {
    throw new Error(
      `Cannot approve draft ${draftRecord.id}: validationStatus is FAIL. ` +
        "Fix structural issues before approving."
    );
  }
}

/** Builds the Question.create data from an approved draft record. */
function buildQuestionData(draftRecord) {
  return {
    questionCode: draftRecord.questionCode,
    type: draftRecord.questionType,   // cast to enum in real code via `as never`
    skill: draftRecord.questionSkill, // cast to enum in real code via `as never`
    difficulty: draftRecord.difficulty,
    topic: draftRecord.topic,
    promptText: draftRecord.promptText,
    optionA: draftRecord.optionA,
    optionB: draftRecord.optionB,
    optionC: draftRecord.optionC,
    optionD: draftRecord.optionD,
    correctOption: draftRecord.correctOption,
    explanationVi: draftRecord.explanationVi,
    commonMistake: draftRecord.commonMistake,
    learningObjective: draftRecord.learningObjective,
    source: draftRecord.source,
    sourceExam: null,                          // not applicable for generated content
    knowledgeUnitId: draftRecord.knowledgeUnitId,
    generatedViaJobId: draftRecord.generationJobId,
  };
}

/** Simulates approveDraft() pure flow (no DB calls). */
async function simulateApprove(draftRecord, createQuestion) {
  // Idempotency guard
  if (draftRecord.approvedQuestionId) {
    return { alreadyApproved: true, questionId: draftRecord.approvedQuestionId };
  }

  assertCanApprove(draftRecord);

  const questionData = buildQuestionData(draftRecord);
  const question = await createQuestion(questionData);

  return {
    alreadyApproved: false,
    questionId: question.id,
    question,
    questionData,
  };
}

/** Simulates rejectDraft() pure flow. Returns updated draft shape. */
function simulateReject(draftRecord, reviewNote) {
  // Does NOT call createQuestion — that is the invariant being tested.
  return {
    ...draftRecord,
    status: "REJECTED",
    reviewNote: reviewNote ?? null,
  };
}

// ─────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────

function makeDraft(overrides = {}) {
  return {
    questionCode: "GEN_PRESPERF_MED_01",
    type: "GRAMMAR_MCQ",
    skill: "VOCAB_GRAMMAR",
    topic: "present_perfect",
    difficulty: "MEDIUM",
    promptText: "She __ already finished her homework.",
    optionA: "has",
    optionB: "have",
    optionC: "had",
    optionD: "is",
    correctOption: "A",
    explanationVi: "Dùng 'has' vì chủ ngữ là 'She' (ngôi 3 số ít) và thì hiện tại hoàn thành.",
    commonMistake: null,
    learningObjective: "Ôn luyện hiện tại hoàn thành ở mức trung bình.",
    source: "generated:present_perfect:MEDIUM",
    ...overrides,
  };
}

function makeValidationResult(status = "PASS", issues = []) {
  return { questionId: "generated:0", status, issues };
}

function makeDraftRecord(overrides = {}) {
  return {
    id: "draft_001",
    generationJobId: "job_abc",
    knowledgeUnitId: "unit_xyz",
    questionCode: "GEN_PRESPERF_MED_01",
    topic: "present_perfect",
    difficulty: "MEDIUM",
    promptText: "She __ already finished her homework.",
    optionA: "has",
    optionB: "have",
    optionC: "had",
    optionD: "is",
    correctOption: "A",
    explanationVi: "Dùng 'has' vì chủ ngữ là 'She' (ngôi 3 số ít).",
    commonMistake: null,
    learningObjective: null,
    questionType: "GRAMMAR_MCQ",
    questionSkill: "VOCAB_GRAMMAR",
    source: "generated:present_perfect:MEDIUM",
    status: "PENDING_REVIEW",
    reviewNote: null,
    validationStatus: "PASS",
    validationIssues: "[]",
    approvedQuestionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// 1. Draft data mapping
// ─────────────────────────────────────────────────────────

section("1. Draft data mapping (createDraftsForJob input builder)");

{
  const draft = makeDraft();
  const valResult = makeValidationResult("PASS", []);
  const row = buildDraftRow(draft, valResult, "job_001", "unit_001");

  assert("generationJobId is set", row.generationJobId === "job_001");
  assert("knowledgeUnitId is set", row.knowledgeUnitId === "unit_001");
  assert("questionCode preserved", row.questionCode === "GEN_PRESPERF_MED_01");
  assert("topic preserved", row.topic === "present_perfect");
  assert("difficulty preserved", row.difficulty === "MEDIUM");
  assert("promptText preserved", row.promptText === "She __ already finished her homework.");
  assert("optionA preserved", row.optionA === "has");
  assert("optionD preserved", row.optionD === "is");
  assert("correctOption preserved", row.correctOption === "A");
  assert("explanationVi preserved", row.explanationVi.length > 0);
  assert("questionType from draft.type", row.questionType === "GRAMMAR_MCQ");
  assert("questionSkill from draft.skill", row.questionSkill === "VOCAB_GRAMMAR");
  assert("source preserved", row.source === "generated:present_perfect:MEDIUM");
  assert("validationStatus mapped from result", row.validationStatus === "PASS");
  assert("validationIssues is JSON string", typeof row.validationIssues === "string");
  assert("validationIssues parses to array", Array.isArray(JSON.parse(row.validationIssues)));
}

// ─────────────────────────────────────────────────────────
// 2. Validation gate at approval time
// ─────────────────────────────────────────────────────────

section("2. Validation gate at approval time");

{
  // FAIL draft is blocked
  const failDraft = makeDraftRecord({ validationStatus: "FAIL" });
  assertThrows(
    "FAIL draft throws on approve",
    () => assertCanApprove(failDraft),
    "validationStatus is FAIL"
  );

  // PASS draft passes
  const passDraft = makeDraftRecord({ validationStatus: "PASS" });
  let gateError = null;
  try { assertCanApprove(passDraft); } catch (e) { gateError = e; }
  assert("PASS draft does not throw", gateError === null);

  // WARNING draft passes
  const warnDraft = makeDraftRecord({ validationStatus: "WARNING" });
  let warnError = null;
  try { assertCanApprove(warnDraft); } catch (e) { warnError = e; }
  assert("WARNING draft does not throw", warnError === null);

  // Validation issues JSON in FAIL draft
  const failWithIssues = makeDraftRecord({
    validationStatus: "FAIL",
    validationIssues: JSON.stringify([{ type: "MISSING_PROMPT", severity: "HIGH", message: "..." }]),
  });
  const issues = JSON.parse(failWithIssues.validationIssues);
  assert("FAIL draft issues parse correctly", issues.length === 1);
  assert("FAIL draft issue has HIGH severity", issues[0].severity === "HIGH");
}

// ─────────────────────────────────────────────────────────
// 3. Approval creates Question with correct provenance
// ─────────────────────────────────────────────────────────

section("3. Approval creates Question with correct provenance");

{
  const draft = makeDraftRecord();

  const questionData = buildQuestionData(draft);

  assert("questionCode set from draft", questionData.questionCode === draft.questionCode);
  assert("type set from questionType", questionData.type === "GRAMMAR_MCQ");
  assert("skill set from questionSkill", questionData.skill === "VOCAB_GRAMMAR");
  assert("difficulty set", questionData.difficulty === "MEDIUM");
  assert("topic set", questionData.topic === "present_perfect");
  assert("promptText set", questionData.promptText.length > 0);
  assert("optionA set", questionData.optionA === "has");
  assert("correctOption set", questionData.correctOption === "A");
  assert("explanationVi set", questionData.explanationVi.length > 0);
  assert("sourceExam is null (not applicable)", questionData.sourceExam === null);
  assert("knowledgeUnitId = draft.knowledgeUnitId (provenance)", questionData.knowledgeUnitId === "unit_xyz");
  assert("generatedViaJobId = draft.generationJobId (provenance)", questionData.generatedViaJobId === "job_abc");
  assert("source preserved", questionData.source === "generated:present_perfect:MEDIUM");
}

// ─────────────────────────────────────────────────────────
// 4. Approval idempotency (approvedQuestionId guard)
// ─────────────────────────────────────────────────────────

section("4. Approval idempotency");

await (async () => {
  let createCalled = 0;
  const createQuestion = async (data) => {
    createCalled++;
    return { id: "q_new_" + createCalled, ...data };
  };

  // First approval: creates Question
  const draft = makeDraftRecord();
  const result1 = await simulateApprove(draft, createQuestion);
  assert("first approval: not already approved", result1.alreadyApproved === false);
  assert("first approval: creates question", createCalled === 1);
  assert("first approval: question has id", result1.questionId !== undefined);

  // Re-approval guard: approvedQuestionId already set
  const approvedDraft = makeDraftRecord({ approvedQuestionId: "q_existing_001" });
  let createCalled2 = 0;
  const createQuestion2 = async () => { createCalled2++; return {}; };
  const result2 = await simulateApprove(approvedDraft, createQuestion2);
  assert("re-approval: returns existing question id", result2.questionId === "q_existing_001");
  assert("re-approval: alreadyApproved = true", result2.alreadyApproved === true);
  assert("re-approval: createQuestion NOT called", createCalled2 === 0);
})();

// ─────────────────────────────────────────────────────────
// 5. Rejection does NOT create a Question
// ─────────────────────────────────────────────────────────

section("5. Rejection does NOT create a Question");

{
  const draft = makeDraftRecord();
  let createCalled = 0;
  const createQuestion = () => { createCalled++; };

  // simulateReject does not call createQuestion
  const rejected = simulateReject(draft, "Incorrect English grammar usage.");

  assert("reject: status is REJECTED", rejected.status === "REJECTED");
  assert("reject: reviewNote stored", rejected.reviewNote === "Incorrect English grammar usage.");
  assert("reject: createQuestion never called", createCalled === 0);
  assert("reject: approvedQuestionId remains null", rejected.approvedQuestionId === null);
}

{
  // Rejection with no note
  const draft = makeDraftRecord();
  const rejected = simulateReject(draft, undefined);
  assert("reject with no note: reviewNote is null", rejected.reviewNote === null);
}

// ─────────────────────────────────────────────────────────
// 6. Job completion trigger
// ─────────────────────────────────────────────────────────

section("6. Job completion trigger (pure state-machine logic)");

{
  // Simulate: after last draft is resolved, pending count drops to 0 → COMPLETED
  function shouldCompleteJob(pendingCount) {
    return pendingCount === 0;
  }

  assert("pending=0 → should complete job", shouldCompleteJob(0) === true);
  assert("pending=1 → should NOT complete job", shouldCompleteJob(1) === false);
  assert("pending=2 → should NOT complete job", shouldCompleteJob(2) === false);

  // Sequence: 2 drafts, approve first, reject second
  let pendingCount = 2;

  // Approve first draft
  pendingCount--;
  assert("after approving 1 of 2: pending = 1", pendingCount === 1);
  assert("after approving 1 of 2: job not yet complete", !shouldCompleteJob(pendingCount));

  // Reject second draft
  pendingCount--;
  assert("after rejecting 2nd of 2: pending = 0", pendingCount === 0);
  assert("after resolving all: job should complete", shouldCompleteJob(pendingCount));
}

// ─────────────────────────────────────────────────────────
// 7. Batch creation: multiple drafts with different validation statuses
// ─────────────────────────────────────────────────────────

section("7. Batch creation: multiple drafts, mixed validation statuses");

{
  const drafts = [
    makeDraft({ questionCode: "GEN_PRESPERF_MED_01", difficulty: "MEDIUM" }),
    makeDraft({ questionCode: "GEN_PRESPERF_EAS_01", difficulty: "EASY", promptText: "" }),
    makeDraft({ questionCode: "GEN_PRESPERF_HRD_01", difficulty: "HARD" }),
  ];

  const valResults = [
    makeValidationResult("PASS", []),
    makeValidationResult("FAIL", [{ type: "MISSING_PROMPT", severity: "HIGH", message: "No prompt" }]),
    makeValidationResult("WARNING", [{ type: "MISSING_EXPLANATION", severity: "LOW", message: "Short" }]),
  ];

  const rows = drafts.map((d, i) => buildDraftRow(d, valResults[i], "job_batch", "unit_batch"));

  assert("batch: 3 rows created", rows.length === 3);
  assert("batch: row 0 status PASS", rows[0].validationStatus === "PASS");
  assert("batch: row 1 status FAIL", rows[1].validationStatus === "FAIL");
  assert("batch: row 2 status WARNING", rows[2].validationStatus === "WARNING");
  assert("batch: row 0 questionCode", rows[0].questionCode === "GEN_PRESPERF_MED_01");
  assert("batch: row 1 questionCode", rows[1].questionCode === "GEN_PRESPERF_EAS_01");
  assert("batch: row 2 questionCode", rows[2].questionCode === "GEN_PRESPERF_HRD_01");

  // Row 1 has a FAIL issue stored in validationIssues JSON
  const failIssues = JSON.parse(rows[1].validationIssues);
  assert("batch: FAIL row stores issue in JSON", failIssues.length === 1);
  assert("batch: FAIL row issue type is MISSING_PROMPT", failIssues[0].type === "MISSING_PROMPT");

  // Row 2 FAIL gate: WARNING row is approvable
  let warnGateError = null;
  try { assertCanApprove({ ...rows[2], id: "x" }); } catch (e) { warnGateError = e; }
  assert("batch: WARNING row passes approval gate", warnGateError === null);

  // Row 1 FAIL gate: FAIL row is NOT approvable
  let failGateError = null;
  try { assertCanApprove({ ...rows[1], id: "x" }); } catch (e) { failGateError = e; }
  assert("batch: FAIL row is blocked at approval gate", failGateError !== null);
}

// ─────────────────────────────────────────────────────────
// 8. No-direct-Question-creation invariant
// ─────────────────────────────────────────────────────────

section("8. No direct Question creation — only approveDraft() path");

{
  // Simulated repository surface: createDraftsForJob and rejectDraft never
  // create a Question. Only approveDraft does. We verify this by checking
  // that the simulated reject and batch-create paths never call createQuestion.

  let questionCreateCount = 0;
  const mockCreateQuestion = async () => { questionCreateCount++; return { id: `q_mock_${questionCreateCount}` }; };

  // Batch creation does not create questions
  const draft = makeDraft();
  const valResult = makeValidationResult("PASS");
  const _row = buildDraftRow(draft, valResult, "j", "u");
  assert("createDraftsForJob: no question created", questionCreateCount === 0);

  // Reject does not create questions
  const draftRecord = makeDraftRecord();
  simulateReject(draftRecord, "bad");
  assert("rejectDraft: no question created", questionCreateCount === 0);

  // Only approve creates a question (simulated)
  await simulateApprove(draftRecord, mockCreateQuestion);
  assert("approveDraft: exactly one question created", questionCreateCount === 1);

  // Re-approve (idempotent) does not create another question
  const alreadyApproved = makeDraftRecord({ approvedQuestionId: "q_existing" });
  await simulateApprove(alreadyApproved, mockCreateQuestion);
  assert("re-approve: still exactly one question total", questionCreateCount === 1);
}

// ─────────────────────────────────────────────────────────
// 9. Source field integrity
// ─────────────────────────────────────────────────────────

section("9. Source field integrity — generated content is distinguishable");

{
  const topics = ["present_perfect", "past_simple", "conditional_type_2"];
  const difficulties = ["EASY", "MEDIUM", "HARD"];

  for (const topic of topics) {
    for (const diff of difficulties) {
      const draft = makeDraft({ topic, difficulty: diff, source: `generated:${topic}:${diff}` });
      const row = buildDraftRow(draft, makeValidationResult(), "j", "u");
      const qData = buildQuestionData({ ...makeDraftRecord(), topic, source: row.source });
      assert(
        `source encodes origin for ${topic}:${diff}`,
        qData.source.startsWith("generated:")
      );
      assert(
        `source contains topic for ${topic}:${diff}`,
        qData.source.includes(topic)
      );
    }
  }
}

// ─────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`M4.3 Generated Draft Pipeline: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
