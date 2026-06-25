# LEXI Phase 2 Schema Audit

Status:
PLANNED

Purpose:

Review existing database schema before Phase 2 implementation.

No schema changes are approved from this document alone.


# 1. ErrorNotebookEntry

Phase 2 Usage:

Retention Intelligence


Existing fields:

- id
- userId
- topic
- mistakeType
- reviewStage
- easeFactor
- nextReviewAt


Decision:

TODO


Notes:

SM-2 compatibility needs verification.


---

# 2. QuestionAttempt

Phase 2 Usage:

Behavior Intelligence


Existing fields:

- id
- userId
- questionId
- isCorrect
- timeSpentSec
- attemptedAt


Decision:

TODO


Notes:

Used for learning behavior signals.


---

# 3. UserSessionProgress

Phase 2 Usage:

Behavior Intelligence


Existing fields:

TODO


Decision:

TODO


Possible change:

completedAt may be required for session duration calculation.


---

# 4. LearnerProfile

Phase 2 Usage:

Future personalization


Existing fields:

TODO


Decision:

TODO


Possible future field:

targetExamDate


---

# 5. Migration Principle

Allowed:

- additive fields only
- nullable fields preferred
- no destructive changes


Not allowed:

- schema rewrite
- replacing Phase 1 models