/**
 * Strip the answer key out of a payload before it reaches a learner.
 *
 * `getQuestionPayload()` returns the FULL payload — correct answers included,
 * because the grader (server-side) needs them. Sending that same object to
 * the client would mean the correct answer sits in a page's initial data or
 * a network response body a student can read in devtools before answering —
 * exactly the thing the legacy code never did (the old `QuizQuestion` type
 * never included `correctOption` on the initial question fetch; it only
 * arrived in the POST /attempt response, after submission). This function is
 * what makes that same discipline hold for every new format.
 *
 * Pure — no Prisma, matching the rest of this module.
 */

import type {
  MatchingPayload,
  MultiChoicePayload,
  OrderingPayload,
  QuestionPayload,
  ResponseFormatName,
  ShortTextPayload,
  SingleChoicePayload,
} from "./types";

/** The subset of each payload safe to show BEFORE a learner answers. */
export type PublicSingleChoicePayload = Pick<SingleChoicePayload, "options">;
export type PublicMultiChoicePayload = Pick<MultiChoicePayload, "options">;
export interface PublicShortTextPayload {
  blanks: { id: string }[]; // no acceptedAnswers
}
export type PublicMatchingPayload = Pick<MatchingPayload, "left" | "right">;
export type PublicOrderingPayload = Pick<OrderingPayload, "items">;

export type PublicQuestionPayload =
  | PublicSingleChoicePayload
  | PublicMultiChoicePayload
  | PublicShortTextPayload
  | PublicMatchingPayload
  | PublicOrderingPayload;

export function toPublicPayload(
  format: ResponseFormatName,
  payload: QuestionPayload
): PublicQuestionPayload {
  switch (format) {
    case "SINGLE_CHOICE":
      return { options: (payload as SingleChoicePayload).options };
    case "MULTI_CHOICE":
      return { options: (payload as MultiChoicePayload).options };
    case "SHORT_TEXT":
      return { blanks: (payload as ShortTextPayload).blanks.map((b) => ({ id: b.id })) };
    case "MATCHING": {
      const p = payload as MatchingPayload;
      return { left: p.left, right: p.right };
    }
    case "ORDERING":
      return { items: (payload as OrderingPayload).items };
  }
}
