# LEXI Phase 1 Implementation Handoff

_Last updated: 2026-06-24 — End of architecture & design phase. Phase 1 implementation begins with this document as the source of truth._

**For a fresh ChatGPT session:**
1. Read this file first (you are here) — project identity, current architecture, and Phase 1 scope.
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — the technical reference for all production code.
3. [PROJECT_STATUS.md](./PROJECT_STATUS.md) — detailed feature verification log.

---

## Project Identity

**LEXI** is an AI-assisted English-learning platform for a Vietnamese grade-9 student preparing for the Hanoi grade-10 entrance exam.

**Current state (as of 2026-06-24):**
- Single-tenant pilot (1 seeded student, 1 seeded admin)
- Next.js 16 App Router monolith (React 19, TypeScript)
- Prisma 6 with SQLite locally (Postgres-portable schema)
- Multi-provider AI abstraction (Gemini/Claude/Mock)
- Core features: dashboard, practice quiz, error notebook, progress tracking, AI chat, admin content pipeline
- **Phase 1 implementation not yet started** — architecture and design complete, no code written

**Target exam:** Hanoi Grade 9 → 10 English entrance exam (40 MCQ, 60 minutes, full-cycle mock exam sequence)

---

## Current Architecture (Verified 2026-06-24)

### Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | App Router, Server Components by default |
| Backend | Next.js API Routes (`app/api/**/route.ts`) | Monolith, no separate service |
| Database | SQLite locally (`prisma/dev.db`) | Postgres-portable schema (untested) |
| ORM | Prisma 6 (`prisma-client-js`) | Single source of truth for models |
| Auth | NextAuth.js (Credentials + JWT) | Role-based (`STUDENT`, `ADMIN`) |
| AI | Custom `AIProvider` abstraction | 3 implementations: Mock, Claude, Gemini |
| Styling | Tailwind CSS v4 | Custom property tokens (`--lexi-*`) |
| File parsing | `mammoth` (DOCX), `pdf-parse` (PDF) | Real extraction; IMAGE is placeholder |

### Folder Structure

```
lexi/
  app/
    (auth)/login/                     Credentials login form
    (app)/                            Authenticated student (role-agnostic)
      dashboard/                      Mission, streak, mood, skill bars
      chat/                           Teacher-Mode Lexi (other modes stubbed)
      practice/[sessionNumber]/       Quiz flow
      error-notebook/                 Error tracking & spaced-rep stub
      progress/                       Skill matrix + weak topics
      profile/                        Target/current score, strengths/weaknesses
      diagnostic-test/                Baseline grammar/vocab/reading score
    admin/                            Admin-only (gated to ADMIN role)
      content/                        Source overview list
      content-import/                 Upload, extract, review, approve
    api/                              Route handlers
      chat/                           Chat + message handling
      error-notebook/                 Manual + quiz-sourced entries
      profile/                        Profile PATCH
      diagnostic-test/                Diagnostic score POST
      mood/                           Mood entry POST
      questions/[id]/attempt/         Quiz answer submission
      curriculum/sessions/[n]/        Session completion + future Session 22/23/24 endpoints
      admin/                          Admin routes (content-sources, import-drafts)
  components/
    ui/                               Reusable primitives (Card, Button, TextField, Textarea)
                                       Partial migration; only ProfileForm converted so far
  lib/
    ai/
      providers/                      AIProvider abstraction (types, mock, claude, gemini, normalizationCore)
      modes/                          Chat modes (teacher fully implemented, 4 others stubbed)
      persona.ts                      Lexi's voice & tone
      contextAssembler.ts             Chat context injection
      encouragement.ts                Feedback message banks
    analytics/                        [NEW — Phase 1] Analytics computation & narrative layer
    auth/                             Authentication & session
    db/                               Prisma singleton
    services/
      curriculum.ts                   Mission progression, phase progress, practice fallback
      errorNotebook.ts                Spaced-repetition stub
      skillMatrix.ts                  Rule-based skill % recompute
      weakness.ts                     Weak-topic ranking from error notebook
      streak.ts                       Learning streak computation
      diagnosticTest.ts               CEFR level estimation
      content-import/                 Admin content pipeline (extraction, normalization, validation, review)
    phonetics.ts                      Phonetics substring underlining (topic → pattern)
  prisma/
    schema.prisma                     17 models, 4 migrations, Postgres-portable
    seed.ts                           Seeds student, admin, 24 sessions, 118 questions
    seed-data/                        Questions.json, curriculum.json (transcribed from reference docs)
    migrations/                       4 migrations (additive only so far)
  uploads/                            Local disk storage for content imports (20MB cap)
```

### Database Schema (17 models, no Phase 1 changes)

**Users & Profile:**
- `User` (role: STUDENT/PARENT/TUTOR/ADMIN)
- `LearnerProfile` (scores, strengths, weaknesses, learning history)

**Content & Practice:**
- `Question` (questionCode, type, skill, difficulty, topic, explanations)
- `Passage` (cloze & reading passages)
- `QuestionAttempt` (answers, correctness, timing)
- `ErrorNotebookEntry` (mistake tracking, spaced-rep stub, remedial flags)

**Progress & Skills:**
- `UserSessionProgress` (session status, scores, start/completion times)
- `SkillMatrixEntry` (per-skill % accuracy)
- `CurriculumPhase` / `CurriculumSession` (24 sessions / 3 phases)

**Lexi Chat:**
- `ChatSession` (mode: TEACHER/ERROR_DETECTIVE/PRACTICE_GENERATOR/EXAM_COACH/MOTIVATION)
- `ChatMessage` (role: USER/ASSISTANT/SYSTEM)

**Diagnostics & Mood:**
- `DiagnosticTest` (baseline grammar/vocab/reading scores)
- `MoodEntry` (daily mood tracking)

**Admin Content Pipeline:**
- `ContentSource` (file metadata: province, examYear, examType, gradeLevel, subject, sourceLabel)
- `ImportJob` (extraction status, raw extracted text, error messages)
- `ExtractedQuestionDraft` (candidate questions, review status, human approval)

**Important notes on Phase 1 additions:**
- `QuestionAttempt` will gain nullable `curriculumSessionId` and `answeredAt` is already present as `attemptedAt`
- `UserSessionProgress` will gain `startedAt` and will have `scoreAchieved` written on completion
- `scoreAchieved` uses 0.0–1.0 convention (proportion, not percentage)
- No other schema changes required for Phase 1

### Content Import Pipeline (Verified Functional)

```
Upload (DOCX/PDF/IMAGE + optional metadata)
  → extractor.ts (REAL text extraction for DOCX/PDF; IMAGE placeholder)
  → chunker.ts (splits by "PHẦN N – ĐỀ TEST..." headers for large docs)
  → ai-normalizer.ts → AIProvider.normalizeQuestions()
  → normalizationCore.ts (shared prompt, JSON parsing, retry-once logic)
  → validator.ts (shape validation: required fields, valid options, no duplicates)
  → ExtractedQuestionDraft (PENDING_REVIEW if valid, REJECTED with reason if not)
  → [Two test actions exist before real import]
     - "Chạy mẫu AI" (5-question sample, persists drafts)
     - "Chạy thử toàn bộ đề bằng AI (dry run)" (all batches, persists NOTHING — verified via row count)
  → Human review on /admin/content-import
  → approveDraft() creates real Question (ONLY path that can)
```

**Verified against real sources:**
- `Bo_de_test_Tieng_Anh_9.docx` (118 questions): 23,165 chars, zero encoding issues, Vietnamese intact
- Chunking: correctly splits into 36/37/45 questions per part
- Validation: tested against 10 hand-built drafts (5 valid, 5 deliberately broken) — all classified correctly

**Current limitation:** Gemini API is blocked by external quota issue (5 attempts × 5 keys × multiple accounts — see Blockers). All verification to date has been against `mockProvider` only.

### AI Architecture (3 Providers, Abstraction Enforced)

```
AIProvider interface:
  - chat(system, messages) → string
  - normalizeQuestions(rawText, sourceFileName) → {drafts, retryCount}
  - generateExplanation(question, correctOption) → string

Implementations:
  - mockProvider: canned replies, clearly labeled (ALWAYS available)
  - claudeProvider: real Claude (paid, untested — no budget)
  - geminiProvider: real Gemini (free tier, BLOCKED by quota issue)

Selection: via AI_PROVIDER env var, auto-detect by key presence, fallback to Mock
Status: getAIProviderStatus() returns {provider, name, model, requestedProvider, isFallback, fallbackReason}
  - isFallback=true only when a key is ABSENT at config time
  - isFallback=false doesn't mean the API call will succeed (see Blockers)
```

**Critical rule:** Every AI call goes through `lib/ai/providers/*`. Nothing else imports `@anthropic-ai/sdk` or `@google/genai`.

---

## Phase 1 Implementation Scope

**What is being built in Phase 1:** A complete learning loop for Sessions 22, 23, 24 (mock exam sequence) with honest analytics, personalized feedback, and readiness assessment for the target student profile (easily distracted, average retention, competitive exam pressure).

**Phase 1 timeline:** ~10 development days (Days 1–2 foundation + schema, Days 3–6 core analytics, Days 7–10 integration/testing)

### Phase 1 Features (Approved and Frozen)

#### 1. Session Context Tracking (Foundation)
**What:** Tag every `QuestionAttempt` with the `CurriculumSession` it was submitted in, and record session start time.
**Why:** All downstream analytics group by session. Without this, practice attempts and mock exam attempts are indistinguishable.
**Schema changes:**
- `QuestionAttempt.curriculumSessionId` (nullable FK)
- `UserSessionProgress.startedAt` (nullable DateTime)
- Write `UserSessionProgress.scoreAchieved` on session completion

**API changes:**
- `POST /api/curriculum/sessions/[n]/start` (new) — records `startedAt`
- `POST /api/questions/[id]/attempt` — accept optional `curriculumSessionId`
- `POST /api/curriculum/sessions/[n]/complete` — compute & write `scoreAchieved`

#### 2. Mid-Exam Attention Prompt
**What:** At question 21 in a `MOCK_EXAM` session, display a 5-second attention-reset message ("Halfway point. Take one breath. Check your pace.").
**Why:** Highest-leverage single intervention for easily-distracted students to prevent accuracy decay in final third.
**Implementation:** Pure client-side (no backend changes needed).

#### 3. Blueprint Coverage
**What:** Post-session display showing which of 8 exam blueprint sections were tested (≥2 attempts = ASSESSED, 1 = PARTIAL, 0 = UNASSESSED).
**Why:** Honest foundation for any readiness claim. Missing coverage explains lower scores without a content gap.
**No schema change.** Computed from `QuestionAttempt.question.type` grouping.

#### 4. Top-3 Weakness Topics
**What:** Post-session ranking of topics by `riskScore = wrongCount × examWeight[section]`. Simplified formula, no multipliers.
**Why:** Shows student exactly which high-impact topics to review before Session 23. Not a diagnosis, just observable facts.
**Confidence tiers:** OBSERVED (N=1–2), EMERGING (N=3–4), CONFIRMED (N≥5).

#### 5. Pattern Observation
**What:** If the same wrong option was selected 3+ times on a topic, surface "We noticed a possible pattern..." with a specific rule explanation.
**Why:** Systematic wrong belief (e.g., always placing "would" in the if-clause) is different from random carelessness; requires targeted explanation.
**Important:** N=2 tutor-only (too much noise), N≥3 student-visible.
**Confidence tiers:** OBSERVED (N=3), EMERGING (N=4–5), CONFIRMED (N≥6).

#### 6. Error Notebook Context
**What:** Display existing `ErrorNotebookEntry` records alongside weakness analysis, showing historical occurrence count.
**Why:** Links session-level findings to longitudinal student data. "This topic appeared in your error notebook 3 times" provides perspective.
**No schema change.** Display-only integration; no formula weighting (Phase 2).

#### 7. Session Comparison (22 vs 23)
**What:** Post-Session 23, show per-topic accuracy delta between sessions. Only for topics with N≥2 in both sessions.
**Why:** Recovery rate (Session 22 weakness → Session 23 improvement) is the most motivating feedback and the best predictor of real exam readiness.
**Confidence gating:** Show only paired topics with sufficient data; label "Not enough data" honestly for sparse topics.

#### 8. Final-Section Performance Drop
**What:** Compare first-third vs final-third accuracy. If drop > 10 percentage points, show observable fact + pacing strategy (no causal claim).
**Why:** Distinguishes attention failures from knowledge gaps. Reframing as "Your accuracy changed in the final section. Here's a strategy..." works regardless of cause.
**Difficulty confound guard:** Tutor view flags when HARD questions are disproportionately in final third.

#### 9. Simplified Readiness Band
**What:** Two-component score: `WeightedTopicMastery × 0.60 + CoverageDepthScore × 0.40`.
**Why:** Simple, honest, self-regulating formula. CoverageDepthScore measures how thoroughly each section was sampled relative to the real exam's expected depth (not binary "tested/not").
**Formula eliminates the need for totalAttempts gates** because `CoverageDepthScore` penalizes sparse coverage intrinsically.
**Bands:** EXAM_READY (≥85), NEARLY_READY (70–84), DEVELOPING (55–69), NOT_READY (<55).
**Insufficient data:** if `totalAttempts === 0`, flag `insufficientData: true` and suppress band.

#### 10. Confidence Framework (Cross-Cutting)
**What:** Every analytics result carries a deterministic `ConfidenceTier` (OBSERVED, EMERGING, CONFIRMED) based on sample size and session count.
**Student view:** Shows N-count in plain Vietnamese, color-coded chip. Tier names never appear.
**Tutor view:** Shows full tier name + breakdown of underlying counts + confidence reasoning.
**Principle:** never suppress a useful signal; adjust language instead.

### Architectural Patterns (Frozen for Phase 1)

#### Pattern 1: Three-Layer Analytics Architecture

```
Route Handler (thin orchestrator)
    ↓
Analytics Repository (all DB queries, no computation)
    ↓
Analytics Engine (pure functions, no DB access, fully testable)
    ↓
Narrative Engine (text generation, pure)
```

**Why:** Pure functions in the engine layer allow unit testing without Prisma mocks. Repository layer isolates data fetching. Narrative layer separates content from logic.

#### Pattern 2: Canonical Topic Normalization

**Problem:** `Question.topic` is free text. `"relative_clause"` ≠ `"relative_clauses"`. Analytics would split them into two topics.

**Solution:**

```typescript
// lib/analytics/canonicalTopic.ts
export function canonicalTopic(raw: string, aliasMap?: ReadonlyMap<string, string>): string {
  const normalized = algorithmicNormalize(raw);  // lowercase, underscore, strip punctuation
  return aliasMap?.get(normalized) ?? TOPIC_ALIASES[normalized] ?? normalized;
}

const TOPIC_ALIASES = {
  "relative_clause": "relative_clauses",
  "conditional_type_1": "conditionals_type_1",
  "conditional_type_2": "conditionals_type_2",
  // ... extend as variants discovered during topic audit
};
```

**Four integration callsites (all required):**
1. Content import validator — normalize at import time (Question.topic is canonical)
2. Analytics grouping — normalize when grouping attempts by topic
3. Notebook matching — normalize when comparing notebook concepts to session topics
4. Session comparison — normalize before building comparison keys

**Phase 2 migration path:** If `TOPIC_ALIASES` exceeds 60 entries, move to database `TopicCanonical` table. Function signature stays the same (add optional `aliasMap` parameter).

#### Pattern 3: `scoreAchieved` Convention

**Standard:** 0.0–1.0 (proportion, not percentage)

**Why:** Composes naturally with weights and fractions in analytics. Display layers multiply by 100 and append `%`. Documented in schema comment: `scoreAchieved Float?  // 0.0–1.0 accuracy proportion; multiply by 100 for % display`.

#### Pattern 4: Signal → Confidence → Narrative

**Every analytics output follows:**
1. Compute signal from data (pure function)
2. Determine confidence tier (sample-size rules)
3. Render student narrative (adjust language by tier)
4. Render tutor view (show raw data + tier + breakdown)

**Forbidden student vocabulary:** diagnosed, proven, confirmed weakness, misconception, attention disorder, suy giảm chú ý, vấn đề tâm lý.

### CoverageDepthScore Formula (Stress-Tested & Approved)

**Why it replaces binary BlueprintCoverage:**

Old formula: `WTM × 0.60 + (assessedSections / 8) × 0.40` produced overestimates. A student with 16 total questions (2 per section) at 100% accuracy scored EXAM_READY even with shallow coverage.

New formula measures depth per section relative to real exam:

```
CoverageDepthScore = Σ over all sections:
  min(attemptCount_section, EXAM_SECTION_DEPTH[section])
  ─────────────────────────────────────────────────────────── × sectionWeight
  EXAM_SECTION_DEPTH[section]
```

Where `EXAM_SECTION_DEPTH` is:
```typescript
{
  PHONETICS_SOUND: 2,
  PHONETICS_STRESS: 2,
  GRAMMAR_MCQ: 15,
  ERROR_IDENTIFICATION: 4,
  WORD_FORMATION: 4,
  CLOZE: 5,
  READING_COMPREHENSION: 4,
  SENTENCE_TRANSFORMATION: 6,
}
```

**Stress test results:**
- 40 questions concentrated in 2 sections: Score 33 → NOT_READY ✓ (formula self-penalizes)
- 30 questions distributed 4 per section: Score 69 → DEVELOPING ✓ (shallow coverage caught)
- 24 questions with full coverage at 3 per section, 80% accuracy: Score 69 → DEVELOPING ✓ (gate eliminated; formula alone produces correct result)
- Realistic 40-question mock (15 Grammar MCQ, 5 Cloze, etc.) at 68% accuracy: Score 81 → NEARLY_READY ✓ (matches expectations)

**Result:** No `totalAttempts` gates needed. The formula is self-regulating.

---

## Pending Decisions (Awaiting Approval or Data)

### 1. Topic Audit Before Implementation
**Decision required:** Run SQL query to extract all distinct `Question.topic` values from the database and audit for variant forms.

**Why:** The `TOPIC_ALIASES` table in `canonicalTopic.ts` must be seeded with known variants from the actual question bank, or many topics will be split incorrectly during Phase 1.

**What to do:**
```sql
SELECT DISTINCT topic FROM "Question" ORDER BY topic;
```
Manually review, identify variants (e.g., `"conditional_type_2"` vs `"conditionals_type_2"`), document in a comment, then populate `TOPIC_ALIASES`.

**Timing:** Must happen before any analytics code runs.

### 2. Recovery Rate Promotion (Phase 2)
**Current:** Recovery rate (comparing Session 22 vs Session 23 per-topic accuracy) will be shown as a raw per-topic comparison with N-count labels.

**Phase 2 decision:** Include recovery rate as a third component in the readiness score once data quality is confirmed (2+ mock exams completed by real students).

**Why defer:** Recovery rate is only valid when Session 23 tested the same topics as Session 22. The current question bank is too small to guarantee topic overlap. Showing it in Phase 1 is fine for motivation; including it in the readiness formula would be premature.

### 3. Timing Data Reliability (Phase 2)
**Current:** `timeSpentSec` on each `QuestionAttempt` is already stored. Phase 1 computes `TimingCompliance` by comparing per-section time against recommended allocation.

**Phase 2 decision:** Add timing as a fourth readiness score component only after confirming that ≥90% of real student attempts have non-null `timeSpentSec`.

**Why defer:** Timing analytics are fragile if the frontend doesn't consistently send the data. Better to validate in Phase 1 without using the data for decisions.

### 4. Analytics Snapshot Caching (Phase 2)
**Note for future maintainer:** Analytics results should be cached (computed once, stored, invalidated on new attempts) when tutor dashboards need to load readiness for multiple students.

**Phase 1 does not cache.** Per-page-load computation of 3 DB queries + sub-millisecond computation is negligible at current scale.

**Phase 2 insertion point:** `analyticsRepository.ts` gains `loadAnalyticsSnapshot()` and route handlers check cache before computing.

---

## Critical Implementation Sequence (Day 1–10)

### Days 1–2: Foundation (Schema + Migration + Indexing)
1. Run topic audit (see Pending Decision #1)
2. Create migration: add `curriculumSessionId` FK + `startedAt` to existing models
3. Confirm indexes: `(userId, curriculumSessionId)` on `QuestionAttempt`
4. Modify routes: `/api/curriculum/sessions/[n]/start`, `/api/questions/[id]/attempt`, `/api/curriculum/sessions/[n]/complete`
5. Confirm `npx tsc --noEmit` and `npm run build` pass

### Days 3–4: Core Service Layer
1. Create `lib/analytics/` directory structure
2. `lib/analytics/types.ts` — all analytics result interfaces and enums
3. `lib/analytics/examWeights.ts` — static config (EXAM_SECTION_WEIGHTS, EXAM_SECTION_DEPTH, SECTION_LABELS)
4. `lib/analytics/canonicalTopic.ts` — normalization function + TOPIC_ALIASES table (populated from audit)
5. `lib/analytics/confidenceEngine.ts` — all tier-determination functions (pure)
6. `lib/analytics/analyticsRepository.ts` — Prisma queries (first and only file importing Prisma in `/analytics/`)

### Days 5–6: Analytics Computation
1. `lib/analytics/sessionAnalytics.ts` — pure compute functions for all 7 features (blueprint coverage, weakness topics, pattern observation, section drop, readiness, comparison)
2. Add to existing imports: neither `sessionAnalytics.ts` nor any compute function imports Prisma
3. `lib/analytics/narrativeEngine.ts` — Vietnamese/English templates for all features (OBSERVED/EMERGING/CONFIRMED variants)
4. `GET /api/analytics/session/[sessionId]` route — the main orchestrator calling repository → engine → narrative

### Days 7–8: Frontend Components
1. Reusable components: `ConfidenceBadge` (color-coded N-count chip), `RunReport` (shared by chat + content-import)
2. Results screen components: `BlueprintCoverageGrid`, `WeaknessTopicCard`, `SessionComparisonTable`, `SectionDropAlert`, `ReadinessBand`
3. Exam screen: `MidExamPrompt` + integrate at question 21, pass `curriculumSessionId` on each attempt
4. Add `GET /api/analytics/comparison` and `GET /api/analytics/readiness` routes

### Days 9–10: Integration Testing + Documentation
1. End-to-end flow: student starts session → completes 40 questions → sees results page with all analytics
2. Verify `npx tsc --noEmit` and `npm run build` clean
3. Manual spot-check: Session 22 → Session 23 comparison view, readiness band transitions
4. Update this document with any discoveries

---

## Current Verified State (2026-06-24)

**Code:** `npx tsc --noEmit` ✓ clean, `npm run build` ✓ clean (21 routes, no schema drift)

**Database:** SQLite `lexi/dev.db`, 17 models, 4 migrations applied

**Seeded data:** 122 questions (118 real + 4 test artifacts), 24 sessions, 1 student (`student@lexi.local`), 1 admin (`admin@lexi.local`)

**Features verified working:**
- Login, dashboard, practice quiz with feedback, error notebook, progress, profile, diagnostic test, chat (Teacher Mode)
- Admin content upload/extract (DOCX/PDF verified real, IMAGE placeholder), normalization (Mock verified), validation, review/approve UI
- Multi-provider selection (9 scenarios verified correct)

**Blockers:**
- **Gemini API quota block (external, not code):** 5 attempted real API calls across 5 different keys and multiple Google accounts — all failed with `429 RESOURCE_EXHAUSTED, limit: 0`. Investigation closed per instruction. Real provider output remains unverified.
- **Claude never tested** (no paid key)
- **All verification to date: Mock provider only**

**Important:** Before full 118-question import is attempted, real AI output must be verified with either a working Gemini account or a paid Claude key.

---

## Development Rules (Locked for Phase 1)

1. **Schema changes only as specified above.** Validate it's actually insufficient before deviating.
2. **Preserve the AIProvider abstraction.** No new imports of `@anthropic-ai/sdk` or `@google/genai` outside `lib/ai/providers/`.
3. **Preserve validation and human-review gate.** Only `approveDraft()` creates `Question` rows.
4. **Keep analytics pure.** No Prisma imports in `sessionAnalytics.ts`.
5. **No temporary flags or feature gates.** Implement cleanly or don't.
6. **Canonical topics before analytics.** Run the topic audit on Day 1.

---

## Next ChatGPT Session — Start Here

1. Read LEXI_CURRENT_HANDOFF.md (you are here)
2. Read ARCHITECTURE.md (long-term reference)
3. Verify the topic audit has been done (see Pending Decision #1 above)
4. Begin Day 1 of the Phase 1 sequence above
5. Keep this document updated as implementation decisions change

**Phase 1 is the highest priority.** It delivers a complete learning loop (Session 22 → 23 → 24) with honest analytics and student motivation. No other features should be started until Phase 1 ships.

