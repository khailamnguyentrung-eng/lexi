/**
 * Sub-project B — approveDraft() must create a Question with
 * responseFormat/payload set and type/optionA-D/examId left null for
 * extraction-path drafts. Self-contained: creates its own ImportJob +
 * ExtractedQuestionDraft fixture, cleans up in `finally`.
 *
 * Run: npm run test:content-import-approve
 */
import { prisma } from "../lib/db/prisma.ts";
import { createContentSource, approveDraft } from "../lib/services/content-import/importer.ts";
import { getQuestionPayload } from "../lib/services/question-format/index.ts";

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

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.log("  (skip: no ADMIN user in DB — run npm run db:seed first)");
    process.exitCode = 1;
    return;
  }

  const contentSource = await createContentSource({
    userId: admin.id,
    fileName: "test-content-import-approve-fixture.docx",
    fileType: "DOCX",
    storagePath: "test/does-not-exist.docx",
  });
  const importJob = await prisma.importJob.create({
    data: { contentSourceId: contentSource.id, status: "REVIEWING" },
  });
  const draftPayload = {
    options: [
      { id: "TRUE", text: "True" },
      { id: "FALSE", text: "False" },
      { id: "NOT_GIVEN", text: "Not Given" },
    ],
    correctOptionId: "TRUE",
  };
  const normalizedData = JSON.stringify({
    questionCode: `TESTAPPROVE_${Date.now()}`,
    skill: "READING",
    difficulty: "MEDIUM",
    topic: "true_false_not_given",
    promptText: "test prompt",
    responseFormat: "SINGLE_CHOICE",
    payload: JSON.stringify(draftPayload),
    explanationVi: "test explanation",
    commonMistake: null,
    learningObjective: "test objective",
    source: "test",
    sourceExam: null,
  });
  const draft = await prisma.extractedQuestionDraft.create({
    data: { importJobId: importJob.id, normalizedData, reviewStatus: "PENDING_REVIEW" },
  });

  try {
    const updated = await approveDraft(draft.id, admin.id);
    const created = await prisma.question.findUniqueOrThrow({ where: { id: updated.importedQuestionId } });

    check("type is null", created.type, null);
    check("optionA is null", created.optionA, null);
    check("correctOption is null", created.correctOption, null);
    check("examId is null", created.examId, null);
    check("examSkillId is null", created.examSkillId, null);
    check("responseFormat is SINGLE_CHOICE", created.responseFormat, "SINGLE_CHOICE");
    check("payload round-trips via getQuestionPayload", getQuestionPayload(created), draftPayload);

    // Finding 4 (final whole-branch review): re-approving the same draft
    // must now throw instead of silently no-op-ing or double-creating —
    // its reviewStatus is APPROVED after the call above.
    let rejectedGuardThrew = false;
    try {
      await approveDraft(draft.id, admin.id);
    } catch {
      rejectedGuardThrew = true;
    }
    check("re-approving an already-APPROVED draft throws", rejectedGuardThrew, true);
  } finally {
    await prisma.extractedQuestionDraft.deleteMany({ where: { importJobId: importJob.id } });
    const q = await prisma.question.findFirst({ where: { questionCode: { startsWith: "TESTAPPROVE_" } } });
    if (q) await prisma.question.delete({ where: { id: q.id } });
    // approveDraft()'s autoAssignKnowledgeUnit() records a PendingKnowledgeUnit
    // when the draft's topic has no matching KnowledgeUnit (true here, by
    // design — this fixture isn't testing KU matching). Clean it up before
    // deleting the ContentSource it references, or the FK constraint blocks it.
    await prisma.pendingKnowledgeUnit.deleteMany({ where: { contentSourceId: contentSource.id } });
    await prisma.importJob.delete({ where: { id: importJob.id } });
    await prisma.contentSource.delete({ where: { id: contentSource.id } });
  }

  // Finding 4b (final whole-branch review): a malformed draft (legacy-shape
  // or corrupted normalizedData missing responseFormat/payload) must throw
  // on approve instead of silently creating an answerless Question.
  const contentSource2 = await createContentSource({
    userId: admin.id,
    fileName: "test-content-import-approve-malformed-fixture.docx",
    fileType: "DOCX",
    storagePath: "test/does-not-exist.docx",
  });
  const importJob2 = await prisma.importJob.create({
    data: { contentSourceId: contentSource2.id, status: "REVIEWING" },
  });
  const malformedData = JSON.stringify({
    questionCode: `TESTAPPROVE_MALFORMED_${Date.now()}`,
    skill: "READING",
    difficulty: "MEDIUM",
    topic: "true_false_not_given",
    promptText: "test prompt",
    // responseFormat and payload deliberately omitted
    explanationVi: "test explanation",
    commonMistake: null,
    learningObjective: "test objective",
    source: "test",
    sourceExam: null,
  });
  const malformedDraft = await prisma.extractedQuestionDraft.create({
    data: { importJobId: importJob2.id, normalizedData: malformedData, reviewStatus: "PENDING_REVIEW" },
  });
  try {
    let malformedGuardThrew = false;
    try {
      await approveDraft(malformedDraft.id, admin.id);
    } catch {
      malformedGuardThrew = true;
    }
    check("approving a draft missing responseFormat/payload throws", malformedGuardThrew, true);

    const leaked = await prisma.question.findFirst({
      where: { questionCode: { startsWith: "TESTAPPROVE_MALFORMED_" } },
    });
    check("no Question was created for the malformed draft", leaked, null);
  } finally {
    await prisma.extractedQuestionDraft.deleteMany({ where: { importJobId: importJob2.id } });
    const leaked = await prisma.question.findFirst({
      where: { questionCode: { startsWith: "TESTAPPROVE_MALFORMED_" } },
    });
    if (leaked) await prisma.question.delete({ where: { id: leaked.id } });
    await prisma.pendingKnowledgeUnit.deleteMany({ where: { contentSourceId: contentSource2.id } });
    await prisma.importJob.delete({ where: { id: importJob2.id } });
    await prisma.contentSource.delete({ where: { id: contentSource2.id } });
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  passed: ${passed}   failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
  await prisma.$disconnect();
}

main();
