# Retire CurriculumSession, Phase 1 (Routes + Shared Functions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every route/page/feature that only serves `CurriculumSession`, and narrow every shared analytics function to accept `ProgramCurriculum` only — per the approved design at `docs/superpowers/specs/2026-07-27-retire-curriculumsession-phase1-design.md`. This is Phase 1 of 2; Phase 2 (schema drop + data purge) is separate, later work not covered here.

**Architecture:** Delete first (routes, pages, the whole session-comparison feature cascade), THEN narrow the shared functions (`AttemptScope` removed, `fetchSessionAttempts`/`getSessionAnalytics`/`applySM2ForSession`/the attempt route drop their CurriculumSession arm) — in that order, because the shared functions still have a live CurriculumSession-only caller until the routes are gone. `PracticeQuiz.tsx` relocates and simplifies once its only remaining caller is the Program route. `getPhaseProgress()` is replaced by a new `getProgramProgressSummary()`, consumed by the dashboard and `/progress` page.

**Tech Stack:** TypeScript, Next.js, Prisma (SQLite `dev.db`, unchanged in this phase). No test framework for DB-touching code in this repo — verification is `tsc --noEmit` + fixture scripts (this session's established convention) + `npm run test:all` + a live browser check.

## Global Constraints

- Do NOT touch the Prisma schema or delete any data — `CurriculumSession`/`CurriculumPhase`/`UserSessionProgress` rows and columns stay in the database, simply unread after this phase. Schema drop is Phase 2.
- No redirect for the deleted `/practice/[sessionNumber]` route — it 404s. Confirmed acceptable: this is still pre-launch (2 non-test accounts total).
- The session-comparison feature (`fetchSessionComparisonData`, `resolveSessionId`, `getSessionComparison`, `computeSessionComparison`, `ComparisonDirection`, `TopicComparison`, `SessionComparisonResult`, `toSessionComparisonResponse`, `TopicComparisonItem`, `SessionComparisonResponse`, `generateComparisonNarrative`, `ComparisonNarrative`, and the `/api/analytics/compare/[sessionA]/[sessionB]` route) is deleted entirely, not rebuilt for Program. Confirmed: nobody has asked for a Program-slot comparison feature.
- `getPhaseProgress()` is replaced by `getProgramProgressSummary()` — a simple completed/total count over `UserProgramProgress`/`ProgramCurriculum`, not a rebuilt "phase" grouping concept. `ProgramCurriculum` has no phase/grouping relation and this plan does not add one.
- Task order matters and must not be parallelized: shared functions (`getSessionAnalytics`, `applySM2ForSession`, `fetchSessionAttempts`, the attempt route) cannot be narrowed until every CurriculumSession-only route calling them with `curriculumSessionId` is deleted first.
- Every task must leave the project in a state where `npx tsc --noEmit` passes — no task should leave a dangling import to a file another, later task deletes.

---

### Task 1: Delete every CurriculumSession-only route, page, and the session-comparison feature

**Files:**
- Delete: `app/(app)/practice/[sessionNumber]/page.tsx`
- Delete: `app/(app)/practice/[sessionNumber]/results/page.tsx`
- Delete: `app/api/curriculum/sessions/[sessionNumber]/start/route.ts`
- Delete: `app/api/curriculum/sessions/[sessionNumber]/complete/route.ts`
- Delete: `app/api/analytics/session/[sessionNumber]/route.ts`
- Delete: `app/api/analytics/compare/[sessionA]/[sessionB]/route.ts`
- Modify: `lib/analytics/repository.ts` (remove `fetchSessionComparisonData`, `resolveSessionId`)
- Modify: `lib/analytics/service.ts` (remove `getSessionComparison`)
- Modify: `lib/analytics/types.ts` (remove `ComparisonDirection`, `TopicComparison`, `SessionComparisonResult`)
- Modify: `lib/analytics/sessionAnalytics.ts` (remove `computeSessionComparison` and its now-unused imports)
- Modify: `lib/analytics/contracts.ts` (remove `TopicComparisonItem`, `SessionComparisonResponse`, `mapTopicComparison`, `overallComparisonConfidence`, `toSessionComparisonResponse`, and the now-unused `ComparisonDirection`/`TopicComparison`/`SessionComparisonResult` imports)
- Modify: `lib/analytics/narrative.ts` (remove `ComparisonNarrative`, `generateComparisonNarrative`, and the now-unused `SessionComparisonResponse` import)
- Modify: `lib/analytics/index.ts` (remove all the above from the barrel's exports)

**Interfaces:**
- Produces: nothing new. This task only deletes.
- Note for Task 2: after this task, `getSessionAnalytics`, `applySM2ForSession`, `fetchSessionAttempts`, and `app/api/questions/[id]/attempt/route.ts`'s `curriculumSessionId` handling still exist UNCHANGED — they have zero remaining CurriculumSession-only callers after this task, which is what makes Task 2 safe.

**Note on `AttemptWithQuestion.id`/`AttemptScope`:** this task does NOT touch `AttemptScope` or `fetchSessionAttempts` — only `fetchSessionComparisonData`/`resolveSessionId`, which are separate exports in the same file. Leave the rest of `repository.ts` untouched in this task.

- [ ] **Step 1: Delete the two practice pages**

```bash
rm "app/(app)/practice/[sessionNumber]/page.tsx"
rm "app/(app)/practice/[sessionNumber]/results/page.tsx"
```

(`PracticeQuiz.tsx` in this same directory is NOT deleted here — it's relocated in Task 3, once its only remaining caller is the Program route.)

- [ ] **Step 2: Delete the four CurriculumSession-only API routes**

```bash
rm "app/api/curriculum/sessions/[sessionNumber]/start/route.ts"
rm "app/api/curriculum/sessions/[sessionNumber]/complete/route.ts"
rm "app/api/analytics/session/[sessionNumber]/route.ts"
rm "app/api/analytics/compare/[sessionA]/[sessionB]/route.ts"
```

If any of these directories become empty after deletion, remove the empty directory too (Next.js route directories with no `route.ts`/`page.tsx` are dead weight, not a functional problem, but should not be left behind).

- [ ] **Step 3: Remove the comparison feature from `lib/analytics/repository.ts`**

Delete these two functions entirely (currently the file's `fetchSessionComparisonData` and `resolveSessionId`):

```typescript
/**
 * Fetch attempts from two sessions for topic-to-topic comparison.
 *
 * Returns attempts for both sessions in a single call.
 * The engine (computeSessionComparison) receives them separately.
 */
export async function fetchSessionComparisonData(
  userId: string,
  sessionAId: string,
  sessionBId: string
): Promise<{ sessionA: AttemptWithQuestion[]; sessionB: AttemptWithQuestion[] }> {
  const [sessionA, sessionB] = await Promise.all([
    fetchSessionAttempts(userId, { curriculumSessionId: sessionAId }),
    fetchSessionAttempts(userId, { curriculumSessionId: sessionBId }),
  ]);

  return { sessionA, sessionB };
}

/**
 * Resolve a curriculum session's internal ID from its human-facing session number.
 * Used by route handlers to translate URL params to DB IDs before calling the repository.
 */
export async function resolveSessionId(sessionNumber: number): Promise<string | null> {
  const session = await prisma.curriculumSession.findUnique({
    where: { sessionNumber },
    select: { id: true },
  });
  return session?.id ?? null;
}
```

Leave everything else in this file untouched (`AttemptScope`, `fetchSessionAttempts`, `fetchNotebookContext`, `findMostRecentlyCompletedScope` are Task 2's job).

- [ ] **Step 4: Remove `getSessionComparison` from `lib/analytics/service.ts`**

Delete this function:

```typescript
/**
 * Compare per-topic accuracy between two curriculum sessions.
 *
 * Returns a topic-by-topic delta view showing which areas improved,
 * declined, or stayed similar. Topics with insufficient data in either
 * session are included with direction INSUFFICIENT_DATA rather than omitted,
 * so the UI can explain the gap.
 */
export async function getSessionComparison(
  userId: string,
  sessionAId: string,
  sessionBId: string,
  sessionANumber: number,
  sessionBNumber: number
): Promise<SessionComparisonResult> {
  const { sessionA, sessionB } = await fetchSessionComparisonData(
    userId,
    sessionAId,
    sessionBId
  );

  return computeSessionComparison(sessionA, sessionB, sessionANumber, sessionBNumber);
}
```

Update the file's import block (currently):

```typescript
import {
  fetchSessionAttempts,
  fetchNotebookContext,
  fetchSessionComparisonData,
  NotebookContextRow,
  AttemptScope,
} from "./repository";
import {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
  computeSessionComparison,
} from "./sessionAnalytics";
import type {
  BlueprintCoverage,
  ReadinessResult,
  WeaknessTopic,
  NotebookContext,
  SessionComparisonResult,
} from "./types";
```

to:

```typescript
import {
  fetchSessionAttempts,
  fetchNotebookContext,
  NotebookContextRow,
  AttemptScope,
} from "./repository";
import {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
} from "./sessionAnalytics";
import type {
  BlueprintCoverage,
  ReadinessResult,
  WeaknessTopic,
  NotebookContext,
} from "./types";
```

- [ ] **Step 5: Remove comparison types from `lib/analytics/types.ts`**

Delete this whole contiguous block (currently lines 188-211, including its doc comment):

```typescript
/**
 * Comparison between two session attempts per topic.
 * Shows whether the student improved, declined, or had similar performance.
 */
export type ComparisonDirection = "IMPROVED" | "DECLINED" | "SIMILAR" | "INSUFFICIENT_DATA";

export interface TopicComparison {
  topic: string;
  label: string;
  session1: { correct: number; total: number; accuracy: number } | null;
  session2: { correct: number; total: number; accuracy: number } | null;
  delta: number | null; // session2.accuracy - session1.accuracy
  direction: ComparisonDirection;
  confidence: ConfidenceTier;
}

export interface SessionComparisonResult {
  session1Number: number;
  session2Number: number;
  topics: TopicComparison[];
  improvedCount: number;
  declinedCount: number;
  insufficientDataCount: number;
}
```

- [ ] **Step 6: Remove `computeSessionComparison` from `lib/analytics/sessionAnalytics.ts`**

Find and delete the `computeSessionComparison` function (currently starting around line 382) and remove `TopicComparison`, `SessionComparisonResult`, `ComparisonDirection` from this file's type-only import block (currently lines 29-31, part of a larger import from `./types` — only remove these three named imports, keep every other named import in that same statement untouched).

- [ ] **Step 7: Remove comparison contract mapping from `lib/analytics/contracts.ts`**

Change the import block (currently):

```typescript
import type {
  SectionBreakdown,
  SectionCoverage,
  WeaknessTopic,
  TopicComparison,
  SessionComparisonResult,
  ComparisonDirection,
} from "./types";

export type { ComparisonDirection };
```

to:

```typescript
import type {
  SectionBreakdown,
  SectionCoverage,
  WeaknessTopic,
} from "./types";
```

Delete this whole block (currently lines 166-200 — the `TopicComparisonItem`/`SessionComparisonResponse` interfaces and their section header):

```typescript
// ──────────────────────────────────────────────────────────────────
// SessionComparisonResponse — main contract
// ──────────────────────────────────────────────────────────────────

/** One topic's comparison between two sessions. */
export interface TopicComparisonItem {
  topic: string;
  label: string;
  direction: ComparisonDirection;
  delta: number | null;         // session2.accuracy - session1.accuracy; null if INSUFFICIENT_DATA
  confidence: ConfidenceLevel;
  session1: { correct: number; total: number; accuracy: number } | null;
  session2: { correct: number; total: number; accuracy: number } | null;
}

/**
 * Topic-by-topic comparison between two curriculum sessions.
 * Returned by GET /api/analytics/compare/[sessionA]/[sessionB].
 *
 * Field layout:
 *   topics           — full topic list, comparable topics first
 *   summary          — aggregate counts for quick UI display
 *   confidence       — overall comparison quality (min confidence across comparable topics)
 */
export interface SessionComparisonResponse {
  session1Number: number;
  session2Number: number;
  confidence: ConfidenceLevel;  // most conservative confidence across comparable topics
  topics: TopicComparisonItem[];
  summary: {
    improvedCount: number;
    declinedCount: number;
    insufficientDataCount: number;
  };
}
```

Delete `mapTopicComparison` (currently):

```typescript
function mapTopicComparison(tc: TopicComparison): TopicComparisonItem {
  return {
    topic: tc.topic,
    label: tc.label,
    direction: tc.direction as ComparisonDirection,
    delta: tc.delta,
    confidence: tc.confidence as ConfidenceLevel,
    session1: tc.session1,
    session2: tc.session2,
  };
}
```

Delete `overallComparisonConfidence` and its preceding `CONFIDENCE_ORDER` constant (confirmed: `CONFIDENCE_ORDER` is referenced nowhere else in this file, so both are deleted together):

```typescript
const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
  OBSERVED: 0,
  EMERGING: 1,
  CONFIRMED: 2,
};

/** Derive the most conservative confidence across all comparable topics. */
function overallComparisonConfidence(topics: TopicComparisonItem[]): ConfidenceLevel {
  const comparable = topics.filter((t) => t.direction !== "INSUFFICIENT_DATA");
  if (comparable.length === 0) return "OBSERVED";
  return comparable.reduce<ConfidenceLevel>(
    (lowest, t) =>
      CONFIDENCE_ORDER[t.confidence] < CONFIDENCE_ORDER[lowest] ? t.confidence : lowest,
    "CONFIRMED"
  );
}
```

Delete `toSessionComparisonResponse` (currently, at the end of the file):

```typescript
/**
 * Convert service output → API contract for session comparison.
 * Called in GET /api/analytics/compare/[sessionA]/[sessionB].
 */
export function toSessionComparisonResponse(
  result: SessionComparisonResult
): SessionComparisonResponse {
  const topics = result.topics.map(mapTopicComparison);

  return {
    session1Number: result.session1Number,
    session2Number: result.session2Number,
    confidence: overallComparisonConfidence(topics),
    topics,
    summary: {
      improvedCount: result.improvedCount,
      declinedCount: result.declinedCount,
      insufficientDataCount: result.insufficientDataCount,
    },
  };
}
```

Update the file's header doc comment — remove the line `*   GET /api/analytics/compare/[sessionA]/[sessionB] → SessionComparisonResponse` from the comment block at the top of the file (the `GET /api/analytics/session/[sessionNumber] → SessionAnalyticsResponse` line above it stays).

- [ ] **Step 8: Remove comparison narrative from `lib/analytics/narrative.ts`**

Change this file's import (currently):

```typescript
import type {
  SessionAnalyticsResponse,
  SessionComparisonResponse,
  WeaknessSignalItem,
  ReadinessBand,
  ConfidenceLevel,
} from "./contracts";
```

to:

```typescript
import type {
  SessionAnalyticsResponse,
  WeaknessSignalItem,
  ReadinessBand,
  ConfidenceLevel,
} from "./contracts";
```

Delete the `ComparisonNarrative` interface (currently):

```typescript
/**
 * Student-facing narrative for a two-session comparison.
 */
export interface ComparisonNarrative {
  headline: string;
  /** 1-sentence summary of the overall change direction. */
  summary: string;
  /** Labels of topics where direction === IMPROVED. */
  improvedAreas: string[];
  /** Labels of topics where direction === DECLINED. */
  needsAttention: string[];
  /** Non-null only when confidence is OBSERVED. */
  confidenceNote: string | null;
}
```

Delete `generateComparisonNarrative` and its private helper `buildComparisonSummary` — these are the last two functions in the file (currently lines 254-331, from the `// generateComparisonNarrative` section header through the end of the file):

```typescript
// ──────────────────────────────────────────────────────────────────
// generateComparisonNarrative
// ──────────────────────────────────────────────────────────────────

/**
 * Generate student-facing narrative for a two-session comparison.
 *
 * Covers:
 *   1. Overall headline based on the balance of improved vs. declined topics
 *   2. 1-sentence summary of what changed
 *   3. Improved areas listed (direction === IMPROVED)
 *   4. Areas needing attention (direction === DECLINED)
 */
export function generateComparisonNarrative(
  response: SessionComparisonResponse
): ComparisonNarrative {
  const { summary, topics, confidence } = response;
  const { improvedCount, declinedCount } = summary;

  const totalComparable = topics.filter((t) => t.direction !== "INSUFFICIENT_DATA").length;

  const improvedAreas = topics
    .filter((t) => t.direction === "IMPROVED")
    .map((t) => t.label);

  const needsAttention = topics
    .filter((t) => t.direction === "DECLINED")
    .map((t) => t.label);

  let headline: string;
  let summaryText: string;

  if (totalComparable === 0) {
    headline = "Chưa đủ dữ liệu để so sánh chi tiết.";
    summaryText =
      "Cần thêm dữ liệu từ cả hai buổi học để có thể so sánh tiến bộ theo từng chủ đề. Hãy luyện thêm để Lexi có thể đánh giá chính xác hơn.";
  } else if (improvedCount > declinedCount) {
    headline = "Bạn đã tiến bộ so với buổi trước!";
    summaryText = buildComparisonSummary(improvedCount, declinedCount);
  } else if (declinedCount > improvedCount) {
    headline = "Có một số phần cần chú ý thêm so với buổi trước.";
    summaryText = buildComparisonSummary(improvedCount, declinedCount);
  } else {
    headline =
      improvedCount > 0
        ? "Kết quả có sự thay đổi cân bằng so với buổi trước."
        : "Phong độ ổn định so với buổi trước.";
    summaryText = buildComparisonSummary(improvedCount, declinedCount);
  }

  return {
    headline,
    summary: summaryText,
    improvedAreas,
    needsAttention,
    confidenceNote: CONFIDENCE_NOTE[confidence],
  };
}

/**
 * Build the 1-sentence comparison summary.
 * Always refers to "so với buổi trước" (compared to last session).
 */
function buildComparisonSummary(improved: number, declined: number): string {
  if (improved === 0 && declined === 0) {
    return "Kết quả tương đương với buổi trước — bạn đang duy trì ổn định.";
  }

  const parts: string[] = [];
  if (improved > 0) {
    parts.push(`tiến bộ ở ${improved} chủ đề`);
  }
  if (declined > 0) {
    parts.push(`cần chú ý thêm ở ${declined} chủ đề`);
  }

  return `So với buổi trước, bạn đã ${parts.join(" và ")}.`;
}
```

Do NOT delete `CONFIDENCE_NOTE` (the constant referenced above) — it is shared with the file's other narrative generators (confirmed via grep: referenced by more than just `generateComparisonNarrative`). Leave it and everything above the deleted block untouched.

- [ ] **Step 9: Update the barrel (`lib/analytics/index.ts`)**

Remove every comparison-related name from each export block:

```typescript
export type {
  CoverageStatus,
  SectionCoverage,
  BlueprintCoverage,
  SectionBreakdown,
  ReadinessResult,
  WrongAttemptDetail,
  PatternObservation,
  NotebookContext,
  WeaknessTopic,
  SessionAnalyticsResult,
  SectionDropAnalysis,
  ComparisonDirection,
  TopicComparison,
  SessionComparisonResult,
} from "./types";
```

becomes (drop the last 3):

```typescript
export type {
  CoverageStatus,
  SectionCoverage,
  BlueprintCoverage,
  SectionBreakdown,
  ReadinessResult,
  WrongAttemptDetail,
  PatternObservation,
  NotebookContext,
  WeaknessTopic,
  SessionAnalyticsResult,
  SectionDropAnalysis,
} from "./types";
```

```typescript
export {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
  computeSessionComparison,
} from "./sessionAnalytics";
```

becomes:

```typescript
export {
  computeBlueprintCoverage,
  computeReadiness,
  computeWeaknessSignals,
} from "./sessionAnalytics";
```

```typescript
export {
  fetchSessionAttempts,
  fetchNotebookContext,
  fetchSessionComparisonData,
  resolveSessionId,
  findMostRecentlyCompletedScope,
} from "./repository";
```

becomes:

```typescript
export {
  fetchSessionAttempts,
  findMostRecentlyCompletedScope,
} from "./repository";
```

(Note: `fetchNotebookContext` drops out of this specific block's example above only because it's being illustrated — verify against the real file whether `fetchNotebookContext` is still used elsewhere before removing it from the barrel; it is NOT part of the comparison feature and must stay exported. The correct edit is: remove only `fetchSessionComparisonData` and `resolveSessionId` from this list, keep `fetchSessionAttempts`, `fetchNotebookContext`, `findMostRecentlyCompletedScope`.)

```typescript
export type { SessionAnalyticsOutput } from "./service";
export {
  getSessionAnalytics,
  getSessionComparison,
  enrichWeaknessWithNotebook,
} from "./service";
```

becomes:

```typescript
export type { SessionAnalyticsOutput } from "./service";
export {
  getSessionAnalytics,
  enrichWeaknessWithNotebook,
} from "./service";
```

```typescript
export type {
  ReadinessBand,
  ConfidenceLevel,
  SectionCoverageStatus,
  ReadinessSummary,
  BlueprintSectionItem,
  BlueprintCoverageSummary,
  SectionBreakdownItem,
  PatternSignal,
  NotebookRecord,
  WrongAnswerItem,
  WeaknessSignalItem,
  SessionAnalyticsResponse,
  TopicComparisonItem,
  SessionComparisonResponse,
} from "./contracts";
export {
  toSessionAnalyticsResponse,
  toSessionComparisonResponse,
} from "./contracts";
```

becomes:

```typescript
export type {
  ReadinessBand,
  ConfidenceLevel,
  SectionCoverageStatus,
  ReadinessSummary,
  BlueprintSectionItem,
  BlueprintCoverageSummary,
  SectionBreakdownItem,
  PatternSignal,
  NotebookRecord,
  WrongAnswerItem,
  WeaknessSignalItem,
  SessionAnalyticsResponse,
} from "./contracts";
export {
  toSessionAnalyticsResponse,
} from "./contracts";
```

```typescript
export type {
  ReadinessNarrative,
  WeaknessNarrative,
  ComparisonNarrative,
} from "./narrative";
export {
  generateReadinessNarrative,
  generateWeaknessNarrative,
  generateComparisonNarrative,
} from "./narrative";
```

becomes:

```typescript
export type {
  ReadinessNarrative,
  WeaknessNarrative,
} from "./narrative";
export {
  generateReadinessNarrative,
  generateWeaknessNarrative,
} from "./narrative";
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: errors ONLY in the 4 fixture test scripts that reference now-deleted `resolveSessionId`/comparison functions if any do (check: `test-analytics-scope.mjs`, `test-behavior-engine-scope.mjs`, `test-recent-completed-scope.mjs`, `test-sm2-program-scope.mjs` do NOT reference any comparison function — verify this is true; if so, expect 0 errors from this task). No error should reference a file this task didn't touch or intend to leave for a later task.

- [ ] **Step 11: Run the full test suite to confirm nothing broke**

Run: `npm run test:all`
Expected: every suite green (no test in this repo covers the deleted comparison feature or the deleted routes directly — they were never fixture-tested, only used via live routes — so no test should newly fail).

- [ ] **Step 12: Commit**

```bash
git add -u
git status --short
```

Review the `git status --short` output before committing — confirm it shows only deletions/modifications to the files named in this task (no accidental staging of `.superpowers/` or other gitignored scratch, and no unintended file). Then:

```bash
git commit -m "chore(curriculum): delete CurriculumSession-only routes/pages and the session-comparison feature"
```

---

### Task 2: Narrow shared functions to Program-only

**Files:**
- Modify: `lib/analytics/repository.ts` (`AttemptScope` removed, `fetchSessionAttempts` narrowed, `AttemptWithQuestion.curriculumSessionId` dropped, `findMostRecentlyCompletedScope` simplified)
- Modify: `lib/analytics/service.ts` (`getSessionAnalytics` narrowed)
- Modify: `lib/analytics/behaviorEngine.ts` (`getBehaviorProfile` drops the CurriculumSession/`UserSessionProgress` half)
- Modify: `lib/services/errorNotebook.ts` (`applySM2ForSession` narrowed)
- Modify: `app/api/questions/[id]/attempt/route.ts` (drop `curriculumSessionId` acceptance)
- Modify: `lib/analytics/studentLearningProfile.ts` (consume `findMostRecentlyCompletedScope`'s new return shape)
- Modify: `lib/services/practiceRecommendation.ts` (same)
- Modify: `lib/analytics/index.ts` (drop `AttemptScope` from the barrel's type export)

**Interfaces:**
- Consumes: nothing new from Task 1 — this task depends on Task 1 having already deleted every caller that passed `{ curriculumSessionId }` into these functions.
- Produces: `fetchSessionAttempts(userId: string, programCurriculumId: string): Promise<AttemptWithQuestion[]>`; `getSessionAnalytics(userId: string, programCurriculumId: string, label: number): Promise<SessionAnalyticsOutput>`; `applySM2ForSession(userId: string, programCurriculumId: string): Promise<void>`; `findMostRecentlyCompletedScope(userId: string): Promise<{ programCurriculumId: string; label: number } | null>`.

- [ ] **Step 1: Remove `AttemptScope`, narrow `fetchSessionAttempts`, drop `curriculumSessionId` from `AttemptWithQuestion`**

In `lib/analytics/repository.ts`, replace (currently):

```typescript
export interface AttemptWithQuestion {
  id: string;
  userId: string;
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
  timeSpentSec: number | null;
  attemptedAt: Date;
  curriculumSessionId: string | null;
  programCurriculumId: string | null;
  question: {
```

with:

```typescript
export interface AttemptWithQuestion {
  id: string;
  userId: string;
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
  timeSpentSec: number | null;
  attemptedAt: Date;
  programCurriculumId: string | null;
  question: {
```

Replace (currently):

```typescript
/**
 * Which spine an attempt-fetch is scoped to. CurriculumSession is the
 * original linear-curriculum spine; ProgramCurriculum is the v2 generic
 * spine (see docs/DECISION_LOG.md "Program v2 — QuestionAttempt gains
 * programCurriculumId"). Both spines run in parallel on purpose — this
 * type lets the same fetch/analytics functions serve either one without
 * duplicating the query or the pure engine logic.
 */
export type AttemptScope =
  | { curriculumSessionId: string }
  | { programCurriculumId: string };

/**
 * Fetch all attempts submitted in a specific session — either a
 * CurriculumSession (legacy spine) or a ProgramCurriculum slot (v2 spine),
 * chosen by which key is present on `scope`. Ordered by attemptedAt ASC so
 * position-in-session is preserved for section-drop analysis.
 */
export async function fetchSessionAttempts(
  userId: string,
  scope: AttemptScope
): Promise<AttemptWithQuestion[]> {
  const where =
    "curriculumSessionId" in scope
      ? { userId, curriculumSessionId: scope.curriculumSessionId }
      : { userId, programCurriculumId: scope.programCurriculumId };

  const rows = await prisma.questionAttempt.findMany({
    where,
    orderBy: { attemptedAt: "asc" },
    select: {
      id: true,
      userId: true,
      questionId: true,
      selectedOption: true,
      isCorrect: true,
      timeSpentSec: true,
      attemptedAt: true,
      curriculumSessionId: true,
      programCurriculumId: true,
      question: {
```

with:

```typescript
/**
 * Fetch all attempts submitted for a specific ProgramCurriculum slot.
 * Ordered by attemptedAt ASC so position-in-session is preserved for
 * section-drop analysis.
 *
 * Used to accept either a CurriculumSession or a ProgramCurriculum slot via
 * an AttemptScope union — CurriculumSession was retired, so this now only
 * ever serves Program (see docs/superpowers/plans/
 * 2026-07-28-retire-curriculumsession-phase1.md).
 */
export async function fetchSessionAttempts(
  userId: string,
  programCurriculumId: string
): Promise<AttemptWithQuestion[]> {
  const rows = await prisma.questionAttempt.findMany({
    where: { userId, programCurriculumId },
    orderBy: { attemptedAt: "asc" },
    select: {
      id: true,
      userId: true,
      questionId: true,
      selectedOption: true,
      isCorrect: true,
      timeSpentSec: true,
      attemptedAt: true,
      programCurriculumId: true,
      question: {
```

(The rest of the `select` block, the closing braces, and `return rows as AttemptWithQuestion[];` stay exactly as they are.)

- [ ] **Step 2: Simplify `findMostRecentlyCompletedScope`**

Replace (currently, near the end of the file):

```typescript
/**
 * Find whichever spine's most recently completed unit (CurriculumSession or
 * ProgramCurriculum slot) is truly the most recent by completedAt — used by
 * studentLearningProfile.ts and practiceRecommendation.ts to feed
 * getSessionAnalytics() for readiness/weakness-topic signals.
 *
 * Fixes a latent bug in the code this replaces: both call sites previously
 * ordered by `curriculumSession.sessionNumber desc`, not `completedAt desc`
 * — wrong whenever a session is completed out of numeric order (e.g. a
 * review/checkpoint session redone later). Ordering by completedAt is what
 * "most recently completed" should have always meant.
 *
 * Does NOT touch getCurrentMission()/mission-derived fields — those stay
 * CurriculumSession-only, deliberately (see docs/superpowers/plans/
 * 2026-07-26-repoint-behavior-and-readiness.md's Global Constraints).
 */
export interface MostRecentCompletedScope {
  scope: AttemptScope;
  label: number; // sessionNumber or Program slot order — the display label getSessionAnalytics expects
}

export async function findMostRecentlyCompletedScope(userId: string): Promise<MostRecentCompletedScope | null> {
  const [recentCurriculum, recentProgram] = await Promise.all([
    prisma.userSessionProgress.findFirst({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        curriculumSessionId: true,
        curriculumSession: { select: { sessionNumber: true } },
      },
    }),
    prisma.userProgramProgress.findFirst({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        programCurriculumId: true,
        programCurriculum: { select: { order: true } },
      },
    }),
  ]);

  const curriculumTime = recentCurriculum?.completedAt?.getTime() ?? -Infinity;
  const programTime = recentProgram?.completedAt?.getTime() ?? -Infinity;

  if (curriculumTime === -Infinity && programTime === -Infinity) return null;

  if (programTime > curriculumTime) {
    return {
      scope: { programCurriculumId: recentProgram!.programCurriculumId },
      label: recentProgram!.programCurriculum.order,
    };
  }
  return {
    scope: { curriculumSessionId: recentCurriculum!.curriculumSessionId },
    label: recentCurriculum!.curriculumSession.sessionNumber,
  };
}
```

with:

```typescript
/**
 * Find the most recently completed ProgramCurriculum slot for this user —
 * used by studentLearningProfile.ts and practiceRecommendation.ts to feed
 * getSessionAnalytics() for readiness/weakness-topic signals.
 *
 * Previously compared CurriculumSession and ProgramCurriculum completions
 * against each other (whichever was more recent); CurriculumSession was
 * retired, so this now only reads UserProgramProgress (see
 * docs/superpowers/plans/2026-07-28-retire-curriculumsession-phase1.md).
 */
export interface MostRecentCompletedScope {
  programCurriculumId: string;
  label: number; // Program slot order — the display label getSessionAnalytics expects
}

export async function findMostRecentlyCompletedScope(userId: string): Promise<MostRecentCompletedScope | null> {
  const recent = await prisma.userProgramProgress.findFirst({
    where: { userId, status: "COMPLETED", completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: {
      programCurriculumId: true,
      programCurriculum: { select: { order: true } },
    },
  });

  if (!recent) return null;

  return {
    programCurriculumId: recent.programCurriculumId,
    label: recent.programCurriculum.order,
  };
}
```

- [ ] **Step 3: Narrow `getSessionAnalytics` in `lib/analytics/service.ts`**

Replace (currently):

```typescript
/**
 * Compute full analytics for one session — CurriculumSession or
 * ProgramCurriculum slot, per `scope` (see AttemptScope in repository.ts).
 * `sessionNumber` is a caller-supplied display label (session number or
 * Program slot order) — it is not read from `scope` and does not change
 * the SessionAnalyticsOutput.sessionNumber field name, since the existing
 * frontend/`toSessionAnalyticsResponse()` contract reads it by that name.
 *
 * Fetches session attempts, runs all analytics computations, then
 * fetches notebook context only if there are weakness topics to enrich.
 * This avoids an unnecessary DB round-trip for perfect-score sessions.
 */
export async function getSessionAnalytics(
  userId: string,
  scope: AttemptScope,
  sessionNumber: number
): Promise<SessionAnalyticsOutput> {
  const attempts = await fetchSessionAttempts(userId, scope);
```

with:

```typescript
/**
 * Compute full analytics for one ProgramCurriculum slot.
 * `sessionNumber` is a caller-supplied display label (the slot's `order`)
 * — the SessionAnalyticsOutput.sessionNumber field name is unchanged since
 * the frontend/`toSessionAnalyticsResponse()` contract reads it by that name
 * (reused generic label, not renamed — same precedent documented elsewhere
 * in this codebase for this exact field).
 *
 * Fetches session attempts, runs all analytics computations, then
 * fetches notebook context only if there are weakness topics to enrich.
 * This avoids an unnecessary DB round-trip for perfect-score sessions.
 */
export async function getSessionAnalytics(
  userId: string,
  programCurriculumId: string,
  sessionNumber: number
): Promise<SessionAnalyticsOutput> {
  const attempts = await fetchSessionAttempts(userId, programCurriculumId);
```

Also update this file's import (from Task 1's Step 4 edit, already done): confirm `AttemptScope` is still imported here since `getSessionAnalytics`'s OLD signature used it — after this step, `AttemptScope` is no longer used in this file at all (it was deleted from `repository.ts` in this same task's Step 1). Remove `AttemptScope` from this file's import statement:

```typescript
import {
  fetchSessionAttempts,
  fetchNotebookContext,
  NotebookContextRow,
  AttemptScope,
} from "./repository";
```

becomes:

```typescript
import {
  fetchSessionAttempts,
  fetchNotebookContext,
  NotebookContextRow,
} from "./repository";
```

- [ ] **Step 4: Narrow `getBehaviorProfile` in `lib/analytics/behaviorEngine.ts`**

Read the current function body (it merges a `UserSessionProgress`-sourced list and a `UserProgramProgress`-sourced list, sorts by `completedAt`, takes the top 30, then fetches attempts for whichever ids ended up in that merged top-30 from BOTH `curriculumSessionId`-keyed and `programCurriculumId`-keyed `QuestionAttempt` queries). Rewrite it to only fetch from `UserProgramProgress` and only fetch attempts keyed by `programCurriculumId` — drop the `UserSessionProgress` query, the merge/sort-then-slice step (no longer needed since there's only one source), and the `curriculumSessionId`-keyed attempt query entirely. The `computeBehaviorProfile()` pure function this feeds is UNCHANGED — it takes a `SessionDataPoint[]` regardless of where the data came from.

Example shape after simplification (adapt to the exact current variable names in the file — read it first):

```typescript
export async function getBehaviorProfile(userId: string): Promise<BehaviorProfile> {
  const completedSlots = await prisma.userProgramProgress.findMany({
    where: { userId, status: "COMPLETED" },
    select: { programCurriculumId: true, startedAt: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 30,
  });

  const slotIds = completedSlots.map((s) => s.programCurriculumId);

  const [attempts, rawMoods] = await Promise.all([
    slotIds.length > 0
      ? prisma.questionAttempt.findMany({
          where: { userId, programCurriculumId: { in: slotIds } },
          select: { isCorrect: true, timeSpentSec: true, attemptedAt: true, programCurriculumId: true },
        })
      : Promise.resolve([]),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 14,
    }),
  ]);

  const attemptsByContext = new Map<
    string,
    { isCorrect: boolean; timeSpentSec: number | null; attemptedAt: Date }[]
  >();
  for (const a of attempts) {
    if (a.programCurriculumId == null) continue;
    const existing = attemptsByContext.get(a.programCurriculumId) ?? [];
    existing.push(a);
    attemptsByContext.set(a.programCurriculumId, existing);
  }

  const sessions: SessionDataPoint[] = completedSlots.map((s) => ({
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    attempts: (attemptsByContext.get(s.programCurriculumId) ?? []).map((a) => ({
      isCorrect: a.isCorrect,
      timeSpentSec: a.timeSpentSec,
      attemptedAt: a.attemptedAt,
    })),
  }));

  const moodEntries: MoodDataPoint[] = rawMoods.map((m) => ({
    mood: m.mood as MoodDataPoint["mood"],
    createdAt: m.createdAt,
  }));

  return computeBehaviorProfile(sessions, moodEntries);
}
```

- [ ] **Step 5: Narrow `applySM2ForSession` in `lib/services/errorNotebook.ts`**

Replace the function signature and its attempt-fetch (currently):

```typescript
export async function applySM2ForSession(
  userId: string,
  scope: AttemptScope,
): Promise<void> {
  // 1. Fetch attempts for this scope (CurriculumSession or ProgramCurriculum
  // slot) with question topic — reuses the same repository function
  // getSessionAnalytics() already uses, rather than a third copy of the
  // scope-branching where-clause.
  const attempts = await fetchSessionAttempts(userId, scope);

  if (attempts.length === 0) return;
```

with:

```typescript
export async function applySM2ForSession(
  userId: string,
  programCurriculumId: string,
): Promise<void> {
  // Fetch attempts for this ProgramCurriculum slot with question topic —
  // reuses the same repository function getSessionAnalytics() already uses.
  const attempts = await fetchSessionAttempts(userId, programCurriculumId);

  if (attempts.length === 0) return;
```

Update this file's import of `AttemptScope` (it currently imports `import type { AttemptScope } from "@/lib/analytics";` alongside `fetchSessionAttempts` — remove the `AttemptScope` type import entirely, keep the `fetchSessionAttempts` value import).

Update the function's doc comment (currently describes it as serving "a CurriculumSession OR ProgramCurriculum slot") to describe it as ProgramCurriculum-only, noting the CurriculumSession path was retired.

- [ ] **Step 6: Update `applySM2ForSession`'s one remaining caller**

In `app/api/program/slots/[programCurriculumId]/complete/route.ts`, change (currently):

```typescript
      await applySM2ForSession(user.id, { programCurriculumId });
```

to:

```typescript
      await applySM2ForSession(user.id, programCurriculumId);
```

- [ ] **Step 7: Update the attempt route**

In `app/api/questions/[id]/attempt/route.ts`, remove all `curriculumSessionId`/`sessionId` handling. Replace (currently):

```typescript
  const { response, timeSpentSec, curriculumSessionId, programCurriculumId } = body as Record<string, unknown>;
```

with:

```typescript
  const { response, timeSpentSec, programCurriculumId } = body as Record<string, unknown>;
```

Replace:

```typescript
  const sessionId = typeof curriculumSessionId === "string" ? curriculumSessionId : null;
  const programSlotId = typeof programCurriculumId === "string" ? programCurriculumId : null;
```

with:

```typescript
  const programSlotId = typeof programCurriculumId === "string" ? programCurriculumId : null;
```

Replace both occurrences of `curriculumSessionId: sessionId,` (one in the duplicate-check `where`, one in the `create` data) — remove that line entirely from both the `tx.questionAttempt.findFirst({ where: {...} })` block and the `tx.questionAttempt.create({ data: {...} })` block, leaving `programCurriculumId: programSlotId,` as the only session-context field written in each.

(Note: `QuestionAttempt.curriculumSessionId` remains a valid, nullable column in the schema until Phase 2 — this change just stops the route from ever writing to it, it does not require a migration.)

- [ ] **Step 8: Update `findMostRecentlyCompletedScope`'s 2 callers**

In `lib/analytics/studentLearningProfile.ts`, change (currently, inside `getStudentLearningProfile`):

```typescript
      const analytics = await getSessionAnalytics(userId, recentCompleted.scope, recentCompleted.label);
```

to:

```typescript
      const analytics = await getSessionAnalytics(userId, recentCompleted.programCurriculumId, recentCompleted.label);
```

In `lib/services/practiceRecommendation.ts`, change the identical line (inside `getAdaptiveRecommendations`) the same way.

- [ ] **Step 9: Remove `AttemptScope` from the barrel**

In `lib/analytics/index.ts`, change (currently, after Task 1's edits):

```typescript
export type {
  AttemptWithQuestion,
  NotebookContextRow,
  AttemptScope,
} from "./repository";
```

to:

```typescript
export type {
  AttemptWithQuestion,
  NotebookContextRow,
} from "./repository";
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in the 4 fixture test scripts still referencing the old `AttemptScope`-based call shapes (`test-analytics-scope.mjs`, `test-behavior-engine-scope.mjs`, `test-recent-completed-scope.mjs`, `test-sm2-program-scope.mjs`) — these are fixed in Task 5. No error should appear in any `.ts`/`.tsx` file under `app/` or `lib/`.

- [ ] **Step 11: Commit**

```bash
git add lib/analytics/repository.ts lib/analytics/service.ts lib/analytics/behaviorEngine.ts lib/analytics/index.ts lib/services/errorNotebook.ts "app/api/questions/[id]/attempt/route.ts" "app/api/program/slots/[programCurriculumId]/complete/route.ts" lib/analytics/studentLearningProfile.ts lib/services/practiceRecommendation.ts
git commit -m "refactor(analytics): narrow shared session functions to ProgramCurriculum only"
```

---

### Task 3: Relocate and simplify `PracticeQuiz.tsx`

**Files:**
- Create: `app/(app)/program/[slug]/[order]/PracticeQuiz.tsx` (relocated, simplified)
- Delete: `app/(app)/practice/[sessionNumber]/PracticeQuiz.tsx`
- Modify: `app/(app)/program/[slug]/[order]/page.tsx` (import path update)

**Interfaces:**
- Produces: `PracticeQuiz({ programCurriculumId, questions, completionHref })` — drops `sessionNumber`, `sessionType`, `curriculumSessionId` props entirely.

- [ ] **Step 1: Create the relocated, simplified component**

Read the current `app/(app)/practice/[sessionNumber]/PracticeQuiz.tsx` in full, then write it to the new path `app/(app)/program/[slug]/[order]/PracticeQuiz.tsx` with these changes:

Replace the props interface (currently):

```typescript
export function PracticeQuiz({
  sessionNumber,
  sessionType,
  curriculumSessionId,
  programCurriculumId,
  questions,
  completionHref,
}: {
  sessionNumber?: number;
  sessionType?: string;
  curriculumSessionId?: string;
  // Program lesson slot id (v2 spine) — mirrors curriculumSessionId above.
  // Passed by /program/[slug]/[order]; absent everywhere else.
  programCurriculumId?: string;
  questions: QuizQuestion[];
  completionHref?: string;
}) {
```

with:

```typescript
export function PracticeQuiz({
  programCurriculumId,
  questions,
  completionHref,
}: {
  programCurriculumId: string;
  questions: QuizQuestion[];
  completionHref?: string;
}) {
```

Replace the mount-effect (currently):

```typescript
  useEffect(() => {
    if (sessionNumber !== undefined) {
      fetch(`/api/curriculum/sessions/${sessionNumber}/start`, { method: "POST" }).catch(() => {});
    } else if (programCurriculumId) {
      fetch(`/api/program/slots/${programCurriculumId}/start`, { method: "POST" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

with:

```typescript
  useEffect(() => {
    fetch(`/api/program/slots/${programCurriculumId}/start`, { method: "POST" }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Replace `handleAnswer`'s body-building (currently):

```typescript
    const body: Record<string, unknown> = { response, timeSpentSec };
    if (curriculumSessionId) body.curriculumSessionId = curriculumSessionId;
    if (programCurriculumId) body.programCurriculumId = programCurriculumId;
```

with:

```typescript
    const body: Record<string, unknown> = { response, timeSpentSec, programCurriculumId };
```

Replace `handleNext`'s completion branch (currently):

```typescript
    } else if (sessionNumber !== undefined) {
      await fetch(`/api/curriculum/sessions/${sessionNumber}/complete`, { method: "POST" });
      router.push(`/practice/${sessionNumber}/results`);
    } else if (programCurriculumId) {
      await fetch(`/api/program/slots/${programCurriculumId}/complete`, { method: "POST" });
      router.push(completionHref ?? "/dashboard");
    } else {
      router.push(completionHref ?? "/dashboard");
    }
```

with:

```typescript
    } else {
      await fetch(`/api/program/slots/${programCurriculumId}/complete`, { method: "POST" });
      router.push(completionHref ?? "/dashboard");
    }
```

Replace the one remaining `sessionNumber !== undefined` reference inside the button label (currently):

```typescript
                {index + 1 < questions.length
                  ? "Câu tiếp theo"
                  : sessionNumber !== undefined
                    ? "Xem kết quả buổi học"
                    : "Hoàn thành luyện tập"}
```

with:

```typescript
                {index + 1 < questions.length ? "Câu tiếp theo" : "Hoàn thành luyện tập"}
```

Replace the mid-exam `sessionType === "MOCK_EXAM"` check (currently, inside `handleNext`'s index-advance branch):

```typescript
      if (nextIndex === 20 && sessionType === "MOCK_EXAM") {
        setMidExamPrompt(true);
      }
```

Since `sessionType` no longer exists as a prop and no current Program caller passes it (a pre-existing gap this plan does not fix, per the design doc), delete this `if` block entirely — the mid-exam breathing ritual becomes unreachable via this component going forward, which is the honest reflection of the prop being removed, not a functional regression (it was already never reachable from `/program/[slug]/[order]`, which never passed `sessionType`).

Everything else in the file (the `AnswerInput` rendering, feedback display, error-notebook link, `LensFloatingAssistant`, etc.) is unchanged — copy it verbatim into the new file.

- [ ] **Step 2: Delete the old file**

```bash
rm "app/(app)/practice/[sessionNumber]/PracticeQuiz.tsx"
```

- [ ] **Step 3: Update the import in `app/(app)/program/[slug]/[order]/page.tsx`**

Change (currently):

```typescript
import { PracticeQuiz } from "../../../practice/[sessionNumber]/PracticeQuiz";
```

to:

```typescript
import { PracticeQuiz } from "./PracticeQuiz";
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in the 4 fixture test scripts (unchanged from Task 2's end state — Task 5 fixes those). No new errors from this task.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/program/[slug]/[order]/PracticeQuiz.tsx" "app/(app)/program/[slug]/[order]/page.tsx"
git rm "app/(app)/practice/[sessionNumber]/PracticeQuiz.tsx"
git commit -m "refactor(program): relocate PracticeQuiz, drop CurriculumSession props"
```

---

### Task 4: Replace `getPhaseProgress()` with `getProgramProgressSummary()`

**Files:**
- Delete: `lib/services/curriculum.ts` (its only 2 exports, `getPracticeQuestions` and `getPhaseProgress`, are both being retired — confirmed no other export exists in this file)
- Create: new function `getProgramProgressSummary` — add it to `lib/services/program/nextMission.ts` (same file that already has the "resolve the one Program via `findFirst`" pattern this reuses) rather than creating a new file for one function
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/(app)/progress/page.tsx`

**Interfaces:**
- Produces: `getProgramProgressSummary(userId: string): Promise<{ completedSlots: number; totalSlots: number }>`

- [ ] **Step 1: Add `getProgramProgressSummary` to `lib/services/program/nextMission.ts`**

Append to the end of the file:

```typescript
/**
 * Completed/total slot count for the one Program — replaces
 * curriculum.ts's retired getPhaseProgress(), which counted completed/total
 * CurriculumSessions grouped by CurriculumPhase. ProgramCurriculum has no
 * phase/grouping concept (see docs/superpowers/plans/
 * 2026-07-28-retire-curriculumsession-phase1.md), so this is a flat count,
 * not a rebuilt phase breakdown.
 */
export interface ProgramProgressSummary {
  completedSlots: number;
  totalSlots: number;
}

export async function getProgramProgressSummary(userId: string): Promise<ProgramProgressSummary> {
  const program = await prisma.program.findFirst({ select: { id: true } });
  if (!program) return { completedSlots: 0, totalSlots: 0 };

  const [totalSlots, completedSlots] = await Promise.all([
    prisma.programCurriculum.count({ where: { programId: program.id } }),
    prisma.userProgramProgress.count({
      where: { userId, status: "COMPLETED", programCurriculum: { programId: program.id } },
    }),
  ]);

  return { completedSlots, totalSlots };
}
```

- [ ] **Step 2: Delete `lib/services/curriculum.ts` entirely**

This file's only two exports are `getPracticeQuestions` (its only caller was the now-deleted `app/(app)/practice/[sessionNumber]/page.tsx` from Task 1) and `getPhaseProgress` (updated to `getProgramProgressSummary` in Steps 3-4 below). Nothing else in the file is exported or used elsewhere. Delete the whole file:

```bash
rm lib/services/curriculum.ts
```

- [ ] **Step 3: Update `app/(app)/dashboard/page.tsx`**

Change the import (currently):

```typescript
import { getPhaseProgress } from "@/lib/services/curriculum";
```

to:

```typescript
import { getProgramProgressSummary } from "@/lib/services/program/nextMission";
```

Change the `Promise.all` entry (currently):

```typescript
      getPhaseProgress(user.id),
```

to:

```typescript
      getProgramProgressSummary(user.id),
```

(The destructured variable name `phaseProgress` in `const [profile, phaseProgress, dueReviewCount, ...]` can stay as-is — renaming it is optional; simplest is to leave the name and just change what it holds, since TypeScript infers the new shape automatically.)

Change the "Buổi X/24" line (currently):

```typescript
          <span className="text-xs text-zinc-400">
            Buổi {phaseProgress.completedSessions}/{phaseProgress.totalSessions || 24}
          </span>
```

to:

```typescript
          <span className="text-xs text-zinc-400">
            Bài {phaseProgress.completedSlots}/{phaseProgress.totalSlots}
          </span>
```

(No `|| 24` fallback — `totalSlots` is a real count from the DB, not a value that needs a hardcoded default; if it's ever legitimately 0, showing "Bài 0/0" is honest, not a bug to paper over.)

- [ ] **Step 4: Update `app/(app)/progress/page.tsx`**

Change the import (currently):

```typescript
import { getPhaseProgress } from "@/lib/services/curriculum";
```

to:

```typescript
import { getProgramProgressSummary } from "@/lib/services/program/nextMission";
```

Change the `Promise.all` entry (currently):

```typescript
    getPhaseProgress(user.id),
```

to:

```typescript
    getProgramProgressSummary(user.id),
```

Replace the entire "Lộ trình học" section (currently):

```typescript
      <section className="rounded-3xl border border-zinc-100 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Lộ trình học
        </h2>
        <div className="flex flex-col gap-4">
          {phaseProgress.phases.map((phase) => (
            <div key={phase.id}>
              <div className="mb-1 flex justify-between text-sm text-zinc-700">
                <span>{phase.name}</span>
                <span className="text-xs text-zinc-400">
                  Buổi {phase.startSession}–{phase.endSession}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{phase.goal}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          Đã hoàn thành <span className="font-semibold text-lexi-primary-dark">{phaseProgress.completedSessions}</span>{" "}
          / {phaseProgress.totalSessions || 24} buổi học
        </p>
      </section>
```

with:

```typescript
      <section className="rounded-3xl border border-zinc-100 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Lộ trình học
        </h2>
        <p className="text-sm text-zinc-600">
          Đã hoàn thành <span className="font-semibold text-lexi-primary-dark">{phaseProgress.completedSlots}</span>{" "}
          / {phaseProgress.totalSlots} bài học
        </p>
      </section>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in the 4 fixture test scripts (Task 5 fixes those). No error from `curriculum.ts`, `nextMission.ts`, `dashboard/page.tsx`, or `progress/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git rm lib/services/curriculum.ts
git add lib/services/program/nextMission.ts "app/(app)/dashboard/page.tsx" "app/(app)/progress/page.tsx"
git commit -m "feat(program): replace getPhaseProgress with a flat Program completion count"
```

---

### Task 5: Comment cleanups + update the 4 fixture scripts

**Files:**
- Modify: `lib/services/learner-intelligence/types.ts` (comment only)
- Modify: `lib/services/program/seedDemoProgram.ts` (local type rename only, cosmetic)
- Modify: `scripts/test-analytics-scope.mjs`
- Modify: `scripts/test-behavior-engine-scope.mjs`
- Modify: `scripts/test-recent-completed-scope.mjs`
- Modify: `scripts/test-sm2-program-scope.mjs`

**Interfaces:**
- Consumes: `fetchSessionAttempts(userId, programCurriculumId)`, `getSessionAnalytics(userId, programCurriculumId, label)`, `applySM2ForSession(userId, programCurriculumId)`, `findMostRecentlyCompletedScope(userId): Promise<{ programCurriculumId, label } | null>`, `getBehaviorProfile(userId)` — all from Task 2.

- [ ] **Step 1: Comment-only fix in `lib/services/learner-intelligence/types.ts`**

Change (currently, in the doc comment above `CompletionBehaviorObservation`):

```typescript
 * Note: abandonment rate (started-but-incomplete ÷ total started) requires
 * fetching UserSessionProgress with status IN_PROGRESS. Deferred to a future
 * milestone that extends BehaviorStateInput with that data.
```

to:

```typescript
 * Note: abandonment rate (started-but-incomplete ÷ total started) requires
 * fetching UserProgramProgress with status IN_PROGRESS. Deferred to a future
 * milestone that extends BehaviorStateInput with that data.
```

- [ ] **Step 2: Cosmetic rename in `lib/services/program/seedDemoProgram.ts`**

Rename the local interfaces (currently):

```typescript
interface CurriculumSessionSeed {
  sessionNumber: number;
  title: string;
  objective: string;
  grammarTopics: string[];
  sessionType: string;
}

interface CurriculumSeedFile {
  sessions: CurriculumSessionSeed[];
}
```

to:

```typescript
interface ProgramSeedSessionSource {
  sessionNumber: number;
  title: string;
  objective: string;
  grammarTopics: string[];
  sessionType: string;
}

interface CurriculumSeedFile {
  sessions: ProgramSeedSessionSource[];
}
```

(Only the `CurriculumSessionSeed` name changes — `CurriculumSeedFile` stays, since it accurately names the JSON file's own shape, `prisma/seed-data/curriculum.json`, which is not being renamed in this phase.) Update the one usage site in this same file, `data: CurriculumSeedFile`'s cast (`as CurriculumSeedFile`), to keep compiling — it already references `CurriculumSeedFile`, unaffected. Just confirm no other reference to `CurriculumSessionSeed` remains via `grep -n "CurriculumSessionSeed" lib/services/program/seedDemoProgram.ts` (expect zero matches after this edit).

- [ ] **Step 3: Update `scripts/test-analytics-scope.mjs`**

This script currently tests both scopes. Rewrite it to test Program only. Replace the whole file with:

```javascript
/**
 * test-analytics-scope.mjs
 *
 * Live check (real dev.db, no mocks) that fetchSessionAttempts() and
 * getSessionAnalytics() correctly return only the attempts tagged with a
 * given ProgramCurriculum slot.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-analytics-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { fetchSessionAttempts } from "../lib/analytics/repository.ts";
import { getSessionAnalytics } from "../lib/analytics/service.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `scope-test-${stamp}@lexi.local`, name: "Scope Test" },
  });
  const question = await prisma.question.create({
    data: {
      questionCode: `SCOPE_TEST_${stamp}`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      topic: "scope_test_topic",
      promptText: "Fixture question — not real content.",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctOption: "A",
      explanationVi: "n/a",
      source: "scope-test-fixture",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `scope-test-${stamp}`, title: "Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Scope Test Slot" },
  });
  const otherSlot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 2, title: "Other Scope Test Slot" },
  });

  const slotAttempt = await prisma.questionAttempt.create({
    data: {
      userId: user.id,
      questionId: question.id,
      selectedOption: "A",
      isCorrect: true,
      programCurriculumId: slot.id,
    },
  });
  await prisma.questionAttempt.create({
    data: {
      userId: user.id,
      questionId: question.id,
      selectedOption: "A",
      isCorrect: true,
      programCurriculumId: otherSlot.id,
    },
  });

  try {
    const byProgramScope = await fetchSessionAttempts(user.id, slot.id);
    assert(
      "returns exactly the slot-scoped attempt, not the other slot's",
      byProgramScope.length === 1 && byProgramScope[0].id === slotAttempt.id
    );

    const programAnalytics = await getSessionAnalytics(user.id, slot.id, slot.order);
    assert(
      "getSessionAnalytics echoes the caller-supplied label as sessionNumber",
      programAnalytics.sessionNumber === slot.order
    );
    assert(
      "getSessionAnalytics produces a readiness result",
      programAnalytics.readiness != null
    );
  } finally {
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.deleteMany({ where: { programId: program.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 4: Update `scripts/test-behavior-engine-scope.mjs`**

Rewrite to test only the Program path. Replace the whole file with:

```javascript
/**
 * test-behavior-engine-scope.mjs
 *
 * Live check (real dev.db, no mocks) that getBehaviorProfile() correctly
 * finds QuestionAttempt rows for a completed ProgramCurriculum slot.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-behavior-engine-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { getBehaviorProfile } from "../lib/analytics/behaviorEngine.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `behavior-scope-test-${stamp}@lexi.local`, name: "Behavior Scope Test" },
  });
  const question = await prisma.question.create({
    data: {
      questionCode: `BEHAVIOR_SCOPE_TEST_${stamp}`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      topic: "behavior_scope_test_topic",
      promptText: "Fixture question — not real content.",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctOption: "A",
      explanationVi: "n/a",
      source: "behavior-scope-test-fixture",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `behavior-scope-test-${stamp}`, title: "Behavior Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Behavior Scope Test Slot" },
  });

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  await prisma.userProgramProgress.create({
    data: {
      userId: user.id,
      programCurriculumId: slot.id,
      status: "COMPLETED",
      startedAt: tenMinAgo,
      completedAt: now,
    },
  });

  // 3 attempts (derivePaceProfile needs >= 3 attempts to count a session)
  for (let i = 0; i < 3; i++) {
    await prisma.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption: "A",
        isCorrect: i !== 1,
        timeSpentSec: 15,
        programCurriculumId: slot.id,
      },
    });
  }

  try {
    const profile = await getBehaviorProfile(user.id);
    assert("sessionCount counts the completed ProgramCurriculum slot", profile.sessionCount === 1);
    assert(
      "avgSessionDurationMin is computed from the startedAt/completedAt pair",
      profile.avgSessionDurationMin !== null && profile.avgSessionDurationMin > 0
    );
    assert(
      "responseTimeSignal is MODERATE (proves attempts reached the engine)",
      profile.responseTimeSignal === "MODERATE"
    );
  } finally {
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.delete({ where: { id: slot.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 5: Update `scripts/test-recent-completed-scope.mjs`**

Rewrite to test the simplified single-spine `findMostRecentlyCompletedScope`. Replace the whole file with:

```javascript
/**
 * test-recent-completed-scope.mjs
 *
 * Live check (real dev.db, no mocks) that findMostRecentlyCompletedScope()
 * picks the most recently completed ProgramCurriculum slot, correctly
 * preferring a later completedAt over an earlier one across 2 slots.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-recent-completed-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { findMostRecentlyCompletedScope } from "../lib/analytics/repository.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `recent-scope-test-${stamp}@lexi.local`, name: "Recent Scope Test" },
  });
  const program = await prisma.program.create({
    data: { slug: `recent-scope-test-${stamp}`, title: "Recent Scope Test Program" },
  });
  const earlierSlot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 3, title: "Earlier Slot" },
  });
  const laterSlot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 7, title: "Later Slot" },
  });

  const earlier = new Date(Date.now() - 60 * 60 * 1000);
  const later = new Date();

  try {
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: earlierSlot.id, status: "COMPLETED", completedAt: earlier },
    });
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: laterSlot.id, status: "COMPLETED", completedAt: later },
    });

    const result = await findMostRecentlyCompletedScope(user.id);
    assert(
      "picks the later-completed slot",
      result !== null && result.programCurriculumId === laterSlot.id
    );
    assert("label is the slot's order", result?.label === 7);
  } finally {
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.deleteMany({ where: { programId: program.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 6: Update `scripts/test-sm2-program-scope.mjs`**

Rewrite to test only the Program path (the CurriculumSession "regression" case no longer applies — there is no CurriculumSession path left to regress). Replace the whole file with:

```javascript
/**
 * test-sm2-program-scope.mjs
 *
 * Live check (real dev.db, no mocks) that applySM2ForSession() correctly
 * applies an SM-2 update for a ProgramCurriculum-scoped call.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-sm2-program-scope.mjs
 */
import { PrismaClient } from "@prisma/client";
import { applySM2ForSession } from "../lib/services/errorNotebook.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `sm2-scope-test-${stamp}@lexi.local`, name: "SM2 Scope Test" },
  });
  const question = await prisma.question.create({
    data: {
      questionCode: `SM2_SCOPE_TEST_${stamp}`,
      type: "GRAMMAR_MCQ",
      skill: "VOCAB_GRAMMAR",
      topic: "sm2_scope_test_topic",
      promptText: "Fixture question — not real content.",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctOption: "A",
      explanationVi: "n/a",
      source: "sm2-scope-test-fixture",
    },
  });
  const program = await prisma.program.create({
    data: { slug: `sm2-scope-test-${stamp}`, title: "SM2 Scope Test Program" },
  });
  const slot = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "SM2 Scope Test Slot" },
  });

  const reviewedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const entry = await prisma.errorNotebookEntry.create({
    data: {
      userId: user.id,
      studentAnswer: "B",
      correctAnswer: "A",
      reason: "fixture",
      concept: "sm2_scope_test_topic",
      status: "OPEN",
      reviewStage: 0,
      easeFactor: 2.5,
      lastReviewedAt: reviewedAt,
    },
  });

  try {
    await prisma.questionAttempt.create({
      data: {
        userId: user.id,
        questionId: question.id,
        selectedOption: "A",
        isCorrect: true,
        programCurriculumId: slot.id,
      },
    });
    await applySM2ForSession(user.id, slot.id);

    const after = await prisma.errorNotebookEntry.findUniqueOrThrow({ where: { id: entry.id } });
    assert("advances reviewStage", after.reviewStage === 1);
    assert("sets nextReviewAt", after.nextReviewAt !== null);
  } finally {
    await prisma.errorNotebookEntry.delete({ where: { id: entry.id } });
    await prisma.questionAttempt.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.delete({ where: { id: slot.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 7: Type-check and run all 4 updated scripts**

Run: `npx tsc --noEmit`
Expected: 0 errors project-wide.

Run: `npm run test:analytics-scope`, `npm run test:behavior-engine-scope`, `npm run test:recent-completed-scope`, `npm run test:sm2-program-scope`
Expected: every assertion in all 4 scripts PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/services/learner-intelligence/types.ts lib/services/program/seedDemoProgram.ts scripts/test-analytics-scope.mjs scripts/test-behavior-engine-scope.mjs scripts/test-recent-completed-scope.mjs scripts/test-sm2-program-scope.mjs
git commit -m "test(program): simplify 4 fixture scripts to Program-only scope"
```

---

### Task 6: Full verification, live browser check, final commit

**Files:** none modified — verification only, plus a small fixture script for `getProgramProgressSummary`.

- [ ] **Step 1: Write and run a fixture script for `getProgramProgressSummary`**

Create `scripts/test-program-progress-summary.mjs`:

```javascript
/**
 * test-program-progress-summary.mjs
 *
 * Live check (real dev.db, no mocks) that getProgramProgressSummary()
 * correctly counts completed vs total ProgramCurriculum slots for a user.
 *
 * Creates and tears down its own fixtures in `finally`, matching
 * test-ku1-partb-review.mjs's convention.
 *
 * Run: node --import tsx scripts/test-program-progress-summary.mjs
 */
import { PrismaClient } from "@prisma/client";
import { getProgramProgressSummary } from "../lib/services/program/nextMission.ts";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `progress-summary-test-${stamp}@lexi.local`, name: "Progress Summary Test" },
  });
  const program = await prisma.program.create({
    data: { slug: `progress-summary-test-${stamp}`, title: "Progress Summary Test Program" },
  });
  const slot1 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 1, title: "Slot One" },
  });
  const slot2 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 2, title: "Slot Two" },
  });
  const slot3 = await prisma.programCurriculum.create({
    data: { programId: program.id, order: 3, title: "Slot Three" },
  });

  try {
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot1.id, status: "COMPLETED", completedAt: new Date() },
    });
    await prisma.userProgramProgress.create({
      data: { userId: user.id, programCurriculumId: slot2.id, status: "IN_PROGRESS" },
    });
    // slot3 has no progress row at all — not started.

    const summary = await getProgramProgressSummary(user.id);
    assert("totalSlots counts every slot for the Program, regardless of status", summary.totalSlots >= 3);
    assert("completedSlots counts only COMPLETED rows for this user", summary.completedSlots === 1);
  } finally {
    await prisma.userProgramProgress.deleteMany({ where: { userId: user.id } });
    await prisma.programCurriculum.deleteMany({ where: { programId: program.id } });
    await prisma.program.delete({ where: { id: program.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

(Note: `totalSlots` asserts `>= 3` rather than `=== 3` because `getProgramProgressSummary` counts ALL `ProgramCurriculum` rows for "the one Program" — including the real seeded demo Program's 71 slots if `prisma.program.findFirst()` happens to resolve to that one instead of this fixture's. This mirrors the same "resolve whichever Program exists first" behavior `getNextMission()` already has and is tested the same way there — do not over-fit this assertion to assume isolation `findFirst()` doesn't actually give you.)

Run: `node --import tsx scripts/test-program-progress-summary.mjs`
Expected: both assertions PASS.

Add to `package.json`:

```json
    "test:program-progress-summary": "node --import tsx scripts/test-program-progress-summary.mjs",
```

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors project-wide.

- [ ] **Step 3: Full test suite**

Run: `npm run test:all`
Expected: every suite green.

- [ ] **Step 4: Live browser check**

Log in as the seeded student (`student@lexi.local` / `lexi1234`):
- Visit `/practice/1` — confirm it 404s (route deleted).
- Visit `/api/analytics/compare/1/2` — confirm it 404s.
- Visit `/dashboard` — confirm it renders with no console/network errors, shows "Bài X/71" (or whatever the real total is) instead of "Buổi X/24".
- Visit `/progress` — confirm it renders with no phase breakdown, just a single completed/total line.
- Visit `/program/[slug]/[order]` for a real slot, answer all its questions through to completion — confirm the quiz behaves exactly as before (this exercises the relocated `PracticeQuiz.tsx`), and confirm the completion redirect and dashboard mission card afterward still work.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-program-progress-summary.mjs package.json
git commit -m "test(program): add fixture coverage for getProgramProgressSummary"
```

---

## What this plan deliberately does NOT do

- Does not touch the Prisma schema or delete any `CurriculumSession`/`CurriculumPhase`/`UserSessionProgress` data — that is Phase 2, separate work.
- Does not build a Program-equivalent session-comparison feature, or a Program-equivalent "phase" grouping concept.
- Does not fix the pre-existing gap where `/program/[slug]/[order]/page.tsx` never passes `sessionType` to `PracticeQuiz` (so the mid-exam breathing ritual has never been reachable for a Program `MOCK_EXAM`-typed slot) — unrelated to this retirement, not introduced or worsened by it.
- Does not address `lib/analytics/difficultyCalibration.ts` becoming orphaned by this plan (its only caller, `lib/services/curriculum.ts`, was deleted in Task 4) — the M2.3 adaptive-difficulty feature has no remaining caller after this plan and does not currently run for any route. Re-pointing it at Program's KU-derived question pool is deferred to Phase 2.
