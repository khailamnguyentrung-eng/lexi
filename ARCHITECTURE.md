# LEXI Architecture

_Long-term technical reference. Everything below is grounded in the actual
current repository as of 2026-06-23, not aspirational design. Cross-check
against [PROJECT_STATUS.md](./PROJECT_STATUS.md) (detailed feature/test log)
and [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) (condensed session entry
point) if anything here seems out of date._

## 1. Product Overview

LEXI is an AI-assisted English-learning platform for a Vietnamese grade-9
student preparing for the Hanoi (and other provinces') grade-10 public
high-school entrance exam.

**Target users**: one student (the seeded `student@lexi.local` account, role
`STUDENT`) and one admin (`admin@lexi.local`, role `ADMIN`) who curates exam
content. The product is currently a single-tenant pilot, not multi-user.

**Core product goals**:
- Give the student a structured 24-session curriculum (3 phases: Foundation,
  Core, Exam Prep) with daily practice, an error notebook, and progress
  tracking.
- Let the student talk to "Lexi," an AI tutor persona (Socratic tone, no
  shaming language), for grammar/vocab help.
- Let the admin turn real exam documents (DOCX/PDF) into reviewed, trustworthy
  `Question` rows — with AI assistance for the tedious part (reading the
  document and proposing structured questions) but a **mandatory human
  approval step** before anything reaches the student-facing question bank.

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16 App Router (React 19, TypeScript) | Server Components by default; `"use client"` only where interactivity is needed |
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) | No separate backend service — API routes run in the same process |
| Styling | Tailwind CSS v4 | `app/globals.css` defines `--lexi-*` custom-property tokens |
| Database | SQLite (`prisma/dev.db`) for local dev | Schema is written to be Postgres-portable (see header comment in `schema.prisma`); not yet tested against real Postgres |
| ORM | Prisma 6 (`prisma-client-js` generator) | `lib/db/prisma.ts` is the singleton client |
| Authentication | NextAuth.js (Credentials provider, JWT session strategy) | `lib/auth/authOptions.ts`; role (`STUDENT`/`ADMIN`/...) is carried in the JWT and session |
| AI integration | Custom `AIProvider` abstraction over 3 backends | `@anthropic-ai/sdk` (Claude), `@google/genai` (Gemini), and a pure-TS mock — see §6 |
| File parsing | `mammoth` (DOCX→text), `pdf-parse` (PDF→text) | Real extraction; images have no OCR yet |
| Deployment assumptions | Single Node process, local disk for uploads | `lexi/uploads/` is a plain directory; no object storage, no CDN, no multi-instance considerations yet |

## 3. High Level System Architecture

```
Frontend (React Server/Client Components, app/(app)/**, app/admin/**)
        ↓  fetch() / form POST
API Routes (app/api/**/route.ts)
        ↓  function calls
Services (lib/services/**, lib/ai/**)
        ↓  Prisma queries
Database (SQLite via Prisma, prisma/schema.prisma)
        ↓  (only for AI-touching services)
External AI providers (Anthropic API, Google Gemini API — or none, via Mock)
```

**Layer responsibilities**:
- **Frontend**: renders pages, collects user input, calls API routes. Holds
  almost no business logic — e.g. `PracticeQuiz.tsx` posts an answer and
  renders whatever feedback the API returns; it doesn't decide correctness
  itself.
- **API routes**: authentication/authorization checks (`getCurrentUser()`,
  `requireAdmin()`), request parsing, and delegating to services. Thin by
  design — see `app/api/admin/content-sources/[id]/normalize-sample/route.ts`
  for a representative example (auth check, call one service function,
  return JSON).
- **Services** (`lib/services/`, `lib/ai/`): all actual business logic —
  curriculum progression rules, skill-matrix computation, the entire
  content-import pipeline, AI provider selection. This is where to add new
  logic; routes and components should stay thin.
- **Database**: Prisma models are the single source of truth for persisted
  state. No raw SQL anywhere in the codebase.
- **External AI providers**: only ever called from inside `lib/ai/providers/*`
  implementations — nothing else in the codebase imports `@anthropic-ai/sdk`
  or `@google/genai` directly.

## 4. Application Structure

### `app/`
- `app/(auth)/login/page.tsx` — credentials login form, client component
  calling NextAuth's `signIn()`.
- `app/(app)/` — student-facing route group, gated by `app/(app)/layout.tsx`
  (redirects to `/login` if no session; **no role check**, so an admin can
  also view these pages). Contains `dashboard/`, `chat/`,
  `practice/[sessionNumber]/`, `error-notebook/`, `progress/`, `profile/`,
  `diagnostic-test/`.
- `app/admin/` — admin-only route group, gated by `app/admin/layout.tsx`
  (redirects to `/dashboard` if `user.role !== "ADMIN"`). Contains
  `content/` (overview list) and `content-import/` (upload + AI test
  actions + review UI).
- `app/api/` — mirrors the above: student-facing routes
  (`chat`, `error-notebook`, `profile`, `diagnostic-test`, `mood`,
  `questions/[id]/attempt`, `curriculum/sessions/[n]/complete`) and admin
  routes under `app/api/admin/` (`content-sources`, `import-drafts`), each
  independently calling `requireAdmin()` — defense in depth, since the page
  gate alone wouldn't stop a direct API call.
- **Extension point**: a new student page/route follows the existing
  pattern — add under `app/(app)/`, call a service, render. A new admin
  page follows the same pattern under `app/admin/`.

### `components/`
- `components/ui/` — `Card`, `Button`, `TextField`, `Textarea`: shared
  Tailwind class wrappers extracted from forms to reduce duplication.
  **Only `ProfileForm.tsx` has been migrated to use these so far** — this
  extraction was started, paused, and is listed as open work in
  PROJECT_STATUS.md §9. Most other forms still inline their own Tailwind
  classes (functionally fine, just inconsistent).

### `lib/`
- `lib/ai/` — the AI provider abstraction (chat persona, context assembly,
  provider implementations) — see §6 for full detail.
- `lib/auth/` — `authOptions.ts` (NextAuth config), `session.ts`
  (`getCurrentUser()`), `admin.ts` (`requireAdmin()`).
- `lib/db/prisma.ts` — Prisma client singleton (standard
  Next.js-dev-mode-safe pattern, avoids exhausting connections on hot reload).
- `lib/services/` — student-facing domain logic: `curriculum.ts` (today's
  mission, phase progress, practice-question fallback for sessions with no
  directly-linked questions), `errorNotebook.ts` (spaced-repetition date
  stub), `skillMatrix.ts` (rule-based recompute), `weakness.ts` (weak-topic
  ranking), `streak.ts` (computed learning streak, no schema needed),
  `diagnosticTest.ts` (CEFR level estimate).
- `lib/services/content-import/` — the entire admin content pipeline, see
  §5.
- `lib/phonetics.ts` — derives which substring to underline in a phonetics
  question option, based on `topic` (e.g. `ed_ending_pronunciation` →
  underline `"ed"`). A heuristic, not literal recovered formatting from the
  source document (that markup wasn't captured during transcription).
- `lib/ui/cn.ts` — trivial class-name-join helper (not a real
  clsx/tailwind-merge dependency, since nothing needed conflict resolution).
- **Extension point**: new student-domain logic belongs in
  `lib/services/<name>.ts`, following the existing one-concern-per-file
  pattern (e.g. `streak.ts` only computes a streak, doesn't also touch mood
  or skill data).

### `prisma/`
- `schema.prisma` — single source of truth, 17 models (see §7).
- `seed.ts` — seeds 1 student, 1 admin, 24 curriculum sessions / 3 phases,
  118 real questions (transcribed from `seed-data/questions.json` and
  `curriculum.json`, which were derived from the actual reference tutoring
  documents in `Giáo án gia sư Tiếng Anh/`, not invented).
- `migrations/` — 4 migrations, additive only so far (no destructive schema
  changes have been made).

## 5. Content Import Architecture

```
Source file (DOCX/PDF/IMAGE upload, + optional province/year/examType/
             sourceLabel metadata, stored as a ContentSource row)
        ↓
Extraction        (lib/services/content-import/extractor.ts)
        ↓
Normalization     (lib/services/content-import/ai-normalizer.ts → AIProvider)
        ↓
Validation        (lib/services/content-import/validator.ts)
        ↓
Review            (ExtractedQuestionDraft, PENDING_REVIEW or REJECTED)
        ↓
Database persistence (Question row — only on human "Duyệt" click)
```

**Step detail**:
1. **Upload** (`POST /api/admin/content-sources`) — admin-only, writes the
   raw file to `lexi/uploads/` (20MB cap enforced), creates a `ContentSource`
   row with the file's metadata.
2. **Extraction** (`extractor.ts`'s `fileExtractor`) — dispatches by
   `ContentFileType`: **DOCX → `mammoth`** (real), **PDF → `pdf-parse`**
   (real), **IMAGE → a placeholder string** (no OCR). Verified against all
   3 real reference documents in this repo with zero encoding/garbling
   issues and correct Vietnamese diacritics.
3. **Normalization** (`ai-normalizer.ts`'s `normalizeWithAI()`) — calls
   `getAIProvider().normalizeQuestions({rawText, sourceFileName})`. For
   documents matching the `"PHẦN N – ĐỀ TEST..."` section-header convention
   (verified: the real 118-question source splits into exactly 3 batches of
   36/37/45 questions), `chunker.ts` + `normalizeLargeDocument.ts` process
   each exam part as an independent AI call instead of one call covering
   the whole document — with per-batch partial-failure handling (one batch
   failing doesn't abort the others) and cross-batch duplicate-code
   detection. The model-specific call (Claude or Gemini) shares one prompt/
   JSON-parsing/retry recipe via `lib/ai/providers/normalizationCore.ts` —
   see §6.
4. **Validation** (`validator.ts`'s `validateDrafts()`) — checks every
   draft for: missing `questionCode`, duplicate `questionCode` (against the
   DB *and* within the same batch), missing `topic`, invalid `correctOption`
   (must resolve to A/B/C/D with non-empty option text), any of the 4
   options empty, invalid `type`/`skill`/`difficulty` enum value, missing
   `promptText`/`explanationVi`/`learningObjective`. This is **shape**
   validation only — it cannot verify that a question is *faithful* to the
   source document (no structured ground-truth answer key exists to compare
   against), so the UI's evaluation checklist is explicit about which checks
   are mechanical vs. which need a human reading the source text.
5. **Review** — every draft becomes an `ExtractedQuestionDraft`:
   `PENDING_REVIEW` if it passed validation, `REJECTED` (with the specific
   error as `reviewNote`, always visible, never approvable) if not. Two
   admin test actions exist *before* a real run: **"Chạy mẫu AI"** (5-question
   sample, does persist drafts) and **"Chạy thử toàn bộ đề bằng AI (dry run)"**
   (all batches, **persists nothing** — verified via direct DB row-count
   checks before/after that it's truly read-only).
6. **Database persistence** — `importer.ts`'s `approveDraft()` is the
   **only function in the codebase that creates a `Question` row**. It's
   only called when a human clicks "Duyệt" on a `PENDING_REVIEW` draft.
   `rejectDraft()` just marks a draft `REJECTED` with the admin's note.

**Supported formats**: DOCX and PDF (real extraction). IMAGE is accepted by
the upload form but extraction returns a placeholder string — no OCR.

**Current limitations**:
- Only `mockProvider` output has ever been verified end-to-end; Gemini is
  blocked by an external quota issue (5 attempts, 5 keys, multiple Google
  accounts — see §6 and PROJECT_STATUS.md §8); Claude has never been tried
  for lack of a paid key.
- `chunker.ts`'s section-header detection is specific to the
  `"PHẦN N – ĐỀ TEST..."` convention of the one real reference document
  tested; documents without that convention fall back to one big chunk.
- No real OCR; no real object storage (local disk only); no stress test on
  a genuinely large document (the 3 real reference docs are all 20–35KB).

**Future OCR extension point**: `extractor.ts`'s `Extractor` interface
(`extract(contentSource): Promise<{rawText: string}>`) is the seam — a real
OCR implementation just needs to fill in the `IMAGE` case of
`fileExtractor.extract()`'s switch statement (or be swapped in as a whole
new `Extractor` implementation); nothing downstream
(`ai-normalizer.ts`/`validator.ts`/`importer.ts`) needs to change.

## 6. AI Architecture

### Why the abstraction exists

The project has no budget for Claude (Anthropic has no free tier). Gemini
has a free tier, so the codebase was migrated from Claude-only to a
provider-agnostic interface so the app could run on whichever provider is
actually affordable/available, with Mock as a zero-cost, always-available
fallback for development and demos.

### `AIProvider` interface (`lib/ai/providers/types.ts`)

```ts
interface AIProvider {
  name: "claude" | "gemini" | "mock";
  chat(params: { system: string; messages: ChatMessageInput[] }): Promise<string>;
  normalizeQuestions(input: NormalizeQuestionsInput): Promise<{ drafts: NormalizedQuestionDraft[]; retryCount: number }>;
  generateExplanation(input: GenerateExplanationInput): Promise<string>;
}
```

`generateExplanation()` is implemented on all three providers (interface
completeness) but has **no caller anywhere in the codebase yet** — it's a
prepared building block for a future feature like Error Detective Mode,
not a wired-up feature today.

### Current providers (`lib/ai/providers/`)

- **`mockProvider.ts`** — zero network calls, canned but clearly-labeled
  Vietnamese placeholder text (never pretends to be a real grammar
  explanation). Always available, the only provider fully verified
  end-to-end in this environment.
- **`claudeProvider.ts`** — wraps `@anthropic-ai/sdk` via
  `lib/ai/claudeClient.ts` (`getClaudeClient()`, `CLAUDE_MODEL =
  "claude-sonnet-4-6"`). Fully implemented; never tested with a real key
  (no budget).
- **`geminiProvider.ts`** — wraps `@google/genai` via
  `lib/ai/geminiClient.ts` (`getGeminiClient()`, `GEMINI_MODEL =
  "gemini-2.0-flash"`). Fully implemented; **blocked**: 5 real-call attempts
  across 5 different API keys and multiple Google accounts/projects
  (including a brand-new account + brand-new project) all failed identically
  with `429 RESOURCE_EXHAUSTED, limit: 0` on every free-tier quota
  dimension. Provider-selection logic itself is confirmed correct every
  time (`getAIProviderStatus()` reports `gemini`/`gemini-2.0-flash` with
  `isFallback: false` whenever the key is present) — the block is external
  to this codebase. **Important nuance**: `isFallback` only triggers when a
  key is *absent*; with the current present-but-quota-blocked key, a real
  call still fails, and the *caller* (chat route, content-import routes)
  handles that failure with a generic error message — there is no automatic
  runtime substitution of Mock when a configured provider's call fails.

Both real providers' `normalizeQuestions()` share one implementation
recipe via **`normalizationCore.ts`**: the system prompt text, JSON
parsing (`parseDrafts()`), and a retry-exactly-once-on-invalid-JSON policy
(`normalizeWithRetry()` — sends the bad response back with an explicit
repair instruction before giving up; never a third attempt, never a
fabricated fallback). Each provider only supplies its own "send these
messages, get text back" call (`callClaude()` / `callGemini()`).

### Provider selection (`lib/ai/providers/index.ts`)

`getAIProviderStatus()` reads `AI_PROVIDER` (`"mock"|"gemini"|"anthropic"`):
explicit value wins if its key is present; falls back to Mock (with a
`fallbackReason`) if the named provider's key is missing or the value is
unrecognized; if `AI_PROVIDER` is unset, auto-detects by key presence
(Gemini checked first, then Claude, then Mock). `getAIProvider()` is the
older plain-provider accessor (just returns `.provider` from the status),
kept for callers that don't need the status metadata.

### How to add a new provider

1. Create `lib/ai/<name>Client.ts` mirroring `claudeClient.ts`/
   `geminiClient.ts` (an `is<Name>Configured()` check + a lazy singleton
   client).
2. Create `lib/ai/providers/<name>Provider.ts` implementing `AIProvider`:
   implement `chat()` and `generateExplanation()` directly; implement
   `normalizeQuestions()` by calling `normalizeWithRetry()` from
   `normalizationCore.ts` with a `(messages) => callYourModel(...)`
   callback — don't re-derive the prompt or JSON-parsing logic.
3. Wire it into `getAIProviderStatus()` in `lib/ai/providers/index.ts`
   (one new `if (raw === "<name>")` branch + one auto-detect line).
4. Update `lib/ai/providerLabel.ts`'s display label and the `AIProvider`
   union types (`name`) in `types.ts`.
No other file needs to change — every call site (`chat` routes,
content-import services, UI components) reads `.name` for display only and
never branches on which provider is active.

### Flow

```
User request (chat message, or admin clicking "Chạy mẫu AI"/dry run)
        ↓
AI service layer (contextAssembler.ts for chat; ai-normalizer.ts/
                   normalizeLargeDocument.ts for content-import)
        ↓
Provider (getAIProviderStatus().provider — mock/claude/gemini)
        ↓
Response handling:
  - chat: assistant message saved to ChatMessage, or a generic Vietnamese
    error message saved on failure (route's try/catch — see route.ts)
  - content-import: validateDrafts() before persistence as
    ExtractedQuestionDraft; a 500 with the raw provider error if the call
    itself throws (sample-test/dry-run routes)
```

## 7. Database Architecture

Prisma is used exclusively — no raw SQL, no second ORM. SQLite locally;
the schema file's header comment documents exactly what to change for
Postgres (swap `provider`, re-add `@db.Decimal`/`@db.Text`/`@db.VarChar`
annotations where precision matters — none of that has been tested yet).

**Design decisions worth knowing**:
- **JSON-as-string, not JSON columns.** SQLite's Prisma support doesn't
  give first-class JSON columns, so fields like `LearnerProfile.strengths`,
  `CurriculumSession.grammarTopics`, `ContentSource`'s future tags, and
  `ExtractedQuestionDraft.normalizedData` are all `String?` holding
  `JSON.stringify()`'d data, parsed by the reading code. This is a
  deliberate SQLite-era compromise — moving to Postgres could switch these
  to real `Json` columns, but nothing currently depends on querying inside
  them.
- **Nullable "future" fields are seeded in now, not added later.**
  `ErrorNotebookEntry.easeFactor`, `Question.tags`/`sourceExam`,
  `LearnerProfile.preferredAmbientSound`, etc. exist today, unused, so a
  future feature (real spaced repetition, multi-province tagging, a focus
  player) doesn't need a migration that backfills historical rows — it just
  starts writing to a column that was always there.
- **`ExtractedQuestionDraft` stores the candidate question as a JSON blob,
  not as `Question`-shaped columns.** This decouples draft storage from
  `Question`'s schema — adding a field to `Question` later doesn't require
  a migration on the draft table.

**Key models**:
- **`User`** — `role` enum (`STUDENT`/`PARENT`/`TUTOR`/`ADMIN`) drives all
  authorization; only `STUDENT` and `ADMIN` are actually used today.
  Relations fan out to nearly every other domain (profile, attempts, chat,
  content-import uploads/reviews, diagnostics, mood).
- **`LearnerProfile`** — one-to-one with `User`. Holds target/current/
  diagnostic scores and JSON-string `strengths`/`weaknesses`/`learningHistory`
  arrays — currently manually edited or rule-derived; `weaknesses` is
  explicitly designed to later be AI-written without a schema change.
- **`Question`** — the canonical question-bank row. `questionCode` is the
  unique human-readable identifier (e.g. `"DIAG36_Q01"`) that both the seed
  data and the AI-normalization prompt use to avoid collisions.
  `curriculumSessionId` is nullable and optional — not every question is
  tied to a specific lesson (see `getPracticeQuestions()`'s fallback logic
  in `lib/services/curriculum.ts` for sessions with none directly linked).
- **`QuestionAttempt`** — one row per answer submission; feeds
  `skillMatrix.ts`'s rule-based recompute and is the raw signal a future
  AI-weakness-detection feature would consume.
- **`ErrorNotebookEntry`** — `occurrenceCount` increments on a repeated
  identical mistake (auto-flags `isRemedialFlagged` after >2); the spaced-
  repetition fields (`reviewStage`/`nextReviewAt`/`easeFactor`) exist now
  but the current write logic is a fixed Day-1/3/7/14/30 offset stub, not a
  real SM-2 algorithm.
- **`CurriculumPhase`/`CurriculumSession`** — model the real 24-session,
  3-phase program transcribed from the reference tutoring documents; not
  abstract placeholders.
- **`ChatSession`/`ChatMessage`** — `ChatSession.mode` is a `ChatMode` enum
  with 5 values, but only `TEACHER` is reachable from the UI today (no mode
  selector exists); the other 4 mode handlers in `lib/ai/modes/` are stub
  files (`isAvailable: false`).
- **`ContentSource`/`ImportJob`/`ExtractedQuestionDraft`** — see §5; the
  three-table split (rather than one big table) lets a single uploaded file
  be re-processed by multiple `ImportJob`s without losing the original
  upload's identity/metadata.

## 8. API Architecture

| Route | Purpose | Input | Output | Service called |
|---|---|---|---|---|
| `POST /api/chat` | Create a new Teacher-Mode chat session | none (uses session user) | `{session}` | `assembleContext()` |
| `POST /api/chat/[sessionId]/messages` | Send a chat message, get Lexi's reply | `{content}` | `{userMessage, assistantMessage}` | `getAIProviderStatus()` → provider `.chat()` |
| `POST /api/questions/[id]/attempt` | Record a practice answer | `{selectedOption}` | `{isCorrect, correctOption, ...}` | direct Prisma write to `QuestionAttempt` |
| `GET/POST /api/error-notebook` | List / create error entries | `{studentAnswer, correctAnswer, concept, reason}` | entries / created entry | `lib/services/errorNotebook.ts` |
| `PATCH /api/error-notebook/[id]` | Mark an entry reviewed | — | updated entry | spaced-repetition date stub |
| `PATCH /api/profile` | Update learner profile | profile fields | updated profile | direct Prisma (profile is *read* server-side directly in `profile/page.tsx`, no GET route exists) |
| `POST /api/diagnostic-test` | Record a diagnostic test result | `{grammarScore, vocabularyScore, readingScore}` | `{estimatedLevel}` | `lib/services/diagnosticTest.ts` |
| `POST /api/mood` | Log today's mood | `{mood, note?}` | created entry | direct Prisma |
| `POST /api/curriculum/sessions/[n]/complete` | Mark a curriculum session done | — | updated progress | direct Prisma |
| `POST /api/admin/content-sources` | Upload a file (admin) | multipart form + metadata | `{contentSource}` | `createContentSource()` |
| `POST /api/admin/content-sources/[id]/extract` | Run full extraction+normalization, persist drafts | — | `{importJob}` | `runImportJob()` |
| `POST /api/admin/content-sources/[id]/normalize-sample` | 5-question sample test, persists drafts | — | `{job, report}` | `runSampleNormalization()` |
| `POST /api/admin/content-sources/[id]/normalize-dry-run` | Full dry run, **persists nothing** | — | `{report, batches, ...}` | `normalizeLargeDocument()` |
| `POST /api/admin/import-drafts/[id]/approve` | Approve a draft → create `Question` | — | updated draft | `approveDraft()` |
| `POST /api/admin/import-drafts/[id]/reject` | Reject a draft | `{reviewNote?}` | updated draft | `rejectDraft()` |

All `/api/admin/*` routes call `requireAdmin()` independently of the page-
level layout gate.

## 9. Current Data Flow Examples

**Example 1 — Import exam question**: Admin uploads
`Bo_de_test_Tieng_Anh_9.docx` with province="Hà Nội" →
`POST /api/admin/content-sources` writes the file, creates `ContentSource`
→ admin clicks "Chạy mẫu AI" → `runSampleNormalization()` extracts real
text via `mammoth`, slices to the first 5 questions, calls
`normalizeAndPersistDrafts()` → `getAIProviderStatus().provider
.normalizeQuestions()` (currently Mock, since Gemini is quota-blocked) →
`validateDrafts()` → 2 `ExtractedQuestionDraft` rows persisted
(`PENDING_REVIEW` or `REJECTED`) → admin reviews in the UI, clicks "Duyệt"
on a valid one → `approveDraft()` creates the real `Question` row.

**Example 2 — Student answers a question**: Student is on
`/practice/[sessionNumber]` → clicks an option → `PracticeQuiz.tsx` POSTs
to `/api/questions/[id]/attempt` → route creates a `QuestionAttempt` row,
returns whether it was correct + the explanation → UI shows feedback and
(if wrong) a "Ghi vào sổ lỗi" link pre-filled to `/error-notebook/new`.

**Example 3 — AI tutor conversation**: Student opens `/chat` → if no
`ChatSession` exists, `assembleContext()` gathers profile/weaknesses/recent
errors/current mission and a session is created → student sends a message
→ `POST /api/chat/[sessionId]/messages` builds the system prompt from
`LEXI_PERSONA_BASE` + the Teacher-Mode handler's prompt, calls
`getAIProviderStatus().provider.chat()` → on success, saves the reply as a
`ChatMessage`; on failure (e.g. Gemini's current quota block), saves a
generic "Lexi đang gặp chút trục trặc" message instead.

**Example 4 — Error notebook update**: Student answers wrong on a practice
quiz → clicks "Ghi vào sổ lỗi" → `POST /api/error-notebook` with
`{studentAnswer, correctAnswer, concept, reason}` → if an open entry with
the same `concept`+`studentAnswer` already exists, increments
`occurrenceCount` (and flags `isRemedialFlagged` if >2); otherwise creates
a new entry with `nextReviewAt` set via the Day-1 stub offset.

## 10. Extension Points

- **OCR** — fill in the `IMAGE` branch of `extractor.ts`'s
  `fileExtractor.extract()` (or swap in a new `Extractor` implementation);
  nothing downstream changes.
- **AI weakness detection** — write to `SkillMatrixEntry` with
  `computedBy: "AI"` (the enum already distinguishes `MANUAL`/`RULE_BASED`/
  `AI`); consume `QuestionAttempt` + `ErrorNotebookEntry` as the AI's input
  signal.
- **Smart recommendation** — a new service/route reading the same
  `SkillMatrixEntry`/`ErrorNotebookEntry` data; no schema change needed.
- **Spaced repetition (real SM-2)** — `ErrorNotebookEntry.reviewStage`/
  `easeFactor` already exist; only `lib/services/errorNotebook.ts`'s write
  logic needs to change from the fixed-offset stub to a real algorithm.
- **Gamification** — additive new tables (XP/achievements), hooking off
  existing events (`QuestionAttempt`, session completion) — not yet
  modeled at all.
- **Multi-province exam database** — `Question.tags`/`sourceExam` and
  `ContentSource.province`/`examYear`/`examType` already exist as nullable/
  free-text fields for this purpose; promoting them to validated enums or a
  separate lookup table is the natural next step once real multi-province
  content exists.
- **Additional chat modes** (Error Detective, Practice Generator, Exam
  Coach, Motivation) — the `ChatMode` enum and `lib/ai/modes/` stub files
  already exist (`isAvailable: false`); filling one in plus adding a UI
  mode selector (currently absent) completes the feature.

## 11. Architecture Rules

These are load-bearing constraints, not suggestions:
- **Preserve the `AIProvider` abstraction.** Every AI call goes through
  `chat()`/`normalizeQuestions()`/`generateExplanation()`. Never import
  `@anthropic-ai/sdk` or `@google/genai` outside `lib/ai/providers/`.
- **Avoid unnecessary schema rewrites.** The 17-model schema already
  anticipates most near-term features via nullable/future-use fields (see
  §7 and §10) — check there before adding a column or model.
  `ContentSource`'s exam-metadata fields and `ImportJob`'s relation to it
  already cover what a naive read of "add metadata" might re-implement.
- **Keep the validation/human-review gate.** No code path other than
  `importer.ts`'s `approveDraft()` may create a `Question` row from
  AI-derived data. Invalid drafts are stored visibly as `REJECTED`, never
  silently dropped, never silently approved.
- **Do not tightly couple to one AI provider.** New AI-dependent features
  should accept whichever provider `getAIProviderStatus()` resolves to;
  don't special-case "if Gemini" or "if Claude" in feature code.
- **Prefer additive changes.** Recent work (run reports, evaluation
  checklist, multi-provider support) was added as new files/components
  alongside existing ones, not by restructuring what already worked. Follow
  that pattern unless there's a concrete, verified reason not to.

## 12. Known Technical Debt

- **Gemini is externally blocked** (5 failed attempts, `429
  RESOURCE_EXHAUSTED, limit: 0`, multiple accounts/projects) — no real AI
  provider output has ever been verified in this environment; the full
  118-question import has never been attempted and shouldn't be until this
  resolves or `claudeProvider` gets a paid key.
- **No automatic runtime fallback to Mock on API failure** — only an
  *absent* key triggers the Mock fallback path; a present-but-broken key
  (today's actual state) produces a generic error in chat and a raw 500 in
  content-import, not a graceful demo reply.
- **No OCR** for IMAGE sources — placeholder text only.
- **No multi-user registration** — one hardcoded seeded student, one
  hardcoded seeded admin; adding more requires manually seeding `User` rows.
- **SQLite only** — Postgres portability is by design but untested; local
  disk uploads only, no object storage.
- **UI component extraction incomplete** — only `ProfileForm.tsx` uses the
  `components/ui/` primitives; other forms still inline Tailwind classes.
- **Dev DB has test artifacts** from iterative session testing (extra
  `ContentSource`/`ImportJob`/`ExtractedQuestionDraft`/`Question` rows with
  `IMPORT_*_SAMPLE` codes) — harmless, but not a clean baseline; run
  `npx prisma migrate reset && npm run db:seed` before treating it as one.
- **No automated test suite** — verification has been `tsc --noEmit` +
  `next build` + manual/live-preview spot-checks, not unit/integration
  tests.
- **4 of 24 curriculum sessions have no directly-linked questions** (rely
  on `getPracticeQuestions()`'s topic-match/broad-sample fallback) — works,
  but the 2 mock-exam sessions would benefit from purpose-built full-length
  question sets once more content exists.
- **`chunker.ts`'s document-splitting is convention-specific** — works for
  the one real reference document's `"PHẦN N – ĐỀ TEST..."` header style;
  a differently-structured document falls back to one undivided chunk.
