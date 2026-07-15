/**
 * Question format registry — payload and response shapes per ResponseFormat.
 *
 * WHY THIS EXISTS
 * ---------------
 * `Question` was built around one exam: Hà Nội Grade-10 English, which
 * examBlueprint.ts records as "100% multiple choice (A/B/C/D), machine-marked".
 * For that exam, four required option columns are FAITHFUL, not a shortcut.
 * They stop being faithful the moment a source is not that exam:
 *
 *   - IELTS True/False/Not Given  → 3 options, not 4
 *   - IELTS matching headings     → N-to-M pairing, no "options" at all
 *   - gap fill / summary completion → the learner TYPES; there is nothing to pick
 *
 * And it is not only a future problem. In the current bank, WORD_FORMATION (12)
 * and SENTENCE_TRANSFORMATION (15) — 27 of 122 questions — are PRODUCTION tasks
 * ("Viết lại câu…", "She sings very ___. (BEAUTIFUL)") stored as SELECTION.
 * The real exam is MCQ so the seed is honest; a general model must not be.
 *
 * THE DIVISION OF LABOUR (the whole design)
 * -----------------------------------------
 *   Columns hold what the system QUERIES — topic, skill, difficulty,
 *   knowledgeUnitId. The coverage report and the Decision Engine read these.
 *   JSON holds what only the GRADER reads — options, blanks, pairs, answers.
 *
 * Nothing queryable may move into the payload. That rule is what keeps this
 * from decaying into "a JSON blob called Question".
 *
 * PURITY
 * ------
 * This module and its siblings (validate.ts, grade.ts) are pure: no Prisma, no
 * I/O. Same discipline as lib/analytics — repository fetches, pure engine
 * decides. That is what makes scripts/test-question-formats.mjs able to cover
 * every format without a database.
 */

// Mirrors the Prisma `ResponseFormat` enum. Declared independently so this
// core stays importable by pure tests without generating a Prisma client.
export type ResponseFormatName =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "SHORT_TEXT"
  | "MATCHING"
  | "ORDERING";

export const RESPONSE_FORMATS: readonly ResponseFormatName[] = [
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "SHORT_TEXT",
  "MATCHING",
  "ORDERING",
] as const;

// ── Option-based formats ───────────────────────────────────────────

/**
 * One selectable option. `id` is a stable handle ("A", "TRUE", "h3") — never a
 * positional index, because shuffling options for presentation must never
 * change what the stored answer means.
 */
export interface ChoiceOption {
  id: string;
  text: string;
}

/**
 * Pick exactly one of N. Subsumes the legacy A/B/C/D MCQ (N=4) and IELTS
 * True/False/Not Given (N=3) — the same shape, which is the point: a new exam
 * must not require a new format.
 */
export interface SingleChoicePayload {
  options: ChoiceOption[];
  correctOptionId: string;
}

export interface SingleChoiceResponse {
  optionId: string;
}

/** Pick M of N. All correct ids and no incorrect ones = fully correct. */
export interface MultiChoicePayload {
  options: ChoiceOption[];
  correctOptionIds: string[];
}

export interface MultiChoiceResponse {
  optionIds: string[];
}

// ── Production formats ─────────────────────────────────────────────

/**
 * One blank the learner types into.
 *
 * `acceptedAnswers` is a LIST because natural language has more than one right
 * answer ("don't" / "do not"), and a grader that knows only one of them marks a
 * correct learner wrong. That is a worse failure than a missing feature: it
 * silently corrupts the mastery signal the Decision Engine is built on.
 */
export interface TextBlank {
  id: string;
  acceptedAnswers: string[];
  caseSensitive?: boolean; // default false — see normalizeText()
}

/** Gap fill, word formation, sentence transformation, summary completion. */
export interface ShortTextPayload {
  blanks: TextBlank[];
}

export interface ShortTextResponse {
  answers: Record<string, string>; // blankId → what the learner typed
}

// ── Relational formats ─────────────────────────────────────────────

/** Pair each left item with a right item. IELTS matching headings/information. */
export interface MatchingPayload {
  left: ChoiceOption[];
  right: ChoiceOption[];
  correctPairs: MatchingPair[];
  // IELTS matching-headings supplies more headings than paragraphs on purpose
  // (distractors), so `right` may legitimately be longer than `left`. Not an error.
}

export interface MatchingPair {
  leftId: string;
  rightId: string;
}

export interface MatchingResponse {
  pairs: MatchingPair[];
}

/** Arrange items into the correct sequence. */
export interface OrderingPayload {
  items: ChoiceOption[];
  correctOrder: string[]; // item ids, in order
}

export interface OrderingResponse {
  order: string[];
}

// ── Unions ─────────────────────────────────────────────────────────

export type QuestionPayload =
  | SingleChoicePayload
  | MultiChoicePayload
  | ShortTextPayload
  | MatchingPayload
  | OrderingPayload;

export type QuestionResponse =
  | SingleChoiceResponse
  | MultiChoiceResponse
  | ShortTextResponse
  | MatchingResponse
  | OrderingResponse;

/**
 * Grading outcome.
 *
 * `score` is 0..1 and always set; `isCorrect` is `score === 1`. Both exist
 * because they answer different questions: `isCorrect` is what every existing
 * accuracy calculation in lib/analytics already reads (~10 call sites), and
 * `score` is what partial credit needs. Redefining `isCorrect` to mean
 * "score > 0.5" would silently rewrite every mastery number in the app.
 */
export interface GradeResult {
  isCorrect: boolean;
  score: number;
  /** Per-part detail — which blank/pair was right. Drives review UI, not mastery. */
  detail?: Record<string, boolean>;
}

/** Why a payload was rejected. Mirrors the shape used by contentValidation.ts. */
export interface FormatValidationIssue {
  field: string;
  message: string;
}

export interface FormatValidationResult {
  valid: boolean;
  issues: FormatValidationIssue[];
}
