/**
 * Grading — one grader per ResponseFormat. Pure; no Prisma.
 *
 * This is the highest-stakes module in the reform. A grader that marks a
 * correct learner wrong does not produce a bug report — it produces a wrong
 * mastery signal, which the Decision Engine consumes as truth and turns into a
 * recommendation. There is no downstream check that would catch it. So the
 * rules here are conservative and explicit rather than clever.
 *
 * `score` is always 0..1; `isCorrect` is always `score === 1`. See types.ts for
 * why both exist.
 */

import type {
  GradeResult,
  MatchingPayload,
  MatchingResponse,
  MultiChoicePayload,
  MultiChoiceResponse,
  OrderingPayload,
  OrderingResponse,
  QuestionPayload,
  QuestionResponse,
  ResponseFormatName,
  ShortTextPayload,
  ShortTextResponse,
  SingleChoicePayload,
  SingleChoiceResponse,
} from "./types";

function result(score: number, detail?: Record<string, boolean>): GradeResult {
  // Clamp defensively: a scoring bug must not be able to emit a mastery number
  // outside 0..1 and corrupt every average computed from it.
  const clamped = Math.max(0, Math.min(1, score));
  return { isCorrect: clamped === 1, score: clamped, ...(detail ? { detail } : {}) };
}

/**
 * Text answer normalization for SHORT_TEXT.
 *
 * Deliberately limited to whitespace collapsing and (optional) case folding.
 * It does NOT strip punctuation, correct spelling, or fuzzy-match — the same
 * reasoning DECISION_LOG records for topic matching ("no fuzzy matching, no AI
 * classification"): a near-miss is a judgement call, and silently accepting it
 * would hide a real learner error inside a "correct" mastery signal.
 *
 * Curly vs straight apostrophes ARE folded — that difference is a keyboard
 * artifact, not a language error, and "don’t" vs "don't" is not a distinction
 * any learner intended to make.
 */
export function normalizeText(raw: string, caseSensitive = false): string {
  const collapsed = raw
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

function gradeSingleChoice(p: SingleChoicePayload, r: SingleChoiceResponse): GradeResult {
  return result(r?.optionId === p.correctOptionId ? 1 : 0);
}

/**
 * MULTI_CHOICE uses all-or-nothing, NOT per-option partial credit.
 *
 * Per-option credit rewards selecting everything: on a 4-option question with 2
 * correct, ticking all 4 would score 0.5 while demonstrating no knowledge.
 * Partial credit is only meaningful where each part is independently answerable
 * (MATCHING, SHORT_TEXT), which is why those two have it and this does not.
 */
function gradeMultiChoice(p: MultiChoicePayload, r: MultiChoiceResponse): GradeResult {
  const picked = new Set(r?.optionIds ?? []);
  const correct = new Set(p.correctOptionIds);
  if (picked.size !== correct.size) return result(0);
  for (const id of correct) if (!picked.has(id)) return result(0);
  return result(1);
}

/** Per-blank partial credit: each blank is independently answerable. */
function gradeShortText(p: ShortTextPayload, r: ShortTextResponse): GradeResult {
  const answers = r?.answers ?? {};
  const detail: Record<string, boolean> = {};
  let correct = 0;
  for (const blank of p.blanks) {
    const given = answers[blank.id];
    const isRight =
      typeof given === "string" &&
      blank.acceptedAnswers.some(
        (accepted) =>
          normalizeText(accepted, blank.caseSensitive) ===
          normalizeText(given, blank.caseSensitive)
      );
    detail[blank.id] = isRight;
    if (isRight) correct++;
  }
  return result(correct / p.blanks.length, detail);
}

/**
 * Per-pair partial credit, scored against the number of CORRECT pairs — not
 * the number the learner submitted. Scoring against submissions would let a
 * learner answer one easy pair, skip the rest, and score 1.0.
 *
 * Duplicate leftIds in a response are ignored after the first: the payload
 * validator guarantees one correct pair per left item, so a second answer for
 * the same prompt is malformed input, not a second chance.
 */
function gradeMatching(p: MatchingPayload, r: MatchingResponse): GradeResult {
  const submitted = new Map<string, string>();
  for (const pair of r?.pairs ?? []) {
    if (pair && typeof pair.leftId === "string" && !submitted.has(pair.leftId)) {
      submitted.set(pair.leftId, pair.rightId);
    }
  }
  const detail: Record<string, boolean> = {};
  let correct = 0;
  for (const pair of p.correctPairs) {
    const isRight = submitted.get(pair.leftId) === pair.rightId;
    detail[pair.leftId] = isRight;
    if (isRight) correct++;
  }
  return result(correct / p.correctPairs.length, detail);
}

/**
 * ORDERING is all-or-nothing.
 *
 * Position-wise credit is misleading here: one item inserted at the front
 * shifts every subsequent item, scoring ~0 for a learner who had the sequence
 * essentially right. Rank-correlation scoring would be fairer but is a real
 * modelling decision with no learner data to validate it against — so this
 * stays binary and honest until there is evidence to tune against.
 * Revisit alongside D-1 (DECISION_ENGINE_OPTIONS.md) once real learners exist.
 */
function gradeOrdering(p: OrderingPayload, r: OrderingResponse): GradeResult {
  const given = r?.order ?? [];
  if (given.length !== p.correctOrder.length) return result(0);
  for (let i = 0; i < given.length; i++) {
    if (given[i] !== p.correctOrder[i]) return result(0);
  }
  return result(1);
}

/**
 * Grade a response against a payload.
 *
 * Throws on an unknown format rather than returning 0: a silent 0 would be
 * indistinguishable from a genuinely wrong answer and would quietly teach the
 * Decision Engine that the learner failed something it never actually asked.
 * Callers validate with validatePayload() first.
 */
export function gradeResponse(
  format: ResponseFormatName,
  payload: QuestionPayload,
  response: QuestionResponse
): GradeResult {
  switch (format) {
    case "SINGLE_CHOICE":
      return gradeSingleChoice(payload as SingleChoicePayload, response as SingleChoiceResponse);
    case "MULTI_CHOICE":
      return gradeMultiChoice(payload as MultiChoicePayload, response as MultiChoiceResponse);
    case "SHORT_TEXT":
      return gradeShortText(payload as ShortTextPayload, response as ShortTextResponse);
    case "MATCHING":
      return gradeMatching(payload as MatchingPayload, response as MatchingResponse);
    case "ORDERING":
      return gradeOrdering(payload as OrderingPayload, response as OrderingResponse);
    default:
      throw new Error(`gradeResponse: no grader for format "${format}"`);
  }
}
