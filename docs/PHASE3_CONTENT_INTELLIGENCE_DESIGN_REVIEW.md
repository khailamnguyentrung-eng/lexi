# LEXI Phase 3 — Content Intelligence
## Design Review

_Created: 2026-06-29. M3.1 foundation implemented and verified._

---

## 1. Phase 3 Goal

Phase 1 built the student-facing intelligence layer: analytics, mastery tracking, adaptive
recommendations, and a unified StudentLearningProfile. Phase 2 deepened the companion layer:
SM-2 spaced repetition, behavior engine, difficulty calibration, learning signals.

The question bank across both phases is **reactive**: admins upload existing exam documents,
AI extracts questions already present in those documents, humans approve them. The bank grows
only as fast as admins can source and upload materials.

**Phase 3 makes the bank proactive.**

Three capabilities:

| Capability | What it means |
|---|---|
| **Coverage Awareness** | Know exactly what the bank contains per topic and difficulty level |
| **Gap-Driven Generation** | Detect where coverage is thin; generate targeted questions to fill those gaps |
| **Quality Gating** | Validate questions beyond shape — verify answer correctness and explanation accuracy before questions reach students |

These three capabilities together constitute **Content Intelligence**: the system understands
what the curriculum needs and builds toward it, rather than passively accepting whatever
documents happen to be uploaded.

**Phase 3 preserves all existing learning flows.** Students see no changes. The admin import
pipeline is extended, not replaced. Every intelligence engine from Phase 1 and Phase 2 is
untouched.

---

## 2. Content Intelligence Architecture

Phase 3 extends the existing four-layer model from Phase 1/2:

```
Content Repository (DB)
  KnowledgeUnit, KnowledgeUnitOnSession, QuestionGenerationJob, SemanticValidationResult
       ↓
Content Engine (pure functions — no DB, no side effects)
  computeTopicCoverage()
  detectCoverageGaps()
  rankGapsByStudentSignal()
  buildGenerationPrompt()
  runSemanticValidation()
       ↓
Content Service (orchestrates repository + engine — no Prisma in engine)
  getContentGapReport()
  runGenerationJob()
  runSemanticValidation()
       ↓
Admin UI (no logic — delegates to service)
  Coverage dashboard
  Generation trigger
  Enhanced draft review card (semantic validation warnings)
```

The same architectural rule from Phase 1/2 applies:
- **Repository** — DB queries only; no computation
- **Engine** — pure functions; no DB access; fully testable without Prisma
- **Service** — orchestrates repository + engine; no Prisma directly
- **Route** — auth, parse, delegate to service, return JSON

Phase 3 adds one new top-level service module: `lib/services/content-intelligence/`

```
lib/services/content-intelligence/
  coverageEngine.ts     ← pure coverage computation
  gapAnalysis.ts        ← pure gap detection + student-signal ranking
  generationEngine.ts   ← pure prompt construction for AI generation
  semanticValidator.ts  ← pure validation helpers
  contentService.ts     ← service layer: orchestrates all four above
  repository.ts         ← DB queries (KnowledgeUnit, coverage data)
```

---

## 3. Document Ingestion Flow (Enhanced)

The current 6-step pipeline remains structurally unchanged. Phase 3 adds three enhancements
inside existing steps — no new pipeline steps, no new API routes for ingestion.

### Current flow (unchanged structure)

```
Upload (POST /api/admin/content-sources)
    ↓ file stored to uploads/
ContentSource row created
    ↓ admin triggers extraction
ImportJob created (status: EXTRACTING)
    ↓ extractor.ts dispatches by fileType
Raw text extracted
    ↓ ai-normalizer.ts → normalizationCore.ts
AI normalizes → JSON array of NormalizedQuestionDraft
    ↓ validator.ts
Shape validation → ExtractedQuestionDraft rows (PENDING_REVIEW or REJECTED)
    ↓ admin reviews in DraftReviewCard
Human approves → approveDraft() → Question created
```

### Enhancement 1: Real OCR for IMAGE files

**Current state:** `extractor.ts` returns a placeholder string for `ContentFileType.IMAGE`.
No text is extracted from image-based documents.

**Phase 3 change:** Replace the placeholder with real OCR inside the same `Extractor` interface.
The `extract()` method signature is unchanged — only the IMAGE case body changes.

Options (evaluated at implementation time):
- `tesseract.js` — open source, runs in Node.js, supports Vietnamese (`vie` language data)
- Cloud OCR API (e.g., Google Document AI) — higher accuracy for Vietnamese handwriting
  and mixed-layout documents; requires API key + costs

All other pipeline steps remain identical after OCR produces raw text.

**OCR quality flag:** Low-confidence characters (score below threshold) should be marked in
the extracted text so DraftReviewCard can surface a warning to human reviewers.

### Enhancement 2: Smart Document Chunking

**Current state:** `chunker.ts` splits documents only when it detects `"PHẦN N – ĐỀ TEST..."`
section headers. Documents without this convention are processed as one large chunk, which risks
hitting AI context limits and producing lower-quality normalization.

**Phase 3 change:** Generalise chunker.ts with a secondary detection strategy:
- Primary: existing section header detection (unchanged)
- Secondary: numbered question list detection — detect boundaries by patterns like
  `^\d+\.\s`, `^Câu \d+`, `^Question \d+` — group into chunks of ≤30 questions
- Fallback: split by character count with overlap (existing behavior)

The `normalizeWithRetry` function in `normalizationCore.ts` already handles per-chunk calls.
No changes to the AI prompt or response parsing.

### Enhancement 3: Passage Extraction for Reading Comprehension

**Current state:** `Question.passageId` FK and the `Passage` model exist in the schema.
The import pipeline does not extract or link passages — `READING_COMPREHENSION` questions
are imported with `passageId: null`.

**Phase 3 change:** Detect passage blocks (continuous prose above a numbered question cluster)
during extraction and create `Passage` rows before creating `Question` rows on approval.

Detection heuristic: a paragraph of ≥200 characters followed by ≥2 numbered questions
that reference "the passage," "đoạn văn," "the text above," or similar.

`approveDraft()` is extended to:
1. If the draft's `passageContext` field is populated, check if a matching `Passage` row already
   exists (by exact text hash) — create one if not
2. Set `passedQuestionId` on the created Question

No UI change needed: DraftReviewCard already renders `normalizedData` fields — `passageContext`
can be displayed as a collapsible preview.

---

## 4. Knowledge Unit Model

A **Knowledge Unit** is the atomic curriculum concept — the bridge between individual questions
and curriculum sessions.

### Purpose

Currently there is no stable registry of "what topics exist." Topics are strings on `Question.topic`,
normalized by AI during extraction. There is no canonical list. This causes:
- No way to set a target question count per topic
- No way to detect that a topic is under-covered without querying Questions directly
- No authoritative mapping from topic → curriculum sessions

The Knowledge Unit registry fixes all three.

### Proposed Schema

```prisma
model KnowledgeUnit {
  id                String              @id @default(cuid())
  topic             String              @unique   // matches Question.topic exactly
  label             String                        // human-readable Vietnamese label
  targetEasyCount   Int                 @default(5)
  targetMediumCount Int                 @default(5)
  targetHardCount   Int                 @default(3)
  sessions          KnowledgeUnitOnSession[]
  questions         Question[]          // bidirectional: all questions for this topic
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  @@index([topic])  // for efficient lookup during coverage computation
}

model KnowledgeUnitOnSession {
  knowledgeUnit         KnowledgeUnit    @relation(fields: [knowledgeUnitId], references: [id])
  knowledgeUnitId       String
  curriculumSession     CurriculumSession @relation(fields: [curriculumSessionId], references: [id])
  curriculumSessionId   String
  @@id([knowledgeUnitId, curriculumSessionId])
}
```

`Question` gains a nullable FK:
```prisma
// on existing Question model
knowledgeUnitId  String?
knowledgeUnit    KnowledgeUnit? @relation(fields: [knowledgeUnitId], references: [id])
```

### Seeding & Target Strategy

The initial Knowledge Unit registry can be seeded from:
1. The distinct `topic` values already present in the `Question` table
2. `CurriculumSession.grammarTopics` and `.vocabThemes` arrays — which already enumerate
   the topic vocabulary used in curriculum planning

No new topics are invented. The registry formalizes what already exists in the schema.

**Target Question Counts:** All KnowledgeUnits use the same global defaults for Phase 3:
- `targetEasyCount = 5`
- `targetMediumCount = 5`
- `targetHardCount = 3`

These are applied uniformly across all topics. Per-curriculum-session or per-school overrides
are deferred to Phase 4+ when multi-student data clarifies which topics are truly high-value
vs low-priority. For the single-student prototype, honest coverage reporting (5/5/3) is more
useful than introducing override complexity.

### Relationship to Canonical Topic

`lib/analytics/canonicalTopic.ts` already normalizes topic strings (e.g.,
`"Present Simple"` → `"present_simple"`). All AI-extracted topics already pass through
`canonicalTopic()` before storage. `KnowledgeUnit.topic` always stores the canonical form.
No conflict.

---

## 5. Content Gap Analysis Engine

### Purpose

Given the Knowledge Unit registry (what topics exist and what counts are targeted) and the
Question table (what actually exists), the gap engine computes per-topic coverage status.

### Pure Engine

```typescript
// lib/services/content-intelligence/coverageEngine.ts

interface TopicCoverage {
  topic: string
  label: string
  actual:  { easy: number; medium: number; hard: number }
  target:  { easy: number; medium: number; hard: number }
  gap:     { easy: number; medium: number; hard: number }  // max(0, target - actual)
  status:  "COVERED" | "PARTIAL" | "EMPTY"
}

function computeTopicCoverage(
  questions: { topic: string; difficulty: "EASY" | "MEDIUM" | "HARD" }[],
  knowledgeUnits: KnowledgeUnit[]
): TopicCoverage[]
```

Status rules:
- `COVERED` — all three difficulty gaps = 0
- `EMPTY` — all three actual counts = 0
- `PARTIAL` — any gap > 0 but not all zero

No AI. No DB. Service fetches data; engine computes; route returns JSON.

### Gap Ranking by Student Signal

The Phase 2 → Phase 3 connection:

```typescript
// lib/services/content-intelligence/gapAnalysis.ts

function rankGapsByStudentSignal(
  gaps: TopicCoverage[],
  signals: LearningSignal[]   // from computeLearningSignals()
): TopicCoverage[]
```

Topics with active `RECURRING_WEAKNESS` or `RETENTION_RISK` signals are ranked first —
the bank's most urgent gaps are the ones currently hurting students, not abstract ones.

Topics with no student signal are ranked by gap magnitude (largest gap first).

### Content Gap Report

```typescript
interface ContentGapReport {
  generatedAt: string
  totalTopics: number
  coveredTopics: number
  partialTopics: number
  emptyTopics: number
  prioritizedGaps: TopicCoverage[]   // ranked by student signal then gap size
}
```

Service function: `getContentGapReport(userId) → Promise<ContentGapReport>`
- Fetches: all Questions, all KnowledgeUnits, StudentLearningProfile (for signals)
- Calls `computeTopicCoverage()` then `rankGapsByStudentSignal()`
- Returns the assembled report

---

## 6. Question Generation Pipeline

### Design Principle

**Generation reuses the existing draft review flow entirely.** Every AI-generated candidate
becomes an `ExtractedQuestionDraft` row with `reviewStatus: "PENDING_REVIEW"`. The admin
reviews and approves it with the same `approveDraft()` function used for extracted questions.
No new review UI is needed. No generated question enters the `Question` table without human
approval.

### New Pipeline

```
Admin views gap report → selects topic + difficulty + count
    ↓ POST /api/admin/question-generation
QuestionGenerationJob created (status: PENDING)
    ↓ AIProvider.generateQuestions(input)
AI returns NormalizedQuestionDraft[] candidates
    ↓ Shape validation (same validator.ts)
    ↓ Semantic validation (new — see §7)
ExtractedQuestionDraft rows created (generationJobId populated)
QuestionGenerationJob updated (status: REVIEWING)
    ↓ Admin reviews each draft in DraftReviewCard (unchanged UI)
approveDraft() → Question created (same function as today)
```

### New AIProvider Method

```typescript
// Added to lib/ai/providers/types.ts
generateQuestions(input: GenerateQuestionsInput): Promise<NormalizedQuestionDraft[]>

interface GenerateQuestionsInput {
  topic: string
  topicLabel: string
  difficulty: "EASY" | "MEDIUM" | "HARD"
  targetCount: number
  existingExamples: {       // 2–3 approved questions from same topic
    promptText: string
    optionA: string; optionB: string; optionC: string; optionD: string
    correctOption: string
    explanationVi: string
  }[]
  questionType?: string     // optional constraint (e.g., GRAMMAR_MCQ only)
}
```

`existingExamples` anchors the AI's output format and question style to the bank's existing
conventions for that topic. Without examples, generated questions may drift in style from
extracted questions.

### New Prisma Model: QuestionGenerationJob

```prisma
model QuestionGenerationJob {
  id           String                 @id @default(cuid())
  topic        String
  difficulty   Difficulty
  targetCount  Int
  status       GenerationJobStatus    @default(PENDING)
  errorMessage String?
  drafts       ExtractedQuestionDraft[]
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
}

enum GenerationJobStatus {
  PENDING
  GENERATING
  REVIEWING
  COMPLETED
  FAILED
}
```

**Minimal for M3.3:** The model intentionally excludes provider name, model version, and token
tracking. These are deferred to Phase 4 when generation becomes a regular admin workflow and
cost tracking becomes necessary. For M3.3, log this metadata to application logs instead, not
to the database. Questions created from this job have `generatedViaJobId` for audit purposes.

### ExtractedQuestionDraft Extension

`ExtractedQuestionDraft` gains one new nullable FK:

```prisma
generationJobId  String?
generationJob    QuestionGenerationJob? @relation(fields: [generationJobId], references: [id])
```

`generationJobId = null` means the draft came from extraction (existing behavior).
`generationJobId != null` means the draft came from generation. The review flow is identical
for both.

### New API Route

```
POST /api/admin/question-generation
Body: { topic, difficulty, targetCount, questionType? }
Returns: { job: QuestionGenerationJob, draftCount: number }
```

---

## 7. Validation Layer

Three additive validation layers. Phase 3 adds the bottom two; shape validation is unchanged.

### Layer 1: Shape Validation (existing — `lib/services/content-import/validator.ts`)

Checks:
- All required fields present (questionCode, type, skill, difficulty, topic, promptText,
  optionA–D, correctOption, explanationVi, commonMistake, learningObjective)
- Enum values valid (type ∈ QuestionType, skill ∈ SkillCategory, difficulty ∈ Difficulty)
- `correctOption` resolves to one of A/B/C/D
- `questionCode` unique within the job (not yet against the full Question table)

Result: `isValid: boolean` + `errors: string[]` on each draft. Existing behavior unchanged.

### Layer 2: Duplicate Detection (new)

Checks candidates against the existing `Question` table before persisting as drafts:

```typescript
interface DuplicateCheckResult {
  isDuplicate: boolean
  matchType: "EXACT_CODE" | "FUZZY_TEXT" | null
  matchedQuestionId: string | null
  similarityScore: number | null  // 0.0–1.0 for fuzzy matches
}
```

Checks:
- **Exact code match**: `Question.questionCode === draft.questionCode` — surfaces a **strong warning**
  in DraftReviewCard. Human can approve if the draft is genuinely a new version of an existing
  question (e.g., corrected explanation). No auto-rejection.
- **Fuzzy text match**: Levenshtein distance between `draft.promptText` and all existing
  `Question.promptText` values in the same topic. Three bands:
  - **≥95% similarity**: **Strong duplicate warning** — "This question's wording is nearly identical
    to Question XXXXX. Approve only if it's a legitimate variant."
  - **85–95% similarity**: **Review warning** — "This question is very similar to Question XXXXX.
    Consider whether both are needed."
  - **<85% similarity**: **No warning** — distinct questions.

Fuzzy matching operates only within the same `topic` to keep comparisons fast without an
embedding index. Human decision is always required; nothing is auto-rejected at Layer 2.

### Layer 3: Semantic Validation (new — AI-assisted)

Checks whether the question is internally consistent:
1. Is `correctOption` actually correct given `promptText` and the four options?
2. Is `explanationVi` consistent with `correctOption`?
3. Are the three distractors (wrong options) plausible — i.e., not obviously wrong?

Implementation: a second AI call with a structured prompt asking the model to verify the draft.
Returns a structured result, not a free-form critique.

```typescript
interface SemanticValidationResult {
  passed: boolean
  warnings: SemanticWarning[]
  checkedAt: string
  checkedBy: "AI" | "HUMAN"
}

interface SemanticWarning {
  field: "correctOption" | "explanationVi" | "distractors" | "consistency"
  message: string   // in Vietnamese (consistent with admin UI language)
}
```

**Semantic validation is advisory, not blocking.** A flagged draft remains `PENDING_REVIEW`
with the warnings visible to the admin in DraftReviewCard. The admin can approve with explicit
acknowledgement of the warning.

```prisma
model SemanticValidationResult {
  id       String                 @id @default(cuid())
  draft    ExtractedQuestionDraft @relation(fields: [draftId], references: [id])
  draftId  String                 @unique
  passed   Boolean
  warnings Json                   // SemanticWarning[]
  checkedAt DateTime
  checkedBy String                // "AI" | "HUMAN" | "FAILED"
}
```

`ExtractedQuestionDraft` gains:
```prisma
semanticValidation  SemanticValidationResult?
```

**Failure Behavior:** If the semantic validation call fails (timeout, quota exceeded, network error,
or any other exception):
1. Log the failure with `draftId`, `timestamp`, and error message to application logs
2. **Do not block the draft.** A SemanticValidationResult row may or may not be created (if
   connection is lost before write, skip it; if write succeeds, set `checkedBy: "FAILED"`)
3. In DraftReviewCard, show a notice: "⚠️ Semantic validation failed. Review manually before approving."
4. **Human approval is never blocked.** The admin can proceed to approve despite the failed validation.

This design ensures the validation layer is strictly additive — its absence or failure never
prevents a legitimate question from reaching students.

---

## 8. Human-in-Loop Points

Four explicit gates. AI never acts without admin intent. No generated question reaches students
without human approval.

### Gate 1: Content Gap Review

Admin views the content gap report and reads the prioritized topic list. AI provides the
analysis — admin decides which gaps are worth filling and in what order. No generation is
triggered automatically.

**Who acts:** Admin
**AI role:** Produces the gap report (pure computation — no AI needed for gap detection itself)
**Human decision:** Which topics to prioritize for generation

### Gate 2: Generation Trigger

Admin explicitly selects a topic, difficulty, and count and clicks "Generate." There is no
scheduled or autonomous generation. Each `QuestionGenerationJob` maps to one admin action.

**Who acts:** Admin
**AI role:** Generates candidate questions once triggered
**Human decision:** Whether to trigger generation at all, and with what parameters

### Gate 3: Draft Review

Every generated question must be individually approved before it enters the `Question` table.
`approveDraft()` is the only code path that creates a `Question` row. This is unchanged from
the existing extraction pipeline — generation drafts flow through the same `DraftReviewCard`
review UI.

**Who acts:** Admin (same as today)
**AI role:** None at this gate
**Human decision:** Approve, edit, or reject each individual candidate

### Gate 4: Semantic Flag Override

If semantic validation flags a draft (e.g., detected inconsistency between `correctOption`
and `explanationVi`), DraftReviewCard surfaces the warning prominently. The admin must
explicitly confirm the override before approving.

**Who acts:** Admin
**AI role:** Produced the semantic validation flag
**Human decision:** Whether the AI's concern is valid or a false positive; whether to approve anyway

---

## 9. Schema Impact

### New Models

| Model | Purpose |
|---|---|
| `KnowledgeUnit` | Canonical topic registry with per-difficulty question targets |
| `KnowledgeUnitOnSession` | Join table: KnowledgeUnit ↔ CurriculumSession (many-to-many) |
| `QuestionGenerationJob` | Tracks AI generation runs (topic, difficulty, count, status) |
| `SemanticValidationResult` | Per-draft semantic validation result from AI |

### Extended Models

| Model | Field added | Type | Notes |
|---|---|---|---|
| `Question` | `knowledgeUnitId` | `String?` | Nullable FK to KnowledgeUnit; existing questions have null |
| `Question` | `generatedViaJobId` | `String?` | Nullable FK to QuestionGenerationJob; null if extracted or seeded |
| `ExtractedQuestionDraft` | `generationJobId` | `String?` | Null for extraction-origin drafts |
| `ExtractedQuestionDraft` | `semanticValidation` | Relation | One-to-one, optional |

### Unchanged Models

All Phase 1 models: User, CurriculumSession, UserSessionProgress, QuestionAttempt,
ErrorNotebookEntry, Passage, LearnerProfile, MoodEntry.

All Phase 2 additions: LearnerProfile.targetGoalDate (from M2.5).

ContentSource, ImportJob, ExtractedQuestionDraft core fields — all unchanged.

### Migration Strategy

Each Phase 3 sub-milestone ships one migration:
- **M3.1**: Add `KnowledgeUnit`, `KnowledgeUnitOnSession`; add `Question.knowledgeUnitId`;
  add `Question.generatedViaJobId` (pre-migration for M3.3)
- **M3.3**: Add `QuestionGenerationJob`; add `ExtractedQuestionDraft.generationJobId`
- **M3.4**: Add `SemanticValidationResult`; add `ExtractedQuestionDraft.semanticValidation` relation

M3.2 (ingestion enhancements) requires no schema changes.

All new FK fields are nullable — zero breaking changes to existing rows.

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI hallucinates incorrect answers in generated questions | HIGH | CRITICAL — wrong content reaches students | Semantic validation flags; human approval required; gate 3 is mandatory |
| Topic normalization drift (AI generates questions with non-canonical topic strings) | MEDIUM | MEDIUM — questions bypass coverage tracking | `canonicalTopic()` applied to all AI output before storage; KnowledgeUnit.topic enforces vocabulary |
| Review backlog (more drafts than admin can review) | MEDIUM | LOW — drafts sit in queue, never reach students | Generation requires explicit admin trigger per topic; no batch generation across all gaps at once |
| Semantic validator produces false positives | MEDIUM | LOW — valid questions flagged; extra admin friction | Semantic flag is advisory not blocking; human overrides at gate 4 |
| OCR accuracy on Vietnamese exam documents | HIGH | MEDIUM — extraction errors propagate to drafts | Low-confidence OCR regions flagged in DraftReviewCard; admin corrects before approval |
| Duplicate questions across import jobs | MEDIUM | LOW — redundant content in bank | Exact code match surfaces strong warning (≥95% fuzzy match band); admin decides |
| AI provider quota/cost for generation | MEDIUM | LOW — generation fails gracefully | Mock provider always available; job stores `errorMessage` and retries when quota restored |
| KnowledgeUnit seeding incomplete (missing topics) | MEDIUM | LOW — coverage report understates actual gaps | Seed from existing Question.topic + CurriculumSession.grammarTopics; flag unmapped topics in report |

---

## 11. Implementation Phases

Phase 3 consists of four independently shippable sub-milestones. Each can be verified and
deployed without requiring the next.

### M3.1 — Knowledge Unit Registry + Gap Analysis ✓ IMPLEMENTED (2026-06-29)

**Goal:** Establish the topic vocabulary and content coverage visibility. No AI required.

**Implemented files:**
- `prisma/schema.prisma` — KnowledgeUnit, KnowledgeUnitOnSession, QuestionGenerationJob,
  GenerationJobStatus; nullable Question.knowledgeUnitId, Question.generatedViaJobId,
  CurriculumSession.knowledgeUnits, ExtractedQuestionDraft.generationJobId
- Migration: `20260629065904_add_content_intelligence_foundation`

**Deferred from original M3.1 design** (moved to M3.2):
- `lib/services/content-intelligence/` service layer — implemented in M3.2 instead
- Admin API route and coverage dashboard UI — pending
- `prisma/seed-knowledge-units.ts` — not yet needed (no KnowledgeUnit rows seeded)

---

### M3.2 — Knowledge Coverage Intelligence ✓ IMPLEMENTED (2026-06-29)

**Goal:** Deterministic coverage and gap detection for the question bank. No AI, no UI, no schema changes.

**Implemented files:**
- `lib/services/content-intelligence/types.ts` — `KnowledgeUnitInput`, `QuestionInput`,
  `DifficultyBreakdown`, `CoverageReport`, `KnowledgeGap`, `KnowledgeCoverageReport`
- `lib/services/content-intelligence/knowledgeCoverage.ts` — pure engine:
  `computeCoverageReport()`, `computeAllCoverageReports()`. Coverage = capped per-band fill rate.
  Status: COMPLETE (all bands met), UNDER_COVERED (empty or < 50%), PARTIAL (between).
- `lib/services/content-intelligence/knowledgeGap.ts` — pure engine:
  `detectGaps()`, `filterGapsByPriority()`. Priority: HIGH (hard missing) > MEDIUM (medium missing)
  > LOW (easy only). Sorted by priority then total missing descending.
- `lib/services/content-intelligence/knowledgeMapping.ts` — service layer (Prisma):
  `getAllKnowledgeUnits()`, `getKnowledgeCoverageReport()` (full orchestration).
  (Note: `assignQuestionToKnowledgeUnit` and `getQuestionsWithoutKnowledgeUnit` moved to
  `questionKnowledgeMapping.ts` in M3.3 to keep module responsibilities clear.)
- `scripts/test-knowledge-coverage.mjs` — 42 tests (all pure engine paths)

**Key design decision:** Topic matching uses `q.topic === unit.topic` (not FK) so coverage is
useful immediately, even before questions are formally assigned to KnowledgeUnits.

**558 tests passing. Build clean.**

---

### M3.3 — Knowledge Mapping & Content Integration ✓ IMPLEMENTED (2026-06-29)

**Goal:** Connect the import pipeline to the KnowledgeUnit registry via deterministic topic
matching. No AI, no schema changes, no UI changes.

**Implemented files:**
- `lib/services/content-intelligence/questionKnowledgeMapping.ts` — canonical CRUD for
  individual question ↔ KnowledgeUnit assignments:
  - `findMatchingKnowledgeUnitId(topic, units)` — pure function; exact string equality only
  - `assignQuestionToKnowledgeUnit(questionId, kuId)` — sets FK
  - `removeQuestionKnowledgeUnit(questionId)` — clears FK to null
  - `getUnmappedQuestions()` — questions with `knowledgeUnitId = null`
  - `getQuestionsForKnowledgeUnit(kuId)` — FK-linked questions for a unit
  - `autoAssignKnowledgeUnit(questionId, topic)` — non-throwing auto-assign for import pipeline

Updated:
- `lib/services/content-intelligence/knowledgeMapping.ts` — removed duplicate helpers;
  kept aggregate coverage orchestration (`getAllKnowledgeUnits`, `getKnowledgeCoverageReport`)
- `lib/services/content-import/importer.ts` — `approveDraft()` calls `autoAssignKnowledgeUnit()`
  after Question creation. Wrapped in try/catch: missing KU never fails approval.

- `scripts/test-knowledge-mapping.mjs` — 46 tests (pure matching, auto-assign simulation,
  unmapped detection, FK vs. topic-string independence, import flow compatibility)

**Key design decision:** Deterministic topic matching only. No AI classification. Admins see
exactly why a question was or was not auto-assigned. Assignment failure never blocks approval.

**604 tests passing. Build clean.**

---

### M3.4 — Content Validation Layer ✓ IMPLEMENTED (2026-06-29)

**Goal:** Deterministic content validation for questions and KnowledgeUnit coverage.
No AI, no schema changes, no UI changes.

**Implemented files:**
- `lib/services/content-intelligence/validationTypes.ts` — shared types: severity
  (LOW/MEDIUM/HIGH), status (PASS/WARNING/FAIL), ValidationIssue, QuestionValidationResult,
  QuestionValidationInput, KnowledgeUnitValidationInput, CoverageValidationInput/Result
- `lib/services/content-intelligence/contentValidation.ts` — pure engine (no Prisma):
  `validateQuestionCompleteness()`, `validateKnowledgeMappingQuality()`,
  `validateDifficultyDistribution()`, `validateQuestion()`, `validateQuestions()`
- `lib/services/content-intelligence/contentValidationService.ts` — service layer (Prisma):
  `validateAllQuestions()`, `validateSingleQuestion()`, `validateKnowledgeUnitCoverage()`,
  `validateAllKnowledgeUnitCoverage()`
- `scripts/test-content-validation.mjs` — 80 tests (all pure engine paths)

**Status derivation:** FAIL if any HIGH issue; WARNING if any LOW/MEDIUM and no HIGH; PASS if none.

**684 tests passing. Build clean.**

---

### M3.5 — Ingestion Enhancements (formerly M3.3/M3.4 in original design)

**Goal:** Improve quality and completeness of extracted content.

**Files:**
- `lib/services/content-import/extractor.ts` — replace IMAGE placeholder with real OCR
- `lib/services/content-import/chunker.ts` — add numbered-question boundary detection
- `lib/services/content-import/passageExtractor.ts` — new: passage detection and Passage creation
- `lib/services/content-import/importer.ts` — call passageExtractor during approveDraft()

**Schema migration:** None — Passage model and Question.passageId already exist

**Test approach:** Unit tests for chunker boundary detection (pure functions); OCR tested
against a sample Vietnamese exam scan

---

### M3.6 — Question Generation Pipeline (formerly M3.3 in original design)

**Goal:** Enable admin-triggered AI generation of questions targeting specific gaps.

**Files:**
- `prisma/schema.prisma` — add QuestionGenerationJob; extend ExtractedQuestionDraft
- `lib/ai/providers/types.ts` — add `generateQuestions()` to AIProvider interface
- `lib/ai/providers/claudeProvider.ts` / `geminiProvider.ts` / `mockProvider.ts` — implement
- `lib/ai/providers/generationCore.ts` — new: shared generation system prompt + parsing
- `app/api/admin/question-generation/route.ts` — POST endpoint
- `lib/services/content-import/importer.ts` — extend to accept generationJobId on drafts

**Key constraint:** `approveDraft()` remains the only path to create a Question. Generation
drafts flow through the same review function as extraction drafts.

**Schema migration:** QuestionGenerationJob + ExtractedQuestionDraft.generationJobId

---

### M3.6 — Validation Layer (formerly M3.4 in original design)

**Goal:** Catch duplicate questions and flag semantic inconsistencies before admin review.

**Files:**
- `prisma/schema.prisma` — add SemanticValidationResult; extend ExtractedQuestionDraft
- `lib/services/content-intelligence/semanticValidator.ts` — pure validation helpers
- `lib/services/content-import/validator.ts` — extend to call duplicate detection
- `lib/services/content-import/importer.ts` — call semanticValidator after shape validation
- `app/admin/content-import/DraftReviewCard.tsx` — display semantic warnings

**Schema migration:** SemanticValidationResult + ExtractedQuestionDraft.semanticValidation

---

## 12. Service Boundaries Preserved

Phase 3 maintains the same layer discipline as Phase 1 and Phase 2:

| Layer | Phase 3 additions | Prisma? | Logic? |
|---|---|---|---|
| **Repository** | `content-intelligence/repository.ts` — fetch KnowledgeUnits, Questions | YES | NO |
| **Engine** | `coverageEngine.ts`, `gapAnalysis.ts`, `generationEngine.ts`, `semanticValidator.ts` | NO | YES |
| **Service** | `contentService.ts` — orchestrates repository + engine | NO | NO |
| **Route** | `/api/admin/content-gap`, `/api/admin/question-generation` | NO | NO |

The Phase 2 → Phase 3 signal integration point (`rankGapsByStudentSignal`) takes
`LearningSignal[]` as a plain input — it does not call `getLearningSignals()` itself.
The service calls both engines and passes the results, preserving independence.

No intelligence logic is added to UI components. DraftReviewCard.tsx renders data from the
service response; it does not compute or derive anything.

---

## 13. Explicitly Out of Scope for Phase 3

- **No curriculum redesign** — CurriculumSession structure unchanged; session-to-topic mapping
  is enriched via KnowledgeUnitOnSession, not by modifying CurriculumSession fields
- **No student-facing UI changes** — all Phase 3 UI is in the admin shell
- **No automatic question publishing** — human approval at gate 3 is mandatory; no async
  auto-approval workflow
- **No multi-student analytics** — gap prioritization uses one student's signals
  (single-student prototype); multi-student aggregation is Phase 4+
- **No gamification** — XP, achievements, leaderboards not modeled
- **No real-time generation** — all QuestionGenerationJob runs are async; admin triggers
  and returns to the review queue later
- **No FSRS upgrade** — SM-2 from M2.1 is unchanged; FSRS can replace the algorithm body
  in Phase 4 without schema changes
- **No additional chat modes** — stubs in lib/ai/modes/ remain stubs

---

## 14. Architecture Review Decisions Finalized (2026-06-29)

**Review completed. Six architectural decisions confirmed before M3.1 implementation:**

1. ✅ **KnowledgeUnit model:** Added `questions: Question[]` relation for query efficiency;
   added `@@index([topic])` for fast topic lookup during gap analysis.

2. ✅ **Target strategy:** Global defaults only. No per-session overrides in M3.1. All topics
   uniformly targeted at 5 EASY / 5 MEDIUM / 3 HARD questions. Per-curriculum-session overrides
   deferred to Phase 4 when multi-student data clarifies priorities.

3. ✅ **Question provenance:** Use `Question.generatedViaJobId` (nullable FK to QuestionGenerationJob).
   If set, question was generated; if null, it was extracted or seeded. No `originType` enum needed.
   Added to M3.1 migration (field pre-created before M3.3 uses it).

4. ✅ **QuestionGenerationJob schema:** Kept minimal for M3.3. Excludes provider name, model version,
   and token tracking. These fields deferred to Phase 4. Metadata logged to application logs, not DB.

5. ✅ **Duplicate detection:** Changed from fixed 90% threshold to configurable warning bands:
   - **≥95% similarity:** Strong duplicate warning (nearly identical wording)
   - **85–95% similarity:** Review warning (very similar, but likely distinct intent)
   - **<85% similarity:** No warning (distinct questions)
   
   No auto-rejection at any band. Human decision always required.

6. ✅ **Semantic validation failure handling:** Failures (timeout, quota, network error) are
   logged but never block human approval. DraftReviewCard shows "⚠️ Semantic validation failed.
   Review manually." Admin can proceed to approve despite failure. Validation layer is strictly
   additive and non-blocking.

**Status:** Design finalized. M3.1 foundation implemented 2026-06-29.

---

---

## 15. M3.1 Foundation Implementation Status (2026-06-29)

**Status:** IMPLEMENTED — schema foundation only. No service layer. No UI.

**Migration applied:** `20260629065904_add_content_intelligence_foundation`

**Schema changes:**
- `KnowledgeUnit` — new model: topic (unique), label, targetEasyCount/Medium/Hard (global defaults),
  `sessions: KnowledgeUnitOnSession[]`, `questions: Question[]`, `@@index([topic])`
- `KnowledgeUnitOnSession` — new join table: KnowledgeUnit ↔ CurriculumSession (many-to-many)
- `GenerationJobStatus` — new enum: PENDING, GENERATING, REVIEWING, COMPLETED, FAILED
- `QuestionGenerationJob` — new model (minimal): topic, difficulty, targetCount, status,
  errorMessage, relations to drafts and questions
- `Question.knowledgeUnitId` — nullable FK to KnowledgeUnit
- `Question.generatedViaJobId` — nullable FK to QuestionGenerationJob (provenance)
- `CurriculumSession.knowledgeUnits` — relation to KnowledgeUnitOnSession
- `ExtractedQuestionDraft.generationJobId` — nullable FK to QuestionGenerationJob

**All existing data untouched:** All new FK fields are nullable. Zero breaking changes.

**Verified:**
- `npx tsc --noEmit` ✓ clean
- All Phase 1 tests (148/148) ✓ unchanged
- All Phase 2 tests (368/368) ✓ unchanged
- Total: 516 tests passing
- `npm run build` ✓ clean (35 routes)

**Service layer deferred:** `lib/services/content-intelligence/` directory not created.
Will be added in M3.1 gap analysis implementation (coverage engine, gap report service).

---

---

## 16. M4.1 Question Generation Foundation (2026-06-29)

**Status:** IMPLEMENTED — workflow boundary and pipeline contract. No real AI calls. No UI.

**Decision:** Question generation begins with workflow foundation before AI integration.
Real-world constraint: generation must be governed by knowledge gaps and validation
boundaries that are already established (M3.2–M3.4). Wiring AI directly into the
Question table — skipping the draft review flow — was explicitly rejected.

**Files created:**
- `lib/services/content-generation/types.ts` — generation-specific types:
  `GenerationJobStatus` (union, mirrors Prisma enum without importing Prisma),
  `VALID_JOB_TRANSITIONS` (state machine map, exported for testing),
  `GenerationJobInput`, `GenerationJobSummary`, `GenerationInput`,
  `GeneratedQuestionDraft`, `GeneratorKind`, `GenerationResult`
- `lib/services/content-generation/generationJob.ts` — Prisma service layer:
  `isValidTransition(from, to)` (pure, exported for test),
  `createGenerationJob(input)` — creates PENDING job, clamps targetCount to [1, 20],
  `updateJobStatus(jobId, to, errorMessage?)` — validates transition before writing,
  `getGenerationJob(jobId)`, `listJobsByTopic(topic)`, `listJobsByStatus(status)`
- `lib/services/content-generation/draftGenerator.ts` — pure placeholder:
  `generateDraftQuestions(input)` → returns `{ drafts: [], generatorUsed: "PLACEHOLDER" }`
  (M4.2 replaces the body with AIProvider.generateQuestions),
  `toValidationInput(draft, syntheticId)` — converts GeneratedQuestionDraft → QuestionValidationInput,
  `validateGeneratedDrafts(drafts, units)` — calls contentValidation.validateQuestions() (no duplication)
- `scripts/test-question-generation-foundation.mjs` — 79 tests (state machine transitions,
  self-transitions, job input guards, targetCount clamping, placeholder contract,
  toValidationInput shape, validateGeneratedDrafts integration, end-to-end pipeline simulation)

**Key design decisions:**
- `generateDraftQuestions()` is a pure function (not async) in M4.1 — the AI call in M4.2
  will make it async. The stable contract is the input/output shape, not the sync/async boundary.
- `GeneratedQuestionDraft` is narrower than `NormalizedQuestionDraft` — it excludes
  `questionCode`, `type`, `skill` (set at approval time). Keeps generator concerns separate
  from approval pipeline concerns.
- `VALID_JOB_TRANSITIONS` is exported from `types.ts` (not embedded in `generationJob.ts`)
  so the state machine can be tested without importing Prisma.
- `knowledgeUnitId` is absent from `GenerationJobInput` — the job's `topic` field serves as
  the implicit link to KnowledgeUnit (which has `topic @unique`). No redundant FK needed.

**Validation integration confirmed:** `validateGeneratedDrafts()` calls `validateQuestions()`
from `contentValidation.ts` directly. Zero duplicated logic. A structurally invalid generated
draft produces FAIL status with the same issue types (MISSING_PROMPT, INVALID_CORRECT_OPTION,
etc.) as any other question. An unmapped generated draft (all M4.1 drafts) produces WARNING
with NOT_MAPPED (MEDIUM severity) — not FAIL — so it does not block future approval.

**Verified:**
- `npx tsc --noEmit` ✓ clean
- M3.2 tests: 42/42 ✓
- M3.3 tests: 46/46 ✓
- M3.4 tests: 80/80 ✓
- M4.1 tests: 79/79 ✓
- Total: 763 tests passing
- `npm run build` ✓ clean

**Next milestone (M4.2):** Wire AIProvider.generateQuestions() into draftGenerator.ts.
Add `generateQuestions()` to the AIProvider interface; implement in claudeProvider,
geminiProvider, and mockProvider; make `generateDraftQuestions()` async; add the
POST /api/admin/question-generation route.

---

---

## 17. M4.2 AI Generation Integration (2026-06-29)

**Status:** IMPLEMENTED — AI provider connected to generation workflow. Drafts validated in memory. No DB persistence yet at time of M4.2 (schema constraint resolved in M4.3 with separate model).

**Decision:** AI generation produces reviewable drafts only. Human approval remains the quality boundary. Direct AI-to-Question persistence was explicitly rejected. See `docs/DECISION_LOG.md` for the full decision record.

**Files modified:**
- `lib/ai/providers/types.ts` — `GenerateQuestionsInput`, `GenerateQuestionsResult` types added; `generateQuestions()` method added to `AIProvider` interface
- `lib/ai/providers/normalizationCore.ts` — `GENERATE_QUESTIONS_SYSTEM_PROMPT`, `buildGenerateQuestionsUserPrompt()`, `generateWithRetry()` added (reuses `parseDrafts()` with `generated:topic:difficulty` as source string)
- `lib/ai/providers/claudeProvider.ts` — `generateQuestions()` implemented via `generateWithRetry(callClaude, ...)`
- `lib/ai/providers/geminiProvider.ts` — `generateQuestions()` implemented via `generateWithRetry(callGemini, ...)`
- `lib/ai/providers/mockProvider.ts` — `generateQuestions()` returns 1–2 clearly-labeled placeholder drafts (capped at 2 to avoid flooding review queue in demo mode)
- `lib/ai/providers/withRuntimeFallback.ts` — `generateQuestions()` wrapped with same fallback pattern as `normalizeQuestions()` and `generateExplanation()`

**Files created:**
- `lib/services/content-generation/contextBuilder.ts` — pure: `buildGenerationContext(unit, gap, difficulty, requestedCount)` clamps count to `gap.missing[difficulty]`; throws if no gap exists or requestedCount < 1. `deriveCountFromGap()` exported separately for testing.
- `lib/services/content-generation/aiDraftGenerator.ts` — three layers:
  - `toGeneratedDraft(normalized)` — pure conversion; preserves `questionCode`, `type`, `skill` (updated in M4.3)
  - `callGenerationProvider(provider, context)` — injectable for testing (no DB); calls provider.generateQuestions, maps result
  - `generateDraftsForGap(jobId, unit, gap, difficulty, requestedCount, knowledgeUnits)` — full orchestration: PENDING→GENERATING→REVIEWING|FAILED with error stored
- `scripts/test-ai-generation-integration.mjs` — 78 tests

**Error handling:**
On any AI failure (quota, network, parsing, zero drafts returned): `updateJobStatus(jobId, "FAILED", errorMessage)` is called, empty result returned, no fake drafts created.

---

## 18. M4.3 Generated Draft Persistence & Review Pipeline (2026-06-29)

**Status:** IMPLEMENTED — generated drafts persisted to `GeneratedQuestionDraft` DB rows. Full review pipeline (approve/reject) connected to human review gate.

**Design decisions:**
- Separate `GeneratedQuestionDraft` model (not `ExtractedQuestionDraft`) — different provenance, different FK target. See `docs/DECISION_LOG.md`.
- `validationStatus` stored at draft creation; re-checked as gate at `approveDraft()` — FAIL drafts blocked, PASS/WARNING allowed.
- `approveDraft()` is idempotent via `approvedQuestionId` guard — re-approving a draft returns the existing Question without creating a duplicate.
- Job auto-completes when last PENDING_REVIEW draft is resolved (either approved or rejected).

**Schema changes** (`prisma/schema.prisma`, migration `20260629141215_add_generated_question_draft`):
- New enum: `DraftValidationStatus { PASS, WARNING, FAIL }`
- New model: `GeneratedQuestionDraft` — fields: id, generationJobId (FK to QuestionGenerationJob via "GeneratedDrafts"), knowledgeUnitId (FK to KnowledgeUnit via "GeneratedDraftsForUnit"), questionCode, topic, difficulty, promptText, optionA–D, correctOption, explanationVi, commonMistake, learningObjective, questionType (String), questionSkill (String), source, status (ReviewStatus), reviewNote, validationStatus (DraftValidationStatus), validationIssues (JSON String), approvedQuestionId, createdAt, updatedAt
- `QuestionGenerationJob`: backrelation `generatedDrafts GeneratedQuestionDraft[] @relation("GeneratedDrafts")` added
- `KnowledgeUnit`: backrelation `generatedDrafts GeneratedQuestionDraft[] @relation("GeneratedDraftsForUnit")` added

**Type changes** (`lib/services/content-generation/types.ts`):
- `GeneratedQuestionDraft` interface extended with `questionCode: string`, `type: string`, `skill: string` — needed for `generatedDraftRepository.approveDraft()` to create the Question row.

**Files modified:**
- `lib/services/content-generation/aiDraftGenerator.ts` — `toGeneratedDraft()` now preserves `questionCode`, `type`, `skill`; `generateDraftsForGap()` calls `createDraftsForJob()` after validation (step 6 in pipeline)

**Files created:**
- `lib/services/content-generation/generatedDraftRepository.ts` — `createDraftsForJob()`, `listDraftsByJob()`, `getDraft()`, `approveDraft()` (only function that creates a Question), `rejectDraft()`
- `scripts/test-generated-draft-pipeline.mjs` — 85 tests

**Approval flow:**
```
GeneratedQuestionDraft (PENDING_REVIEW)
  → approveDraft(draftId)
    → [validationStatus FAIL] throw — blocked
    → [approvedQuestionId set] return existing Question — idempotent
    → prisma.$transaction { Question.create + draft.update(APPROVED) }
    → [pending count = 0] updateJobStatus(COMPLETED)
  → Question (with generatedViaJobId + knowledgeUnitId provenance)
```

**Verified:**
- `npx tsc --noEmit` ✓ clean
- M3.2 tests: 42/42 ✓
- M3.3 tests: 46/46 ✓
- M3.4 tests: 80/80 ✓
- M4.1 tests: 79/79 ✓
- M4.2 tests: 78/78 ✓
- M4.3 tests: 85/85 ✓
- Total: 926 tests passing
- `npm run build` ✓ clean

---

## 19. M4.4 Generation Quality & Evaluation Layer (2026-06-29)

**Status:** IMPLEMENTED — pure deterministic quality evaluation engine for generated drafts.

**Design decisions:**
- Quality is informational only — no check triggers automatic approval or rejection. See `docs/DECISION_LOG.md`.
- Three deterministic checks (no AI, no embeddings): duplicate risk, topic alignment, difficulty consistency.
- `evaluateDraft()` never throws — even a catastrophically bad draft receives a valid report (score = 0).
- Score 0–100 uses a simple deduction table: HIGH=-30, MEDIUM=-15, LOW=-5, clamped to [0, 100].

**Files created:**
- `lib/services/content-generation/qualityTypes.ts` — shared types:
  - `QualityIssueSeverity`, `QualityIssue`, `GenerationQualityReport`
  - `DraftEvaluationInput`, `ExistingContentSnapshot`, `KnowledgeUnitEvaluationContext`
- `lib/services/content-generation/qualityEvaluation.ts` — pure engine:
  - `checkDuplicates(draft, existing)` — exact code → HIGH, exact prompt → HIGH, normalised prompt → MEDIUM
  - `checkTopicAlignment(draft, unit)` — topic mismatch → HIGH (exact string equality, case-sensitive)
  - `checkDifficultyConsistency(draft, unit)` — no target for band → HIGH, band at/above target → MEDIUM
  - `computeScore(issues)` — deduction table, clamped to [0, 100]
  - `evaluateDraft(draft, existing, unit)` — runs all three checks, returns `GenerationQualityReport`
- `scripts/test-generation-quality.mjs` — 88 tests

**Duplicate detection detail:**

| Condition | Type | Severity |
|---|---|---|
| `questionCode` exact match | `DUPLICATE_CODE` | HIGH |
| `promptText` exact match | `DUPLICATE_PROMPT` | HIGH |
| `normalise(promptText)` match, raw strings differ | `DUPLICATE_PROMPT_NORMALIZED` | MEDIUM |

Normalisation: lowercase + whitespace collapse + trim. Exact match suppresses the MEDIUM result on the same entry.

**Difficulty consistency detail:**

| Condition | Type | Severity |
|---|---|---|
| `targetCount === 0` for draft's band | `DIFFICULTY_NO_TARGET` | HIGH |
| `actual >= target` (band at/above target) | `DIFFICULTY_BAND_AT_TARGET` | MEDIUM |
| `actual < target` (gap exists) | — | none |

**Verified:**
- `npx tsc --noEmit` ✓ clean
- M3.2 tests: 42/42 ✓
- M3.3 tests: 46/46 ✓
- M3.4 tests: 80/80 ✓
- M4.1 tests: 79/79 ✓
- M4.2 tests: 78/78 ✓
- M4.3 tests: 85/85 ✓
- M4.4 tests: 88/88 ✓
- Total: 1014 tests passing
- `npm run build` ✓ clean

---

_End of Phase 3/4 Content Intelligence Design Review._
_M3.1–M3.4 and M4.1–M4.4 implemented. Next: M4.5 admin API endpoint or M3.5 ingestion enhancements._
