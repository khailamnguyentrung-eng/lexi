# LEXI — v1 ↔ v2 Reconciliation

**Status:** **APPROVED — founder ruled every entity in §4 as written (2026-07-15).**
Written before any code, per PV-1 (`docs/PROJECT_STATUS.md` §PV-1).
**Purpose:** Put the running v1 model beside the FigJam v2 model and rule, per entity:
**migrate / drop / keep-parallel**.
**Scope:** the curriculum data model only. The **Decision Engine remains unspecified**
and is out of scope here — see §7.

PV-1 ruled *that* FigJam replaces v1. This document rules *what survives the replacement*.

---

## 1. Measured ground truth

Every number below was read from `prisma/dev.db` on 2026-07-15, not estimated.
Method: direct Prisma counts. Re-run before trusting these if time has passed.

| Table | Rows | Note |
|---|---|---|
| `CurriculumPhase` | 3 | Foundation / Core / Exam Prep |
| `CurriculumSession` | 24 | the shipped learner spine |
| `Question` | 122 | 118 carry `curriculumSessionId`, 4 do not |
| `Question` with `knowledgeUnitId` | **0** | see Finding A |
| `KnowledgeUnit` | 12 | seeded, curated (KU-1 part A) |
| `KnowledgeUnitOnSession` | **0** | see Finding B |
| `QuestionAttempt` | 31 | 22 carry `curriculumSessionId` |
| `UserSessionProgress` | 3 | |
| `User` | 2 | `student@lexi.local`, `admin@lexi.local` — see Finding C |
| `ErrorNotebookEntry` | 1 | |
| `SkillMatrixEntry` | 2 | |
| `Program`, `ProgramCurriculum` | **do not exist** | no model, no code, no rows |

Nullability, which decides most of §5:

- `Question.curriculumSessionId` — **nullable**
- `QuestionAttempt.curriculumSessionId` — **nullable**
- `UserSessionProgress.curriculumSessionId` — **required**

---

## 2. Three findings that change the questions as posed

The three decisions PV-1 recorded were written against assumptions that do not hold.
Each is restated in §5 after correction.

### Finding A — `Question.knowledgeUnitId` is empty, by design

Zero of 122 questions carry a `knowledgeUnitId`. This is not a bug and not the
"built ≠ reachable" pattern: it is a recorded decision
(`docs/DECISION_LOG.md` §"M3.2 — Coverage engine uses topic string matching, not FK").
Coverage is computed by `q.topic === unit.topic` string equality; the FK was added in
M3.1 and never backfilled. `autoAssignKnowledgeUnit()` is called only from the **import**
path (`lib/services/content-import/importer.ts:162`); `prisma/seed.ts` never calls it, and
all 122 questions are seeded.

**Consequence:** the option "keep only `knowledgeUnitId`" preserves **nothing**. That
column is empty. Choosing it without a backfill deletes the question bank's only
remaining organising link.

### Finding B — there is no session→KU mapping to migrate

`KnowledgeUnitOnSession` has **0 rows**. FigJam v2 composes
`Program → ProgramCurriculum → KnowledgeUnit`. To migrate the 24 sessions into
`ProgramCurriculum`, each entry must name its KnowledgeUnits. That join is empty.

**Consequence:** "migrate the 24 sessions" cannot be executed as a data migration. The
sequence and objectives can be carried over; the KU wiring must be **authored by a
curating authority**, not migrated. There is no source to migrate it from.

### Finding C — the "real learner data" is not real

Both users are `@lexi.local` local accounts. Of 31 attempts, **26 have
`timeSpentSec = null`** and the remaining 5 range from 3 to 17 seconds. 16 of 31 correct
— near a 4-option coin flip. The span is 2026-06-22 → 2026-07-13, matching the
development window.

**Consequence:** this is developer click-testing, not learner history. Q3 asks whether to
preserve real learning data. **There is none to preserve.** No learner has used LEXI.

### Taxonomy coverage — the real gate

122 questions span **74 distinct `topic` strings**. The 12 KUs cover 12 of them, matching
**49 of 122 questions (40%)**. The other **73 questions across 62 topic strings have no
KnowledgeUnit** and nothing to bind to.

---

## 3. The model, side by side

| v1 (running) | v2 (FigJam) | Relationship |
|---|---|---|
| `CurriculumPhase` (3) | — | absorbed into Program structure |
| `CurriculumSession` (24) | `Program` → `ProgramCurriculum` | spine replacement |
| `Question.curriculumSessionId` | `Question` → `Resource`, `Question` → `KnowledgeUnit` | **re-parented** |
| `KnowledgeUnit` (12) | `KnowledgeUnit` (core layer, "One only") | **identical — already v2** |
| `KnowledgeUnitOnSession` | `ProgramCurriculum` → `KnowledgeUnit` | same idea, new spine |
| `UserSessionProgress` | User Knowledge Map / Knowledge State | **not a rename** — different concept |
| `QuestionAttempt` | Learner Model input | **unchanged; v2 needs it** |
| — | `Resource`, `UserResource`, Pending KU | new, unbuilt |
| — | Decision Engine, `LearningAction` | new, **unspecified** |

The one structural rule v2 states that v1 breaks: **a Question belongs to a Resource and
maps to a KnowledgeUnit — it never belongs to a program or a session.**

---

## 4. Entity-by-entity ruling

| Entity | Ruling | Reason |
|---|---|---|
| `KnowledgeUnit` | **Keep as-is** | already the v2 core layer; no change needed |
| `Question` (rows) | **Keep all 122** | content is curation work; independent of spine |
| `Question.knowledgeUnitId` | **Backfill, then make it the primary link** | the v2-correct parent |
| `Question.curriculumSessionId` | **Drop — gated** (§6) | v2 forbids question→session |
| `QuestionAttempt` (rows) | **Keep table, drop the rows** | table is v2 Learner Model input; these 31 rows are dev noise (Finding C) |
| `QuestionAttempt.curriculumSessionId` | **Drop column** | nullable; no v2 meaning |
| `CurriculumSession` (24) | **Drop the model; re-author the sequence** | see §5 Q1 |
| `CurriculumPhase` (3) | **Drop model; keep the 3-phase idea as Program metadata** | pedagogy survives, table doesn't |
| `UserSessionProgress` | **Drop, table and rows** | required FK dies with the spine; concept ≠ Knowledge State |
| `KnowledgeUnitOnSession` | **Drop (empty)** | 0 rows; superseded by `ProgramCurriculum`→KU |
| `ErrorNotebookEntry` (1) | **Keep table, drop the row** | dev artifact |
| `SkillMatrixEntry` (2) | **Keep table, drop rows** | recomputed from attempts |
| `Program` / `ProgramCurriculum` | **Build new** | do not exist |
| `Resource` / `UserResource` / Pending KU | **Build new** (KU-1 part B) | do not exist |

**Nothing is ruled keep-parallel.** Running both spines would mean two sources of truth
for "what should the learner do next" — the exact ambiguity the Decision Engine exists to
own. With zero real learners (Finding C), parallel operation buys nothing and costs a
migration path forever.

---

## 5. The three founder decisions

### Q1 — 24 sessions → one Program, or rebuild?

**Recommendation: neither as posed. Carry over the curation; rebuild the structure.**

The 24 sessions hold two different things, and they deserve opposite rulings:

- **Pedagogical IP — keep.** The ordering, the 3-phase arc (Foundation → Core → Exam
  Prep), `title`, `objective`, `unitMapping` ("Global Success Unit 1"). This is curated
  authority work (Ch.1 §9), expensive to recreate, and correct.
- **Static scheduling — drop.** `timeBlocks`, `exercises`, `resources`. In v2 the
  **Decision Engine generates the next action**. A stored 105-minute time-block is v1
  answering a question v2 answers at runtime. Migrating it would hard-code the very thing
  the engine exists to decide.

So: create **one `Program` ("Thi vào 10")** whose `ProgramCurriculum` entries follow the
24-session order and inherit their objectives — but this is **authoring, not migration**
(Finding B: the KU join is empty). Budget it as curation work with the 24 sessions as the
reference document, not as a data-migration script.

### Q2 — 118 questions → map to `ProgramCurriculum`, or keep only `knowledgeUnitId`?

**Recommendation: `knowledgeUnitId` — but the option as posed is a trap, and it is gated.**

Both halves of the question need correcting:

- **Never map Question → `ProgramCurriculum`.** It re-creates v1's exact mistake under a
  new name. v2 states a Question maps to a KnowledgeUnit; binding it to a curriculum slot
  makes it unreusable across Programs and re-couples the bank to the spine. Reject.
- **"Keep only `knowledgeUnitId`" today preserves nothing** (Finding A) — that column is
  empty. It only becomes the right answer *after* a backfill.

The correct sequence is **backfill → grow taxonomy → then drop**, not drop-and-hope.
A backfill today binds **49 of 122**; the remaining **73 questions have no KU to bind to**.
Dropping `curriculumSessionId` before the taxonomy covers them orphans 73 questions —
reachable by nothing, in a system whose only other index was the column you just dropped.

**This makes KU-1 part B a blocker, not a nice-to-have.** The taxonomy must reach 122/122
coverage before `curriculumSessionId` is safe to drop.

### Q3 — real learner data (22 attempts, 3 progress) → keep or drop?

**Recommendation: drop it — and drop the premise.**

There is no real learner data (Finding C): two `@lexi.local` accounts, 26 of 31 attempts
with no recorded time, 3–17 second responses, coin-flip accuracy. This is your own
click-testing.

- `UserSessionProgress` (3) — **drop.** Its FK is required, so it cannot outlive
  `CurriculumSession` anyway. And it is not a Knowledge State: "session 4 complete, score
  0.7" is progress *through a fixed list*. v2's User Knowledge Map is mastery *per
  KnowledgeUnit*. There is no conversion; the information isn't in there.
- `QuestionAttempt` (31) — **keep the table, drop the rows.** The table is exactly what
  v2's Learner Model consumes, and it needs no change beyond dropping the session column
  (nullable — costless). But these 31 rows would seed the Learner Model with fabricated
  mastery from a developer clicking through. Preserving them is worse than useless: it
  poisons the first thing v2 computes.

**Preserve zero rows. Keep the table.** The moment a real learner exists, this table is
already correct.

---

## 6.5 The gate is closed (2026-07-15, live `dev.db` — not yet in seed data)

Using the KU-1 part B review queue (`docs/KU1_PARTB_DESIGN.md`) on the real 62 proposals Path B's
miss-handling had accumulated: **122/122 questions now carry a `knowledgeUnitId`. 0 unmapped.**
Registry grew from 12 → **71 KnowledgeUnits** (16 already resolved earlier in the session; **55
approved + 1 merge** — `modal_verbs_should` into `modal_verbs_advice`, the one pair confirmed via real
`correctOption` data to test the identical rule — resolved with the founder's explicit authorization
for this specific batch, since the review step is deliberately reserved for a human). 74 distinct
`Question.topic` strings, 71 KUs + 3 merged-away topics (the two `present_perfect_*` duplicates plus
`modal_verbs_should`) accounts for all 74.

**This is real, verified state — and it is NOT yet durable.** It lives only in the running `dev.db`.
`prisma/seed.ts` still seeds the original 12 `KnowledgeUnit` rows from `knowledge-units.json`; a fresh
`npm run db:seed` would revert the registry to 12 and every question to `knowledgeUnitId = null`.
Encoding the 71-unit registry into seed data (or another durable form) is real follow-up work, not
done here — recorded so it isn't mistaken for already being safe.

## 6. Sequencing, and the one gate

The gate: **`Question.curriculumSessionId` must not be dropped until every question has a
KnowledgeUnit.** Violating it orphans 73 questions.

1. **Grow the taxonomy to cover 74 topics** — extend `prisma/seed-data/knowledge-units.json`,
   or build KU-1 part B (Pending-KU review queue) and use it. Curation, not scripting.
2. **Backfill `Question.knowledgeUnitId`** from the now-complete taxonomy. Verify 122/122.
   Only now is Finding A closed.
3. **Build `Program` / `ProgramCurriculum`**; author "Thi vào 10" from the 24 sessions.
4. **Now drop** `curriculumSessionId` (both tables), `CurriculumSession`,
   `CurriculumPhase`, `UserSessionProgress`, `KnowledgeUnitOnSession`. 15 files change.
5. **Purge** the dev rows (31 attempts, 3 progress, 1 error entry, 2 skill matrix).

Steps 1–2 are prerequisites and do not depend on the Decision Engine. **Step 3 partially
does** — what `ProgramCurriculum` must store is shaped by what the engine reads from it.
Authoring the sequence is safe; finalising its schema is not.

---

## 7. What this document does NOT decide

**The Decision Engine remains unspecified**, and it is now the sole blocker on the
frontend. The FigJam review named two blockers; PV-1 cleared one, this document works the
other to a plan — but the engine's own open questions are untouched:

- the mastery model (state, confidence, decay)
- the policy turning signals into a next action
- what triggers a re-plan (per session / day / mood / missed day / deadline)
- where a plan is stored (`LearningPlan` / `LearningAction`) and how a learner override
  reconciles with an engine proposal

Do not build FigJam UI against this document alone. It gives you a data model; the engine
gives it behavior.

---

## Appendix — how to re-measure

The counts in §1 were produced with throwaway Prisma scripts run from the repo root
(module resolution requires the repo's `node_modules`). Nothing was added to the repo.
Re-derive rather than trust: per `docs/PROJECT_STATUS.md`, and the pattern recorded across
this project, a claim that something is wired is not evidence that it is.
