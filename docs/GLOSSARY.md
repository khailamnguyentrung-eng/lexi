# LEXI — Glossary

> The single place a term is defined once. Each entry is a **short definition plus a source
> reference** — the source is authoritative; this file only points to it. **No rules are stated
> here**; if a definition here ever seems to add or change a rule, the source document wins and
> this entry is wrong.
>
> **Status:** reference, tracks Baseline v1 (Constitution + Ch.1–3, FROZEN). **Update rule:**
> editorial — follow the source when a frozen document is amended.

Convention: *Source* cites the defining document and section. "Ch.N" = `LEXI_SYSTEM.md` chapter N;
"5.x" = Constitution principle in `LEXI_FOUNDATION.md`.

---

## Core dataflow terms

### Evidence
An atomic, immutable record of something that happened — an attempt, a self-report, an observed
behavior during a Learning Activity, or the issuance of a Recommendation. Never edited or deleted
(except learner erasure, 5.9); only ever *reinterpreted* by something computed from it. The only
source of truth about the past.
*Source: Ch.1 §3.2; append-only invariant Ch.1 §8 Inv 4.*

### Understanding
A derived, probabilistic, **confidence-qualified** belief about a Learner's capability, computed
from Evidence — never a stored fact, always recomputable. A *family* of projections at different
grains (per-Concept, per-Activity-type). The single authority for learner-capability belief (ADR-001
D2). It **describes** the learner.
*Source: Ch.1 §3.4 (definition); Ch.2 (how it is computed), esp. §2.3 (contract).*

### Recommendation
An ephemeral, single **proposal** of one next action, computed from Understanding + Goal(s) +
available Pathway/Content. It **prescribes** an action; it never describes learner state (contrast
Understanding). At most one is *current* per Learner. A proposal, never a command.
*Source: Ch.1 §3.4 (definition); Ch.3 §3.1 (contract); "prescriptive, not descriptive" Ch.3 opening.*

---

## Recommendation contract fields (Ch.3 §3.1)

### Action
The single suggested next activity — references an existing, available Concept / Content Item /
Pathway step. Singular (Constitution §3, "one recommended action"); a multi-step plan is a
*sequence* of Recommendations, not one artifact.
*Source: Ch.3 §3.1 Fields.*

### Intent
The single immediate learning purpose the Action serves (e.g. learn / practice / review / assess).
**Exactly one** per Recommendation; the taxonomy itself is open (Ch.3 §3.5). Keeps a Recommendation
single-purpose.
*Source: Ch.3 §3.1 Fields; taxonomy open — §3.5 item 1.*

### Rationale
The "why" — a *reference* to the Understanding (+ Goal) the Recommendation derived from, never a
restatement of that belief's content.
*Source: Ch.3 §3.1 Fields; guideline note below the Fields table.*

### Firmness
How strongly the Recommendation is offered — **bounded above by the belief-confidence of its
Basis** (5.10). Representation open (Ch.3 §3.5), exactly as Understanding's confidence is open.
*Source: Ch.3 §3.1 Fields + Invariant 3; representation open — §3.5 item 2.*

### Basis
The inspectable provenance handle: the Understanding projection(s) + Goal(s) the Recommendation was
computed from. Plural Goal is deliberate — one Action may serve several active Goals at once. The
Recommendation's analogue of Understanding's Evidence Basis.
*Source: Ch.3 §3.1 Fields + Invariant 2.*

### Procedure  *(Decision Procedure Identity)*
Provenance, not internal state: *which* decision procedure produced this Recommendation (a ruleset
version, a planner revision, an RL checkpoint label, a prompt-set id) — never *what the procedure
contained*. Exists so Recommendations from different procedures are never silently compared as
equivalent. The Ch.3 analogue of Understanding's Method Version.
*Source: Ch.3 §3.1 Fields, §3.2 (closure), §3.3 Invariant 3; format open — §3.5 item 9.*

### As-of
The moment, and the Understanding version, a Recommendation was generated against — because it is
ephemeral and belief is time-relative.
*Source: Ch.3 §3.1 Fields.*

---

## Goal and related nouns

### Goal
A specific aim belonging to **exactly one** Learner (an exam, a date, a subject pursued for its own
sake). Selects which Pathway(s) are relevant and supplies the time constraint. A Learner may hold
several concurrently, or none. Its state (→ achieved / abandoned) is the Learner's exclusively —
the system can *recommend* completion but never sets it (ADR-001 D3-adjacent; Baseline Finding B).
*Source: Ch.1 §3.1 (definition), §8 Inv 8 (one Learner), §9 (ownership), §10 (lifecycle).*

### Pathway
A purposeful, weighted, ordered, gated selection of Concepts toward a Goal — what a syllabus is.
*References* Concepts; never owns or defines them. Versioned (revised as new versions).
*Source: Ch.1 §3.1, §7 (identity), §8 Inv 7.*

### Concept
A discrete, independently masterable unit of demonstrable capability — not content, not a question.
The atomic noun the whole ontology serves. Its *nature* (declarative / procedural / strategic /
habitual) is a property, not a subtype. A Domain is just a Concept with no `Composes` parent.
*Source: Ch.1 §3.1; nature — §3.1; Domain merge — ADR-001 D1.*

### Learning Activity
A bounded, real occurrence of a learner engaging with something — may reference a Content Item, or
be a standalone real-world episode (a driving lesson, a live game) with none. May have more than
one Learner participant. Every Evidence record originates from exactly one.
*Source: Ch.1 §3.1, §8 Inv 10–11.*

### Content Item
Either a **Practice Item** (elicits Evidence) or an **Explanation** (changes understanding) —
disposable relative to the Concept it serves. Requires at least one Concept Attribution and one
grounding Source to be valid.
*Source: Ch.1 §3.1, §8 Inv 5.*

### Source
A body of material with provenance and authority (textbook, past paper, case script, learner
upload). Where "verified" gets its meaning for 5.3 / 5.8.
*Source: Ch.1 §3.1.*

### Evaluator
A persistent identity for whoever/whatever judged a piece of Evidence (an instructor, an automated
grader, an AI scorer at a version, the learner's own self-report). Durable identity so its
reliability can be assessed over time.
*Source: Ch.1 §3.1, §8 Inv 13; reliability as a projection — Ch.1 §6, computed in Ch.2.*

### Concept Attribution
The claim that a specific Content Item *or* Learning Activity teaches/tests a specific Concept — its
own claim with its own confidence and proposed/confirmed/rejected lifecycle (it can be wrong
independently of the thing it points to). Carries retroactive re-resolution when a Concept splits.
*Source: Ch.1 §3.3; re-resolution — Ch.2 §2.9, Invariant 12.*

### Learner
The person — one continuous identity, for life, across every domain and device. The *actor of the
learning process*; **not** a system account. Account creation / authentication / deletion are
deliberately outside the learning ontology (Baseline Finding A / Intentional scope boundary).
*Source: Ch.1 §3.1, §7; scope boundary — `BASELINE_ARCHITECTURE.md` §9.*

---

## Cross-cutting computed values (not artifacts)

### Method Version
Understanding's provenance handle: which Engine version/method produced a belief, so beliefs from
different methods are never silently compared.
*Source: Ch.2 §2.3, Invariant 9.*

### Evaluator Reliability
A confidence-qualified belief about how strictly/leniently a specific Evaluator grades, computed
from that Evaluator's Evidence history — a Projection like Understanding, scoped to Evaluator. Not
circularly derived from the belief it weights.
*Source: Ch.1 §6 (named); computation — Ch.2 (Invariant 13, anti-circularity).*

### Closure
The exhaustive, enumerated set of information a computation is *permitted* to read. Nothing outside
it may affect the output. Ch.2 has the Learning Engine closure; Ch.3 has the Decision Policy
closure.
*Source: Ch.2 §2.2; Ch.3 §3.2.*

---

## Communication Boundary terms (Ch.4)

### Communication Boundary
The outbound crossing from the closed authoritative loop (Evidence → Understanding → Recommendation)
to any consumer — learner UI, voice, API, dashboard, export, accessibility narration, agent, future
interface. A **relation layer**: it introduces no artifact and no new authority; it only preserves
the authority of the artifacts that cross it. Outbound-only (inbound learner responses are Ch.1 /
Ch.3). *Not* the whole Experience layer — Communication Policy and rendering are deferred (Phase 3).
*Source: Ch.4 (esp. §4.1–§4.2).*

### F1 — Semantic-authority preservation *(the fidelity / lifting invariant)*
The single invariant of Ch.4: any representation of an authoritative artifact crossing the boundary
must preserve the semantic authority that artifact's own defining chapter grants it — never adding,
removing, or distorting it. A **lifting invariant** (below): it defines no semantics of its own.
*Source: Ch.4 §4.3.*

### Preservation Criterion (PC)
What "preserve" means, decidably: a representation preserves an artifact's authority **iff every
normative distinction the artifact's defining chapter makes authoritative stays recoverable, from
the representation itself, in a form appropriate to the consumer's medium.** Reuses Ch.2's CI-2
recoverability notion, lifted to the crossing.
*Source: Ch.4 §4.3 (Preservation Criterion).*

### Lifting invariant
An invariant that transports each artifact-level obligation across a boundary (`artifact-level
obligation → representation-level obligation`) *without knowing what the obligation says* —
referencing whatever authority the owning chapter defines. Ranges over *any* authoritative artifact,
so new artifacts are covered with no edit. (The relation the invariant ranges over is a genuine
relation-level abstraction, deliberately **unnamed** — it earns no glossary entry, only F1 does.)
*Source: Ch.4 §4.3 (open-world / lifting).*

---

*If a term is missing here, it is defined in its source chapter and simply not yet mirrored — add
the mirror, never a competing definition.*
