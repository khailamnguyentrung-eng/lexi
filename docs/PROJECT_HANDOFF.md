# LEXI HANDOFF

> ## 📌 Session banner (2026-07-10) — read this before anything below
>
> A separate, long architecture-design track just completed and produced a **frozen product/system
> architecture baseline**, independent of the codebase-status notes in the rest of this file. If
> you are picking this project up in a new session and your task touches *product principles*,
> *learning model design*, *the decision/recommendation engine*, or *what any of the core entities
> mean*, **start there, not below**:
>
> **→ Read `docs/DOCUMENT_HIERARCHY.md` first.** It is the map of the maps: which docs are
> authoritative vs. derived, what order to read them, and what governance applies before editing
> any of them.
>
> **What was produced, in one line each:**
> - `docs/LEXI_FOUNDATION.md` — **Product Constitution v1.1**, FROZEN. Immutable principles (10
>   core principles, learning philosophy, AI philosophy, non-goals).
> - `docs/LEXI_SYSTEM.md` — **Chapters 1–3**, all FROZEN:
>   - **Ch.1 Learning Domain Model** — the ontology (Learner, Concept, Evidence, Understanding,
>     Recommendation, and 8 other entities; invariants; lifecycles).
>   - **Ch.2 Learning Engine** — how Evidence becomes Understanding (contract, closure, 14
>     invariants, inference semantics — no ML method chosen, by design).
>   - **Ch.3 Decision Policy** — how Understanding becomes a Recommendation (contract, closure, 6
>     invariants, generation semantics — no algorithm chosen, by design).
> - `docs/BASELINE_ARCHITECTURE.md` — the system map + **Architecture Baseline v1.0 — ACCEPTED**
>   tag (frozen 2026-07-10, amendment debt: 0).
> - `docs/ADR-001-baseline-v1.md`, `docs/GLOSSARY.md`, `docs/SYSTEM_INVARIANTS_MATRIX.md` — why /
>   what-means-what / which-rule-lives-where, all derived from the above.
>
> **Governance you must follow if touching any of the above:** these documents are FROZEN. Do not
> silently edit them. Classify any proposed change (semantic ambiguity / authority allocation /
> governance conflict / contradiction) and follow the amendment process in
> `docs/BASELINE_ARCHITECTURE.md` §6 — full method and precedent trail preserved in each chapter's
> own Revision Log. Purely editorial fixes (typos, cross-references) don't need that process.
>
> **What is explicitly NOT decided yet (next possible chapters, unstarted):** Experience/
> Interaction layer (`LEXI_EXPERIENCE.md`, referenced but not written), Data Architecture (incl.
> the actual learner-data erasure mechanism for Constitution §5.9), Content Architecture
> (knowledge-graph curation, Pending-KU governance), Identity/Account layer (learner account
> creation/auth/deletion — deliberately out of the learning ontology, see
> `docs/BASELINE_ARCHITECTURE.md` §9, Finding A).
>
> **Relationship to the rest of this file:** everything below this banner predates the
> architecture-design track above and describes the codebase/product-phase status as of
> 2026-06-28. It has not been reconciled against the new baseline yet — treat any conflict in
> favor of `docs/LEXI_FOUNDATION.md` / `docs/LEXI_SYSTEM.md`, and flag it rather than silently
> picking one side.
>
> ## Update (2026-07-14) — partial reconciliation
>
> Section 3 ("Current Status") and Section 11 ("Future Direction") below were **out of date, not
> just unreconciled** — they described Phase 2 as "DESIGNED / NOT IMPLEMENTED" and Phases 5–6 as
> "Research only" long after both shipped. Both sections have been corrected below to point at
> `docs/PROJECT_STATUS.md`, which is the single implementation-status log kept current each
> session — duplicating phase-by-phase status in two files is exactly how this drift happened.
> Everything else in this file (principles, frozen rules, stack, workflow) was checked and is still
> accurate; left as-is.
>
> Separately, a **Phase 3 conformance audit** (Sprint 1–2, 2026-07-12 onward) has been auditing
> existing surfaces against the Baseline referenced above. It found several real drifts between
> intended architecture and implementation (tracked in project memory, partially reconciled as of
> this update — see `docs/PROJECT_STATUS.md` Phase 8). This is separate from, and does not replace,
> the amendment process for the frozen documents themselves.

*Last updated: 2026-07-14 (partial — see banner above)*

## Purpose

This document is the single entry point for any new development session.

Read this first before:

* modifying code
* implementing features
* changing architecture
* making product decisions

Related documents:

1. `ARCHITECTURE.md`

   * Long-term technical reference
   * System structure
   * Database design
   * Application layers

2. `DECISION_LOG.md`

   * Architectural and product decisions
   * Reasons behind important choices

---

# 1. Project Identity

## What is LEXI?

LEXI is an AI-assisted English learning platform.

Current target:

Vietnamese grade-9 students preparing for grade-10 entrance exams.

Long-term vision:

LEXI is not only a practice app.

LEXI aims to become:

**Personal Learning Companion**

A system that understands:

* what the learner knows
* what the learner struggles with
* how the learner learns
* what action should happen next

Core belief:

LEXI does not win by answering faster than ChatGPT.

LEXI wins by understanding the learner better after every learning interaction.

---

# 2. Product Principles (Frozen)

## Principle 1

Learning intelligence first.

AI is not the product.

AI supports the learning system.

---

## Principle 2

Behavior > Self-report

Declared preference:

*

Observed behavior:

=

Actual learner profile

---

## Principle 3

AI supports thinking.

AI does not replace thinking.

Preferred learning flow:

Try

↓

Hint

↓

Guidance

↓

Explanation

↓

Solution

---

## Principle 4

Value First

User should experience value quickly.

Target:

90-second Value Rule

---

# 3. Current Status

**See `docs/PROJECT_STATUS.md` for current implementation status** (updated each session,
phase-by-phase, with test counts) — do not duplicate that maintenance here; the two docs drifted
out of sync once already (this section previously said Phase 2 was "DESIGNED / NOT IMPLEMENTED"
long after it shipped).

As of 2026-07-14: Phases 1–7 (Student Intelligence, Companion Intelligence, Content Intelligence,
Generation Pipeline, Learner Model Intelligence, LEXI Lens [since removed], LEXI Lens AI) are all
implemented. Phase 8 (Recommendation & Assistance Evidence Reconciliation) is complete on a feature
branch not yet merged to `main`. Architecture foundation is unchanged from what's described below.

---

# 4. Frozen Architecture Rules

## Rule 1

Keep:

Repository

↓

Pure Intelligence Engine

↓

Service

↓

UI

---

## Rule 2

No business logic inside UI.

Forbidden:

* mastery calculation in React
* recommendation logic in components
* scoring rules in frontend

---

## Rule 3

AI does not calculate learning truth.

AI must not decide:

* mastery
* student score
* learning state

AI role:

* explanation
* assistance
* communication

---

## Rule 4

No unnecessary schema changes.

Existing models must be proven insufficient before adding new ones.

---

# 5. Technical State

## Stack

Frontend:

* Next.js App Router
* React
* TypeScript

Backend:

* Next.js API Routes

Database:

* Prisma
* SQLite locally

Schema designed to be Postgres portable.

---

## AI Architecture

AI access goes through:

`lib/ai/providers`

Architecture:

AIProvider interface

↓

Providers:

* Gemini
* Claude
* Mock

No direct provider usage outside AI layer.

---

# 6. Current Implemented Features

Student side:

* Login
* Dashboard
* Practice quiz
* Error Notebook
* Progress tracking
* Profile
* Diagnostic test
* AI chat (Teacher Mode)

Admin:

* Content upload
* DOCX/PDF extraction
* AI normalization pipeline
* Validation
* Human review gate
* Question approval flow

---

# 7. Important Architectural Decisions

See:

`DECISION_LOG.md`

Current key decisions:

* AIProvider abstraction
* Three-layer intelligence architecture
* Business logic boundary
* AI does not calculate mastery
* SM-2 over FSRS for Phase 2
* Phase 2 additive approach
* Behavior over self-report

---

# 8. Current Blockers

## Gemini API

Status:

External blocker.

Not a code issue.

Current situation:

* Provider abstraction works.
* Gemini quota issue prevents real verification.

Do not block Phase 2 on Gemini.

Use:

* Mock provider
* Other provider when available

---

# 9. Development Workflow

Current workflow:

Product decision

↓

Architecture review

↓

Implementation plan

↓

Claude Code implementation

↓

Review

↓

Documentation update

Claude Code is implementer.

Architecture decisions require review before implementation.

---

# 10. Current Next Action

**Superseded — see `docs/PROJECT_STATUS.md` "Pending Milestones" for the current list.** As of
2026-07-14 that list is: M4.5 (Admin API endpoint), M3.5/M3.6 (ingestion/validation follow-ups),
RT-1 Runtime orchestration, RV-1 (Review/SM-2 Decision Policy reconciliation), and deciding whether
to push/PR the `reconciliation/lx1-lens-optionb-rt1` branch.

---

# 11. Future Direction

**Status update (2026-07-14): everything below in this section has since shipped**, per
`docs/PROJECT_STATUS.md`'s canonical phase numbering (which does not line up 1:1 with the numbers
below — this section predates that numbering). Content Intelligence → `PROJECT_STATUS.md` Phase 3.
Memory/Companion → Phase 5 (Learner Model Intelligence). LEXI Lens → Phase 6, **removed 2026-07-13**
per product decision (see `docs/PHASE6_LEXI_LENS_DESIGN_REVIEW.md`); its AI-assistance capability
(`lens-ai`, unrelated to the removed Lens surface) is Phase 7 and is implemented. "Local/Hybrid AI"
below never progressed past this research note. The original vision text is kept as-is below for
historical context, not as an open roadmap.

Future phases (as originally written):

## Phase 3

Content Intelligence Engine

User materials:

PDF
DOCX
Images

↓

Knowledge Map

↓

Question Generation

↓

Adaptive Practice

---

## Phase 4

LEXI Memory / Companion

StudentLearningProfile expands:

* Knowledge State
* Performance State
* Learning Behavior
* Learning Preference
* Problem Solving Style

---

## Phase 5

LEXI Lens

Research only.

---

## Phase 6

Local / Hybrid AI

Research only.

---

# Final Product Belief

LEXI should not become another AI chatbot.

LEXI should become a learning system that gets smarter about the learner every time they study.
