# LEXI — Baseline Architecture v1

```
Architecture Baseline v1.0
Status: ACCEPTED
Frozen date: 2026-07-10

Includes
────────
✓ Product Constitution v1.1
✓ Chapter 1 — Learning Domain Model (Ontology)
✓ Chapter 2 — Learning Engine
✓ Chapter 3 — Decision Policy
✓ Architecture documents (Baseline map, ADR-001, Glossary,
  Invariants Matrix, Document Hierarchy)

Amendment debt: 0
```

> **Additive since Baseline v1.0:** **Ch.4 — Communication Boundary** is FROZEN (2026-07-10),
> *introduced after Baseline v1* — it changed no frozen Ch.1–3 document, so the v1.0 tag above and
> its zero amendment debt stand unchanged. It is a **relation layer**: it introduces no artifact,
> only a lifting invariant (F1) that preserves each artifact's authority as it crosses to a
> consumer. The rest of the Experience layer (Communication Policy, rendering) remains deferred to
> Phase 3.

This tag is the reference point for everything that comes after. Future work states its
relationship to it explicitly:
- **"Introduced after Baseline v1"** — a new subsystem or chapter, additive, no baseline change.
- **"Requires amendment to Baseline v1"** — touches a frozen clause; goes through the amendment
  process (`BASELINE_ARCHITECTURE.md` §6) before it may proceed.
- **"Compatible with Baseline v1"** — reviewed against this tag's contents and found to need
  neither of the above.

If Baseline v1 is ever amended, the tag becomes **v1.1** (or the next minor/major, per how large
the amendment is) with its own frozen date — v1.0 is never edited in place, only superseded.

> **Read this first.** This document is a **map**, not a source of truth. It introduces no new
> rules. Every rule lives in one of the four frozen documents below; this file only shows how they
> fit together, who owns what, and how information flows. Where this map and a frozen document ever
> disagree, the frozen document wins — and this map is the bug.
>
> **Status:** **Baseline Architecture v1 — ACCEPTED.** Descriptive overview of the accepted
> baseline (Constitution + Chapters 1–3, all FROZEN). Sign-off notes: Constitution, Ontology,
> Learning Engine, Decision Policy all *stable*; layering *clean*; dataflow *closed*; amendment
> debt *none*; deferred architecture *explicitly identified*. The strongest signal of the review:
> across the entire Ch.2 → Ch.3 process, **no finding ever forced a previously-frozen layer to be
> reopened.**
> **Owner:** whoever maintains the baseline. **Update rule:** editorial — regenerate this map
> whenever a frozen document is amended; it never drives a change, it only reflects one.

---

## 1. Purpose

LEXI turns what a learner *does* into what the system should *suggest they do next* — continuously,
grounded in evidence, without pretending to know more than it does. Four documents define that,
each answering exactly one kind of question:

| Document | Answers | One-line role |
|---|---|---|
| **Product Constitution** (`LEXI_FOUNDATION.md`) | *Why does LEXI exist, and what may it never do?* | Immutable principles |
| **Ch.1 — Learning Domain Model** | *What exists in the learning world?* | Ontology (vocabulary) |
| **Ch.2 — Learning Engine** | *What does the system believe about the learner?* | Evidence → Understanding |
| **Ch.3 — Decision Policy** | *Given belief, what does it suggest?* | Understanding → Recommendation |
| **Ch.4 — Communication Boundary** *(after Baseline v1)* | *When an artifact reaches a consumer, is its authority preserved?* | fidelity across the outbound boundary |

The three system chapters form one closed loop:

```
   Evidence  ─────►  Understanding  ─────►  Recommendation  ─────►  (learner's response)
      ▲                                                                      │
      └──────────────────────────────────────────────────────────────────────┘
                         the response is itself new Evidence
```

Every arrow has an independently-defined **contract**, **closure**, **invariants**, and
**semantics**. That independence is the point: any one layer's internals can be replaced without
touching the others, as long as the contract between them holds.

---

## 2. Layer diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRODUCT CONSTITUTION  — why / never   (LEXI_FOUNDATION.md, FROZEN)  │
│  10 principles · learning philosophy · AI philosophy · non-goals    │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ constrains everything below
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────┐        ┌──────────────────┐        ┌──────────────────┐
│  CH.1        │        │  CH.2            │        │  CH.3            │
│  Ontology    │───────►│  Learning Engine │───────►│  Decision Policy │
│  (what is)   │  feeds │  (what we think) │  feeds │  (what we suggest)│
└──────────────┘        └──────────────────┘        └──────────────────┘
   defines the            computes Understanding        computes Recommendation
   nouns everyone          from Evidence                 from Understanding
   else references
                                 │
                                 ▼  (below the baseline — not yet written)
                    ┌──────────────────────────────┐
                    │  Experience / Interaction     │  how it is presented
                    │  Data Architecture            │  how it is stored
                    │  Content Architecture         │  how the graph is built
                    │  Identity / Account           │  who a Learner is (see §9)
                    └──────────────────────────────┘
```

Since Baseline v1, the top slice of the "Experience / Interaction" box is filled by **Ch.4 —
Communication Boundary** (FROZEN): the outbound crossing from the closed authoritative loop to any
consumer, governed by one lifting invariant (F1). It creates no authority and no artifact; the
remainder of that box (Communication Policy, rendering) is still deferred.

**Direction of authority is strictly downward.** A lower layer may *cite* an upper one; it may
never redefine it. A layer may state invariants about *its own* artifact (self-governance); it may
never dictate a layer below it (the "upward constraint" error — see the withdrawn "Single
Authority", Ch.3 revision log).

---

## 3. Dataflow (the closed loop, in full)

```
 an Observation happens (a learner attempts, self-reports, or engages in a Learning Activity)
        │
        ▼
 EVIDENCE                     immutable fact          [Ch.1 §3.2]  — append-only, never edited
        │
        ▼
 UNDERSTANDING               derived belief           [Ch.2]       — pure function of the closure;
        │                    (confidence-qualified)                  recomputable, never stored fact
        ▼
 RECOMMENDATION              ephemeral suggestion     [Ch.3]       — at most one per learner is
        │                    (prescriptive)                          "current"; ≤ 1 or none
        ▼
 published to any conforming reader (learner UI, dashboard, API, analytics, notification)
        │
        ▼
 the TARGETED LEARNER's response (accept / override / ignore)
        │
        ▼
 EVIDENCE                    the response is a new immutable fact → loop closes
```

Two rules keep this honest, one at each computed step:
- **Understanding never re-enters as its own input** (Ch.2 CI-1): belief is a function of Evidence,
  never of the system's own past execution — a Recommendation influences future belief *only* once
  the learner's response to it has become Evidence.
- **Recommendation is prescriptive, not descriptive** (Ch.3): it proposes an action; it never
  restates learner state. It is *built from* Understanding (via its `Basis` pointer), never a
  second copy of it.

Only the **targeted learner's own response** becomes Evidence. A dashboard view, an analytics read,
or a notification delivery is a legitimate *consumption* but produces no Evidence.

The crossing itself — any artifact → any consumer — is governed by **Ch.4 (Communication
Boundary)**: its invariant F1 requires each artifact's semantic authority (as its own chapter
defines it) to survive the re-expression, in whatever medium. Ch.4 is *outbound-only*; the inbound
response above is already owned by Ch.1 (becomes Evidence) and Ch.3 (recommendation response).

---

## 4. Object ownership (audited)

Every durable object answers four questions. `—` means "no one, by design."

| Object | Created by | Read by | Modified by | Retired by |
|---|---|---|---|---|
| **Concept** | Curating authority, or AI as *pending* | everyone | Curating authority (splits/merges explicit) | deprecated (rare, forward-mapped) |
| **Concept Relationship** | as Concept | Engine, Policy | as Concept | as Concept |
| **Source** | Curating authority / a Learner | Engine, pipeline | contributor | superseded by new edition |
| **Content Item** | anyone / AI (Inv 5) | Policy (as `Action` target) | — (retired, never edited live) | superseded / withdrawn |
| **Concept Attribution** | proposer (often AI) | Engine | confirm/reject = curating authority | superseded |
| **Pathway** | Curating authority / a Learner | Policy | same party (new version) | same party |
| **Goal** | the **Learner, exclusively** | Policy (closure) | the Learner (incl. state → achieved/abandoned — see §9, Finding B) | the Learner |
| **Learning Activity** | auto, on engagement start | Engine | — | auto, on engagement end (never reopened) |
| **Evaluator** | registered on first use | Engine (reliability) | — | superseded; identity persists |
| **Evidence** | the Learner's own activity | Engine, Policy (history slice only) | **— (append-only)** | **— (except learner erasure, Constitution 5.9)** |
| **Understanding** | computed (Engine) | Policy, Experience | recomputed automatically | no lifecycle — recomputed |
| **Recommendation** | computed (Policy) | any conforming reader | — (ephemeral) | Consumed / Superseded / contract-violation (Ch.3 §3.1) |
| **Learner** | *outside baseline (§9, Finding A)* | everyone | the Learner (own profile) | *outside baseline — account deletion, Constitution 5.9* |

Reading the table: **the load-bearing asymmetry** is that curated nouns (Concept, Source, Pathway,
Evaluator) have carefully-managed identity, facts (Evidence) are immutable and terminal, and
computed values (Understanding, Recommendation) have no stored identity at all — they are
recomputed or reissued, never updated in place.

---

## 5. Dependency graph

```
Product Constitution
        │  (constrains all)
        ▼
Ch.1 Ontology ──────────────► Ch.2 Learning Engine ──────────► Ch.3 Decision Policy
        │                            │                                 │
        │                            │ consumes Understanding          │ consumes Understanding
        │ defines the nouns          │ (contract, Ch.2 §2.3)           │ + Goal + Pathway/Content
        │ all three reference        │                                 │ (closure, Ch.3 §2)
        ▼                            ▼                                 ▼
   frozen first               frozen second                     frozen third
```

- **No cycles.** Ch.3 depends on Ch.2 depends on Ch.1 depends on the Constitution. Nothing points
  back up.
- **The contract is the only coupling.** Ch.3 reads Understanding *through* Ch.2 §2.3's contract,
  never Ch.2's internals; Ch.2 reads the ontology's entities, never Ch.3's policy. Replace any
  layer's mechanism and the others are untouched.
- **Two provenance handles make cross-layer replacement safe:** Understanding's *Method Version*
  (Ch.2) and Recommendation's *Decision Procedure Identity* (Ch.3) ensure outputs computed by
  different methods are never silently compared as equivalent.

---

## 6. Amendment rules

*(Not new rules — the governance method that emerged across the Ch.2 and Ch.3 reviews, gathered in
one place. The authoritative statement of each lives in the relevant chapter's revision log.)*

**A frozen document changes only through a deliberate amendment**, never as a side effect of
implementation. Before proposing one, classify the issue — the four types close differently:

| Issue type | How it closes | Amendment? |
|---|---|---|
| **Semantic ambiguity** | Reduce competing readings to one by textual proof (not merely "a valid reading exists") | Only if irreducible |
| **Authority allocation** | Cite the delegation clause (e.g. Freeze Scope) — *after* semantics are settled, never to settle them | No |
| **Governance conflict** | Necessity test: amend *only if every valid implementation is forced to violate* the frozen text | Only if the test passes |
| **Contradiction** | Prove it; then minimal amendment or redesign | Yes, minimal |

Two standards worth restating:
- **Existence of *one* compatible reading defeats an amendment; existence of *multiple* compatible
  readings defeats a *freeze*** (ambiguity is itself a blocker, distinct from contradiction).
- **Editorial vs normative:** cross-reference fixes, wording, and typos that do not change meaning
  need no governance review. Anything that changes what a rule *means* does.

**Track record so far:** across the entire Ch.2 and Ch.3 review — including several points where an
amendment looked necessary (Ch.2 C3/C4, Ch.3 Q5) — **zero amendments to any frozen document were
required.** Every tightening was absorbed as an addition to the chapter then being written.

---

## 7. Freeze map

| Layer | Document / Chapter | Status | Scope |
|---|---|---|---|
| Constitution | `LEXI_FOUNDATION.md` Ch.1 | **FROZEN v1.1** | 10 principles, philosophy, non-goals, rules |
| Ontology | `LEXI_SYSTEM.md` Ch.1 | **FROZEN** | entities, relationships, invariants, lifecycles |
| Learning Engine | `LEXI_SYSTEM.md` Ch.2 | **FROZEN** | Understanding contract, closure, 14 invariants, semantics |
| Decision Policy | `LEXI_SYSTEM.md` Ch.3 | **FROZEN** | Recommendation contract, closure, 6 invariants, semantics |
| Communication Boundary | `LEXI_SYSTEM.md` Ch.4 | **FROZEN** *(after Baseline v1)* | F1 lifting invariant + Preservation Criterion; the outbound crossing to any consumer |
| Experience — Communication Policy & rendering | `LEXI_EXPERIENCE.md` | *deferred (Phase 3)* | what / when / whether to communicate; identity-bearing communication units |
| Data Architecture | — | *not started* | how it is stored (incl. Constitution 5.9 erasure mechanism) |
| Content Architecture | — | *not started* | how the concept graph is built/curated |

Each frozen chapter carries its own **Freeze Scope** (what it deliberately does *not* define) and a
**Revision Log** (the reasoning trail, kept in full — reversals included — as evidence the process
worked).

---

## 8. Editorial conventions (for chapters still to come)

Two document-wide disciplines, established during the baseline and stated in `LEXI_SYSTEM.md`'s
preamble:

1. **Contract before algorithm.** Each chapter defines its output artifact (the stable interface)
   before the computation that produces it.
2. **One new artifact per chapter.** Ch.2 introduced Understanding; Ch.3 introduced Recommendation.
   A chapter that starts minting several new artifacts is an early sign the layer boundary has
   blurred.

*Observed (not yet a rule — sample size 1):* Ch.4 introduced **no** artifact at all. It is a
**relation layer** — `authority (defined elsewhere) → relation → lifted invariant` — a second
legitimate *kind* of chapter alongside the artifact-centric one. The convention above is
deliberately **not** amended on a single case; if a later chapter repeats the shape, generalizing
it becomes worth considering (Ch.4 revision log).

> **Authoring guidance (non-normative, observed pattern — not a convention).** Chapters defining a
> new authoritative artifact are encouraged to explicitly identify which of its distinctions are
> *normative* (which states are meant to be told apart, not merely which fields exist). This is
> what let Chapter 4's Preservation Criterion review Ch.2/Ch.3's artifacts objectively. It is stated
> here as guidance, not promoted to a §0 convention, because it is derived from a single relation
> layer (Ch.4) — insufficient evidence that it is *required* for a semantic (Type I) chapter to be
> correct, only that it is *useful* to any future lifting invariant. **Promotion criterion:** if a
> second relation layer (e.g. a future chapter also built as `authority → relation → lifted
> invariant`) independently needs the same disclosure, that is two data points confirming a family
> requirement, not one chapter's convenience — at that point promoting this to a `LEXI_SYSTEM.md`
> §0 convention is warranted.

---

## 9. Known boundaries — what Baseline v1 deliberately does *not* cover

Named explicitly so no one mistakes an intentional boundary for an oversight. None of these blocks
the baseline; each is a conscious deferral surfaced by the end-to-end system review.

> **Intentional scope boundary.** The learning ontology begins with an *existing* Learner and does
> not define account creation, authentication, or deletion. Those concerns belong to future
> identity or platform architecture and are deliberately excluded from Baseline Architecture v1.

- **Finding A — `Learner` account lifecycle is outside the ontology.** Ch.1 gives Learner an
  identity ("one continuous identity, for life") but no create/retire ownership — because a
  `Learner` in the ontology is the *actor of the learning process*, while an account is an
  implementation concern: a **learning entity is not a system account**. Registration is an auth
  concern; deletion is a Constitution 5.9 concern realized by a future identity / data layer.
  **Board decision: scoped out, not amended** — adding a `Learner` create/retire row to Ch.1 would
  pull authentication, provisioning, and account-deletion vocabulary into an ontology that
  deliberately avoids them. Recorded here as a settled architectural decision, not an open
  question.
- **Finding B — the system never auto-completes a Goal.** Goal state (→ achieved / abandoned) is
  the Learner's exclusively (Ch.1 §9). When Evidence shows a Goal's target met, LEXI can *recommend*
  the Learner mark it complete, but cannot transition it itself. A deliberate consequence of
  learner agency (Constitution 5.4), not a gap.
- **Finding C — institutional / teacher *write*-authority is not modeled.** A teacher assigning
  work, or setting a Goal for a student, does not fit a Learner-exclusive Goal and would require
  *extending Ch.1* — the one extension that is not free (flagged as deferred in Ch.1 §11 and the
  Constitution revision log). **Read-only** teacher/parent/LMS dashboards, by contrast, are already
  free (a Recommendation is legible to any conforming reader).
- **Subject expansion beyond English exams** depends on Content Architecture (concept-graph
  curation, Pending-KU governance), not on any Baseline v1 change.
- **How anything is presented, stored, or rendered** — Experience, Data, and infrastructure layers,
  all still to come.

---

*End of map. If you are new to LEXI, read the Constitution next, then `LEXI_SYSTEM.md` Chapters 1–3
in order.*
