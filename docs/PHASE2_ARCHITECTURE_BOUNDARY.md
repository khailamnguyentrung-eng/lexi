# LEXI Phase 2 Architecture Boundary

Status:
PLANNED

Phase 1:
FROZEN


# 1. Purpose

Define architecture boundaries before Phase 2 implementation.

Phase 2 extends LEXI intelligence without rewriting Phase 1.


# 2. Architecture Principle

Keep:

Repository Layer

↓

Pure Intelligence Engine

↓

Learning Service

↓

StudentLearningProfile

↓

UI


No business logic in UI.


# 3. New Phase 2 Intelligence Layers


## Retention Engine

Purpose:

Adaptive review scheduling.

Input:

ErrorNotebookEntry


Output:

Review timing recommendation.


---

## Behavior Engine

Purpose:

Understand learning patterns.

Input:

QuestionAttempt
UserSessionProgress


Output:

Behavior signals.


---

## Recommendation Engine

Purpose:

Decide next best learning action.

Input:

Mastery
Weakness
Retention
Behavior


Output:

Next learning recommendation.


# 4. Schema Rules

Allowed:

Small additive migrations only.

No destructive schema changes.


# 5. AI Boundary

AI must not:

- calculate mastery
- calculate scores
- decide recommendations

AI may:

- explain
- coach
- personalize language


# 6. Deferred

Not Phase 2:

- LEXI Lens
- gamification
- multi-user
- AI learning decisions