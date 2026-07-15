# QM-1 — Question Model Reform: response formats

**Status:** Foundation implemented **and verified** 2026-07-15. Additive; no reader migrated yet (§6).

**Evidence (run, not asserted):**
- `npm run test:question-formats` — **54/54 pass**, all five formats + the legacy bridge
- `npx tsc --noEmit` — clean
- existing suites unaffected: `test:knowledge-mapping` 46/46, `test:knowledge-coverage` 42/42,
  `test:content-validation` 80/80
- backfill applied: **122/122 questions carry a payload; 0 remaining, 0 invalid**
- **round-trip proof against real rows:** every one of the 122 payloads was read back from
  `dev.db`, its legacy `correctOption` graded through the new path (all scored 1), and a wrong
  option graded through the same path (all scored 0). **122 agree, 0 disagree.**

**Not verified:** no UI was exercised — nothing renders a payload yet (§6), so there is no browser
surface to observe. The practice flow still reads the legacy columns, untouched.
**Trigger:** founder, 2026-07-15 — *"giả sử có các model Question lạ hơn như fill in the blank,
matching blocks… từ các kì thi hay tài liệu học thuật khác thì tính thế nào?"*
**Related:** `KU1_PARTB_DESIGN.md` §1.5 (which put this on the critical path), `MOCKTESTTAB_DESIGN.md`.

---

## 1. The finding: this is not a future problem

Measured against `prisma/dev.db`, not assumed:

| `QuestionType` | n | What the learner is really asked to do | What is stored |
|---|---|---|---|
| `SENTENCE_TRANSFORMATION` | 15 | *"Viết lại câu…"* — **produce** a sentence | pick 1 of 4 |
| `WORD_FORMATION` | 12 | *"She sings very ___. (BEAUTIFUL)"* — **produce** a word | pick 1 of 4 |

**27 of 122 questions (22%) are production tasks stored as selection.**

**This is not a bug in the seed data.** `lib/analytics/examBlueprint.ts` records the target exam as
*"100% multiple choice (A/B/C/D), machine-marked"* — for Hà Nội Grade-10, MCQ **is** faithful. The
model is correct for the one exam it was built for, and wrong the moment it leaves it. That is
exactly the founder's question, and the answer is: the format problem is already here, dormant,
because every source so far has been the same exam.

## 2. The root cause: three "what" axes, no "how" axis

`QuestionType` conflates **what is tested** with **how it is answered**:

- `GRAMMAR_MCQ` — carries the answer format in its own name
- `CLOZE` — a *format* (gap fill), stored as MCQ
- `READING_COMPREHENSION` — a *skill*
- `WORD_FORMATION` — a *topic*

And it **overlaps `SkillCategory`**: `PHONETICS_STRESS` is a member of **both enums**, with
different counts (`type` = 6, `skill` = 12 — because the *skill* covers both `PHONETICS_SOUND` and
`PHONETICS_STRESS` types). Add `topic` / `knowledgeUnitId` and the model has **three overlapping
"what" axes and no "how" axis at all**.

So `MATCHING_HEADINGS` must **not** be added to `QuestionType`. That deepens the confusion and buys
one exam. The fix is to add the axis that is missing.

## 3. The design

### 3.1 `ResponseFormat` — the missing axis

Five members, format-shaped not exam-shaped:

| Format | Covers |
|---|---|
| `SINGLE_CHOICE` | legacy A/B/C/D MCQ **and** IELTS True/False/Not Given (same shape, 3 options) |
| `MULTI_CHOICE` | pick M of N |
| `SHORT_TEXT` | gap fill, word formation, sentence transformation, summary completion |
| `MATCHING` | IELTS matching headings / information / features |
| `ORDERING` | sequence tasks |

**The test this enum must keep passing: a new exam must not require a new member.** IELTS needed
zero. If SAT or an academic source forces a sixth, that is a signal the decomposition is wrong —
not a routine addition.

### 3.2 The division of labour — the whole design in one rule

> **Columns hold what the system QUERIES. JSON holds what only the GRADER reads.**

- **Columns** — `topic`, `skill`, `difficulty`, `knowledgeUnitId`. The coverage report and the
  Decision Engine query these. **Nothing queryable may move into the payload.**
- **`payload` (JSON)** — options, blanks, pairs, correct answers. Shape varies per format; no fixed
  column set can hold all five, which is precisely how the model got stuck at 4-option MCQ.

That rule is what keeps this from decaying into "a JSON blob called Question". It is also why the
reform does not disturb the Decision Engine work: everything D-1/D-2 read stays a column.

### 3.3 Grading is polymorphic; `isCorrect` is not redefined

`QuestionAttempt` gains `response` (JSON) and `score` (Float, 0..1). **`isCorrect` keeps its exact
meaning** — `score === 1`. It is read in ~10 places across `lib/analytics`; redefining it to
"score > 0.5" would silently rewrite every mastery number in the app.

Partial credit exists only where each part is **independently answerable**:

| Format | Partial credit? | Why |
|---|---|---|
| `SHORT_TEXT` | ✅ per blank | each blank is its own question |
| `MATCHING` | ✅ per pair, **scored against `correctPairs`, not submissions** | otherwise a learner answers one pair and scores 1.0 |
| `MULTI_CHOICE` | ❌ all-or-nothing | per-option credit rewards ticking everything: 2-of-4 correct → ticking all 4 scores 0.5 while showing no knowledge |
| `ORDERING` | ❌ all-or-nothing | position-wise credit punishes one insertion at the front. Rank correlation would be fairer but is an untunable modelling call with zero learner data — revisit with D-1 |

## 4. Why hand-rolled validation, not zod

The repo has no zod, and `content-intelligence/contentValidation.ts` hand-rolls. Adding a dependency
to validate five small shapes is a larger commitment than writing them. Revisit if a sixth format
lands and the validators start repeating.

## 5. Why the validators matter more than they look

They are the gate between "an AI proposed a question" and "the bank accepted it". The failure mode
they exist to stop is **silent**, not loud:

- a `SHORT_TEXT` blank with an empty `acceptedAnswers` marks **every learner wrong, forever**
- a blank knowing only `"don't"` marks a learner typing `"do not"` wrong
- two correct pairs for one left item is not a hard question, it is an unanswerable one

None of these throw. Each produces a wrong **mastery signal**, which the Decision Engine consumes as
truth. There is no downstream check that would catch it. Hence: `acceptedAnswers` is a **list**;
normalization folds whitespace, case, and curly apostrophes (keyboard artifacts) but **never**
punctuation or spelling — the same reasoning `DECISION_LOG` already records for topic matching
(*"no fuzzy matching, no AI classification"*), because a near-miss is a judgement call and silently
accepting it hides a real learner error inside a "correct" signal.

## 6. What was built, and what deliberately was NOT

**Built (additive — nothing existing breaks):**

- `ResponseFormat` enum; `Question.responseFormat` (default `SINGLE_CHOICE`) + `Question.payload`
- `QuestionAttempt.response` + `QuestionAttempt.score`
- `lib/services/question-format/` — types, validators, graders, registry. **Pure: no Prisma**, same
  discipline as `lib/analytics` (repository fetches, pure engine decides)
- `prisma/backfill-question-payload.ts` — dry-run by default
- `scripts/test-question-formats.mjs` — repo-convention test script

**Not done, on purpose:**

- **The 29 files reading `optionA-D` are untouched.** Rewriting them all in one change, in a repo
  with no type-safe test net over them, is the riskiest available way to do this. They keep working
  because the legacy columns are still there and still written.
- **`QuestionAttempt.response` is not backfilled.** `V1_V2_RECONCILIATION.md` rules all 31 attempt
  rows are dev click-testing and get dropped — converting them is work spent on rows already
  scheduled for deletion.
- **No UI renders a non-MCQ question.** Storing and grading one works; showing one does not.

### The two-shape hazard, and how it is bounded

Two representations of the same answer can drift. This is handled by ordering, not hope:

1. `payload` is backfilled for **all** rows immediately → authoritative from that moment
2. `optionA-D` linger as legacy columns that writers still fill — **via `toLegacyColumns()`, never by
   hand**. One derivation, one place
3. `getQuestionPayload()` is the single accessor where a legacy row and a payload row stop looking
   different
4. columns are dropped once every reader is off `getQuestionPayload()`

`toLegacyColumns()` returns **null** for any non-MCQ format. That null is the honest answer, not a
gap: a MATCHING question genuinely has no A/B/C/D, and fabricating four columns for it would
recreate the exact lie §1 documents. It is also the forcing function — **the legacy readers must
migrate before non-MCQ content can ship to learners.**

## 7. Next

0. **`prisma/seed.ts` does not write `payload`** — a fresh `npm run db:seed` leaves it null on every
   seeded question. Nothing breaks: `getQuestionPayload()` falls back to the legacy columns, which is
   precisely the case the fallback exists for. But the backfill must be re-run after any reseed until
   `seed.ts` writes payloads itself. Cheap to fix; do it when `seed.ts` is next touched.
1. Migrate readers to `getQuestionPayload()`, highest-traffic first
   (`PracticeQuiz.tsx` 11 refs, `sessionAnalytics.ts` 10, `attempt/route.ts` 6)
2. Teach the AI normalizer/generator to emit non-MCQ payloads — currently every provider
   (`mockProvider`, `geminiProvider`, `claudeProvider`, `normalizationCore`) assumes A/B/C/D
3. UI per format in the Test Player (needs the FigJam design)
4. Drop `optionA-D`, `correctOption`, `selectedOption`
5. Reconsider `QuestionType` itself — with `responseFormat` carrying "how" and `knowledgeUnitId`
   carrying "what", `QuestionType` may have no remaining job. Not decided here.

Steps 2–3 are what mock tests actually need (`KU1_PARTB_DESIGN.md` §1.5). This document only
guarantees such a question can be **stored and graded correctly** — not authored or displayed.

## Step 1 + Test Player UI shipped (2026-07-15)

`PracticeQuiz.tsx` (11 of the original refs) and `app/api/questions/[id]/attempt/route.ts` are off
the legacy columns — both now go through `getQuestionPayload()` / `gradeResponse()`. All five formats
render and submit: `AnswerInput.tsx` dispatches to a per-format input (SINGLE_CHOICE keeps its
click-to-submit UX and inline correct/incorrect highlighting; the other four collect a full response
before an explicit submit, since they're multi-part answers).

**A new pure function this needed that QM-1 didn't yet have: `toPublicPayload()`.**
`getQuestionPayload()` returns the answer key — correct for the *grading* boundary, wrong for the
*rendering* one. Sending that same object to the client would put the correct answer in the page's
initial data, readable in devtools before the learner answers — exactly what the legacy `QuizQuestion`
type never did (it never included `correctOption` pre-submission). `toPublicPayload()` strips
`correctOptionId`/`correctOptionIds`/`acceptedAnswers`/`correctPairs`/`correctOrder` per format;
verified with a literal string-search test that the serialized public payload contains none of those
field names, not just that the typed accessor doesn't return them.

**`selectedOption` (the legacy per-attempt column) still gets written for every attempt**, not dropped
yet (step 4 above remains undone) — SINGLE_CHOICE writes the real option letter, unchanged; other
formats write a bracketed format tag (`[MATCHING]`, ...) rather than fabricating a letter or dumping
raw JSON into a column three analytics files still type as `string // A/B/C/D`
(`sessionAnalytics.ts`, `contracts.ts`, `repository.ts`). That analytics reform is real, separate,
undone work — flagged, not silently patched here.

**Not done:** step 2 (AI providers still only emit A/B/C/D) and the error-notebook link (still
SINGLE_CHOICE-only — `studentAnswer`/`correctAnswer` there assume an option letter).

Verified: `test:question-formats` 64/64 (10 new, `toPublicPayload` incl. the answer-key string-search
guard), `tsc --noEmit` clean, no regressions. **Live browser verification, not just unit tests**: all
five formats clicked through end-to-end (SHORT_TEXT correct, MATCHING deliberately wrong to prove
partial-credit + plain-text feedback, MULTI_CHOICE correct, ORDERING reordered via ↑/↓ then correct,
SINGLE_CHOICE re-verified for zero regression against a real curriculum session) — network responses
inspected directly (`isCorrect`/`score`/`detail` matched expectations exactly, not just "no visible
error"). Test fixtures created for this and deleted immediately after by exact `questionCode` match.
