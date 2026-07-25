/**
 * Question format — public surface.
 *
 * THE MIGRATION CHOKE POINT
 * -------------------------
 * `getQuestionPayload()` is the single place where a legacy A/B/C/D row and a
 * `payload` row stop looking different. It exists so the reform can be additive:
 * 29 files read optionA-D today, and rewriting all of them in one change — in a
 * repo with no type-safe test net over them — would be the riskiest possible way
 * to do this. Instead the columns stay, this accessor absorbs the difference,
 * and readers move one at a time.
 *
 * The two-shape hazard is real and is handled by ordering, not by hope:
 *   1. payload is backfilled for ALL rows immediately (backfill-question-payload.ts)
 *   2. so payload is authoritative from that moment on
 *   3. optionA-D linger as legacy columns that writers still fill
 *   4. they are dropped only once every reader is off them
 * The window where the two could drift is bounded by step 1 and closed by
 * writing through toLegacyColumns(), never by writing the columns by hand.
 *
 * See docs/QUESTION_MODEL_REFORM.md.
 */

export * from "./types";
export { validatePayload, parsePayload } from "./validate";
export { gradeResponse, normalizeText } from "./grade";
export { toPublicPayload } from "./publicPayload";
export { describeResponse, describeCorrectAnswer } from "./describe";
export type {
  PublicQuestionPayload,
  PublicSingleChoicePayload,
  PublicMultiChoicePayload,
  PublicShortTextPayload,
  PublicMatchingPayload,
  PublicOrderingPayload,
} from "./publicPayload";

import { parsePayload } from "./validate";
import type {
  QuestionPayload,
  ResponseFormatName,
  SingleChoicePayload,
} from "./types";

/**
 * The subset of `Question` this module reads. Structural on purpose — keeps the
 * core pure and testable without a generated Prisma client, and makes it
 * explicit that nothing here depends on the rest of the row.
 */
export interface QuestionFormatFields {
  responseFormat: ResponseFormatName;
  payload: string | null;
  // Legacy MCQ columns — the fallback source before/if payload is absent.
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
}

export const LEGACY_OPTION_IDS = ["A", "B", "C", "D"] as const;

/**
 * Build a SINGLE_CHOICE payload from the legacy columns.
 *
 * Exported because the backfill and the accessor must derive it identically —
 * two implementations of "what did these four columns mean" is precisely the
 * kind of drift this reform exists to end.
 */
export function payloadFromLegacyColumns(q: QuestionFormatFields): SingleChoicePayload {
  return {
    options: [
      { id: "A", text: q.optionA },
      { id: "B", text: q.optionB },
      { id: "C", text: q.optionC },
      { id: "D", text: q.optionD },
    ],
    correctOptionId: q.correctOption,
  };
}

/**
 * Project a SINGLE_CHOICE payload back onto the legacy columns, so a writer can
 * keep them truthful while readers migrate.
 *
 * Returns null for any other format — and that null is the honest answer, not a
 * gap. A MATCHING question genuinely has no A/B/C/D, and inventing four columns
 * for it would recreate the exact lie this reform removes (WORD_FORMATION and
 * SENTENCE_TRANSFORMATION are production tasks currently stored as selection).
 * Callers must treat null as "this question cannot be written to a legacy
 * reader" — which is true, and is why those readers must migrate before
 * non-MCQ content ships to learners.
 */
export function toLegacyColumns(
  format: ResponseFormatName,
  payload: QuestionPayload
): { optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string } | null {
  if (format !== "SINGLE_CHOICE") return null;
  const p = payload as SingleChoicePayload;
  if (p.options.length !== 4) return null;
  const byId = new Map(p.options.map((o) => [o.id, o.text]));
  const cols = LEGACY_OPTION_IDS.map((id) => byId.get(id));
  if (cols.some((c) => c === undefined)) return null; // not A/B/C/D-shaped
  return {
    optionA: cols[0]!,
    optionB: cols[1]!,
    optionC: cols[2]!,
    optionD: cols[3]!,
    correctOption: p.correctOptionId,
  };
}

/**
 * Read a question's answer shape, whatever era it was written in.
 *
 * Order matters: `payload` wins when present. Falling back to the legacy
 * columns only for SINGLE_CHOICE is deliberate — for any other format the
 * columns cannot express the question, so a fallback would fabricate one.
 *
 * Returns null when the payload is present but invalid, rather than silently
 * falling back to the columns: a corrupt payload is a real problem that must
 * surface, and quietly serving stale column data would hide it.
 */
export function getQuestionPayload(q: QuestionFormatFields): QuestionPayload | null {
  if (q.payload !== null && q.payload.length > 0) {
    const { payload } = parsePayload(q.responseFormat, q.payload);
    return payload;
  }
  if (q.responseFormat === "SINGLE_CHOICE") {
    return payloadFromLegacyColumns(q);
  }
  return null;
}
