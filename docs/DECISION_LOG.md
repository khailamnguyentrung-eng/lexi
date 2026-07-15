# LEXI — Decision Log

Architecture decisions recorded here capture the WHY behind non-obvious choices.
Each entry includes what was decided, the reason, and what was explicitly rejected.

---

## M3.2 — Coverage engine uses topic string matching, not FK

**Decision:** `computeCoverageReport()` counts questions by `q.topic === unit.topic`, not by `q.knowledgeUnitId` FK.

**Reason:** All seeded questions have `knowledgeUnitId = null` (FK was added in M3.1, not backfilled). Using FK matching would report zero coverage even on a fully-seeded bank. Topic string matching gives accurate coverage immediately, even before formal FK assignments are made.

**Rejected:** FK-based counting. Would require backfilling all existing questions before the coverage report became useful.

---

## M3.3 — Auto-assign is non-throwing

**Decision:** `autoAssignKnowledgeUnit()` wraps the FK assignment in a try/catch and returns `false` on failure rather than throwing.

**Reason:** Auto-assignment is called inside `approveDraft()` — if it threw, the entire approval (Question creation) would fail. Approval is a human action that must succeed if the draft is valid. Missing KnowledgeUnit rows (e.g., on first boot before seeding) must not block imports.

**Rejected:** Throwing on missing KnowledgeUnit. Would break the import pipeline whenever a new topic is imported before the KU registry is seeded.

---

## M3.3 — Deterministic topic matching only (no AI, no fuzzy)

**Decision:** `findMatchingKnowledgeUnitId()` uses exact string equality (`q.topic === unit.topic`). No fuzzy match, no AI classification.

**Reason:** The topic field on Question is already normalized by `canonicalTopic()` during AI extraction. If two strings don't match exactly, it means they represent different concepts or that normalization produced an inconsistency — both cases require human review, not silent auto-correction.

**Rejected:** Levenshtein or embedding-based fuzzy matching. Would silently assign questions to wrong KnowledgeUnits (e.g., "present_simple" → "present_perfect" on a typo), corrupting coverage data without any audit trail.

---

## M3.4 — Validation status uses severity ladder (not count)

**Decision:** Status is FAIL if any issue has severity HIGH; WARNING if any LOW/MEDIUM (and no HIGH); PASS if no issues. A single HIGH issue fails the question even if it has ten LOW issues.

**Reason:** Structural failures (missing prompt, invalid correct option) are categorically different from cosmetic warnings (missing explanation). Counting all issues equally would allow a question with a missing prompt to pass if it had no other issues.

**Rejected:** Counting total issues or averaging severity scores. Loses the distinction between structural invalidity and advisory warnings.

---

## M4.1 — Workflow foundation before AI integration

**Decision:** M4.1 implements the generation job lifecycle, state machine, and validation bridge without any real AI calls. `generateDraftQuestions()` is a pure placeholder returning `[]`.

**Reason:** The generation pipeline must be governed by knowledge gaps (M3.2) and content validation (M3.4) before any AI is wired in. Building the contract first means M4.2 can plug in real AI without touching the job lifecycle, types, or validation logic.

**Rejected:** Direct AI-to-question persistence. Would bypass the human review gate. Any AI output must pass through `ExtractedQuestionDraft → approveDraft()` to reach the Question table.

---

## M4.2 — AI generation produces reviewable drafts only

**Decision:** `generateDraftsForGap()` returns `GeneratedQuestionDraft[]` — validated in memory, never persisted directly as Question rows. The only path from generated content to Question is through the existing `approveDraft()` human review gate.

**Reason:** Human approval remains the quality boundary. AI-generated content has not been verified for factual correctness or pedagogical quality. The validation engine (M3.4) catches structural issues, but content-level correctness requires human judgment.

**Rejected:** Direct AI-to-Question persistence. Would bypass the review gate entirely and allow factually incorrect or pedagogically poor questions to reach students without human sign-off.

---

## M4.2 — generateQuestions() added to AIProvider interface (not a new abstraction)

**Decision:** `generateQuestions()` is a fourth method on the existing `AIProvider` interface, alongside `chat()`, `normalizeQuestions()`, and `generateExplanation()`. All three real providers (claude, gemini, mock) implement it. `withRuntimeFallback` covers it with the same fallback pattern as the other methods.

**Reason:** Creating a separate `GenerationProvider` abstraction would duplicate the provider resolution logic (`getAIProvider()`, env-var switching, API key detection) and the runtime fallback mechanism. The existing interface already handles admin-only operations (`normalizeQuestions`) separately from student-facing ones (`chat`, `generateExplanation`) — `generateQuestions` fits the same admin-only pattern.

**Rejected:** Separate `GenerationProvider` interface. Adds abstraction without reducing complexity.

---

## M4.2 — Generated drafts not persisted to ExtractedQuestionDraft (schema constraint)

**Decision:** M4.2 returns `GeneratedQuestionDraft[]` in memory only. `ExtractedQuestionDraft` rows are NOT created in M4.2.

**Reason:** `ExtractedQuestionDraft.importJobId` is currently `String` (NOT NULL) in the schema. Generated questions have no `ImportJob` — they come from a `QuestionGenerationJob`. Creating a dummy `ImportJob` to satisfy the FK constraint would corrupt data integrity. The correct fix is a schema migration making `importJobId` optional.

**Rejected:** Creating a dummy ImportJob for generated content. Violates data integrity and makes the import/generation distinction impossible to query reliably.

**Next step (M4.3):** Schema migration to make `importJobId` nullable on `ExtractedQuestionDraft`, then add `persistGeneratedDrafts()` to persist validated drafts for human review.

---

## M4.4 — Generation quality assists human review, not replaces it

**Decision:** `qualityEvaluation.ts` produces a `GenerationQualityReport` (score + issues) that is informational only. No check in the engine triggers automatic approval or rejection. `evaluateDraft()` is synchronous, pure, and never throws — even a catastrophically bad draft receives a report with score 0 rather than an exception.

**Reason:** AI output requires measurable, deterministic checks (duplicate detection, topic alignment, difficulty consistency) so reviewers can prioritise their attention. However, final content trust is a human judgment call that cannot be delegated to a score. A question could have duplicate risk or an at-target difficulty band yet still be the best version of that content — or the opposite. The score informs, it does not decide.

**Rejected:** Automatic publishing of generated questions based on score threshold. Would bypass the human review gate established in M4.1 and enforced by `approveDraft()`. Also rejected: AI-assisted semantic checks (e.g. "is this answer actually correct?") — those require LLM calls and are out of scope for M4.4.

---

## M4.3 — Generated questions use a separate draft lifecycle

**Decision:** `GeneratedQuestionDraft` is a new, independent Prisma model. It is NOT stored in `ExtractedQuestionDraft`.

**Reason:** Imported content and AI-generated content have fundamentally different provenance. `ExtractedQuestionDraft.importJobId` is `String` (NOT NULL) — generated questions have no `ImportJob`. Repurposing `ExtractedQuestionDraft` would require either a nullable FK (making every extracted draft's schema ambiguous about origin) or a dummy `ImportJob` row (corrupting the import audit trail). A dedicated model keeps import and generation histories independently queryable and removes ambiguity from every future audit.

**Rejected:** Reusing `ExtractedQuestionDraft` for generated content. Would require making `importJobId` nullable, losing the guaranteed "every extracted draft came from an import" invariant. Would also merge two distinct admin workflows (review AI output vs. review OCR output) into a single undifferentiated table.

---

## M4.3 — validationStatus stored on draft, re-checked as gate at approval

**Decision:** `GeneratedQuestionDraft.validationStatus` is written once at draft creation (from `contentValidation.ts`). At `approveDraft()` time, the stored status is used as a gate: FAIL → throw, PASS/WARNING → proceed.

**Reason:** Re-running validation at approval would require either a full question-context re-fetch or inline re-validation of stored fields. The validation result is deterministic for a given set of field values, and the draft fields are immutable after creation (no edit endpoint in M4.3). Storing the result avoids redundant computation and makes the gate logic trivially auditable from the DB.

**Rejected:** Silently ignoring validation status at approval (allowing admins to approve FAIL drafts). Any draft with a HIGH-severity issue (missing prompt, invalid correct option) must not reach the Question table.

---

## M6.4 — LEXI UI consumes LensViewModel instead of intelligence engines

_Removed: 2026-07-13. The standalone `/lens` page and `LensPageContent` described below were deleted per a product decision to retire the feature. This entry is kept as a historical record; the code it describes no longer exists. `lib/services/lens-ai/` (a different subsystem — Explain/OCR/Assistant) is unaffected._

**Decision:** The `/lens` page (`app/(app)/lens/page.tsx`) is a Server Component that calls only `getLearnerLens(userId)` from the Lens service layer. The single data contract crossing from server to client is `LensViewModel`. No learner intelligence engine, no `StudentLearningProfile`, no `LearnerModel`, no `KnowledgeState` or `PerformanceState` type is imported anywhere in the page or its sub-components. `LensPageContent` (the Client Component) accepts `{ viewModel: LensViewModel }` as its only prop.

**Reason:** UI evolution must remain independent from learning intelligence. When the summary section is redesigned (different layout, different metric tiles, new wording), the change must not touch any intelligence engine. When an intelligence engine is refactored (new field names, different confidence calculation), the change must not cascade into the UI. The `LensViewModel` contract is the stable boundary: `getLearnerLens()` promises to return it; the UI promises to consume only it. This boundary was first established in M6.2 (stable service contract) and M6.3 (design system with no engine imports). M6.4 closes the loop by proving the boundary holds under real composition: a page with five sections, theme switching, and link generation — all derived from `LensViewModel` fields alone.

**Rejected:** Direct UI access to learner state engines — e.g. importing `computeKnowledgeState()` or `getStudentLearningProfile()` directly in a page or component. Would mean UI components need to understand engine output shapes, confidence tier enums, and raw field names. Any engine refactor would require UI changes. Also rejected: a page that accepts both `LensViewModel` and `StudentLearningProfile` simultaneously (mixing layers). The page either works at the view layer or it doesn't — partial mixing defeats the purpose of the Lens service abstraction.

---

## M6.3 — LEXI UI uses a token-based theme system

**Decision:** All color, spacing, typography, radius, shadow, and motion values in the LEXI design system are defined as theme tokens in `ThemeConfig` and injected as CSS custom properties (`--theme-*`) by `ThemeProvider`. No Lens component contains a hardcoded color value. Three themes ship with the system: `defaultTheme` (matches existing palette), `calmTheme` (soft teal-blue, more breathing room), `focusTheme` (high-contrast dark, sharp edges).

**Reason:** Personalization extends to user experience without coupling UI and intelligence. A student who prefers a calmer visual environment during focused study should be able to switch to `calmTheme` without changing a single line of learning logic. Because themes are pure data (plain `ThemeConfig` objects), any future theme (high-contrast accessibility, night mode) requires only one new constant — no component changes. The CSS variable injection approach (`ThemeProvider` sets `--theme-*` vars on a wrapper div; components read via `var(--theme-card-bg, fallback)`) works correctly with Next.js Server Components: only `ThemeProvider` itself is a Client Component; child Server Components are unaffected. The fallback values in component `var()` calls ensure correctness even when a component is rendered outside a `ThemeProvider`.

**Rejected:** Hard-coded single visual design. Would make every future cosmetic change (adding night mode, supporting an accessibility palette, adjusting spacing for a new viewport) require modifying component files rather than adding a theme object. Also rejected: CSS-in-JS (styled-components, Emotion) — requires client-side rendering for Server Components, adds bundle weight, and conflicts with the existing Tailwind v4 setup. Also rejected: Tailwind theme extension via `tailwind.config.ts` for dynamic values — Tailwind v4 purges unused classes at build time, making runtime theme switching impossible without shipping all possible class combinations.

---

## M7.2 — OCR routes through existing AI pipeline (no bypass)

**Decision:** `extractTextFromImage()` returns plain text, which feeds into `buildExplainUserMessage()` → `AIProvider.chat()` → `parseLensExplainResponse()`. The OCR layer never calls `AIProvider` independently — it is strictly a text extraction step.

**Reason:** Phase 7.1 proved the text → AI → LensResponse chain. Phase 7.2 adds a preprocessing step before that chain rather than replacing it. This means OCR can be swapped (mock → Tesseract → cloud) without touching the AI reasoning layer, and the same prompt design applies to both text and image captures.

**Rejected:** Sending raw image bytes to `AIProvider.chat()` as base64 — requires vision API in all providers, breaks the Phase 7.1 prompt (written for extracted text), and adds cost. Vision-based reasoning is Phase 7.3.

---

## M7.2 — Mode check before type routing in captureAndAssist

**Decision:** The mode check (`if (!IMPLEMENTED_MODES.includes(mode))`) is moved to before type routing. Phase 7.1 had the reverse order because there was only one supported type.

**Reason:** OCR is async and (once real OCR is wired in) potentially expensive. An unimplemented mode should short-circuit before triggering OCR. The `MODE_NOT_IMPLEMENTED` flag response is the same regardless of capture type.

**Rejected:** Running OCR before mode check — wastes compute for unimplemented modes. Once Tesseract.js is wired in (Phase 7.3), this order matters for performance.

---

## M7.1 — LEXI Lens starts with text interaction before vision capabilities

**Decision:** Phase 7.1 implements TEXT_SELECTION + EXPLAIN only. No OCR. No image capture. No learner profile reads. Image capture types throw `LensError` ("requires Phase 7.2") rather than returning a flag, because the caller must not silently proceed with no image data — this is a programming error, not a recoverable user condition.

**Reason:** Validate the learning assistance workflow (capture → AI understand → explain → parse → LensResponse) before adding expensive vision infrastructure. A working text flow proves the `AIProvider.chat()` reuse pattern, the bilingual prompt design, and the graceful parse fallback — all of which image capture inherits in Phase 7.2. Building the full image AI pipeline first would delay any learner-facing value and make it harder to isolate bugs in the response format.

**Rejected:** Building full image AI pipeline first. Would block any text-based flow on OCR infrastructure readiness and require vision API integration before any learning assistance can be tested end-to-end. Also rejected: Separate `LensAIProvider` interface — `getAIProvider().chat()` is sufficient; a new abstraction would duplicate provider resolution, env-var switching, and the runtime fallback mechanism.

---

## M6.2 — Lens exposes a stable view contract separate from learner intelligence

_Removed: 2026-07-13. `lensService.ts`, `getLearnerLens()`, and the `LensViewModel` contract described below were deleted along with the standalone Lens feature. This entry is kept as a historical record; the code it describes no longer exists. `lib/services/lens-ai/` (a different subsystem — Explain/OCR/Assistant) is unaffected._

**Decision:** `getLearnerLens(userId)` in `lensService.ts` is the single entry point for all Lens consumers (student dashboard, session results, parent/teacher view). It fetches `StudentLearningProfile v3` and passes it to `assembleLensViewModel()`, which calls all five Phase 6.1 transformers. Consumers receive a `LensViewModel` — they never interact with `StudentLearningProfile`, `LearnerModel`, or any Phase 5 engine output directly.

**Reason:** UI evolution should not require changing intelligence engines. If a dashboard component is updated to show a new layout for strengths, that change must not touch `knowledgeState.ts`, `performanceState.ts`, or any Phase 5 logic. The `LensViewModel` contract is the boundary: intelligence lives below it, presentation lives above it. With `assembleLensViewModel` exported as a pure function, the contract is independently testable without triggering a DB fetch, and UI authors have a single stable type to depend on.

**Rejected:** UI directly consuming internal intelligence models (e.g. a dashboard reading from `learnerModel.knowledgeState.masteredConcepts` directly). Would create a tight coupling between UI rendering and the exact field structure of Phase 5 engine outputs — every engine refactor would cascade into UI components. Also rejected: a "thin" service that merely re-exports `getStudentLearningProfile`. That would leave the transformation responsibility undefined and force each consumer to independently call Lens transformers.

---

## M6.1 — LEXI Lens transforms learner intelligence into understandable views

_Removed: 2026-07-13. `lib/services/lens/` (the pure transformer layer described below) was deleted along with the standalone Lens feature. This entry is kept as a historical record; the code it describes no longer exists. `lib/services/lens-ai/` (a different subsystem — Explain/OCR/Assistant) is unaffected._

**Decision:** The Lens layer (`lib/services/lens/`) contains only pure transformer functions that consume `StudentLearningProfile v3` and produce typed view objects (`LearnerSummary`, `LearningInsights`, `Strengths`, `Challenges`, `RecommendedActions`). No new inference rules, no DB access, no AI, no schema changes. The `confidenceTier` and `source` fields are propagated to every output item so the UI can communicate confidence without re-deriving it.

**Reason:** Presentation should remain separate from inference. Phase 5 engines are responsible for deriving what is true; the Lens layer is responsible for narrating it. Mixing narrative generation with inference (e.g. adding a "rule" that fires inside `learnerSummary.ts` based on raw attempt data) would create an untraceable second source of intelligence that bypasses the Phase 5 contract. Keeping the Lens as a pure transformation layer means: (1) every claim in the Lens is traceable to a specific field in `StudentLearningProfile`; (2) the Lens can be updated for presentation purposes without risk of changing the underlying learner model; (3) each view is independently testable without assembling the full profile.

**Rejected:** Adding intelligence logic inside UI components. Would make it impossible to test confidence gating, narrative rules, or source traceability at the unit level. Also rejected: adding `LearnerSummary` assembly to `getStudentLearningProfile()` (would break the separation between intelligence assembly and presentation).

---

## M5.5 — StudentLearningProfile remains a read model assembled from intelligence engines

**Decision:** `assembleLearnerModel()` in `learnerProfileBuilder.ts` is the only place that calls intelligence engines. `StudentLearningProfile.learnerModel` is a composed snapshot — it has no inference logic of its own. The builder calls engines, assembles their outputs, and records an `assembledAt` timestamp. Nothing else.

**Reason:** Separating inference from representation keeps the learner model maintainable. Each Phase 5 engine can be tested, updated, and replaced independently without touching the profile contract. If intelligence logic were embedded inside the profile, every new insight capability would require modifying a shared consumer-facing interface. The assembly pattern ensures the profile remains a stable, additive snapshot across milestones.

**Rejected:** Embedding intelligence rules inside `StudentLearningProfile` or `buildLearningProfile()`. Would mix derivation and presentation in one file, making the profile contract the growth point for new intelligence — violating the same single-responsibility principle that motivated separating Phase 5 engines from Phase 1/2 analytics in the first place.

---

## M5.4 — Problem solving describes response patterns, not learner traits

**Decision:** `ProblemSolvingState` dimensions use value labels that describe observable system events only — retry counts, post-error accuracy, error notebook engagement, improvement signal ratios. No dimension label names a personality trait, motivation state, or aptitude judgement.

**Reason:** Observed actions (retried after 8 of 12 errors) support personalization without psychological classification (persistent learner). Attempt history and error notebook signal data are system-recorded facts. Describing them as facts is sound engineering. Describing them as character traits is speculation that LEXI is not equipped to make. Keeping labels behavioral (FREQUENT_RETRIER vs. PERSISTENT) means the same observable data is usable for adaptation without locking the interpretation into a trait model that might be wrong or harmful.

**Rejected:** Turning behavioral frequency patterns into personality labels. Specifically prohibited from appearing in any PatternEntry value: PERSISTENT, MOTIVATED, RESILIENT, GRITTY, DETERMINED, LAZY, UNMOTIVATED, DISENGAGED, STRUGGLING, INTELLIGENT, CAPABLE, WEAK. These are enforced by an explicit test assertion in section 12 of `scripts/test-problem-solving-state.mjs`.

Also rejected: Using `responseTimeSignal` from BehaviorProfile to add a "deliberateness after error" dimension. This signal reflects average response time across all attempts — not specifically post-error response time. Deriving a "deliberateness" judgement from it would be a category error.

---

## M5.3 — Learning preference uses explicit or repeated evidence only

**Decision:** `LearningPreferenceState` dimensions are populated only from (1) explicit learner-set values or (2) repeated behavioral observations with a clear, direct mapping (time-of-day from `BehaviorProfile.preferredTimeOfDay`, session length from `avgSessionDurationMin`). Dimensions with no current evidence source (explanationDepth, hintFrequency, feedbackTiming, practiceMode, languagePreference) are set to `"UNKNOWN"` with source `"NONE"` — even when a CONFIRMED behavior profile is available.

**Reason:** Preference should represent learner choices, not inferred psychology. Deriving "explanation depth preference" from response time, or "language preference" from performance patterns, would require making psychological assumptions about why the learner behaves as they do. LEXI does not have the data or expertise to make such inferences reliably. Keeping UNKNOWN dimensions explicit in the output makes the limitation visible to future developers and prevents silent misinformation from being passed to UI or recommendation systems.

**Rejected:** Automatic learner style classification — e.g. deriving `explanationDepth: "DETAILED"` from `responseTimeSignal: "EXTENDED"`, or deriving `languagePreference: "BILINGUAL"` from the learner's nationality. These are speculative inferences that map behavior to psychology without direct evidence. The Phase 5 design review explicitly prohibits this: "Phrases like 'visual learner', 'motivated student', 'anxious test-taker' are out of scope."

---

## M5.2 — Learning behavior describes observed actions only

**Decision:** `LearningBehaviorState` contains only factual behavioral observations derived from `BehaviorProfile`. No field names, doc comments, or derived values imply personality, motivation, effort, or learning style. The `EngagementLevel` classification (HIGHLY_ACTIVE / ACTIVE / OCCASIONAL / INACTIVE) is defined strictly by session count thresholds — it is a count-based label, not a character judgment. `RetryBehaviorObservation.responseTimeSignal` is documented as a proxy for response time only, not for "effort" or "persistence".

**Reason:** Behavior data is valuable for personalization (scheduling, content difficulty, session length) without requiring psychological inference. Labeling a learner as "highly motivated" or "a consistent personality" from system interaction data is both speculative and beyond the scope of LEXI's design. Keeping behavior as pure observation preserves the data's usefulness while avoiding the ethical and epistemic risks of trait inference.

**Rejected:** Any field or derived value that frames observed behavior as a personality trait or motivational state — e.g. an `isMotivated` flag derived from session frequency, a `learnerType` classification (visual/auditory/kinesthetic), or a `gritScore` derived from retry rate. These are permanently out of scope for the Phase 5 learner model.

---

## M5.1 — Learner state engines remain separate from StudentLearningProfile

**Decision:** `computeKnowledgeState()` and `computePerformanceState()` live in `lib/services/learner-intelligence/`, not inside `lib/analytics/studentLearningProfile.ts`.

**Reason:** `StudentLearningProfile` is a snapshot/read model. It aggregates pre-computed outputs from intelligence layers into one coherent view for the UI and API. If learner inference logic were embedded inside the profile, adding new intelligence (e.g. Problem Solving Pattern in a later milestone) would require modifying the profile contract — breaking the consumer interface. Keeping engines separate means: (1) any consumer can call an engine independently of the full profile; (2) the profile contract is stable across phase milestones; (3) engines can be tested in complete isolation without assembling a full profile.

**Rejected:** Embedding `computeKnowledgeState()` and `computePerformanceState()` as methods or helpers inside `studentLearningProfile.ts`. Would mix intelligence computation with the snapshot assembly responsibility, making the file responsible for both derivation and presentation — a single-responsibility violation.

---

## M4.2 — Generation prompt in normalizationCore.ts (not a separate file)

**Decision:** `GENERATE_QUESTIONS_SYSTEM_PROMPT`, `buildGenerateQuestionsUserPrompt()`, and `generateWithRetry()` live in `normalizationCore.ts` alongside the normalization prompt and `normalizeWithRetry()`.

**Reason:** `normalizationCore.ts` already owns all AI prompt content and the retry-once-on-invalid-JSON policy. Generation reuses `parseDrafts()` (the JSON-to-NormalizedQuestionDraft parser) with a generation-origin source string. Splitting into a separate file would duplicate the retry pattern and `parseDrafts()` call.

**Rejected:** A separate `generationCore.ts`. Would require duplicating `parseDrafts()` or creating a cross-file dependency between the two cores for shared parsing logic.

---

## QM-1 — `ResponseFormat` is a new axis, not new `QuestionType` members

**Decision:** Non-MCQ formats (gap fill, matching, ordering) are modelled by a new `ResponseFormat` enum on `Question`, not by adding members like `MATCHING_HEADINGS` to the existing `QuestionType`.

**Reason:** `QuestionType` conflates what is tested with how it is answered — `GRAMMAR_MCQ` carries the format in its own name, `CLOZE` is a format stored as MCQ, `READING_COMPREHENSION` is a skill, `WORD_FORMATION` is a topic. It also overlaps `SkillCategory`: `PHONETICS_STRESS` is a member of **both** enums, with different counts (type=6, skill=12). Between `type`, `skill`, and `topic`/`knowledgeUnitId` the model had three overlapping "what" axes and no "how" axis. Adding format members to `QuestionType` deepens the conflation and buys exactly one exam. `ResponseFormat` supplies the missing axis and only that — IELTS required zero new members (True/False/Not Given is `SINGLE_CHOICE` with 3 options; matching headings is `MATCHING`).

**Rejected:** Extending `QuestionType`. Would make a mixed-meaning enum worse, and would require a new member per exam format — the test the new enum is designed to keep passing is that a new exam needs no new member.

---

## QM-1 — Format-specific data in a JSON `payload`, not columns or per-type tables

**Decision:** `Question.payload` is a JSON string whose shape depends on `responseFormat`, validated per format in `lib/services/question-format`. Queryable fields (`topic`, `skill`, `difficulty`, `knowledgeUnitId`) stay as columns.

**Reason:** The five formats have irreconcilable shapes — `SHORT_TEXT` has blanks with multiple accepted answers, `MATCHING` has two lists plus pairs, `SINGLE_CHOICE` has N options. No fixed column set holds all of them, which is exactly how the model got stuck at four required option columns. The governing rule is "columns hold what the system QUERIES; JSON holds what only the GRADER reads" — the coverage report and Decision Engine query the columns and are untouched by the reform.

**Rejected:** (1) Nullable `optionA-D` plus a JSON side-channel — leaves two shapes live indefinitely with no forcing function to converge. (2) Table-per-format inheritance — Prisma has no polymorphic relations, so `QuestionAttempt` would need one nullable FK per format, and every join would branch. (3) A single JSON `content` blob for the whole question — would move `topic`/`skill`/`knowledgeUnitId` out of SQL and break the coverage report and every analytics query.

---

## QM-1 — Legacy MCQ columns retained; `getQuestionPayload()` is the single reader

**Decision:** `optionA-D`, `correctOption`, and `selectedOption` are kept and still written. All reads of a question's answer shape go through `getQuestionPayload()`, which prefers `payload` and falls back to the legacy columns for `SINGLE_CHOICE` only.

**Reason:** 29 files read those columns and the repo has no type-safe test net over them (no vitest/jest; tests are standalone `.mjs` scripts). Rewriting all 29 in one change is the riskiest available sequencing. The two-shape drift hazard is bounded by ordering instead: `payload` is backfilled for all rows immediately (so it is authoritative from that moment), writers project back through `toLegacyColumns()` rather than writing columns by hand, and the columns are dropped once every reader has moved.

**Rejected:** A big-bang migration of all 29 readers. Also rejected: making `payload` nullable *indefinitely* — it is backfilled at once precisely so there is never a live two-shape read.

---

## QM-1 — `toLegacyColumns()` returns null for non-MCQ instead of synthesising options

**Decision:** Projecting a non-`SINGLE_CHOICE` payload onto the legacy columns returns `null`, and callers must treat that as "this question cannot be shown to a legacy reader".

**Reason:** A MATCHING question genuinely has no A/B/C/D. Fabricating four columns for it would recreate the exact defect the reform removes — `WORD_FORMATION` (12) and `SENTENCE_TRANSFORMATION` (15) are production tasks currently stored as selection. The null is also the forcing function that makes the reader migration a precondition for shipping non-MCQ content to learners, rather than a cleanup someone might skip.

**Rejected:** Degrading a non-MCQ question into a "best-effort" 4-option approximation. Silently changes what the learner is asked to do and corrupts the mastery signal the Decision Engine reads.

---

## QM-1 — Partial credit only where parts are independently answerable

**Decision:** `SHORT_TEXT` scores per blank and `MATCHING` per pair; `MULTI_CHOICE` and `ORDERING` are all-or-nothing. `QuestionAttempt.score` (0..1) is added; `isCorrect` keeps its exact meaning (`score === 1`).

**Reason:** Per-option credit on `MULTI_CHOICE` rewards ticking everything — on 4 options with 2 correct, selecting all 4 would score 0.5 while demonstrating no knowledge. Position-wise credit on `ORDERING` punishes a single insertion at the front, which shifts every later item; rank-correlation scoring would be fairer but is an untunable modelling decision with zero real learners to validate against (see `DECISION_ENGINE_OPTIONS.md` §2). `MATCHING` is scored against `correctPairs`, not against submissions, so answering one pair and skipping the rest cannot score 1.0. `isCorrect` is redefined nowhere because ~10 call sites in `lib/analytics` read it; changing it to "score > 0.5" would silently rewrite every mastery number in the app.

**Rejected:** Per-option partial credit for `MULTI_CHOICE`; rank-correlation credit for `ORDERING`; redefining `isCorrect` in terms of `score`.

---

## QM-1 — Text answers: exact match after normalization, no fuzzy matching

**Decision:** `SHORT_TEXT` blanks carry a list of `acceptedAnswers`; grading normalizes whitespace, case (unless `caseSensitive`), and curly-to-straight quotes, then requires exact equality. No punctuation stripping, spell-correction, or fuzzy/AI matching.

**Reason:** Same reasoning already recorded for topic matching ("no fuzzy matching, no AI classification"): a near-miss is a judgement call, and silently accepting it hides a real learner error inside a "correct" mastery signal — which the Decision Engine then consumes as truth, with no downstream check to catch it. Curly apostrophes are folded because `don’t` vs `don't` is a keyboard artifact, not a language error. `acceptedAnswers` is a **list** because natural language has more than one right answer (`don't` / `do not`), and a grader knowing only one marks correct learners wrong — a silent corruption worse than a missing feature.

**Rejected:** Levenshtein/embedding fuzzy matching, and single-string `acceptedAnswer`. The validator rejects an empty `acceptedAnswers` for the same reason: it would mark every learner wrong forever, without throwing.

---

## KU-1 part B — `PendingKnowledgeUnit.taxonomyJobId` is nullable

**Decision:** `PendingKnowledgeUnit.taxonomyJobId` is an optional FK, not required.

**Reason:** The design doc's first sketch implied it was required, but `autoAssignKnowledgeUnit()`'s miss-handling (below) runs inside the existing Path B import pipeline, which never creates a `TaxonomyJob` — that model belongs to Path A, which does not run during an import. `contentSourceId` stays required because it is reachable on both paths (directly on Path A; via `ExtractedQuestionDraft.importJob.contentSourceId` on Path B). A proposal is provenanced by whichever job actually produced it, and Path B produces one with no `TaxonomyJob` at all.

**Rejected:** Requiring `taxonomyJobId` and creating a throwaway `TaxonomyJob` row per Path B miss just to satisfy the FK. Would fabricate a job that never ran an AI taxonomy read, misrepresenting provenance for the sake of a schema constraint.

---

## KU-1 part B — miss-handling records a proposal instead of discarding the topic

**Decision:** `autoAssignKnowledgeUnit()` now creates a `PendingKnowledgeUnit` when no `KnowledgeUnit` matches a question's topic, deduped on `(contentSourceId, proposedTopic, reviewStatus=PENDING_REVIEW)`. The function's contract is otherwise unchanged: still non-throwing, still returns `false` on a miss (`approveDraft()` does not branch on the return value differently).

**Reason:** Before this change the miss was a silent `return false` — the topic simply vanished, which is the entire gap `docs/KU1_PARTB_DESIGN.md` was written to close (verified against seeded data: 73 of 122 questions, 62 distinct topics, previously produced zero record of ever having been unmatched). Recording it is what lets an import — including a future non-Vietnamese source — grow the taxonomy through human review instead of silently capping it at whatever `knowledge-units.json` was hand-edited to contain. The dedup key includes `contentSourceId` (not global) because the review workflow is per-source, and includes the `PENDING_REVIEW` filter so a `REJECTED` proposal does not permanently block the same topic from being re-proposed by a later, different source.

**Rejected:** (1) Deduping globally across all sources — would make one source's rejection permanently suppress a legitimate proposal from an unrelated source. (2) Not deduping at all — a single document with the same unknown topic on many questions (the common case) would flood the review queue with one row per question instead of one per topic.

---

## KU-1 part B — the naive label is generated, not left blank or AI-written

**Decision:** A miss-generated proposal gets `proposedLabel` from a pure string transform (`snake_case` → `Title Case`), not a blank string and not an AI call.

**Reason:** `proposedLabel` is required on the model (a reviewer needs *something* to read), but Path B's miss-handling has no AI step to ask — it is deterministic string-equality failure, not a judgement call, so there is nothing to set `aiConfidence` from either (left `null`). A blank label would look like a data-entry omission rather than a placeholder. A naive mechanical transform is honest about what it is — visibly not a real label — and cheap; a good Vietnamese or English label is exactly what the human review step (design doc §5, not yet built) exists to supply.

**Rejected:** Calling the AI provider to draft a label at this point. Would spend a real API call (and, given the current dead Gemini quota, silently fall back to Mock) on every single unmatched topic during an ordinary import, for output a human reviewer is going to look at and likely rewrite anyway.

---

## KU-1 part B — Rename is Approve-with-override, not a fifth function

**Decision:** The review queue has three functions — `approvePendingKnowledgeUnit()` (which accepts an optional `{ topic, label }` override), `mergePendingKnowledgeUnit()`, `rejectPendingKnowledgeUnit()` — not four. `reviewStatus` still records `RENAMED` distinctly from `APPROVED` when an override was actually applied.

**Reason:** The design doc's own description of Rename is "edit topic/label, then approve" — one reviewer action with two steps, not two independent operations with independent meaning (there is no standalone "rename without approving" state that means anything). Collapsing them avoids duplicating the collision check, the KnowledgeUnit creation, and the status-update logic across two functions that would otherwise need to stay in sync.

**Rejected:** A separate `renamePendingKnowledgeUnit()` that only edits `proposedTopic`/`proposedLabel` in place, requiring a second call to actually approve. Two calls for one reviewer action invites a proposal stuck half-renamed if the second call is never made, and duplicates logic for no benefit.

---

## KU-1 part B — a topic collision on Approve throws, not a silent Merge

**Decision:** If `approvePendingKnowledgeUnit()` resolves to a topic that already has a `KnowledgeUnit` (e.g. two different sources independently proposed the same topic and the other was approved first), it throws `TopicAlreadyExistsError` carrying the existing unit's id, rather than silently switching to merge behaviour.

**Reason:** A reviewer clicking Approve is asserting "this is a new, distinct concept" — reinterpreting that click as Merge would substitute the system's judgement for a human decision the design doc explicitly assigns to a person (§5, "the review queue (the human step)"). Carrying the existing unit's id in the error lets the caller (the API route, then the UI) offer "merge into it instead" as a one-click follow-up without a second lookup, so the human still ends up one click away from the likely-correct action — just not there by default.

**Rejected:** Silently merging on collision. Would mean a reviewer's Approve sometimes creates a KnowledgeUnit and sometimes doesn't, with no signal which happened, which is the kind of ambiguity this whole design exists to remove (`evidenceQuote` being load-bearing is the same principle applied to the miss-handling side).

---

## KU-1 part B — Rename skips question backfill; Merge and Approve do not

**Decision:** Approving with an unmodified topic and merging both bulk-link every `Question` row sharing the proposal's exact topic string to the resolved `KnowledgeUnit`. Approving *with* a topic override (Rename) links none.

**Reason:** Approve-unmodified is safe because the created unit's topic is, by construction, exactly the string already on the matching `Question` rows — there is nothing to get wrong. Merge is safe for the same reason on the source side (the proposal's `proposedTopic` still matches the existing questions), even though the *target* unit's topic differs on purpose (see the coverage-report caveat below). Rename is different in kind: the reviewer has just declared the AI's proposed topic string wrong or non-canonical, so blindly bulk-linking every `Question` still carrying the *old, rejected* string would apply a correction the reviewer may not have intended to every one of those rows without them seeing it. Existing M3.3 admin tools (`assignQuestionToKnowledgeUnit` / `getUnmappedQuestions`) already handle deliberate one-by-one reassignment; that is the correct tool for a renamed topic's cleanup, not an automatic bulk action hidden inside Rename.

**Rejected:** Bulk-linking by the *original* `proposedTopic` string even on Rename. Would auto-apply a correction to potentially many `Question` rows as a side effect of a name edit the reviewer made for the *new* `KnowledgeUnit`, not for those specific rows.

---

## KU-1 part B — Merge does not update `computeCoverageReport()`, and that is a recorded gap

**Decision:** `mergePendingKnowledgeUnit()` links matching questions via `Question.knowledgeUnitId` only. It does not rewrite `Question.topic`, and it does not change `computeCoverageReport()`'s string-matching behaviour.

**Reason:** `computeCoverageReport()` counts `q.topic === unit.topic` (M3.2's decision above, made before this review queue existed). A merge's entire purpose is to assert that two *different* topic strings represent the *same* concept — so after a merge, the target unit's topic will, by definition, not equal the merged questions' topic string. `Question.topic` is a normalized fact about the source data (also read by `ErrorNotebookEntry.concept` and elsewhere); silently rewriting it as a side effect of an admin merge action would be revisionist and could break other topic-string-dependent behaviour that has nothing to do with this review queue. Making `computeCoverageReport()` FK-aware instead is the right fix, but it means changing what M3.2 already decided for a different module — a decision that module's owner should make deliberately, not one this feature should make as a side effect.

**Rejected:** (1) Rewriting `Question.topic` on merge. (2) Silently making `computeCoverageReport()` also check the FK as part of this change. Both are real fixes to a real gap; both are out of scope here and are flagged instead of quietly patched.

---

## KU-1 part B, Path A — a separate `taxonomyCore.ts`, not added to `normalizationCore.ts`

**Decision:** The prompt, parser, and retry wrapper for taxonomy proposal live in a new `lib/ai/providers/taxonomyCore.ts`, not inside the existing `normalizationCore.ts`.

**Reason:** This repo already has a precedent decision on exactly this question — "M4.2 — Generation prompt in normalizationCore.ts (not a separate file)" above — and its own stated criterion is reuse: generation was kept in `normalizationCore.ts` because it reuses `parseDrafts()` and the `NormalizedQuestionDraft` shape. Taxonomy proposal reuses neither — its output shape (`proposedTopic`/`proposedLabel`/`evidenceQuote`/`confidence`) has nothing in common with a `Question`. Putting it in `normalizationCore.ts` would satisfy neither that decision's own test nor this one; it would only be proximity.

**Rejected:** Adding `PROPOSE_TAXONOMY_SYSTEM_PROMPT` and `proposeTaxonomyWithRetry()` into `normalizationCore.ts`. Mirrors the shape (prompt + parser + retry) without sharing any code.

---

## KU-1 part B, Path A — evidenceQuote is verified against the source text, not trusted

**Decision:** `taxonomyCore.ts`'s `verifyEvidenceQuotes()` checks that every proposal's `evidenceQuote` is a literal (whitespace-normalized only) substring of the actual extracted text before it is persisted. A proposal whose quote doesn't check out is dropped, not fixed, not fuzzy-matched.

**Reason:** `PendingKnowledgeUnit.evidenceQuote` is already documented as load-bearing — the entire review queue's trustworthiness rests on a reviewer being able to check "is this real" against something concrete. A model can assert a topic exists in a document without quoting it; an unverified quote that looks legitimate is worse than an obviously-fake one, because the reviewer trusts it without checking. Only whitespace (line-wraps, double spaces) is normalized before comparison — the same discipline already recorded for topic-string matching ("no fuzzy matching, no AI classification"): any other divergence (dropped words, paraphrase) means the model didn't actually quote the source, which is exactly the case this guard exists to catch.

**Rejected:** Trusting the model's `evidenceQuote` outright. Also rejected: fuzzy/similarity-based verification (e.g. edit distance) — would accept a paraphrase as a quote, defeating the field's purpose.

---

## KU-1 part B, Path A — a rejected quote is silently dropped, but the COUNT is not

**Decision:** `ProposeTaxonomyResult` carries `rejectedByVerification: number` (a count) rather than either silently discarding rejected proposals with no trace, or surfacing their full detail (the fabricated text, the reason) through the `AIProvider` interface boundary.

**Reason:** Silently dropping the count entirely would be exactly the kind of invisible discrepancy the `AIStatusLine` truthfulness fix already exists to prevent elsewhere in this codebase (`servedBy`/`fallbackReason` on `NormalizeQuestionsResult`/`GenerateQuestionsResult`) — the model proposed N things, only some survived, and a caller needs to know that gap exists. But the full rejected detail is internal QA information, not something an admin UI needs to render per-item; a count is enough to show "N were filtered" without piping fabricated-quote text through an interface whose other callers don't expect it.

**Rejected:** (1) Dropping rejected proposals with no signal at all — the AIStatusLine precedent this repo already set says that's a lie by omission. (2) Threading the full `rejected` detail array through `AIProvider.proposeTaxonomy()` — the interface boundary is the wrong place for QA debug detail that only `taxonomyCore.ts` itself needs.

---

## KU-1 part B, Path A — B-1(b) ruled: read full text directly, no chunking yet

**Decision:** `taxonomyReader.ts` sends the source's entire extracted text to the AI provider in one call. No document chunking, no separate "summarize the structure first" step.

**Reason:** This is design doc §7's own recorded recommendation (B-1), now actually built rather than left as an open option. The documents this repo actually has (seeded `ContentSource` rows, real import sources) are import-pipeline-sized, not book-length — chunking exists in the codebase (`chunker.ts`) for exactly the multi-hundred-question case Path A hasn't needed yet. Building a chunked/summary-first path speculatively, before a real source proves the single-call approach insufficient, would be exactly the kind of scope this repo's own Constitution (Ch.1 §9) argues against — content-shaped decisions belong to evidence, not anticipation.

**Rejected:** Chunking every source up front "to be safe". Reuses none of `chunker.ts`'s Vietnamese-exam-specific header regex anyway (see `KU1_PARTB_DESIGN.md` §3.5), so building chunking support now would mean building a second, taxonomy-specific chunker for a case that hasn't occurred yet.

---

## KU-1 part B — merge criterion: identical rule, not merely similar structure

**Decision:** Resolving the 62 real pending proposals (2026-07-15), a merge required the underlying grammar RULE to be identical — not just a similar sentence-transformation shape. Confirmed by reading each candidate pair's actual `correctOption` data, not by topic-name similarity. Applied once: `modal_verbs_should` → `modal_verbs_advice` (both proposals' real answers are "should" for advice-giving; different only because two different exam chunks produced two different topic-string guesses for the same rule). Everything else — including pairs with genuinely similar mechanics, e.g. `reported_commands` vs `reported_requests` (both "S + verb + O + to-infinitive", differing only in the reporting verb ask/tell) — was approved as its own distinct KnowledgeUnit.

**Reason:** Under-merging (keeping two KUs that turn out to be the same thing) is a one-click fix later via this same review queue. Over-merging (collapsing two genuinely different skills into one KU) silently destroys the distinction — a learner who has mastered reported commands but not reported requests would show as "mastered" on a merged unit, which is exactly the failure mode the Decision Engine's Knowledge State work (`DECISION_ENGINE_OPTIONS.md`) depends on not happening. Reading real answer data rather than trusting topic-name resemblance matters for the same reason `taxonomyCore.ts`'s evidence-quote verification exists: a plausible-looking merge that turns out wrong is worse than an obviously-unmerged pair, because nobody double-checks it.

**Rejected:** Merging on topic-name or evidence-sentence similarity alone (would have wrongly merged `reported_commands`/`reported_requests`, four `relative_clauses_*` sub-types, and three `passive_voice_*` sub-types — each verified via real answer data to test a mechanically distinct rule).

---

## KU-1 — seed durability: a `KNOWN_TOPIC_MERGES` map, not renaming `Question.topic`

**Decision:** `prisma/seed.ts`'s `linkQuestionsToKnowledgeUnits()` tries a direct topic-string match first, then falls back to a small hardcoded `KNOWN_TOPIC_MERGES` record (3 entries: the two `present_perfect_*` phrasing variants and `modal_verbs_should`, each mapped to the KU they were merged into) — rather than rewriting those 4 questions' `topic` field to match their target KU.

**Reason:** Verified empirically: without this map, a from-scratch reseed (fresh SQLite file, `prisma db push` + `npm run db:seed`) leaves exactly 4 of 118 questions unmapped — precisely the ones on a merged topic, because the review queue's MERGE action deliberately never creates a `KnowledgeUnit` whose topic equals theirs (see "KU-1 part B — Merge does not update `computeCoverageReport()`" above). The map is the seed-time encoding of a decision that already happened once, live, through `mergePendingKnowledgeUnit()` — reproducing it must reproduce that exact prior human decision, not re-derive a new one. Rewriting `Question.topic` instead would fix the seed-time symptom but reopen the exact hazard the merge decision above already rejected: `Question.topic` is read elsewhere (`ErrorNotebookEntry.concept`, `computeCoverageReport()`), so changing it here would be the same silent, hard-to-audit side effect on 4 rows this time instead of one row at a time through the reviewed UI path.

**Rejected:** Rewriting `Question.topic` to the merge target during seeding. Also rejected: leaving the 4 questions unmapped on a fresh seed and treating it as an acceptable gap — `V1_V2_RECONCILIATION.md` §6's gate is specifically "122/122 linked", and a reseed silently regressing 4 of them defeats the entire point of making the registry durable.
