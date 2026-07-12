# LEXI Phase 2 — Learning Companion Intelligence
## Final Architecture Design

_Created: 2026-06-25. Updated: 2026-06-29. M2.1, M2.2, M2.3, M2.4, M2.5 implemented and verified. Phase 2 complete._

---

## 1. Purpose and Scope

Phase 1 built the intelligence foundation: analytics, mastery tracking, adaptive recommendations, and a unified `StudentLearningProfile`. The student sees where they are and what to do next.

Phase 2 deepens the companion layer. The system begins to understand **how** the student learns, not just **what** they got right or wrong. It uses data already being collected (timing, mood, session duration) that Phase 1 never analyzed, and replaces the spaced-repetition stub with a real algorithm.

**Approved Phase 2 modules:**

| Module | Description | Files changed |
|---|---|---|
| M2.1 | SM-2 Spaced Repetition | `lib/services/errorNotebook.ts`, `app/api/curriculum/sessions/[n]/complete/route.ts` |
| M2.2 | Learning Behavior Engine | New: `lib/analytics/behaviorEngine.ts` |
| M2.3 | Adaptive Practice Foundation | New: `lib/analytics/difficultyCalibration.ts`; modify: `lib/services/curriculum.ts` |
| M2.4 | Learning Signal Engine | New: `lib/analytics/learningSignals.ts` |
| Extension | StudentLearningProfile v2 | Extend: `lib/analytics/studentLearningProfile.ts` |

**Explicitly out of scope for Phase 2:**
- No event sourcing
- No AI scoring or AI-generated insights
- No new chat modes
- No multi-user support
- No new schema tables
- Logic stays in the service/analytics layer — zero new logic in UI components

---

## 2. Phase 1 Frozen Boundary

The following files are **not modified** in Phase 2:

```
lib/analytics/
  examBlueprint.ts         ← static config, frozen
  types.ts                 ← analytics types, frozen
  confidenceEngine.ts      ← ConfidenceTier logic, frozen
  canonicalTopic.ts        ← topic normalization, frozen
  repository.ts            ← session analytics DB queries, frozen
  sessionAnalytics.ts      ← pure readiness/coverage computation, frozen
  service.ts               ← session analytics orchestration, frozen
  contracts.ts             ← API contract layer, frozen
  narrative.ts             ← narrative text generation, frozen
  notebookIntelligence.ts  ← improvement signals, frozen
  masteryTracking.ts       ← MasteryState computation, frozen
  index.ts                 ← barrel exports (will be extended with new exports)

lib/services/
  skillMatrix.ts           ← frozen
  weakness.ts              ← frozen
  streak.ts                ← frozen
  diagnosticTest.ts        ← frozen
  practiceRecommendation.ts ← frozen (M2.4 adds signals, does not modify it)
```

**What "frozen" means:** No function signatures change, no type exports change, no behavior changes for existing callers. Phase 2 code is additive alongside these files.

---

## 3. Architecture Rules (inherited from Phase 1)

```
Route Handler (thin orchestrator — auth, parse, delegate)
    ↓
Service / Analytics Service (orchestrates fetches + pure compute)
    ↓
Repository (DB queries — Prisma only, no computation)
    ↓
Engine (pure functions — no DB, no side effects, fully testable)
```

- Repository layer: only analytics files that import Prisma directly
- Engine layer: pure functions only — zero Prisma imports
- Service layer: orchestrates; may import both repository and engine
- Route layer: auth + parse + call one service function + return JSON

Phase 2 follows this pattern for every new module.

---

## 4. Schema Impact

### 4.1 New migration required

**One new nullable field:**

```prisma
model LearnerProfile {
  // ... existing fields ...
  targetExamDate DateTime? // Phase 2: exam countdown; null = feature hidden
}
```

Migration: `20260625_add_target_exam_date` — additive, no backfill required, no existing row affected.

### 4.2 Fields already in schema, used for the first time in Phase 2

These exist now but are either NULL everywhere or never read by any service:

| Field | Model | Current state | Phase 2 use |
|---|---|---|---|
| `easeFactor Float?` | `ErrorNotebookEntry` | Always NULL | SM-2 ease factor (written after each review) |
| `reviewStage Int @default(0)` | `ErrorNotebookEntry` | Written by current stub (0→1→2→3→4) | SM-2 stage (same field, different write logic) |
| `timeSpentSec Int?` | `QuestionAttempt` | May be NULL for older attempts | Behavior engine: per-question time |
| `startedAt DateTime?` | `UserSessionProgress` | Written by Phase 1 `/start` route | Behavior engine: session duration |
| `completedAt DateTime?` | `UserSessionProgress` | Written on session complete | Behavior engine: session duration |
| `mood Mood` | `MoodEntry` | Stored, never analyzed | Behavior engine: mood trend |
| `difficulty Difficulty` | `Question` | Stored (`EASY\|MEDIUM\|HARD`), used in quiz display | Adaptive practice: question selection weights |

No other schema changes are needed for Phase 2. All required data is already collected.

### 4.3 Index additions (no migration, Prisma-managed)

None needed. `@@index([userId, nextReviewAt])` on `ErrorNotebookEntry` already supports SM-2 due-date queries. `@@index([userId, curriculumSessionId])` on `QuestionAttempt` supports behavior engine session grouping.

---

## 5. Module Designs

### M2.1 — SM-2 Spaced Repetition

**Problem:** `lib/services/errorNotebook.ts` uses a fixed `[1, 3, 7, 14, 30]` day offset table. No feedback loop — the interval is the same whether the student got 100% correct or 0% after review.

**Solution:** Replace with SM-2. Quality is derived from post-practice accuracy on notebook topics after a review event.

#### When SM-2 runs

SM-2 updates are applied **after a curriculum session is completed** (`POST /api/curriculum/sessions/[n]/complete`). At that point:
1. The session's `QuestionAttempt` records are already in the DB
2. Per-topic accuracy can be computed for topics practiced in this session
3. Any notebook entries for those topics can be updated with SM-2 intervals

This avoids the timing problem (quality can't be measured at the moment of review — only after subsequent practice). The current review PATCH route is **not changed** in Phase 2.

#### New pure function: `computeSM2Update()`

**File:** `lib/services/errorNotebook.ts` (extends existing file, no renames)

```typescript
interface SM2UpdateInput {
  reviewStage: number;       // current stage (0–N)
  easeFactor: number;        // current EF (default 2.5 when null in DB)
  quality: number;           // 0–5 derived from post-review accuracy
}

interface SM2UpdateResult {
  newReviewStage: number;
  newEaseFactor: number;     // clamped to [1.3, 2.5]
  intervalDays: number;      // days until next review
}

export function computeSM2Update(input: SM2UpdateInput): SM2UpdateResult
```

**Algorithm:**
```
quality = accuracy-to-quality mapping (see below)

if quality < 3:
  newStage = 0
  intervalDays = 1

elif reviewStage === 0:
  newStage = 1
  intervalDays = 1

elif reviewStage === 1:
  newStage = 2
  intervalDays = 6

else:
  // Compute interval iteratively from stage (avoids storing prevInterval)
  let interval = 6
  for i in 2..reviewStage:
    interval = round(interval × easeFactor)
  newStage = reviewStage + 1
  intervalDays = round(interval × easeFactor)

newEaseFactor = clamp(
  easeFactor + 0.1 − (5 − quality) × (0.08 + (5 − quality) × 0.02),
  1.3, 2.5
)
```

**Quality mapping from `postReviewAccuracy`:**
```
accuracy ≥ 0.90 → quality 5  (perfect recall)
accuracy ≥ 0.80 → quality 4  (correct with effort)
accuracy ≥ 0.60 → quality 3  (correct with difficulty — minimum for interval growth)
accuracy ≥ 0.40 → quality 2  (incorrect but easy to recall → reset)
accuracy < 0.40  → quality 1  (near blackout → reset)
```

Quality is derived from `QuestionAttempt` data within the session — the same accuracy computation already used by `computeImprovementSignal()`.

#### New service function: `applySM2ForSession()`

**File:** `lib/services/errorNotebook.ts`

```typescript
export async function applySM2ForSession(
  userId: string,
  curriculumSessionId: string
): Promise<void>
```

1. Fetch all `QuestionAttempt` for `(userId, curriculumSessionId)`, with `question.topic`
2. Group by `canonicalTopic()` → compute accuracy per topic
3. Fetch open `ErrorNotebookEntry` for `userId` where `concept IN topics` and `status !== MASTERED`
4. For each entry, map accuracy to quality, call `computeSM2Update()`, write `reviewStage`, `easeFactor`, `nextReviewAt`

**Called from:** `POST /api/curriculum/sessions/[n]/complete` route, after the existing completion logic. If `applySM2ForSession()` throws, the error is caught and logged — session completion must not fail due to SM-2.

#### Backward compatibility

`nextReviewDate()` and `isFinalStage()` keep their existing signatures. No callers change. SM-2 is additive: if a session completes without a matching notebook entry for any practiced topic, nothing changes. Entries with `status === MASTERED` are skipped.

#### Implementation Status

✓ **IMPLEMENTED (2026-06-28)**
- `accuracyToQuality()` pure function
- `computeSM2Update()` pure SM-2 engine
- `applySM2ForSession()` service orchestrator
- Route integration with try/catch
- 43 test assertions (all passing)
- 284 Phase 1 tests remain green
- Build verified clean (35 routes)

---

### M2.2 — Learning Behavior Engine

**Problem:** `QuestionAttempt.timeSpentSec`, `UserSessionProgress.startedAt`/`completedAt`, and `MoodEntry` are collected but never analyzed.

**New file:** `lib/analytics/behaviorEngine.ts`

#### Output type

```typescript
export type SessionTimeOfDay = "MORNING" | "AFTERNOON" | "EVENING";
// MORNING: 06:00–11:59 · AFTERNOON: 12:00–17:59 · EVENING: 18:00–23:59

export type PaceProfile = "CONSISTENT" | "DECLINING" | "VARIABLE";
// Derived from first-third vs last-third accuracy across the last N completed sessions

export type EffortSignal = "HIGH" | "MODERATE" | "LOW";
// HIGH:     avgTimePerQuestion ≥ 30s (where timeSpentSec is non-null)
// MODERATE: 10s–29s
// LOW:      < 10s, OR < 5 non-null timing records (insufficient data)

export type MoodTrend = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
// POSITIVE: majority of last 7 entries are GREAT or GOOD
// NEGATIVE: majority are TIRED or STRESSED
// NEUTRAL:  otherwise

export interface BehaviorProfile {
  preferredTimeOfDay: SessionTimeOfDay | null;  // null: < 5 sessions
  paceProfile: PaceProfile | null;              // null: < 3 sessions
  avgSessionDurationMin: number | null;         // null: no startedAt/completedAt pairs
  effortSignal: EffortSignal | null;            // null: insufficient timeSpentSec data
  recentMoodTrend: MoodTrend | null;            // null: < 5 mood entries
  sessionCount: number;                         // total completed sessions analyzed
  confidenceTier: ConfidenceTier;               // OBSERVED < 5, EMERGING 5–9, CONFIRMED ≥ 10
}
```

#### Input types (pure engine layer)

```typescript
interface SessionDataPoint {
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: { isCorrect: boolean; timeSpentSec: number | null; attemptedAt: Date }[];
}

interface MoodDataPoint {
  mood: "GREAT" | "GOOD" | "OKAY" | "TIRED" | "STRESSED";
  createdAt: Date;
}
```

#### Pure function

```typescript
export function computeBehaviorProfile(
  sessions: SessionDataPoint[],
  moodEntries: MoodDataPoint[]
): BehaviorProfile
```

No DB access. Takes pre-fetched data. Fully testable without Prisma.

#### Repository function

```typescript
export async function getBehaviorProfile(userId: string): Promise<BehaviorProfile>
```

Fetches:
- `UserSessionProgress` where `status = COMPLETED` with `startedAt`, `completedAt`
- `QuestionAttempt` for those sessions: `isCorrect`, `timeSpentSec`, `attemptedAt`, `curriculumSessionId`
- `MoodEntry` for `userId` ordered by `createdAt DESC`, limit 14

Passes to `computeBehaviorProfile()`.

#### Confidence tiers

| Sessions completed | ConfidenceTier |
|---|---|
| 0–4 | OBSERVED |
| 5–9 | EMERGING |
| 10+ | CONFIRMED |

Signals with insufficient data return `null` — not shown to the student. The `BehaviorProfile` itself is always returned (even all-null), so consumers can render empty states.

#### Implementation Status

✓ **IMPLEMENTED (2026-06-29)**
- `SessionTimeOfDay`, `PaceProfile`, `ResponseTimeSignal`, `MoodContext`, `BehaviorProfile` types
- `computeBehaviorProfile()` pure function with 5 derivation helpers
- `getBehaviorProfile()` repository function (3-query Promise.all)
- `StudentLearningProfile.behaviorProfile` field (additive, with `.catch()` fallback)
- 51 test assertions (all passing)
- 327 Phase 1 + M2.1 tests remain green
- Build verified clean
- Note: `effortSignal` renamed to `responseTimeSignal` to reflect observed response-time
  behavior rather than inferred psychological effort (per implementation constraints)

---

### M2.3 — Adaptive Practice Foundation

**Problem:** `getPracticeQuestions()` returns a fixed set — all questions for a session, or a topic-matched fallback. Difficulty is not considered. A student with 90% grammar accuracy trains on the same EASY grammar questions as a student with 30% accuracy.

#### New file: `lib/analytics/difficultyCalibration.ts`

```typescript
export type DifficultyTarget = "EASY" | "MEDIUM" | "HARD";

export interface TopicDifficultyCalibration {
  topic: string;
  target: DifficultyTarget;
  recentAttempts: number;   // how many attempts this is based on
}

// Pure function — no DB access
export function computeDifficultyTarget(
  recentAttempts: { isCorrect: boolean; difficulty: string }[],
  minSamples?: number       // default: 5; below this threshold → return null
): DifficultyTarget | null
```

**Target rules (last N attempts on a topic):**
```
accuracy > 0.80 → HARD    (student is mastering — increase challenge)
accuracy 0.50–0.80 → MEDIUM  (working zone — stay here)
accuracy < 0.50 → EASY    (struggling — reduce friction, build confidence)
```

#### Modified function: `getPracticeQuestions()`

**File:** `lib/services/curriculum.ts`

```typescript
// New signature — userId is optional; existing callers are unchanged
export async function getPracticeQuestions(
  session: CurriculumSession & { questions: Question[] },
  userId?: string
): Promise<Question[]>
```

When `userId` is provided and `session.sessionType !== "MOCK_EXAM"` and `session.sessionType !== "CHECKPOINT"`:
1. Fetch recent attempts per topic for this student
2. Compute `DifficultyTarget` per topic using `computeDifficultyTarget()`
3. Re-weight question selection: when the session has more questions than needed, prefer questions matching the student's calibrated difficulty

**Selection weights by target:**

| Target | EASY weight | MEDIUM weight | HARD weight |
|---|---|---|---|
| EASY | 70% | 25% | 5% |
| MEDIUM | 20% | 55% | 25% |
| HARD | 5% | 25% | 70% |

**Bypass rules:**
- `MOCK_EXAM` sessions: always use full question set as-is (the real exam does not adapt)
- `CHECKPOINT` sessions: use unweighted selection (checkpoint must sample evenly)
- Sessions with exactly the right number of questions (no selection needed): return as-is regardless

**Backward compatibility:** All existing callers (`practice/[sessionNumber]/page.tsx`, `practice/topic/[topic]/page.tsx`) work unchanged — `userId` is simply absent, returning to current behavior.

#### Implementation Status

✓ **IMPLEMENTED (2026-06-29)**
- `computeDifficultyTarget()` — pure function, accuracy-only input (no mood, no behavior profile, no self-report)
- `computeSelectionWeights()` — deterministic weight table for EASY/MEDIUM/HARD targets
- `applyDifficultyWeighting()` — generic weighted selection with empty-pool redistribution to MEDIUM
- `getPracticeQuestions(session, userId?)` — optional userId parameter; all bypass rules inside function
- `practice/[sessionNumber]/page.tsx` — one-line change to pass `user.id`
- No schema migration — `Question.difficulty` already existed since initial migration
- 47 new test assertions (all passing); 378 prior tests remain green
- Build verified clean (35 routes)

**Bypass rules confirmed in implementation:**
- `MOCK_EXAM` → full question set returned unchanged
- `CHECKPOINT` → unweighted question set returned unchanged
- `userId` absent → original behavior (all questions, no selection)
- Pool size ≤ `TARGET_PRACTICE_COUNT` (10) → all questions returned unchanged
- `< 5` topic-matching attempts → `null` target → no weighting applied

---

### M2.4 — Learning Signal Engine

**Problem:** LEXI is reactive — it responds when the student completes something. A companion should occasionally surface patterns the student hasn't asked about.

**New file:** `lib/analytics/learningSignals.ts`

Learning signals are deterministic observations derived from the student's profile data. No AI calls. No new DB queries (all input comes from `StudentLearningProfile` + `BehaviorProfile`).

#### Output type

```typescript
export type SignalType =
  | "STREAK_MILESTONE"         // streak hits 3, 7, 14, 30
  | "FIRST_TOPIC_MASTERED"     // first ever MASTERED topic in notebook
  | "NOTEBOOK_CLEARED"         // 3+ topics moved to MASTERED this session
  | "PACE_OBSERVATION"         // paceProfile = DECLINING across 3+ sessions
  | "RETENTION_PATTERN"        // topic reviewed 3+ times, still RECURRING
  | "EFFORT_RECOGNITION";      // HIGH effort + accuracy improved this session

export type SignalPriority = "HIGH" | "MEDIUM" | "LOW";

export interface LearningSignal {
  type: SignalType;
  priority: SignalPriority;
  message: string;             // Vietnamese — positive framing, no forbidden vocabulary
  suppressionKey: string;      // e.g. "STREAK_MILESTONE_7" — deduplicate identical signals
}
```

#### Pure function

```typescript
// Pure — no DB access; all input pre-fetched
export function computeLearningSignals(
  profile: StudentLearningProfile,
  behavior: BehaviorProfile | null,
  currentStreak: number
): LearningSignal[]
```

Returns signals sorted by `priority` DESC. Empty array is valid (no signals today).

#### Signal rules

| Signal | Condition | Priority | Example message |
|---|---|---|---|
| `STREAK_MILESTONE` | streak ∈ {3, 7, 14, 30} | MEDIUM | "Em đã học liên tục 7 ngày — đó là thói quen rất tốt!" |
| `FIRST_TOPIC_MASTERED` | `masterySummary.masteredTopics.length === 1` (transition 0→1) | HIGH | "Đây là lần đầu tiên em thực sự làm chủ được một chủ điểm!" |
| `NOTEBOOK_CLEARED` | ≥3 topics newly MASTERED vs. last profile | MEDIUM | "Em đã giải quyết được 3 lỗi trong sổ ghi chú tuần này." |
| `PACE_OBSERVATION` | `behavior.paceProfile === "DECLINING"` for 3+ sessions | LOW | "Lexi thấy em thường làm tốt hơn ở đầu buổi. Thử nghỉ ngắn giữa chừng nhé." |
| `RETENTION_PATTERN` | any topic: `improvementSignal === "RECURRING"` AND `totalOccurrences ≥ 5` | HIGH | "Conditional sentences đã được ôn lại nhiều lần. Hãy thử luyện theo cách khác." |
| `EFFORT_RECOGNITION` | `behavior.effortSignal === "HIGH"` AND readiness improved vs. previous | MEDIUM | "Hôm nay em luyện rất chăm chỉ và kết quả cũng tốt hơn!" |

**Persona rules (same as Phase 1 narrative layer):**
- Vietnamese output
- No "sai", "kém", "yếu", "thất bại", "RECURRING", "MASTERED", or internal enum names
- All observations framed as positive facts, not judgments

#### Suppression logic

Each `LearningSignal` has a `suppressionKey`. The same key is not shown twice within 3 sessions. Suppression state is tracked as a small in-memory list in the session-boundary code, not persisted to the DB (losing it on restart is acceptable — the signal just shows again next session if conditions still hold).

#### Implementation Status

✓ **IMPLEMENTED (2026-06-29)**
- `learningSignalEngine.ts` — pure `computeLearningSignals(profile, currentStreak)` function
- 8 signal types (all condition-driven, deterministic):
  - `FIRST_MASTERY` — exactly 1 mastered topic; HIGH severity
  - `TOPIC_MASTERED` — 2+ mastered topics; MEDIUM severity per topic
  - `TOPIC_IMPROVING` — IMPROVING masteryState; MEDIUM severity; confidence from occurrence count
  - `RECURRING_WEAKNESS` — RECURRING signal + ≥3 occurrences; HIGH severity
  - `RETENTION_RISK` — dueCount > 0 + non-RECURRING; MEDIUM severity; confidence from due count
  - `LEARNING_MOMENTUM` — learningTrend = PROGRESSING; MEDIUM severity; confidence from BehaviorProfile tier
  - `PACE_OBSERVATION` — paceProfile = DECLINING + sessionCount ≥ 3; LOW severity
  - `STREAK_MILESTONE` — streak ∈ {3, 7, 14, 30}; MEDIUM severity
- `getLearningSignals(userId)` — service function; parallel fetch of StudentLearningProfile + streak
- Signal cap = 5; sorting by severity DESC, then topic-specific before global
- 58 test assertions (all passing)
- 483 total tests passing (58 new + 425 prior)
- Build verified clean (35 routes)

**Deferred signals (explicitly NOT included — documented in plan):**
- "declining" (topic regression) — requires historical snapshot
- `EFFORT_RECOGNITION` — requires reliable effort proxy (timeSpentSec is not one)
- `NOTEBOOK_CLEARED` — requires previous-snapshot comparison

**Design constraints honored:**
- No schema migration — all data comes from StudentLearningProfile + getLearningStreak()
- No AI — all signals are rule-based observations
- No event sourcing — signals are computed on-demand
- StudentLearningProfile not modified in M2.4 (M2.5 integrates signals into profile)
- Suppression key format enables deduplication (caller's responsibility)

---

### M2.5 — StudentLearningProfile v2 IMPLEMENTATION STATUS

**Status:** IMPLEMENTED — 2026-06-29

**Files changed:**
- `lib/analytics/studentLearningProfile.ts` — extended (no new file)
- `prisma/schema.prisma` — migration: `targetGoalDate DateTime?` added to `LearnerProfile`
- `lib/analytics/index.ts` — added `GoalCountdown`, `computeGoalCountdown` exports
- `scripts/test-profile-v2.mjs` — new: 33 test assertions

**New types added:**
```typescript
interface GoalCountdown {
  targetGoalDate: string;  // "YYYY-MM-DD"
  daysRemaining: number;   // positive = future, 0 = today, negative = past
  isUrgent: boolean;       // 0 < daysRemaining <= 30
}
```

**New pure function:** `computeGoalCountdown(targetGoalDate: Date | null, now: Date): GoalCountdown | null`

**New fields on `StudentLearningProfile`:**
```typescript
currentStreak: number;              // from getLearningStreak()
topSignal: LearningSignal | null;   // highest-priority signal; two-pass in service
goalCountdown: GoalCountdown | null; // from LearnerProfile.targetGoalDate
```

**New fields on `LearningProfileContext`:**
```typescript
currentStreak: number;
targetGoalDate: Date | null;
```

**Two-pass pattern in `getStudentLearningProfile()`:**
`buildLearningProfile(ctx)` → base profile with `topSignal: null` placeholder →
`computeLearningSignals(baseProfile, streak)` → `return { ...baseProfile, topSignal: signals[0] ?? null }`

**Design constraints honored:**
- `targetExamDate` renamed to `targetGoalDate` (supports broader learning goals beyond exams)
- Profile remains flat — no nested objects
- `topSignal` derived-only, not persisted
- M2.1–M2.4 engines unchanged
- 33 new tests; 516 total passing (33 new + 483 prior)
- Schema migration backward-compatible (nullable field, no default)

---

### M2.5 — StudentLearningProfile v2 (Extension)

**File extended:** `lib/analytics/studentLearningProfile.ts`

Add three new fields to `StudentLearningProfile` (all nullable — zero breaking changes):

```typescript
export interface StudentLearningProfile {
  // ── existing Phase 1 fields (unchanged) ──
  userId: string;
  generatedAt: string;
  readiness: ReadinessResult | null;
  masterySummary: MasterySummary;
  skillSnapshot: SkillSnapshot[];
  learningTrend: LearningTrend;
  improvingTopics: TopicMasteryProfile[];
  activeWeaknesses: ActiveWeakness[];
  recommendations: PracticeRecommendation[];
  nextSessionNumber: number | null;
  nextSessionTitle: string | null;
  nextSessionObjective: string | null;

  // ── Phase 2 additions (all nullable) ──
  behaviorProfile: BehaviorProfile | null;   // from M2.2
  topSignal: LearningSignal | null;          // from M2.4 — highest-priority signal only
  examCountdown: ExamCountdown | null;       // from targetExamDate if set
}
```

`getStudentLearningProfile()` gains two additional parallel fetches in its `Promise.all`:
1. `getBehaviorProfile(userId)` → `BehaviorProfile | null`
2. `learnerProfile` (for `targetExamDate`) — already fetched by callers; pass in or re-fetch

`computeLearningSignals()` runs after the parallel fetches, using the assembled profile. The top signal by priority is stored as `topSignal`.

`buildLearningProfile()` signature gains `behaviorProfile` and `topSignal` on `LearningProfileContext`. Both are optional (default `null`) so existing tests that construct mock contexts don't break.

---

## 6. Service Boundaries

```
lib/analytics/
  behaviorEngine.ts       ← NEW (M2.2): pure engine + repository
  difficultyCalibration.ts ← NEW (M2.3): pure engine only
  learningSignals.ts      ← NEW (M2.4): pure engine only
  studentLearningProfile.ts ← EXTEND (M2.5): gains BehaviorProfile + LearningSignal fields

lib/services/
  errorNotebook.ts        ← EXTEND (M2.1): add computeSM2Update() + applySM2ForSession()
  curriculum.ts           ← EXTEND (M2.3): getPracticeQuestions() gains optional userId

app/api/
  curriculum/sessions/[n]/complete/route.ts ← EXTEND (M2.1): call applySM2ForSession()
```

**What is NOT a new file or table:**
- No new Prisma models
- No new route handlers (SM-2 hooks into the existing complete route)
- No new UI components are specified in this design — UI decisions for Phase 2 signals belong in a separate UI design pass

---

## 7. Implementation Order

Order is chosen for dependency and risk isolation:

### M2.1 — SM-2 (implement first)

**Why first:** Fully isolated to `errorNotebook.ts`. No dependency on other Phase 2 modules. Highest retention ROI. Can be test-covered with pure function tests before any route change. The complete-route extension is a small try/catch addition.

**Files:** `lib/services/errorNotebook.ts`, `app/api/curriculum/sessions/[n]/complete/route.ts`

**Test script:** `scripts/test-sm2.mjs` — covers all quality boundaries (5/4/3/2/1), stage reset on quality < 3, EF clamping, interval growth, remedial guard.

---

### M2.2 — Behavior Engine (second)

**Why second:** Pure computation from existing data. No dependency on SM-2. Provides `BehaviorProfile` that M2.4 and M2.5 depend on.

**Files:** `lib/analytics/behaviorEngine.ts`

**Test script:** `scripts/test-behavior.mjs` — covers time-of-day computation, pace profile (consistent/declining/variable), effort signal, mood trend, confidence tiers, all-null sparse-data paths.

---

### M2.3 — Adaptive Practice (third)

**Why third:** Independent of M2.1 and M2.2 in terms of data. Safe to implement after behavior engine is verified, since it requires its own accuracy data (not behavior signals).

**Files:** `lib/analytics/difficultyCalibration.ts`, `lib/services/curriculum.ts`

**Test script:** `scripts/test-difficulty-calibration.mjs` — covers target computation at accuracy boundaries, weight distributions, MOCK_EXAM bypass, insufficient-data null return.

---

### M2.4 — Learning Signal Engine (fourth)

**Why fourth:** Depends on `BehaviorProfile` (from M2.2). Uses `StudentLearningProfile` data already available.

**Files:** `lib/analytics/learningSignals.ts`

**Test script:** `scripts/test-learning-signals.mjs` — covers each signal type trigger condition, priority ordering, forbidden vocabulary, empty-signals path.

---

### M2.5 — StudentLearningProfile v2 (last)

**Why last:** Integration milestone. Extends the profile with all Phase 2 signals. Verifies that the full pipeline still passes the existing 68 test cases plus new ones for the added fields.

**Files:** `lib/analytics/studentLearningProfile.ts`, `lib/analytics/index.ts`

**Verification:** All existing test suites pass unchanged. `npm run test:learning-profile` updated with new scenarios covering nullable Phase 2 fields.

---

## 8. Migration Plan

### New migration

```
migrations/20260625_phase2_target_exam_date/
  migration.sql:
    ALTER TABLE "LearnerProfile" ADD COLUMN "targetExamDate" DATETIME;
```

Single nullable column addition. No data change, no backfill, no index needed (accessed only by direct userId lookup).

### No other migrations

All other Phase 2 fields (`easeFactor`, `reviewStage`, `timeSpentSec`, etc.) already exist in the schema. They require no migration — only new write logic.

### Dev DB state

Run `npx prisma migrate dev` to apply the migration to the local SQLite dev.db. Existing rows gain `targetExamDate = NULL` automatically.

---

## 9. Backward Compatibility with Phase 1

| Concern | Verdict |
|---|---|
| Phase 1 analytics routes (`/api/analytics/session/[n]`, `/api/analytics/compare/[a]/[b]`) | Unchanged — no Phase 2 module touches these routes or their service chain |
| `StudentLearningProfile` type | Extended with optional fields — all existing consumers (dashboard, results page) compile without changes; new fields are simply absent from their destructuring |
| `getStudentLearningProfile()` function | Extended with additional parallel fetches — existing callers don't change; the new fields are nullable, so the function always returns a valid profile |
| `getPracticeQuestions()` | Optional `userId` parameter — all existing call sites omit it; behavior is identical to current |
| `errorNotebook.ts` exports | `nextReviewDate()` and `isFinalStage()` signatures unchanged; new exports added alongside them |
| Existing test suites (284 tests) | Zero changes expected — no Phase 1 pure function logic is modified |
| Database | One additive migration — no column renames, removals, or type changes |
| `TOPIC_ALIASES` | Unchanged — canonicalization is Phase 1 territory |
| API contracts (`contracts.ts`) | Unchanged for Phase 1 routes; Phase 2 adds no new route contracts yet |

**The summary:** Phase 2 code is fully additive. Every Phase 1 test suite should pass without modification after Phase 2 is implemented.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `timeSpentSec` is NULL for most existing attempts (frontend may not have sent it reliably) | Medium | `effortSignal` returns `null` when fewer than 5 non-null records exist; BehaviorProfile degrades gracefully to all-null in sparse data |
| SM-2 `applySM2ForSession()` throws → session completion fails | Medium | Wrap in try/catch in the complete route; log the error but don't fail the HTTP response |
| Adaptive difficulty produces a confusing experience (student notices different questions) | Low | Calibration only applies to sessions with more questions than needed (topic-match fallback today already serves a subset); MOCK_EXAM sessions bypass calibration entirely |
| Learning signals become repetitive / annoying | Low | Suppression key system; one signal per session boundary; same key suppressed for 3 sessions |
| SM-2 quality proxy (post-session accuracy → quality score) is an approximation | Low | SM-2 degrades gracefully on imperfect quality inputs — worst case is a slightly wrong interval. Better than fixed offsets in all scenarios. |
| `targetExamDate` creates test anxiety if shown poorly | Low | Field is nullable; feature is completely hidden when not set. Framing is "time to reach readiness" — never a countdown clock |
| Phase 2 signals require enough data to be non-trivial | Medium | All signals have explicit minimum data guards (N sessions, N occurrences). Empty-signal path is a valid first-class output, not a fallback |

---

## 11. Deferred to Phase 3

The following were considered and explicitly deferred:

- **FSRS (Free Spaced Repetition Scheduler)** — more accurate than SM-2 but requires additional state. SM-2 maps directly to the existing schema. FSRS can replace the SM-2 algorithm body without schema change.
- **Mood → accuracy correlation signal** — requires 7+ paired mood+session data points. Will be meaningful only after several weeks of real student use. `MoodEntry` data is being collected; the analysis can be added to `behaviorEngine.ts` in Phase 3 without schema change.
- **Additional Lexi chat modes** (Error Detective, Practice Generator, Exam Coach, Motivation) — stub files exist (`lib/ai/modes/`). These require a UI mode selector that doesn't exist yet.
- **Multi-student support** — registration flow, tutor dashboard.
- **Recovery rate in readiness score** — requires 2+ real mock exam sessions from the actual student. Deferred pending data quality confirmation.
- **Gamification** — XP/achievements. Not modeled in the current schema.

---

_End of Phase 2 Final Design. Approved scope: M2.1 through M2.5. No code written._
