# Decision Engine — Gap Analysis and Options

**Status:** **RULED (2026-07-15) — but D-1 and D-2 were CORRECTED after the ruling. See the
correction notice below; those two need re-confirming.**
No code. Buildable only after KU-1 part B — see §10, which is a hard precondition, not a preference.
**Why now:** the last blocker. PV-1 cleared "is FigJam the product"; `V1_V2_RECONCILIATION.md`
ruled the data model. The FigJam review's second blocker — the Decision Engine — is this document.

---

> ## ⚠️ Correction (2026-07-15, after the founder ruled)
>
> **This document's first version was wrong about Knowledge State, and D-1/D-2 rested on that error.**
>
> It claimed Knowledge State was **missing**. It is not. `lib/services/learner-intelligence/` —
> **seven files, a whole Phase 5 layer** with its own design review
> (`PHASE5_LEARNER_MODEL_DESIGN_REVIEW.md`) — contains `computeKnowledgeState()`, already wired into
> `learnerProfileBuilder.ts`, plus a real mastery model in `lib/analytics/masteryTracking.ts`
> (`deriveMasteryState()`: a 5-rule ladder over MASTERED / STABLE / IMPROVING / NEEDS_REVIEW,
> grounded in spaced-repetition stage + post-review accuracy).
>
> The irony is not lost: this document opened by criticising other docs for saying "unspecified"
> when things existed, and then made the same error one layer down. **The lesson is the repo's own
> recurring one** (`lexi_backend_reality_gap`): grep for the caller, don't trust a summary — including
> this document's.
>
> **What changes:** D-1 and D-2 as originally recommended would have *replaced working, deliberately
> designed code*. Both are rewritten below and marked **needs re-confirmation**. D-3…D-6 are
> unaffected and stand as ruled.
>
> **What survives:** the real gap is narrower and sharper than "missing" — see §3.

---

## 1. Headline: it is *not* unspecified from zero

Every prior doc calls the Decision Engine "unspecified", which reads as *nothing exists*. That is
wrong, and it has been overstating the work. **Most of the Learner Model and the Next-Best-Action
policy are already built and running.** What is missing is narrower — and one missing piece is not a
build task at all, but an architectural conflict between FigJam and this repo's own Constitution
(§4, D-3).

| FigJam layer | Status | What actually exists |
|---|---|---|
| **Learner Model** | ✅ **built** | `studentLearningProfile.ts` (596 lines — "where is the student / what's improving / what needs attention / what's next"), `behaviorEngine.ts` (pace, time-of-day, response-time, mood, confidence tier), `LearnerProfile`, `DiagnosticTest`, `MoodEntry`, **and the whole `lib/services/learner-intelligence/` Phase 5 layer** (knowledge / behavior / preference / problem-solving / performance state + `learnerProfileBuilder`) |
| **Knowledge State** | ⚠️ **built, but weakness-shaped and topic-keyed** (corrected — was wrongly reported missing) | `learner-intelligence/knowledgeState.ts` → `computeKnowledgeState()`, wired into `learnerProfileBuilder.ts`; mastery ladder in `analytics/masteryTracking.ts`. **Two real gaps: it is keyed on the `topic` string, not `knowledgeUnitId`; and it can only see topics that have an error-notebook entry** — see §3 |
| **Next Best Action** | ⚠️ **partial** | `computeRecommendations()` with priority labels + LOW/MEDIUM/HIGH confidence |
| **LearningAction** | ⚠️ **partial** | `REVIEW_NOTEBOOK` ✅ · `PRACTICE_TOPIC` ✅ · `ADVANCE_SESSION` ☠️ (dies with v1) · **LEARN ❌** · **ASSESS ❌** |
| **Issuance / Evidence** | ✅ **built, and better than FigJam draws** | `RecommendationIssuance` (Basis, Goal snapshot, `asOf` freshness, Firmness, Rationale, procedure provenance) + `RecommendationResponse` + `ReviewEngagement` |
| **LearningPlan (stored)** | ❌ **and contested** | see D-3 — the repo's Ch.3 §3.1 says a Recommendation is *ephemeral, never durable*. FigJam wants it stored. **Direct conflict.** |
| **Re-plan trigger** | ❌ missing | nothing to re-plan yet |
| **Learner override** | ⚠️ partial | `RecommendationResponse` implements `ACCEPTED` only; `OVERRIDDEN`/`IGNORED` deliberately deferred pending a threshold only you can set |

**So the real question is not "design a Decision Engine."** It is five decisions (D-1…D-5) that turn
existing machinery into FigJam's engine.

---

## 2. The one hard constraint on every option below

**You have zero real learners.** (`V1_V2_RECONCILIATION.md` Finding C: both users are `@lexi.local`;
26 of 31 attempts have no recorded time; accuracy is a coin flip.)

This is not a footnote — **it eliminates a whole class of otherwise-correct answers.** Any model that
must be *calibrated from learner data* (BKT, IRT, Elo) cannot be fitted, tuned, or validated. Picking
one now means shipping untuned parameters and calling the output "mastery". Every recommendation
below is shaped by this.

---

## 3. D-1 — The mastery model **(CORRECTED — needs re-confirmation)**

### What actually exists

`analytics/masteryTracking.ts` already implements a mastery model, and a careful one:

```
deriveMasteryState(TopicNotebookSummary) → MASTERED | STABLE | IMPROVING | NEEDS_REVIEW
```

A 5-rule ladder using spaced-repetition **stage**, **post-review accuracy**, the notebook **signal**,
and the remedial flag — e.g. *MASTERED requires stage ≥ 4 + IMPROVED + postAccuracy ≥ 0.80 + not
remedial-flagged*, because "remedial topics must earn MASTERED entry-by-entry, not via accuracy
alone". Its header states the storage policy outright: **"Never stored; always re-derived on demand."**

`learner-intelligence/knowledgeState.ts` consumes it and buckets concepts into
`masteredConcepts` / `developingConcepts` / `weakConcepts`, with a `ConfidenceTier`
(OBSERVED / EMERGING / CONFIRMED) derived from data richness.

**My original recommendation — "replace this with accuracy + time decay" — was wrong.** It would
have thrown away a tuned, documented model in favour of something cruder, on the strength of a gap
that does not exist.

### The two real gaps (narrower and sharper than "missing")

**1. It is keyed on the `topic` string, not `knowledgeUnitId`.**
`V1_V2_RECONCILIATION.md` ruled `knowledgeUnitId` the primary link. So this is a **re-keying**, not a
rebuild — and it is gated on the same backfill as everything else (§10).

**2. It can only see topics that have an error-notebook entry — and this is the important one.**
`TopicMasteryProfile[]` is built from `getTopicNotebookSummaries()`, which enumerates topics from
`ErrorNotebookEntry` (created on mistakes, via `POST /api/error-notebook`). Attempts are read too,
but only to compute accuracy *within* topics the notebook already knows about.

**Consequence: a KnowledgeUnit the learner has never gotten wrong is invisible to the engine.** So is
one they have never attempted at all. The model has no state for *"we have no idea"* — and
"never attempted" is **exactly what LEARN must target** (D-4). Today the engine can rank the
learner's known weaknesses; it cannot say *"you have never touched conditionals type 3"*, because
that KU produces no row anywhere.

This is the honest reframe: **the Knowledge State is weakness-shaped.** It models what went wrong,
not what is known or unexplored. FigJam's "User Knowledge Map" needs all three.

### Revised recommendation **(needs your re-confirmation)**

| | Option | Assessment |
|---|---|---|
| **1** | **Keep `deriveMasteryState()`'s ladder; re-key to `knowledgeUnitId`; add an explicit `NOT_ATTEMPTED` / `UNKNOWN` state covering the KUs with no evidence** | **Recommended.** Far less work than a rebuild, keeps a tuned model, and closes the gap that actually blocks LEARN |
| **2** | Replace with accuracy + time decay | *my original — withdrawn.* Discards working, reviewed code to solve a problem it did not have |
| **3** | BKT / IRT / Elo | still **blocked by §2** — zero real learners, nothing to calibrate against |

Time decay is **deliberately not** in the revised recommendation. The existing ladder already gets
recency through the spaced-repetition stage, and adding a second decay term would mean two decay
models interacting with no learner data to tune either. If evidence later shows stale mastery
lingering, add it then — with a reason.

**The trap that still stands:** "mastery" must not mean different things in different places. Today
`SkillMatrixEntry.percentage`, `ErrorNotebookEntry.status = MASTERED`, and
`MasteryState.MASTERED` are three notions of mastery, and **none is per-KU**. Re-keying must
reconcile them, not add a fourth.

---

## 4. D-2 — Where does Knowledge State live? **(CORRECTED — needs re-confirmation)**

**Option B is already the implementation**, and deliberately so. `masteryTracking.ts` states it in
its own header: **"Never stored; always re-derived on demand."** `computeKnowledgeState()` is pure —
no Prisma — and returns a snapshot with a `computedAt` stamp.

My original recommendation (**A** — a new `UserKnowledgeState` table) would have **overturned a
deliberate design choice I had not read.**

| | Option | Assessment |
|---|---|---|
| **B** | **Computed on read, never stored** | **Recommended — it is what exists.** Consistent with D-3's ruling (which chose ephemeral-plus-issuance over durable state), and with Ch.3 §3.1 |
| **A** | `UserKnowledgeState` table | *my original — withdrawn.* Would add a mutable projection alongside a working pure one, i.e. a second source of truth |
| **C** | Stored + append-only snapshots | only if you must one day **prove** improvement to a parent or school. Not now |

**This makes D-2 and D-3 the same answer**, which is the coherence check passing rather than a
coincidence: the repo already decided, in two independent places, that derived learner state is
computed fresh and never stored. D-3 chose the issuance pattern for the *plan*; `masteryTracking`
chose re-derivation for the *state*. Ch.3 §3.1 / Invariant 12 stands unamended across both.

**The one thing to watch:** re-derivation on every read is affordable today because the notebook is
small. Per-KU state across a full taxonomy (74+ topics), read on every dashboard load, is a different
cost profile. That is a **performance** decision to revisit with real usage — not an architecture
decision to pre-empt now.

---

## 5. D-3 — LearningPlan: stored or ephemeral? ← **the real decision**

**This is the only place FigJam and this repo's architecture directly contradict each other, and it
cannot be resolved by building more.**

- **FigJam** draws `LearningPlan` / `LearningAction` as stored entities.
- **Ch.3 §3.1** (quoted in `schema.prisma`) says a Recommendation has *"no stored identity, computed
  fresh, ephemeral — never a durable record updated in place. What IS permanent is the fact of its
  issuance"* (Ch.1 Invariant 12).

| | Option | What it costs |
|---|---|---|
| **A** | **Stay ephemeral.** `LearningPlan` is a computed *view*, not a table | plan can change under the learner between reloads; "today's plan" is not stable |
| **B** | **Store it.** `LearningPlan`/`LearningAction` become durable rows | **requires amending Ch.3 §3.1 via an ADR** — you would be overturning a deliberate invariant |
| **C** | **Issuance pattern** — plan computed fresh; the *issuance* of it recorded; "current plan" = most recent issuance rows | none architecturally — **this pattern is already built and running** |

**Recommendation: C, strongly.**

`RecommendationIssuance` already does exactly this, and its schema comment already anticipates it:
*"'Current' is deliberately NOT a stored flag: it is the most recent row per userId… Supersession is
therefore implicit."* A LearningPlan is a *set* of issuances sharing a timestamp. You get FigJam's
stable, inspectable, overridable plan **and** Ch.3's ephemerality, with no amendment and no new
concept — because the hard part (Basis, Goal snapshot, `asOf`, Firmness, provenance) is already
written.

B is the option to pick only if you consciously want to overturn Invariant 12. It is a defensible
product call, but it is an **architecture change with an ADR**, not a feature — and per Constitution
M7 the repo history is architectural evidence, so it must be recorded as such.

---

## 6. D-4 — The action vocabulary, and the hole under LEARN

FigJam: `LEARN / PRACTICE / REVIEW / ASSESS`. Today: `REVIEW_NOTEBOOK`, `PRACTICE_TOPIC`,
`ADVANCE_SESSION`.

- `REVIEW` → `REVIEW_NOTEBOOK` ✅ maps.
- `PRACTICE` → `PRACTICE_TOPIC` ✅ maps (re-point topic → KU).
- `ADVANCE_SESSION` → ☠️ **delete.** It is `CurriculumSession`-coupled and dies with the v1 spine.
- `ASSESS` → partial: `DiagnosticTest` exists; MockTestTab is designed (`MOCKTESTTAB_DESIGN.md`).
- **`LEARN` → ❌ there is nothing to learn from.**

**LEARN is the hidden scope bomb, and it deserves a decision of its own.** v1's only teaching content
was `CurriculumSession.objective` / `timeBlocks` / `resources` — which the reconciliation doc rules
**dropped**. So after the migration, LEXI can tell a learner *"you're weak at present perfect"* and
give them *questions* — but has **no lesson to send them to.** FigJam answers this with the
**Resource** layer, which does not exist (`Question` has no `Resource` FK at all).

| | Option | Consequence |
|---|---|---|
| **1** | **Ship v2 without LEARN** — PRACTICE/REVIEW/ASSESS only | honest; but the product is a drill app, not a tutor. The Companion has nothing to teach |
| **2** | **Build the `Resource` layer** — lessons as first-class content | the FigJam-complete answer; real scope |
| **3** | **LEARN = AI-generated explanation on demand** — reuse the chat/Lens stack, which already exists and already records `AssistanceExchange` | cheapest real LEARN; quality depends on the AI provider (**note: your Gemini quota is dead — everything silently falls back to Mock**) |

**Recommendation: 3 now, 2 later.** The assistance stack (`AssistanceExchange`, chat modes including
`TEACHER`) is built, records Evidence properly, and is one honest step from being a LEARN action.
Option 1 quietly redefines the product. Option 2 is right but should not gate v2.

---

## 7. D-5 — Re-plan trigger

| | Option | Fit |
|---|---|---|
| **1** | On every read (stateless) | simplest; plan flickers |
| **2** | **On evidence change** (new attempt / review / mood) | matches `RecommendationIssuance.asOf`, which already exists as an *evidence-freshness proxy* |
| **3** | Scheduled (daily) + on-demand | needs a scheduler; **none exists** (see M4.5: no queue — un-awaited work on a serverless route can be frozen mid-run) |
| **4** | Explicit learner action only | learner-controlled; goes stale silently |

**Recommendation: 2.** The field is already in the schema for exactly this purpose. Note the FigJam
also lists *missed day* and *deadline approaching* as triggers — both are **time-based, not
evidence-based**, and therefore need 3, which needs infrastructure you do not have. Decide whether
those two triggers are required for v2 or deferred; that is a real fork, and I would defer them.

---

## 8. D-6 — Override reconciliation

`RecommendationResponse` implements `ACCEPTED` only. The schema says why, plainly: `OVERRIDDEN` and
`IGNORED` *"both require thresholds Ch.3 §3.5 deliberately leaves open (e.g. how long un-acted-upon
counts as 'ignored')"*.

**This is a founder decision, not an engineering one — it is a product judgement about your learner.**
Concretely: *after how long does an un-acted recommendation count as ignored?* One session? One day?
Next login? And when a learner overrides ("I want to practise X instead"), does the engine (a) defer
and re-plan around them, or (b) re-issue its original suggestion next time?

**Recommendation: `OVERRIDDEN` = learner picked a different action while one was current (unambiguous,
build it now); `IGNORED` = deferred until you have a real learner to observe.** Guessing the threshold
now would put a fabricated number into the Evidence layer, which is the one layer that must stay
truthful.

---

## 9. Rulings (founder, 2026-07-15 — all recommendations accepted as written)

| | Decision | **Ruled** | Consequence to hold onto |
|---|---|---|---|
| **D-1** ⚠️ | mastery model | ~~Accuracy + time decay~~ → **CORRECTED (§3): keep the existing `deriveMasteryState()` ladder, re-key `topic` → `knowledgeUnitId`, add an explicit `NOT_ATTEMPTED` state.** **Needs re-confirmation** | the original would have deleted a tuned, reviewed model. The real gap is that a never-failed KU is **invisible** — which is what blocks LEARN |
| **D-2** ⚠️ | where state lives | ~~`UserKnowledgeState` table~~ → **CORRECTED (§4): computed on read, never stored — which is already the implementation.** **Needs re-confirmation** | lands on the same answer as D-3. Re-derivation cost across a full taxonomy is a **performance** question for later, not an architecture one now |
| **D-3** | plan stored? | **Issuance pattern** — computed fresh, issuance recorded, "current" = most recent | **Ch.3 §3.1 / Invariant 12 stands unamended.** No ADR needed. If a stored plan is ever wanted, that is a deliberate architecture change |
| **D-4** | LEARN | **AI explanation on demand** now (reuse `AssistanceExchange` / `TEACHER` mode); **`Resource` layer later** | ⚠️ **depends on a working AI provider — the Gemini quota is dead and every call silently falls back to Mock.** LEARN quality is capped at Mock until that is resolved. Founder has declined to fix the quota; recorded, not re-proposed |
| **D-5** | re-plan | **On evidence change** (uses the existing `asOf` freshness proxy) | *missed day* and *deadline approaching* are **time-based** and therefore **deferred** — they need a scheduler that does not exist (M4.5: no queue) |
| **D-6** | override | **`OVERRIDDEN` now** (learner picked a different action while one was current); **`IGNORED` deferred** | the "how long counts as ignored" threshold stays open until a real learner can be observed. Guessing it would put a fabricated number in the Evidence layer |

**One consequence worth stating plainly:** D-1 + D-2 together mean "mastery" gets **one definition in
one place** for the first time. Today `SkillMatrixEntry.percentage` and `ErrorNotebookEntry.status =
MASTERED` are both called mastery, and neither is per-KU. Both must be reconciled against
`UserKnowledgeState` when it lands — otherwise this decision adds a third meaning instead of
replacing two.

---

## 10. Honest note on sequencing

D-1/D-2 depend on the reconciliation doc's steps 1–2 (taxonomy complete → `knowledgeUnitId`
backfilled 122/122). **Mastery is per-KnowledgeUnit, and today 0 of 122 questions have one** — so
Knowledge State has literally nothing to attach to until that backfill lands.

**You can decide D-1…D-6 now, but they cannot be built before KU-1 part B.** That ordering is not a
preference; it is the same gate the reconciliation doc identified, arriving from a second direction.
