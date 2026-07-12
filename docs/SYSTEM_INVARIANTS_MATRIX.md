# LEXI — System Invariants Matrix

> Traces each **Constitution principle** down through the frozen layers: which Ch.1 (Ontology),
> Ch.2 (Learning Engine), and Ch.3 (Decision Policy) invariant enforces it, and which **subsystem
> owns enforcement**. Its purpose is to make future contradictions *visible*: if a new subsystem
> or amendment touches a principle, this matrix shows every place already responsible for it.
>
> **This document states no new rules.** Every cell is a pointer to an existing frozen clause. A
> `—` means the layer deliberately does not touch that principle (an honest signal of ownership,
> not a gap). **Status:** reference, tracks Baseline v1.

Legend: `Ch1 §N Inv k` = `LEXI_SYSTEM.md` Chapter 1, section N, invariant k. `5.x` =
`LEXI_FOUNDATION.md` principle. Subsystem: **LE** = Learning Engine, **DP** = Decision Policy,
**CB** = Communication Boundary (Ch.4, FROZEN — the outbound crossing), **CA** = Content
Architecture (future), **DA** = Data Architecture (future), **EX** = rest of Experience
(Communication Policy / rendering, deferred Phase 3), **×-layer** = enforced across layers.

---

## Summary matrix

| Constitution principle | Ontology (Ch.1) | Learning Engine (Ch.2) | Decision Policy (Ch.3) | Owns enforcement |
|---|---|---|---|---|
| **5.1** Learning over Engagement | no engagement entity exists | — | §3.2 excludes non-learning-optimization signal from closure | DP + product |
| **5.2** Evidence over Guessing | §8 Inv 3 (Understanding reconstructable), Inv 9 (self-report ≠ Understanding) | Inv 1 (probabilistic), Inv 8 (traceability), Inv 2/§2.7 (epistemic sufficiency) | §3.1 Inv 2 (traceable to belief), `Basis` field | LE + DP + **CB** (Ch.4 F1 corollary 2: no fabricated learner-state at the crossing) |
| **5.3** Grounded over Generated | §8 Inv 5 (Content Item needs Source+Attribution); `Source` entity | Inv 10 (belief never exceeds evidence) | §3.1 Inv 4 (grounded action), §3.4 Admissibility | CA + DP |
| **5.4** Guidance over Command | `Recommendation` defn (ephemeral, non-binding), §10 lifecycle | — | §3.1 Inv 1 (non-binding), §3.3 Inv 5 (override effective); prescriptive-not-descriptive | DP + **CB** (Ch.4 F1 corollary 5: alternatives stay reachable at the crossing) |
| **5.5** Progress over Conversation | §8 Inv 12 (Rec issuance + response → Evidence) | Understanding updates on new Evidence | learner response → Evidence (loop closes) | ×-layer |
| **5.6** Calm over Pressure | — | — | §3.3 Inv 5 guideline (no nagging) | DP + EX |
| **5.7** Long-Term Retention over Short-Term Scores | Concept nature; decay allowance | §2.8 Decay (certainty over time) | Compatibility (fatigue/repetition); `Intent`=review | LE + DP |
| **5.8** Checkable over Convenient | Attribution review lifecycle; `Evaluator` identity | Inv 8 (traceability), CI-1 (auditability), Method Version | §3.1 Inv 2 (`Basis`), §3.3 Inv 4 (declared randomness), `Procedure` | ×-layer |
| **5.9** The Learner Owns Their Data | §8 Inv 4 (append-only + erasure exception), Inv 8 (Goal = one Learner) | §2.4 Reconstructability Scope (erasure reduces available Evidence) | §3.2 excludes other-learner data | DA + ×-layer |
| **5.10** Caution over Confidence | Design Stance 3 ("mastery is not a score") | Inv 1, §2.7/CI-2 (ignorance/conflict/confident-low), §2.8 decay | §3.1 Inv 3 (firmness ≤ basis-confidence), §3.4 decline | LE + DP + **CB** (Ch.4 F1 corollaries 1 & 3: certainty not inflated, uncertainty not hidden at the crossing) |

Constitution **Rules** and **derived theorems** map the same way:

| Rule / theorem | Ontology | Learning Engine | Decision Policy | Owns |
|---|---|---|---|---|
| **CI-1** Belief provenance (belief derives only from evidence, never execution) | Evidence defn; Inv 12 | Inv 11 (instantiates CI-1) | §3.3 Inv 3 (every influence declared) | ×-layer |
| **CI-2** Epistemic sufficiency (representation preserves policy-relevant distinctions) | — | §2.3 contract obligation, §2.7 | consumes it via Understanding contract | LE (contract) + **CB** (Ch.4 lifts CI-2 recoverability across the boundary via PC) |
| Rule 11 / honesty of confidence | Design Stance 3 | Inv 1, §2.7 | §3.1 Inv 3 (firmness ≤ basis) | LE + DP |
| Verification independent of generation | Attribution proposed/confirmed/rejected | (grounding) | §3.3 Inv 2 (Basis participated) | ×-layer |

---

## How to read a column of `—`

A principle that is `—` at a layer is owned *elsewhere*, and that ownership is the point:

- **5.1 / 5.6** are almost entirely Decision-Policy-and-Experience concerns: the ontology has no
  notion of engagement or pressure to begin with, which is *why* those principles cannot be
  violated at the data layer — there is nothing there to optimize for. (5.1 is additionally
  pre-empted at the input boundary: §3.2 keeps engagement signal out of the closure entirely.)
- **CI-2** is `—` at Ch.1 and Ch.3 because it is a producer obligation on the *Understanding
  contract* specifically (Ch.2); Ch.3 merely consumes what that contract exposes.
- **5.9** is `—`-heavy at Ch.2/Ch.3 in the *mechanism* sense — the erasure mechanism belongs to the
  future Data Architecture layer — while the *consequences* (append-only Evidence, reconstruct­
  ability-only-over-non-erased, no cross-learner signal) are already locked.

---

## The Communication Boundary (Ch.4) — enforcement by *lifting*

Ch.4 adds a **new enforcement mechanism**, not a new principle: it takes the honesty each layer
already guarantees for its *artifact* and requires it to survive the *crossing* to a consumer
(voice, API, dashboard, export, accessibility, agent, future interface — all the same). It is a
**lifting invariant** (F1): it references *whatever* authority an artifact's defining chapter grants
and forbids the re-expression from adding, removing, or distorting it, judged by the **Preservation
Criterion** (every normative distinction the artifact makes authoritative stays recoverable from the
representation). Because F1 ranges over *any* authoritative artifact, a future artifact (e.g. a
Ch.5 `Assessment`) is covered with **no edit here**.

Why this is genuinely new and not a restatement of the Constitution: an implementation can satisfy
5.2/5.3/5.8/5.9/5.10 *literally* while a re-expression still collapses, e.g., **Conflict** into
**Ignorance** (both "low confidence," so 5.10's magnitude test does not bite) — F1 forbids that
because Ch.2's contract makes the distinction authoritative. This is the row above's **CB** cells
made concrete; it is what makes Ch.4 a normative layer rather than commentary (Ch.4 §4.3,
Independence result). Ch.4 is **outbound-only**: inbound learner responses are owned by Ch.1
(Evidence) and Ch.3 (recommendation response), not here.

## The two enforcement patterns

Reading the matrix top to bottom, two recurring shapes explain most cells:

1. **Ground → derive → propose.** Most principles about honesty (5.2, 5.3, 5.8, 5.10) are enforced
   as a chain: the ontology fixes what "grounded/verified" *means*, the Learning Engine keeps
   belief *tied to and weaker-than* that grounding, and the Decision Policy keeps its proposal
   *traceable to and no more confident than* that belief. Each layer tightens the same rope one
   notch further from raw fact.

2. **Agency is terminal at the learner.** Principles about control (5.4, 5.5, 5.9, and Finding B's
   Goal-completion rule) all terminate at the Learner: the system may compute, believe, and
   propose, but the effective decision — follow, override, delete, mark a Goal done — is the
   Learner's. No downstream layer may reclaim that authority; every layer can only *inform* it.

---

## Using this matrix to catch a future contradiction

When a new subsystem, feature, or amendment is proposed, locate the principle(s) it touches and
check every non-`—` cell in that row. A proposal contradicts the baseline if it would:

- make a `—` cell **non-empty in a way that violates the "owned elsewhere" reason** (e.g. giving
  the ontology an engagement metric would break 5.1's structural guarantee);
- **weaken** an existing cell (e.g. letting Decision Policy issue a Recommendation more confident
  than its Basis breaks the 5.10 chain at Ch.3);
- introduce an influence that no cell accounts for (e.g. a cross-learner signal — 5.9 row shows
  §3.2 already excludes it, so the proposal must amend that exclusion in the open, not route around
  it).

If a proposal survives every non-`—` cell in every row it touches, it is consistent with the frozen
baseline. If it cannot, it is either a redesign or an amendment — resolved by the governance method
in `BASELINE_ARCHITECTURE.md` §6, never a silent edit.

---

*Frozen alongside Baseline v1. Regenerate whenever a frozen invariant is amended — this matrix
reflects the chapters, it never overrides them.*

**2026-07-10 — Editorial fix, consistency audit.** Ch.3 has two independently-numbered invariant
lists (§3.1 Recommendation Invariants, §3.3 Policy Invariants) — the same same-number collision
risk Ch.2 disambiguated for itself (`LEXI_SYSTEM.md` Ch.2 revision log). Several cells here cited a
bare "Inv N" that, by number alone, could mean either list; all are now prefixed §3.1/§3.3. One
citation (5.4 row) had also named the wrong list entirely ("§3.1 Inv 5" for override-effectiveness,
which is actually §3.3 Inv 5) — corrected. No cell's underlying meaning changed.
