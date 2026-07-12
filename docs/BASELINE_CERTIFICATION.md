# LEXI — Baseline v1 + Chapter 4: Internally Certified

> Not a specification. Not governance. Not a revision log. A certificate — what state the baseline
> closed in, what evidence backs that, and what's still open. Read this to know *where things
> stand*; read `DOCUMENT_HIERARCHY.md` to know *where the rules live*.

---

## Status: **Baseline v1 — Internally Certified**

Distinct from *Certified* (no external validation exists yet) and distinct from *under
development* (the design phase is closed — no new documents, no Ch.5 work, until a specific
trigger below fires).

| Item | Status |
|---|---|
| Product Constitution (`LEXI_FOUNDATION.md`) | ✅ FROZEN v1.1 |
| Ch.1 — Learning Domain Model (Ontology) | ✅ FROZEN |
| Ch.2 — Learning Engine | ✅ FROZEN |
| Ch.3 — Decision Policy | ✅ FROZEN |
| Ch.4 — Communication Boundary | ✅ FROZEN (additive, after Baseline v1) |
| Derived documents (`BASELINE_ARCHITECTURE`, `GLOSSARY`, `SYSTEM_INVARIANTS_MATRIX`, `DOCUMENT_HIERARCHY`, `HOW_INFORMATION_FLOWS`, `ADR-001`) | ✅ synced |
| Governance method (amendment classification, freeze process) | ✅ stable, exercised across 4 chapters with zero amendment debt |
| Architecture Retrospective (methodology handbook for Ch.5+) | ✅ complete (`ARCHITECTURE_RETROSPECTIVE.md`) |
| Editorial + consistency audit (terminology, cross-references, invariant numbering) | ✅ complete — 6 fixes applied 2026-07-10 |
| AI-assisted consistency review (3 independent LLM reviewers, full-context) | ✅ complete — see `ARCHITECTURE_RETROSPECTIVE.md` §6a for what this evidence is and isn't |
| Independent human onboarding audit (closed-book, `ONBOARDING_AUDIT_PACKAGE.md`) | ⏳ **pending — target of opportunity, not a blocking gate** |

---

## What "Internally Certified" means, precisely

Every check the project itself could run without an outside party has been run: freeze-gating
(necessity/removal/independence/irreducibility/open-world tests per chapter), a whole-baseline
editorial audit, a terminology/cross-reference consistency audit, and a full-context AI consistency
sweep that surfaced two credible candidate findings (B1, B2 — see below). What has **not** been run
is validation by someone who never participated in building it, reading closed-book, with no access
to answer keys — the one check the project cannot run on itself by construction.

**This is an evidence-level distinction, not an architectural one.** Nothing about Ch.1–4's
correctness depends on the human audit; what depends on it is confidence that the *documentation*,
specifically, transfers to a genuinely fresh reader. Baseline v1 + Ch.4 is not less *correct*
without it — it is less *externally confirmed as learnable*.

---

## The human onboarding audit: target, not blocker

**Decision (2026-07-10):** the human closed-book audit remains the goal, but is no longer a
condition that blocks Ch.5 discovery from opening. Holding the entire roadmap hostage to finding
"the right kind of stranger" risks a worse failure mode than proceeding with a known, stated gap —
projects that wait indefinitely for a perfect validation event often never close a baseline at all.

**Concrete path, not an indefinite postponement:** a specific opportunity already exists — a
collaborator joining the project (pedagogy/communications background, documented in
`docs/COLLABORATOR_ONBOARDING_NONTECHNICAL.md`) has not participated in any discovery session and
has not seen `ONBOARDING_AUDIT_PACKAGE.md`. Parts 3 (reconstruction) and 4 (boundary audit) require
careful reading, not technical depth, so this is a real, low-cost candidate for a genuine Level-A
run whenever they're available — this is the trigger to watch for, not an open-ended "someday."

**If that specific opportunity lapses,** a lower but still real tier is available and should not
be treated as beneath consideration: an independent expert review (an engineer or architect who
reads and discusses directly, not necessarily protocol-perfect closed-book), or, further out, a
public-documentation test once these docs have any external readers at all — real feedback from a
first confused reader is evidence too, just slower to arrive.

**Until then:** Ch.5-and-beyond discovery may open. Anything it produces should note, honestly,
that it is built on an internally- but not externally-certified baseline — the same way this file
does for Ch.1–4.

---

## Open items carried forward (not blockers, tracked)

- **B1** — Ch.1 Invariant 10 vs Invariant 12 (Recommendation issuance vs. Learning Activity origin)
  — disposition: future-proofing question, not a bug (`ARCHITECTURE_RETROSPECTIVE.md` §6a).
- **B2** — "authoritative core" (Ch.4) never formally defined — disposition: documentation
  completeness candidate, fix only if a real closed-book reader independently stumbles on it.
- **`docs/DISCOVERY_BACKLOG.md`** — five bare proof-obligation questions for whatever comes after
  Ch.4 (Assessment / Content / Identity / Data / a possible second relation layer). No design, no
  chapter pre-selected.

---

*Certified 2026-07-10. This file itself is derived — it records evidence, it does not create any.
If Ch.1–4 are ever amended, or the human audit eventually runs, this file is regenerated, not
silently edited to erase what the prior state was — the same discipline every other derived
document in this project follows.*
