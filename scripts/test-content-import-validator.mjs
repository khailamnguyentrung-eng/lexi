/**
 * Sub-project B — validator.ts must validate multi-format drafts by
 * delegating to question-format/validate.ts, not by checking A/B/C/D
 * columns.
 *
 * Run: npm run test:content-import-validator
 *
 * Uses a real (empty, file-backed) SQLite test DB via DATABASE_URL — this
 * mirrors how other DB-touching test scripts in this repo run (see
 * test-exam-widening.mjs for the same real-Prisma-insert-then-cleanup
 * pattern). validateDrafts() queries `Question.questionCode` for
 * duplicates, so it needs a real Prisma client.
 */
import { prisma } from "../lib/db/prisma.ts";
import { validateDrafts } from "../lib/services/content-import/validator.ts";

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

function baseDraft(overrides) {
  return {
    questionCode: `TESTVAL_${Math.random().toString(36).slice(2, 10)}`,
    skill: "READING",
    difficulty: "MEDIUM",
    topic: "true_false_not_given",
    promptText: "The passage says X. True, False, or Not Given?",
    explanationVi: "explanation",
    commonMistake: null,
    learningObjective: "objective",
    source: "test",
    sourceExam: null,
    responseFormat: "SINGLE_CHOICE",
    payload: JSON.stringify({
      options: [
        { id: "TRUE", text: "True" },
        { id: "FALSE", text: "False" },
        { id: "NOT_GIVEN", text: "Not Given" },
      ],
      correctOptionId: "TRUE",
    }),
    ...overrides,
  };
}

const validSingleChoice = baseDraft({});
const validMatching = baseDraft({
  questionCode: `TESTVAL_${Math.random().toString(36).slice(2, 10)}`,
  responseFormat: "MATCHING",
  payload: JSON.stringify({
    left: [{ id: "P1", text: "Paragraph 1" }],
    right: [{ id: "h1", text: "heading 1" }, { id: "h2", text: "heading 2" }],
    correctPairs: [{ leftId: "P1", rightId: "h2" }],
  }),
});
const invalidPayloadShape = baseDraft({
  questionCode: `TESTVAL_${Math.random().toString(36).slice(2, 10)}`,
  payload: JSON.stringify({ options: [{ id: "TRUE", text: "True" }], correctOptionId: "NOPE" }),
});
const invalidSkill = baseDraft({
  questionCode: `TESTVAL_${Math.random().toString(36).slice(2, 10)}`,
  skill: "NOT_A_REAL_SKILL",
});
const missingResponseFormat = baseDraft({
  questionCode: `TESTVAL_${Math.random().toString(36).slice(2, 10)}`,
  responseFormat: undefined,
});
const malformedPayloadJson = baseDraft({
  questionCode: `TESTVAL_${Math.random().toString(36).slice(2, 10)}`,
  payload: "{not valid json",
});

async function main() {
  const results = await validateDrafts([
    validSingleChoice,
    validMatching,
    invalidPayloadShape,
    invalidSkill,
    missingResponseFormat,
    malformedPayloadJson,
  ]);

  check("SINGLE_CHOICE valid draft passes", results[0].isValid, true);
  check("MATCHING valid draft passes", results[1].isValid, true);
  check("invalid correctOptionId fails", results[2].isValid, false);
  check("invalid skill fails", results[3].isValid, false);
  check("missing responseFormat fails", results[4].isValid, false);
  check("malformed payload JSON fails", results[5].isValid, false);

  // Duplicate questionCode within the same batch
  const dup = baseDraft({ questionCode: "TESTVAL_DUP" });
  const dup2 = baseDraft({ questionCode: "TESTVAL_DUP" });
  const dupResults = await validateDrafts([dup, dup2]);
  check("first of duplicate pair passes", dupResults[0].isValid, true);
  check("second of duplicate pair fails (dup in batch)", dupResults[1].isValid, false);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  passed: ${passed}   failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
  await prisma.$disconnect();
}

main();
