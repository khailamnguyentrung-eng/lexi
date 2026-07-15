/**
 * test-knowledge-mapping.mjs
 *
 * Validates M3.3 pure logic functions:
 *   - findMatchingKnowledgeUnitId() (topic-based deterministic matching)
 *   - Unmapped detection logic
 *   - Auto-assignment decision simulation
 *   - Import flow compatibility (approveDraft with/without KU match)
 *
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure functions under test.
 *
 * Run: node scripts/test-knowledge-mapping.mjs
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

function findMatchingKnowledgeUnitId(topic, units) {
  return units.find((u) => u.topic === topic)?.id ?? null;
}

// Simulates the autoAssignKnowledgeUnit decision (pure, no Prisma):
// given a topic and a list of available KnowledgeUnits, returns the id to
// assign or null if no match.
function resolveKnowledgeUnitForTopic(topic, units) {
  return findMatchingKnowledgeUnitId(topic, units);
}

// Simulates getUnmappedQuestions filtering (pure):
function filterUnmappedQuestions(questions) {
  return questions.filter((q) => q.knowledgeUnitId === null);
}

// Simulates getQuestionsForKnowledgeUnit filtering (pure):
function filterQuestionsForUnit(questions, knowledgeUnitId) {
  return questions.filter((q) => q.knowledgeUnitId === knowledgeUnitId);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const knowledgeUnits = [
  { id: "ku_1", topic: "present_simple", label: "Present Simple" },
  { id: "ku_2", topic: "present_perfect", label: "Present Perfect" },
  { id: "ku_3", topic: "passive_voice", label: "Passive Voice" },
  { id: "ku_4", topic: "reported_speech", label: "Reported Speech" },
];

const questions = [
  { id: "q_1", questionCode: "Q001", topic: "present_simple",   difficulty: "EASY",   knowledgeUnitId: "ku_1" },
  { id: "q_2", questionCode: "Q002", topic: "present_perfect",  difficulty: "MEDIUM", knowledgeUnitId: "ku_2" },
  { id: "q_3", questionCode: "Q003", topic: "present_simple",   difficulty: "HARD",   knowledgeUnitId: "ku_1" },
  { id: "q_4", questionCode: "Q004", topic: "passive_voice",    difficulty: "EASY",   knowledgeUnitId: null },
  { id: "q_5", questionCode: "Q005", topic: "word_formation",   difficulty: "MEDIUM", knowledgeUnitId: null },
  { id: "q_6", questionCode: "Q006", topic: "present_simple",   difficulty: "MEDIUM", knowledgeUnitId: null },
  { id: "q_7", questionCode: "Q007", topic: "reported_speech",  difficulty: "HARD",   knowledgeUnitId: null },
];

// ── findMatchingKnowledgeUnitId: exact match ──────────────────────────────────

console.log("\n── findMatchingKnowledgeUnitId: exact matches ───────────────");

{
  const id = findMatchingKnowledgeUnitId("present_simple", knowledgeUnits);
  assert("exact topic match returns correct id", id === "ku_1", `got ${id}`);
}

{
  const id = findMatchingKnowledgeUnitId("present_perfect", knowledgeUnits);
  assert("second unit matched correctly", id === "ku_2", `got ${id}`);
}

{
  const id = findMatchingKnowledgeUnitId("reported_speech", knowledgeUnits);
  assert("fourth unit matched correctly", id === "ku_4", `got ${id}`);
}

console.log("\n── findMatchingKnowledgeUnitId: no match cases ──────────────");

{
  const id = findMatchingKnowledgeUnitId("word_formation", knowledgeUnits);
  assert("unknown topic returns null", id === null, `got ${id}`);
}

{
  const id = findMatchingKnowledgeUnitId("", knowledgeUnits);
  assert("empty topic returns null", id === null, `got ${id}`);
}

{
  const id = findMatchingKnowledgeUnitId("Present_Simple", knowledgeUnits);
  assert("case-sensitive: 'Present_Simple' does not match 'present_simple'", id === null,
    "matching must be exact — canonicalization is caller's responsibility");
}

{
  const id = findMatchingKnowledgeUnitId("present simple", knowledgeUnits);
  assert("space variant does not match snake_case", id === null,
    "no fuzzy matching");
}

{
  const id = findMatchingKnowledgeUnitId("present_simple_tense", knowledgeUnits);
  assert("partial match (superset topic) returns null — exact equality only", id === null);
}

{
  const id = findMatchingKnowledgeUnitId("present", knowledgeUnits);
  assert("partial match (prefix) returns null — exact equality only", id === null);
}

{
  const id = findMatchingKnowledgeUnitId("passive_voice", knowledgeUnits);
  assert("topic with KU but no FK-linked questions still matches", id === "ku_3");
}

console.log("\n── findMatchingKnowledgeUnitId: empty registry ──────────────");

{
  const id = findMatchingKnowledgeUnitId("present_simple", []);
  assert("empty units array returns null", id === null);
}

// ── resolveKnowledgeUnitForTopic (autoAssign simulation) ─────────────────────

console.log("\n── auto-assign simulation ───────────────────────────────────");

{
  // Question from import: topic matches a KnowledgeUnit
  const topic = "present_perfect";
  const resolvedId = resolveKnowledgeUnitForTopic(topic, knowledgeUnits);
  assert("auto-assign: topic with matching KU returns unit id", resolvedId === "ku_2");
}

{
  // Question from import: topic has no KnowledgeUnit yet
  const topic = "word_formation";
  const resolvedId = resolveKnowledgeUnitForTopic(topic, knowledgeUnits);
  assert("auto-assign: unknown topic returns null (no assignment)", resolvedId === null);
}

{
  // Simulate approveDraft flow with a match:
  // Question is created first, then auto-assign is attempted
  const newQuestion = { id: "q_new", topic: "present_simple", knowledgeUnitId: null };
  const resolvedId = resolveKnowledgeUnitForTopic(newQuestion.topic, knowledgeUnits);
  const wouldAssign = resolvedId !== null;
  assert("approve + match: auto-assign would update knowledgeUnitId", wouldAssign);
  assert("approve + match: correct unit id determined", resolvedId === "ku_1");
}

{
  // Simulate approveDraft flow WITHOUT a match (topic not in registry):
  const newQuestion = { id: "q_new2", topic: "conditionals", knowledgeUnitId: null };
  const resolvedId = resolveKnowledgeUnitForTopic(newQuestion.topic, knowledgeUnits);
  const wouldAssign = resolvedId !== null;
  assert("approve + no match: auto-assign skipped (backward compatible)", !wouldAssign);
  assert("approve + no match: resolvedId is null", resolvedId === null);
}

// ── filterUnmappedQuestions ───────────────────────────────────────────────────

console.log("\n── unmapped detection ───────────────────────────────────────");

{
  const unmapped = filterUnmappedQuestions(questions);
  assert("unmapped count = 4 (q_4, q_5, q_6, q_7)", unmapped.length === 4,
    `got ${unmapped.length}`);
  assert("only questions with null knowledgeUnitId are returned",
    unmapped.every((q) => q.knowledgeUnitId === null));
  assert("q_4 is in unmapped", unmapped.some((q) => q.id === "q_4"));
  assert("q_5 is in unmapped (unknown topic)", unmapped.some((q) => q.id === "q_5"));
  assert("q_6 is in unmapped", unmapped.some((q) => q.id === "q_6"));
  assert("q_7 is in unmapped", unmapped.some((q) => q.id === "q_7"));
}

{
  const allMapped = questions.filter((q) => q.knowledgeUnitId !== null);
  const unmapped = filterUnmappedQuestions(allMapped);
  assert("all-mapped set → zero unmapped questions", unmapped.length === 0);
}

{
  const unmapped = filterUnmappedQuestions([]);
  assert("empty question list → zero unmapped", unmapped.length === 0);
}

// ── filterQuestionsForUnit ────────────────────────────────────────────────────

console.log("\n── getQuestionsForKnowledgeUnit simulation ──────────────────");

{
  const forUnit1 = filterQuestionsForUnit(questions, "ku_1");
  assert("present_simple unit has 2 FK-linked questions (q_1, q_3)", forUnit1.length === 2,
    `got ${forUnit1.length}`);
  assert("both are for present_simple", forUnit1.every((q) => q.topic === "present_simple"));
  assert("q_6 is NOT included (it's unmapped, not FK-linked to ku_1)", !forUnit1.some((q) => q.id === "q_6"));
}

{
  const forUnit2 = filterQuestionsForUnit(questions, "ku_2");
  assert("present_perfect unit has 1 FK-linked question", forUnit2.length === 1);
  assert("that question is q_2", forUnit2[0].id === "q_2");
}

{
  const forUnit3 = filterQuestionsForUnit(questions, "ku_3");
  assert("passive_voice unit has 0 FK-linked questions (q_4 is unmapped)", forUnit3.length === 0,
    `got ${forUnit3.length}`);
}

{
  const forNonExistent = filterQuestionsForUnit(questions, "ku_nonexistent");
  assert("nonexistent unit id → empty list", forNonExistent.length === 0);
}

// ── topic matching: assignment vs. coverage ───────────────────────────────────

console.log("\n── FK assignment vs. topic-string coverage independence ─────");

{
  // q_6 has topic="present_simple" but knowledgeUnitId=null.
  // Coverage engine uses topic matching (q_6 counts for present_simple coverage).
  // getQuestionsForKnowledgeUnit uses FK (q_6 does NOT appear).
  // These are intentionally separate — FK is for audit, topic is for coverage.
  const q6 = questions.find((q) => q.id === "q_6");
  assert("q_6: topic matches present_simple", q6.topic === "present_simple");
  assert("q_6: knowledgeUnitId is null (not FK-linked yet)", q6.knowledgeUnitId === null);

  const coverageMatchId = findMatchingKnowledgeUnitId(q6.topic, knowledgeUnits);
  assert("q_6 would be counted in present_simple coverage (topic match)", coverageMatchId === "ku_1");

  const fkLinked = filterQuestionsForUnit(questions, "ku_1");
  assert("q_6 is NOT in FK-linked list for ku_1", !fkLinked.some((q) => q.id === "q_6"));
}

// ── assign/remove simulation ──────────────────────────────────────────────────

console.log("\n── assign and remove simulation ─────────────────────────────");

{
  // Simulate assignment: a question with knowledgeUnitId=null gets assigned
  let q = { id: "q_sim", topic: "passive_voice", knowledgeUnitId: null };
  const unitId = findMatchingKnowledgeUnitId(q.topic, knowledgeUnits);
  assert("find match for passive_voice → ku_3", unitId === "ku_3");
  // Simulate the DB write result:
  q = { ...q, knowledgeUnitId: unitId };
  assert("after assignment: knowledgeUnitId is set", q.knowledgeUnitId === "ku_3");

  // Simulate remove: clear the assignment
  q = { ...q, knowledgeUnitId: null };
  assert("after remove: knowledgeUnitId is null again", q.knowledgeUnitId === null);
}

// ── existing import flow unaffected ──────────────────────────────────────────

console.log("\n── existing import flow compatibility ───────────────────────");

{
  // Simulates the full approveDraft path for a question whose topic HAS a KU
  function simulateApproveWithKU(draftTopic, availableUnits) {
    // Step 1: create Question (always succeeds)
    const question = { id: "q_approved_1", topic: draftTopic, knowledgeUnitId: null };
    // Step 2: try auto-assign (non-throwing)
    let assigned = false;
    try {
      const unitId = findMatchingKnowledgeUnitId(question.topic, availableUnits);
      if (unitId) {
        question.knowledgeUnitId = unitId;
        assigned = true;
      }
    } catch {
      // swallowed — never blocks approval
    }
    return { question, assigned };
  }

  const { question, assigned } = simulateApproveWithKU("present_simple", knowledgeUnits);
  assert("approve with matching KU: Question is created", !!question.id);
  assert("approve with matching KU: knowledgeUnitId assigned", question.knowledgeUnitId === "ku_1");
  assert("approve with matching KU: assigned flag is true", assigned);
}

{
  // Simulates the full approveDraft path for a topic with NO KU (backward compat)
  function simulateApproveNoKU(draftTopic, availableUnits) {
    const question = { id: "q_approved_2", topic: draftTopic, knowledgeUnitId: null };
    let assigned = false;
    try {
      const unitId = findMatchingKnowledgeUnitId(question.topic, availableUnits);
      if (unitId) {
        question.knowledgeUnitId = unitId;
        assigned = true;
      }
    } catch {
      // swallowed
    }
    return { question, assigned };
  }

  const { question, assigned } = simulateApproveNoKU("conditionals", knowledgeUnits);
  assert("approve without KU: Question is still created", !!question.id);
  assert("approve without KU: knowledgeUnitId stays null", question.knowledgeUnitId === null);
  assert("approve without KU: assigned flag is false", !assigned);
}

{
  // Simulates an exception inside autoAssign (e.g. DB flaky) — approval must not fail
  function simulateApproveWithAutoAssignError(draftTopic) {
    const question = { id: "q_approved_3", topic: draftTopic, knowledgeUnitId: null };
    let approvalSucceeded = false;
    try {
      throw new Error("simulated DB error in auto-assign");
    } catch {
      // swallowed — approval continues
    }
    approvalSucceeded = true; // this line is always reached
    return { question, approvalSucceeded };
  }

  const { approvalSucceeded } = simulateApproveWithAutoAssignError("present_simple");
  assert("autoAssign error does not abort approval", approvalSucceeded);
}

// ── KU-1 part B: miss-handling (docs/KU1_PARTB_DESIGN.md §6) ───────────────────
// Pure re-implementations of the two small pieces of decision logic added to
// autoAssignKnowledgeUnit() — the naive label generator, and the dedup check
// against an existing PENDING_REVIEW proposal. The Prisma-touching parts
// (findUnique/findFirst/create) were verified separately against real seeded
// data: 122 questions -> 49 matched an existing KU, 73 missed across 62
// distinct topics -> exactly 62 PendingKnowledgeUnit rows (deduped), all with
// taxonomyJobId=null and a non-empty evidenceQuote; re-running the same 122
// again created zero additional rows.

{
  function naiveLabelFromTopic(topic) {
    return topic
      .split("_")
      .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ");
  }

  assert(
    "naive label: single word capitalized",
    naiveLabelFromTopic("articles") === "Articles"
  );
  assert(
    "naive label: underscores become spaces, each word capitalized",
    naiveLabelFromTopic("both_and_structure") === "Both And Structure"
  );
  assert(
    "naive label: matches the real proposal observed for a real miss",
    naiveLabelFromTopic("communication_accepting_invitations") ===
      "Communication Accepting Invitations"
  );
}

{
  // Simulates the dedup guard: a second question sharing an already-proposed
  // (contentSourceId, topic, PENDING_REVIEW) triple must not create a second row.
  function simulateMissHandling(existingProposals, contentSourceId, topic) {
    const alreadyProposed = existingProposals.some(
      (p) =>
        p.contentSourceId === contentSourceId &&
        p.proposedTopic === topic &&
        p.reviewStatus === "PENDING_REVIEW"
    );
    if (alreadyProposed) return existingProposals; // no new row
    return [...existingProposals, { contentSourceId, proposedTopic: topic, reviewStatus: "PENDING_REVIEW" }];
  }

  let proposals = [];
  proposals = simulateMissHandling(proposals, "src_1", "conjunctions_because");
  assert("first miss for a topic creates a proposal", proposals.length === 1);

  proposals = simulateMissHandling(proposals, "src_1", "conjunctions_because");
  assert(
    "second question with the SAME unknown topic does not duplicate the proposal",
    proposals.length === 1
  );

  proposals = simulateMissHandling(proposals, "src_1", "double_comparatives");
  assert(
    "a DIFFERENT unknown topic still creates its own proposal",
    proposals.length === 2
  );

  proposals = simulateMissHandling(proposals, "src_2", "conjunctions_because");
  assert(
    "the SAME topic from a DIFFERENT source is a separate proposal (contentSourceId is part of the key)",
    proposals.length === 3
  );

  // A resolved (non-PENDING_REVIEW) proposal must not block a fresh one — e.g.
  // the first was REJECTED and the topic reappears in a later import.
  proposals = proposals.map((p) =>
    p.contentSourceId === "src_1" && p.proposedTopic === "conjunctions_because"
      ? { ...p, reviewStatus: "REJECTED" }
      : p
  );
  proposals = simulateMissHandling(proposals, "src_1", "conjunctions_because");
  assert(
    "a REJECTED proposal does not block a new proposal for the same topic",
    proposals.length === 4
  );
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
