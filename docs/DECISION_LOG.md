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

**Decision:** `getLearnerLens(userId)` in `lensService.ts` is the single entry point for all Lens consumers (student dashboard, session results, parent/teacher view). It fetches `StudentLearningProfile v3` and passes it to `assembleLensViewModel()`, which calls all five Phase 6.1 transformers. Consumers receive a `LensViewModel` — they never interact with `StudentLearningProfile`, `LearnerModel`, or any Phase 5 engine output directly.

**Reason:** UI evolution should not require changing intelligence engines. If a dashboard component is updated to show a new layout for strengths, that change must not touch `knowledgeState.ts`, `performanceState.ts`, or any Phase 5 logic. The `LensViewModel` contract is the boundary: intelligence lives below it, presentation lives above it. With `assembleLensViewModel` exported as a pure function, the contract is independently testable without triggering a DB fetch, and UI authors have a single stable type to depend on.

**Rejected:** UI directly consuming internal intelligence models (e.g. a dashboard reading from `learnerModel.knowledgeState.masteredConcepts` directly). Would create a tight coupling between UI rendering and the exact field structure of Phase 5 engine outputs — every engine refactor would cascade into UI components. Also rejected: a "thin" service that merely re-exports `getStudentLearningProfile`. That would leave the transformation responsibility undefined and force each consumer to independently call Lens transformers.

---

## M6.1 — LEXI Lens transforms learner intelligence into understandable views

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
