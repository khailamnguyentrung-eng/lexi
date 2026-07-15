# KU-1 Part B — Source → Pending KnowledgeUnit → Review Queue

**Status:** **APPROVED (Path A) — founder ruling, 2026-07-15.** Ready to build. No code yet.
**Depends on:** `docs/V1_V2_RECONCILIATION.md` (which makes this a **blocker**, not a follow-up).
**Trigger:** founder's stated goal — *"đưa Cambridge IELTS Academic PDF, Lexi đọc và tạo được KU;
các sources khác cũng tương tự."*
**Revised 2026-07-15** after the founder asked whether Path A also delivers mock tests. It does not —
see §1.5, which reshapes the build order (§8) around a shared extraction stage.

---

## 1. What the founder asked for, restated precisely

> Feed in a source (Cambridge IELTS Academic PDF, and other sources alike) → Lexi reads it →
> Lexi proposes KnowledgeUnits → founder reviews/merges/renames → registry grows.

This is achievable, but **only if we separate two things the current pipeline fuses together.**
The distinction below is the whole design.

| | **Path A — Taxonomy extraction** | **Path B — Question extraction** |
|---|---|---|
| Input | any source | any source |
| Output | *candidate KnowledgeUnits* (topics/skills the source teaches) | `Question` rows |
| Needs `Question` to fit the format? | **No** | **Yes** |
| Works for Cambridge IELTS today? | **Yes, with work** | **No — structurally blocked (§3)** |
| Copyright exposure | low — a taxonomy is facts/ideas, not expression | high — verbatim reproduction of a copyrighted bank |
| Is it what the founder asked for? | **Yes** | not asked for |

**Ruling proposed: KU-1 part B is Path A only.** The existing import pipeline is Path B and stays
as-is for Vietnamese exam docs. Path A is a **new, parallel read of the same source** that produces
taxonomy, not items.

This is not a scope dodge — it is the ask, read literally. "Lexi đọc và tạo được KU" is Path A.
Path A also happens to be the only one that works for IELTS, and the only one that is safe to build a
product on.

---

## 1.5. Path A is *not* "the LEARN half" — and it does not deliver mock tests

Founder's question, 2026-07-15: *"đây mới chỉ là phần learn thôi đúng không? Vì sau này tôi muốn
trích xuất các tài liệu như một đề thi thật vào trong mock test để học sinh thi thử."*

**Correct — and the distinction is not learn-vs-test.** Path A produces *taxonomy*, and taxonomy
serves **everything**, mock tests included: when a learner fails item 7 of a mock paper, mapping that
failure to a KnowledgeUnit is what turns a score into a weakness signal. Without Path A, a mock test
is a dead-end number — which `MOCKTESTTAB_DESIGN.md` names as the whole differentiator
(*"every mock test result becomes a learning signal… not a dead-end score"*).

What Path A does **not** produce: the questions, the paper's structure, or its timing.
**So mock tests need Path B plus two things that do not exist:**

| Needed for "một đề thi thật" | Status |
|---|---|
| **Path B** — real `Question` rows from the paper | **blocked for IELTS** by the `Question` model (§3.1) |
| **`ExamTemplate` / Paper** — ordered, timed, format-faithful | **does not exist.** `lib/analytics/examBlueprint.ts` is a **hard-coded constant file for exactly one exam** (Hà Nội G10: 40 MCQ / 60 min), not a model. Its own header admits the section depths are *estimated and unverified against an official paper* |
| **`TestAttempt` / `AnswerRecord`** — an attempt at a *paper*, not a question | **does not exist.** `QuestionAttempt` is per-item, with no timing envelope and no grouping |

`MOCKTESTTAB_DESIGN.md` §5 already names these (`Source`, `ExamTemplate`, `UserUpload`,
`TestAttempt`, `AnswerRecord`, `SkillSignal`). **None are built.**

### The consequence that changes prior guidance

**The `Question` model reform (§3) moves onto the critical path.** This document previously filed it
as "not needed for KU-1 part B" — still true, but it now has a funded destination: the founder's mock
test goal *requires* storing real IELTS items, and today most cannot be stored. It is no longer
hypothetical work to note in passing; it is scheduled work with a trigger.

### The optimisation this forces — extract once, fan out

Path A and Path B **read the same file**. If a Cambridge PDF is fed in for taxonomy now and again
for mock tests later, the expensive step (text extraction + chunking + AI reading) is paid twice, on
a ~150-page book, against a provider whose Gemini quota is dead and silently falls back to Mock.

**So the extraction stage must be shared from day one**, even though only Path A ships first:

```
ContentSource
   └─ SourceRead            ← extract text + chunk ONCE, cache rawText + chunks
        ├─ Path A  → PendingKnowledgeUnit   (taxonomy)      ← KU-1 part B, building now
        ├─ Path B  → ExtractedQuestionDraft (items)         ← exists; needs Question reform for IELTS
        └─ Path C  → ExamTemplate           (paper shape)   ← mock test, later
```

This costs almost nothing now: `ImportJob` already holds `rawExtractedText`, so `TaxonomyJob` (§4.2)
must **not** duplicate that field — both should hang off one cached read of the source. The design
below is revised accordingly: **`TaxonomyJob.rawExtractedText` is dropped in favour of a shared
`SourceRead`.**

That single change is what keeps Path A from becoming throwaway work.

---

## 2. Why the current pipeline cannot do this

Today `autoAssignKnowledgeUnit()` (`lib/services/content-intelligence/questionKnowledgeMapping.ts:111`)
is the *only* thing that ever connects a source to the KU registry:

```
findUnique({ where: { topic } })  →  if (!unit) return false;
```

**A topic with no KnowledgeUnit is silently discarded.** That single `return false` is the whole
gap. The taxonomy cannot grow from a source; it only grows by hand-editing
`prisma/seed-data/knowledge-units.json` and re-running `npm run db:seed`.

Note also the ordering constraint: `autoAssignKnowledgeUnit` runs at **draft approval**, deep inside
Path B. So today, KU creation is downstream of Question extraction — which is exactly why the IELTS
ask fails: it inherits every one of Path B's format constraints for no reason.

**Path A inverts this: read the source for taxonomy first, independent of whether we ever extract a
single question from it.**

---

## 3. What blocks Path B for IELTS (recorded so it is never re-litigated)

Not needed for KU-1 part B, but this is *why* Path A is the only option, and these are real:

1. **`Question` is structurally a 4-option MCQ.** `optionA/B/C/D` + `correctOption` are all
   **required**. IELTS Academic is mostly not that: True/False/Not Given (3), gap-fill (free text),
   matching headings (N), summary completion, short answer. **Most IELTS items cannot be stored.**
2. **`SkillCategory` is a closed enum hard-coded to Thi vào 10** — `PHONETICS_STRESS`,
   `VOCAB_GRAMMAR`, `COMMUNICATION`, `READING`, `WRITING_TRANSFORMATION`. **No LISTENING, no
   SPEAKING, no WRITING (essay).** Half of IELTS has nowhere to go.
3. **`QuestionType` is likewise closed and Vietnamese-exam-shaped.** No `MATCHING_HEADINGS`,
   `TRUE_FALSE_NOT_GIVEN`, etc.
4. **`Difficulty` is EASY/MEDIUM/HARD**; IELTS is banded 1–9. `KnowledgeUnit.targetEasyCount/
   targetMediumCount/targetHardCount` bakes the 3-band model into the registry itself.
5. **The chunker is Vietnamese-only.** `chunker.ts` matches `/^PHẦN\s*\d+\s*[–-]\s*ĐỀ TEST/` and by
   its own design *"falls back to a single chunk covering the whole document"* — so a ~150-page
   Cambridge book goes to the AI **in one call**. (Related: the chunker is already not wired into
   the real import path at all — see `lexi_backend_reality_gap`.)
6. **Scanned PDFs return empty text** — `pdf-parse` has no OCR fallback. IMAGE files do have
   Tesseract. Many Cambridge scans are image-PDFs.
7. **`Question` has no `Resource` FK.** FigJam says a Question *belongs to a Resource*; today
   `Question.source` is free text and there is no link to `ContentSource`.

None of the above blocks Path A, because Path A never creates a `Question`.

---

## 4. Proposed model

### 4.1 `PendingKnowledgeUnit` (new)

A **proposal**, not a KnowledgeUnit. Deliberately a separate table, not a `status` flag on
`KnowledgeUnit` — because `KnowledgeUnit.topic` is `@unique` and is the registry's canonical
namespace ("Knowledge Library — One only"). Letting unreviewed AI guesses occupy that namespace
would let a hallucinated topic silently win the unique constraint against a real one.

```
PendingKnowledgeUnit
  id
  contentSourceId   → ContentSource   // provenance: which source proposed it
  taxonomyJobId     → TaxonomyJob
  proposedTopic     String            // canonicalTopic()-normalized, NOT unique
  proposedLabel     String            // human-readable (Vietnamese for VN exams, EN for IELTS)
  evidenceQuote     String            // the source span that justified it — grounds review
  evidenceLocation  String?           // e.g. "Test 2 / Reading Passage 1"
  aiConfidence      Float
  reviewStatus      PendingKUStatus   @default(PENDING_REVIEW)
  reviewedByUserId  String?
  reviewNote        String?
  resolvedUnitId    String?           // → KnowledgeUnit, set on APPROVE or MERGE
  createdAt / updatedAt
```

```
enum PendingKUStatus { PENDING_REVIEW  APPROVED  MERGED  RENAMED  REJECTED }
```

**`evidenceQuote` is the load-bearing field.** Reviewing "is `matching_headings` a real KU?" without
seeing what in the book caused it is guesswork. This mirrors the discipline already in
`RecommendationIssuance` (Basis provenance) and `ReviewEngagement` (snapshot at the time).

### 4.2 `SourceRead` (new) — the shared extraction stage

Per §1.5: one cached read of a source, consumed by Path A, Path B, and later Path C. This is the
"tối ưu quy trình" requirement made structural — without it, every path re-reads the file.

```
SourceRead
  id
  contentSourceId  → ContentSource
  status           SourceReadStatus  // PENDING | READING | READ | FAILED
  rawExtractedText String?           // the single cached extraction
  chunks           String?           // JSON DocumentChunk[] — chunker output, cached
  chunkCount       Int?
  errorMessage     String?
  createdAt

  taxonomyJobs     TaxonomyJob[]
```

`ImportJob.rawExtractedText` should eventually read from here too. **Not a migration for now** —
Path B keeps its own field until Path B is next touched, so KU-1 part B stays additive and does not
destabilise a working import path. Recorded so it is not forgotten.

### 4.3 `TaxonomyJob` (new)

Path A's job record. Separate from `ImportJob` because a source can be read for taxonomy without ever
being imported for questions — fusing them is the mistake §2 diagnoses. **It holds no extracted text**
of its own; that lives on `SourceRead` (§4.2).

```
TaxonomyJob
  id
  sourceReadId  → SourceRead        // NOT its own rawExtractedText
  status        TaxonomyJobStatus   // PENDING | PROPOSING | PROPOSED | RESOLVED | FAILED
  errorMessage  String?
  proposals     PendingKnowledgeUnit[]
```

### 4.4 What does NOT change

- `KnowledgeUnit` — unchanged. Still the canonical registry, still `topic @unique`.
- `Question`, `ExtractedQuestionDraft`, `ImportJob` — untouched. Path B keeps working.
- `autoAssignKnowledgeUnit()` — one change only, in §6.

---

## 5. The review queue (the human step)

Four actions per proposal — this is the "review/merge/rename" the founder described:

| Action | Effect |
|---|---|
| **Approve** | create `KnowledgeUnit{topic: proposedTopic}`; set `resolvedUnitId` |
| **Merge** | pick an existing KU; `resolvedUnitId` = it; no new row. *This is the important one* — it is how `present_perfect_for_since` and `present_perfect_since_for` (both real, both in your bank) stop being two units |
| **Rename** | edit topic/label, then approve — AI proposals will not be canonically named |
| **Reject** | not a KU (e.g. AI proposed "test instructions") |

**Merge is why this table exists.** Your current 122 questions already span **74 distinct topics**,
many of which are the same concept under different strings. An unreviewed auto-create would turn a
Cambridge book into ~100 more of those. The queue is the curating authority (Ch.1 §9), and the
registry is what it protects.

---

## 6. The one line that changes in the existing pipeline

`autoAssignKnowledgeUnit()` today:

```
const unit = await prisma.knowledgeUnit.findUnique({ where: { topic } });
if (!unit) return false;            // ← the gap: unknown topic vanishes
```

Proposed: on miss, **record a `PendingKnowledgeUnit` instead of discarding**, and still return
`false` (the caller's contract — non-throwing, non-critical — is unchanged; see
`DECISION_LOG` §"M3.3 — Auto-assign is non-throwing"). Path B then *feeds* the queue instead of
silently dropping. This is additive and safe.

---

## 7. Open decisions (founder)

**B-1. Does Path A extract taxonomy from the source, or propose it from a chunk summary?**
- *(a)* Read every chunk, propose KUs per chunk, dedupe. Thorough, expensive, N AI calls.
- *(b)* Summarize the source's structure (contents/headings) and propose from that. Cheap; a
  Cambridge book's own contents page literally lists its task types.
- **Recommendation: (b) first.** For IELTS the book *tells you* its taxonomy. Escalate to (a) only
  for sources without usable structure.

**B-2. Should the chunker be generalized now?** Its regex is Vietnamese-only (§3.5). Path A under
*(b)* mostly sidesteps it. Under *(a)* it is required.
- **Recommendation: defer.** Tied to B-1(b).

**B-3. Is the KU namespace shared across exams?** FigJam says "One only". So IELTS `present_perfect`
and Thi vào 10 `present_perfect` are **the same KU** — and `matching_headings` is an IELTS-only KU
that simply has no Thi vào 10 questions.
- **Recommendation: yes, one namespace.** It is FigJam's ruling and it is what `topic @unique`
  already enforces. But note the consequence: **`KnowledgeUnit.targetEasyCount/Medium/Hard` becomes
  wrong** the moment a KU is shared across exams with different difficulty models (§3.4). Coverage
  targets are per-exam, not per-KU. This needs resolving before IELTS KUs land — flagging, not
  deciding, here.

**B-4. Scanned Cambridge PDFs.** Needs a PDF→image step to reach the existing Tesseract path.
Real dependency, real cost.
- **Recommendation: test with a digital-text Cambridge PDF first**, and only build OCR if your
  actual files need it. Do not build it on speculation.

**B-5. Copyright — flagging once, factually.** Deriving a *taxonomy* from a book (Path A) is
low-risk: task types and grammar topics are facts, not Cambridge's expression. Extracting its
*question bank* into a product (Path B) is republication of copyrighted content and is a real
commercial exposure. This design keeps you on the safe side, and that is a side benefit of Path A,
not its justification.

---

## 8. Build order (approved — Path A)

1. `SourceRead` + `TaxonomyJob` + `PendingKnowledgeUnit` schema + migration (§4)
2. Path A reader under B-1(b) — source → proposals, with `evidenceQuote`, reading from `SourceRead`
3. Admin review queue (approve / **merge** / rename / reject)
4. `autoAssignKnowledgeUnit()` miss → propose (§6)
5. **Run it against the existing 74 topics and merge them down.** The real first test
6. Backfill `Question.knowledgeUnitId` → verify **122/122**
7. Only then: a Cambridge IELTS source (§7 B-4 — test a digital-text PDF before building OCR)

**Step 5 matters more than step 7**, and step 6 is why. Together they close the gate that
`V1_V2_RECONCILIATION.md` §6 identified — taxonomy must cover all 74 topics and the backfill must
verify 122/122 before `curriculumSessionId` can be dropped — using the tool built in 1–4 instead of
hand-editing JSON. Steps 5–6 also unblock the Decision Engine, whose Knowledge State is per-KU and
today has **0 of 122** questions to attach to (`DECISION_ENGINE_OPTIONS.md` §10).

So this build order serves three goals at once: the founder's IELTS ask, the v1→v2 migration gate,
and the Decision Engine's precondition. That convergence is why it is sequenced this way.

### Not in this build, but now scheduled (§1.5)

- **`Question` model reform** — required before mock tests can hold real IELTS papers
- **`ExamTemplate` / `TestAttempt` / `AnswerRecord`** — `MOCKTESTTAB_DESIGN.md` §5 names them; none exist
- **Path C** — paper-structure extraction, hanging off the same `SourceRead`
