# Architectural Discovery Method

> How architecture was *discovered* on this project — abstracted away from what was discovered.
> This document is about **process**, not about LEXI. It names the pipeline, the proof battery, the
> discipline, and the two relationships (question↔proof, proof↔architecture) that the Baseline v1 +
> Ch.4 + landscape-discovery work produced by practicing them before naming them.
>
> **Status: LIVING distillation — not frozen.** Every other distillation in this project
> (`ARCHITECTURE_RETROSPECTIVE.md`, `GLOSSARY.md`, `SYSTEM_INVARIANTS_MATRIX.md`) condenses *frozen*
> content. This one condenses a *still-evolving practice* — two of its heuristics were added in the
> session immediately before it was written. Expect it to change. Do not treat any part of it as a
> frozen rule.
>
> **Evidence label, tiered (not a flat "n=1"):**
> - The individual **proof tests** (removal, minimality, irreducibility, independence, open-world)
>   have each been exercised *multiple times within this one project* and are robust *as tests*.
> - The claim that they **compose into a repeatable process**, and the newest heuristics
>   (thin-questions, the relation-layer family), are **n=1** — one project.
> - The claim that this method is **general beyond this project** is **unproven**, and carries an
>   explicit promotion criterion (see §6). All evidence to date is from a single codebase's
>   architecture. Treat the method as a hypothesis about method, not a validated law.
>
> **Boundary vs. `ARCHITECTURE_RETROSPECTIVE.md`:** the retrospective holds the *worked examples and
> the evidence* ("what this project's Ch.1–4 discovery taught us," project-specific, past tense).
> This document holds the *abstracted process* (project-agnostic, forward-looking). When the two
> overlap, examples live there and are cross-referenced from here — never duplicated, or the two
> will drift.

---

## 0. Why this document exists (and why now)

The project's own discipline is **discover → distill → freeze**, never
discover → discover → discover. That discipline was applied to every unit of architecture; it had
not yet been applied to the *act of discovering* itself. After Baseline v1, Ch.4, and a landscape
discovery, enough method had accumulated — and the causal chain of *why each tool exists* was still
intact — that distilling it became higher-value than opening the next candidate. Written now
specifically because in three more chapters the newer heuristics would be indistinguishable from
older ones and the causal chain would be lost.

A mirror-risk is acknowledged: polishing method can become an excuse not to use it
(distill → distill → polish). This pass is time-boxed. **The method exists to serve discovery, not
to replace it.** After it, return to the open frontier.

---

## 1. The pipeline

Discovery, as actually practiced, runs roughly in this order. It is a set of gates, not a waterfall
— later gates routinely send you back to earlier ones.

```
 candidate arises  (a gap, a roadmap item, a domain word)
        │
        ▼
 THIN THE QUESTION        strip embedded assumptions until the question describes a
        │                 phenomenon and admits a falsifiable test  (§2)
        ▼
 PROOF BATTERY            removal → minimality → irreducibility → independence → open-world  (§3)
        │                 (necessity first; classify family only after necessity survives)
        ▼
 DISPOSITION             one of: eliminated · deferred-no-necessity · amendment ·
        │                 new chapter (semantic | relational) · stays-open-like-an-algorithm  (§4)
        ▼
 DISTILL                 record the result; if it revealed a new pattern, govern it (§5–6)
```

Two properties of the pipeline matter as much as its steps:

- **"No new chapter" is a complete, successful outcome.** Three of four landscape candidates
  ended there. Discovery that proves nothing needs adding is discovery that succeeded, not
  discovery that stalled.
- **Necessity precedes naming, and naming precedes family.** The order is deliberate: a candidate
  is carried as `Candidate X` until necessity is proven, is given a name only when the name is
  forced by what survived, and is classified (semantic vs relational) only last. Reversing any of
  these lets a word decide an architecture.

---

## 2. Thinning the question

A question is discovery-ready when it describes **only the phenomenon to be explained, with no
embedded assumption about the shape of its solution** — no name, no actor, no implementation, no
chapter, no family, no presupposed state.

**How to know it is thin enough — falsifiability is the measure, floor *and* ceiling.** A question
is thin enough exactly when it yields a *falsifiable instrument*, and no thinner. Too fat (carries
a solution-shape) → it forces circular arguments instead of a test. Too thin (pure "something is
unclear") → also yields no test. The correct thinness is the one that becomes *testable*. Thinness
is not measured by how few words remain.

**Mechanism — the part most easily lost.** Questions do not thin themselves, and they are not
thinned by fiat (deleting words to look clean). Each assumption is removed only when an
**adversarial challenge** — attacking the current formulation as a hostile reviewer, hunting
specifically for the hidden assumption — succeeds. Thinning is the *effect*; adversarial
assumption-hunting is the *cause*. A method that records only "make questions thinner" without the
mechanism degrades into "use fewer words," a dead version of itself.

**Circularity test (thinning applied to the answer side).** No justification for a candidate answer
may invoke the term being defined. "X is permitted because the thing is authoritative" is a
definitional loop. Every justification must ground in an *already-existing* invariant or governing
obligation. The discipline is identical to thinning the question: the thing being explained must
not appear in its own explanation — whether in the question or in the "why."

---

## 3. The proof battery

Necessity tests, in the order that catches the most for the least work. Each names what it catches
*and what it misses*, because using the wrong one is how prior rounds went in circles.

| Test | Asks | Catches | Misses |
|---|---|---|---|
| **Removal** | Does the system still hold if this is deleted? | Anything not baseline-necessary, however real the capability | Says nothing about *shape* if it survives |
| **Minimality (two-way)** | Can it fold into an existing thing? Does an existing thing break without it? | Redundant additions; also missing necessities | Local only — won't catch cross-layer coupling |
| **Irreducibility** | Does it say something the constitution/upstream doesn't already? | Restatements of existing rules | Can pass on a rule that says something new but *binds nothing* |
| **Independence** *(decisive)* | Does it distinguish two implementations every layer beneath it holds identical? | Whether the layer has real *normative power* vs. being commentary | Requires a concrete A/B construction to run at all |
| **Open-world** | If a future addition arrives, must this be edited? | Hidden coupling to today's enumerated set | — |

**Two ordering rules learned the hard way:**
- **Independence is strictly stronger than irreducibility.** Irreducibility shows a rule *says*
  something new; independence shows it *distinguishes implementations* nothing below it can tell
  apart. A layer can pass the first and fail the second — technically novel, but binding no choice.
  Run independence before declaring a layer real.
- **Family classification (semantic vs relational) comes *after* necessity, never before.** Arguing
  family while necessity is unsettled is the signal the question is still carrying a hidden
  assumption (§2). If you find yourself debating "is it semantic or relational?" and going in
  circles, stop — re-thin the question.

**The two families a surviving candidate can be** (this project found exactly these; a third is not
excluded):
- **Semantic (Type I):** owns a new authority + a new artifact, with its own contract, closure,
  invariants, lifecycle.
- **Relational (Type II):** owns *no* new authority or artifact — only a relation between existing
  authorities and a *lifting invariant* that preserves an already-defined obligation across a
  boundary. Recognizable because it stays thin, references authority defined elsewhere, and is
  open-world by construction.

---

## 4. Diagnostics that run alongside

Not gates — signals that reinterpret a stuck discovery.

- **Locality diagnostic.** If a candidate cannot be defined without reaching into an upstream
  layer's internals, or needs dense reconciliation logic against supposedly-closed semantics, the
  default hypothesis is **upstream drift**, not "this needs a bigger new layer." Check whether an
  earlier layer's authority has leaked before adding mechanism here to compensate. (A thin relation
  layer is *only* possible when the layers it mediates have absolute ownership discipline — thinness
  downstream is paid for by discipline upstream.)
- **Object → obligation shift.** Discovery repeatedly broke through by ceasing to model an *actor or
  object* and instead modeling the *obligation* it carries. When a discovery is stuck on "what is
  this thing," try "what must be true regardless of what does it."
- **State → permission shift** *(candidate, n=1).* A parallel move: when stuck on "what state does
  this transition produce," try "what does the system become *permitted to do* after it." Held as a
  hypothesis about method, not a confirmed diagnostic.

---

## 5. Disposition and distillation

Every discovery ends in exactly one disposition, and each is recorded, not just the additions:
**eliminated** (removal/independence disproved necessity), **deferred** (no demonstrated necessity
*yet* — distinct from disproven), **amendment** (a narrow change to a frozen document, via the
governance process), **new chapter** (semantic or relational), or **stays open** (a genuine
degree of freedom left undefined on purpose, the way an algorithm is left open behind a contract).

Then: **distill and stop.** Record the result and the reasoning trail (including reversals — the
reversals are the evidence the process worked, not noise to clean up). Do not roll straight into
the next discovery. `discover → distill → freeze`, never `discover → discover → discover`.

---

## 6. Governance of the method's own patterns

The method is subject to the same discipline it imposes on architecture.

- **Sample-size discipline.** A pattern observed once is an **observation with an explicit promotion
  criterion**, never a rule. This applies recursively — including to this entire document. Its
  promotion criterion: **it graduates from "this project's discovery method" to "an architecture
  discovery method" only when a second, independent project — ideally in a different domain
  (compiler, protocol, OS, curriculum, knowledge graph) — is discovered by the same process and the
  same tests catch the same classes of error.** Until then it wears its true label: a single
  project's practice, distilled early because the causal chain was fresh.
- **Promotion criteria are stated when the observation is recorded, not invented later** to justify
  a generalization already made.
- **Adversarial refinement is the engine, throughout.** Every tool in this document was produced by
  someone attacking a conclusion, not by someone proposing a framework. The method is not a
  checklist applied politely; it is a checklist that exists because each item was forced into being
  by a challenge that a prior formulation failed. Applying it without the adversarial stance
  produces the forms without the function.

---

## 7. The two relationships worth holding onto

Everything above reduces to two couplings:

- **Question ↔ Proof.** A question is thin enough *precisely when* it admits a falsifiable proof.
  The proof is not a separate later step; it is the test the correctly-thinned question earns. If no
  proof can be constructed, the question is not yet ready — it still hides an assumption.
- **Proof ↔ Architecture.** The architecture is the *residue* of the proof battery — what survives,
  and in the shape determined by *which* proofs it passes and how. Architecture here is never drawn
  first and justified after; it is read off the tests. This is why the method produces low amendment
  debt: a structure that exists only as the residue of necessity carries no surplus assumption that
  a later chapter must later remove.

---

*Living document. Compiled while the Baseline v1 + Ch.4 + landscape-discovery causal chain was still
intact, deliberately early. Worked examples and evidence: `ARCHITECTURE_RETROSPECTIVE.md`. The
frontier this method was paused in front of: `DISCOVERY_BACKLOG.md`.*
