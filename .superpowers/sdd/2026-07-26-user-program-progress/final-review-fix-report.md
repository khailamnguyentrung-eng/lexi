# Final review — fix round report

Date: 2026-07-26
Branch: feat/program-curriculum

Fixes applied in response to the final whole-branch code review of the
`UserProgramProgress` / Program start-complete / CurriculumSession start-route
fix plan (`docs/superpowers/plans/2026-07-26-user-program-progress.md`).

## Fix 1 (Important) — start routes silently un-completed finished sessions/slots

**Bug:** In both start route handlers, the early-return above the `upsert`
(`if (existing?.startedAt) return ...`) only skips the `upsert` when
`startedAt` is already set. A row can have `status: "COMPLETED"` with
`startedAt: null` for a legitimate reason — the `complete` route can create
such a row directly, without `start` ever having been called first. All 4
pre-existing `UserSessionProgress` rows in `dev.db` were exactly this shape
(`COMPLETED`, `startedAt: null`), because `start` had zero callers until this
session's Task 3 wired it into `PracticeQuiz.tsx`. Revisiting one of those
sessions after the wiring landed fell into the `upsert`'s `update` branch,
which unconditionally set `status: "IN_PROGRESS"` — silently un-completing an
already-finished session.

**Fix:** Removed `status: "IN_PROGRESS"` from the `update` object in both:
- `app/api/curriculum/sessions/[sessionNumber]/start/route.ts`
- `app/api/program/slots/[programCurriculumId]/start/route.ts`

`update` is now just `{ startedAt: new Date() }`. `create` is untouched —
a genuinely brand-new row still starts as `IN_PROGRESS`. No other lines in
either file were changed.

### Verification

**1. DB snapshot before/context — 4 real COMPLETED rows, all with `startedAt: null`:**

```
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.userSessionProgress.findMany({ where: { status: 'COMPLETED' } }).then(rows => { console.log(JSON.stringify(rows, null, 2)); process.exit(0); });
"
```

Output (before the live check below re-ran `start` against one of these):

```json
[
  { "id": "cmr0c9nnc000lmhm0ppuhp1sy", "curriculumSessionId": "cmqnyzf6p0003mh3g8r9f621j", "status": "COMPLETED", "startedAt": null, "completedAt": "2026-06-30T07:42:19.129Z", "scoreAchieved": 0.4 },
  { "id": "cmr0gvcd50007mhf8zc8roidi", "curriculumSessionId": "cmqnyzf6s0005mh3gf1xgwsyz", "status": "COMPLETED", "startedAt": null, "completedAt": "2026-06-30T09:51:10.131Z", "scoreAchieved": 0.6666666666666666 },
  { "id": "cmrixeuga000hmhqce5v7m849", "curriculumSessionId": "cmqnyzf6v0007mh3g4hgodei6", "status": "COMPLETED", "startedAt": null, "completedAt": "2026-07-13T07:54:04.330Z", "scoreAchieved": 0.6666666666666666 },
  { "id": "cmrm8811j000hmhxolcrk1nny", "curriculumSessionId": "cmqnyzf6y0009mh3g0vcba71h", "status": "COMPLETED", "startedAt": null, "completedAt": "2026-07-15T15:20:00.582Z", "scoreAchieved": 1 },
  { "id": "cms1yfto10001mhiwgeuga162", "curriculumSessionId": "cmqnyzf71000bmh3glgvfqx0y", "status": "COMPLETED", "startedAt": "2026-07-26T15:30:26.918Z", "completedAt": "2026-07-26T15:34:36.983Z", "scoreAchieved": 0.6 }
]
```

(The 5th row already had `startedAt` set from earlier Task-3 manual testing —
not one of the "4 real rows" referenced in the review, but harmless: its
early-return path is untouched by this fix.)

**2. Live browser check (proves the actual regression is fixed):**

- Logged in at `http://localhost:3000` as `student@lexi.local` / `lexi1234`.
- Target row selected: `curriculumSessionId: cmqnyzf6p0003mh3g8r9f621j`
  (sessionNumber 1), `status: COMPLETED`, `startedAt: null` — the exact
  "completed, never officially started" shape the review flagged.
- Navigated to `/practice/1`. Network log confirms
  `POST /api/curriculum/sessions/1/start → 200 OK` fired on mount (per the
  Task-3 wiring in `PracticeQuiz.tsx`).
- Re-queried the same row by its compound unique key immediately after:

```
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.userSessionProgress.findUnique({ where: { userId_curriculumSessionId: { userId: 'cmqnyzf670000mh3gwqovulwx', curriculumSessionId: 'cmqnyzf6p0003mh3g8r9f621j' } } }).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); });
"
```

Result:

```json
{
  "id": "cmr0c9nnc000lmhm0ppuhp1sy",
  "userId": "cmqnyzf670000mh3gwqovulwx",
  "curriculumSessionId": "cmqnyzf6p0003mh3g8r9f621j",
  "status": "COMPLETED",
  "startedAt": "2026-07-26T15:47:25.371Z",
  "completedAt": "2026-06-30T07:42:19.129Z",
  "scoreAchieved": 0.4
}
```

`status` is still `"COMPLETED"` (not reset to `IN_PROGRESS`), and `startedAt`
is now backfilled to a real timestamp. This is the exact scenario the
reviewer found broken, confirmed fixed against live app + real dev.db data.

**3. Automated checks:**

- `npm run test:user-program-progress` — 5 passed, 0 failed (schema-level
  test, doesn't exercise the routes, unaffected by this fix as expected):
  ```
  ✓ row created with default-free explicit status
  ✓ startedAt persisted
  ✓ completedAt is null until completed
  ✓ duplicate (userId, programCurriculumId) rejected by unique constraint
  ✓ update by the compound unique key works
  5 passed, 0 failed
  ```
- `npx tsc --noEmit` — 0 errors (no output).

## Fix 2 (Minor) — dangling `docs/DECISION_LOG.md` references

Added one new entry to `docs/DECISION_LOG.md`, after the most recent existing
entry ("Program — CurriculumSession is untouched in this pass..."):

`## Program v2 — UserProgramProgress + fixing the dead CurriculumSession start route`

covering the decision (added `UserProgramProgress` + Program start/complete
routes + wiring into `PracticeQuiz.tsx`), the reason (the dead
`CurriculumSession` start route + its own idempotency bug, discovered via the
4 real `COMPLETED`/`startedAt: null` rows above), and what was deliberately
not done (repointing the 5 analytics consumers to read `UserProgramProgress`
— still write-only, separate follow-up).

The three references to `docs/DECISION_LOG.md` already in the code
(`prisma/schema.prisma`'s `UserProgramProgress` doc comment, and the
docstrings in both start route files) now resolve to a real entry — no code
changes were needed for those three, only the doc-log addition.

## Commit

All of the above (2 route fixes + 1 doc-log entry + this report) committed as
a single commit on `feat/program-curriculum`.
