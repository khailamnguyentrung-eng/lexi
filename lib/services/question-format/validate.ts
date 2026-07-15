/**
 * Payload validation — one validator per ResponseFormat. Pure; no Prisma.
 *
 * Hand-rolled rather than schema-library-driven, matching
 * content-intelligence/contentValidation.ts. This is a deliberate consistency
 * choice, not an oversight: the repo has no zod today, and adding a dependency
 * to validate five small shapes is a bigger commitment than writing them out.
 * If a sixth format lands and these start repeating, revisit it then.
 *
 * These validators are the gate between "AI proposed a question" and "the
 * question bank accepted it". They must reject a payload the grader could not
 * grade — a malformed payload that reaches a learner produces a wrong mastery
 * signal, and the Decision Engine has no way to know it was garbage.
 */

import type {
  FormatValidationIssue,
  FormatValidationResult,
  MatchingPayload,
  MultiChoicePayload,
  OrderingPayload,
  QuestionPayload,
  ResponseFormatName,
  ShortTextPayload,
  SingleChoicePayload,
  ChoiceOption,
} from "./types";

function ok(): FormatValidationResult {
  return { valid: true, issues: [] };
}

function fail(issues: FormatValidationIssue[]): FormatValidationResult {
  return { valid: issues.length === 0, issues };
}

/**
 * Options must be non-empty, have unique ids, and carry text. Unique ids matter
 * more than they look: ids are how a stored answer survives option shuffling,
 * so a duplicate id makes the correct answer ambiguous rather than merely ugly.
 */
function validateOptions(
  options: unknown,
  field: string,
  minimum: number
): FormatValidationIssue[] {
  const issues: FormatValidationIssue[] = [];
  if (!Array.isArray(options)) {
    return [{ field, message: `${field} must be an array` }];
  }
  if (options.length < minimum) {
    issues.push({ field, message: `${field} needs at least ${minimum} entries, got ${options.length}` });
  }
  const seen = new Set<string>();
  options.forEach((raw, i) => {
    const opt = raw as Partial<ChoiceOption>;
    if (typeof opt?.id !== "string" || opt.id.length === 0) {
      issues.push({ field: `${field}[${i}].id`, message: "option id must be a non-empty string" });
      return;
    }
    if (seen.has(opt.id)) {
      issues.push({ field: `${field}[${i}].id`, message: `duplicate option id "${opt.id}"` });
    }
    seen.add(opt.id);
    if (typeof opt.text !== "string" || opt.text.trim().length === 0) {
      issues.push({ field: `${field}[${i}].text`, message: `option "${opt.id}" has empty text` });
    }
  });
  return issues;
}

function optionIds(options: ChoiceOption[]): Set<string> {
  return new Set(options.map((o) => o.id));
}

function validateSingleChoice(p: SingleChoicePayload): FormatValidationResult {
  const issues = validateOptions(p?.options, "options", 2);
  if (issues.length > 0) return fail(issues);
  if (typeof p.correctOptionId !== "string" || !optionIds(p.options).has(p.correctOptionId)) {
    issues.push({
      field: "correctOptionId",
      message: `correctOptionId "${p.correctOptionId}" is not one of the options`,
    });
  }
  return fail(issues);
}

function validateMultiChoice(p: MultiChoicePayload): FormatValidationResult {
  const issues = validateOptions(p?.options, "options", 2);
  if (issues.length > 0) return fail(issues);
  if (!Array.isArray(p.correctOptionIds) || p.correctOptionIds.length === 0) {
    issues.push({ field: "correctOptionIds", message: "at least one correct option is required" });
    return fail(issues);
  }
  const ids = optionIds(p.options);
  p.correctOptionIds.forEach((id, i) => {
    if (!ids.has(id)) {
      issues.push({ field: `correctOptionIds[${i}]`, message: `"${id}" is not one of the options` });
    }
  });
  if (new Set(p.correctOptionIds).size !== p.correctOptionIds.length) {
    issues.push({ field: "correctOptionIds", message: "correctOptionIds contains duplicates" });
  }
  return fail(issues);
}

function validateShortText(p: ShortTextPayload): FormatValidationResult {
  const issues: FormatValidationIssue[] = [];
  if (!Array.isArray(p?.blanks) || p.blanks.length === 0) {
    return fail([{ field: "blanks", message: "at least one blank is required" }]);
  }
  const seen = new Set<string>();
  p.blanks.forEach((b, i) => {
    if (typeof b?.id !== "string" || b.id.length === 0) {
      issues.push({ field: `blanks[${i}].id`, message: "blank id must be a non-empty string" });
      return;
    }
    if (seen.has(b.id)) {
      issues.push({ field: `blanks[${i}].id`, message: `duplicate blank id "${b.id}"` });
    }
    seen.add(b.id);
    // An empty acceptedAnswers list would mark every learner wrong forever —
    // the exact silent-corruption case this gate exists to stop.
    if (!Array.isArray(b.acceptedAnswers) || b.acceptedAnswers.length === 0) {
      issues.push({
        field: `blanks[${i}].acceptedAnswers`,
        message: `blank "${b.id}" has no accepted answers`,
      });
      return;
    }
    if (b.acceptedAnswers.some((a) => typeof a !== "string" || a.trim().length === 0)) {
      issues.push({
        field: `blanks[${i}].acceptedAnswers`,
        message: `blank "${b.id}" has a blank accepted answer`,
      });
    }
  });
  return fail(issues);
}

function validateMatching(p: MatchingPayload): FormatValidationResult {
  const issues = [
    ...validateOptions(p?.left, "left", 1),
    ...validateOptions(p?.right, "right", 1),
  ];
  if (issues.length > 0) return fail(issues);
  if (!Array.isArray(p.correctPairs) || p.correctPairs.length === 0) {
    issues.push({ field: "correctPairs", message: "at least one correct pair is required" });
    return fail(issues);
  }
  const leftIds = optionIds(p.left);
  const rightIds = optionIds(p.right);
  const pairedLeft = new Set<string>();
  p.correctPairs.forEach((pair, i) => {
    if (!leftIds.has(pair?.leftId)) {
      issues.push({ field: `correctPairs[${i}].leftId`, message: `"${pair?.leftId}" is not a left item` });
    }
    if (!rightIds.has(pair?.rightId)) {
      issues.push({ field: `correctPairs[${i}].rightId`, message: `"${pair?.rightId}" is not a right item` });
    }
    // Each left item may be answered once. Two correct answers for one prompt
    // is not a hard task, it is an unanswerable one.
    if (pairedLeft.has(pair?.leftId)) {
      issues.push({
        field: `correctPairs[${i}].leftId`,
        message: `left item "${pair.leftId}" has more than one correct pair`,
      });
    }
    pairedLeft.add(pair?.leftId);
  });
  // NOTE: `right` longer than `left` is legitimate — IELTS matching headings
  // ships distractor headings on purpose. Not validated as an error.
  return fail(issues);
}

function validateOrdering(p: OrderingPayload): FormatValidationResult {
  const issues = validateOptions(p?.items, "items", 2);
  if (issues.length > 0) return fail(issues);
  if (!Array.isArray(p.correctOrder)) {
    return fail([{ field: "correctOrder", message: "correctOrder must be an array" }]);
  }
  const ids = optionIds(p.items);
  if (p.correctOrder.length !== p.items.length) {
    issues.push({
      field: "correctOrder",
      message: `correctOrder lists ${p.correctOrder.length} of ${p.items.length} items`,
    });
  }
  p.correctOrder.forEach((id, i) => {
    if (!ids.has(id)) {
      issues.push({ field: `correctOrder[${i}]`, message: `"${id}" is not one of the items` });
    }
  });
  if (new Set(p.correctOrder).size !== p.correctOrder.length) {
    issues.push({ field: "correctOrder", message: "correctOrder repeats an item" });
  }
  return fail(issues);
}

/**
 * Validate a payload against its declared format.
 *
 * Returns invalid (never throws) for an unknown format, so an enum value added
 * in the schema without a validator here fails loudly at the gate instead of
 * being silently waved through.
 */
export function validatePayload(
  format: ResponseFormatName,
  payload: QuestionPayload
): FormatValidationResult {
  if (payload === null || typeof payload !== "object") {
    return fail([{ field: "payload", message: "payload must be an object" }]);
  }
  switch (format) {
    case "SINGLE_CHOICE":
      return validateSingleChoice(payload as SingleChoicePayload);
    case "MULTI_CHOICE":
      return validateMultiChoice(payload as MultiChoicePayload);
    case "SHORT_TEXT":
      return validateShortText(payload as ShortTextPayload);
    case "MATCHING":
      return validateMatching(payload as MatchingPayload);
    case "ORDERING":
      return validateOrdering(payload as OrderingPayload);
    default:
      return fail([{ field: "responseFormat", message: `no validator for format "${format}"` }]);
  }
}

/** Parse + validate a JSON payload string as stored in `Question.payload`. */
export function parsePayload(
  format: ResponseFormatName,
  raw: string
): { payload: QuestionPayload | null; result: FormatValidationResult } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      payload: null,
      result: fail([{ field: "payload", message: "payload is not valid JSON" }]),
    };
  }
  const result = validatePayload(format, parsed as QuestionPayload);
  return { payload: result.valid ? (parsed as QuestionPayload) : null, result };
}
