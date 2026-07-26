# Final review fix round — 2026-07-26

Fixes findings from the whole-branch code review that ran after the 2-task
plan (`behaviorEngine.ts` FK repoint + shared `findMostRecentlyCompletedScope()`)
landed. Three issues, all addressed in this round.

## Fix 1 (Important) — `test-behavior-engine-scope.mjs` didn't actually test the FK fix

**Problem:** The script's stated purpose is to prove `getBehaviorProfile()`
correctly reads `QuestionAttempt` rows via `curriculumSessionId` /
`programCurriculumId` (fixing the old bug where it filtered by
`UserSessionProgress.id` and silently got zero attempts). But its two
assertions (`sessionCount === 2` and `avgSessionDurationMin` truthy) are both
derivable purely from `UserSessionProgress` / `UserProgramProgress`
`startedAt`/`completedAt` timestamps — neither one actually reads anything
computed from `QuestionAttempt` rows. If the FK bug regressed, both
assertions would still pass.

**Fix:** Added a third assertion right after the existing two, asserting
`profile.responseTimeSignal === "MODERATE"`. `responseTimeSignal` is derived
by `deriveResponseTimeSignal()` from `QuestionAttempt.timeSpentSec` values
across both spines — it needs 5+ non-null values to return non-null at all,
and returns `null` if `attemptsByContext` comes back empty (i.e., exactly
the failure mode the FK bug produces). The fixture's 6 attempts (3 per
spine, `timeSpentSec: 15` each) give a median of 15s, which falls in the
`MODERATE` band `[10s, 30s)`.

**File:** `scripts/test-behavior-engine-scope.mjs`

**Verified:** `node --import tsx scripts/test-behavior-engine-scope.mjs` → 3/3 pass.

## Fix 2 (Minor) — explicit null-`completedAt` filtering in `findMostRecentlyCompletedScope()`

**Problem:** The two Prisma queries didn't filter out `COMPLETED` rows with
a null `completedAt`; the code instead relied on `?? -1` to rank such rows
last. A `COMPLETED` row with no `completedAt` isn't a real "most recently
completed" candidate — it can't be ranked by recency it doesn't have — so
relying on a sentinel value to paper over that was implicit rather than
intentional.

**Fix:** Added `completedAt: { not: null }` to both `where` clauses
(`userSessionProgress.findFirst` and `userProgramProgress.findFirst`). No
other change to either `select` block — the `userProgramProgress` select
still returns only `completedAt`, `programCurriculumId`, and
`programCurriculum: { select: { order: true } }`, matching what the
downstream code (`recentProgram!.programCurriculumId`,
`recentProgram!.programCurriculum.order`) actually uses.

**File:** `lib/analytics/repository.ts`, `findMostRecentlyCompletedScope()`

## Fix 3 (Minor) — replace `-1` sentinel with `-Infinity`

**Problem:** With Fix 2 applied, every row returned from either query is
guaranteed to have a non-null `completedAt`, so `-1` now only means "no row
came back." But `-1` is itself a reachable `getTime()` value (a date near
the Unix epoch, Dec 31 1969) — a theoretical pre-1970 `completedAt` could
collide with the "no row" sentinel and cause the `!` non-null assertions
further down (`recentProgram!...`, `recentCurriculum!...`) to dereference
`null`.

**Fix:** Replaced both `?? -1` fallbacks with `?? -Infinity`, and updated
the null-check from `curriculumTime < 0 && programTime < 0` to
`curriculumTime === -Infinity && programTime === -Infinity`. The
`programTime > curriculumTime` comparison and the return block below it are
unchanged — `-Infinity` composes correctly with `>` comparisons the same
way `-1` did, just without a reachable collision value.

**File:** `lib/analytics/repository.ts`, `findMostRecentlyCompletedScope()`

## Verification

All four verification commands from the fix-round instructions were run
after all three fixes landed, in this order:

1. `node --import tsx scripts/test-behavior-engine-scope.mjs`
   → `3 passed, 0 failed` (sessionCount, avgSessionDurationMin,
   responseTimeSignal all pass).

2. `node --import tsx scripts/test-recent-completed-scope.mjs`
   → `3 passed, 0 failed` (all pre-existing assertions still pass — its
   fixtures always set a real `completedAt`, so the new
   `completedAt: { not: null }` filter excludes nothing it relies on).

3. `npx tsc --noEmit`
   → 0 errors.

4. `npm run test:all`
   → `39 passed, 0 failed, 39 total` (all suites green, including
   `test:behavior-engine-scope` and `test:recent-completed-scope`).

## Files changed

- `scripts/test-behavior-engine-scope.mjs` — added `responseTimeSignal`
  assertion (Fix 1).
- `lib/analytics/repository.ts` — `findMostRecentlyCompletedScope()`:
  added `completedAt: { not: null }` to both `where` clauses (Fix 2);
  replaced `-1` sentinel with `-Infinity` (Fix 3).
