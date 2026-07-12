# LEXI — Development Timeline

> The story of how LEXI's architecture was **discovered, validated, reconciled, and preserved** —
> and where it goes next.
>
> **How to read this.** Everything under *Completed* is anchored to a real artifact in this
> repository (a frozen document, a commit, or a tag) — it actually happened and can be verified.
> Everything under *In progress* and *Planned* is a goal, not a milestone reached. This document
> follows the same rule as the code it describes: **it describes reality, it never manufactures it**
> (Engineering Constitution, M7). Nothing aspirational is dressed up as done.

---

## The shape of the work

LEXI's architecture was not simply *designed*. It went through a research-style maturation:

```
   discovered  ─►  validated  ─►  reconciled  ─►  preserved  ─►  evolved
   (what must    (survives      (implementation   (in version    (product
    exist)        falsification) matches spec)      history)       development)
```

That distinction is the point. An architecture that is *invented* can be wrong quietly. An
architecture that is *discovered under falsification, validated against implementation, and frozen*
has earned the right to be built on.

---

## ✅ Completed

### Phase 1 — Foundation *(product constitution)*
**What:** Defined why LEXI exists and what it must never do — a technology-independent product
constitution (10 principles, learning philosophy, AI philosophy, non-goals).
**Anchor:** [`docs/LEXI_FOUNDATION.md`](LEXI_FOUNDATION.md) — **FROZEN v1.1**, 2026-07-08.

### Phase 2 — Architecture: Discovery & Validation
**What:** Discovered the core learning architecture as four chapters and froze them, then proved
the frontier was closed.
- **Ch.1 Ontology · Ch.2 Learning Engine · Ch.3 Decision Policy · Ch.4 Communication Boundary** —
  all **FROZEN**, tested across seven domains and five learner journeys.
- **Discovery closed:** the open question "is a Chapter 5 architecturally necessary?" was
  falsified — **no new chapter was forced**. Zero amendments to any frozen document across the
  entire review.
**Anchor:** [`docs/LEXI_SYSTEM.md`](LEXI_SYSTEM.md) (Ch.1–4), [`docs/BASELINE_ARCHITECTURE.md`](BASELINE_ARCHITECTURE.md),
[`docs/BASELINE_CERTIFICATION.md`](BASELINE_CERTIFICATION.md) — Baseline v1 frozen 2026-07-10.

### Phase 2.5 — Conformance, Reconciliation & Repository Stabilization
**What:** Audited the implementation against the frozen Baseline, fixed the divergences it found,
and gave the whole project a version history.
- **Conformance audit:** every implemented surface (analytics, recommendation, curriculum,
  diagnostic, import, chat, Lens) audited against Ch.1–4. Result: spine conformant everywhere,
  **two localized drifts** found (D1, D2) — both the same root cause (*absence encoded as a value*).
- **Reconciliation:** D1 and D2 fixed in code and **verified on the running product**; the Baseline
  was never amended to accommodate the code (Engineering Constitution, M6).
- **Engineering Constitution** established — how the team is required to build and change LEXI
  (E1–E8 invariant discipline, M1–M7 method discipline), each principle tied to the real event that
  earned it.
- **Repository governance:** documentation consolidated under `docs/` (living docs + `docs/archive/`
  for the historical record), authority hierarchy defined, branch renamed `master → main`, and the
  architecture corpus committed to history for the first time.
**Anchor:** [`docs/LEXI_ENGINEERING_CONSTITUTION.md`](LEXI_ENGINEERING_CONSTITUTION.md),
[`docs/DOCUMENT_HIERARCHY.md`](DOCUMENT_HIERARCHY.md), and tag **`architecture-v1`** — 2026-07-12.

> **`architecture-v1`** — *"First fully discovered, validated, reconciled and stabilized
> architecture."* The first official baseline of LEXI. From this tag onward, changes are **product
> evolution**, not architecture changes.

---

## → In progress

### Phase 3 — Product Evolution *(just beginning)*
Building product capability on the frozen, validated foundation — not redesigning it. Product
questions are actively being explored (what a Recommendation's issuance model is, how the primary
learner loop is bounded, and related decisions); each will pass through the Foundation's Decision
Framework before it is built.

**No product-layer conclusion in this phase is final or committed yet.** Exploration is happening
in more than one place at once, which is expected at this stage — but per the same discipline that
governs everything above, nothing here is stated as decided until it has actually been reconciled
and entered into history. This section will be filled in with specifics once that reconciliation
happens, not before.

---

## → Planned *(goals, not yet started)*

These are **aspirations on the roadmap**, listed to show direction — none has been built:

- **MVP** — a coherent end-to-end learner experience on the current architecture
- **Pilot** — real learners, real usage, real evidence
- **Research / write-up** — the discovery-and-conformance methodology is itself a potential
  contribution, once validated by outside readers

---

## At a glance

| Stage | Status | Evidence |
|---|---|---|
| Foundation | ✅ Frozen (v1.1) | `LEXI_FOUNDATION.md` |
| Architecture Ch.1–4 | ✅ Frozen | `LEXI_SYSTEM.md` |
| Discovery frontier | ✅ Closed (no Ch.5) | Baseline Certification |
| Conformance audit | ✅ Complete | audit record; 2 drifts found |
| Reconciliation (D1, D2) | ✅ Fixed & verified | implementation baseline commit |
| Engineering Constitution | ✅ Established | `LEXI_ENGINEERING_CONSTITUTION.md` |
| Repository governance | ✅ Standardized | `docs/`, `main`, `architecture-v1` |
| Product Evolution | → In progress | Phase 3 |
| MVP · Pilot · Research | → Planned | — |

*Last updated 2026-07-12, at tag `architecture-v1`.*
