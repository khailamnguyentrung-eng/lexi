# ADR-001 — Baseline Architecture v1

> **Architecture Decision Record.** Records the *why* behind the large, load-bearing decisions of
> Baseline v1 — the reasoning that the frozen chapters encode but do not always foreground. This
> file adds no rules; each decision points to where it is normatively defined. When "what" and
> "why" seem to diverge, the frozen chapter defines the *what*; this record preserves the *why*.
>
> **Status:** ACCEPTED (Baseline Architecture v1). **Supersedes:** none. **Superseded by:** none.
> **Scope:** Constitution + `LEXI_SYSTEM.md` Chapters 1–3.

Each decision below follows: **Context → Decision → Why → Consequences → Alternatives rejected.**

---

## D1 — Domain is folded into Concept (no separate `Domain` entity)

- **Where:** Ch.1 §3.1, Invariant 1.
- **Context:** Early ontology drafts modeled `Domain` (English, Mathematics, Chess) as a distinct
  top-level entity above `Concept`.
- **Decision:** A Domain *is* a Concept with no parent via the `Composes` relationship — the root
  of a hierarchy, not a different kind of thing.
- **Why:** Domain granularity is a curatorial choice exactly as Concept granularity is; two
  entities solving the same problem doubles every rule (identity, ownership, lifecycle) for no
  gain. Belief roll-up to "overall Mathematics" then falls out for free via ordinary `Composes`
  propagation (Ch.2 §2.9) — no separate aggregation mechanism.
- **Consequences:** One fewer entity; subject-level Understanding is `(Learner × Concept)` applied
  to a root Concept, not a third grain. (A coherence-review attempt to reintroduce a
  `(Learner × Domain)` grain in Ch.2 §2.3 was caught and removed precisely because Domain had been
  merged away.)
- **Alternatives rejected:** Keeping `Domain` as an entity — rejected on the minimality test (an
  entity removable without loss must be removed).

---

## D2 — Understanding is the single authority for learner-capability belief

- **Where:** Ch.2 §2.1 (the Engine is the sole transformer of Evidence into belief); Ch.3 opening
  ("Recommendation is prescriptive, not descriptive") and §3.2 (Policy may read Evidence only for
  orthogonal information, "never to recompute or recreate learner state").
- **Context:** Once Decision Policy could read the Evidence Log directly (for recommendation
  history / fatigue), nothing structurally stopped it from re-deriving mastery in parallel to the
  Learning Engine — a "shadow Understanding."
- **Decision:** All belief about *what a learner knows* is computed in exactly one place — the
  Learning Engine, as Understanding. No other layer re-derives learner capability from Evidence; a
  Recommendation is *built from* Understanding (via its `Basis` pointer), never a second copy of it.
- **Why:** Two independent capability models drifting out of sync is the most corrosive failure a
  learning system can hide — each would cite "evidence" while disagreeing. A single authority keeps
  belief auditable (Constitution 5.2/5.8) and keeps the layers replaceable.
- **Consequences:** Decision Policy consumes Understanding through its contract, reading raw
  Evidence only for information Understanding *intentionally* omits (timestamps, repetition,
  fatigue).
- **Alternatives rejected:** An explicit Ch.2 invariant named "Single Authority" that *commanded*
  Decision Policy to consume only via Understanding — **withdrawn** as a layering violation (an
  upper layer dictating a lower one's behavior). The principle survives instead as each layer's
  *self-governance*: Ch.2 owns belief computation; Ch.3 declares itself prescriptive-not-descriptive
  and orthogonal-Evidence-only. Same guarantee, correct ownership.

---

## D3 — Recommendation is a proposal, never a command

- **Where:** Ch.3 opening editorial note; §3.1 Invariant 1 (non-binding by construction),
  §3.3 Invariant 5 (override stays effective); Constitution 5.4.
- **Context:** A recommendation engine can easily slide into an obligation engine — scheduling,
  enforcing, penalizing non-compliance.
- **Decision:** A Recommendation carries no authority to foreclose alternatives, impose an
  obligation, schedule, or enforce. It is the Decision Policy's current best *suggestion*, nothing
  more; the learner's override always remains effective and is recorded as Evidence.
- **Why:** Learner agency is a frozen constitutional principle (5.4). Compliance extracted by
  restriction does not survive a bad day; more practically, keeping Recommendation a pure proposal
  is what lets later concerns — learner override, teacher override, institutional policy,
  experimentation — be layered on *without changing what a Recommendation means*.
- **Consequences:** The lifecycle is "current / retired," never "enforced / fulfilled"; retirement
  affects only current validity, never the historical fact that the Recommendation was correctly
  issued.
- **Alternatives rejected:** Modeling recommendations as tasks/obligations with completion state —
  rejected as importing enforcement semantics the Constitution forbids.

---

## D4 — Contract before algorithm

- **Where:** `LEXI_SYSTEM.md` preamble (editorial convention 1); Ch.2 §2.3 before §2.5–2.9; Ch.3
  §3.1 before §3.4.
- **Context:** The intelligence layers are the parts most likely to change (Bayesian → Transformer;
  rule engine → bandit → planner).
- **Decision:** Each chapter defines its output artifact — the stable interface (Understanding
  contract; Recommendation contract) — *before* the computation that produces it.
- **Why:** If the interface is fixed first, the algorithm behind it can be replaced without
  breaking any consumer. This is the discipline that let both intelligence chapters keep their
  method entirely open (Ch.2 §2.10, Ch.3 §3.5) while still being precise about what they emit.
- **Consequences:** "How it computes" always lands in a later, clearly-separated section
  (Semantics) or in Open Decisions; provenance handles (Method Version, Procedure Identity) make
  cross-method comparison safe.
- **Alternatives rejected:** Describing the algorithm first and letting the artifact fall out of it
  — rejected because it couples every consumer to an implementation.

---

## D5 — One new artifact per chapter

- **Where:** `LEXI_SYSTEM.md` preamble (editorial convention 2).
- **Context:** Chapters that introduce several new nouns at once tend to blur layer boundaries.
- **Decision:** Each chapter introduces exactly one new artifact into the dataflow — Ch.2 →
  Understanding, Ch.3 → Recommendation. A chapter that starts minting several is an early warning
  the boundary has drifted.
- **Why:** It forces each new concept to justify its own layer and prevents "convenience" entities
  from accreting. It is what caught two real drifts: a "Plan" artifact nearly smuggled in through
  Recommendation's `Intent`/`Action` (kept singular; multi-step = a *sequence* of Recommendations),
  and a "decline marker" nearly added in §3.4 (kept as a non-artifact outcome).
- **Consequences:** New capabilities are expressed as fields, projections, or sequences of the
  existing artifact wherever possible, before a new artifact is even considered.
- **Alternatives rejected:** Adding artifacts freely as features demand — rejected as the fastest
  route to a blurred ontology.

---

## Related decisions recorded elsewhere (not repeated here)

- **Events vs State** (Evidence is append-only fact; Understanding/Recommendation are derived and
  disposable) — Ch.1 §5, Ch.2 §2.4.
- **Provenance handles enable layer replacement** (Method Version, Decision Procedure Identity) —
  Ch.2 §2.3, Ch.3 §3.1.
- **Abstraction-raising over mechanism-adding** — the through-line of every Ch.3 reshaping
  (Consumer→Lifecycle, Policy-State→Procedure-Identity, execution-order→current-validity); see the
  Ch.3 revision log.
- **Governance method** (4-issue taxonomy; amendment as last resort; editorial vs normative) —
  `BASELINE_ARCHITECTURE.md` §6.

---

*This ADR is frozen alongside Baseline v1. A future decision that changes any of D1–D5 gets its own
ADR (ADR-002+) that explicitly supersedes the relevant entry — never a silent edit here.*
