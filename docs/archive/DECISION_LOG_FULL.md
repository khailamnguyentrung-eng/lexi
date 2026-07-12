## 2026-06-29 (M3.4)

Decision:
Content validation is deterministic before AI generation.

Reason:
Generated content requires a trustworthy, auditable validation boundary. Deterministic checks
(field presence, option validity, topic consistency, difficulty targets) run instantly, produce
explainable issue codes, and have zero hallucination risk. Admins see exactly why a question
was flagged — "correctOption 'E' is not A, B, C, D" is unambiguous; an AI verdict is not.
This layer also covers questions added by the existing extraction pipeline (pre-generation),
so the validation boundary is consistent regardless of content origin.

Rejected:
Using AI as the first validation layer (non-deterministic; slow; adds latency to the admin
review flow; cannot be reliably unit tested without a live model; produces probabilistic output
where a deterministic answer exists).

Impact:
`contentValidation.ts` is a pure engine — all three check functions are zero-dependency and
fully testable in plain JS. `contentValidationService.ts` fetches Prisma data and delegates
to the pure engine. Both are additive: no existing code paths were modified.

---

## 2026-06-29 (M3.3)

Decision:
Knowledge mapping uses deterministic topic matching first.

Reason:
The system needs explainable, auditable content structure before introducing AI classification.
A question's `topic` field is already normalized (snake_case via `canonicalTopic()`) and
`KnowledgeUnit.topic` is `@unique` — exact string equality is always unambiguous. Admins can
see exactly why a question was or was not auto-assigned, and can override via
`assignQuestionToKnowledgeUnit()` if needed. No AI call, no embedding computation, no
hallucination risk in the assignment itself. Auto-assignment fires at approval time via
`autoAssignKnowledgeUnit()`, which is non-throwing — missing KnowledgeUnit never blocks
the human review gate that creates the Question row.

Rejected:
Automatic AI classification at ingestion stage (no explainability; classification errors would
silently propagate into the coverage report; requires an LLM call per draft approval, adding
latency and cost to the existing synchronous human-review step; cannot be meaningfully tested
without a live model).

Impact:
`findMatchingKnowledgeUnitId()` is the pure matching function. `autoAssignKnowledgeUnit()`
wraps it with a DB lookup + update, called in `approveDraft()` after Question creation.
Questions approved before KnowledgeUnits are seeded remain unmapped and are still counted in
coverage via topic-string matching — no re-migration needed.

---

## 2026-06-29 (M3.2)

Decision:
Coverage percentage is capped per difficulty band (surplus questions do not inflate the score).

Reason:
Coverage percentage = Σ min(actual[band], target[band]) / Σ target[band] × 100. A unit with 20
EASY questions but 0 HARD questions should not claim 100% coverage — the hard target gap is real.
Uncapped calculation would mask a genuine quality gap by letting one over-represented band inflate
the overall figure. The admin dashboard needs to surface exactly where the bank is thin; a
misleadingly high percentage defeats that purpose.

Rejected:
Uncapped total coverage (actual / target × 100 globally) — would overstate coverage when one
band is over-represented. Per-band percentage with independent scoring — considered but discarded
because the status (COMPLETE/PARTIAL/UNDER_COVERED) already communicates the per-band story
without needing a weighted multi-number display.

Impact:
`computeCoveragePercentage()` clips each band at its target before summing. `coveragePercentage`
on `CoverageReport` is always a true fill-rate signal, never inflated. UI consumers can display
it directly without applying further caps.

---

Decision:
Topic matching for coverage uses `q.topic === unit.topic` (string match), not the FK `knowledgeUnitId`.

Reason:
All seeded questions were created before M3.1 and have `knowledgeUnitId = null`. Using the FK
exclusively would show 0% coverage everywhere until every question is manually assigned — a
misleading cold-start state. Since `KnowledgeUnit.topic` is unique and `Question.topic` is
already normalized via `canonicalTopic()`, string equality is semantically correct and
immediately reflects actual coverage. FK assignment (`assignQuestionToKnowledgeUnit`) still
exists for audit/provenance purposes, but coverage calculation does not depend on it.

Rejected:
FK-only matching (blocks useful coverage reporting during cold start; requires an admin action
for each question before the gap report has any value). Hybrid matching (FK if present, else
topic string) — adds complexity without benefit since topic-string matching already gives the
right answer in all cases.

Impact:
`computeCoverageReport()` filters by `q.topic === unit.topic`. The coverage report is
immediately useful on first load even with no FK assignments. Admins can still run
`getQuestionsWithoutKnowledgeUnit()` to see which questions lack formal FK links.

---

## 2026-06-29 (M3.1)

Decision:
KnowledgeUnit is a canonical topic registry, not a curriculum planning model.

Reason:
Questions already carry a normalized `topic` string (snake_case, via canonicalTopic()). The
registry formalizes that vocabulary into rows with display labels and per-difficulty question
targets, without altering the curriculum structure (CurriculumSession is unchanged). The
many-to-many join to CurriculumSession lets the registry record which sessions cover which
topics — derived from CurriculumSession.grammarTopics arrays that already exist — without
embedding that logic in CurriculumSession itself. This keeps the registry additive and
independently seeded.

Rejected:
Embedding topic targets directly on CurriculumSession (would couple topic coverage tracking to
curriculum structure, making gap analysis harder if sessions are restructured). Creating a Topic
enum in the schema (would require migration every time a new topic appears; string + @@unique
index is more flexible for an evolving topic vocabulary).

Impact:
Gap analysis engine reads KnowledgeUnit + Question counts only. Curriculum structure remains
unchanged. All new fields nullable — zero breaking changes.

---

Decision:
Question.generatedViaJobId captures provenance without an originType enum.

Reason:
The only provenance distinction needed is: was this question generated by an admin-triggered
AI job, or was it seeded/extracted? A nullable FK covers this: `generatedViaJobId != null`
means AI-generated; null means everything else. An `originType` enum (EXTRACTION, GENERATION,
SEEDED) would be needed if we had three or more meaningfully distinct origins requiring
different UI treatment. We don't — admins see all questions the same way in practice. Adding
the enum now is YAGNI.

Rejected:
originType String enum (adds two columns instead of one; only one of the values is currently
meaningful; can be added later when a third origin type appears).

Impact:
Admin reporting can filter `WHERE generatedViaJobId IS NOT NULL` for generated questions.
Audit trail covers the M3.3 use case. One nullable column, zero migration footprint for
existing rows.

---

Decision:
QuestionGenerationJob excludes AI provider, model version, and token tracking in M3.1.

Reason:
M3.1 is foundation only — no generation calls run yet (M3.3). Adding cost/audit fields now
means maintaining nullable columns that serve no current purpose. When M3.3 is implemented,
the generation flow will log provider and token data to application logs as a starting point.
A follow-on migration can promote those to DB columns once the usage pattern is understood
(how often jobs run, what granularity of cost reporting is needed). This matches the
Phase 1/2 pattern of not pre-adding fields for hypothetical future needs.

Rejected:
Adding aiProvider, modelVersion, tokensUsed to QuestionGenerationJob in M3.1 (premature;
adds nullable columns that can't be tested or validated until M3.3; schema should reflect
what is actually written, not what might be written).

Impact:
M3.3 can add a schema migration for cost fields when generation is live. No footprint now.

---

## 2026-06-29 (M2.5 final)

Decision:
StudentLearningProfile v2 is a learner state snapshot, not a place where intelligence logic is duplicated.

Reason:
Existing intelligence remains separated in their own engines: retention logic (SM-2) in errorNotebook,
behavior analysis (BehaviorProfile) in behaviorEngine, practice calibration in difficultyCalibration,
and signal derivation in learningSignalEngine. StudentLearningProfile assembles outputs from all of
these into one coherent read model without reimplementing any of their logic. The profile is a
contract layer — it defines what the student's current learning state looks like, not how to
compute it. This keeps each intelligence engine independently testable and replaceable.

Rejected:
Embedding logic directly into StudentLearningProfile (would create maintenance burden; intelligence
would be scattered across two layers). Duplicating engine logic into profile-building (creates
divergence risk and breaks the separation of concerns).

Impact:
Profile stays flat and focused. Intelligence remains modular and independently verifiable.

---

Decision:
Use `targetGoalDate` instead of exam-specific naming (e.g., `targetExamDate`).

Reason:
LEXI supports broader learning goals beyond exam prep: end-of-term targets, personal milestones,
certification deadlines. The field name should reflect the student's actual use case, not assume
all goals are exam-related. Goal deadline is the semantics; exam is one kind of goal.

Rejected:
Exam-specific naming that would require renaming or aliasing if LEXI expands to other goal types.

Impact:
StudentLearningProfile.goalCountdown, schema field `targetGoalDate`, and related functions use
goal terminology. Future goal types can reuse the same field without schema migration.

---

## 2026-06-29 (M2.2)

Decision:
Behavior Engine uses observed learning behavior signals, not inferred learner personality.

Reason:
BehaviorProfile (preferredTimeOfDay, paceProfile, responseTimeSignal, recentMoodContext) captures
observable facts from session timing and mood entries — not psychological labels. Response time is
recorded without interpretation. Session start/end times reveal patterns. Mood is self-reported.
These are signals, not conclusions about personality, motivation, or learning style. Keeping the
engine observational rather than inferential keeps it auditable and reduces the risk of encoding
unconscious bias (e.g., equating slow-working with low-ability, or equating mood with effort).

Rejected:
(1) Motivation inference from behavior signals — motivation is psychological and not directly
measurable from timing and mood. (2) Learner personality labels (e.g., "visual learner", "kinesthetic")
— these are not evidence-based and not supported by the data we collect. (3) Response time as a
direct proxy for effort or struggle — a slow answer can be correct and thoughtful; time alone
doesn't indicate inability.

Impact:
BehaviorProfile remains a deterministic observation layer. Future work can add interpretation and
insights on top of these signals without changing the engine itself.

---

## 2026-06-29 (continued)

Decision:
M2.4 implements 8 deterministic signal types; defers 3 others to future phases.

Reason:
The 8 included signals (FIRST_MASTERY, TOPIC_MASTERED, TOPIC_IMPROVING, RECURRING_WEAKNESS,
RETENTION_RISK, LEARNING_MOMENTUM, PACE_OBSERVATION, STREAK_MILESTONE) are all rule-driven
observations derivable from StudentLearningProfile + current streak without additional DB queries.
They map directly to student milestones (mastery achieved, recurring patterns, trend changes)
that are educationally meaningful and immediately actionable. The deferred signals require either
historical context we don't yet store (previous snapshot, regression detection) or signals that
don't reliably measure what they purport to measure (effort from response time).

Rejected:
(1) Including "declining topic" — requires knowing the previous state of each topic's mastery.
Not stored. Deferring to future when ProfileSnapshot or history is available. (2) EFFORT_RECOGNITION
based on responseTimeSignal — response time does not reliably proxy effort; a slow correct answer
is still correct. Effort is a psychological construct we don't measure directly. Deferred.
(3) NOTEBOOK_CLEARED (3+ topics newly mastered) — requires comparing against previous profile state.
Deferred for same reason as #1.

Impact:
These signals avoid false confidence from proxies. Future phases can add them once the
prerequisite data is available (snapshots, historical comparisons). The 8 included signals
are sufficient for M2.5 to begin surfacing observations without relying on guesswork.

---

## 2026-06-29 (earlier)

Decision:
M2.3 difficulty calibration uses topic-level accuracy as the sole input signal.

Reason:
Accuracy (isCorrect) is the only signal that directly measures whether the student
can answer a question correctly — the core outcome LEXI is optimizing for. Response
time, mood context, and behavioral profile are available but were deliberately excluded:
response time does not indicate inability (a slow correct answer is still correct);
mood is a self-report signal that varies independently of skill; using them would couple
the difficulty system to signals that require interpretation rather than observation.
The accuracy-only rule also makes the system fully auditable — the difficulty target
for any session is a deterministic function of recent attempt records.

Rejected:
(1) Response time as a modifier — a student spending 60s/question is not necessarily
struggling; they may be thorough. Mixing time into difficulty would introduce latent
bias toward faster-clicking students. (2) Mood as a difficulty gate — "NEGATIVE mood →
EASY questions" would be self-report-driven and violates the "behavior over self-report"
principle. (3) Per-topic targets averaged per session — the simpler session-level target
(from all topic-matched attempts combined) provides more data points and is less likely
to be gamed by sparse per-topic counts.

Impact:
If finer-grained signals become appropriate later (e.g. question difficulty rating
from human review, or time-normalized accuracy), they can be added to
`AttemptForCalibration` and `computeDifficultyTarget` without changing the caller
or the selection weighting logic.

---

## 2026-06-28

Decision:
SM-2 quality derived from post-session accuracy, not detailed student responses.

Reason:
LEXI has only coarse attempt data (isCorrect, not correctness %ile or time-to-answer).
Deriving quality from topic accuracy post-session is a reasonable approximation: if
accuracy improved after a notebook review, the student learned; if accuracy stalled,
they didn't. This maps directly to SM-2's core feedback loop: quality reflects whether
the review event actually helped. Simpler than storing fine-grained scoring; sufficient
for the current feedback signal.

Rejected:
(1) Store prevInterval on schema (adds migration + complexity; iterative EF computation
works fine without it). (2) Perfect SM-2 with item-level quality (requires per-question
scoring we don't have).

Impact:
SM-2 algorithm is stable to schema changes. If finer scoring becomes available later
(e.g. time-to-answer, question difficulty), the quality function can be replaced
without touching computeSM2Update() or the data model.

---

## 2026-06-23

Decision:
Use AIProvider abstraction.

Reason:
Allow switching between Gemini/Claude/local models.

Rejected:
Hard-code Gemini.

Impact:
Future providers can be added without changing app architecture.