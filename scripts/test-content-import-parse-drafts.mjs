/**
 * Sub-project B — parseDrafts() must handle both the legacy (generate)
 * shape and the new (extraction) responseFormat/payload shape, since both
 * paths share this one parser.
 *
 * Run: npm run test:content-import-parse-drafts
 */
import { parseDrafts } from "../lib/ai/providers/normalizationCore.ts";

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

// Legacy shape (what GENERATE_QUESTIONS_SYSTEM_PROMPT's model output looks like)
const legacyJson = JSON.stringify([
  {
    questionCode: "GEN_TEST_01",
    type: "GRAMMAR_MCQ",
    skill: "VOCAB_GRAMMAR",
    difficulty: "MEDIUM",
    topic: "present_perfect",
    promptText: "She ___ here since 2020.",
    optionA: "live",
    optionB: "lived",
    optionC: "has lived",
    optionD: "living",
    correctOption: "C",
    explanationVi: "explanation",
    commonMistake: null,
    learningObjective: "objective",
  },
]);
const legacyDrafts = parseDrafts(legacyJson, "test-source");
check("legacy shape: optionA parsed", legacyDrafts[0].optionA, "live");
check("legacy shape: correctOption parsed", legacyDrafts[0].correctOption, "C");
check("legacy shape: responseFormat is undefined", legacyDrafts[0].responseFormat, undefined);
check("legacy shape: payload is undefined", legacyDrafts[0].payload, undefined);

// New shape (what NORMALIZE_SYSTEM_PROMPT's model output looks like after Task 3)
const newJson = JSON.stringify([
  {
    questionCode: "IMPORT_TEST_01",
    skill: "READING",
    difficulty: "MEDIUM",
    topic: "true_false_not_given",
    promptText: "The passage states X. TRUE, FALSE, or NOT GIVEN?",
    responseFormat: "SINGLE_CHOICE",
    payload: JSON.stringify({
      options: [
        { id: "TRUE", text: "True" },
        { id: "FALSE", text: "False" },
        { id: "NOT_GIVEN", text: "Not Given" },
      ],
      correctOptionId: "TRUE",
    }),
    explanationVi: "explanation",
    commonMistake: null,
    learningObjective: "objective",
  },
]);
const newDrafts = parseDrafts(newJson, "test-source");
check("new shape: responseFormat parsed", newDrafts[0].responseFormat, "SINGLE_CHOICE");
check(
  "new shape: payload parsed as string",
  typeof newDrafts[0].payload === "string" && JSON.parse(newDrafts[0].payload).correctOptionId,
  "TRUE"
);
check("new shape: type is undefined", newDrafts[0].type, undefined);
check("new shape: optionA is undefined", newDrafts[0].optionA, undefined);

console.log(`\n${"─".repeat(50)}`);
console.log(`  passed: ${passed}   failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
