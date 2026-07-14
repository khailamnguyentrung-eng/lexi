# LEXI — Project Status

_Last updated: 2026-06-30_

---

## Completed Milestones

### Phase 1 — Student Intelligence Layer
- **M1.1** Analytics engine (mastery, accuracy, topic coverage)
- **M1.2** Narrative & session reports
- **M1.3** Error notebook intelligence
- **M1.4** Practice recommendations
- **M1.5** StudentLearningProfile v1

**Phase 1 total: 148 tests passing**

---

### Phase 2 — Companion Intelligence Layer
- **M2.1** SM-2 spaced repetition (review scheduling, ease factor)
- **M2.2** Behavior engine (pace profile, mood context, time-of-day)
- **M2.3** Adaptive practice (DifficultyTarget, session calibration)
- **M2.4** Learning signal engine (RECURRING_WEAKNESS, RETENTION_RISK, etc.)
- **M2.5** StudentLearningProfile v2 (unified intelligence view)

**Phase 2 total: 368 tests passing**

---

### Phase 3 — Content Intelligence Layer

#### M3.1 — Knowledge Unit Foundation ✓ (2026-06-29)
Schema only. KnowledgeUnit, KnowledgeUnitOnSession, QuestionGenerationJob, GenerationJobStatus.
Nullable FKs on Question (knowledgeUnitId, generatedViaJobId) and ExtractedQuestionDraft (generationJobId).

#### M3.2 — Knowledge Coverage Intelligence ✓ (2026-06-29)
Pure coverage engine: `computeCoverageReport()`, `computeAllCoverageReports()`, `detectGaps()`, `filterGapsByPriority()`.
Service layer: `getAllKnowledgeUnits()`, `getKnowledgeCoverageReport()`.
**42 tests**

#### M3.3 — Question ↔ KnowledgeUnit Mapping ✓ (2026-06-29)
Pure matching: `findMatchingKnowledgeUnitId()`. CRUD: `assignQuestionToKnowledgeUnit()`, `getUnmappedQuestions()`, etc.
Import pipeline integration: `autoAssignKnowledgeUnit()` called in `approveDraft()` (non-throwing, backward compatible).
**46 tests**

#### M3.4 — Content Validation Layer ✓ (2026-06-29)
Pure validation engine: completeness, mapping quality, difficulty distribution checks.
Severity ladder: LOW/MEDIUM/HIGH → PASS/WARNING/FAIL.
Service layer: `validateAllQuestions()`, `validateSingleQuestion()`, `validateKnowledgeUnitCoverage()`.
**80 tests**

---

### Phase 4 — Generation Pipeline

#### M4.1 — Question Generation Foundation ✓ (2026-06-29)
Job lifecycle types and state machine (`VALID_JOB_TRANSITIONS`). Placeholder `generateDraftQuestions()` (returns []). Validation bridge `validateGeneratedDrafts()` reusing contentValidation.ts.
**79 tests**

#### M4.2 — AI Generation Integration ✓ (2026-06-29)
`AIProvider.generateQuestions()` added to interface + all three providers (claude, gemini, mock) + `withRuntimeFallback`.
`contextBuilder.ts`: pure `buildGenerationContext()`, `deriveCountFromGap()` — clamps requested count to actual gap.
`aiDraftGenerator.ts`: `toGeneratedDraft()` (conversion), `callGenerationProvider()` (injectable for testing), `generateDraftsForGap()` (full orchestration with job status transitions and error handling).
Generation prompt added to `normalizationCore.ts` (`GENERATE_QUESTIONS_SYSTEM_PROMPT`, `generateWithRetry()`).
Error handling: AI failure → job FAILED, empty result returned, no fake drafts created.
**78 tests**

#### M4.3 — Generated Draft Persistence & Review Pipeline ✓ (2026-06-29)
New Prisma model: `GeneratedQuestionDraft` — separate from `ExtractedQuestionDraft` (different provenance, different FK target).
New DB enum: `DraftValidationStatus` (PASS / WARNING / FAIL).
Schema: backrelations added to `QuestionGenerationJob.generatedDrafts` and `KnowledgeUnit.generatedDrafts`.
Migration: `20260629141215_add_generated_question_draft`.
`generatedDraftRepository.ts`: `createDraftsForJob()`, `listDraftsByJob()`, `getDraft()`, `approveDraft()`, `rejectDraft()`.
`approveDraft()`: FAIL drafts blocked, idempotent (approvedQuestionId guard), creates Question with `generatedViaJobId` + `knowledgeUnitId` provenance, auto-completes job when last draft resolved.
`GeneratedQuestionDraft` TypeScript interface extended with `questionCode`, `type`, `skill`.
`aiDraftGenerator.ts` updated: `toGeneratedDraft()` now preserves these fields; `generateDraftsForGap()` calls `createDraftsForJob()` after validation.
**85 tests**

#### M4.4 — Generation Quality & Evaluation Layer ✓ (2026-06-29)
Pure deterministic quality engine for generated drafts. No Prisma, no AI calls, no embeddings.
`qualityTypes.ts`: shared types — `QualityIssue`, `GenerationQualityReport`, `DraftEvaluationInput`, `ExistingContentSnapshot`, `KnowledgeUnitEvaluationContext`.
`qualityEvaluation.ts`: three checks + score:
- `checkDuplicates()` — exact code (HIGH), exact prompt (HIGH), normalized prompt (MEDIUM)
- `checkTopicAlignment()` — topic mismatch → HIGH
- `checkDifficultyConsistency()` — no target for band → HIGH, band at/above target → MEDIUM
- `computeScore()` — 0–100 deduction table (HIGH=-30, MEDIUM=-15, LOW=-5), clamped to [0, 100]
- `evaluateDraft()` — consolidated report entry point
Quality is informational only — assists human review, never triggers auto-approve or auto-reject.
**88 tests**

---

### Phase 5 — Learner Model Intelligence

#### M5.5 — StudentLearningProfile v3 Assembly ✓ (2026-06-29)
Pure assembly layer composing all five Phase 5 engines into a single `LearnerModel` snapshot.
`learnerProfileBuilder.ts`: `assembleLearnerModel(LearnerModelInput)` → `LearnerModel` — calls each engine exactly once, no new inference rules.
`StudentLearningProfile` extended with `learnerModel: LearnerModel` (required field).
`getStudentLearningProfile()` updated: adds `prisma.questionAttempt.findMany()` to parallel fetch; two-pass signal injection overrides `learnerModel` with real signals after `computeLearningSignals()` runs.
Data shared across engines: `attempts` → performance + problem-solving; `behaviorProfile` → behavior + preference; `activeWeaknesses` → knowledge + problem-solving.
`ExplicitPreferences` accepted as optional input — not yet DB-backed; all explicit-only dimensions stay UNKNOWN until a `LearnerPreferences` schema is added.
**144 tests**

#### M5.4 — Problem Solving Pattern State ✓ (2026-06-29)
Four-dimension behavioral snapshot of how the learner responds to difficulty.
`problemSolvingState.ts`: `computeProblemSolvingState(attempts, activeWeaknesses)` — produces `ProblemSolvingState`.
`PatternEntry<T>`: each dimension has `value`, `evidence` (human-readable), `confidenceTier`.
`retryPattern`: single chronological scan of `AttemptRecord[]`; retry = wrong attempt followed by any attempt within 10-minute window; FREQUENT_RETRIER ≥60%, OCCASIONAL_RETRIER ≥25%, RARELY_RETRIES <25%.
`feedbackRecovery`: post-error retry success rate from same scan; RECOVERS_QUICKLY ≥65%, GRADUAL_RECOVERY ≥35%, SLOW_RECOVERY <35%.
`helpSeeking`: `ActiveWeakness.isRemedialFlagged` proportion; ACTIVE_ENGAGEMENT ≥50%, SOME_ENGAGEMENT ≥20%, LOW_ENGAGEMENT <20%. Hint tracking not in data model; remedial flag is current proxy.
`errorCorrection`: `ActiveWeakness.signal` classification; ERRORS_REDUCING (≥60% IMPROVED/IMPROVING), ERRORS_PERSISTING (≥50% RECURRING), ERRORS_STABLE (neither).
All value labels verified against prohibited trait-label list in test suite (section 12).
**167 tests**

#### M5.3 — Learning Preference State ✓ (2026-06-29)
Seven-dimension preference snapshot. Each dimension is a `PreferenceEntry<T>` with `value`, `source` (EXPLICIT / OBSERVED / NONE), and `confidenceTier`.
`preferenceState.ts`: `computeLearningPreferenceState(behaviorProfile, explicitPreferences?)` — resolves each dimension in priority order: explicit override → observed behavioral pattern → "UNKNOWN".
Two dimensions have observed data sources: `practiceTime` (from BehaviorProfile.preferredTimeOfDay) and `sessionDuration` (from avgSessionDurationMin bucketed SHORT/MEDIUM/LONG).
Five dimensions (explanationDepth, hintFrequency, feedbackTiming, practiceMode, languagePreference) are UNKNOWN until explicit preferences are set — no behavioral inference applied.
Explicit preferences always carry OBSERVED confidence (one data point). Observed preferences inherit BehaviorProfile.confidenceTier. NONE source always OBSERVED.
`ExplicitPreferences` input is optional and null-safe — null field values fall through to observed data.
**154 tests**

#### M5.2 — Learning Behavior State Integration ✓ (2026-06-29)
Pure transformation engine that maps BehaviorProfile (M2.2) into the Phase 5 learner model format. No new Prisma queries. No AI.
`behaviorState.ts`: `computeLearningBehaviorState(behaviorProfile)` — restructures BehaviorProfile into five behavior dimensions: sessionPattern, completionBehavior, paceObservation, retryBehavior, engagementObservation.
`EngagementLevel` derived from session count: HIGHLY_ACTIVE ≥20, ACTIVE ≥10, OCCASIONAL ≥3, INACTIVE <3.
`retryBehavior.responseTimeSignal` is explicitly a behavioral proxy (response time), not a motivation inference.
`confidenceTier` inherited from BehaviorProfile (CONFIRMED ≥10 sessions, EMERGING ≥5, OBSERVED <5).
All output fields describe observed actions only — no personality or motivation labels.
**89 tests**

#### M5.1 — Learner State Foundation ✓ (2026-06-29)
Pure deterministic engines for Knowledge State and Performance State. No Prisma, no AI, no new schema.
`lib/services/learner-intelligence/types.ts`: shared pure types — KnowledgeState, PerformanceState, ConceptEntry, AttemptRecord, SkillAccuracyInput, SkillPerformance.
`knowledgeState.ts`: `computeKnowledgeState(masteryProfiles, activeWeaknesses, signals)` — classifies topics into mastered/developing/weak buckets; orders weak concepts by remedial flag then occurrence count; derives confidence tier from topic count + behavioral signal count.
`performanceState.ts`: `computePerformanceState(attempts, skillAccuracies)` — computes accuracy trend (IMPROVING/STABLE/DECLINING/INSUFFICIENT_DATA) via chronological split; consistency profile (CONSISTENT/VARIABLE/ERRATIC) via 3-window variance; per-skill tier (STRONG/DEVELOPING/WEAK); confidence from attempt count.
Engines are separate from StudentLearningProfile — profile is a snapshot contract, not an intelligence container.
**100 tests**

---

---

### Phase 6 — LEXI Lens

**Removed 2026-07-13.** The standalone `/lens` page, nav entry, `lib/services/lens/`, and its page-only UI components were deleted per a product decision to retire the feature. The M6.1–M6.4 history below is kept as-is (repository history is architectural evidence, not rewritten) — none of it describes currently-existing code. `lib/services/lens-ai/` (Phase 7, below) is a different, unaffected capability.

#### M6.4 — Learner Lens Experience Prototype ✓ (2026-06-30)
First real LEXI learner experience screen. Route `/lens` — server-rendered, theme-aware, responsive.
`app/(app)/lens/page.tsx`: Server Component — `getCurrentUser()` → `getLearnerLens(userId)` → `LensViewModel` → `LensPageContent`. Zero engine imports.
`app/(app)/lens/LensPageContent.tsx`: Client Component wrapping `ThemeProvider`. Renders 5 sections: Summary (LensCard + 4 ProgressCard metric tiles), Insights (InsightCard per insight), Strengths (ProgressCard per item), Challenges (ProgressCard + trend mapping from RECURRING/IMPROVING/STABLE signal), Next Actions (priority-ordered list with Link buttons to `/error-notebook`, `/practice/topic/:topic`, `/practice/:session`).
`components/lens/ThemeSwitcher.tsx`: Client Component using `useTheme()` — three `aria-pressed` buttons (Default / Calm / Focus).
All 5 sections have explicit empty states. No hardcoded colors; all via `var(--theme-*)`.
Nav updated: added 🔍 Lens link to header + mobile bottom nav.
**60 tests**

#### M6.3 — Design System Foundation ✓ (2026-06-30)
Token-based theme system. No hardcoded colors in any Lens component.
`lib/ui/theme/tokens.ts`: `ThemeConfig` interface (6 sub-interfaces — colors, typography, spacing, radius, shadows, motion) + `THEME_VAR_NAMES` constant (34 CSS variable name strings).
`lib/ui/theme/themes.ts`: `defaultTheme` (violet/purple; mirrors existing globals.css), `calmTheme` (teal-blue; more spacing), `focusTheme` (high-contrast dark; sharp radius) + `themeToCssVars(theme)` + `availableThemes[]`.
`components/ui/ThemeProvider.tsx`: Client component — injects 34 CSS vars as inline `style` on wrapper div; `useTheme()` hook exposes `{ theme, setTheme, availableThemes }`.
Lens components — data-props-only, all colors from `var(--theme-*)`:
`LensCard` (generic card wrapper), `InsightCard` (insight type + confidence accent + narrative), `ProgressCard` (metric + trend arrow), `SectionHeader` (heading + badge).
**78 tests**

#### M6.2 — Lens Service Contract ✓ (2026-06-30)
Stable view contract: single `getLearnerLens(userId)` entry point for all Lens consumers.
`lib/services/lens/lensService.ts`: `assembleLensViewModel(profile)` — pure orchestrator calling all five Phase 6.1 transformers in order; exported separately for testing without DB access. `getLearnerLens(userId)` — async wrapper fetching `StudentLearningProfile v3` then assembling the view; one DB round-trip via the existing profile service.
Transformers are independent — no transformer output is passed as input to another. All five read directly from the same `StudentLearningProfile` argument.
**61 tests**

#### M6.1 — Lens Intelligence Layer ✓ (2026-06-30)
Pure transformation layer: StudentLearningProfile v3 → five Lens views. No new inference, no DB, no AI.
`lib/services/lens/types.ts`: `LensViewModel`, `LearnerSummary`, `LearningInsight`, `StrengthItem`, `ChallengeItem`, `RecommendationItem` — every item carries `confidenceTier` + `source`. Confidence mapping utilities: `mapConfidenceTier`, `mapSignalConfidence`, `mapRecommendationConfidence`.
`learnerSummary.ts`: `buildLearnerSummary(profile)` — engagement opening, trend phrase, problem-solving pattern, knowledge landscape, mood context.
`learningInsights.ts`: `extractLearningInsights(profile)` — up to 3 insights: PRIMARY_SIGNAL, ACCURACY_TREND, CONSISTENCY, RECOVERY (priority-ordered; CONSISTENCY gated at EMERGING+ confidence).
`strengths.ts`: `deriveStrengths(profile)` — MASTERED_TOPIC (gated: omit if OBSERVED), DEVELOPING_TOPIC (always), STRONG_SKILL (gated: omit if OBSERVED). Max 8 items.
`challenges.ts`: `deriveChallenges(profile)` — ACTIVE_WEAKNESS (up to 5; IMPROVED excluded), WEAK_SKILL (up to 3), HELP_SEEKING_GAP, ERROR_PATTERN. Max 7 items.
`recommendations.ts`: `buildLensRecommendations(profile)` — transforms existing `PracticeRecommendation[]` only; enriches with preference hints (EXAM_SIMULATION, SHORT session); streak context if ≥7 days.
**127 tests**

---

### Phase 7 — LEXI Lens AI

#### M7.2 — Image Understanding Foundation ✓ (2026-06-30)
OCR abstraction layer for image capture types. IMAGE_UPLOAD and SCREENSHOT_REGION now flow through `extractTextFromImage()` before the existing AI pipeline.
`lib/services/lens-ai/understanding/types.ts`: `OcrResult`, `OcrProvider` interface.
`lib/services/lens-ai/understanding/ocr.ts`: `MockOcrProvider` (confidence 0.9 for non-empty base64; null for empty), `getOcrProvider()`.
`lib/services/lens-ai/understanding/imageProcessor.ts`: `OcrExtractionError`, `extractTextFromImage(payload, provider?)` — runs OCR, sets `OCR_CONFIDENCE_LOW` flag when confidence < 0.7.
`lib/services/lens-ai/capture.ts` extended: `createImageCapture(type, image, mimeType?, metadata?)` — validates base64 + positive dimensions.
`lib/services/lens-ai/lensAssistant.ts` updated: mode check before type routing; IMAGE_UPLOAD/SCREENSHOT_REGION → OCR → existing pipeline; OCR flags prepended to response flags; CAMERA_CAPTURE still throws (Phase 7.3).
`scripts/test-lens-image-understanding.mjs`: 92 assertions across 9 sections.

#### M7.1 — Text Selection Lens Foundation ✓ (2026-06-30)
Pure AI assistant layer for TEXT_SELECTION + EXPLAIN mode. No DB, no OCR, no profile reads.
`lib/services/lens-ai/types.ts`: `CapturePayload` (discriminated union on `type`), `LensLearningContext`, `LensResponse`, `LensFlag` (9 values), `InteractionMode` (6 values), `IMPLEMENTED_MODES` (["EXPLAIN"]), `ANONYMOUS_CONTEXT`.
`lib/services/lens-ai/capture.ts`: `createTextSelectionCapture()` (UUID + timestamp auto-assigned), `validateCapturePayload()` (throws `CaptureValidationError` on malformed input).
`lib/services/lens-ai/promptBuilder.ts`: `EXPLAIN_SYSTEM_PROMPT` (bilingual vi+en instruction), `buildExplainUserMessage()` (pure; adapts depth line per BEGINNER/INTERMEDIATE/ADVANCED), `parseLensExplainResponse()` (strips code fences, clamps confidence 0–1, degrades gracefully on non-JSON via `AI_PARSE_ERROR` flag).
`lib/services/lens-ai/lensAssistant.ts`: `captureAndAssist(payload, mode, userId?)` — orchestrator: validate → type guard → mode guard → anonymous context → `AIProvider.chat()` → parse. Unimplemented modes return `MODE_NOT_IMPLEMENTED` flag (not throw). Image types throw `LensError` ("requires Phase 7.2").
Reuses existing `getAIProvider()` — no new AI client, no new interface method.
Mock provider degrades gracefully: `AI_PARSE_ERROR` flag set, raw text used as explanation.
`scripts/test-lens-ai-foundation.mjs`: 87 tests across 9 sections (pure function tests, no server).

---

## Current Total: 2173 tests passing

---

## Pending Milestones

### M4.5 — Admin API endpoint
Wire `generateDraftsForGap()` into a POST `/api/admin/question-generation` handler.
Requires auth guard (ADMIN role), request validation, KnowledgeUnit lookup, and job creation.

### M3.5 — Ingestion Enhancements
Real OCR for IMAGE files (Tesseract.js or cloud OCR).
Smart document chunking (numbered question list detection).
Passage extraction for READING_COMPREHENSION questions.

### M3.6 — Semantic Validation Layer
Duplicate detection (exact code match + fuzzy promptText match).
AI-assisted semantic validation (correctOption consistency check).
SemanticValidationResult model + DraftReviewCard warnings.

---

## Architecture Invariants

1. **No Question creation without human approval.** `approveDraft()` is the only code path that creates a Question row.
2. **No AI logic in UI.** All intelligence lives in pure engine or service layer.
3. **No Prisma in pure engines.** contentValidation.ts, knowledgeCoverage.ts, knowledgeGap.ts, contextBuilder.ts are all DB-free.
4. **Generated drafts flow through the same validation gate as extracted questions.** contentValidation.ts is the single source of truth for question quality checks.
5. **AI provider failures never block the pipeline.** `withRuntimeFallback` degrades to mock; `generateDraftsForGap` catches errors and marks the job FAILED rather than surfacing an exception to the caller.
