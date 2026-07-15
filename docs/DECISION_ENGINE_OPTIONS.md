# Decision Engine — Gap Analysis and Options

**Status:** **RULED — founder accepted every recommendation D-1…D-6 as written (2026-07-15).**
No code. Buildable only after KU-1 part B — see §10, which is a hard precondition, not a preference.
**Why now:** the last blocker. PV-1 cleared "is FigJam the product"; `V1_V2_RECONCILIATION.md`
ruled the data model. The FigJam review's second blocker — the Decision Engine — is this document.

---

## 1. Headline: it is *not* unspecified from zero

Every prior doc calls the Decision Engine "unspecified", which reads as *nothing exists*. That is
wrong, and it has been overstating the work. **Most of the Learner Model and the Next-Best-Action
policy are already built and running.** What is missing is narrower — and one missing piece is not a
build task at all, but an architectural conflict between FigJam and this repo's own Constitution
(§4, D-3).

| FigJam layer | Status | What actually exists |
|---|---|---|
| **Learner Model** | ✅ **built** | `studentLearningProfile.ts` (596 lines — "where is the student / what's improving / what needs attention / what's next"), `behaviorEngine.ts` (pace, time-of-day, response-time, mood, confidence tier), `LearnerProfile`, `DiagnosticTest`, `MoodEntry` |
| **Knowledge State** | ❌ **missing** | closest are `SkillMatrixEntry` (5 coarse buckets, **not per-KU**) and `ErrorNotebookEntry` (SM-2 fields, per *mistake*, **not per-KU**) |
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

## 3. D-1 — The mastery model: what *is* "knows this KnowledgeUnit"?

The FigJam asks for state + confidence + decay. Options:

| | **Model** | **Decay?** | **Needs calibration?** | **Explainable to a 15-year-old?** |
|---|---|---|---|---|
| **1** | **Accuracy ratio** — correct/total per KU | ✗ | ✗ | ✓✓ "8/10 đúng" |
| **2** | **Accuracy + time decay** — recency-weighted | ✓ | ✗ (one half-life constant) | ✓ |
| **3** | **SM-2 per KU** — reuse the notebook's scheduler | ✓✓ | ✗ | ✓ |
| **4** | **BKT** — p(mastery), models guess/slip | ✓ | **✓✓ blocked (§2)** | ✗ |
| **5** | **Elo / IRT** — co-estimates item difficulty + ability | ~ | **✓✓ blocked (§2)** | ✗ |

**Recommendation: 2, structured so 4/5 can replace it later.**

Reasoning: 1 is wrong in a way you will feel immediately — "3/3 correct last March" would read as
mastered forever, and your product's entire premise is a deadline-driven exam. 4 and 5 are the
academically right answers and are **unavailable** (§2) — they need learner data you do not have, and
shipping them untuned is worse than shipping something honest and simple. 3 is real but is a
*review scheduler*, not a mastery estimate; it answers "when should they see this again", which is
D-4's REVIEW action, not "do they know it".

2 gives you decay with exactly one tunable constant (half-life), stays explainable, and — critically
— the repo already has the provenance field to mark it as provisional: `SkillMatrixEntry.computedBy`
uses `ComputeSource { MANUAL, RULE_BASED, AI }`. A `RULE_BASED` mastery is honest about what it is
and can be swapped to `AI` later without a schema change or a lie in the UI.

**The trap to avoid:** do not let "mastery" mean two different things in two places. Today
`SkillMatrixEntry.percentage` and `ErrorNotebookEntry.status = MASTERED` are both called mastery and
neither is per-KU. Whatever you pick, **one definition, one place.**

---

## 4. D-2 — Where does Knowledge State live?

| | Option | Cost | Consequence |
|---|---|---|---|
| **A** | **`UserKnowledgeState` table** (user × KU), mutable projection, recomputed on evidence change | new table | matches FigJam's "User Knowledge Map" literally; fast reads; **no history** |
| **B** | **Computed on read, never stored** | none | conforms hardest to Ch.3 ephemerality; expensive per read; cannot show a trend line |
| **C** | **Stored + append-only snapshots** | new table + growth | full mastery history ("you improved") ; heaviest |

**Recommendation: A.**

Precedent is already in the repo and explicit: `ErrorNotebookEntry.reviewStage/nextReviewAt/
easeFactor` is described in the schema as *"a mutable Understanding-layer retention projection —
that projection is not Evidence"*. A per-KU mastery projection is the same category of thing, so A
needs no architectural argument — it reuses a distinction the Constitution already draws.

B loses the trend line, and "what is improving?" is a question `studentLearningProfile` already
promises to answer. C is right if you later want to *prove* improvement to a parent or a school —
worth revisiting then, not now.

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
| **D-1** | mastery model | **Accuracy + time decay**, marked `RULE_BASED` | one half-life constant to tune. **Swappable to BKT/IRT once real learners exist** — that is the point of `computedBy`, not a hedge |
| **D-2** | where state lives | **`UserKnowledgeState`** (user × KU), mutable projection | no mastery *history*. Revisit (option C) if you ever need to *prove* improvement to a parent or school |
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
