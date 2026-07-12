# LEXI — Document Hierarchy

> The map of the maps. Which documents are **authoritative** (define rules) versus **derived**
> (only reflect them), in what order to read them, and what may be edited by whom. This file adds
> no product rules — it is pure governance wiring. If you read only one thing before touching the
> docs, read this.

---

## Two kinds of document

```
AUTHORITATIVE  (define semantics — frozen; change only by amendment)
───────────────────────────────────────────────────────────────────
   LEXI_FOUNDATION.md   — Product Constitution            (FROZEN v1.1)
        ↓ constrains
   LEXI_SYSTEM.md  Ch.1 — Learning Domain Model (Ontology) (FROZEN)
        ↓ feeds
   LEXI_SYSTEM.md  Ch.2 — Learning Engine                  (FROZEN)
        ↓ feeds
   LEXI_SYSTEM.md  Ch.3 — Decision Policy                  (FROZEN)
        ↓ crosses outbound to consumers
   LEXI_SYSTEM.md  Ch.4 — Communication Boundary           (FROZEN — additive, relation layer)

DERIVED  (reflect the above — regenerate on amendment; never define anything)
───────────────────────────────────────────────────────────────────
   HOW_INFORMATION_FLOWS.md      — the whole system in one picture (read FIRST, before the map)
   BASELINE_ARCHITECTURE.md      — the system map
   ADR-001-baseline-v1.md        — why the big decisions were made
   GLOSSARY.md                   — one definition per term (+ source ref)
   SYSTEM_INVARIANTS_MATRIX.md   — which rule is enforced where
   DOCUMENT_HIERARCHY.md         — this file
```

**The single governing rule:** *a derived document never introduces semantics.* If a derived
document and an authoritative one disagree, the authoritative one is right and the derived one has
a bug. Every rule about the product lives in exactly one authoritative place.

---

## A third layer — Engineering Governance

The two kinds above (authoritative / derived) both answer **what the system is**. A separate,
orthogonal document answers **how the system is developed**:

```
LEXI_FOUNDATION.md                — why LEXI exists          (Philosophy)
        ↓
LEXI_SYSTEM.md  (Ch.1–4)          — how LEXI is built        (Architecture & Ontology)
        ↓
LEXI_ENGINEERING_CONSTITUTION.md  — how we change LEXI       (Engineering Governance)
        ↓
Implementation                    — the code
```

**Authority ladder** — when two documents appear to conflict, the higher one wins:

| Document | Authority |
|---|---|
| `LEXI_FOUNDATION.md` | Philosophy — why LEXI exists, what it may never do |
| `LEXI_SYSTEM.md` (Ch.1–4) | Architecture & Ontology — what the system is |
| `LEXI_ENGINEERING_CONSTITUTION.md` | Engineering Governance — how the system is developed and changed |
| ADRs (`ADR-00x`) | Local design decisions |
| Implementation docs (`PROJECT_STATUS`, `README`, phase/milestone plans) | Explanatory only — never authoritative |

**No dependency cycle.** The Engineering Constitution *cites* the Baseline as the authority on
product semantics and never overrides a Baseline invariant (where they touch, the Baseline wins).
The Baseline does not depend on the Engineering Constitution. Authority flows **one way** —
Foundation → System → Engineering Constitution → Implementation — so adding this document introduces
no cycle. It is neither *authoritative* in the Baseline sense (it defines no product semantics) nor
*derived* (it is not a reflection of the Baseline); it is a distinct governance layer over
engineering practice.

---

## Reading order

- **New human, first time:** `HOW_INFORMATION_FLOWS.md` (5 minutes, the whole shape) →
  `BASELINE_ARCHITECTURE.md` → Constitution → Ch.1 → Ch.2 → Ch.3 → Ch.4. Reach for `GLOSSARY.md`
  for any unfamiliar term, `ADR-001` for any "but why?".
- **New engineer, before first PR:** `LEXI_FOUNDATION.md` → `LEXI_SYSTEM.md` (Ch.1–4) →
  `LEXI_ENGINEERING_CONSTITUTION.md` → the code. Foundation says *what LEXI believes*, System *how
  it is built*, the Engineering Constitution *how you are required to build and change it*.
- **New AI / agent picking up the work:** this file → `HOW_INFORMATION_FLOWS.md` →
  `BASELINE_ARCHITECTURE.md` → `SYSTEM_INVARIANTS_MATRIX.md` (to see what constrains what) → the
  relevant frozen chapter for the task at hand.
- **Answering "what does X mean?":** `GLOSSARY.md` → follow its source reference.
- **Answering "is this change allowed?":** `SYSTEM_INVARIANTS_MATRIX.md` (which cells it touches) →
  `BASELINE_ARCHITECTURE.md` §6 (governance method).

---

## What may be edited, and how

| Document type | Who edits | How |
|---|---|---|
| **Authoritative** (Constitution, Ch.1–3) | via governance only | Amendment process — classify the issue, close it by proof/authority/necessity test, amend *only if irreducible*. Editorial fixes (cross-refs, typos, wording) that do not change meaning need no review. See `BASELINE_ARCHITECTURE.md` §6. |
| **Derived** | maintainer, freely | Regenerate to match the authoritative source. A derived doc is *never* the reason for a change — it only records one after the fact. |
| **Engineering Governance** (`LEXI_ENGINEERING_CONSTITUTION.md`) | via its own meta-rule | Amended only when a principle is repeatedly falsified by practice, or the ontology changes — never to pass an implementation or close an audit. See the document's Part III. |

---

## On amendment — what updates, in order

When an authoritative document is amended:

1. **Amend** the authoritative chapter (with its Revision Log entry — reasoning preserved, reversals
   included).
2. **Re-freeze** it (new version tag if applicable).
3. **Regenerate the derived set** to reflect it: `BASELINE_ARCHITECTURE.md` (map, freeze map),
   `SYSTEM_INVARIANTS_MATRIX.md` (affected cells), `GLOSSARY.md` (affected terms). Add a new **ADR**
   (ADR-002+) if the amendment changes a recorded decision — never silently edit ADR-001.
4. **This file** changes only if a *document* is added, removed, or re-classified — not for
   ordinary rule amendments.

The reverse never happens: editing a derived document never triggers a change to an authoritative
one.

---

## Current status

| Document | Class | Status |
|---|---|---|
| `LEXI_FOUNDATION.md` (Constitution) | Authoritative | FROZEN v1.1 |
| `LEXI_SYSTEM.md` Ch.1 / Ch.2 / Ch.3 | Authoritative | FROZEN |
| `LEXI_SYSTEM.md` Ch.4 (Communication Boundary) | Authoritative | FROZEN — additive, after Baseline v1 |
| `HOW_INFORMATION_FLOWS.md` | Derived | Current — added 2026-07-10 |
| `BASELINE_ARCHITECTURE.md` | Derived | Baseline v1 — ACCEPTED |
| `ADR-001-baseline-v1.md` | Derived (immutable record) | Frozen with Baseline v1 |
| `GLOSSARY.md` | Derived | Tracks Baseline v1 |
| `SYSTEM_INVARIANTS_MATRIX.md` | Derived | Tracks Baseline v1 |
| `DOCUMENT_HIERARCHY.md` | Derived (this file) | Current |
| `LEXI_ENGINEERING_CONSTITUTION.md` | Engineering Governance | Current — added 2026-07-12 |

**Amendment debt: none.** The authoritative chain is closed and frozen; the derived set reflects it
exactly. **Ch.4 (Communication Boundary)** was added downstream of the closed loop without touching
any frozen Ch.1–3 document — additive, "Introduced after Baseline v1," debt still zero. This file
changed because a *document* (Ch.4) was added, per the rule above — not for a rule amendment.

**2026-07-10 — `HOW_INFORMATION_FLOWS.md` added.** A short, non-normative walkthrough of the
Evidence → Understanding → Recommendation → Communication Boundary loop, for a first-time reader.
Derived, narrates only what Ch.1–4 already define, introduces no rule. This file changed for the
same reason as the Ch.4 addition above — a document was added — not a rule amendment.

**2026-07-12 — `LEXI_ENGINEERING_CONSTITUTION.md` added.** A new **Engineering Governance** layer —
the third leg of the project's DNA (Foundation = *why*, System = *how built*, Engineering
Constitution = *how developed*). It defines no product semantics and is not derived from the
Baseline; it governs engineering practice and cites the Baseline as the authority on semantics, so
it introduces no dependency cycle (authority flows one way, Foundation → System → Engineering
Constitution → Implementation). This file changed because a *document* was added, per the rule
above — not a rule amendment; the authoritative chain and its zero amendment debt are untouched.
