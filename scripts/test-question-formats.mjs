/**
 * QM-1 — question format validators + graders.
 *
 * Run: npm run test:question-formats
 *
 * Standalone node script, no framework — this repo's test convention. Covers
 * the pure core only; no database, which is the point of keeping validate/grade
 * free of Prisma.
 *
 * DEVIATION, on purpose: the older test scripts say "Plain JS — inlines the pure
 * functions under test". Inlining tests a COPY, which can pass while the real
 * implementation is broken. This imports the real modules via tsx instead —
 * the same mechanism `npm run test:chat` already uses (`node --import tsx`).
 *
 * Emphasis is on the cases that would silently corrupt a mastery signal rather
 * than throw: a grader marking a correct learner wrong, or a validator letting
 * an ungradeable payload through.
 */

import { validatePayload, parsePayload } from "../lib/services/question-format/validate.ts";
import { gradeResponse, normalizeText } from "../lib/services/question-format/grade.ts";
import {
  getQuestionPayload,
  payloadFromLegacyColumns,
  toLegacyColumns,
  toPublicPayload,
} from "../lib/services/question-format/index.ts";

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

function section(title) {
  console.log(`\n${title}`);
}

// ── SINGLE_CHOICE ──────────────────────────────────────────────────
section("SINGLE_CHOICE");

const sc = {
  options: [
    { id: "A", text: "live" },
    { id: "B", text: "lives" },
    { id: "C", text: "living" },
    { id: "D", text: "lived" },
  ],
  correctOptionId: "A",
};

check("valid payload", validatePayload("SINGLE_CHOICE", sc).valid, true);
check("correct answer scores 1", gradeResponse("SINGLE_CHOICE", sc, { optionId: "A" }).score, 1);
check("wrong answer scores 0", gradeResponse("SINGLE_CHOICE", sc, { optionId: "B" }).score, 0);
check("isCorrect tracks score", gradeResponse("SINGLE_CHOICE", sc, { optionId: "A" }).isCorrect, true);
check(
  "correctOptionId not among options is rejected",
  validatePayload("SINGLE_CHOICE", { ...sc, correctOptionId: "Z" }).valid,
  false
);
check(
  "duplicate option ids rejected",
  validatePayload("SINGLE_CHOICE", {
    options: [
      { id: "A", text: "x" },
      { id: "A", text: "y" },
    ],
    correctOptionId: "A",
  }).valid,
  false
);

// IELTS True/False/Not Given is the same shape with 3 options — the claim the
// enum design rests on. If this fails, the "no new enum per exam" promise is broken.
const tfng = {
  options: [
    { id: "TRUE", text: "True" },
    { id: "FALSE", text: "False" },
    { id: "NOT_GIVEN", text: "Not Given" },
  ],
  correctOptionId: "NOT_GIVEN",
};
check("IELTS TFNG validates as SINGLE_CHOICE", validatePayload("SINGLE_CHOICE", tfng).valid, true);
check("TFNG grades", gradeResponse("SINGLE_CHOICE", tfng, { optionId: "NOT_GIVEN" }).score, 1);

// ── MULTI_CHOICE ───────────────────────────────────────────────────
section("MULTI_CHOICE");

const mc = {
  options: [
    { id: "A", text: "a" },
    { id: "B", text: "b" },
    { id: "C", text: "c" },
    { id: "D", text: "d" },
  ],
  correctOptionIds: ["A", "C"],
};

check("valid payload", validatePayload("MULTI_CHOICE", mc).valid, true);
check("exact set scores 1", gradeResponse("MULTI_CHOICE", mc, { optionIds: ["C", "A"] }).score, 1);
check("subset scores 0", gradeResponse("MULTI_CHOICE", mc, { optionIds: ["A"] }).score, 0);
// The rule that makes all-or-nothing necessary: ticking everything must not pay.
check(
  "selecting ALL options scores 0 (no reward for shotgunning)",
  gradeResponse("MULTI_CHOICE", mc, { optionIds: ["A", "B", "C", "D"] }).score,
  0
);
check("empty correctOptionIds rejected", validatePayload("MULTI_CHOICE", { ...mc, correctOptionIds: [] }).valid, false);

// ── SHORT_TEXT ─────────────────────────────────────────────────────
section("SHORT_TEXT — the format the current bank fakes as MCQ");

// "She sings very ___. (BEAUTIFUL)" — a real WORD_FORMATION question, stored
// today as 4 options. This is what it should be.
const st = { blanks: [{ id: "1", acceptedAnswers: ["beautifully"] }] };

check("valid payload", validatePayload("SHORT_TEXT", st).valid, true);
check("exact answer scores 1", gradeResponse("SHORT_TEXT", st, { answers: { 1: "beautifully" } }).score, 1);
check("case-insensitive by default", gradeResponse("SHORT_TEXT", st, { answers: { 1: "Beautifully" } }).score, 1);
check("surrounding whitespace tolerated", gradeResponse("SHORT_TEXT", st, { answers: { 1: "  beautifully " } }).score, 1);
check("wrong answer scores 0", gradeResponse("SHORT_TEXT", st, { answers: { 1: "beautiful" } }).score, 0);
check("missing answer scores 0", gradeResponse("SHORT_TEXT", st, { answers: {} }).score, 0);

// Multiple accepted answers — the case that silently marks correct learners
// wrong if the grader only knows one form.
const contraction = { blanks: [{ id: "1", acceptedAnswers: ["don't", "do not"] }] };
check("accepts alternative 1", gradeResponse("SHORT_TEXT", contraction, { answers: { 1: "don't" } }).score, 1);
check("accepts alternative 2", gradeResponse("SHORT_TEXT", contraction, { answers: { 1: "do not" } }).score, 1);
check(
  "curly apostrophe folded to straight (keyboard artifact, not a learner error)",
  gradeResponse("SHORT_TEXT", contraction, { answers: { 1: "don’t" } }).score,
  1
);

const twoBlanks = {
  blanks: [
    { id: "1", acceptedAnswers: ["went"] },
    { id: "2", acceptedAnswers: ["home"] },
  ],
};
check(
  "partial credit per blank",
  gradeResponse("SHORT_TEXT", twoBlanks, { answers: { 1: "went", 2: "school" } }).score,
  0.5
);
check(
  "partial credit is not 'correct'",
  gradeResponse("SHORT_TEXT", twoBlanks, { answers: { 1: "went", 2: "school" } }).isCorrect,
  false
);
check(
  "detail reports which blank failed",
  gradeResponse("SHORT_TEXT", twoBlanks, { answers: { 1: "went", 2: "school" } }).detail,
  { 1: true, 2: false }
);
check(
  "case-sensitive blank respects the flag",
  gradeResponse(
    "SHORT_TEXT",
    { blanks: [{ id: "1", acceptedAnswers: ["Hanoi"], caseSensitive: true }] },
    { answers: { 1: "hanoi" } }
  ).score,
  0
);
// The silent-corruption guard: a blank with no accepted answers would mark
// every learner wrong forever.
check(
  "blank with no accepted answers is rejected",
  validatePayload("SHORT_TEXT", { blanks: [{ id: "1", acceptedAnswers: [] }] }).valid,
  false
);
check("normalizeText collapses whitespace", normalizeText("  a   b  "), "a b");

// ── MATCHING ───────────────────────────────────────────────────────
section("MATCHING — IELTS matching headings");

const ma = {
  left: [
    { id: "p1", text: "Paragraph 1" },
    { id: "p2", text: "Paragraph 2" },
  ],
  right: [
    { id: "h1", text: "Heading one" },
    { id: "h2", text: "Heading two" },
    { id: "h3", text: "Heading three (distractor)" },
  ],
  correctPairs: [
    { leftId: "p1", rightId: "h2" },
    { leftId: "p2", rightId: "h1" },
  ],
};

// IELTS ships more headings than paragraphs on purpose.
check("more right items than left is valid (distractors)", validatePayload("MATCHING", ma).valid, true);
check(
  "all pairs correct scores 1",
  gradeResponse("MATCHING", ma, { pairs: [{ leftId: "p1", rightId: "h2" }, { leftId: "p2", rightId: "h1" }] }).score,
  1
);
check(
  "half the pairs scores 0.5",
  gradeResponse("MATCHING", ma, { pairs: [{ leftId: "p1", rightId: "h2" }, { leftId: "p2", rightId: "h3" }] }).score,
  0.5
);
// Scoring against correctPairs (not submissions) is what stops this being 1.0.
check(
  "answering only one pair scores 0.5, not 1",
  gradeResponse("MATCHING", ma, { pairs: [{ leftId: "p1", rightId: "h2" }] }).score,
  0.5
);
check("no pairs scores 0", gradeResponse("MATCHING", ma, { pairs: [] }).score, 0);
check(
  "duplicate leftId ignored after first (malformed input, not a second chance)",
  gradeResponse("MATCHING", ma, {
    pairs: [{ leftId: "p1", rightId: "h9" }, { leftId: "p1", rightId: "h2" }],
  }).score,
  0
);
check(
  "two correct pairs for one left item rejected",
  validatePayload("MATCHING", {
    ...ma,
    correctPairs: [{ leftId: "p1", rightId: "h1" }, { leftId: "p1", rightId: "h2" }],
  }).valid,
  false
);
check(
  "pair referencing an unknown right item rejected",
  validatePayload("MATCHING", { ...ma, correctPairs: [{ leftId: "p1", rightId: "nope" }] }).valid,
  false
);

// ── ORDERING ───────────────────────────────────────────────────────
section("ORDERING");

const or = {
  items: [
    { id: "a", text: "First" },
    { id: "b", text: "Second" },
    { id: "c", text: "Third" },
  ],
  correctOrder: ["a", "b", "c"],
};

check("valid payload", validatePayload("ORDERING", or).valid, true);
check("exact order scores 1", gradeResponse("ORDERING", or, { order: ["a", "b", "c"] }).score, 1);
check("wrong order scores 0", gradeResponse("ORDERING", or, { order: ["a", "c", "b"] }).score, 0);
check("short order scores 0", gradeResponse("ORDERING", or, { order: ["a", "b"] }).score, 0);
check(
  "correctOrder missing an item rejected",
  validatePayload("ORDERING", { ...or, correctOrder: ["a", "b"] }).valid,
  false
);
check(
  "correctOrder repeating an item rejected",
  validatePayload("ORDERING", { ...or, correctOrder: ["a", "b", "b"] }).valid,
  false
);

// ── Legacy bridge ──────────────────────────────────────────────────
section("Legacy bridge — the migration choke point");

const legacyRow = {
  responseFormat: "SINGLE_CHOICE",
  payload: null,
  optionA: "live",
  optionB: "lives",
  optionC: "living",
  optionD: "lived",
  correctOption: "A",
};

check("legacy row derives a payload", payloadFromLegacyColumns(legacyRow), sc);
check("getQuestionPayload falls back to legacy columns", getQuestionPayload(legacyRow), sc);
check(
  "getQuestionPayload prefers payload when present",
  getQuestionPayload({ ...legacyRow, payload: JSON.stringify(tfng), responseFormat: "SINGLE_CHOICE" }),
  tfng
);
// A corrupt payload must surface, not silently serve stale columns.
check(
  "invalid payload returns null rather than falling back",
  getQuestionPayload({ ...legacyRow, payload: '{"options":[]}' }),
  null
);
check("malformed JSON returns null", getQuestionPayload({ ...legacyRow, payload: "{not json" }), null);
// Non-MCQ has no legacy fallback — the honest answer.
check(
  "MATCHING with no payload returns null (columns cannot express it)",
  getQuestionPayload({ ...legacyRow, responseFormat: "MATCHING" }),
  null
);
check("round-trip: payload → legacy columns", toLegacyColumns("SINGLE_CHOICE", sc), {
  optionA: "live",
  optionB: "lives",
  optionC: "living",
  optionD: "lived",
  correctOption: "A",
});
check("toLegacyColumns refuses MATCHING", toLegacyColumns("MATCHING", ma), null);
check("toLegacyColumns refuses 3-option TFNG", toLegacyColumns("SINGLE_CHOICE", tfng), null);

// ── parsePayload ───────────────────────────────────────────────────
section("parsePayload");

check("parses valid JSON payload", parsePayload("SINGLE_CHOICE", JSON.stringify(sc)).payload, sc);
check("rejects malformed JSON", parsePayload("SINGLE_CHOICE", "{oops").result.valid, false);
check("unknown format rejected, not thrown", validatePayload("NONSENSE", {}).valid, false);

// ── Summary ────────────────────────────────────────────────────────
// ── toPublicPayload — the answer-key-stripping boundary ────────────────────
section("toPublicPayload — must never leak an answer key to the client");

check("SINGLE_CHOICE: strips correctOptionId", toPublicPayload("SINGLE_CHOICE", sc), { options: sc.options });
check(
  "MULTI_CHOICE: strips correctOptionIds",
  toPublicPayload("MULTI_CHOICE", mc),
  { options: mc.options }
);
check(
  "SHORT_TEXT: strips acceptedAnswers, keeps only blank ids",
  toPublicPayload("SHORT_TEXT", twoBlanks),
  { blanks: [{ id: "1" }, { id: "2" }] }
);
check(
  "MATCHING: strips correctPairs, keeps left/right",
  toPublicPayload("MATCHING", ma),
  { left: ma.left, right: ma.right }
);
check(
  "ORDERING: strips correctOrder, keeps items",
  toPublicPayload("ORDERING", or),
  { items: or.items }
);
// The literal security property: JSON.stringify-ing the public payload must
// never contain the answer-key field names, so a leak can't slip in through
// an unrelated field added later without this test catching it.
for (const [name, format, payload] of [
  ["SINGLE_CHOICE", "SINGLE_CHOICE", sc],
  ["MULTI_CHOICE", "MULTI_CHOICE", mc],
  ["SHORT_TEXT", "SHORT_TEXT", twoBlanks],
  ["MATCHING", "MATCHING", ma],
  ["ORDERING", "ORDERING", or],
]) {
  const json = JSON.stringify(toPublicPayload(format, payload));
  check(
    `${name}: serialized public payload contains no answer-key field name`,
    /correctOptionId|correctOptionIds|acceptedAnswers|correctPairs|correctOrder/.test(json),
    false
  );
}

console.log(`\n${"─".repeat(50)}`);
console.log(`  passed: ${passed}   failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
