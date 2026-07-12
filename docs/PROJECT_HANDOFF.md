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

*Last updated: 2026-06-28*

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

## Phase 1

Status:

COMPLETE

Implemented:

* Readiness Intelligence
* Weakness Intelligence
* Error Notebook Intelligence
* Mastery Tracking
* Recommendation System

Architecture foundation:

Question

↓

QuestionAttempt

↓

ErrorNotebookEntry

↓

Repository Layer

↓

Pure Intelligence Engine

↓

Learning Services

↓

StudentLearningProfile

↓

UI

---

# Phase 2

Status:

DESIGNED

NOT IMPLEMENTED

Approved scope:

## Phase 2.1

SM-2 Retention Engine

Goal:

Convert Error Notebook into a memory system.

---

## Phase 2.2

Learning Behavior Engine

Understand:

"How does this learner learn?"

Signals:

* consistency
* completion rate
* session duration
* retry behavior
* persistence
* hint dependency

---

## Phase 2.3

Learning Signal Engine

Convert raw data into insights.

Example:

Not:

"You failed Present Perfect 10 times"

Instead:

"Present Perfect is currently weak but improving."

---

## Phase 2.4

Adaptive Practice Foundation

LEXI decides:

"What should this student do next?"

Input:

* mastery
* weakness
* retention
* behavior

Output:

* next exercise
* review topic
* difficulty

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

Before Phase 2 implementation:

1. Ensure documentation is synchronized.
2. Keep DECISION_LOG updated.
3. Start Phase 2.1:

SM-2 Retention Engine

Rules:

* No AI dependency
* No large schema rewrite
* Preserve Phase 1 behavior

---

# 11. Future Direction

Future phases:

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
