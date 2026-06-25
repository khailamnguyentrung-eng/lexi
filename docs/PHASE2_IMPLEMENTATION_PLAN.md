# LEXI Phase 2 Implementation Plan

Status:
PLANNED

Phase 1:
FROZEN


# Goal

Implement Phase 2 intelligence incrementally without breaking Phase 1 architecture.


# Implementation Order


## Step 1 — Retention Engine

Priority:

P0


Goal:

Turn Error Notebook into an adaptive review system.


Input:

ErrorNotebookEntry


Output:

Review recommendation


Scope:

- review scheduling
- SM-2 calculation
- nextReviewAt update


Constraints:

- no schema migration
- no AI decision making



---

## Step 2 — Learning Behavior Engine

Priority:

P1


Goal:

Understand how the student learns.


Input:

- QuestionAttempt
- UserSessionProgress


Signals:

- consistency
- completion rate
- session duration
- pace change


Constraints:

Behavior signals must have confidence thresholds.

Do not make psychological conclusions.



---

## Step 3 — Adaptive Recommendation Engine

Priority:

P1


Goal:

Decide next best learning action.


Input:

- mastery
- weakness
- retention state
- behavior signals


Output:

Next learning recommendation


Constraints:

Recommendation consumes intelligence outputs.

It does not calculate mastery.



---

## Step 4 — Learning Signal Integration

Priority:

P2


Goal:

Expose meaningful insights through StudentLearningProfile.


Output:

Student understands:

- what to review
- what to practice
- why



---

# Testing Strategy


Each intelligence module requires:

- unit tests
- deterministic examples
- regression protection


No Phase 2 feature is complete without verification.



# Claude Code Implementation Rule


Before coding:

Review:

- ARCHITECTURE.md
- LEXI_CURRENT_HANDOFF.md
- PHASE2_FINAL_DESIGN.md
- PHASE2_ARCHITECTURE_BOUNDARY.md
- PHASE2_SCHEMA_AUDIT.md


Do not:

- rewrite architecture
- modify schema casually
- move business logic into UI