/**
 * KU-1 part B — review queue (approve/merge/rename/reject).
 *
 * Run: node --import tsx scripts/test-ku1-partb-review.mjs
 *
 * DEVIATION from most test-*.mjs scripts, same reasoning as
 * test-question-formats.mjs: this repo has no separate test database
 * (DATABASE_URL always points at dev.db), and the logic under test IS the
 * Prisma interaction (collision detection, FK-based backfill counts, status
 * transitions) — a pure-logic simulation would not actually exercise it.
 *
 * So this hits the real dev.db, but through fixtures it creates and deletes
 * itself. It never touches any pre-existing row: every id used in an
 * assertion is one this script created in its own setup step. Teardown runs
 * even on failure (try/finally) so a broken assertion never leaves fixture
 * rows behind for the next run — or worse, in the app someone else looks at.
 */

import { PrismaClient } from "@prisma/client";
import {
  approvePendingKnowledgeUnit,
  mergePendingKnowledgeUnit,
  rejectPendingKnowledgeUnit,
  listPendingKnowledgeUnits,
  TopicAlreadyExistsError,
} from "../lib/services/content-intelligence/pendingKnowledgeUnitReview.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}\n      expected: ${e}\n      actual  : ${a}`);
  }
}

async function checkThrows(name, fn, expectedInstance) {
  try {
    await fn();
    failed++;
    console.log(`  ✗ ${name}\n      expected throw, got none`);
  } catch (e) {
    if (expectedInstance && !(e instanceof expectedInstance)) {
      failed++;
      console.log(`  ✗ ${name}\n      expected ${expectedInstance.name}, got ${e.constructor.name}: ${e.message}`);
    } else {
      passed++;
      console.log(`  ✓ ${name}`);
    }
  }
}

// A nonce so fixture rows can never collide with real data or a previous
// interrupted run, and are trivially greppable for manual cleanup if this
// script itself ever crashes before teardown.
const NONCE = `ku1b_test_${Date.now()}`;
const created = { pendingKUs: [], knowledgeUnits: [], questions: [], contentSourceId: null };

async function setup() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const source = await prisma.contentSource.create({
    data: {
      userId: admin.id,
      fileName: `${NONCE}.pdf`,
      fileType: "PDF",
      storagePath: `/tmp/${NONCE}.pdf`,
    },
  });
  created.contentSourceId = source.id;

  // A KnowledgeUnit that already exists, to test the merge target AND the
  // approve-collision case.
  const existingUnit = await prisma.knowledgeUnit.create({
    data: { topic: `${NONCE}_existing_concept`, label: "Existing Concept (fixture)" },
  });
  created.knowledgeUnits.push(existingUnit.id);

  async function makeProposal(topicSuffix, label, evidenceQuote) {
    const p = await prisma.pendingKnowledgeUnit.create({
      data: {
        contentSourceId: source.id,
        proposedTopic: `${NONCE}_${topicSuffix}`,
        proposedLabel: label,
        evidenceQuote,
      },
    });
    created.pendingKUs.push(p.id);
    return p;
  }

  const forApprove = await makeProposal("approve_me", "Approve Me (fixture)", "evidence for approve");
  const forRename = await makeProposal("rename_me", "bad ai label", "evidence for rename");
  const forMerge = await makeProposal("merge_me", "Merge Me (fixture)", "evidence for merge");
  const forReject = await makeProposal("reject_me", "Not A Real Concept", "evidence for reject");
  const forCollision = await prisma.pendingKnowledgeUnit.create({
    data: {
      contentSourceId: source.id,
      proposedTopic: existingUnit.topic, // deliberately collides
      proposedLabel: "Duplicate proposal (fixture)",
      evidenceQuote: "evidence for collision",
    },
  });
  created.pendingKUs.push(forCollision.id);

  // Question rows so the backfill-linking behaviour has something real to
  // link. One per topic that approve()/merge() should pick up.
  let questionSeq = 0;
  async function makeQuestion(topic) {
    questionSeq++;
    const q = await prisma.question.create({
      data: {
        questionCode: `${NONCE}_${topic}_${questionSeq}`,
        type: "GRAMMAR_MCQ",
        skill: "VOCAB_GRAMMAR",
        topic,
        promptText: "fixture question",
        optionA: "a",
        optionB: "b",
        optionC: "c",
        optionD: "d",
        correctOption: "A",
        explanationVi: "fixture",
        source: NONCE,
      },
    });
    created.questions.push(q.id);
    return q;
  }
  const questionForApprove = await makeQuestion(forApprove.proposedTopic);
  const questionForMerge = await makeQuestion(forMerge.proposedTopic);
  // A second question on the SAME topic as forApprove, to verify the backfill
  // links ALL matching questions, not just one.
  const secondQuestionForApprove = await makeQuestion(forApprove.proposedTopic);

  return {
    admin,
    existingUnit,
    forApprove,
    forRename,
    forMerge,
    forReject,
    forCollision,
    questionForApprove,
    questionForMerge,
    secondQuestionForApprove,
  };
}

async function teardown() {
  // FK-safe order: children before parents.
  await prisma.pendingKnowledgeUnit.deleteMany({ where: { id: { in: created.pendingKUs } } });
  await prisma.question.deleteMany({ where: { id: { in: created.questions } } });
  // approvePendingKnowledgeUnit()/mergePendingKnowledgeUnit() now auto-run
  // assembleProgramGaps() (lib/services/program/), which creates a real
  // ProgramCurriculum + ProgramCurriculumKnowledgeUnit slot for every
  // KnowledgeUnit this test approves — including these throwaway fixtures.
  // Must clean those up before deleting the KnowledgeUnit rows they
  // reference, or the delete below hits a foreign key violation.
  //
  // Deliberately scoped by EXACT id, not "any slot with zero KUs" — some
  // real ProgramCurriculum slots legitimately have no linked KnowledgeUnit
  // by design (6 of the 24 seeded demo slots are cumulative checkpoint/
  // review sessions with no single matched topic; see seedDemoProgram.ts).
  // A blanket "empty slot" delete would destroy those too.
  const fixtureSlots = await prisma.programCurriculumKnowledgeUnit.findMany({
    where: { knowledgeUnitId: { in: created.knowledgeUnits } },
    select: { programCurriculumId: true },
  });
  const fixtureSlotIds = [...new Set(fixtureSlots.map((s) => s.programCurriculumId))];
  await prisma.programCurriculumKnowledgeUnit.deleteMany({ where: { knowledgeUnitId: { in: created.knowledgeUnits } } });
  await prisma.programCurriculum.deleteMany({ where: { id: { in: fixtureSlotIds } } });
  await prisma.knowledgeUnit.deleteMany({ where: { id: { in: created.knowledgeUnits } } });
  if (created.contentSourceId) {
    await prisma.contentSource.delete({ where: { id: created.contentSourceId } }).catch(() => {});
  }
}

async function main() {
  const fx = await setup();

  console.log("\nAPPROVE — creates a new KnowledgeUnit and links matching questions");
  const approveResult = await approvePendingKnowledgeUnit(fx.forApprove.id, fx.admin.id);
  created.knowledgeUnits.push(approveResult.knowledgeUnitId); // track for teardown
  check("reviewStatus becomes APPROVED (no override given)", approveResult.proposal.reviewStatus, "APPROVED");
  check("both questions on that topic get linked", approveResult.questionsLinked, 2);

  const linkedQ1 = await prisma.question.findUniqueOrThrow({ where: { id: fx.questionForApprove.id } });
  const linkedQ2 = await prisma.question.findUniqueOrThrow({ where: { id: fx.secondQuestionForApprove.id } });
  check("question 1 actually has the new knowledgeUnitId set", linkedQ1.knowledgeUnitId, approveResult.knowledgeUnitId);
  check("question 2 actually has the new knowledgeUnitId set", linkedQ2.knowledgeUnitId, approveResult.knowledgeUnitId);

  const createdUnit = await prisma.knowledgeUnit.findUniqueOrThrow({ where: { id: approveResult.knowledgeUnitId } });
  check("created KnowledgeUnit.topic matches the proposal exactly (coverage-report agreement)", createdUnit.topic, fx.forApprove.proposedTopic);

  console.log("\nRENAME (approve with override) — creates a KU with reviewer-supplied topic/label");
  const renameResult = await approvePendingKnowledgeUnit(fx.forRename.id, fx.admin.id, {
    topic: `${NONCE}_renamed_topic`,
    label: "Corrected Human Label",
  });
  created.knowledgeUnits.push(renameResult.knowledgeUnitId);
  check("reviewStatus becomes RENAMED (override differs from proposal)", renameResult.proposal.reviewStatus, "RENAMED");
  const renamedUnit = await prisma.knowledgeUnit.findUniqueOrThrow({ where: { id: renameResult.knowledgeUnitId } });
  check("KU topic is the OVERRIDE, not the original proposal", renamedUnit.topic, `${NONCE}_renamed_topic`);
  check(
    "no question backfill on rename (topic no longer matches any Question row) — deliberate, see docstring",
    renameResult.questionsLinked,
    0
  );

  console.log("\nMERGE — folds a proposal into an EXISTING KnowledgeUnit, no new unit created");
  const beforeMergeUnitCount = await prisma.knowledgeUnit.count();
  const mergeResult = await mergePendingKnowledgeUnit(fx.forMerge.id, fx.existingUnit.id, fx.admin.id, "same concept");
  const afterMergeUnitCount = await prisma.knowledgeUnit.count();
  check("merge does not create a new KnowledgeUnit", afterMergeUnitCount, beforeMergeUnitCount);
  check("resolvedUnitId points at the EXISTING unit, not a new one", mergeResult.knowledgeUnitId, fx.existingUnit.id);
  check("reviewStatus becomes MERGED", mergeResult.proposal.reviewStatus, "MERGED");
  check("the merged question is linked to the EXISTING unit via FK", mergeResult.questionsLinked, 1);
  const mergedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: fx.questionForMerge.id } });
  check("question's knowledgeUnitId now points at the target, not a new unit", mergedQuestion.knowledgeUnitId, fx.existingUnit.id);
  // The coverage-report caveat, made concrete: the linked question's topic
  // string does NOT equal the target unit's topic, which is exactly why
  // computeCoverageReport() (string-based) will undercount it. Asserting this
  // gap explicitly, not just describing it in a comment.
  check(
    "CAVEAT CONFIRMED: merged question's topic still differs from the target unit's topic (string-based coverage will miss it)",
    mergedQuestion.topic === fx.existingUnit.topic,
    false
  );

  console.log("\nREJECT — marks REJECTED, creates nothing");
  const beforeRejectUnitCount = await prisma.knowledgeUnit.count();
  const rejected = await rejectPendingKnowledgeUnit(fx.forReject.id, fx.admin.id, "not a real concept");
  check("reviewStatus becomes REJECTED", rejected.reviewStatus, "REJECTED");
  check("reviewNote is recorded", rejected.reviewNote, "not a real concept");
  check("no KnowledgeUnit created by reject", await prisma.knowledgeUnit.count(), beforeRejectUnitCount);

  console.log("\nCOLLISION — approving a topic that already has a KnowledgeUnit throws, does not silently merge");
  await checkThrows(
    "approve throws TopicAlreadyExistsError instead of silently merging",
    () => approvePendingKnowledgeUnit(fx.forCollision.id, fx.admin.id),
    TopicAlreadyExistsError
  );
  const collisionAfter = await prisma.pendingKnowledgeUnit.findUniqueOrThrow({ where: { id: fx.forCollision.id } });
  check("failed approve leaves the proposal PENDING_REVIEW (not silently resolved)", collisionAfter.reviewStatus, "PENDING_REVIEW");

  console.log("\nRe-resolving an already-resolved proposal is rejected, not silently re-applied");
  await checkThrows("cannot approve an already-APPROVED proposal a second time", () =>
    approvePendingKnowledgeUnit(fx.forApprove.id, fx.admin.id)
  );

  console.log("\nlistPendingKnowledgeUnits — excludes resolved proposals, includes provenance");
  const stillPending = await listPendingKnowledgeUnits();
  const stillPendingIds = new Set(stillPending.map((p) => p.id));
  check("resolved (approved) proposal is no longer in the pending list", stillPendingIds.has(fx.forApprove.id), false);
  check("resolved (merged) proposal is no longer in the pending list", stillPendingIds.has(fx.forMerge.id), false);
  check("resolved (rejected) proposal is no longer in the pending list", stillPendingIds.has(fx.forReject.id), false);
  const collisionStillPending = stillPending.find((p) => p.id === fx.forCollision.id);
  check("the still-unresolved collision proposal IS in the pending list", Boolean(collisionStillPending), true);
  check(
    "provenance (contentSource) is included for the reviewer to see",
    collisionStillPending?.contentSource?.fileName,
    `${NONCE}.pdf`
  );
}

main()
  .then(async () => {
    await teardown();
    console.log(`\n${"─".repeat(50)}`);
    console.log(`  passed: ${passed}   failed: ${failed}`);
    await prisma.$disconnect();
    if (failed > 0) process.exitCode = 1;
  })
  .catch(async (e) => {
    console.error("\nFATAL:", e);
    await teardown().catch((cleanupErr) => console.error("teardown also failed:", cleanupErr));
    await prisma.$disconnect();
    process.exitCode = 1;
  });
