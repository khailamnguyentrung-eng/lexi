# LEXI Project Handoff

_Last updated: 2026-06-23 — end of a long session. Read this first._

**Required reading for a new session, in order**:
1. This file (condensed entry point).
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — the long-term technical reference:
   product overview, system layers, application structure, the content
   import pipeline, the AI provider architecture, database design
   decisions, API route table, data-flow examples, extension points, and
   known technical debt. Read this before making any structural change.
3. [PROJECT_STATUS.md](./PROJECT_STATUS.md) — detailed feature-by-feature
   status and the full test/verification log (useful for "was X actually
   tested, and how" questions ARCHITECTURE.md doesn't answer).

## Project goal

LEXI is an AI-assisted English-learning platform for a Vietnamese grade-9
student preparing for the Hanoi (and other provinces') grade-10 entrance
exam. Next.js (TypeScript, App Router) + Prisma (SQLite locally). It has two
sides: a **student app** (dashboard, practice, error notebook, progress,
AI chat, profile) and an **admin content pipeline** (`/admin/content-import`)
for turning real exam DOCX/PDF files into reviewed `Question` rows, with AI
assistance and a mandatory human-approval gate.

## Current architecture

**App structure** (Next.js App Router):
- `app/(auth)/login`, `app/(app)/{dashboard,chat,practice,error-notebook,progress,profile,diagnostic-test}` — student-facing, role-agnostic.
- `app/admin/{content,content-import}` — gated to `Role.ADMIN` via `app/admin/layout.tsx`.
- `app/api/...` — route handlers; admin content routes live under `app/api/admin/`.

**Content import pipeline** (`lib/services/content-import/`):
```
Upload (DOCX/PDF/image, + optional province/year/examType/sourceLabel metadata)
  → extractor.ts (REAL text extraction for DOCX via mammoth, PDF via pdf-parse;
     IMAGE is a placeholder string — no OCR yet)
  → ai-normalizer.ts → AIProvider.normalizeQuestions() (chunked for large docs
     via chunker.ts + normalizeLargeDocument.ts, which splits the real
     118-question source into 3 batches of 36/37/45 by its own
     "PHẦN N – ĐỀ TEST" section headers)
  → validator.ts (questionCode/type/skill/difficulty/correctOption/
     explanationVi/learningObjective, missing answer, invalid option,
     duplicate questionCode — within batch AND against the DB)
  → ExtractedQuestionDraft (PENDING_REVIEW if valid, REJECTED with reason if not)
  → human clicks "Duyệt" on /admin/content-import
  → Question row created (only path that can create one)
```
Two admin test actions exist before committing to a real import:
- **"Chạy mẫu AI"** (5-question sample, persists drafts for review)
- **"Chạy thử toàn bộ đề bằng AI (dry run)"** (all batches, **persists nothing**)

Both report a full run summary (`lib/services/content-import/runReport.ts`):
provider, model, fallback status/reason, chunks processed, input size,
output count, valid/invalid counts, retry count, processing time — never an
API key.

**AI provider architecture** (`lib/ai/`):
- `AIProvider` interface: `chat()`, `normalizeQuestions()` (returns
  `{drafts, retryCount}`), `generateExplanation()` (built, not wired to any
  UI yet).
- Three implementations: `mockProvider` (canned, always available),
  `claudeProvider` (Anthropic, paid, no free tier), `geminiProvider`
  (`@google/genai`, `gemini-2.0-flash`, free tier — **currently blocked**,
  see Current Blockers).
- `normalizationCore.ts` — the prompt, JSON parsing, and retry-once-on-
  invalid-JSON logic are shared by both real providers (not duplicated).
- `getAIProviderStatus()` / `getAIProvider()` — selection via `AI_PROVIDER`
  env var (`gemini`|`anthropic`|`mock`), auto-detects by key presence if
  unset, falls back to Mock (never errors a request) if the selected
  provider's key is missing, with the reason always surfaced.

**Database state**: SQLite (`prisma/dev.db`), 17 models, 4 migrations
(`20260621154511_init` → `20260622082620_content_source_metadata`). Schema
is Postgres-portable by design (see comment at top of `schema.prisma`).
Seeded: 122 `Question` rows (118 real + 4 test artifacts — see Known
Issues in PROJECT_STATUS.md §8), 24 `CurriculumSession` / 3
`CurriculumPhase`, 1 student (`student@lexi.local` / `lexi1234`), 1 admin
(`admin@lexi.local` / `lexi-admin-1234`).

**Validation/review workflow**: every AI-produced draft is validated before
persistence; invalid ones are stored `REJECTED` with the reason (visible,
never approvable) instead of silently dropped. Valid ones are
`PENDING_REVIEW`. Only a human clicking "Duyệt" (`approveDraft()` in
`importer.ts`) ever creates a `Question` row — verified multiple times this
session, including via direct DB count checks before/after dry runs (zero
writes).

## Completed features

Only what's actually implemented and verified working:
- Login, dashboard (mission/streak/mood/skill bars), practice quiz (with
  phonetics underlining + rich feedback), error notebook (spaced-repetition
  stub), progress page (skill matrix + weak-topic ranking), profile,
  diagnostic test, AI chat (Teacher Mode only; other `ChatMode`s are stubs).
- Admin: content upload with exam metadata, real DOCX/PDF text extraction
  (verified against all 3 real reference documents, zero encoding issues),
  AI normalization pipeline with validation/retry/chunking, 5-question
  sample test, full dry-run (verified to make zero DB writes), human
  review/approve/reject UI, `/admin/content` overview list.
- Multi-provider AI architecture: provider switching verified across 9
  scenarios (explicit values, missing keys, invalid values, auto-detect);
  Mock provider fully verified end-to-end (chat, sample test, dry run).
- `npx tsc --noEmit` and `npm run build` both pass cleanly as of this
  session's last change.

**Not implemented / explicitly out of scope so far**: OCR for images, real
multi-user registration, Postgres/production deployment, the 4 stub chat
modes, `generateExplanation()` has no caller yet, reusable UI component
extraction was started but only `ProfileForm.tsx` was converted.

## Current blockers

**Gemini API — blocked externally, not a code issue.**
- Code-side wiring confirmed correct every time: `getAIProviderStatus()`
  resolves to `gemini`/`gemini-2.0-flash` with `isFallback: false` whenever
  a key is present in `.env`.
- **5 real-call attempts, all failed identically**: `429 RESOURCE_EXHAUSTED`,
  `limit: 0` on all 3 free-tier quota dimensions
  (`generate_content_free_tier_requests` per day, per minute;
  `generate_content_free_tier_input_token_count` per minute).
- Tried across: 5 different API keys, multiple Google accounts, multiple
  Google Cloud projects — including one attempt **after** a reported
  Cloud-project/API-enablement fix, and one attempt with a **brand-new**
  Google account + brand-new project named "Lexi" + brand-new key. Same
  error every time.
- A fresh account hitting an identical `limit: 0` rules out anything
  account- or project-specific. This points to a broader Gemini free-tier
  policy/regional restriction, or a billing-linkage requirement that AI
  Studio key generation doesn't satisfy on its own.
- **Investigation is closed per explicit instruction.** Do not test another
  key without first independently confirming a nonzero quota directly on
  Google's own quota dashboard ([ai.dev/rate-limit](https://ai.dev/rate-limit)),
  outside this app.
- **Consequence**: no real-provider output has ever been produced or
  evaluated. Every test (chat, sample test, dry run) has only run against
  `mockProvider`. The full 118-question import has not been attempted and
  should not be, until real normalization quality is verified with some
  provider.
- **Important nuance discovered during handoff verification**:
  `isFallback`/`mockProvider` in `getAIProviderStatus()` only activates
  when a key is *absent*. With the current `.env` (a real but quota-blocked
  `GOOGLE_GEMINI_API_KEY`), the status check reports `isFallback: false` —
  correct, since the key is present — but the actual API call still fails.
  **The practical result right now is a generic error, not a graceful Mock
  reply**: chat shows "Lexi đang gặp chút trục trặc..." and content-import
  surfaces a raw 500. To get the clearly-labeled Mock demo experience back,
  explicitly set `AI_PROVIDER="mock"` (or empty `GOOGLE_GEMINI_API_KEY`)
  until the quota resolves.
- **`claudeProvider` is fully implemented and untested only for lack of a
  paid key** — switching `AI_PROVIDER=anthropic` with a real
  `ANTHROPIC_API_KEY` requires zero code changes and is the most direct
  path to verifying real AI output if Gemini access doesn't resolve.

## Current working state

- `npx tsc --noEmit` → clean (0 errors) as of this session's last commit of changes.
- `npm run build` → clean, same 21 routes, no schema drift.
- Dev DB has test artifacts from this session (see PROJECT_STATUS.md §8) —
  harmless, but run `npx prisma migrate reset && npm run db:seed` for a
  clean baseline if needed.

**Important commands**:
```bash
npm install
npx prisma generate
npx prisma migrate deploy      # or `migrate reset` for a clean DB
npm run db:seed                # 1 student + 1 admin + 24 sessions + 118 questions
npm run dev                    # http://localhost:3000
npx tsc --noEmit
npm run build
npm run test:chat              # standalone chat-pipeline smoke test
```
Logins: `student@lexi.local` / `lexi1234` · `admin@lexi.local` / `lexi-admin-1234`
(both overridable via `STUDENT_*`/`ADMIN_*` env vars — see README.md).

## Next priorities

1. **OCR support for IMAGE sources** — `extractor.ts` currently returns a
   placeholder string for images; DOCX/PDF are real. Needed for full
   three-file-type coverage.
2. **Admin/registration flow** — currently only one hardcoded seeded admin
   and one seeded student exist; no self-serve way to add more of either.
3. **PostgreSQL production setup** — schema is Postgres-portable by design
   but untested against real Postgres; also needs a real object-storage
   backend for uploads (currently local disk).
4. **Future AI provider decision** — either resolve Gemini's external quota
   block (see Current Blockers) or get a paid `ANTHROPIC_API_KEY` to
   verify real normalization quality before attempting the full
   118-question import. Until one of these happens, do not scale past the
   5-question sample test.

## Development rules

- **No unnecessary schema changes.** The current 17-model schema already
  covers exam metadata, content-import staging, and the validation/review
  workflow — verify it's actually insufficient before adding columns/models.
- **No UI redesign without an explicit request.** Recent work has been
  additive (new panels/buttons), not restructuring; keep following that
  pattern.
- **Preserve the provider abstraction.** `AIProvider`
  (`chat`/`normalizeQuestions`/`generateExplanation`) is the single
  integration surface — new providers implement it, callers never branch
  on which one is active beyond `.name` for display.
- **Preserve validation and the human-review gate.** Nothing should ever
  create a `Question` row except a human approving a `PENDING_REVIEW`
  `ExtractedQuestionDraft`. AI output is never trusted directly, in chat or
  in content-import.

---

**This session did not implement new features in its final turn** — it
only verified the Gemini blocker one more time (5th and final attempt,
per instruction) and produced this handoff plus the PROJECT_STATUS.md
updates above. The repository is in a clean, building, documented state
ready for a fresh session to pick up at "Next priorities" above.
