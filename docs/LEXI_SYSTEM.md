# LEXI System

> This document is the technical and intelligence source of truth for LEXI. It defines how
> LEXI is built, how it reasons about learning, and how it makes decisions — independent of any
> specific database, framework, or AI provider.
>
> **Owner:** AI Engineer
> **Update frequency:** Frequent — this document grows with the system. Individual chapters may
> be frozen independently once stable; the document as a whole is a living reference.
> **Constraint:** Every chapter here must remain consistent with `LEXI_FOUNDATION.md`. Where a
> design decision here would require bending a Constitution principle, the principle wins —
> raise it as an amendment proposal, don't quietly work around it here.
>
> **Editorial conventions (document-wide, not normative — a writing discipline, established after
> the Ch.2 baseline review):**
> 1. *Contract before algorithm.* Each chapter defines its output artifact — the stable interface
>    — before the computation that produces it, so the computation can change without breaking the
>    interface. (Ch.1 → ontology objects; Ch.2 → the Understanding contract, then the Engine;
>    Ch.3 → the Recommendation contract, then the Policy.)
> 2. *One new artifact per chapter.* A chapter introduces exactly one new artifact into the
>    dataflow `Evidence → Understanding → Recommendation → …`. A chapter that begins minting
>    several new artifacts is an early sign the layer boundary has blurred.

---

# Chapter 1 — Learning Domain Model

**Status: FROZEN.** Survived an Architecture Review Board pass across seven domains
(Mathematics, Programming, Biology, Music, Chess, Driving, Medicine), a full lifecycle
simulation across five real learner journeys, and a two-directional minimality test. Future
changes must go through the same amendment discipline as `LEXI_FOUNDATION.md` — no silent
edits.

## 0. What this chapter is, and isn't

This chapter defines the **ontology of learning inside LEXI** — the entities, relationships,
and invariants that would be true even if we rewrote the entire codebase from scratch tomorrow.
It answers "what exists, in the world, when a person learns something," not "what tables do we
need."

**Explicitly out of scope for this chapter:**
- *How* Understanding is computed from Evidence, and *how* Evaluator reliability is computed
  (both belong to the Learning Engine chapter).
- *How* a Recommendation is chosen (Decision Policy chapter).
- Storage, indexing, APIs, services, caching.
- The Companion, screens, and interaction design (`LEXI_EXPERIENCE.md` — deferred, not yet
  written; see `BASELINE_ARCHITECTURE.md` §7) — a companion is a way
  of *presenting* Recommendations and Explanations, not a new kind of thing that exists in the
  learning world.
- Institutional/multi-learner authority (a teacher assigning work to a class). Deliberately
  deferred — see Section 11, Open Tensions. Five full journey simulations, none of which
  required a second learner's authority over a first learner's goal, confirm this can stay
  deferred without weakening the current model.

## 1. Design Stance — assumptions rejected before modeling anything

1. **"A curriculum is a tree you walk through."** Rejected. A curriculum is a *weighted,
   ordered view* over a knowledge graph that already exists independently.
2. **"Content teaches a subject."** Rejected. Content is disposable instrumentation. The
   subject is the concept graph, which outlives any specific piece of content used to teach or
   test it.
3. **"Mastery is a score."** Rejected. A bare number asserted without a sense of how much
   evidence backs it is a guess dressed as a fact — direct conflict with Constitution 5.2 and
   5.10.
4. **"One learner follows one linear course."** Rejected. A learner's understanding of a
   concept is theirs regardless of which goal or pathway brought them to it.

## 2. Entity Taxonomy — four kinds of thing, not one flat list

The entities below are not peers of the same kind. Presenting them as an undifferentiated list
invites treating a relationship as if it were a node, which is a real category error worth
guarding against explicitly.

- **Nodes** — durable, independently-existing identities: Learner, Concept, Source, Content
  Item, Pathway, Goal, Learning Activity, Evaluator.
- **Facts** — immutable, high-volume, weakly-identified records of what happened: Evidence.
- **Relationships-with-properties** — edges between two Nodes that carry their own state and
  confidence, not bare foreign keys: Concept Relationship, Concept Attribution. Both describe a
  claim *about the connection between two things* (this concept requires that one; this content
  teaches that concept) — the claim itself can be proposed, wrong, or revised, independent of
  either endpoint's own state. That is why they are not folded into whichever Node they
  originate from.
- **Projections** — computed values with a defined shape but no stored identity of their own:
  Understanding, Recommendation. Neither is "an entity" in the sense a Node is — neither has a
  row that gets updated in place — but both need a name and a binding definition, because
  Constitution 5.2/5.10 (Understanding) and 5.4 (Recommendation) make explicit promises about
  them that need a stated referent.

## 3. Core Entities

### 3.1 Nodes

**Learner.** The person. Singular, continuous, never fragmented — by subject, device, or which
goal they're currently pursuing.

**Concept.** A discrete, independently masterable unit of demonstrable capability — not a piece
of content, a question, or a chapter. "Passive voice," "inference reading," "checking mirrors
before a lane change," "differential diagnosis" are all Concepts. A Concept can be true or false
in a specific learner's head, separate from any specific material used to teach or test it.

*Nature is a property, not a separate type*: declarative (a fact), procedural (a skill),
strategic (an approach), or **habitual/automatized** (a behavior performed without deliberate
reasoning, built through repetition — added specifically because Driving is almost entirely
this, and the original three natures were quietly biased toward cognitive/classroom domains).

*What used to be "Domain" is folded in here*: a Domain (English, Mathematics, Chess) is simply
a Concept with no parent via the `Composes` relationship — the root of a hierarchy, not a
different kind of thing. Domain granularity is a curatorial choice exactly like Concept
granularity is; treating them as separate entities was solving the same problem twice.

**Source.** A body of material with provenance and authority — a textbook, a past exam paper, a
case script for a simulated patient, a learner's own upload. Where "verified" gets its meaning
for Constitution 5.3 and 5.8.

**Content Item.** Either a **Practice Item** (a stimulus designed to elicit evidence of
understanding) or an **Explanation** (material whose purpose is to change understanding, not
test it) — different in intent, same shape, same lifecycle. Disposable relative to the Concept
it serves.

**Pathway.** A purposeful, weighted, ordered selection of Concepts toward a Goal. *References*
Concepts; never owns or defines them.

**Goal.** A specific aim belonging to exactly one Learner. Selects which Pathway(s) are relevant
and supplies the time constraint.

**Learning Activity.** A bounded, real occurrence of a learner engaging with something. *May*
reference a Content Item (the common case: Math, Programming, Biology, grammar) or *may* be a
standalone, unrepeatable real-world episode with no predefined item at all (a driving lesson, a
live chess game, a music performance, a clinical rotation). May have more than one Learner
participant (a chess game, a duet, a group lab). Added specifically because the original model
assumed all Evidence originates from attempting a predefined, reusable Content Item — false for
every embodied, real-world domain tested.

**Evaluator.** A persistent identity for whoever or whatever judged a piece of Evidence — a
specific instructor, a specific attending physician, an automated exact-match grader, an AI
scoring model at a specific version, or the learner's own self-report as a standing generic
Evaluator. Exists as its own Node, not a string tag on Evidence, because the same evaluator
judges many Evidence records over time, and without a stable identity to attach to, the system
can never learn that a specific evaluator runs strict or lenient — exactly the same reasoning
that requires Concept to have durable identity rather than being a re-typed label.

### 3.2 Facts

**Evidence.** An atomic, immutable record of something that happened — an attempt at a Content
Item, a self-report, an interaction, an observed behavior during a Learning Activity, the
issuance of a Recommendation. Evidence is never edited or deleted, only ever reinterpreted by
something computed from it. Its envelope (who, when, what happened, which Learning Activity it
originated from, which Evaluator judged it) is fixed; its payload is open and domain-specific —
a right/wrong flag, a compiler's pass/fail, a multi-dimensional performance rubric, a rating
change. Self-reported Evidence (a learner's own sense of how well they did) is a distinct kind
of Evidence from observed Evidence, and neither is automatically the same as Understanding.

### 3.3 Relationships-with-properties

**Concept Relationship.** Concepts relate to each other; the graph is not a tree. Four kinds,
different in kind, not degree: **Requires** (hard prerequisite, directional), **Composes**
(part-whole — this is also what makes a Domain just "a Concept with no parent"), **Resembles**
(commonly confused, deliberately useful for interleaving), **Transfers-to** (soft, probabilistic
— mastering A makes B easier without strictly requiring it).

**Concept Attribution.** The assertion that a specific Content Item *or* Learning Activity
teaches or tests a specific Concept — generalized beyond Content Item alone, because a real
driving lesson or an open-source contribution can be attributed to concepts just as validly as
an authored quiz question can, often *after the fact* rather than declared in advance. This is
its own claim, with its own confidence and its own proposed/confirmed/rejected lifecycle,
because the claim can be wrong independent of whether the thing it points to is fine.

### 3.4 Projections

**Understanding.** A derived, probabilistic belief about a Learner's capability, always computed
from Evidence, always confidence-qualified, never itself a stored fact. Not a single flat
mapping — a *family* of projections at different grains:
- **(Learner × Concept)** — for componentized, decomposable knowledge (a grammar rule, a
  biology fact, an isolated technique).
- **(Learner × Activity-type)** — for holistic capability that resists decomposition (chess
  playing strength, driving competence, system-design ability), computed from Learning Activity
  outcomes rather than item-level correctness. Added because "sum of concept masteries" cannot
  represent judgment under novel conditions, which several domains are almost entirely made of.

None of these grains is more "real" than another — they are different lenses over the same
Evidence log.

**Recommendation.** A specific suggestion issued to a Learner at a moment in time, generated
fresh from current Understanding, the active Goal, and available Pathway/Content. Ephemeral —
it does not persist as a standing instruction. Its **issuance is itself logged as Evidence**,
not only the learner's eventual response to it (accepted, overridden, ignored, which becomes
its own Evidence) — without this, the system has no memory of what it already suggested and
cannot reason about repetition or fatigue.

## 4. Relationships (the shape of the graph)

```
Concept *───* Concept              (Concept Relationship: Requires / Composes / Resembles /
                                     Transfers-to — Composes also builds the "Domain" hierarchy)
Concept *───* Source                          (via Concept Attribution)
Concept *───* Content Item                     (via Concept Attribution)
Concept *───* Learning Activity                (via Concept Attribution — open-world episodes
                                                 attributed to concepts, often after the fact)
Source  1───* Content Item
Pathway *───* Concept                          (weighted, ordered reference — never ownership)
Learner 1───* Goal
Goal    *───* Pathway
Learner 1───* Learning Activity                (may have more than one Learner participant)
Learning Activity 1───* Evidence               (every Evidence record originates from exactly
                                                 one Learning Activity; a Content Item is
                                                 optional, a Learning Activity is not)
Evidence *──→ Evaluator                        (who/what judged this fact)
Evidence *──→ Understanding                    (computed FROM Evidence, never the reverse)
(Learner × Concept) 1───1 Understanding
(Learner × Activity-type) 1───1 Understanding
Learner 1───* Recommendation                   (issuance and response both become Evidence)
```

Durability gradient, load-bearing for how each entity should be designed later: **Concept,
Concept Relationship, Source, Pathway, Evaluator** are curated and durable. **Evidence** is
high-volume and immutable. **Content Item and Learning Activity** are disposable relative to the
Concepts they serve. **Understanding and Recommendation** are computed and disposable by
definition.

## 5. Events vs. State

- **Events (Evidence)** are things that happened, at a specific moment, and are true forever
  regardless of what anyone later believes about them.
- **State (Understanding, and anything else computed rather than observed)** is a current best
  belief, always liable to revision, never itself a historical record.

**The invariant that makes this real:** State must always be fully reconstructable by replaying
Events from scratch. A practical test that survives any future implementation: **for any given
piece of information in the system, can you say whether it is a memory of what happened or an
opinion about what it means?** If not, the entity boundary is wrong.

## 6. Source of Truth & Derived State

```
Evidence  →  Understanding  →  Recommendation
(fact)       (belief, confidence-qualified)   (ephemeral suggestion)
```

- Evidence is the only source of truth about the past.
- Understanding is derived state — a cache of belief, never authoritative over the Evidence it
  came from.
- A Recommendation is derived from derived state — two steps removed from ground truth, which is
  exactly why Constitution 5.10 matters most here.
- Concept Attribution sits in its own lane — a claim about the content graph itself, not about a
  learner, with its own confidence and its own review lifecycle (Constitution 5.8 applies to it
  directly).
- **Evaluator reliability follows the same pattern as Understanding, generalized.** Whether a
  specific Evaluator tends to grade strictly or leniently is not a new kind of thing — it is
  another confidence-qualified belief, computed from the history of Evidence that Evaluator has
  produced, exactly like Understanding is computed from the history of Evidence about a Learner.
  This chapter confirms Evaluator reliability needs **no new entity** — it is a Projection,
  scoped to Evaluator instead of Learner. Its exact computation (how much history is needed,
  how disagreement with other Evaluators is weighted) is Learning Engine work, not ontology
  work, and is named here only so it isn't lost before that chapter is written.

## 7. Identity Rules

- **Learner:** one continuous identity, for life, across every domain and device.
- **Concept:** durable identity that survives renaming; splits and merges are explicit, tracked
  events — never silent — and every piece of Evidence or Understanding attached to the old
  identity must be traceable forward to the new one(s).
- **Source:** identity includes edition/version — content can change under an unchanged title.
- **Content Item:** identity is its own, but always carries the Source and Concept Attribution
  it had at creation; retired or superseded, never silently edited in place.
- **Pathway:** identity is its own; a live Pathway is revised as a new version, not edited under
  learners actively progressing through it.
- **Goal:** scoped to one Learner, with its own lifecycle; never silently deleted.
- **Learning Activity:** weak identity, like Evidence — a bounded occurrence tied to (Learner(s),
  time window, what was engaged with). Nothing refers to a specific Learning Activity as a
  stable long-term target; it is a grouping context for the Evidence within it, not a durable
  domain noun.
- **Evaluator:** durable identity, deliberately — the same evaluator must be recognizable across
  every piece of Evidence they ever judge, or their reliability can never be assessed.
- **Evidence:** identity is weak by design — a fact tied to (Learner, moment, what happened).
  Nothing else refers to a specific piece of Evidence as a stable target; Evidence is terminal.
- **Understanding:** no independent identity at all — a value, not a record, recomputed rather
  than versioned.

## 8. Invariants

1. Every Concept belongs to the graph rooted at some top-level Concept (a Concept with no
   parent via `Composes`). There are no disconnected Concepts.
2. A Concept's identity is never silently reused for a different meaning. Splitting or merging
   is explicit and tracked, never a quiet rename.
3. Understanding must always be fully reconstructable by replaying Evidence.
4. Evidence is append-only. Never edited or deleted, only ever reinterpreted by something
   computed from it.
5. A Content Item without at least one Concept Attribution and one grounding Source is not a
   valid Content Item — it's an unpublished draft. (This invariant applies to Content Item only;
   a Learning Activity is not required to reference a Source at all.)
6. A Learner's Understanding of one Concept never silently influences Understanding of an
   unrelated one. Any such influence must be an explicit `Transfers-to` relationship.
7. A Pathway references Concepts; it never owns or defines them.
8. A Goal belongs to exactly one Learner. Never shared or aggregated across Learners.
9. Self-reported Evidence is Evidence, never Understanding.
10. A Learning Activity may exist without referencing any Content Item, but every Evidence
    record must originate from exactly one Learning Activity.
11. A Learning Activity may have more than one Learner participant; every Evidence record
    derived from it nonetheless remains scoped to exactly one Learner — multi-participation
    belongs to the Activity, never to Evidence.
12. The issuance of a Recommendation is logged as Evidence, not only the Learner's response to
    it.
13. An Evaluator is a persistent identity, never a disposable label — the same Evaluator judging
    many Evidence records over time must remain recognizable as the same Evaluator.

## 9. Ownership

| Entity | Who may create it | Who may retire/change it |
|---|---|---|
| Concept | Curating authority, or proposed by AI as *pending* | Curating authority confirms; splits/merges are explicit |
| Concept Relationship | Same as Concept | Same as Concept |
| Source | Curating authority (official) or a Learner (personal upload) | Whoever contributed it; superseded by a new edition |
| Content Item | Anyone/anything (author, AI) — subject to Invariant 5 | Retired or superseded, never silently edited once live |
| Concept Attribution | Proposer (often AI, sometimes after the fact) | Confirmed or rejected by curating authority — where Constitution 5.8 is enforced structurally |
| Pathway | Curating authority (official) or a Learner (personal) | Same party that created it |
| Goal | The Learner, exclusively | The Learner, exclusively |
| Learning Activity | Begins automatically when a bounded engagement starts (Learner-initiated or system/instructor-logged) | No one edits it; it closes when the engagement ends and accumulates no further Evidence afterward |
| Evaluator | Registered on first use by curating authority or system (a new instructor, a new model version, the standing "self-report" evaluator) | Retired/superseded when no longer active; identity persists for historical attribution |
| Evidence | Generated by the Learner's own activity | No one — append-only by design |
| Understanding | No one "owns" it — computed | Recomputed automatically as Evidence or inference methods change |
| Recommendation | Issued by the system to a Learner | Becomes the Learner's the moment it's acted on |

## 10. Lifecycle

- **Concept:** *proposed* → *confirmed* → *active* → *split/merged* (explicit) or *deprecated*
  (rare, forward mapping preserved).
- **Concept Attribution:** *proposed* → *confirmed* or *rejected* → *active* → *superseded* if a
  better attribution is found.
- **Source:** *ingested* → *processed* → *active* → *superseded* or *retired*.
- **Content Item:** *generated/authored* → *pending verification* → *active* →
  *retired/superseded*.
- **Pathway:** *drafted* → *active* → *revised* (a new version) → *retired*.
- **Goal:** *set* → *active* → *achieved* or *abandoned*.
- **Learning Activity:** *opened* → (accumulates Evidence) → *closed*. No further states — a
  closed Activity is never reopened or edited.
- **Evaluator:** *registered* → *active* → *retired/superseded* (identity persists for history).
- **Evidence:** *recorded* → permanent. No further states.
- **Understanding:** no lifecycle of its own — recomputed on demand from whichever Evidence and
  inference method currently apply.
- **Recommendation:** *issued* (logged as Evidence) → *accepted*, *overridden*, or *ignored*
  (response logged as Evidence) → expires without further state.

## 11. Open Tensions Carried Forward

- **Institutional authority is not modeled.** A teacher assigning work to a class doesn't fit a
  Learner-owned Goal. Confirmed still deferred after five full journey simulations, none of
  which required it — real future work, not an oversight.
- **Concept granularity governance isn't specified here.** *Who* decides when a Concept should
  split, and what justifies it, belongs to the Content Architecture chapter.
- **Understanding's confidence representation isn't defined here.** This chapter requires that
  Understanding always carry a confidence; whether that's a Bayesian posterior, an evidence-count
  heuristic, or something else belongs to the Learning Engine chapter.
- **Evaluator reliability's exact computation isn't defined here.** Confirmed (Section 6) to be
  a Projection requiring no new entity — how it's actually computed from an Evaluator's Evidence
  history belongs to the Learning Engine chapter.

---

*End of Chapter 1 — Learning Domain Model. Tested against seven domains, five full learner
journeys, and a two-directional minimality proof (no entity removable, none missing). Ready for
freeze on confirmation.*

---

## Freeze Scope

This chapter defines the ontology only: the vocabulary, identities, relationships, invariants,
and lifecycle boundaries of the learning system.

It intentionally does not define computation, inference, optimization, ranking, weighting, or
decision-making algorithms. Those belong to subsequent chapters.

---

## Revision Log *(not part of the ontology — kept for institutional memory only)*

**Draft → Ready-for-freeze, consolidated pass.** Folds in every finding validated across three
review rounds that had, until now, existed only in conversation:
- Removed **Domain** as a separate entity — folded into Concept as the root of a `Composes`
  hierarchy, following the same "granularity is a curatorial choice" logic already established
  for Concept itself.
- Added **Learning Activity** — forced by Driving, Chess, Music, and Medicine, all of which
  produce Evidence from bounded, often unrepeatable real-world engagement with no predefined
  Content Item.
- Added **Evaluator** — forced specifically by Medicine's cross-attending calibration need, then
  confirmed as unavoidable (not just convenient) by the minimality test's necessity proof: a
  bare string tag cannot support learning that a specific evaluator is systematically strict or
  lenient over time.
- Widened **Concept**'s nature taxonomy to include habitual/automatized (Driving, Music motor
  skill), and confirmed no further nature category (e.g., "integrative") is needed — holistic,
  non-decomposable capability is handled by widening **Understanding** instead.
- Widened **Understanding** to a family of projections (Concept-grain and Activity-type-grain),
  forced by Chess playing strength and Driving competence resisting concept-level decomposition.
- Widened **Evidence**'s origin from "attempt at a Content Item" to "observation during a
  Learning Activity," and added the Evaluator reference to its envelope.
- Generalized **Concept Attribution** to target a Content Item *or* a Learning Activity,
  including retroactive attribution (confirmed necessary by Programming's real-project-work
  case).
- Confirmed **Recommendation issuance** must be logged as Evidence, not only the response to it
  (Chess's repeated-nagging case).
- Added the **Entity Taxonomy** (Nodes / Facts / Relationships-with-properties / Projections) as
  its own section, so Concept Relationship and Concept Attribution are presented as what they
  are — relationships carrying their own state — rather than peers of Learner or Concept. This
  is a presentation change with no effect on what exists.
- Recorded that **Evaluator reliability requires no new entity** — it is confirmed to be a
  Projection following the same pattern as Understanding, scoped to Evaluator instead of
  Learner; its exact computation is explicitly deferred to the Learning Engine chapter rather
  than resolved here.
- Ran a full necessity/sufficiency minimality test: attempted to fold every one of the 13
  resulting entities into another and documented why each attempt fails; attempted to justify
  ten candidate additions (Session, Cohort, Skill-as-separate-type, Mood-entity, Milestone,
  Peer-comparison, Credential, Explanation-instance, Evaluator-reliability-as-entity, Streak) and
  found each either subsumed by an existing entity/pattern or a deliberate, previously-stated
  scope exclusion.

---

# Chapter 2 — Learning Engine

**Status: FROZEN.** Passed semantic review (C3), governance review (C4), and dependency review
(CI-1, CI-2) under the Architecture Review Board process. Zero amendments to any frozen document
were required. Future changes must go through the same amendment discipline as
`LEXI_FOUNDATION.md` and Chapter 1 — no silent edits.

Together with the Product Constitution (`LEXI_FOUNDATION.md`) and Chapter 1 (Learning Domain
Model), this chapter forms LEXI's **baseline architecture**. Every subsequent chapter is built on
top of these three and is reviewed against them using the same governance method established
here: classify the issue (contradiction / semantic ambiguity / authority allocation / governance
conflict), then close it in order — semantic proof, authority proof, necessity test — with
amendment as the last resort, only once every valid implementation has been shown to fail.

## Constitutional Grounding

Resolved by Architecture Review Board, in two different ways — the distinction matters and is
kept visible rather than smoothed over.

- **CI-1 — Belief Provenance: a derived constitutional theorem.** *Historical execution is never
  an independent source of truth for a persistent belief; execution influences belief only after
  becoming logged Evidence.* Proven from the definition of Evidence (Ch.1 §3.2) together with
  Constitution 5.2 and 5.8 alone — no reference to any Ch.2-specific mechanism. **No amendment, no
  ratification.** Instantiated by §2.4 invariant 11.
- **CI-2 — Epistemic Sufficiency: not a theorem — an interface design obligation.** Three proof
  attempts were made and each failed against a valid counterexample, the last decisively: a
  representation collapsing Ignorance and Conflict to an identical (Estimate, Confidence) pair is
  **not** a Constitution violation if the distinction is honestly available elsewhere in the same
  contract (e.g. Evidence Basis showing 92 contradictory observations vs. 2 observations, or an
  explanation stating the reason plainly). Constitution 5.2/5.8/5.10/Rule 11 require that LEXI's
  *communicated claim, taken as a whole*, never mislead — they say nothing about which field of the
  contract carries which piece of that honesty. Mandating that any specific field (a headline
  scalar, a dedicated evidential-mass dimension, or any other structure) carry the distinction would
  itself be an unjustified representation mandate — exactly what CI-2 was supposed to avoid
  imposing. Final form, carried as **§2.3's contract obligation**, not a numbered Core Invariant:
  *the Understanding contract, taken as a whole, must expose sufficient epistemic information for
  a conforming Decision Policy to satisfy Constitution 5.2, 5.8, 5.10, and Rule 11 — distributed
  across whichever fields the implementation chooses.* No amendment, no ratification, no mandated
  representation.

## 2.1 Purpose

The Learning Engine performs exactly one transformation:

> **It turns Evidence into Understanding.** Observations into beliefs.

It does not create Evidence (that is generated by the Learner's activity). It does not choose
Recommendations (Decision Policy). It does not render anything (Experience). It does not speak
as a tutor (Experience).

**The boundary that keeps this chapter alive for a decade:** the Engine produces beliefs by
*computation over a learner's own Evidence*, never by *asking a generative model for its
opinion*. Whether that computation is Bayesian updating, item-response theory, knowledge
tracing, a neural network, or a method not yet invented is deliberately left open (§2.10). The
invariant is *grounded in this learner's evidence* (Constitution 5.2, 5.3), not *which
mathematics*. This is why "no LLM" and "deep learning is an open option" (§2.10) are not in
conflict: a learned model that computes a belief from evidence is permitted; a generative model
asked to guess how well a student knows something is not — the latter fabricates belief instead
of deriving it.

A consequence the rest of the chapter depends on: **given the same closure (§2.2), the Engine
produces the same Understanding — and nothing outside that closure, in particular no record of
past Decision-Policy execution, may enter.** The Engine is a pure function of an explicitly
enumerated, closed input set (CI-1; §2.4 invariants 11 and 14). This is what makes Chapter 1's
reconstructability guarantee and Constitution 5.2/5.8 auditability enforceable — Understanding is
a *pure projection* of the closure, never a place where new, un-replayable information enters the
system.

## 2.2 Inputs — The Closure

The transformation consumes a single, explicitly enumerated **closure**. The word is
load-bearing: the set below is exhaustive (§2.4 invariant 14), and nothing outside it may change
Understanding.

- **The Evidence Log** — the immutable facts (Ch.1 §3.2), in temporal order. The only source of
  ground truth. (History is not a separate input — it *is* this ordering; a shadow ledger
  competing with Evidence is forbidden, Ch.1 §5.)
- **The Ontology Snapshot** — the Concept graph *and* the Concept Attribution set, each at a
  specific **version** (Ch.1 §3.3). Both are mutable over time (Concepts split/merge; attributions
  are re-resolved), so the version is part of the closure — this is what lets a past Understanding
  be reconstructed exactly while a present one is recomputed against the latest ontology (§2.4
  invariant 12). *attribution-confidence* feeds weighting (§2.6).
- **Evaluator Reliability** — the projection (Ch.1 §6) of how far to trust each Evidence record's
  judge. Consumed here as an input; if it is itself computed from Evidence, it must be anchored
  *outside* the belief it will weight (§2.4 invariant 13), or the closure stops being a function.
- **Engine Version / Model State** — which method produced the belief; for a continually-learning
  model this includes the model state as of the computation point. "Version" is whatever
  identifier makes the computation reproducible (§2.4 invariants 9, 11). Surfaced on the output
  contract as **Method Version** (§2.3) — same identifier, named for what it *is* here (a closure
  input) and for what it *does* there (lets consumers tell methods apart).
- **`now`** — the reference point for freshness and decay (§2.8). An input, not a stored fact.

**What is deliberately excluded: historical execution.** No record of which Recommendations the
Decision Policy issued, in what order, with what exploration, is part of the closure. A past
Recommendation reaches Understanding **only** after it has become logged Evidence (its issuance,
and the learner's response); at that point it is an Observation inside the Evidence Log, not an
action to be re-run (CI-1; §2.4 invariant 11). **Prior Understanding is likewise never a source**
— the Engine may cache it and update incrementally, but the result must equal a from-scratch
recomputation over the closure (Ch.1 Invariant 3). A cache is an optimization, never an input.

## 2.3 Outputs

Projections (Ch.1 §3.4), every one carrying the **same contract**, regardless of grain.

**Terminology — three distinct quantities, never all called "confidence":**
- **belief-confidence** — how far an *Understanding* should be trusted.
- **attribution-confidence** — how sure we are an Evidence record bears on a Concept (a property
  of Concept Attribution; §2.6).
- **evaluator-reliability** — how far an *Evaluator's* judgments should be trusted (Ch.1 §6).

Unqualified "confidence" in this chapter means **belief-confidence**.

| Field | Meaning |
|---|---|
| **Estimate** | Best current belief about capability. May be a distribution; never a bare boolean. |
| **Belief-confidence** | The support behind the estimate. Its *representation* is open design (§2.10); its *sufficiency* is fixed by invariant 2 (CI-2). |
| **Evidence Basis** | The Evidence that produced this belief — inspectable and traceable to facts (Constitution 5.2). |
| **Ontology Snapshot** | The graph + attribution version the belief was computed against — required for reconstruction (invariant 12). |
| **As-of** | The `now` the projection was computed against (decay makes belief time-relative). |
| **Method Version** | Which Engine version/state produced it — so beliefs from different methods are never silently compared (invariant 9). |

The contract does **not** mandate a belief representation — a scalar, an interval, a posterior, a
mass function are all admissible, and the distinguishing information for cases like §2.7 may live
in Confidence itself, in Evidence Basis, or in an implementation-added explanation field. **The
contract's obligation is on the whole:** taken together, its fields must expose sufficient
epistemic information for a conforming Decision Policy to satisfy Constitution 5.2, 5.8, 5.10, and
Rule 11 (CI-2, see Constitutional Grounding above). No single field is mandated to carry any
specific distinction — only that the total contract does not misrepresent the evidential
situation. It is uniform across the two grains Chapter 1 defines — `(Learner × Concept)` and
`(Learner × Activity-type)` — so every consumer reads all projections identically. (A
subject-level view, e.g. "overall Mathematics," is not a third grain: since Chapter 1 folds
Domain into Concept as a root node, it *is* `(Learner × Concept)` applied to a root Concept, and
already receives roll-up from its descendants for free via ordinary `Composes` propagation,
§2.9 — no separate mechanism needed.)

## 2.4 Core Invariants

The most important section. These are properties any implementation must satisfy — the
acceptance test for swapping one inference method for another. They are invariants, not
formulas.

1. **Understanding is always probabilistic.** No belief is ever a bare "mastered / not
   mastered." Every estimate carries uncertainty; a point value without confidence is forbidden
   (Constitution 5.2, 5.10).

2. **Confidence is honest, not necessarily self-sufficient.** Confidence reflects the Engine's
   actual epistemic state and must never be dressed up to look more or less certain than the
   Evidence supports. It is **not** required, by itself, to carry every distinction a downstream
   policy might need (that obligation belongs to the *contract as a whole* — §2.3, CI-2 — not to
   this one field). The folk-intuitions this invariant protects — "conflicting evidence lowers
   confidence," "confidence is never inflated by discarding inconvenient evidence" — hold regardless
   of representation. ("Discarding evidence" is in any case not an Engine operation: Evidence is
   immutable, Ch.1 Invariant 4, subject only to invariant 12 and to whatever Evidence Constitution
   §5.9 legitimately makes unavailable — see Reconstructability Scope below.)

3. **Estimate and confidence are independent dimensions.** All four quadrants are legal and
   meaningful: confident-strong, confident-weak, unsure-strong, unsure-weak. "We are highly
   confident this learner is weak here" is a first-class, useful state — not a contradiction.

4. **No Evidence is ignored silently.** Every relevant piece either affects the belief or is
   discounted for an inspectable reason (low evaluator reliability, staleness, weak attribution)
   — never dropped invisibly (Constitution 5.2).

5. **Contradictory Evidence coexists.** The Engine never resolves a contradiction by deleting
   one side — a direct application of Ch.1 Invariant 4 (Evidence is append-only) to the specific
   case of disagreeing Evidence. Both persist as facts; the belief carries the tension forward as
   reduced confidence and, where the grain supports it, as a signal of inconsistency.

6. **Time affects certainty, never history.** Elapsed time may lower confidence in a *present*
   belief (§2.8), but it never alters, ages, or rewrites the Evidence itself. Decay is a
   property of belief, not of fact.

7. **Determinism / reproducibility.** Same closure (§2.2) → same Understanding. This is the
   positive form; invariant 11 gives its negative (nothing outside the closure may enter), and
   invariant 14 requires the closure be complete. The three together make Chapter 1's
   reconstructability guarantee enforceable.

8. **Traceability.** Every Understanding can name the Evidence that produced it (the Evidence
   Basis in §2.3). A belief that cannot point to its grounding violates Constitution 5.2 and is
   invalid output.

9. **Method honesty across versions.** When the inference method changes, historical
   Understanding is either recomputed under the new method or clearly labeled with the old one.
   Beliefs produced by different methods are never compared as if equivalent. *This is the
   invariant that actually makes "replace Bayesian with a Transformer later" safe* — the whole
   chapter is built so the method can change without the contract changing, but only if version
   provenance is never lost.

10. **Belief never exceeds evidence.** The Engine never asserts capability the evidence does not
    support. Belief may be *propagated* across the concept graph (§2.9), but propagated belief is
    always lower-confidence than direct evidence and can never manufacture confidence out of
    graph structure alone (Constitution 5.3, 5.10).

11. **Belief provenance — instantiates CI-1.** Understanding is a pure function of the closure
    (§2.2) and **never** of historical execution. A past Recommendation influences it only after
    becoming logged Evidence (issuance + the learner's response); at that point it is an
    Observation in the closure, not an action to be re-run. This is what makes Constitution
    5.2/5.8 auditability achievable — a belief is re-derivable from records alone, without
    replaying any policy. Note this is determinism *given the realized Evidence Log*; the log
    itself is co-produced by a (legitimately stochastic) Decision Policy and the real learner, so
    the learner's *trajectory* is not reproducible — only belief *given* the trajectory is.

12. **Evidence is immutable; interpretation is versioned.** Evidence never changes meaning. When
    the ontology evolves — most sharply when a Concept splits — it is the **Concept Attribution**,
    not the Evidence, that is re-resolved, under its own version. A split places every affected
    Attribution into re-resolution; until re-resolved, pre-split Evidence stays on the parent (now
    a `Composes` root) and reaches the finer Concepts only via `Composes` at reduced
    belief-confidence — the honest low-certainty outcome (Constitution 5.2). Because the ontology
    snapshot is in the closure, this stays reconstructable.

13. **Evaluator reliability is not circularly derived.** The reliability weighting an Evidence
    record must not be derived from the very Understanding that Evidence helps compute — except via
    a fixpoint explicitly declared and shown to converge. Default anchors lie *outside* the belief
    being computed: known-answer items, official outcomes, agreement with higher-trust evaluators.
    This keeps the closure a function, not an unresolved loop.

14. **The closure is complete and explicit.** The input set in §2.2 is exhaustive. If any input
    outside it can change Understanding, the closure is defined wrong — not the invariant.
    Determinism (7, 11) is only meaningful against a closed, enumerated input set.

### Reconstructability Scope

Reconstructability guarantees (7, 11, 14) apply with respect to the Evidence available to the
Engine at reconstruction time. Constitution §5.9 may legitimately reduce that available Evidence.
The mechanism by which this occurs is outside the scope of this chapter.

## 2.5 Engine Pipeline

A **logical** ordering of responsibilities — not a mandate for four sequential code modules. A
monolithic learned model may collapse these into one pass; it must still, implicitly, discharge
every responsibility below. The pipeline is a checklist of concerns the output is accountable
for, not an architecture.

```
Evidence
   ↓  Normalization   — put heterogeneous Evidence on comparable terms: map a compiler
   ↓                    pass/fail, a rubric score, a right/wrong, a self-report onto the
   ↓                    capability dimension(s) of the Concept(s) it bears on, via Attribution.
   ↓  Weighting       — assign each Evidence its influence (§2.6).
   ↓  Aggregation     — combine all weighted Evidence bearing on one projection target into a
   ↓                    single evidential picture, representing conflict rather than averaging
   ↓                    it away.
   ↓  Inference       — turn the aggregated picture into a belief (estimate + confidence),
   ↓                    including graph propagation (§2.9) and time/decay (§2.8).
   ↓
Understanding
```

No stage names a technique. "Bayesian," "neural," "IRT" appear nowhere — by design.

## 2.6 Evidence Weighting

Where the Evaluator reliability projection is consumed. The Engine determines each Evidence
record's **weight** — its influence on the belief — from these **factors**. The chapter defines
the factors and the *direction* each moves weight; it does **not** define the combination
function (open — §2.10). The `×` below denotes "combines from," not "multiply."

```
Evidence Weight  ⟵  combines from:

    Evaluator Reliability     — trust in the judge (Ch.1 §6 projection). A self-report and an
                                expert assessment of the same performance carry different weight.
  × Attribution Confidence    — how sure we are this Evidence bears on this Concept at all
                                (Ch.1 §3.3). Weak attribution → weak bearing, never silent
                                certainty.
  × Freshness                 — recent Evidence speaks more to *present* capability.
  × Specificity               — Evidence that targets the Concept precisely outweighs Evidence
                                that touches it only incidentally.
  × Coverage                  — how much of the Concept the Evidence actually exercises (one
                                corner vs. the whole).
```

Each factor moves weight monotonically in the stated direction. How they combine — product,
weighted sum, a learned function — is an implementation choice constrained only by the §2.4
invariants.

## 2.7 Uncertainty

This section is where Constitution 5.10 (Caution over Confidence) and CI-2 (§2.3, Constitutional
Grounding) become concrete. The Engine must be able to communicate **at least three epistemically
distinct situations** — because a constitutionally-bound policy must act differently on each:

- **Ignorance** — little evidence. We don't know. A first-class output, categorically different
  from "we know they're weak," never a default-to-zero.
- **Conflict** — much evidence, disagreeing. We know the learner is *inconsistent*.
- **Confident-low** — much evidence, agreeing that capability is low. We know they're weak.

In a bare (Estimate, Confidence) encoding, Ignorance and Conflict land in the same place
(mid-estimate, low-confidence) — Confident-low is already distinct (low-estimate, high-confidence)
and needs no special handling. This is **not** grounds for mandating a third headline dimension:
Constitution 5.2's "says so" requirement is satisfied the moment the distinction is honestly
recoverable *anywhere* in the contract — Evidence Basis alone already carries it (92 contradictory
observations reads differently from 2 observations), and an implementation may additionally choose
a richer Confidence structure, or an explanation field, if that better serves clarity. What is
**not** acceptable is a contract whose fields, taken together, leave Ignorance and Conflict
genuinely unrecoverable — that is the CI-2 violation, and it is a property of the whole contract,
not of any one field within it.

The Engine's obligation ends at *exposing* uncertainty honestly, somewhere in its contract. *What
to do* about it — practice to resolve, act cautiously — is Decision Policy's concern, not this
chapter's.

## 2.8 Decay

Not a forgetting curve — an **invariant about how certainty behaves over time**. The chapter
commits to the *direction*, never the *shape* (exponential, power-law, retrieval-strength models
are all open — §2.10).

- **Absence weakens certainty about the present.** Time elapsed since supporting Evidence
  lowers confidence in *current* capability. The old Evidence remains true (§2.4 invariant 6); it
  simply becomes a weaker indicator of *now*. Absence is not written into the record as a fabric­
  ated "forgetting event" — it is a computed effect of `now` minus the last supporting Evidence.
- **Successful retrieval refreshes certainty.** Recent confirming Evidence restores confidence
  that had decayed with time.
- **Decay is deterministic and recomputable.** Because it is a function of (Evidence timestamps,
  `now`), recomputing belief at any later time reproduces the correct decayed value — preserving
  Invariant 7. Decay never mutates state that can't be regenerated.

Different Concept natures (Ch.1 §3.1 — declarative, procedural, habitual) may decay differently;
*that* they can decay differently is the design allowance, *how much* is a method parameter.

## 2.9 Concept Propagation

Where Concept Relationships (Ch.1 §3.3) become computational. Each of the four kinds affects
inference **differently in kind, not degree** — collapsing them into a generic "related concept
nudges belief" is the failure this section prevents.

> **Resolved (C3, no amendment).** Chapter 1 defines which ontology relationships exist. It does
> not define how those relationships contribute to epistemic inference. Ontology Invariant 6
> constrains only that no cross-concept influence may arise through *undeclared* ontology
> structure — bridging two Concepts that share none of the four Concept Relationship kinds
> (Ch.1 §3.3, "Concepts relate to each other... Four kinds") requires an explicit `Transfers-to`
> edge. It is intentionally silent on how a *declared* relationship of any kind contributes to
> belief — that is epistemic influence semantics, not ontology semantics, and Chapter 1 does not
> formalize it. This section specifies **one valid inference semantics** over the frozen ontology;
> it does not reinterpret, extend, or reach a different reading of Invariant 6.

- **Requires** (hard prerequisite, directional): evidence of holding C weakly implies its
  prerequisite B is at least partially held (C is not reachable without B). Conversely,
  well-evidenced weakness in B caps the plausible estimate of C. A *constraint*, propagating
  backward and bounding forward.
- **Composes** (part-whole): belief flows between a composite and its parts — mastery of the
  whole informs the parts and vice versa, at reduced confidence.
- **Resembles** (commonly confused): evidence about A raises the *risk of confusion* on B — it
  does **not** raise the mastery estimate of B. Resemblance predicts error, not capability;
  treating it as capability transfer would be a category error.
- **Transfers-to** (soft, probabilistic): mastery of A modestly raises the *prior* for B, at
  distinctly lower confidence than any direct evidence about B.

Two guardrails, both enforcing §2.4 invariant 10:

- **Propagated belief is always weaker than direct belief.** Graph structure can inform a prior;
  it can never produce confidence that direct evidence would not.
- **Propagation is bounded and non-circular.** A Concept's belief can never be inflated by a
  loop through the graph (A boosts B boosts A). Propagation that manufactures confidence from
  its own output is forbidden.

### Concept split (retroactive ontology change)

When a Concept splits (e.g. *Verb* → *Finite Verb* + *Non-finite Verb*), **no Evidence is
rewritten** (invariant 12) — its meaning was never the mutable part. Instead every Concept
Attribution pointing at the old Concept enters re-resolution. Until an attribution is re-resolved
against the finer Concepts, the pre-split Evidence stays attached to the parent (now a `Composes`
root) and reaches the children only through `Composes` propagation, at reduced belief-confidence.
The correct epistemic result is that historical belief about the *finer* distinction is honestly
less certain than belief about the coarse original — which the representation must be able to state
(invariant 2). This is why the ontology snapshot is part of the closure (§2.2).

## 2.10 Open Decisions (deliberately unresolved)

The chapter is written so that any of these can implement it, and none of them is chosen here:

- **Inference method:** Bayesian Knowledge Tracing? Item Response Theory? Deep Knowledge
  Tracing? A Transformer? A Graph Neural Network over the concept graph? An ensemble? Something
  not yet invented?
- **Combination function** for the weighting factors (§2.6).
- **Confidence metric** — posterior variance, evidence count, entropy, a learned calibration?
- **Decay shape** (§2.8) — exponential, power-law, retrieval-strength?
- **Propagation strengths** (§2.9) — how far and how strongly belief flows across each
  relationship kind.
- **The belief representation itself** — evidential mass, Bayesian posterior, interval
  probability, Dempster–Shafer, Dirichlet evidence, or otherwise. The Constitution (CI-2) freezes
  the *information* a belief must preserve (invariant 2), never the representation. Choosing one is
  design, not constitution.

**The acceptance test for whichever method is chosen is §2.4.** Any implementation that
satisfies every invariant in §2.4 is a valid Learning Engine; any that violates one is not —
regardless of how well it performs on a benchmark. That is the whole design intent of this
chapter: **the method is replaceable; the invariants are not.** If, five years from now, the
entire inference approach is swapped, §2.1–2.4 should not need a single edit — and if they do,
that is the signal that the swap changed the product's meaning, not just its mathematics.

## Chapter Scope (frozen boundary)

This chapter defines **how beliefs change when evidence changes** — the computational
architecture of inference — and nothing else.

It does **not** define how Recommendations are chosen from Understanding (Decision Policy, a
later chapter), nor how the companion presents anything to the learner (Experience,
`LEXI_EXPERIENCE.md` — deferred, not yet written). It commits to *no* specific ML or statistical
model. Those boundaries are
what let the Learning Engine share the Ontology's lifespan: the algorithm can be replaced
entirely without touching this chapter's invariants.

### Freeze gating — resolved

**C3 (semantic review):** closed, no amendment. Ontology Invariant 6 is intentionally
under-specified with respect to epistemic influence semantics — it constrains only that no
cross-concept influence may arise through undeclared ontology structure. §2.9 specifies one valid
inference semantics over the frozen ontology; it does not reinterpret Chapter 1.

**C4 (governance review):** closed, no amendment. The apparent conflict rested on an unexamined
assumption — that Constitution §5.9's "delete" means physical destruction of the ontology Evidence
object. §5.9's text specifies learner rights and prohibited future uses; it intentionally leaves
deletion *implementation* semantics unspecified. Because at least one valid implementation
satisfies §5.9 without touching Ontology Invariant 4, no document conflict exists — governance
conflicts are only real when *every* valid implementation is forced to fail, and that was never
shown here. Resolved via the Reconstructability Scope note above, which fixes only the *boundary*
of this chapter's own guarantee, not any deletion mechanism.

**CI-1, CI-2 (dependency review):** resolved in Constitutional Grounding — CI-1 as a derived
theorem, CI-2 as a contract-level obligation (§2.3). Neither required ratification.

**Net amendments across the full review: zero.** No frozen document was reopened.

---

## Chapter 2 Revision Log *(not part of the contract — institutional memory only)*

**Draft → ARB-revised (pending freeze).** Applied the Architecture Review Board's confirmed
findings and the two founder rulings:
- **C1 / invariant 14 + §2.2 "The Closure":** made the input set exhaustive and explicit
  (Evidence Log, versioned Ontology Snapshot, Evaluator Reliability, Engine Version/Model State,
  `now`); absorbed the continual-learning "version" concern (model state as of computation point)
  and the retroactive-ontology concern (ontology snapshot version) here rather than as separate
  issues.
- **NEW-A / CI-1 / invariant 11:** elevated "Understanding depends only on evidence, never on
  historical execution" to a constitutional dependency (ratification pending), instantiated as the
  belief-provenance invariant; recorded that determinism is conditional on the realized Evidence
  Log while the learner's trajectory is legitimately non-reproducible.
- **C2 / CI-2:** went through three rulings before converging. Attempt 1: a single-scalar
  "confidence" (rejected — couldn't separate ignorance from conflict). Attempt 2: promoted to a
  "constitutional theorem" requiring the *representation* preserve the distinction (rejected — a
  counterexample showed a contract can satisfy 5.2 with an identical headline (Estimate,
  Confidence) as long as Evidence Basis or an explanation carries the distinction honestly
  elsewhere). Final: CI-2 is **not a theorem**, but a **contract-level interface obligation** —
  the Understanding contract, taken as a whole, must expose sufficient epistemic information;
  no field is mandated to carry any specific distinction. Relocated from §2.4 (Core Invariants) to
  §2.3 (contract obligation), since it binds the artifact as a whole, not any one property of it.
  Along the way, corrected an imprecision in the original §2.7: only Ignorance and Conflict
  actually collide in a bare (Estimate, Confidence) encoding — Confident-low was already distinct
  and never needed special handling. A candidate Ch.2-internal invariant ("Single Authority" —
  Decision Policy consumes capability judgments only via Understanding) was proposed to ground CI-2
  and then **withdrawn**: it dictated consumer behavior, which is Decision Policy's jurisdiction,
  not the Learning Engine's — a genuine layering violation, caught and corrected rather than kept.
- **NEW-B / invariant 12:** "Evidence is immutable; interpretation is versioned" — located
  retroactive semantic change in Concept Attribution, not Evidence; added the concept-split
  mechanics (re-resolution + `Composes` propagation at reduced confidence). No frozen-doc
  amendment required.
- **C5 / invariant 13:** anti-circularity for Evaluator Reliability (external anchors, or a
  declared convergent fixpoint).
- **Terminology:** disambiguated "confidence" into belief-confidence / attribution-confidence /
  evaluator-reliability.
- **C3 (§2.9):** left asserted in intended-final form with an explicit consistency-proof flag,
  rather than pre-emptively softened.
- **Dismissed as non-blocking:** neural/point-estimate "bias" (an interface requirement satisfiable
  by all families, not a design bias); continual-learning "no version" (folded into C1).

**ARB-revised → READY FOR FREEZE (Step 3: semantic + governance + dependency review).** The
standard tightened mid-review: existence of *one* compatible reading defeats amendment; existence
of *multiple* compatible readings defeats freeze (ambiguity is itself a blocker, distinct from
contradiction).
- **C3, three rounds to close.** Round 1 argued Reading B (any explicit relationship type
  propagates) merely *existed* — insufficient under the tightened standard, since Reading A
  (Transfers-to only) wasn't refuted. Round 2 attempted to refute A via harmonization with
  Requires's structural definition — the Chair caught a real gap: "hard prerequisite" is a
  structural fact, not an epistemic-inference rule; Ch.1 never claims the latter. This produced
  Reading C: Invariant 6 doesn't select *which* edge types propagate at all — it only forbids
  influence through *undeclared* structure. Round 3 settled the remaining question ("related" =
  connected by any of the four kinds, or specifically by `Transfers-to`?) using §3.3's own
  definition ("Concepts relate to each other... Four kinds") as an internal cross-reference,
  closing Reading A' without appeal to Ch.2's authority. Final: Invariant 6 constrains
  *visibility*, not *edge selection*; §2.9 answers a question Chapter 1 never asked, per Freeze
  Scope's explicit delegation of computation/weighting — cited only after the semantic question
  was independently settled, not to settle it.
- **C4, reversed twice.** First treated as requiring a corrective amendment to Ontology
  Invariant 4 (append-only vs. Constitution 5.9's erasure right) once no textual scope-limiter
  could be found in Ch.1 §8. The proposed amendment wording ("never edited or deleted **by the
  system**") was then rejected by the Chair on sharper grounds: it silently introduced an *actor*
  into what had been a pure entity-property invariant — a layering leak, not a minimal edit. That
  objection forced the actually-decisive question: does Constitution 5.9's "delete" mean physical
  destruction of the Evidence object, or an observable guarantee (no future reconstruction/use)
  agnostic to mechanism? Re-reading 5.9's Rationale ("asset to repurpose or monetize," never
  "bytes") showed the latter. Existence of *any* implementation satisfying 5.9 without violating
  Invariant 4 (e.g., cryptographic access revocation) defeats the necessity test for amendment —
  the Chair's final refinement: don't name the mechanism (that would smuggle in an unneeded
  implementation choice), state only the *scope boundary* of this chapter's own guarantee.
  Resulting text: the three-sentence Reconstructability Scope note above.
- **Net result: zero amendments to any frozen document**, across both issues, despite each having
  gone through an intermediate state where amendment looked necessary. Preserved here in full
  because the reversals are the evidence the process worked, not noise to clean up.
- **Governance method established, reusable for later chapters:** classify the issue first
  (semantic ambiguity / authority allocation / governance conflict / contradiction) — each has a
  different closing test, and conflating them (as C3 and C4 both were, repeatedly, early on) is
  where prior rounds went wrong. Semantic ambiguity closes only when competing readings are
  reduced to one via textual proof (not mere existence of a valid reading). Authority allocation
  closes by citing a delegation clause (e.g. Freeze Scope) — and only after semantics are already
  settled, never to settle them. Governance conflict closes only if *every* valid implementation
  of the constitutional principle is shown to force a violation of the frozen document; amendment
  is the last resort, not the default once a conflict is suspected.

**Post-freeze baseline coherence checkpoint.** After all three baseline documents (Constitution,
Ch.1, Ch.2) reached FROZEN, a system-level audit (layer boundaries, dataflow, normative
ownership, extension points) — not a content review — found four items:
- **`(Learner × Domain)` grain, removed.** §2.3 listed a third Understanding grain Chapter 1 never
  authorized (Ch.1 §3.4 defines exactly two: Concept-grain and Activity-type-grain). Proof: is
  Domain-level Understanding an alias of `(Learner × Concept)` applied to a root Concept (no new
  mechanism), a genuinely new entity (forbidden — Ch.1 explicitly folded Domain into Concept), or
  a distinct aggregation contract (a new mechanism)? Resolved as the first — `Composes`
  propagation (§2.9), already frozen, already rolls belief up from a root Concept's descendants
  for any Concept, root or not, so no separate mechanism is needed. Removed from the enumerated
  grain list; replaced with a one-line note that subject-level Understanding falls out for free.
  This was the one finding capable of touching normative content — Ch.2 had begun to silently
  re-introduce an entity Ch.1 had deliberately merged away.
- **Ambiguous same-number cross-references, fixed.** Ch.1 §8 and Ch.2 §2.4 each number their own
  invariants 1–N independently. Two bare references inside Ch.2 ("Invariant 6" in §2.8,
  "Invariant 10" in §2.9) pointed to Ch.2's own invariants but were textually indistinguishable
  from Ch.1's invariants of the same number — Ch.1 Invariant 6 in particular carries real weight
  after the C3 saga. Both now read "§2.4 invariant N" for disambiguation. Editorial only, no
  content change.
- **Missing ownership citation, fixed.** Ch.2 invariant 5 ("contradictory Evidence coexists")
  restates part of Ch.1 Invariant 4 without citing it, unlike every neighboring invariant.
  Added the cross-reference so a future edit to Ch.1 Inv4 doesn't silently orphan Ch.2 Inv5.
- **No contract for Recommendation or Evaluator Reliability — confirmed as intentional deferral,
  not a gap.** Recommendation (Ch.1 §3.4) has a lifecycle but no field-level contract analogous to
  Understanding's (§2.3); Evaluator Reliability has a computational rule (invariant 13) but not a
  full contract either. Both are correctly Chapter 3's and beyond's responsibility. Recorded as
  Ch.3's first artifact: define the Recommendation contract before defining policy behavior over
  it, mirroring how this chapter opened with the Understanding contract before its invariants.

---

# Chapter 3 — Decision Policy

**Status: FROZEN.** Passed coherence review (layer boundaries, dataflow, normative ownership,
extension points, future-proofness) and a seven-check freeze review (layer integrity, contract
completeness, closure completeness, invariant independence, semantic completeness,
future-proofness, lifecycle semantics) under the Architecture Review Board process. Zero
amendments to any frozen document were required.

**Freeze scope:** §3.1–§3.5. Future *normative* changes must go through the same amendment
discipline as `LEXI_FOUNDATION.md`, Chapter 1, and Chapter 2 — no silent edits. Purely editorial
changes (cross-references, wording, typos) that do not alter meaning do not require governance
review — the standard established during this chapter's own review (Q3, the `Goal`/`Goal(s)`
fix) and reaffirmed here for chapters that follow.

Together with the Product Constitution, Chapter 1 (Learning Domain Model), and Chapter 2
(Learning Engine), this chapter completes **Baseline Architecture v1** — a closed loop with an
independently-defined contract, closure, invariants, and semantics at each layer:
`Evidence → Understanding → Recommendation`.

Per the *contract before algorithm* convention, this chapter opens by defining its one new
artifact — the **Recommendation** — before any policy that produces it. Everything in §3.1 is the
artifact's shape and guarantees; *how* a Recommendation is chosen is deferred to §3.4, and *what
the policy may read* to §3.2.

> **Recommendation is prescriptive, not descriptive.** It proposes an action; it never describes
> learner state.

This is the boundary that keeps Recommendation from becoming a second Understanding. Learner
mastery, confidence estimates, diagnosis — any claim about *what the learner knows* — belong to
Understanding (Ch.2) alone. A Recommendation is built *from* Understanding, referenced through its
`Basis` field (below), but never *restates* it. If a future field ever needs to carry
mastery-shaped information directly rather than a pointer to it, that is a sign of drift into
Understanding's job, not a legitimate Recommendation field — the same discipline that keeps
Evidence and Understanding from collapsing into each other (Ch.2 §5) applies here one layer up.

## 3.1 The Recommendation Contract

Recommendation is already introduced in the frozen ontology — a Projection (Ch.1 §2), defined in
Ch.1 §3.4, with ownership in §9 and lifecycle in §10. This section does not redefine it; it gives
it the same contract treatment Understanding received in Ch.2 §2.3 — adding fields and invariants
while citing Chapter 1 for identity, producer, and lifecycle. Applying the *one new
artifact per chapter* convention: Recommendation is the only new noun introduced here; its
`Action` references existing Ch.1 entities (Concept, Content Item, Pathway), never a new one.

### Identity
A Projection, like Understanding (Ch.1 §2): no stored identity, computed fresh, ephemeral — never
a durable record updated in place. What *is* permanent is the **fact of its issuance**, which
Ch.1 Invariant 12 logs as Evidence: "a Recommendation was made at time T" is an immutable Evidence
record, even though the Recommendation object itself expires. (Exactly parallel to Understanding:
the projection is disposable; the Evidence under it is permanent.)

### Producer
The Decision Policy defined in this chapter — the transformation `(Understanding + active Goal +
available Pathway/Content) → Recommendation` (Ch.1 §3.4). The *closure* of that transformation —
precisely what the policy may and may not read — is §3.2, not here.

### Lifecycle (Ch.1 §10)
Deliberately not framed around a single consumer — a Recommendation may be read by learner-facing
UI, a teacher or parent dashboard, an API client, analytics, or a notification service. The
contract does not name which; it guarantees the same fields are legible to *any* conforming
reader.

A Recommendation is **current** from the moment it is Published until it is Retired. **At any
point in time, at most one Recommendation for a Learner is current.**

- **Published** — issued to the Learner it targets, becoming current. This act is itself logged
  as Evidence (Ch.1 Invariant 12), regardless of which surface eventually displays it.
- **Consumed** — read and acted on by any conforming consumer. Only the *targeted Learner's own
  response* to the recommended Action — accepted, overridden, or ignored — becomes Evidence
  (Ch.1 §3.4, §10) and re-enters the Learning Engine's closure (Ch.2 §2.2); a dashboard view, an
  analytics read, or a notification delivery does not. This closes the system loop:
  `Evidence → Understanding → Recommendation → (Learner's response) → Evidence`.
- **Retired** — a Recommendation ceases to be current when any one of the following holds:
  1. it has been **Consumed**;
  2. it has been **superseded** — a newer Recommendation for the same Learner has become current.
     A statement about which *state* is valid, not about execution order: retire-then-publish,
     publish-then-flip, and transactional replacement are all conforming implementations.
  3. it **no longer satisfies the contract required of a current Recommendation** — e.g. its
     Action is no longer grounded (§3.1 Invariant 4, below: content withdrawn, a prerequisite
     removed, the Pathway step no longer exists).

  Item 3 is deliberately general and deliberately *not* triggered by every change to Understanding
  or Goals: a Recommendation whose grounding still holds but whose relevance has shifted (the
  Learner just completed something else, Understanding moved) does not automatically retire —
  whether and when to recompute in that case is a Policy/Resolution decision (§3.4, §3.5), not an
  artifact-level rule. Only the narrower case — it would no longer be a *valid* Recommendation at
  all if re-evaluated right now — is a mandatory retirement trigger.

  **Retirement affects only current validity. It never changes the historical correctness of the
  Recommendation at the time it was issued** — the same discipline that lets Evidence stay
  append-only (Ch.1 Invariant 4) while belief about it evolves (Ch.2), and that keeps Invariant 6
  (§3.3, evaluated against issue-time information) fully intact: a retired Recommendation was
  still correctly issued when it was.

  Time-based staleness — expiring due to elapsed time alone, with no supersession or grounding
  change — is left open (§3.5).

### Fields
Carrying the CI-2 lesson (Ch.2 §2.3): the contract fixes the *information* each Recommendation
must carry, not its representation.

| Field | Meaning |
|---|---|
| **Action** | The single suggested next activity — references a Concept and/or Content Item / Pathway step that actually exists and is available. LEXI's mission is "one recommended action" (Ch.1 Constitution §3), so this is singular; a multi-step plan would be a *different* artifact for a later chapter, not this one. |
| **Intent** | The single immediate learning purpose the Action serves — e.g. learn, practice, review, or assess. **Exactly one per Recommendation**: a single artifact never simultaneously teaches, assesses, and motivates (advertising/telemetry are excluded upstream, §3.2). The intent *taxonomy* is left open (an implementation / §3.5 choice); the *cardinality of one* is the fixed constraint — it keeps a Recommendation single-purpose, consistent with 5.1/5.9 (every action exists for the learner's own learning). A Recommendation declares exactly one learning intent; multi-step strategies or plans are represented as **sequences of Recommendations**, never as a single Recommendation carrying multiple concurrent intents — the same discipline that keeps `Action` singular (above), so a "Plan" artifact is never smuggled in through this field either. |
| **Rationale** | The "why" — a reference to the Understanding (+ Goal) it derived from, never a restatement of that belief's content (prescriptive-not-descriptive, above). The mission is "what next, *and why*" (Constitution §3); a rationale that cannot be traced to belief violates 5.2. |
| **Firmness** | How strongly the recommendation is offered — bounded above by the belief-confidence of its basis (5.10). Low firmness must be presentable as more optional and reversible. Representation open, exactly like belief-confidence. |
| **Basis** | The Understanding projection(s) + Goal(s) this was computed from — the inspectable provenance handle (5.2/5.8). Plural Goal is deliberate: a single Action may legitimately advance more than one active Goal at once (e.g. a Concept shared by two Pathways), and the Basis must cite every Goal it actually served (Invariant 2, §3.3), not force a choice of one. The Recommendation's analogue of Understanding's Evidence Basis. |
| **As-of** | The moment, and the Understanding version, it was generated against — because it is ephemeral and belief is time-relative. |
| **Procedure** | The **Decision Procedure Identity** that produced this Recommendation — provenance, not an internal-state descriptor. It answers only *"which procedure produced this,"* never *"what did the procedure contain"*: a ruleset version, a planner revision, an RL checkpoint label, an LLM prompt-set identifier are all valid identities, and the contract is indifferent to which. Exists so Recommendations produced by different procedures are never silently compared as equivalent — the same discipline Understanding's Method Version (Ch.2 §2.3) applies to belief, one layer up. Format is open (§3.5); that the identity exists and changes whenever the producing procedure meaningfully does is not. |

*Guideline for Rationale (editorial, not an invariant):* it explains why **this Recommendation**
was generated, never who the learner is. *"Practice fractions — recent evidence shows denominator
comparison is still unstable"* is a Rationale. *"Learner is at 63% fraction mastery"* is a restated
Understanding, not a Rationale, and belongs in the Basis pointer, not in prose.

### Invariants (properties of the artifact, not commands to any consumer)
1. **Non-binding by construction.** A Recommendation carries no authority to foreclose
   alternatives; it is a suggestion, never an instruction (Constitution 5.4). (Whichever surface
   ultimately renders it — learner UI, dashboard, or otherwise — inherits a duty from 5.4 directly
   to keep alternatives reachable; this invariant only guarantees the *artifact itself* asserts no
   foreclosure, independent of which surface that turns out to be.)
2. **Traceable to belief.** Every Recommendation carries a Basis naming the Understanding +
   Goal(s) it derived from; one that cannot is invalid output (5.2/5.8). *(The matching producer
   rule —
   the policy consumes Understanding rather than re-deriving capability from Evidence — is a
   policy invariant for §3.3, not an artifact property. Note the layering subtlety: what was an
   illegal thing for Ch.2 to assert about Ch.3 — the withdrawn "Single Authority" — is perfectly
   legal for Ch.3 to assert about itself.)*
3. **Firmness never exceeds basis-confidence.** A recommendation drawn from low-confidence
   Understanding cannot present itself as a confident instruction (5.10).
4. **Grounded action.** The recommended Action references content/pathway that actually exists
   and is available; LEXI never recommends a resource it cannot provide (5.3).
5. **Issuance is Evidence.** Restates Ch.1 Invariant 12 as binding here: issuing a Recommendation
   logs an Evidence record, so the system can reason about repetition/fatigue and stay auditable.
6. **Ephemeral.** No Recommendation persists as a standing instruction; authority is never
   accrued by survival (Ch.1 §10).

*Editorial note, not a new invariant (restates Invariant 1 from a different angle because it will
matter for §3.2 onward): a Recommendation is **a proposal, not a command** — it is not an
obligation, an enforcement mechanism, a schedule, or an execution record. It is the Decision
Policy's current best suggestion, nothing more. This is what lets later concerns — learner
override, a teacher's own override, institutional policy, experimentation — be layered on without
ever having to change what a Recommendation *means*.*

*End of §3.1 — **DRAFT-APPROVED**.*

## 3.2 Decision Policy Scope & Closure

Mirroring Ch.2 §2.2: before any selection algorithm, the Decision Policy's **closure** — the
exhaustive, enumerated set of information sources that **may** influence a Recommendation. Nothing
outside this list may influence which Recommendation is produced.

**Available, not mandatory.** The list below is a ceiling, not a checklist — it says what a Policy
is *permitted* to depend on, never what every Policy *must* use. A deterministic Policy may ignore
randomness entirely; a new Learner may have no Recommendation History yet; a Learner may
(momentarily) hold no Active Goal. None of that is a closure violation — the violation would be
depending on something *not* on this list, not leaving something on it unused. §3.4 is where a
specific policy family declares which of these it actually draws on.

### The Closure — permitted information sources

- **Understanding** *(typically present; may be sparse for a new Learner)* — the relevant
  `(Learner × Concept)` and `(Learner × Activity-type)` projections (Ch.2 §2.3) for the Learner's
  active Pathway(s). The belief substrate; read via the contract, never re-derived from raw
  Evidence (that re-derivation is the Learning Engine's job alone, Ch.2 §2.1).
- **Recommendation History** *(may be empty — e.g. a Learner's first session)* — not general
  access to "the Evidence Log," but specifically past Recommendation issuance and the Learner's
  responses to them. (These are logged as Evidence per Ch.1 Invariant 12; the closure names the
  semantic target the Policy actually needs — recommendation history — rather than granting open
  Evidence access.) This is the one place the Policy may inspect the Evidence Log directly rather
  than through Understanding, and it is bounded by a single rule: **Evidence is readable only for
  information that is intentionally not represented in Understanding — never to recompute or
  recreate learner state.** Timestamps, repetition, and fatigue qualify; mastery, confidence,
  contradiction, or any re-derivation of belief from raw Evidence does not — that recomputation is
  the Learning Engine's job alone (Ch.2 §2.1), and doing it here would let Recommendation quietly
  bypass Understanding while staying technically inside the logged dataflow. This does not reopen
  "Single Authority" (Ch.2's withdrawn invariant) — reading Evidence for a narrow, orthogonal
  purpose was already established as legitimate during CI-2; this is that precedent applied with
  an explicit boundary.
- **Active Goal(s)** *(may be absent or plural — never assume exactly one)* — a Learner may hold
  more than one concurrently (Ch.1 §1, Design Stance 4), or momentarily none. The closure permits
  all currently-active Goals to be visible, without requiring any specific number. Which Goal a
  given Recommendation serves — and how competing Goals are weighed — is §3.4's problem, not this
  section's.
- **Pathway** *(present whenever an Active Goal is)* — the weighted, ordered, gated view over
  Concepts each active Goal draws on (Ch.1 §3.1), at a specific version (Pathways are revised,
  Ch.1 §7) — the version actually used
  belongs in the Recommendation's `As-of` (§3.1).
- **Content availability** *(always present — the closure's floor)* — which Content Items and
  Learning Activities are currently *active* and *verified* (Ch.1 Invariant 5, Constitution
  5.3/5.8) and therefore legal targets for `Action`. An unverified or retired item is not in the
  closure at all, not merely deprioritized.
- **`now`** *(always present)* — the reference point for scheduling and for reading how stale the
  Understanding being used already is (via its own `As-of`, Ch.2 §2.3).
- **Declared Decision Procedure** *(always present — execution context, not learner state)* — the
  identity of the procedure generating the Recommendation (§3.1 `Procedure`), exactly analogous to
  `now` and the randomness source below: part of the declared execution context every invocation
  carries, never part of what is inferred about the Learner. A ruleset version, a planner
  revision, an RL checkpoint label, a prompt-set identifier are all admissible — the closure is
  indifferent to which, only that *one* is always declared.
- **An explicit randomness source** *(optional — only if the Policy explores)* — permitted, never
  required. A deterministic Policy uses none of it; a Policy that explores must draw it from here,
  as a named, logged input, not from unlogged internal state (see below).

### Deliberately excluded

- **Decision Policy's own unlogged execution history.** The same discipline CI-1 established for
  the Learning Engine (Ch.2 §2.1, Constitutional Grounding) applies here by the chapter's own
  authority, not by upward constraint from Ch.2: the Policy holds no private memory across
  invocations that isn't part of this closure. If a past choice should matter, it must already be
  in the Evidence Log (it is, per Ch.1 Invariant 12) — the Policy consults that record, it does
  not carry its own separate one. This does **not** make the Policy's output deterministic —
  legitimate exploration/randomization is still permitted (Ch.2's Constitutional Grounding,
  CI-1: "the learner's trajectory is not reproducible") — it only means whatever randomness is
  used enters as an explicit, logged input, never as hidden internal state.
- **Other learners' Evidence, Understanding, or Goals.** Constitution 5.9 and Ch.1 Invariant 8
  (a Goal belongs to exactly one Learner) together forbid cross-learner signal in a single
  Learner's Recommendation — no "what worked for similar learners" without that being a separate,
  explicitly authorized mechanism this chapter does not currently define.
- **Non-learning optimization signal.** Inputs whose primary purpose is advertising, monetization,
  or engagement optimization are outside the Decision Policy closure. Constitution 5.1 (Learning
  over Engagement) and 5.9 ("never used to shape what any learner sees for a purpose other than
  their own learning") already forbid this at the product level; stating it here closes the door
  at the input level too, before any policy gets a chance to quietly optimize for it.
- **Free invention of an Action.** The Policy selects among existing, verified Concepts/Content/
  Pathway steps (§3.1 Invariant 4); it does not generate a new one outside that graph. This is a
  restriction on what may be *written*, listed here for symmetry with what may be *read*.
- **Experience-layer / companion presentation state.** How present the companion is, its tone, or
  its rendering surface (`LEXI_EXPERIENCE.md` — deferred, not yet written) has no bearing on
  *which* action is recommended —
  only on how an already-produced Recommendation is delivered. Firmness (§3.1) is bounded by
  belief-confidence, not by companion personality.

**If information is outside this closure, it cannot affect the Recommendation.** Not a
restatement of the list above — the guarantee the list exists to serve. This is what turns the
closure from documentation into an architectural constraint: any future input (a new signal, a
new integration, a new "just this once" exception) must be added here explicitly, in the open,
before it is allowed to touch policy — never absorbed silently at the algorithm layer (§3.4).

## 3.3 Policy Invariants

Symmetric to Ch.2 §2.4. These are the properties every Recommendation-producing Policy must
satisfy *regardless of algorithm* — the acceptance test for swapping one policy family for
another. The bar each must clear: **if the entire selection algorithm were replaced tomorrow — a
rule engine for a contextual bandit for an RL learner for an LLM planner — would this still have
to hold?** If not, it is not an invariant; it is generation semantics (§3.4). Deliberately few:
with the artifact (§3.1), the closure (§3.2), and the Constitution already carrying most of the
weight, what remains here is only what the *act of producing* a Recommendation owns — not a
restatement of what a valid Recommendation *is*, what the Policy may *read*, or what the product
must *be*.

**Artifact integrity**
1. **Only valid Recommendations, or none.** Every output conforms to the §3.1 contract. The Policy
   never emits a malformed, Basis-less, or partial Recommendation to fill a slot — producing
   *nothing* is a legal outcome; producing an invalid artifact is not.
2. **No claimed Basis that did not participate.** A Recommendation's Basis names only closure
   information that *actually took part* in producing it — never a plausible-looking provenance
   attached after selection. This is a **provenance** guarantee, deliberately *not* a claim about
   explanation quality or faithfulness (a separate, much larger problem): the point is that the
   Basis cannot cite what it did not use, not that it must fully explain the reasoning (5.2/5.8).

**Closure & temporal confinement** *(the CI-1 discipline, one layer up)*
3. **Every influence on the decision is declared.** Two invocations are indistinguishable iff
   every declared influence on the decision — the §3.2 closure *and* the Decision Procedure
   Identity (§3.1 `Procedure`) that produced it — is identical. The Policy keeps no *undeclared*
   state across invocations: a ruleset revision, updated weights, a checkpoint advance, a revised
   prompt are all legitimate ways a Policy evolves, but each must surface as a change in the
   declared Procedure identity, never as silent drift under an unchanged one. (This is what lets
   a continually-learning Policy — an RL agent, an online bandit — satisfy the same discipline a
   static rule engine does: "identical closure" was never meant to imply "the Policy itself never
   changes," only that *if* it changed, that change is declared, not hidden.) Anything else that
   must persist between invocations lives in the closure (as Recommendation History), never in
   private, undeclared Policy memory.
4. **Every non-deterministic influence is declared.** Any source of randomness that affects which
   Recommendation is produced must enter through the declared randomness source in the closure
   (§3.2) — randomness can never be hidden inside the Policy. The goal is that *randomness cannot
   be concealed*; auditability and reconstructability from Basis + the logged draw (§3.1 Invariant
   5) follow as a consequence, but the invariant is the non-hiding itself, not the audit. (Same
   move that kept a stochastic-issuance system replayable in Ch.2, applied to the act of
   recommending.)

**Constitutional constraint owned at the policy layer**
5. **Override stays effective and is recorded.** A Learner's override or ignore of a
   Recommendation always **remains effective** — the Policy may never make it ineffective — and is
   **recorded as Evidence** (Ch.1 §3.4, §10). What the Constitution locks is that the learner's
   "no" actually takes effect and is fed back, not that acting on it be frictionless (5.4). *(A
   confirmation step or an optional reason-prompt is a legitimate UX choice, so "friction = 0" is
   not the rule. Guideline, not invariant: responding to an override with escalation, pressure, or
   repeated re-issuance — "nagging" — is discouraged as contrary to 5.6, but that is guidance, not
   a hard constraint on the Policy.)*

**Reproducibility / evaluation frame**
6. **Evaluated against issue-time information.** A Recommendation's validity is evaluated against
   the information available at the moment it was issued — its issue-time closure. A later
   outcome — the Learner succeeded, failed, or ignored it — never retroactively validates or
   invalidates it. This fixes the temporal reference frame for judging the Policy: accountable for
   *the suggestion given what it knew*, not for the trajectory that followed (which, per CI-1, is
   not even reproducible) — structurally preventing the Policy from being tuned for compliance or
   outcome-hindsight rather than grounded suggestion.

*Six invariants — fewer than Ch.2 §2.4's fourteen, as expected once the artifact and closure were
locked; padding this list would mean restating the Constitution, the closure, or the algorithm.
The Board's proposed seventh — "every Recommendation declares exactly one learning intent" — is a
property of the artifact's **shape**, not of the producer's behavior, so it was placed as the
`Intent` field in §3.1 rather than duplicated here; adding it as a §3.3 invariant would have
restated the artifact, the exact thing this section is disciplined not to do. Every "how it
chooses" question — ranking, scoring, exploration strategy, arbitration among Goals — is deferred
to §3.4.*

## 3.4 Generation Semantics

Symmetric to Ch.2 §2.5–2.9: the *meaning* of the transformation `closure → Recommendation`, stated
as semantic questions every policy family must answer — never as an algorithm. "Rank candidates,
pick the highest score" is one family's answer; it is not written here, because a rule engine, a
search, a planner, a bandit, an RL learner, and an LLM reasoner must all be able to answer the same
questions in their own way.

### Purpose
The Decision Policy resolves one Learner's closure (§3.2) into **at most one** Recommendation —
never more (§3.1 `Action` is singular), never a guaranteed one (below). Everything in this section
describes what that resolution must mean, not how any particular family computes it.

### Decision Policy may decline to recommend

Stated first, because it governs how every constraint below is read: **the absence of a Recommendation
is a first-class semantic outcome, not an error condition.** A closure that supports no admissible,
compatible, single-intent, grounded Recommendation must produce *none* — not a low-confidence,
best-effort artifact manufactured to fill a slot. This was already legalized by §3.3 Invariant 1
("only valid Recommendations, or none"); this section states it as the Policy's affirmative right,
not merely a permitted edge case. It is the direct policy-layer expression of Constitution
5.2/5.10 — a system that never pretends to know what it doesn't — applied to the act of
recommending rather than to belief.

Legitimate grounds a Policy may decline on (illustrative, not exhaustive — the exact threshold for
each is §3.5): Understanding in the *ignorance* state for everything relevant (Ch.2 §2.7); no
action satisfies Admissibility or Compatibility (below); active Goals conflict beyond what the
Policy can resolve; or the Policy determines that no single Action legitimately serves the
Learner's current closure at all. **Declining to recommend is itself a successful completion of
Decision Policy, not a failure of execution** — it must be distinguished, in whatever way the
implementing system distinguishes any other outcome, from a crash, a timeout, or an unavailable
service. Whether that distinction needs its own observable signal downstream is an open question
for §3.5 — this section only fixes that declining is *correct* behavior, not that it must be
surfaced in some new way; inventing a marker for it here would add a second artifact, which this
chapter's own convention (one new artifact per chapter, §3.1) does not permit.

### Semantic constraints

Not a pipeline — a set of logical dependencies. The order below is expository, not an execution
order: a rule engine may check Admissibility before anything else; a search or planner may
interleave it with Resolution; an LLM planner may generate first and check Admissibility after.
All are valid readings of the same four predicates, because each is defined as a *constraint an
output must satisfy*, never as a *step a process must perform*.

1. **Admissibility** *(a predicate on candidate actions)* — an action is admissible iff it
   satisfies the structural constraints of the closure: it is a verified, active Content Item or
   Learning Activity (§3.2), with any Pathway-gating (`Requires`, Ch.1 §3.3) satisfied. A fact
   about the content graph, independent of what is believed about this particular Learner.
2. **Compatibility** *(a predicate relative to the learner-specific closure)* — an admissible
   action is compatible iff it remains relevant given the learner-specific information available
   within the declared closure (§3.2) — not "Understanding" alone: Understanding, active Goal(s),
   and Recommendation History together. (Deliberately not narrowed to Understanding, so this
   is never mistaken for "similarity between Action and Understanding" — Goal-relevance and
   repetition/fatigue are compatibility facts too, not scoring inputs bolted on afterward.) An
   admissible action a Learner has already mastered, or one that serves no active Goal, is
   admissible but not compatible.
3. **Resolution** *(a predicate on the outcome, not a tie-break)* — the admissible-and-compatible
   alternatives resolve into exactly one Recommendation, or into none. This covers every case, not
   only ties: zero candidates, one, many, conflicting Goals, and deliberate abstention are all
   legitimate inputs to the same question. Which method decides *which one*, when more than zero
   qualify, is exactly the diversity every algorithm family answers differently (highest-scoring,
   Pareto-optimal, sampled, satisficing, planned) — this section states only the required
   *outcome shape* (one or none), never the method.
4. **Composition** *(a predicate on the artifact)* — given a resolved Action (or none), every
   §3.1 field must be honestly populatable from what actually determined that resolution.
   `Intent`, `Rationale`, `Firmness`, `Basis`, `As-of` must each be derivable from it — if any
   field cannot be honestly populated (e.g. no Rationale traces to the Basis), the correct output
   is *none*, not a Recommendation with a weak field (§3.3 Invariants 1–2).

### Interactions between Goals

Ownership statement, not a mechanism: **Goal arbitration belongs to Decision Policy semantics** —
this chapter owns the question, without answering *how* here.

- **Multiple active Goals may jointly justify a single Recommendation.** A single Action can
  legitimately advance more than one active Goal at once (a Concept shared across Pathways) — a
  fact the world sometimes presents, not an outcome to avoid. The Basis (§3.1, revised above)
  cites every Goal actually served.
- Where Goals pull toward *different* actions, resolving that conflict is Resolution's question
  (§3.4 Semantic Constraints, item 3) — the arbitration rule itself (priority weighting, deadline
  proximity, round-robin, lexicographic ordering...) is a §3.5 choice, not fixed here.
- The one fixed constraint on that future choice: arbitration draws only on information already in
  the closure (each Goal's own Pathway weighting, deadline, sequence) — never on a priority
  invented outside it (e.g. "this Goal's learner engages more" is exactly the non-learning-
  optimization signal §3.2 already excludes).

### Declared non-determinism

Connects §3.2's optional randomness source and §3.3 Invariant 4 to *why* a Policy would ever use
one: the one legitimate semantic role for randomness is resolving **underdetermination** at
Resolution — not only a true tie, but any case where the admissible-and-compatible alternatives are
comparably supported with no closure-grounded reason to prefer one — never overriding a preference
the closure already supports. Exploration-for-its-own-sake (deliberately trying an uncertain action
to *learn* whether it works) is a legitimate *reason* a Policy family may build in, but it enters
as a declared, logged input
(§3.2, §3.3 Invariant 4) exactly like any other randomness — this section does not mandate that
any Policy explore, only that if one does, it does so declared.

### Boundary to §3.5

Left open, by design: the exact Admissibility/Compatibility filtering logic; the Resolution
method (scoring, search, sampling, planning...) and its tie-breaking/arbitration rule among
Goals; the `Intent` taxonomy (§3.1); the format and granularity of the Decision Procedure
Identity (§3.1 `Procedure`, §3.2); when and how much a Policy explores; the concrete threshold
for declining to recommend; whether a decline needs its own observable signal downstream; and the
time-based staleness threshold for a current Recommendation (§3.1 Lifecycle). Every one of these
is a legitimate place for policy families to differ — §3.1–§3.4 are written so that difference
never requires touching the artifact, the closure, or the invariants above it.

## 3.5 Open Decisions (deliberately unresolved)

Symmetric to Ch.2 §2.10. Each entry: the **Question** left open, the **Constraint** already
locked by §3.1–§3.4 that any answer must respect, and **Examples** — a family of valid answers,
never a recommendation among them.

**1. `Intent` taxonomy**
*Question:* What is the set of values `Intent` may take?
*Constraint:* Exactly one per Recommendation (§3.1); whatever taxonomy is chosen must stay stable
enough for Recommendation History (§3.2) to remain comparable over time — the same discipline
Ch.1 Invariant 2 applies to Concept identity, one layer up.
*Examples:* `{learn, practice, review, assess}`; a richer set adding `diagnose`/`remediate`; a
taxonomy that varies by Concept nature (Ch.1 §3.1).

**2. `Firmness` representation**
*Question:* What data shape carries "how strongly offered" — scalar, band, interval?
*Constraint:* Never exceeds the belief-confidence of its Basis (§3.1 Invariant 3); representation
is open by the same CI-2 discipline that left Understanding's Confidence open (Ch.2 §2.3) — the
information is fixed, the encoding is not.
*Examples:* a 0–1 scalar; a three-band categorical (tentative/suggested/strong); an encoding that
mirrors whatever representation Understanding's Confidence turns out to use.

**3. Admissibility / Compatibility filtering logic**
*Question:* What concrete rule decides structural admissibility, and learner-specific
compatibility, for a candidate action?
*Constraint:* Admissibility reads only content-graph facts; Compatibility reads only
learner-specific closure facts (§3.4) — an implementation must not conflate the two predicates
into one pass that quietly draws on both without distinguishing them.
*Examples:* hand-written eligibility rules; a learned relevance filter; retrieval over the
Pathway graph.

**4. Resolution method**
*Question:* Given admissible-and-compatible alternatives, how is exactly one (or none) chosen?
*Constraint:* Must satisfy §3.3 Invariants 1–4 (valid-or-none, truthful Basis, pure function of
closure, declared randomness); the artifact carries the outcome, never a ranked list (§3.1, §3.4).
*Examples:* a hand-tuned scoring rule; a contextual bandit; a search or planner; an LLM reasoning
over the admissible set.

**5. Goal arbitration rule**
*Question:* When active Goals pull toward different actions, which (if any) prevails?
*Constraint:* Draws only on closure-resident facts about each Goal — Pathway weighting, deadline,
sequence (§3.4) — never on a priority invented outside the closure, which §3.2 already excludes.
*Examples:* strict deadline-proximity ordering; a weighted combination of Pathway importance;
round-robin across Goals over successive Recommendations.

**6. Exploration strategy**
*Question:* When, and how much, does a Policy deliberately choose an uncertain action to learn
from the outcome?
*Constraint:* Legitimate only to resolve underdetermination or as a declared exploratory choice
(§3.4); randomness enters solely through the declared source (§3.2) and is logged (§3.3
Invariant 4) — never hidden inside the Policy.
*Examples:* pure exploitation (no exploration); epsilon-greedy; Thompson sampling over
Understanding's confidence.

**7. Decline threshold**
*Question:* Exactly how little evidence, or how much Goal conflict, is enough to trigger
declining rather than recommending?
*Constraint:* Declining is a legal outcome at any threshold (§3.3 Invariant 1, §3.4); the
threshold itself must be computed only from closure-resident information.
*Examples:* a fixed confidence floor; a relative comparison against the next-best alternative; a
learned abstention model.

**8. Observability of a decline**
*Question:* Does declining need a distinguishable signal beyond "no Recommendation was produced"?
*Constraint:* Cannot introduce a new artifact (one-new-artifact-per-chapter, §3.1); must never be
confusable with an operational failure (§3.4).
*Examples:* a log-level event with no learner-facing artifact; silence as the signal itself; a
diagnostic record kept outside the ontology entirely.

**9. Decision Procedure Identity — format and granularity**
*Question:* What shape does the identity take, and how fine-grained must a change be before it
must be reflected in a new identity?
*Constraint:* Must exist and be declared for every Recommendation (§3.1 `Procedure`, §3.2); must
change whenever the producing procedure meaningfully does (§3.3 Invariant 3) — silent drift under
an unchanged identity is not permitted, regardless of format.
*Examples:* a semantic-version string for a static ruleset; a checkpoint or episode counter for a
continually-learning agent; a prompt-set hash for an LLM-based Policy.

**10. Time-based staleness threshold**
*Question:* How long may a current Recommendation stand, with no supersession and no grounding
change, before it expires on elapsed time alone?
*Constraint:* Expiry-by-time is legitimate (§3.1 Lifecycle) but never mandatory at any specific
duration; retirement by this route carries the same historical-correctness guarantee as any other
(§3.1 Lifecycle) — a Recommendation that goes stale was still correctly issued when it was.
*Examples:* a fixed TTL (minutes to a session length); no time-based expiry at all (only
supersession/grounding retire it); a TTL that varies with `Intent` or Firmness.

**The acceptance test for whichever answers are chosen is §3.1–§3.4.** Any Decision Policy that
satisfies the contract, respects the closure, upholds every invariant in §3.3, and answers the
semantic constraints of §3.4 is valid — regardless of how it resolves the ten questions above.
The method is replaceable; the artifact, the closure, the invariants, and the semantics are not.

*End of Chapter 3 — §3.1–§3.5, **FROZEN**.*

---

## Chapter 3 Revision Log *(not part of the contract — institutional memory only)*

**§3.1 The Recommendation Contract.** Opened with identity/producer/consumer/lifecycle/fields/
invariants, mirroring Ch.2's Understanding contract. Two Board rulings reshaped it before
approval:
- **Consumer → Publication/Consumption/Retirement.** A single named "Consumer" (Experience layer)
  was replaced with a lifecycle framed around the artifact's own state, neutral to how many
  surfaces (learner UI, dashboards, API, analytics, notifications) ever read it. Only the
  *targeted Learner's own response* was kept as the one thing that becomes Evidence — a dashboard
  view or analytics read does not.
- **"Recommendation is prescriptive, not descriptive"** — adopted as the chapter's opening framing
  before the contract itself, to keep Recommendation from drifting into a second Understanding.
  `Rationale` was anchored to this explicitly: a pointer to belief, never a restatement of it.
- **`Intent`, single-valued, added as a field** (not a §3.3 invariant) after the Board proposed a
  "single learning intent" invariant and it was reclassified as artifact shape, not producer
  behavior — the same reasoning that had separately withdrawn Ch.2's "Single Authority."
- **Basis made plural-Goal** — a single Action may legitimately serve more than one active Goal at
  once; forcing a single citation would have been false provenance.

**§3.2 Scope & Closure.** Enumerated exhaustively, then twice tightened:
- **Evidence access narrowed to "orthogonal information only."** The Policy may read Recommendation
  History directly (bypassing Understanding) only for information Understanding intentionally
  doesn't carry — timestamps, repetition, fatigue — never to recompute mastery or confidence,
  closing a path that would have let Recommendation quietly re-derive belief in parallel to Ch.2.
- **"Commercial signal" reworded to "non-learning optimization signal"** — a semantic-level
  exclusion (Constitution 5.1/5.9), not an implementation-flavored one.
- **"Available, not mandatory."** The closure was reframed from an implied checklist to a
  permission ceiling — a deterministic Policy, a first-session Learner with no history, or a
  Learner with no active Goal are all legitimate closure states, not violations.
- **The outside-closure guarantee added:** "If information is outside this closure, it cannot
  affect the Recommendation" — turning the list from documentation into an architectural
  constraint on every future input.

**§3.3 Policy Invariants.** Six, tested against the *policy-family* standard (rule engine,
contextual bandit, RL, planner, LLM, theorem prover) and the *swap-tomorrow* standard. Four of the
original six were reworded for precision without changing intent: Basis-truthfulness narrowed to
pure provenance (not explanation quality); non-determinism reframed around *declaration* rather
than audit (audit is a consequence, not the invariant); override reframed around *effectiveness
and recording*, not "never nag" (a UX guideline, not a hard constraint); evaluation frame
reframed around the issue-time reference frame explicitly. A proposed seventh ("single intent")
was declined as belonging to §3.1, not §3.3 — the clearest single illustration of this chapter's
ownership discipline.

**§3.4 Generation Semantics.** Rebuilt once, mid-draft, from a "pipeline" framing to a "logical
constraints" framing after the Board flagged that sequential-stage language invites reading
Admissibility → Compatibility → Resolution → Composition as an execution order rather than four
independent predicates any policy family may satisfy in any order or interleaving. "Decline to
recommend" was elevated to a first-class, affirmative outcome (not a permitted edge case) and
placed first, ahead of the predicates it governs the reading of. "Genuine indeterminacy" was
sharpened to **underdetermination**, and Goal arbitration was stated as an ownership claim
("Decision Policy owns this question") rather than a mechanism.

**Coherence review (5 questions, baseline standard + future-proofness).** Two findings:
- **Q3:** `Goal` left singular in §3.1 Invariant 2 after the Basis field was made plural —
  editorial, fixed immediately.
- **Q5:** the closure and invariants implicitly assumed a static Policy, exactly the gap Ch.2 had
  already solved for itself via "Engine Version / Model State" and failed to propagate. First
  patched as **Policy Version/State**, then the Board rejected that framing as smuggling in a
  model-weights assumption — replaced with **Decision Procedure Identity**, a pure provenance
  identifier ("which procedure produced this," never "what did it contain"), added as a §3.1
  field, a §3.2 closure item, and folded into §3.3 Invariant 3, which was generalized from
  "identical closure ⇒ identical output" to "every declared influence on the decision is
  identical" — a strictly more general statement that makes continual learning, online bandits,
  and evolving rulesets legitimate by construction rather than by exception.

**Freeze review (7 checks).** Six passed clean on first pass. The seventh — **lifecycle
semantics** — surfaced a real gap: "Retired... once its moment passes" had no defined trigger.
Resolved in two Board-guided passes:
- First pass proposed explicit "supersession" and "grounding invalidation" as new triggers.
- Second pass generalized both: supersession restated as a property of **current** state ("at
  most one current Recommendation per Learner") rather than publish-order; grounding invalidation
  folded into a broader, deliberately-bounded third trigger — "no longer satisfies the contract
  required of a current Recommendation" — explicitly *not* triggered by every Understanding or
  Goal change, leaving recompute timing to Policy/Resolution. Closed with an explicit
  historical-correctness guarantee: retirement affects only current validity, never the fact that
  the Recommendation was correctly issued when it was (the same discipline as Ch.1's append-only
  Evidence and Ch.2's reconstructability, one layer up). Time-based staleness was left open,
  §3.5 item 10.

**Net result: zero amendments to any frozen document**, across the entire chapter — every
tightening (Q5, lifecycle) was absorbed as an addition to Ch.3's own artifact/closure/invariants,
never as a reach back into Ch.1 or Ch.2.

**Pattern across all three reshapings (Consumer→Lifecycle, Policy State→Procedure Identity,
execution-order→current-validity):** each was a move to a *higher* abstraction level, not an
added mechanism — the through-line the Board named as this chapter's central discipline.

---

# Chapter 4 — Communication Boundary

**Status: FROZEN — PASS, 2026-07-10, after the full freeze-gate sequence.** The architectural
questions were settled first, through the same Architecture Review Board discipline as Chapters
1–3: a sequence of necessity/independence tests (implementation-variability, removal, causality, a
minimality test on the chapter's own candidate concept, irreducibility-to-Constitution, open-world
lifting, and independence from Ch.2/Ch.3) run *before* any specification was written. This chapter
records only what those tests proved. §4.1–§4.5 are frozen; future *normative* changes go through
the same amendment discipline as Chapters 1–3 (editorial fixes do not). Chapter 4 changed **no**
frozen Ch.1–3 document — it is **additive, "Introduced after Baseline v1"**; the Baseline v1.0 tag
and its **zero amendment debt** are untouched.

Unlike Chapters 1–3, this chapter introduces **no new authoritative artifact** — a result that was
itself proven, not assumed (§4.1, editorial note). It is not, however, *artifact-free* in the sense
of having no abstraction at all: Chapters 1–3 are **artifact-centric** (each owns an object),
whereas this chapter is **relation-centric** — it owns a *relation* between a representation and the
artifact it re-expresses. That relation is a genuine architectural abstraction; it is deliberately
left **unnamed** (it needs no glossary entry — §4.1, editorial note), which is a different claim
from "absent." Both the absence of a new artifact and the presence of an unnamed relation-level
abstraction are load-bearing and are defended below.

## 4.1 Purpose

The Communication Boundary performs exactly one job:

> **It guarantees that when an authoritative artifact is re-expressed for a consumer outside
> the authoritative core, the artifact's semantic authority survives the crossing unchanged.**

It does not decide *what* to communicate, *when* to communicate, *whether* to communicate at
all, or *in what voice*. Every one of those is a choice, and every choice was shown (§4.5) to
be a later-phase capability, not a baseline necessity. This chapter owns only the **fidelity**
of the crossing, never its **content**.

### The gap this chapter closes

The authoritative dataflow closes at Chapter 3:

```
Evidence  →  Understanding  →  Recommendation
(fact)       (belief)          (prescriptive suggestion)
                                        │
                                        ▼   ← the authoritative loop is closed here
                              ┌─────────────────────┐
                              │ Communication Boundary │   fidelity only — adds no semantics
                              └─────────────────────┘
                                        │
                                        ▼
                                   Consumers
                    (learner UI, voice, API, dashboard, export,
                     accessibility narration, agent-to-agent, …)
```

Chapter 2 owns the honesty of Understanding *as an artifact*. Chapter 3 owns the honesty of
Recommendation *as an artifact*. But an artifact only reaches a learner after being re-expressed
for some consumer — as pixels, as speech, as a JSON field, as a narrated summary — and **no
frozen layer governs the honesty of that re-expression.** Constitution 5.10 ("how certain LEXI
*sounds* must never exceed how certain LEXI actually is") and Rule 11 constrain the *communicated
act*, which is a different object from the internal artifact: every internal artifact can be
perfectly honest while the thing that finally reaches the consumer misrepresents it (an honest
`Firmness = low` re-expressed as *"you've definitely got this"* violates 5.10 with every upstream
artifact still intact). That obligation — fidelity across the crossing — had no owner. This
chapter is that owner, and only that.

### Why Chapters 1–3 intentionally stop before this boundary

Each earlier chapter owns a semantic it *produces*: Chapter 2 produces belief, Chapter 3
produces a decision. This boundary produces no semantic — it only relays one. Folding relay-
fidelity into Chapter 2 or Chapter 3 would couple belief-production and decision-production to
presentation, which is exactly the coupling their own walls were built to forbid: Chapter 2's
closure excludes companion/presentation state; Chapter 3 is *"prescriptive, not descriptive"*
and its closure explicitly excludes *"Experience-layer / companion presentation state."* The
boundary is therefore correctly a layer of its own — its responsibility is best stated as a **lift**, not
as ownership: it does not *own* any semantic — it **lifts each artifact's authority, as defined by
that artifact's own chapter, across the boundary** (§4.3, F1). "Owning preservation" is a loose
gloss; the precise statement is that Ch.4 contributes a *transformation on obligations*, not an
obligation of its own. That difference in kind is *why* it introduces no artifact; see the
editorial note.

### Editorial note — a fidelity contract, not a structural one (local to this chapter; does not amend §0)

Chapters 1–3 each introduce one artifact carrying a **structural contract** — the fields the
artifact must have (Understanding's Estimate/Confidence/…; Recommendation's Action/Firmness/…).
This chapter's contract is of a different type: a **fidelity contract** — a *relationship* the
re-expression must preserve with its source, imposing nothing on the re-expression's own shape (a
voice utterance and a JSON blob share no shape, and must not be forced to). The logical subject
of that contract — *"any representation of an authoritative artifact crossing the boundary to a
consumer outside the core"* — is a **relation-level abstraction** the invariant ranges over, of the
same architectural kind as *Boundary*, *Projection*, *Serialization*, or *Invocation*: real
abstractions that carry no entity identity. It is **not** an entity in the ontology, and the
five-part test below is what established that — but that test answers only *"does this need entity
status or a name?"*, never *"does an abstraction exist?"* (using an entity test to decide the latter
is a category error). The abstraction exists; it simply needs no name: it has no identity, no
lifecycle, no contract beyond F1 itself, no demonstrated cross-chapter reference, and F1 stays
fully stateable without a name for it (the invariant text in §4.3 shows this) — so it earns **no
glossary entry and no named-concept status**, while remaining a genuine relation-level abstraction.
This is the same discipline that rejected `Communication`, `Delivery`, and `Interaction` as
candidate *artifacts*, held here to the narrower question of *naming*, never *existence*.

The §0 convention ("one new artifact per chapter") exists to catch **boundary-blur from minting
several artifacts**; introducing *none* does not engage that concern, so the convention is neither
violated nor amended here. Should a later chapter (Ch.6+) independently exhibit the same fidelity-
contract shape, generalizing the convention becomes worth considering then — never from this single
case.

## 4.2 The Boundary — what crosses, what does not

The invariant (§4.3) binds a representation **iff both conditions hold**:

- **(a) It re-expresses an authoritative artifact** — Evidence, Understanding, or Recommendation
  (Ch.1 §3). A representation carrying no such artifact carries no semantic authority to preserve.
- **(b) It crosses outward** — from the authoritative core to a consumer situated outside that
  core.

Both conditions are load-bearing; each excludes a class of things that would otherwise blur the
boundary:

- **UI chrome, navigation, layout, cosmetic state** — fail (a). They express no
  Evidence/Understanding/Recommendation, so the fidelity obligation is *vacuously* satisfied and
  they are simply not this chapter's concern. This is the wall that keeps the boundary from
  swallowing "all of UI."
- **Internal caches, intermediate computations, a cached Understanding** — fail (b). They do not
  cross to an external consumer; their correctness is Chapter 2's reconstructability guarantee,
  not this chapter's fidelity guarantee.
- **The learner's response** (accept / override / ignore / self-report) — is **inbound**, and is
  already owned: it becomes Evidence (Ch.1 Invariant 12, Ch.3 §3.1 Lifecycle) and re-enters the
  Learning Engine's closure. **This chapter is outbound-only.** It deliberately does not model
  the return path, which is what keeps it from becoming the "Interaction" god-layer (a
  two-directional, UI-swallowing abstraction that was considered and rejected during discovery).

### Consumer-neutral, medium-neutral

The boundary is indifferent to *who* consumes and *through what medium*. A learner's screen, a
teacher dashboard, a voice assistant, an XR surface, a REST/GraphQL response, a webhook, a batch
export, an accessibility narration, an agent-to-agent interface, and interfaces not yet invented
all cross the same boundary and inherit the same single obligation. "Outside the core" is defined
by the authority boundary, not by an organizational or human/machine one: an internal analytics
store or notification service that receives a re-expressed artifact is a consumer outside the
core and is bound identically. This neutrality is what makes the chapter future-proof — a new
interface requires *no edit here*; it need only demonstrate it satisfies §4.3.

## 4.3 The Fidelity Contract

One invariant. It is the whole normative content of the chapter.

> **F1 — Semantic-authority preservation (a *lifting* invariant).** For **any** authoritative
> artifact — those defined today (Evidence, Understanding, Recommendation) and any a later chapter
> introduces — whatever semantic authority that artifact possesses *by virtue of its defining
> chapter* must be preserved by any representation that crosses the boundary to a consumer outside
> the authoritative core. The representation may re-encode, translate, summarize, re-order, or
> re-style freely; it may **never** add authority the artifact does not carry, remove authority it
> does carry, or distort the relationship between the two.

F1 defines **no semantics of its own.** It is a *lifting* invariant — it transports each
artifact-level obligation across the communication boundary,

```
artifact-level obligation   ──lift──►   representation-level obligation
```

without ever needing to know what that obligation *says*. Chapter 2 defines that Conflict ≠
Ignorance; F1 does not restate it — it requires only that *if* an artifact draws a distinction, the
representation preserve it. Chapter 3 defines that a Recommendation is non-binding; F1 does not
redefine non-bindingness — it only forbids a representation from making it binding. This is the
chapter's real architectural contribution: not a new semantic, but a **transformation on
obligations** — and it is why F1 needs neither an enumeration of artifacts nor any knowledge of
their internals.

**Open-world (lifting) test — the property that keeps this chapter from coupling to Ch.2/Ch.3.**
If a later chapter introduces a new authoritative artifact (say Ch.5 adds `Assessment` with its
own authority), does Ch.4 need editing? **No.** F1 ranges over *any* authoritative artifact and
references *whatever authority its defining chapter grants* — so `Assessment`'s authority is lifted
across the boundary automatically, the moment Ch.5 defines it, with no edit here. Were the answer
"yes," F1 would be secretly encoding Ch.2/Ch.3 knowledge — a coupling. It is not: authority is
always defined by the chapter that owns the artifact; Ch.4 only preserves that authority when the
artifact leaves the authoritative core.

### What "preserve" means — the Preservation Criterion (PC)

F1's "preserve" is **strong lifting**, and it needs a criterion, not just a verb, or a later
reviewer cannot decide conformance. The criterion reuses the *recoverability* notion Chapter 2
already froze for CI-2 (§2.3), lifted to the boundary:

> **PC.** A representation preserves an artifact's authority **iff every normative distinction the
> artifact's defining chapter makes authoritative remains recoverable, from the representation
> itself, in a form appropriate to the consumer's medium.** Operationally: for any two artifact
> states the defining chapter treats as normatively different — calling for different consumer
> belief or action — the representation must not map them to the same recoverable content.

Two clarifications that close the obvious loopholes:

- **Recoverable *in the representation*, not necessarily foregrounded.** A consumer that receives
  the distinction and then ignores it is fine — Ch.4 is outbound-only and does not govern
  consumption. What PC forbids is *removing* the distinction from the payload. `{"mastery":
  "developing"}` fails PC (the Ignorance/Conflict distinction is gone); `{"mastery": "developing",
  "signal": "conflicting_evidence", "basis": …}` passes, even if a lazy client never reads
  `signal`.
- **Medium-relative, not wording-unique.** PC never mandates a specific phrasing. For a
  Recommendation with `Firmness = tentative`, *"maybe try this,"* *"one option is…,"* and *"you
  might consider…"* all preserve (a consumer recovers *tentative*); *"this is probably your best
  option"* fails (it lifts tentative into a firm band and imports a superlative-optimality claim
  the artifact never carried). The criterion is on the *distinction surviving*, never on the exact
  words.

This is what makes strong lifting decidable in review: enumerate the distinctions the defining
chapter marks authoritative (Ch.2: Ignorance vs Conflict vs Confident-low, belief vs fact,
certainty magnitude; Ch.3: binding vs non-binding, firmness bands, grounded vs not), then check
none is collapsed at the crossing.

The invariant is **relational**: it constrains the representation only relative to its source, and
imposes nothing on the representation's internal shape. The three cases below are **illustrations of
the lift, not an enumeration** — the domain is open (the Ch.5 test above). Each artifact's "semantic
authority" is defined by its own chapter; F1 forbids the crossing from altering it:

- **Understanding's authority** (Ch.2 §2.3): a confidence-qualified, evidence-traceable belief.
  Preserving it means the representation never sounds more or less certain than the belief, never
  strips its traceability, never converts belief into fact.
- **Recommendation's authority** (Ch.3 §3.1): a *prescriptive, non-binding, firmness-bounded,
  grounded* suggestion. Preserving it means the representation never presents it as a command,
  never inflates its firmness past its basis-confidence, never hides its non-bindingness.
- **Evidence's authority** (Ch.1 §3.2): an immutable fact, and — critically — *self-reported
  Evidence is Evidence, never Understanding* (Ch.1 Invariant 9). Preserving it means a
  representation never re-expresses a raw observation as a belief the Engine has not computed.

### Why F1 is irreducible to the Constitution (freeze-gating result)

F1 is **not** the conjunction of Constitution 5.2/5.3/5.8/5.9/5.10 restricted to the crossing — it
forbids what those clauses permit. The clauses are absolute, implementation-independent product
properties; they cannot reference Understanding's or Recommendation's *contracts*, which are
architectural constructs (Ch.2 §2.3, Ch.3 §3.1) the Constitution knows nothing about. F1 binds the
crossing to *that architecturally-defined authority*, which is strictly richer than any absolute
clause. The proof is a case where every relevant clause holds literally while F1 fails:

> Understanding U on concept X is in the **Conflict** state (Ch.2 §2.7): Estimate ≈ mid, Confidence
> low, Evidence Basis = 92 contradictory observations — an honest encoding whose Ignorance-vs-
> Conflict distinction is recoverable via Evidence Basis (CI-2, Ch.2 §2.3). A representation emits
> *"your grasp of X is still forming — keep practicing,"* faithfully reflecting mid-Estimate and
> low-Confidence but dropping Evidence Basis. Check each clause: **5.2** — the claim traces to an
> observed low-confidence estimate (✓); **5.3** — no ungrounded fact asserted (✓); **5.8** —
> nothing stated as settled fact (✓); **5.9** — data used only for the learner (✓); **5.10** — the
> message sounds *appropriately uncertain*, never over-certain (✓). Every clause is literally
> satisfied. Yet the re-expression has collapsed **Conflict** (the learner is *inconsistent*) into
> **Ignorance** (the learner *doesn't know yet*) — two states Ch.2 spent three review rounds keeping
> distinct, which call for different next actions. 5.10 does not bite: this is not a certainty-
> *magnitude* error (both states are "low confidence") but a certainty-*kind* error, which 5.10 does
> not address.

F1 forbids this — authority the artifact carried (the recoverable Conflict signal, part of
Understanding's Ch.2 contract) was removed at the crossing. No combination of constitutional
clauses forbids it, because the lost distinction is defined relative to a Ch.2 construct the
Constitution cannot name. F1 therefore carries architectural content irreducible to the
Constitution: **this is not a compliance chapter.** (The same shape recurs for Recommendation —
e.g. a re-expression preserving literal 5.4 wording while burying the alternative past reach
violates F1 via Ch.3 §3.1 Invariant 1, which 5.4 alone does not pin to the crossing.)

### Independence from Ch.2 and Ch.3 (freeze-gating result)

Irreducibility shows F1 *says* something the Constitution does not. Independence shows F1 *distinguishes*
implementations Chapters 2 and 3 cannot tell apart — the stronger property, and the one that makes Ch.4 a normative
layer rather than commentary. It quantifies over *implementations*, not clauses. (The chapter never *acts* — it defines a
predicate; a reviewer determines conformance, the same discipline by which Ch.2's Learning Engine
does not "accept" Evidence but defines a contract an implementation conforms to or not.)

> Two implementations, **A** and **B**, with **bit-identical internal artifacts** — every
> Understanding and Recommendation the same. **A** re-expresses them faithfully. **B**'s REST
> endpoint returns `{"mastery": "developing"}`, its voice says *"you're making progress,"* its
> dashboard shows 🟡 Developing — for an Understanding that is actually in the **Conflict** state
> (Estimate 0.52, low confidence, contradictory Evidence Basis). B tells no lie, over-claims no
> certainty, fabricates no fact.
>
> **Without Chapter 4, can A and B be told apart?** No. Chapter 2 governs Understanding *as an artifact* and
> explicitly disclaims rendering (§2.1, *"does not render anything"*); B's artifact is bit-identical
> to A's and conforms. Chapter 3's closure excludes *"Experience-layer / companion presentation
> state."* The Constitution does not bite (§ irreducibility, above). So A and B are
> **indistinguishable** to every layer beneath Ch.4 — both conform.

Chapter 4 is the **only** layer that separates them: B collapses Conflict into a developing-label,
failing PC, and is therefore **non-conformant under the Chapter 4 contract**, while A conforms. A
contract that distinguishes two implementations every prior layer holds identical is adding
normative power, by definition. **Independence: PASS.**

## 4.4 Corollaries

Not new invariants — **consequences** of F1 applied to a specific dimension of the artifacts, each
tracing to a Constitution clause that F1 makes enforceable at the boundary. They are listed
because they are the concrete failure modes F1 exists to prevent; deriving them here is what makes
F1 checkable in practice.

1. **Certainty is never inflated.** A representation must not present an artifact as more certain
   than it is — not in wording, not in visual or vocal emphasis, not by omission of a stated
   Firmness or Confidence. *(F1 on the confidence dimension; Constitution 5.10, Rule 11.)*
2. **Learner-state is never fabricated.** A representation must not introduce any claim about the
   learner — mastery, trend, habit, readiness — that is not derivable from the authoritative
   artifact it carries. *"You've mastered this," "you've improved since yesterday," "you often
   rush"* are legitimate only when a corresponding artifact asserts them. *(F1 on the
   claim-content dimension; Constitution 5.2, Rule 4.)*
3. **Uncertainty is never hidden.** When the artifact carries thin, conflicting, or absent
   evidence (Ch.2 §2.7 — Ignorance / Conflict / Confident-low), the representation must leave that
   epistemic situation recoverable by the consumer; it may not present a low-support belief as a
   settled one. This is CI-2's contract-level recoverability (Ch.2 §2.3) extended one step, so it
   survives the crossing rather than dying at it. *(F1 on the evidential-honesty dimension;
   Constitution 5.2, 5.10.)*
4. **Unsupported relations are never implied.** A representation must not imply a causal,
   prerequisite, or comparative relationship the artifact does not assert (e.g. framing two
   unrelated results as cause-and-effect, or manufacturing a peer comparison). *(F1 on the
   relational-claim dimension; Constitution 5.2, 5.3.)*
5. **Alternatives remain reachable.** A representation of a Recommendation must preserve its
   non-binding character — the alternative to any recommended action stays as reachable in the
   representation as the recommendation itself. *(F1 on Recommendation's non-bindingness, Ch.3
   §3.1 Invariant 1; Constitution 5.4, Rule 3.)*

Every corollary is a projection of the one invariant. If a sixth failure mode is identified later,
the test is whether it, too, is F1 applied to some dimension of an artifact — if so it is a
corollary, not a new invariant; if it cannot be derived from F1, that is the signal F1 is
incomplete, and *that* would be a discovery requiring review, not a routine addition.

## 4.5 Deferrals (proven to be later-phase, not baseline)

Each item below was a candidate for this chapter and was **removed by an explicit test**, not by
preference. Recording the test with each keeps a future reader from re-opening a closed question.

- **Communication Policy** — the authority that would decide *whether* to communicate, *with what
  intent* (inform / warn / celebrate / remind / …), and *with what framing*. Shown by the
  **implementation-variability test** to be genuinely policy-shaped (two constitutional
  implementations can, on the same closure, legitimately differ — celebrate vs. stay silent), and
  then by the **removal test** to be *not baseline-necessary*: a system of {Decision Policy +
  Learning Engine + faithful, deterministic re-expression bound by F1} violates no Constitution
  clause. A Communication Policy is therefore a later-phase capability layered *on top of* this
  boundary, never a precondition for it. When it is built, it consumes the same closure discipline
  as Chapter 3 (declared inputs only; non-learning-optimization signal excluded) — but that is its
  chapter to write, not this one.
- **Identity-bearing communication units** — a persistent, referenceable unit for "the specific
  thing that was communicated," such that a learner response could point at *which* communication
  it answered. Shown by the **causality test** to be unnecessary in the baseline: a learner's
  response to a Recommendation is bound by *reconstruction* ("at most one current Recommendation,"
  Ch.3 §3.1, replayed per Ch.1 §5), a response about an Explanation is bound by the Content Item's
  durable identity (Ch.1 §7), and both sit within a Learning Activity's grouping (Ch.1 §3.2). The
  need for a dedicated identity arises *only* when multiple concurrently-respondable, non-
  Recommendation, non-Content-Item communications coexist — which is exactly the situation a
  Communication Policy creates. The two deferrals therefore **arrive together**, in the same phase.
  Note that introducing such a unit would carry an ontology commitment then (either relaxing "Evidence
  is terminal," Ch.1 §7, or adding a node to the Ch.1 ontology) — a further reason it is correctly
  deferred until proven necessary rather than pre-committed here.

## Chapter Scope (frozen boundary)

This chapter defines **the obligation that a re-expression preserve its source's authority** — and
nothing else. It defines no artifact, no communicative intent, no scheduling, no companion, no
rendering technique, no surface taxonomy. It commits to *no* specific interface, medium, or
consumer. Those boundaries are what let the Communication Boundary share the lifespan of the
layers beneath it: any interface, present or future, is conforming exactly if every artifact it
carries across the boundary satisfies F1 (§4.3) and its corollaries (§4.4) — regardless of how it
renders.

## Chapter 4 Revision Log *(not part of the contract — institutional memory only)*

**The headline discovery is a new architectural pattern, not F1 or lifting.** Chapters 1–3 all
follow one shape — `authority → artifact → invariants`: each chapter *creates* a semantic and owns
an object (Ontology; Understanding; Recommendation). Chapter 4 is the first of a different kind — a
**relation layer**:

```
authority (defined in another chapter)
        ↓
     relation  (representation ── re-expresses ──► artifact)
        ↓
  lifted invariant  (F1: preserve that authority across the boundary)
```

It creates no authority, mints no artifact, extends no ontology, reinterprets no semantics. Its
entire contribution is to **preserve semantics as they cross a boundary** — a *transformation on
obligations*, not an obligation of its own. This is not an exception to the "one artifact per
chapter" convention (§0) so much as a second, legitimate *kind* of chapter, recorded here as an
observation (sample size 1); the convention is deliberately **not** amended on the strength of a
single case (see §4.1 editorial note). If a later chapter exhibits the same relation-layer shape,
generalizing the convention becomes worth considering then.

**How the specification was reached — the test chain (each step changed the answer):**
- **Implementation-variability** — established communicative intent *is* genuinely policy-shaped
  (two constitutional implementations legitimately differ on the same closure: celebrate vs. stay
  silent). A real capability, wrongly assumed at first to be baseline.
- **Removal** — established that policy is nonetheless *not* baseline-necessary: {Decision Policy +
  Learning Engine + faithful, deterministic re-expression} violates no Constitution clause. Only a
  fidelity obligation survives as baseline. This demoted Communication Policy to Phase 3.
- **Causality** — established that no identity-bearing communication unit is forced in the baseline
  (response binding is carried by "at most one current Recommendation" + Content-Item identity +
  Learning-Activity grouping, via reconstruction); the need arises only alongside the deferred
  policy, so the two deferrals **co-arrive** in Phase 3.
- **Concept-minimality** — established that the invariant's subject needs no *name/entity status*;
  it is a relation-level abstraction (like *Boundary*/*Projection*), deliberately unnamed. Corrected
  a category error: an entity test cannot decide whether an *abstraction* exists, only whether it
  needs entity status.
- **Irreducibility-to-Constitution** — established F1 is not a restatement of 5.2/5.3/5.8/5.9/5.10:
  the Conflict→Ignorance case satisfies every clause literally while violating F1, because F1 binds
  the crossing to *architecturally-defined* authority (Ch.2/Ch.3 constructs) the Constitution cannot
  name. Not a compliance chapter.
- **Open-world (lifting)** — restated F1 as a *lifting* invariant ranging over *any* authoritative
  artifact, so a future artifact (e.g. Ch.5 `Assessment`) requires no edit here.
- **Independence from Ch.2/Ch.3** — the freeze-gating test: two implementations with bit-identical
  internal artifacts are indistinguishable to every layer beneath Ch.4, yet Ch.4's contract
  distinguishes them (one collapses Conflict into a developing-label, failing PC). A contract that
  separates implementations all prior layers hold identical carries independent normative power.

**Editorial refinements adopted at sign-off (language discipline, no semantic change):**
- Ch.4 is described as *distinguishing* conformant from non-conformant implementations, never as
  *"rejecting"* one — the architecture defines a predicate; reviewers and conformance act. Mirrors
  Ch.2's stance that the Learning Engine defines a contract rather than "accepting" Evidence.
- "Owns preservation" replaced by "**lifts** each artifact's authority across the boundary" — Ch.4
  owns no semantic; it owns a transformation on obligations.

**Net result: zero amendments to any frozen document.** Chapter 4 sits strictly downstream of the
closed authoritative loop (Evidence → Understanding → Recommendation), reaches back into no earlier
chapter, and leaves the Baseline v1.0 tag and its zero amendment debt intact — the same track
record as the Ch.2 and Ch.3 reviews, one layer further out.
