# Lexi — Project Status

_Last updated: 2026-06-25 — Phase 1 complete (topic audit + mid-exam prompt)_

**Starting a new session?** Read [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md)
first — it's the condensed entry point. This file is the detailed reference.

## 1. Architecture Overview

Next.js (TypeScript, App Router, Turbopack) monolith — frontend, API routes, and
AI orchestration all live in one deployable app. No separate backend service.

```
app/
  (auth)/login/page.tsx          Credentials login
  (app)/                         Authenticated student shell (nav layout)
    dashboard/                   Lexi greeting, today's mission, mood, skill bars
    chat/                        Teacher Mode conversation (Lexi)
    practice/[sessionNumber]/    Quiz flow for a curriculum session
    practice/[sessionNumber]/results/  Post-session analytics: score, narrative, focus areas
    error-notebook/              List, detail, manual "log a mistake" form
    diagnostic-test/             Baseline grammar/vocab/reading score entry
    progress/                    Skill matrix (recomputed on load)
    profile/                     Target/current score, strengths/weaknesses
  admin/                         Admin-only shell (role-gated layout)
    content/                     Source overview: status, metadata, approved-question counts
    content-import/              Upload exam files, run extraction, review/approve drafts
  api/                           Route handlers (chat, error-notebook, profile,
                                  diagnostic-test, mood, questions/[id]/attempt,
                                  curriculum/sessions/[n]/complete, auth,
                                  admin/content-sources, admin/import-drafts)
components/ui/                   Card, Button, TextField, Textarea — shared
                                  Tailwind patterns extracted from forms/pages
lib/
  ai/
    claudeClient.ts              Anthropic SDK singleton (model: claude-sonnet-4-6)
    geminiClient.ts              @google/genai singleton (model: gemini-2.0-flash, free tier)
    providerLabel.ts             Shared display label for AIProvider.name (UI helper)
    persona.ts                   Lexi's shared voice/tone + hard rules (Socratic,
                                  no shaming language, no countdown pressure)
    contextAssembler.ts          Builds per-chat context: profile, weaknesses,
                                  recent error concepts, current mission
    encouragement.ts             Correct/incorrect/greeting message banks
    providers/                   AIProvider abstraction — multi-provider (Gemini/Claude/Mock)
      types.ts                   AIProvider interface: chat(), normalizeQuestions(),
                                  generateExplanation()
      normalizationCore.ts        Shared prompt/JSON-parse/retry-once logic — both real
                                  providers call this, so the recipe only lives once
      claudeProvider.ts          Real Claude calls (chat, normalizeQuestions via
                                  normalizationCore, generateExplanation)
      geminiProvider.ts          Real Gemini calls — same shape as claudeProvider
      mockProvider.ts            Canned demo replies + canned draft questions, used when
                                  no real provider is configured
      index.ts                   getAIProviderStatus() — explicit AI_PROVIDER selection
                                  (mock|gemini|anthropic) or auto-detect by key presence,
                                  with isFallback/fallbackReason for full transparency.
                                  getAIProvider() is the old plain-provider accessor, kept
                                  for callers that don't need the status metadata.
    modes/                       ModeHandler registry — one file per chat mode
      teacher.ts                 Fully implemented (MVP)
      errorDetective.ts          Stub (isAvailable: false)
      practiceGenerator.ts       Stub
      examCoach.ts                Stub
      motivation.ts               Stub
  auth/                          NextAuth config + session helper + admin.ts (requireAdmin)
  db/prisma.ts                   Prisma client singleton
  services/
    curriculum.ts                Today's mission + phase progress + practice fallback
    errorNotebook.ts             Spaced-repetition date stub (Day 1/3/7/14/30)
    skillMatrix.ts               Rule-based skill % recompute from attempts
    weakness.ts                  Weak-topic ranking from error notebook
    streak.ts                    Computed learning streak (no new schema)
    diagnosticTest.ts            Rule-based CEFR level estimate
    content-import/              Admin content pipeline (see §5) — NEVER reachable from student chatbot
      extractor.ts                File -> raw text: REAL for DOCX/PDF (adapters/), placeholder for IMAGE
      adapters/docx.ts             mammoth — real DOCX text extraction
      adapters/pdf.ts              pdf-parse — real PDF text extraction
      normalizer.ts               Just the NormalizedQuestionDraft type (canonical schema shape)
      ai-normalizer.ts            Raw text -> AIProvider.normalizeQuestions() -> validateDrafts().
                                  Returns { results, retryCount } — retryCount surfaced in run reports.
      validator.ts                Checks missing answer/topic/learningObjective, invalid option,
                                  duplicate questionCode (within batch + against DB)
      chunker.ts                   Splits a document into independent batches by "PHẦN N – ĐỀ TEST"
                                  section headers (verified: 3 batches of 36/37/45 for the real source)
      normalizeLargeDocument.ts    Chunk -> normalize each batch -> validate -> merge, with
                                  per-batch partial-failure handling + cross-batch duplicate detection +
                                  per-batch/overall timing and retry counts. Pure read — never writes to the DB.
      runReport.ts                 Shared AIRunReport type (provider/model/chunks/input size/output
                                  count/valid/invalid/retryCount/processingTimeMs) — no API key, ever.
      sampleTest.ts                "Chạy mẫu AI" admin test action — slices to first N questions,
                                  reuses the same normalize+validate+persist path at small scale
      importer.ts                 Orchestration + CRUD: upload, run job, review, approve/reject.
                                  Only approveDraft() ever creates a real Question row. Exports
                                  normalizeAndPersistDrafts(), shared by runImportJob and sampleTest.ts
prisma/
  schema.prisma                 Single source of truth for all models
  seed.ts                       Seeds student + admin users + curriculum + questions
  seed-data/questions.json      118 questions (transcribed from reference docs)
  seed-data/curriculum.json     24 sessions / 3 phases
```

**Extension points** (so future features slot in without schema rewrites):
- `Question.tags`/`sourceExam`/`sourceProvince`/`sourceYear` — multi-exam expansion
- `ErrorNotebookEntry.reviewStage`/`easeFactor` — already present, unused by the
  current fixed-offset stub; a real SM-2 scheduler only changes the write logic
- `SkillMatrixEntry.computedBy` (`MANUAL`/`RULE_BASED`/`AI`) — AI weakness
  detection can write here later without a schema change
- `ChatMode` enum + `modeRegistry` — new modes are just new files; the route
  handler never branches on mode name
- `AIProvider` interface — now has two methods (`chat()`, `normalizeQuestions()`);
  a real document-extraction/OCR provider can be added alongside
  `claudeProvider`/`mockProvider` without touching call sites in either chat
  or content-import
- `ContentSource` → `ImportJob` → `ExtractedQuestionDraft` — admin upload →
  extract → AI-normalize → validate → review → import, fully wired
  end-to-end with a real human-approval gate (see §5)
- `ContentSource.province`/`examYear`/`examType`/`gradeLevel`/`subject` —
  exam-tagging columns ready for the future multi-province/year exam database;
  currently admin-entered free text at upload time, not yet validated/enum'd

## 2. Database Schema Summary

SQLite for local dev (no Docker/Postgres available in this environment);
schema is Postgres-portable (see comment at top of `prisma/schema.prisma` —
swap `provider` and re-add `@db.Decimal`/`@db.Text`/`@db.VarChar` annotations
when moving to Postgres).

| Domain | Models |
|---|---|
| Users | `User`, `LearnerProfile` |
| Question bank | `Question`, `Passage`, `QuestionAttempt` |
| Error notebook | `ErrorNotebookEntry` (spaced-repetition fields present, stub logic) |
| Progress | `SkillMatrixEntry`, `UserSessionProgress` |
| Curriculum | `CurriculumPhase`, `CurriculumSession` |
| Lexi chat | `ChatSession`, `ChatMessage` |
| Diagnostic | `DiagnosticTest` |
| Mood | `MoodEntry` |
| Content import (admin) | `ContentSource` (+ exam-tagging metadata), `ImportJob`, `ExtractedQuestionDraft` |

4 migrations applied: `20260621154511_init`, `20260622015325_content_pipeline_diagnostic_mood`,
`20260622051256_content_import_restructure` (renamed the original `ContentUpload`/`ImportItem`
stub models to `ContentSource`/`ImportJob`/`ExtractedQuestionDraft` and split `ImportJob` out as
its own entity so a source can be re-extracted), `20260622082620_content_source_metadata` (added
`province`/`examYear`/`examType`/`gradeLevel`/`subject`/`sourceFileName` to `ContentSource`).

## 3. Seeded Content Statistics

- **118 questions** — 0 duplicate `questionCode`s, all required fields present
  (questionCode, source, topic, skill, difficulty, correctOption, explanationVi,
  commonMistake, learningObjective). Types: phonetics (sound/stress), grammar
  MCQ, word formation, error identification, cloze, reading comprehension,
  sentence transformation.
- **6 reading passages**, correctly linked to their cloze/reading questions.
- **24 curriculum sessions** across **3 phases** (Foundation, Core, Exam Prep),
  each with objective, grammarTopics, vocabThemes, exercises, time blocks;
  only session 1 (diagnostic) has no `unitMapping`, which is correct since
  it isn't tied to a textbook unit.
- 64/118 questions are linked to a specific curriculum session; the rest are
  standalone diagnostic/mid-course/final test-bank items (by design).
- 1 seeded student: `student@lexi.local` / `lexi1234` (overridable via
  `STUDENT_EMAIL`/`STUDENT_PASSWORD`/`STUDENT_NAME` env vars at seed time).
- 1 seeded admin: `admin@lexi.local` / `lexi-admin-1234` (overridable via
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME`) — the only account that can
  reach `/admin/content-import`.

## 4. Implemented MVP Features

- Credentials login (NextAuth, JWT session)
- Dashboard: Lexi greeting, today's mission (next incomplete session),
  due-for-review banner, diagnostic-test prompt, mood picker, skill bars
- Practice flow: per-session quiz → records `QuestionAttempt` → inline
  feedback → one-click "log to error notebook" → marks session complete →
  advances mission. All 118 questions are linked to a curriculum session;
  the 4 sessions with no dedicated test-bank items (checkpoint 2, the
  conditionals extension session, and the 2 mock-exam sessions) fall back
  to topic-matched or broad-sampled questions via `getPracticeQuestions()`
  so no lesson is ever empty. PHONETICS_SOUND questions render an underlined
  substring per option (`lib/phonetics.ts`, derived from `topic` — the
  source docx's underline markup wasn't captured during transcription, so
  this is a topic→pattern lookup, not literal recovered data). Feedback is
  richer: random Lexi-style encouragement on correct answers
  (`lib/ai/encouragement.ts`), and on wrong answers a structured "your
  answer / correct answer / why / common trap" breakdown.
- Error notebook: manual + quiz-sourced entries, repeated-mistake counting
  (`occurrenceCount`, auto-flags `isRemedialFlagged` after >2), spaced
  review-date stub, mark-reviewed action. Verified end-to-end live (wrong
  answer → log → entry stores question/answers/concept/reason/`nextReviewAt`
  correctly).
- Lexi chatbot: Teacher Mode only, context-injected (profile, weaknesses,
  recent errors, current mission), Socratic/encouraging persona. Goes
  through the multi-provider `AIProvider` abstraction (`lib/ai/providers/`,
  see the dedicated entry further down this list) via
  `getAIProviderStatus()` — currently resolves to `mockProvider` because
  `AI_PROVIDER=gemini` is set but `GOOGLE_GEMINI_API_KEY` is blocked by an
  external quota issue (§8) — so chat always responds, with the demo
  replies clearly labeled as placeholders rather than fabricating grammar
  explanations. The chat page banner reflects the exact fallback reason.
  `npm run test:chat` exercises the same pipeline standalone — **only ever
  verified against MockProvider in this environment**; neither Gemini's nor
  Claude's actual reply quality has been confirmed (see Gemini blocker, §8).
- Progress page: skill matrix recomputed (rule-based, % correct per skill)
  on every load; a "chủ điểm cần ôn lại" (weak topics) section ranks
  concepts by error occurrence count (`lib/services/weakness.ts`) — the
  foundation for future AI weakness detection.
- Dashboard: Lexi avatar extracted to its own component
  (`LexiAvatar.tsx`, currently emoji, swappable for an illustrated asset),
  varied greeting messages, and a computed learning streak (🔥, consecutive
  days with any activity — no new schema, derived from existing
  attempt/chat/mood timestamps).
- Profile: target/current score, strengths/weaknesses (manual)
- Diagnostic test: grammar/vocab/reading scores → rule-based CEFR estimate,
  updates `LearnerProfile.diagnosticScore`
- Mood tracking: one tap/day, stored with timestamp
- **Admin content import** (`/admin/content-import`, gated to `Role.ADMIN`):
  upload a PDF/DOCX/image with optional exam metadata (tỉnh/năm/loại đề/lớp/môn)
  → `ContentSource` row created, file saved to `lexi/uploads/` → "Chạy trích
  xuất" runs an `ImportJob` through `extractor.ts` (file → real raw text for
  DOCX/PDF) then `ai-normalizer.ts` (raw text → `AIProvider.normalizeQuestions()`
  → `validator.ts`) → admin reviews each valid draft inline and clicks
  Duyệt/Từ chối → approving creates a real `Question` row and records
  `importedQuestionId`; once every draft in a job is resolved, the job
  auto-flips to `IMPORTED`.
  **AI-assisted normalization is now wired in** — `AIProvider.normalizeQuestions()`
  uses `claudeProvider` (real prompt asking for a strict JSON array matching
  the `Question` schema) when `ANTHROPIC_API_KEY` is set, else `mockProvider`
  (canned drafts), exactly mirroring the chat fallback pattern. **The AI
  output is never trusted directly** — `validator.ts` checks every draft for
  missing answer text, missing topic, an invalid `correctOption` (must be
  A/B/C/D), and duplicate `questionCode` (against the DB and within the same
  batch) before anything is persisted; drafts that fail are stored as
  `REJECTED` with the validation errors as the review note (visible on the
  page, never approvable) instead of silently disappearing or slipping into
  the reviewable queue. Drafts that pass stay `PENDING_REVIEW`, same human
  gate as before — nothing in this pipeline can create a `Question` row
  except a human clicking Duyệt. **Not connected to the student chatbot in
  any way.** Claude's actual normalization quality is unverified in this
  environment (no real key); the validation logic itself was tested against
  10 hand-built drafts derived from the real first 5 questions of the 118-
  question source (5 valid + 5 deliberately broken — missing topic, invalid
  option, missing answer, duplicate in DB, duplicate in batch) and caught
  every one correctly. The full pipeline was also re-run end-to-end after
  this change (extract → normalize via Mock → validate → review → approve),
  and it organically caught a real duplicate from an earlier test run.
- **"Chạy mẫu AI" sample test action** (on each source card in
  `/admin/content-import`): a controlled, small-scale dry run before
  committing to a full document. `sampleTest.ts` extracts the real document,
  slices to just the first 5 questions (`sliceToFirstNQuestions()` — cuts
  before the 6th `"N. "`-numbered line), then runs the exact same
  normalize → validate → persist path as a full import. The UI shows which
  provider ran (Claude vs. Mock — transparent fallback when no key), the
  raw sliced text in a collapsible panel, and each resulting draft with its
  validation verdict inline. **Still only ever produces `ExtractedQuestionDraft`
  rows, never a `Question`.** Run live against the real
  `Bo_de_test_Tieng_Anh_9.docx`: provider correctly reported as `mock`
  (no key configured), the 1,033-char 5-question slice matched the expected
  text exactly, and both canned drafts were — correctly — auto-rejected as
  duplicate `questionCode`s, because `mockProvider` generates the same
  filename-derived codes every run and earlier test sessions had already
  created/approved questions with those exact codes. This is expected mock
  behavior, not a bug, but it does mean **the Mock path cannot demonstrate
  what a successful AI normalization run looks like beyond the first-ever
  attempt against a given filename** — see §8 for what this means for
  scaling to the full 118 questions.
- **Chunking + dry-run preparation for the full 118-question import**
  (still no full import has been run — this is preparation only):
  - `chunker.ts` splits the document into 3 batches along its own
    `"PHẦN N – ĐỀ TEST..."` section headers (case-sensitive, so it doesn't
    false-match the lowercase table-of-contents mentions). Verified against
    the real source: batch 1 = 36 questions, batch 2 = 37, batch 3 = 45 —
    exact match to the document's actual structure.
  - `claudeProvider.normalizeQuestions()` now retries exactly once if
    Claude's response isn't valid JSON, sending the bad response back with
    an explicit repair instruction before giving up. The system prompt was
    also strengthened: preserve the source's original Vietnamese wording
    (no paraphrasing), never invent a `correctOption` if the source doesn't
    state one (skip the question instead), ground `explanationVi` only in
    what the source actually says, and infer `difficulty` from the
    question's real complexity rather than defaulting it.
  - `validator.ts` now also requires `learningObjective` to be non-empty
    (previously only `commonMistake` was allowed null; `learningObjective`
    wasn't checked at all).
  - `normalizeLargeDocument.ts` runs all 3 batches independently (one
    failing doesn't abort the others) and additionally checks for
    `questionCode` collisions *across* batches, since `validator.ts`'s
    per-batch check can't see other batches.
  - **"Chạy thử toàn bộ đề bằng AI (dry run)"** button: runs the full
    chunk → normalize → validate flow across all batches and reports a
    summary (total/valid/invalid counts, failed-batch count, cross-batch
    duplicate codes, per-batch breakdown, a few sample valid drafts) —
    **creates zero `ImportJob`/`ExtractedQuestionDraft`/`Question` rows**.
    Verified live: ran twice against the real 118-question source: 3
    batches reported with the correct char counts (6706/7135/9014, matching
    the verified question-count split), and the database row counts
    (`ImportJob`/`ExtractedQuestionDraft`/`Question`) were identical before
    and after both runs, confirming it really is read-only. Since this ran
    on Mock (no key), all 6 produced drafts (2 per batch × 3) were
    correctly flagged as duplicates — same Mock limitation as the 5-question
    sample test, not a new issue.
- **Admin content overview** (`/admin/content`): a lighter list view across
  all `ContentSource` rows — file name, exam-metadata badges, latest
  `ImportJob` status, count of approved/imported questions, and a "Xem &
  duyệt" link that jumps to that source's card on `/admin/content-import`
  (anchor-based, no duplicate review UI).
- **Real ingestion test against all 3 reference documents** (the actual
  tutoring materials in `Giáo án gia sư Tiếng Anh/`), run twice: once
  calling the service layer directly, once through the real HTTP API
  (login → multipart upload → extract → approve → both admin pages render),
  with identical results both times. Findings:
  - `Bo_de_test_Tieng_Anh_9.docx` (the original 118-question test bank):
    23,165 chars extracted, **0 garbled/replacement characters**, Vietnamese
    diacritics fully intact. A line-pattern check found exactly 236
    `<number>.` lines (118 questions × 2 — once in the question text, once
    in the answer/explanation key) spanning all 3 parts (max question
    number 45, matching the largest part), confirming the text is complete
    and not truncated.
  - `Giao_an_chi_tiet_24_buoi_kem_tai_lieu.docx` and
    `Giao_an_gia_su_Tieng_Anh_9_Global_Success.docx`: 21,660 and 14,525
    chars extracted respectively, same clean result.
  - Extraction took 60–94ms per file (these are small, 20–35KB documents —
    see known issues for what wasn't tested).
  - Added a 20MB upload size cap (`app/api/admin/content-sources/route.ts`)
    as a defensive fix — there was no limit before, so an admin could have
    uploaded something large enough to be loaded entirely into memory via
    `arrayBuffer()`. Verified: a 21MB upload is now rejected with a clear
    400 error before any disk I/O happens.
- **Multi-provider AI architecture (Gemini added, no budget for Claude)** —
  `AIProvider` now has a third implementation, `geminiProvider` (via
  `@google/genai`, free-tier `gemini-2.0-flash`), alongside `claudeProvider`
  and `mockProvider`. All three implement the same interface — `chat()`,
  `normalizeQuestions()`, and the newly added `generateExplanation()` (a
  standalone Vietnamese explanation generator for a single question; built
  for future features like Error Detective Mode, not wired into any UI
  yet). The Claude/Gemini-specific question-normalization prompt, JSON
  parsing, and retry-once-on-invalid-JSON logic were extracted into
  `normalizationCore.ts` so both providers share one implementation instead
  of two copies that could drift.
  - **Provider selection**: `AI_PROVIDER` env var explicitly picks
    `mock` | `gemini` | `anthropic`. Unset auto-detects by whichever key is
    present (Gemini checked first). If the explicitly-selected provider's
    key is missing, or `AI_PROVIDER` is an unrecognized value, falls back
    to Mock (or auto-detect) rather than failing a request — verified
    against 9 scenarios (explicit mock, gemini missing/present key,
    anthropic missing/present key, invalid value, no-`AI_PROVIDER`
    auto-detect with one/both keys present) — all matched expected
    behavior exactly.
  - **Full transparency**: `getAIProviderStatus()` returns
    `{ name, model, requestedProvider, isFallback, fallbackReason }` in
    addition to the provider itself. This is now surfaced everywhere an AI
    call happens: the chat page banner shows the *specific* reason (not
    generic "demo mode" text), and the admin "Chạy mẫu AI" / dry-run panels
    show provider + model + what was requested + why it fell back, via a
    shared `AIStatusLine` component. Verified live with the current `.env`
    state (`AI_PROVIDER="gemini"`, empty `GOOGLE_GEMINI_API_KEY`): every
    surface correctly reports "Mock (chưa cấu hình AI thật) — yêu cầu:
    AI_PROVIDER=gemini" with the exact fallback reason.
  - **No database schema changes.** No existing student-facing flow
    changed. Chunking, validation, the dry-run mode, and the human-review
    gate are all untouched — only the provider underneath them changed.
  - **Real Gemini output is still unverified — blocked on a quota issue,
    not a code issue.** Three different `GOOGLE_GEMINI_API_KEY` values were
    tried (provider detection confirmed correct each time — `gemini` /
    `gemini-2.0-flash`, `isFallback: false`, key loaded), and all three
    produced the identical error on every attempt:
    `429 RESOURCE_EXHAUSTED`, with `limit: 0` on all three free-tier quota
    dimensions (`generate_content_free_tier_requests` per day, per minute,
    and `generate_content_free_tier_input_token_count` per minute). A
    `limit: 0` (vs. "limit: N, used: N") means the Google account/Cloud
    project behind these keys has no free-tier quota provisioned at all for
    `gemini-2.0-flash` — waiting out the suggested retry delay does not
    help, since it isn't a burst-rate issue. Since 3 separate keys hit the
    exact same `limit: 0`, this points to the Google account/project level
    (eligibility, region, or a setup step beyond just generating a key in
    AI Studio), not a bad key. No code, prompt, UI, or schema changes were
    made while diagnosing this — the architecture behaved correctly
    (correct provider selected, no silent fallback, real upstream error
    surfaced cleanly through the API response each time).
    The 5-question live Gemini quality test (Vietnamese preserved, correct
    answer, grounded explanation, valid JSON) remains deferred until a key
    from an eligible account/project is available — see §9.
- **Content metadata confirmed sufficient (no schema change needed)** —
  `ContentSource.province`/`examYear`/`examType`/`sourceLabel` (the
  "sourceName" field) already existed from earlier work and are already
  admin-enterable in the upload form; `ImportJob` reaches this metadata via
  its existing `contentSourceId` relation, so no new columns or duplication
  were needed.
- **Full run-report metrics (Task 4)** — `AIProvider.normalizeQuestions()`
  now returns `{ drafts, retryCount }` instead of a bare array (propagated
  through `normalizationCore.ts`'s `normalizeWithRetry()`,
  `ai-normalizer.ts`, `importer.ts`'s `normalizeAndPersistDrafts()`, and
  `normalizeLargeDocument.ts`), so every run can report how many JSON-repair
  retries it needed. Combined with wall-clock timing (`Date.now()` around
  each call) and the existing provider-transparency status, both the
  5-question sample test and the full dry run now report: provider, model,
  fallback status/reason, chunks processed, input size (chars), output
  question count, valid/invalid counts, retry count, and processing time —
  via a shared `RunReportPanel` component, with **no API key ever
  included**. Verified live against the real
  `Giao_an_gia_su_Tieng_Anh_9_Global_Success.docx`: sample test reported 1
  batch / 3,635 chars / 2 questions / 0 retries / 0.6s; dry run reported the
  same shape with per-batch breakdowns.
- **Evaluation checklist (Task 2)** — the sample-test panel now shows 5
  explicit checks before scaling to a full document. 3 are mechanically
  verified (JSON schema valid, no missing options, no duplicate
  questionCode) and shown with a real pass/fail based on validation
  results; 2 ("giữ đúng tiếng Việt gốc" and "đáp án/giải thích đúng với
  nguồn") are flagged as needing the admin's own comparison against the
  raw source text shown just above — deliberately not faked as automated
  checks, since faithfulness to source content can't be verified by a
  script without a structured ground-truth answer key to compare against
  (which this pipeline doesn't have).
- **Local archive structure documented (Task 3)** — README now suggests an
  optional `LEXI_DATA/exams/<country>/<province>/<year>/` folder convention
  for an admin's own filesystem, explicitly outside the repo and with zero
  code dependency on it — every file still only enters the app through the
  admin upload form.

## 5. Future Extension Points (designed, not built)

- Multi-province/year exam database (`Question.tags`, `sourceProvince`, `sourceYear`)
- AI weakness detection (write to `SkillMatrixEntry` with `computedBy = 'AI'`)
- Smart practice recommendation refinement (cross-session weakness aggregation; current v1 uses most-recent session only)
- Additional Lexi modes: Error Detective, Practice Generator, Exam Coach,
  Motivation (fill in existing stub files; needs a chat-mode UI selector —
  none exists yet, only Teacher Mode is reachable from the UI)
- Real spaced repetition (SM-2 using `reviewStage`/`easeFactor`, already on schema)
- Gamification (XP/levels/achievements — additive tables, not yet modeled)
- Verify `claudeProvider.normalizeQuestions()`'s real output quality once a
  key is added — the prompt/JSON-parsing/validation chain is built and the
  validation logic is tested, but the actual model call is unconfirmed
- OCR for IMAGE sources in `extractor.ts` (still a placeholder string)
- Chunking for `ai-normalizer.ts` if a much larger document needs more
  tokens than fit in one Claude call (today's reference docs are small
  enough to send whole)
- Consider a real object-storage backend instead of local `uploads/` for
  production
- Validate/enum the `ContentSource` exam-tagging fields (`province`,
  `examType`, etc. are free text today) once a real province/exam taxonomy
  is needed
- Focus/Pomodoro + ambient music (`LearnerProfile.preferredAmbientSound` field
  exists; no player UI yet)
- Full Jul 2026–May 2027 multi-phase roadmap (data/seeding change only)

## 6. Environment Variables Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path locally (`file:./dev.db`); Postgres connection string in production |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | Base URL NextAuth uses for callbacks (e.g. `http://localhost:3000`) |
| `AI_PROVIDER` | Explicitly picks `mock` \| `gemini` \| `anthropic` for both chat and content-import normalization. Unset = auto-detect by key presence (Gemini first). See README for the full provider table. |
| `GOOGLE_GEMINI_API_KEY` | Gemini key — **free tier**, get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). This is the recommended provider (no budget for Claude). |
| `GEMINI_MODEL` | Optional, override the Gemini model (default `gemini-2.0-flash`) |
| `ANTHROPIC_API_KEY` | Claude key — paid, no free tier. Optional now that Gemini exists. |
| `STUDENT_EMAIL` / `STUDENT_PASSWORD` / `STUDENT_NAME` | Optional, override the seeded student's identity |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Optional, override the seeded admin's identity (the only account that can reach `/admin/content-import`) |

`.env` in this environment currently has `AI_PROVIDER="gemini"` and a
**non-empty** `GOOGLE_GEMINI_API_KEY` — but every real call with this key
(and 4 others before it) fails with `429 RESOURCE_EXHAUSTED, limit: 0`, an
external Gemini free-tier quota block, not a missing-key problem (see §8).
`getAIProviderStatus()` correctly resolves to `gemini`/`gemini-2.0-flash`
with `isFallback: false` (key presence is read correctly) — **but
`isFallback`/`mockProvider` only ever activates when a key is *absent* at
config-check time, not when a present key's actual API call fails for
another reason** (quota, network, etc.). Right now, with a present-but-
blocked key, the **practical user-facing result is a generic error, not a
graceful Mock demo reply**: `app/api/chat/[sessionId]/messages/route.ts`
catches the failed call and shows "Lexi đang gặp chút trục trặc..." (not
labeled as Mock, not a real answer), and the content-import sample/dry-run
routes surface a raw 500 with Gemini's error text. To get the
clearly-labeled Mock demo experience back, set `AI_PROVIDER="mock"` (or
empty `GOOGLE_GEMINI_API_KEY`) explicitly until the quota issue resolves.
See [README.md](./README.md) for the full setup table.

## 7. Local Setup Instructions

```bash
cd lexi
npm install
npx prisma generate
npx prisma migrate deploy   # applies existing migrations
npm run db:seed             # seeds student + admin + 24 sessions + 118 questions
npm run dev                 # http://localhost:3000
```

Log in with `student@lexi.local` / `lexi1234` (or your `STUDENT_*` overrides)
for the student app, or `admin@lexi.local` / `lexi-admin-1234` (or your
`ADMIN_*` overrides) for `/admin/content-import`.

Production build check: `npm run build` (currently passes clean, 0 type errors).

## 8. Remaining Known Issues

- **Dev DB has accumulated test artifacts from this session's live testing**:
  9 `ContentSource` rows, 27 `ImportJob` rows, 30 `ExtractedQuestionDraft`
  rows, and 4 `Question` rows with codes like `IMPORT_*_SAMPLE1/2`
  (approved during sample-test verification, not real exam content) — plus
  3 files under `lexi/uploads/`. Harmless for continued dev work, but worth
  a `npx prisma migrate reset` + `npm run db:seed` before treating the DB
  as a clean baseline, or before any real content import.
- **🛑 GEMINI BLOCKED — investigation closed, do not retry with another key.**
  `GOOGLE_GEMINI_API_KEY` *is* set and `getAIProviderStatus()` correctly
  resolves to `gemini`/`gemini-2.0-flash` with no fallback, every single
  time this was checked — the app-side wiring is confirmed correct. But the
  real call has now failed identically **5 times across 5 different API
  keys**, including: a reported Google Cloud project/API-enablement fix
  (attempt 4), and — decisively — **a brand-new Google account + brand-new
  Google Cloud project named "Lexi" + brand-new key (attempt 5)**. Every
  attempt returns the exact same `429 RESOURCE_EXHAUSTED`, `limit: 0` on
  all 3 free-tier quota dimensions
  (`generate_content_free_tier_requests` per day, `generate_content_free_tier_requests`
  per minute, `generate_content_free_tier_input_token_count` per minute).
  A fresh account hitting an identical `limit: 0` rules out anything
  specific to one account, one project, or one key — this points to either
  a Gemini free-tier policy/regional restriction affecting this Google
  Workspace/environment broadly, or a billing-linkage requirement that
  generating a key in AI Studio doesn't satisfy on its own. **This is not
  fixable from the application side**, and per explicit instruction this
  investigation is now closed — no more keys will be tested without new
  information from outside this app (e.g. confirming a nonzero quota
  directly on Google's own quota dashboard before touching `.env` again).
  Every run (chat, 5-question sample test, full dry run) remains verified
  only against `mockProvider`'s output — real Gemini quality (Vietnamese
  preservation, answer correctness, grounded explanations, valid JSON) is
  **unverified and now deprioritized**. **Scaling to the full 118-question
  import is not safe to attempt** while this remains true.
- Content-import normalization's validation logic is tested (10 hand-built
  drafts, 5 valid + 5 deliberately broken, all classified correctly — see
  §4), but that's validation of the *shape*, not of whether a real model's
  extracted questions will be faithful to the source document. That can
  only be judged once a real key is added.
- `mockProvider.normalizeQuestions()` derives `questionCode` from the
  filename only, with no run-counter or randomness — every "Chạy mẫu AI" or
  "Chạy trích xuất" against the same source filename produces identical
  codes, so after the first successful run, every later run will be
  auto-rejected as a duplicate by design. Harmless for Mock (it's a fixed
  placeholder anyway), but worth knowing before scaling: the *real*
  prompt (shared by both `claudeProvider` and `geminiProvider` via
  `normalizationCore.ts`) asks for codes derived from content (e.g.
  `"DIAG36_Q01"`), not the filename, which should avoid this — but that's
  unverified without a real key (see above).
- `generateExplanation()` exists on all three providers (interface
  requirement) but isn't called from anywhere yet — no UI wires it up.
  It's a building block for a future feature (e.g. Error Detective Mode),
  not a complete one.
- **Resolved this round**: chunking now exists (`chunker.ts` splits by exam
  part, verified 36/37/45) and `claudeProvider.normalizeQuestions()` retries
  once on invalid JSON. Both are wired into `normalizeLargeDocument.ts` and
  exercised end-to-end by the new dry-run button — but only against Mock.
  Whether 3 real Claude calls of ~36/37/45 questions each actually come back
  as valid JSON (with the retry rarely or never needed) is still unverified
  without a key.
- `chunker.ts`'s section-header detection is specific to the
  `"PHẦN N – ĐỀ TEST..."` convention used by this one reference document.
  A document with a different structure (e.g. no part headers at all) falls
  back to one big chunk — fine for small documents, but loses the chunking
  benefit for anything large that doesn't follow this exact convention.
- IMAGE sources still get a placeholder string in `extractor.ts` (no OCR).
- "Large document handling" hasn't been genuinely stress-tested — the only
  real documents available in this project are all small (20–35KB). A
  20MB upload size cap was added as a defensive measure, but extraction
  performance/memory behavior on a true large file (e.g. a 50-page scanned
  exam PDF) is unverified.
- `ContentSource.province`/`examType`/etc. are free-text inputs with no
  validation — two admins could spell the same province differently.
- Uploaded files are stored on local disk (`lexi/uploads/`) — fine for a
  single-instance dev setup, not production-ready (no object storage, no
  cleanup/retention policy).
- SQLite is dev-only; no Postgres instance provisioned yet for production.
- Chat UI hardcodes `mode: "TEACHER"` — no mode switcher, so the 4 stub modes
  aren't reachable even once implemented, until a selector is added.
- No user registration flow — only the single seeded student and single
  seeded admin exist; adding more of either currently requires manually
  inserting/seeding a `User` row.
- 4 of 24 sessions (checkpoint 2, the conditionals extension session, both
  mock-exam sessions) have no questions directly linked via
  `Question.curriculumSessionId` — they use the `getPracticeQuestions()`
  fallback (topic match, then broad sample) instead. Functionally fine, but
  the mock-exam sessions would benefit from purpose-built full-length sets
  rather than a 10-question sample once more content exists.
- No automated test suite — verification so far is `tsc --noEmit` + `next build`
  + manual code-path tracing + live preview spot-checks, not full
  browser-driven end-to-end testing.

## 9. Phase 1 Implementation — In Progress

### Phase 1 Milestone 1: Readiness Analytics Foundation (✓ Complete)

Implemented core analytics layer for readiness calculation:

**New files created:**
- `lib/analytics/examBlueprint.ts` — Hanoi entrance exam configuration (section weights, expected depths, labels)
- `lib/analytics/types.ts` — All analytics result types and interfaces (ConfidenceTier, ReadinessResult, etc.)
- `lib/analytics/confidenceEngine.ts` — Deterministic confidence tier functions (pure, no DB access)
- `lib/analytics/sessionAnalytics.ts` — Core analytics computations: `computeReadiness()`, `computeBlueprintCoverage()`
- `lib/analytics/index.ts` — Public API exports

**Key implementation decisions (frozen):**
- **CoverageDepthScore replaces binary BlueprintCoverage** in readiness formula
  - Formula: `ReadinessScore = WeightedTopicMastery × 0.60 + CoverageDepthScore × 0.40`
  - CoverageDepthScore: `Σ min(sectionAttempts, expectedSectionDepth) / expectedSectionDepth × sectionWeight`
  - Eliminates arbitrary `totalAttempts` gates; only gate is `insufficientData` when totalAttempts === 0
- **BlueprintCoverage remains display-only** — used for UI grid showing assessed/partial/unassessed sections
- **Three-layer architecture enforced:**
  - Repository layer (DB queries) — none yet, will be added
  - Engine layer (`sessionAnalytics.ts`) — pure functions, zero DB access, fully testable
  - Narrative layer — TBD
- **Confidence tiers deterministic and documented:**
  - OBSERVED: small sample
  - EMERGING: moderate evidence
  - CONFIRMED: stable pattern across sufficient data

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (21 routes, no schema changes yet)
- All four stress-test scenarios architected (concentrated attempts, shallow broad coverage, full mock exam, zero attempts)

### Phase 1 Milestone 2: Session Context Tracking & Data Foundation (✓ Complete)

Implemented Prisma schema changes and session management endpoints for analytics:

**Migration created:** `20260624042409_add_session_context_tracking`

**Schema changes:**
- `QuestionAttempt.curriculumSessionId` (nullable FK to CurriculumSession) — tags each answer with the session it was submitted in
- `QuestionAttempt` index: `(userId, curriculumSessionId)` — enables analytics queries grouping by session
- `UserSessionProgress.startedAt` (nullable DateTime) — records when student began the session
- `CurriculumSession.questionAttempts` (back-relation) — enables bidirectional navigation

**Backward compatibility verified:**
- Existing `QuestionAttempt` records remain valid (all new fields nullable)
- Existing `UserSessionProgress` records remain valid
- Original indexes preserved
- No data loss or disruption to existing practice flow

**Routes implemented:**
1. **POST `/api/curriculum/sessions/[sessionNumber]/start`** (new)
   - Records session start time in `UserSessionProgress.startedAt`
   - Idempotent: multiple calls don't reset `startedAt`
   - Authenticated student only

2. **POST `/api/questions/[id]/attempt`** (modified)
   - Now accepts optional `curriculumSessionId` in request body
   - Persists session context when provided
   - Backward compatible: existing practice flow unchanged if `curriculumSessionId` is omitted

3. **POST `/api/curriculum/sessions/[sessionNumber]/complete`** (modified)
   - Computes `scoreAchieved` from session attempts: `correct_count / total_count`
   - Stores score as 0.0–1.0 proportion (not percentage)
   - Preserves existing completion behavior

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (22 routes — new `/start` route added)
- All migrations applied correctly to SQLite database
- `scoreAchieved` convention validated (0.0–1.0 proportion)

### Phase 1 Milestone 3: Analytics Repository Layer (✓ Complete)

Implemented the data query layer that sits between route handlers and the pure analytics engine.

**Data flow:**
```
Route Handler → repository.ts (DB queries) → sessionAnalytics.ts (pure math)
```

**New files:**
- `lib/analytics/repository.ts` — all Prisma queries for analytics
- `lib/analytics/canonicalTopic.ts` — topic normalization (algorithmic + alias table)

**`repository.ts` functions:**
- `fetchSessionAttempts(userId, curriculumSessionId)` — attempts with question fields (type, skill, topic, difficulty), ordered by `attemptedAt ASC` for section-drop analysis
- `fetchNotebookContext(userId, topics[])` — error notebook entries for a topic list; applies `canonicalTopic()` in application code because Prisma IN queries are exact-match only and can't normalize topic strings
- `fetchSessionComparisonData(userId, sessionAId, sessionBId)` — parallel fetch of two sessions for comparison; returns `{ sessionA, sessionB }`
- `resolveSessionId(sessionNumber)` — translates URL session number to DB ID for route handlers

**`canonicalTopic.ts`:**
- Two-step normalization: algorithmic (lowercase, underscore collapse, strip non-alphanumeric) then alias resolution
- Phase 1: `TOPIC_ALIASES` is a hardcoded constant — seeded with common variants from the current question bank
- Phase 2 migration path documented: add optional `aliasMap?: ReadonlyMap<string, string>` parameter; existing call sites remain unchanged
- Four integration points: content import validator, analytics grouping, notebook matching, session comparison

**Architecture constraints enforced:**
- `repository.ts` is the only analytics file that imports Prisma
- `sessionAnalytics.ts` (pure engine) does not import from `repository.ts`
- `canonicalTopic.ts` has no DB access

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (22 routes unchanged)
- Existing routes unaffected

### Phase 1 Milestone 4: Analytics Service Orchestration Layer (✓ Complete)

Implemented the service layer that combines repository fetches with pure engine computations.

**Data flow (complete):**
```
Route Handler → service.ts (orchestrates) → repository.ts (DB) + sessionAnalytics.ts (pure math)
```

**New files created:**
- `lib/analytics/service.ts` — service orchestration layer
- `scripts/test-analytics.mjs` — standalone pure-function verification (17 tests, no DB needed)

**`service.ts` functions:**
- `getSessionAnalytics(userId, curriculumSessionId, sessionNumber)` — fetches attempts, computes readiness + coverage + weakness signals, then fetches notebook context only for topics with errors (skips the DB round-trip on perfect-score sessions); returns `SessionAnalyticsOutput`
- `getSessionComparison(userId, sessionAId, sessionBId, sessionANumber, sessionBNumber)` — parallel fetch of both sessions, calls `computeSessionComparison()`; returns `SessionComparisonResult`
- `enrichWeaknessWithNotebook(weaknessTopics, notebookRows)` — exported pure merge function; lets route handlers or tests that already have both datasets skip a DB round-trip

**`sessionAnalytics.ts` additions (pure engine, no DB):**
- `AttemptInput` interface — narrow input type the engine actually needs; structurally compatible with `repository.AttemptWithQuestion`; removes the Prisma import from the engine entirely
- `computeWeaknessSignals(attempts, topN?)` — groups by `canonicalTopic()`, computes `riskScore = Σ examWeight for wrong attempts` (sections with higher exam weight rank higher), detects repeated-option patterns, returns top-N sorted by risk
- `computeSessionComparison(sessionA, sessionB, numA, numB)` — per-topic accuracy delta; topics with < 2 attempts in either session return `INSUFFICIENT_DATA` (not silently excluded); "Similar" band = |delta| < 0.10

**Architecture constraints enforced:**
- `service.ts` has zero Prisma imports
- `sessionAnalytics.ts` has zero Prisma imports (uses `AttemptInput` instead of Prisma types)
- Pattern observation threshold: N=2 tutor-only (`studentVisible: false`), N≥3 student-visible
- `notebookContext` starts as `null` from the engine; only the service layer populates it

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run test:analytics` ✓ 17/17 passed (readiness edge cases, weakness ranking, alias normalization, comparison direction, N=1 sparse guard, notebook enrichment merge)
- Blueprint weight anomaly flagged: `EXAM_SECTION_WEIGHTS` sums to 42/40 = 1.05, not 1.0 as the file comment states — tracked as a separate fix (see Known Issues)

**Blueprint audit completed this milestone (see §9 Milestone 4b below):**
- `EXAM_SECTION_WEIGHTS` corrected from the initial `/40` denominator, then fully audited against the source exam document; final correct value is `/45` (45-question format per PHẦN 3).

### Phase 1 Milestone 4b: Exam Blueprint Audit — Document Structure (⚠️ Superseded by 4c)

Audited `lib/analytics/examBlueprint.ts` against the source tutoring document.

**What was found:**
- `Bo_de_test_Tieng_Anh_9.docx` contains 3 practice exam papers (PHẦN 1: 36q, PHẦN 2: 37q, PHẦN 3: 45q)
- PHẦN 3 was labelled "theo cấu trúc đề thi tuyển sinh vào lớp 10" — interpreted as the reference structure
- Blueprint was updated to 45-question structure, weights corrected from `/42` (overflow bug) to `/45`

**Why this was later superseded:**
PHẦN 3 is a tutoring practice paper, not the official Hanoi Grade 10 entrance exam. `Bo_de_test_Tieng_Anh_9.docx` is a teaching/test-bank document — its internal structure describes the practice papers used in tutoring, not the real exam students will sit. LEXI readiness measures exam preparation, not tutoring-document completion. See Milestone 4c for the corrected blueprint.

**Test suite at this milestone:** 17 → 24 tests (5 blueprint integrity tests added).

### Phase 1 Milestone 4c: Real Exam Blueprint Correction (✓ Complete)

Corrected `lib/analytics/examBlueprint.ts` to represent the actual Hà Nội Grade 10 English entrance exam, not the tutoring document's internal structure.

**Source of truth separation:**
- `Bo_de_test_Tieng_Anh_9.docx` → describes tutoring practice papers (36/37/45q) → **not the exam blueprint**
- Hà Nội Grade 10 English entrance exam → **40 questions, 60 minutes, 100% MCQ** → the real target

**KNOWN FACTS (verified against Hà Nội DOET guidance and multiple past papers):**
- Total: 40 MCQ questions
- Time: 60 minutes
- Format: Multiple-choice A/B/C/D, machine-marked

**SECTION DEPTHS (estimated — not yet verified against official exam paper):**

| Section | Depth (est.) | Basis |
|---|---|---|
| Phonetics Sound | 2 | Consistent across all tutoring papers |
| Phonetics Stress | 2 | Consistent across all tutoring papers |
| Grammar / Vocabulary MCQ | 15 | ~37-40% of 40q; includes communicative-function MCQs |
| Error Identification | 2 | ~5% of 40q; lower-bound estimate |
| Word Formation | 4 | Consistent across all tutoring papers |
| Cloze | 5 | ~12.5% of 40q |
| Reading Comprehension | 5 | ~12.5% of 40q |
| Sentence Transformation | 5 | ~12.5% of 40q |
| **TOTAL** | **40** | |

**How to update when official data is available:**
1. Obtain an official Hà Nội DOET exam paper or published section breakdown.
2. Update `EXAM_SECTION_DEPTH` values in `examBlueprint.ts` (sum must equal 40).
3. Remove the ⚠️ estimate markers for verified sections.
4. Run `npm run test:analytics` — the depth-sum and weight-sum tests catch any arithmetic error.
5. Weights derive automatically from `depth / 40`; never edit `EXAM_SECTION_WEIGHTS` directly.

**Design changes from 4b:**
- `EXAM_SECTION_WEIGHTS` is now derived from `EXAM_SECTION_DEPTH / TOTAL_EXAM_QUESTIONS` rather than hardcoded — the weight-sum invariant is guaranteed by construction, not by manually checking arithmetic.
- All depth values marked as estimated in comments with a clear verification prompt.
- File header explicitly separates "known facts" from "assumptions."

**Impact on readiness score calculation:**

| Scenario | 45q blueprint (4b) | 40q blueprint (4c) |
|---|---|---|
| Sparse 3/section at 100% | 80 — NEARLY_READY | 81 — NEARLY_READY |
| Full depth at ~80% accuracy | 88 — EXAM_READY | 90 — EXAM_READY |
| Full depth at 100% | 100 (exact) | 100 (exact) |

**API route added this milestone:**
- `GET /api/analytics/session/[sessionNumber]` — thin auth guard + `resolveSessionId()` + `getSessionAnalytics()` → JSON. No Prisma in the route file.
- Route file: `app/api/analytics/session/[sessionNumber]/route.ts` (created)
- `GET /api/analytics/compare/[sessionA]/[sessionB]` — directory created, route file **pending** (see §9 Remaining)

**Verified:** `npx tsc --noEmit` ✓ clean · `npm run test:analytics` ✓ 24/24 passed

### Phase 1 Milestone 4d: Analytics API Contract Layer (✓ Complete — FROZEN)

Added `lib/analytics/contracts.ts` as the stable boundary between the analytics backend and any frontend consumer.

**Response boundary:**
```
Database → Repository → Engine → Service → contracts.ts → API Route → Frontend
                                            ^^^^^^^^^^^^
                                            This is the frozen API surface.
```

**What the contract layer adds:**
- `SessionAnalyticsResponse` — full session analytics in frontend-safe shape
- `SessionComparisonResponse` — comparison result in frontend-safe shape
- `toSessionAnalyticsResponse()` — mapper: `SessionAnalyticsOutput` → contract
- `toSessionComparisonResponse()` — mapper: `SessionComparisonResult` → contract
- Both routes now call the mapper before `NextResponse.json(...)` — no service types leak to the wire

**Key design decisions (frozen):**
- **No Prisma types in contracts.** `QuestionType`/`Difficulty` become `string`; `ConfidenceTier` enum becomes `ConfidenceLevel = "OBSERVED" | "EMERGING" | "CONFIRMED"` plain union.
- **No engine internals in contracts.** `weightedTopicMastery`, `coverageDepthScore`, `contribution` (intermediate calc steps) are stripped. `sectionBreakdown` is lifted out of `readiness` to a separate top-level field.
- **Date → string at the boundary.** `notebookContext.mostRecentEntry.lastReviewedAt` is `Date` inside the engine, `string | null` (ISO 8601) in the contract — reflects actual JSON wire format.
- **Stable renames for clarity.** `weaknessTopics` → `weaknessSignals`, `wrongAttempts` → `wrongAnswers`.
- **`confidence` at both levels.** Top-level `confidence` is a convenience copy of `readiness.confidence` (overall session data quality). For comparison, `confidence` is the most conservative confidence across comparable topics.
- **`expectedDepth` added to section items.** Both `BlueprintSectionItem` and `SectionBreakdownItem` include `expectedDepth` (from the exam blueprint) so frontend can display "X of Y questions attempted" without importing the blueprint directly.
- **`ComparisonDirection` shared.** Already a plain string union in `types.ts` (no Prisma dependency), re-exported from contracts rather than redefined.

**Stability contract:** additive changes (new optional fields) are backward-compatible. Structural changes (rename, remove, type change) require frontend coordination before merging.

**Verified:** `npx tsc --noEmit` ✓ clean · `npm run build` ✓ clean (33 routes) · `npm run test:analytics` ✓ 24/24

### Phase 1 Milestone 5a: Narrative Foundation (✓ Complete)

Added `lib/analytics/narrative.ts` — the interpretation layer that converts analytics signals into student-friendly Vietnamese text.

**Signal → Explanation pipeline:**
```
Engine → Service → contracts.ts → [narrative.ts] → UI component
                                   ^^^^^^^^^^^^^^
                                   Interprets signals; never re-calculates them.
```

**Three pure functions:**

`generateReadinessNarrative(response: SessionAnalyticsResponse): ReadinessNarrative`
- Headline: band-appropriate (4 distinct templates: EXAM_READY / NEARLY_READY / DEVELOPING / NOT_READY)
- Explanation: band template + coverage context appended when `unassessedCount > 3` or when the student is NEARLY_READY with any gaps
- Strongest area: section with highest accuracy and ≥2 attempts, formatted as "Label (X%)"
- Next focus: first weaknessSignal topic, or lowest-depth section if no errors
- Confidence note: non-null only for OBSERVED data ("kết quả chỉ mang tính tham khảo bước đầu")
- Insufficient data path: returns a distinct "start practicing" message; all nullable fields are null

`generateWeaknessNarrative(signals: WeaknessSignalItem[]): WeaknessNarrative[]`
- Guidance: accuracy-calibrated across 4 bands: <0.3, ≤0.5, <0.7, ≥0.7 — all use "practice focus" framing
- Evidence note: "Bạn đã thử N câu, đúng M câu (P%)" — always shows the data behind the narrative
- Pattern note: only set when `patternObservation.studentVisible === true` (N ≥ 3 occurrences); N=2 tutor-only notes are suppressed at the student level
- Notebook note: remedial-flagged entries get a stronger copy; non-flagged entries get a light note

`generateComparisonNarrative(response: SessionComparisonResponse): ComparisonNarrative`
- Headline driven by `improvedCount vs. declinedCount` ratio; 4 headline variants
- Summary: 1-sentence "So với buổi trước, bạn đã..." with exact topic counts
- `improvedAreas`: label list for IMPROVED topics; `needsAttention`: label list for DECLINED topics
- No-comparable-topics path: distinct "Chưa đủ dữ liệu" headline and explanation

**Persona compliance (verified by test suite):**
- All output in Vietnamese
- "Practice focus" language only — no "sai", "thất bại", "kém", "tệ" in any generated string
- All forbidden vocabulary (chẩn đoán, nghiêm trọng, mất chú ý…) absent — tested by Suite 6
- Raw internal scores never exposed (no readiness score number in any narrative string)
- Confidence note only for OBSERVED data — EMERGING and CONFIRMED narratives have no hedge

**Test suite:** `scripts/test-narrative.mjs` — 37 tests, 6 suites
- Suite 1: EXAM_READY/CONFIRMED — headline, no confidence note, strongest area, next focus
- Suite 2: DEVELOPING/OBSERVED — confidence note, coverage context, next focus from weakness
- Suite 3: Insufficient data — "start practicing" path, all nullable fields are null
- Suite 4: Weakness narratives — evidence, pattern, notebook, guidance tiers, null cases
- Suite 5: Comparison — positive headline, improved/declined lists, no-data path
- Suite 6: Persona compliance — 9 forbidden words checked across all outputs

`package.json` script: `"test:narrative": "node scripts/test-narrative.mjs"`

**Verified:** `npx tsc --noEmit` ✓ clean · `npm run build` ✓ clean · `npm run test:narrative` ✓ 37/37

### Phase 1 Milestone 5b: Student Analytics Results Page (✓ Complete)

Implemented the student-facing analytics experience at `/practice/[sessionNumber]/results`.

**Route:** `app/(app)/practice/[sessionNumber]/results/page.tsx` — Server Component, no Prisma in component, no AI calls.

**Data flow:**
```
page.tsx → resolveSessionId() → getSessionAnalytics() → toSessionAnalyticsResponse()
        → generateReadinessNarrative() → generateWeaknessNarrative() → render
```

**Page sections (in order):**
1. **CurrentLevelCard** — estimated score on 10-point scale (`readiness.score / 10`, formatted `"X.X/10"`), band badge (Sẵn sàng thi / Gần sẵn sàng / Đang phát triển / Đang xây nền), readiness explanation. Colour-coded by band: emerald / lexi-primary / amber / zinc.
2. **LexiResultsBubble** — 🦄 avatar, warm narrative headline, confidence note if OBSERVED. Shown only when `!insufficientData`.
3. **StrongestAreaCallout** — "Điểm mạnh hôm nay" with the highest-accuracy section in emerald. Shown only when `strongestArea !== null`.
4. **PracticeFocusCards** — 1-3 weakness topics; each shows label, guidance, evidence ("Bạn đã thử N câu…"), optional pattern note (amber highlight), optional notebook note. Forbidden language enforced: no "yếu", "kém", "thất bại" — uses "cần luyện thêm", "nên củng cố" framing. All-correct sessions show a positive "Buổi học xuất sắc!" card instead of an empty section.
5. **SectionCoverageStrip** — 8 labelled dots (purple/amber/zinc for ASSESSED/PARTIAL/UNASSESSED). Hidden when all sections ASSESSED (students don't need a fully-green strip — the score already captures this).
6. **ActionFooter** — primary pill: "Luyện buổi N+1 →"; secondary: "Hỏi Lexi"; tertiary: "Về trang chủ".

**Score display philosophy:** `readiness.score` (0–100 internal) is divided by 10 and shown as `"X.X/10"`. This is a navigation signal (where am I on the road to 10?) not a judgment. No raw internal engine values (`weightedTopicMastery`, `coverageDepthScore`) are shown. For `insufficientData` sessions, no score is displayed — only the warm narrative.

**Practice quiz fix (data gap resolved):** `PracticeQuiz` previously submitted attempts without `curriculumSessionId`, leaving the analytics engine without session-tagged data.
- Added `curriculumSessionId: string` prop to `PracticeQuiz`.
- Each attempt POST now includes `{ selectedOption, curriculumSessionId }`.
- Practice `page.tsx` passes `session.id` down.
- On last question completion: `router.push(\`/practice/${sessionNumber}/results\`)` — navigates to results instead of the former inline "🎉" card.
- Completion button label changed from "Hoàn thành buổi học" to "Xem kết quả buổi học" to set expectation.

**Three verified states:**
1. Student with data — score, band, strengths, focus areas all render.
2. Insufficient data — no fake score; warm "Hãy bắt đầu luyện tập" message; action footer still accessible.
3. All-correct session — no empty weakness section; shows "Buổi học xuất sắc! 🎉" + forward prompt.

**Verified:** `npx tsc --noEmit` ✓ clean · `npm run build` ✓ clean (32 routes → `/practice/[sessionNumber]/results` in route list).

---

### Phase 1 Milestone 5c: Results Page Validation (✓ Complete)

Added `scripts/test-results.mjs` (31 tests) — validates 4 student scenarios against the results page's rendering logic and 4 UX concerns.

`package.json` script: `"test:results": "node scripts/test-results.mjs"`

**Scenarios validated:**
1. **Weak student** — score 6.5/10, DEVELOPING, OBSERVED confidence, 4 unassessed sections, 2 weakness cards (one with pattern + remedial notebook note), confidence note shown, coverage strip shown.
2. **Average improving student** — score 7.7/10, NEARLY_READY, EMERGING, 1 unassessed section, 1 weakness card with notebook note, no confidence note, coverage strip shown ("Luyện thêm ở 1 phần còn thiếu sẽ đưa bạn qua ngưỡng sẵn sàng" triggers).
3. **Strong student** — score 9.2/10, EXAM_READY, CONFIRMED, no weakness signals → "Buổi học xuất sắc! 🎉" card, no confidence note, coverage strip hidden (all sections assessed).
4. **Insufficient data** — no score shown, warm "Hãy bắt đầu luyện tập" headline, action footer still directs to next session.

**UX concerns confirmed (all 31/31 pass):**

| Concern | Verdict |
|---|---|
| Score is `readiness.score / 10` (not raw `scoreAchieved`) | ✓ Confirmed — `score=65 → "6.5/10"`, `score=77 → "7.7/10"`, `score=92 → "9.2/10"` |
| Internal band names hidden from students | ✓ Confirmed — badge shows "Đang phát triển" not "DEVELOPING"; narrative strings contain no band enum values |
| No shaming/negative vocabulary | ✓ Confirmed — 19 forbidden words checked across all 4 scenarios, 0 hits |
| Student always told what to do next | ✓ Confirmed — `nextFocus !== null` for weak/average; EXAM_READY gets forward prompt via "all correct" card; action footer renders unconditionally |
| Evidence notes use positive framing | ✓ Confirmed — "đúng X câu" (positive), no "sai" in evidence strings |
| Confidence note only when OBSERVED | ✓ Confirmed — non-null for OBSERVED, null for EMERGING/CONFIRMED |

**Score philosophy confirmed:**
- `readiness.score` (0–100) is the weighted analytics score: `WeightedTopicMastery × 0.6 + CoverageDepthScore × 0.4`. This is NOT `UserSessionProgress.scoreAchieved` (raw correct/total ratio 0.0–1.0).
- Divided by 10 for student display: a navigation signal ("where am I on the road to 10?"), not a grade.
- For `insufficientData`, no score is shown — warm narrative only.

**One verified behavior note:**
Scenario 1's "strongest area" resolved to "Đọc hiểu (50%)" rather than phonetics (100%), because the phonetics section had only 1 attempt — below the `≥ 2` threshold for the strongest-area calculation. This is correct: a single-question result is too noisy to call "strongest." The threshold enforces minimum evidence before making a claim to the student.

**Full test matrix:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓

---

### Phase 1 Milestone 5d: Error Notebook Intelligence Foundation (✓ Complete)

Transformed the error notebook from a passive mistake store into a personal improvement loop.

**Learning loop documented:**
```
Mistake → Notebook Entry → Review → Practice (QuestionAttempt) → Improvement Signal → UI
```

**New file: `lib/analytics/notebookIntelligence.ts`**

Architecture: read-only intelligence layer sitting alongside `service.ts` and `repository.ts`. No schema changes, no writes, no AI calls. Two DB queries per call (ErrorNotebookEntry + QuestionAttempt × Question.topic).

```
ErrorNotebookEntry  ─┐
QuestionAttempt     ─┼──→ notebookIntelligence.ts → TopicNotebookSummary[] → UI
Question.topic      ─┘
```

**`computeImprovementSignal()` — pure function:**

Compares practice accuracy before vs. after `lastReviewedAt` to detect whether reviewing a notebook entry actually helped:

| Signal | Condition |
|---|---|
| IMPROVED | postAccuracy ≥ 0.80 AND (postAccuracy − preAccuracy) ≥ 0.10 |
| IMPROVING | postAccuracy > preAccuracy (below IMPROVED threshold) |
| RECURRING | postAccuracy ≤ preAccuracy (no gain after review) |
| NO_DATA | zero practice attempts after the review date |

Zero pre-review attempts → `preAccuracy = 0` (treats first-time practice post-review accurately).

**`getTopicNotebookSummaries()` — repository/service function:**

Produces `TopicNotebookSummary[]` per canonical topic, sorted by priority:

| Priority tier | Criteria |
|---|---|
| Highest | RECURRING + isRemedialFlagged (reviewed but still failing, many occurrences) |
| High | RECURRING alone |
| Medium | isRemedialFlagged (many occurrences, not reviewed) |
| Normal | dueCount > 0 (due for review today) |
| Fallback | totalOccurrences (raw mistake count) |

Topics where all entries are MASTERED are excluded entirely.

**`getPriorityReviewTopic()` — thin wrapper returning the single highest-priority topic. (Now superseded by `getAdaptiveRecommendations()` on the dashboard — see Milestone 6.)**

**UI changes:**

*Error Notebook page (`/error-notebook`):*
- Added "Chủ đề cần chú ý" section above the existing flat entry list
- Shows up to 3 topics where `improvementSignal === "RECURRING"` OR `dueCount > 0`
- Each card shows: topic label, signal badge (Vietnamese, positive framing), occurrence count, accuracy trend for RECURRING topics, CTA "Ôn tập ngay →" → `/chat?topic=...`
- Existing due/upcoming entry list preserved exactly below
- Fetches summaries in parallel with entries via `Promise.all`

*Dashboard (`/dashboard`) — updated in Milestone 6:*
- `getPriorityReviewTopic()` replaced by `getAdaptiveRecommendations()` (see Milestone 6)

**Signal display vocabulary (positive framing — no negative language):**

| Signal | Badge text | Color |
|---|---|---|
| IMPROVED | "Đã cải thiện" | emerald |
| IMPROVING | "Đang tiến bộ" | lexi-primary |
| RECURRING | "Cần luyện thêm" | amber |
| NO_DATA | "Chưa thực hành lại" | zinc |

**Test suite: `scripts/test-notebook-intelligence.mjs` — 18 tests**

- Scenario 1-2: IMPROVED — significant gain (87.5% post / 25% pre), exact 80% threshold boundary
- Scenario 3: IMPROVING — moderate gain (50% post / 25% pre, below 80% threshold)
- Scenario 4-4b: RECURRING — accuracy dropped, flat accuracy (no gain)
- Scenario 5-5b: NO_DATA — no post-review attempts, empty attempt list
- Scenario 6-6b: No pre-attempts — strong post (→ IMPROVED), moderate post (→ IMPROVING)
- Priority sorting: RECURRING > NO_DATA; RECURRING+flagged > RECURRING; due entry > higher occurrences without due
- Mastered exclusion: fully mastered → excluded; partial → not excluded; none mastered → not excluded
- Occurrence cap: bonus capped at 10 regardless of raw count

`package.json` script: `"test:notebook": "node scripts/test-notebook-intelligence.mjs"`

**No migration required.** All signals computable from existing `ErrorNotebookEntry` + `QuestionAttempt` + `Question.topic`.

**`lib/analytics/index.ts` updated** — exports `ImprovementSignal`, `TopicNotebookSummary`, `computeImprovementSignal`, `getTopicNotebookSummaries`, `getPriorityReviewTopic`.

**Verified:**
- `npm run test:notebook` ✓ 18/18 passed
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (34 routes unchanged — no new routes added)

**Full test matrix after this milestone:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓
- `npm run test:notebook` → 18/18 ✓

---

### Milestone 6: Adaptive Practice Recommendation (✓ Complete)

Closed the learning loop: analytics and notebook intelligence now generate actionable recommendations that drive students to targeted practice, which produces new `QuestionAttempt` records that feed back into analytics.

**Full loop:**
```
Attempt → Analytics → Error Notebook → Insight → Recommendation → Practice → New Attempt
```

**New file: `lib/services/practiceRecommendation.ts`**

Four priority tiers, deterministic, no AI, no schema changes:

| Tier | Priority label | Condition | Action |
|---|---|---|---|
| 1 | RECURRING_MISTAKE | Notebook topic reviewed but accuracy did not improve | PRACTICE_TOPIC |
| 2 | DUE_REVIEW | `dueCount > 0` (spaced-rep schedule due today) | REVIEW_NOTEBOOK |
| 3 | WEAKNESS_SIGNAL | Session analytics shows accuracy < 70% on topic | PRACTICE_TOPIC |
| 4 | CURRICULUM_PROGRESS | Next incomplete curriculum session | ADVANCE_SESSION |

De-duplication by canonical topic: each topic appears at most once at its highest applicable tier. Maximum 4 recommendations returned. Weakness signals with `accuracy ≥ 0.70` are excluded (not urgent enough for a daily recommendation).

**Pure function: `computeRecommendations(ctx: RecommendationContext): PracticeRecommendation[]`**
- Takes pre-fetched data (no Prisma imports in the pure layer)
- Input: `topicSummaries` (from notebook intelligence), `weaknessSignalTopics` (from session analytics), `nextSessionNumber`, `nextSessionTitle`, `questionCountByTopic` (from question count map)
- Output: `PracticeRecommendation[]` — sorted by tier, capped at 4, deduplicated

**Pure function: `buildQuestionCountMap(rawTopics: string[]): Map<string, number>`**
- Canonicalizes each raw topic string, groups, counts
- Used to populate `questionCount` on each recommendation (drives CTA label)

**Repository function: `getAdaptiveRecommendations(userId): Promise<PracticeRecommendation[]>`**
- Fetches in parallel: notebook topic summaries, current mission, most recently completed session (ordered by `sessionNumber DESC`), all question topics
- If a completed session exists: calls `getSessionAnalytics()` to get weakness signals (wrapped in try/catch — proceeds without tier 3 if analytics fails)
- Calls `computeRecommendations()` with the assembled context

**New route: `/practice/topic/[topic]` (`app/(app)/practice/topic/[topic]/page.tsx`)**

Option B for the PRACTICE_TOPIC action — closes the feedback loop:
- Decodes canonical topic from URL param
- Fetches all 118 questions, filters by `canonicalTopic(q.topic) === canonical` in JS (fast at this size), takes first 10
- Reuses `PracticeQuiz` component with no `curriculumSessionId` (attempts recorded as user-level, not session-level — still contribute to topic accuracy via notebook intelligence)
- On completion: navigates to `/dashboard` (not a session results page)
- 404 if no questions match the topic

**`PracticeQuiz` updated (backward-compatible):**
- `sessionNumber?: number` (was required) — when undefined, skips session-complete API call and navigates to `completionHref`
- `curriculumSessionId?: string` (was required) — when undefined, omits from attempt POST body (API accepts optional)
- `completionHref?: string` (new) — override redirect on last question; defaults to `/dashboard` for topic practice
- Last-question button: "Hoàn thành luyện tập" when no `sessionNumber`, "Xem kết quả buổi học" otherwise

**Dashboard updated (`/dashboard`):**
- `getPriorityReviewTopic()` replaced by `getAdaptiveRecommendations()` in `Promise.all`
- New "Việc nên làm hôm nay" section renders the top recommendation (index 0) as a styled card
  - Priority 1/2 (urgent): amber border/background + amber CTA button
  - Priority 3/4 (guidance): lexi-soft border/background + lexi-primary CTA button
  - CTA routes: PRACTICE_TOPIC → `/practice/topic/{topic}`, REVIEW_NOTEBOOK → `/error-notebook`, ADVANCE_SESSION → `/practice/{sessionNumber}`
- Notebook due-count banner simplified back to count-only (smart topic messaging now lives in the recommendation card)

**`lib/analytics/index.ts`:** `getPriorityReviewTopic` remains exported (still used by error-notebook page indirectly via `getTopicNotebookSummaries`).

**Test suite: `scripts/test-recommendations.mjs` — 30 tests**

- Test 1: RECURRING_MISTAKE beats WEAKNESS_SIGNAL (deduplication — same topic at tiers 1 and 3 → appears only at tier 1)
- Test 2: DUE_REVIEW — recommendation produced, action is REVIEW_NOTEBOOK, question count populated
- Test 3: CURRICULUM_PROGRESS fallback — empty signals + session → tier 4 with correct session number/title
- Test 4: DUE_REVIEW topic not repeated at tier 3 (deduplication across tier 2 and 3)
- Test 5: RECURRING + dueCount on same topic → only tier 1 (RECURRING_MISTAKE wins)
- Test 6: No next session + no signals → empty recommendations
- Test 7: WEAKNESS_SIGNAL with accuracy ≥ 0.70 is excluded (not urgent enough)
- Test 8: All 4 tiers produced, correct order (RECURRING → DUE_REVIEW → WEAKNESS → CURRICULUM)
- Test 9: Maximum 4 cap enforced (5 signals → 4 recommendations)
- Test 10: Empty signals + session → only CURRICULUM_PROGRESS
- Tests 11-13: `buildQuestionCountMap` — basic counting, uppercase canonicalization, space→underscore normalization

`package.json` script: `"test:recommendations": "node scripts/test-recommendations.mjs"`

**Verified:**
- `npm run test:recommendations` ✓ 30/30 passed
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes — new `/practice/topic/[topic]` added)

**Full test matrix after this milestone:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓
- `npm run test:notebook` → 18/18 ✓
- `npm run test:recommendations` → 30/30 ✓

---

### Milestone 7: Mastery Tracking Foundation (✓ Complete)

Added a derived mastery layer that estimates how well a student has internalized each topic — closing the observation loop from mistake through notebook intelligence to a stable mastery signal.

**Learning signal chain:**
```
QuestionAttempt
  → computeImprovementSignal()   [pre/post review accuracy]
    → TopicNotebookSummary       [aggregated per canonical topic]
      → computeTopicMastery()    [sustained-accuracy estimation]
        → MasteryState           [NEEDS_REVIEW | IMPROVING | STABLE | MASTERED]
```

**New file: `lib/analytics/masteryTracking.ts`**

Pure computation layer. No schema changes, no new DB queries, no writes, no AI.
All data is derived from `TopicNotebookSummary` — which `getTopicNotebookSummaries()` already produces from two existing DB queries.

**`MasteryState` type:**

| State | Meaning |
|---|---|
| `NEEDS_REVIEW` | Struggling, newly logged, or regressed — needs active attention |
| `IMPROVING` | Accuracy rising but below sustained threshold |
| `STABLE` | Consistently performing well across multiple review cycles |
| `MASTERED` | Full spaced-rep cycle complete with high accuracy, or all entries explicitly MASTERED |

**`computeTopicMastery(s: TopicNotebookSummary): MasteryState` — pure function:**

Evaluated in order (first match wins):

| Path | Condition | → State |
|---|---|---|
| 1 | `masteredCount === entryCount && entryCount > 0` | MASTERED |
| 2 | `maxReviewStage ≥ 4` + `IMPROVED` + `postAcc ≥ 0.80` + NOT `isRemedialFlagged` | MASTERED |
| 3 | `IMPROVED` + `postAcc ≥ 0.75` + `maxReviewStage ≥ 2` | STABLE |
| 4 | `maxReviewStage ≥ 3` + `IMPROVING` + `postAcc ≥ 0.70` | STABLE |
| 5 | (`IMPROVED` or `IMPROVING`) + `postAcc ≥ 0.50` | IMPROVING |
| — | everything else | NEEDS_REVIEW |

Remedial flag protection (path 2): topics with `isRemedialFlagged = true` are blocked from the spaced-rep MASTERED path — they must earn entry-level MASTERED individually, because high-recurrence topics need stronger evidence than a single accuracy run.

Single-cycle protection (path 5 vs. path 3): an `IMPROVED` signal with `maxReviewStage < 2` lands at IMPROVING, not STABLE — one good session isn't proven sustained performance.

**`TopicMasteryProfile` interface:**
```typescript
{
  topic: string;        // canonical topic key
  label: string;        // human-readable display label
  masteryState: MasteryState;
  summary: TopicNotebookSummary;  // full underlying data retained for consumers
}
```

**`getTopicMasteryProfiles(userId): Promise<TopicMasteryProfile[]>`**
- Calls `getTopicNotebookSummaries(userId)` (existing) — no new DB queries
- Maps each summary through `computeTopicMastery()` — pure transform
- Returns profiles in the same priority order as `getTopicNotebookSummaries()`

**`countByMasteryState(profiles: TopicMasteryProfile[]): Record<MasteryState, number>`**
- Pure count helper — groups profiles by state
- Intended use: dashboard "N topics mastered" indicator (UI not yet wired)

**Recommendation interaction (unchanged, by design):**
- `getTopicNotebookSummaries()` already excludes topics where `masteredCount === entryCount` (path 1 MASTERED) — so fully explicit MASTERED topics never appear in recommendations today
- Topics reaching MASTERED via path 2 (reviewStage + accuracy) may still appear in recommendations in edge cases — this is the known v1 gap, deferred to Milestone 8 (mastery-aware recommendation filter)
- The mastery module is additive — zero recommendation logic was changed

**`lib/analytics/index.ts` updated:** exports `MasteryState`, `TopicMasteryProfile`, `computeTopicMastery`, `getTopicMasteryProfiles`, `countByMasteryState`.

**Test suite: `scripts/test-mastery.mjs` — 24 tests**

- Explicit MASTERED (path 1): all entries MASTERED
- Spaced-rep MASTERED (path 2): stage 4 + IMPROVED + 0.85 accuracy
- Exact boundary: stage 4 + IMPROVED + exactly 0.80 accuracy → MASTERED
- Remedial protection: `isRemedialFlagged` blocks path 2 even with perfect conditions
- Stage guard: stage 3 + IMPROVED + 0.90 does NOT reach MASTERED (path 2 needs stage 4)
- STABLE path 3: IMPROVED + 0.80 + stage 2; IMPROVED + exactly 0.75 + stage 2
- STABLE path 4: IMPROVING + 0.72 + stage 3; IMPROVING + exactly 0.70 + stage 3
- STABLE NOT triggered: IMPROVED + stage 1 → falls to IMPROVING; IMPROVING + stage 2 → not STABLE
- IMPROVING: IMPROVING + 0.65; IMPROVED + stage 1 (single cycle); IMPROVING + exactly 0.50
- NEEDS_REVIEW: RECURRING; NO_DATA; `lastReviewedAt === null`; `postAcc 0.45` below floor; RECURRING at stage 3 (regression)
- `countByMasteryState`: correct counts across all states; empty input → all zeros

`package.json` script: `"test:mastery": "node scripts/test-mastery.mjs"`

**Verified:**
- `npm run test:mastery` ✓ 24/24 passed
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes unchanged — no new routes added)

**Full test matrix after this milestone:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓
- `npm run test:notebook` → 18/18 ✓
- `npm run test:recommendations` → 30/30 ✓
- `npm run test:mastery` → 24/24 ✓

---

### Milestone 8: Mastery-aware Recommendation v2 (✓ Complete)

Connected the mastery layer into the recommendation decision logic, closing the full analytics integration chain:

```
QuestionAttempt
  → computeImprovementSignal()   [notebook intelligence]
    → computeTopicMastery()      [sustained-accuracy estimation]
      → computeRecommendations() [mastery-aware priority + confidence]
        → PracticeRecommendation [action + confidence surfaced to student]
```

**Modified file: `lib/services/practiceRecommendation.ts`**

**New types:**

- `RecommendationConfidence = "LOW" | "MEDIUM" | "HIGH"` — evidence strength attached to every recommendation
- `confidence: RecommendationConfidence` added to `PracticeRecommendation` interface
- `masteryByTopic?: Map<string, MasteryState>` added as optional field on `RecommendationContext`

**New pure helpers:**

`computeNotebookConfidence(s: TopicNotebookSummary): RecommendationConfidence`

| Condition | Confidence |
|---|---|
| `RECURRING` + `totalOccurrences ≥ 3` | HIGH |
| `isRemedialFlagged` + `entryCount ≥ 2` | HIGH |
| `totalOccurrences ≤ 1` OR `NO_DATA` signal | LOW |
| Everything else (moderate evidence) | MEDIUM |

`computeWeaknessConfidence(accuracy: number): RecommendationConfidence`

| Accuracy | Confidence |
|---|---|
| < 0.50 | HIGH |
| 0.50–0.59 | MEDIUM |
| 0.60–0.69 | LOW |

**`computeRecommendations()` — mastery-aware tier logic (v2):**

| Tier | Signal | MASTERED | STABLE | IMPROVING | NEEDS_REVIEW |
|---|---|---|---|---|---|
| 1 RECURRING_MISTAKE | RECURRING signal | removed | removed | full priority | full priority |
| 2 DUE_REVIEW | dueCount > 0 | removed | deferred to tier 3.5 | full priority | full priority |
| 3 WEAKNESS_SIGNAL | accuracy < 70% | removed | kept (learning opportunity) | full priority | full priority |
| 3.5 STABLE DUE_REVIEW | STABLE + deferred | — | inserted after tier 3, before tier 4 | — | — |
| 4 CURRICULUM_PROGRESS | next session | unchanged | unchanged | unchanged | unchanged |

**Deduplication rule for STABLE topics:** if a STABLE topic qualifies for both the deferred DUE_REVIEW bucket (tier 3.5) and tier 3 WEAKNESS_SIGNAL, WEAKNESS_SIGNAL (PRACTICE_TOPIC) takes priority — practicing is more actionable than reviewing the notebook when accuracy is flagged.

**Backward compatibility:** `masteryByTopic` is optional. When absent or `undefined`, all topics are treated as `NEEDS_REVIEW` — v1 behavior preserved exactly. All 30 existing `test-recommendations.mjs` tests pass unchanged.

**`getAdaptiveRecommendations()` — no extra DB query:**
Mastery is derived inline from the already-fetched `topicSummaries` using `computeTopicMastery()` (pure). No second call to `getTopicNotebookSummaries()`.

```typescript
const masteryByTopic = new Map<string, MasteryState>(
  topicSummaries.map((s) => [s.topic, computeTopicMastery(s)])
);
```

**Test suite: `scripts/test-recommendations-v2.mjs` — 52 tests**

- MASTERED → removed from tier 1 (RECURRING), tier 2 (DUE_REVIEW), tier 3 (WEAKNESS_SIGNAL)
- MASTERED: non-mastered topics in same context unaffected
- STABLE → not shown as RECURRING_MISTAKE
- STABLE DUE_REVIEW deferred: appears after tier-3 WEAKNESS_SIGNAL
- STABLE + weakness signal: WEAKNESS_SIGNAL (PRACTICE_TOPIC) wins over deferred DUE_REVIEW
- STABLE: kept as learning opportunity in tier 3 if only weakness signal present
- IMPROVING + NEEDS_REVIEW: full priority in all tiers (unchanged)
- RECURRING competition: non-STABLE RECURRING topics still win tier 1 when STABLE topics are filtered
- Confidence HIGH/MEDIUM/LOW: all boundary cases for `computeNotebookConfidence()`
- Confidence HIGH/MEDIUM/LOW: all boundary cases for `computeWeaknessConfidence()`
- Confidence attached to recommendations: RECURRING HIGH, weakness HIGH/LOW, CURRICULUM MEDIUM
- Backward compatibility: `masteryByTopic` absent → v1 behavior; `masteryByTopic=undefined` → v1 behavior

`package.json` script: `"test:recommendations-v2": "node scripts/test-recommendations-v2.mjs"`

**Verified:**
- `npm run test:recommendations` ✓ 30/30 (v1 tests unchanged)
- `npm run test:recommendations-v2` ✓ 52/52
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes unchanged)

**Full test matrix after this milestone:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓
- `npm run test:notebook` → 18/18 ✓
- `npm run test:recommendations` → 30/30 ✓
- `npm run test:mastery` → 24/24 ✓
- `npm run test:recommendations-v2` → 52/52 ✓

---

### Milestone 9: StudentLearningProfile — Unified Read Model (✓ Complete)

Created a single aggregation layer that composes all existing intelligence modules into one coherent read model. No new DB queries were introduced; all data is fetched once and shared across mastery derivation and recommendation computation.

**New file: `lib/analytics/studentLearningProfile.ts`**

> **Note on placement:** This file lives in `lib/analytics/` per spec, but is intentionally NOT re-exported from `lib/analytics/index.ts`. It imports from `lib/services/practiceRecommendation` (which imports from `lib/analytics`), so adding it to the barrel would create a circular dependency. Consumers import directly: `import { getStudentLearningProfile } from "@/lib/analytics/studentLearningProfile"`.

**Architecture — full intelligence integration chain:**

```
QuestionAttempt
  → computeImprovementSignal()         [notebookIntelligence.ts]
    → TopicNotebookSummary             [getTopicNotebookSummaries()]
      → computeTopicMastery()          [masteryTracking.ts — pure]
        → TopicMasteryProfile          [masteryProfiles: derived inline, no extra query]
          → computeRecommendations()   [practiceRecommendation.ts — pure, mastery-aware]
            → buildLearningProfile()   [studentLearningProfile.ts — pure assembly]
              → StudentLearningProfile [unified read model]
```

**`StudentLearningProfile` interface — four questions answered:**

| Question | Field | Source |
|---|---|---|
| Where is the student now? | `readiness` | `getSessionAnalytics()` → most recent session |
| | `masterySummary` | `buildMasterySummary()` from mastery profiles |
| | `skillSnapshot` | `getSkillMatrix()` |
| What is improving? | `learningTrend` | `deriveLearningTrend()` (pure) |
| | `improvingTopics` | profiles with IMPROVING or STABLE state |
| What needs attention? | `activeWeaknesses` | `buildActiveWeaknesses()` (pure, capped at 5) |
| What should happen next? | `recommendations` | `computeRecommendations()` (mastery-aware v2) |
| | `nextSessionNumber/Title` | `getCurrentMission()` |

**`MasterySummary`** — counts by state + list of mastered topic labels + up to 5 needs-review labels

**`ActiveWeakness`** — RECURRING signal OR NEEDS_REVIEW mastery state, excluding MASTERED. Carries `signal`, `isRemedialFlagged`, `dueCount`, `masteryState`, `totalOccurrences`. STABLE + RECURRING counts as a weakness (recurring signal overrides mastery state).

**`LearningTrend`** — derived from mastery distribution + recurring count:

| State | Condition |
|---|---|
| `INSUFFICIENT_DATA` | No notebook topics yet |
| `NEEDS_ATTENTION` | `recurringCount > 0` OR `NEEDS_REVIEW > (MASTERED + STABLE + IMPROVING)` |
| `PROGRESSING` | `MASTERED > 0` OR `IMPROVING ≥ NEEDS_REVIEW` |
| `STABLE` | Everything else (balanced, no urgent signals) |

`NEEDS_ATTENTION` evaluates first — recurring mistakes override even an otherwise positive mastery distribution.

**Pure functions (all exported and independently testable):**
- `buildMasterySummary(profiles)` — counts, labels
- `buildActiveWeaknesses(summaries, masteryByTopic)` — priority-ordered, capped at 5
- `deriveLearningTrend(profiles, recurringCount)` — 4-state trend
- `buildLearningProfile(ctx)` — assembles everything from pre-fetched context

**`LearningProfileContext`** — the full pre-fetched input to `buildLearningProfile()`; once all async fetches complete, assembly is purely functional.

**`getStudentLearningProfile(userId)` — single Promise.all, no duplicate queries:**

```
Parallel fetch:
  getTopicNotebookSummaries()  ← base for mastery + recommendations + weaknesses
  getSkillMatrix()             ← skill snapshot
  getCurrentMission()          ← next session
  userSessionProgress.findFirst() ← for analytics lookup
  question.findMany()          ← for questionCountMap

Sequential (if session found):
  getSessionAnalytics()        ← readiness + weakness signals for tier 3

Pure computation (shared data):
  computeTopicMastery() × N    ← mastery profiles, no extra query
  buildQuestionCountMap()      ← question count map
  computeRecommendations()     ← mastery-aware, v2
  buildLearningProfile()       ← assembly
```

Zero duplicate DB queries compared to calling `getAdaptiveRecommendations()` + `getTopicMasteryProfiles()` separately.

**Test suite: `scripts/test-learning-profile.mjs` — 68 tests**

- `buildMasterySummary`: counts, empty input, needsReviewTopics cap at 5
- `buildActiveWeaknesses`: RECURRING included, MASTERED excluded, NEEDS_REVIEW (non-RECURRING) included, IMPROVING/STABLE only (no RECURRING) not included, cap at 5, STABLE + RECURRING is a weakness
- `deriveLearningTrend`: all 4 states; NEEDS_ATTENTION overrides positive mastery when recurringCount > 0
- `buildLearningProfile`: weak topics → NEEDS_ATTENTION, weaknesses populated, improving empty; mastered topics → PROGRESSING, mastered excluded from weaknesses; no data → INSUFFICIENT_DATA, all empty; recommendations passed through with confidence; readiness carried through; skillSnapshot carried through

`package.json` script: `"test:learning-profile": "node scripts/test-learning-profile.mjs"`

**Verified:**
- `npm run test:learning-profile` ✓ 68/68
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes unchanged)

**Full test matrix after this milestone:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓
- `npm run test:notebook` → 18/18 ✓
- `npm run test:recommendations` → 30/30 ✓
- `npm run test:mastery` → 24/24 ✓
- `npm run test:recommendations-v2` → 52/52 ✓
- `npm run test:learning-profile` → 68/68 ✓

---

### Milestone 10: Student Experience Layer v1 (✓ Complete)

Wired `StudentLearningProfile` as the single source of intelligence for the dashboard UI. The student now sees one coherent view rather than separate analytics fragments.

**Architecture shift:**
```
Before:
  dashboard/page.tsx
    ├── getAdaptiveRecommendations()  ← direct service call
    ├── getSkillMatrix()              ← direct service call
    └── getCurrentMission()           ← direct service call

After:
  dashboard/page.tsx
    └── getStudentLearningProfile()   ← unified read model (single call)
          ↓
        StudentLearningSummary        ← UI consumes profile only
```

The dashboard no longer calls analytics, notebook, or recommendation services directly.

**New file: `app/(app)/dashboard/StudentLearningSummary.tsx`**

Server component — receives `StudentLearningProfile`, renders three student-facing sections. No internal enums exposed to the student.

**Section 1 — Vị trí học tập của em**
- Displays `readiness.readinessScore / 10` formatted as X.X/10
- Translates `readiness.band` → student-friendly Vietnamese (e.g. EXAM_READY → "Em đang rất sẵn sàng cho kỳ thi")
- Translates `learningTrend` → Lexi-voice sentence (e.g. PROGRESSING → "Lexi thấy em đang tiến bộ tốt.")
- If no session data yet: encouraging empty state, no score shown

**Section 2 — Lexi đề xuất hôm nay**
- Shows `recommendations[0]` only — one clear action
- `SuggestedAction` → button label (PRACTICE_TOPIC → "Luyện tập ngay", REVIEW_NOTEBOOK → "Ôn lại trong sổ lỗi", ADVANCE_SESSION → "Bắt đầu buổi học")
- `priority ≤ 2` → amber urgent style; otherwise lexi-primary style
- Hidden entirely if `recommendations` is empty

**Section 3 — Bản đồ học tập**
Three groups from profile data, only groups with content shown:
- "Cần chú ý" (amber chips) ← `activeWeaknesses.label[]`
- "Đang cải thiện" (sky chips) ← `improvingTopics` where `masteryState === "IMPROVING"`
- "Đã vững" (emerald chips) ← `improvingTopics` where `masteryState === "STABLE"` + `masterySummary.masteredTopics`

Chips overflow: up to 4 visible per group, "+N chủ đề nữa" for extras. Hidden entirely if no topics exist.

**Vocabulary discipline:** No "yếu", "kém", "sai nhiều", "NEEDS_REVIEW", "MASTERED", "EXAM_READY", or other internal terms surface to the student. All enum values translated at the component boundary.

**`studentLearningProfile.ts` extended:** Added `nextSessionObjective: string | null` to `StudentLearningProfile` and `LearningProfileContext`, populated from `mission.objective` in `getStudentLearningProfile()` — so the dashboard mission card no longer needs a separate `getCurrentMission()` call.

**`dashboard/page.tsx` changes:**
- Removed: `getAdaptiveRecommendations`, `getSkillMatrix`, `getCurrentMission` direct imports
- Added: `getStudentLearningProfile`, `StudentLearningSummary`
- `Promise.all` now fetches: `learnerProfile`, `phaseProgress`, `dueReviewCount`, `todayMoodEntry`, `streak`, `learningProfile` — 6 items vs prior 8, with no duplicate data fetching
- Skill bars now read from `learningProfile.skillSnapshot` instead of a separate `getSkillMatrix()` result
- Mission card reads `nextSessionNumber / nextSessionTitle / nextSessionObjective` from the profile

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes unchanged)
- `npm run test:learning-profile` → 68/68 ✓ (profile pure functions unchanged)

---

### Milestone 11: Learning Journey UI v1 (✓ Complete)

Refactored the results page to consume `StudentLearningProfile` instead of calling analytics, notebook, and recommendation services directly.

**`app/(app)/practice/[sessionNumber]/results/page.tsx`** — full rewrite

**Before:**
```
resolveSessionId()         → validate session
getSessionAnalytics()      → direct analytics call
toSessionAnalyticsResponse()
generateReadinessNarrative()  → narrative layer
generateWeaknessNarrative()   → narrative layer
```

**After:**
```
resolveSessionId()               → validate session (still needed)
getStudentLearningProfile()      → unified read model (parallel with above)
```

Both calls run in a single `Promise.all` — no sequential dependency.

**What the results page now shows:**

1. **Score card** — `profile.readiness.readinessScore / 10` with band badge (`badgeText`) and band-appropriate explanation sentence. Same colour scheme as before. Empty state for new students: warm "Em vừa hoàn thành buổi N!" message.

2. **Lexi reflection bubble** — Always shown. `learningTrend` translated to Lexi-voice Vietnamese. When `NEEDS_ATTENTION`: explicitly points student to the recommendation below.

3. **Đang cải thiện** (optional) — Topic chips for `improvingTopics` where `masteryState === "IMPROVING"`. Shows what's moving in the right direction. Hidden when empty.

4. **Lexi đề xuất tiếp theo** — `recommendations[0]` with `label`, `reason` (always visible — student understands why Lexi chose this), and action button. Amber style for priority ≤ 2. Falls back to "Buổi học xuất sắc!" when `recommendations` is empty.

5. **Footer** — "Luyện buổi N+1 →" primary button, "Hỏi Lexi" and "Về trang chủ" secondary. Unchanged from before.

**Removed from results page:**
- `generateReadinessNarrative` / `generateWeaknessNarrative` calls
- Weakness narrative cards (3 per session focus areas)
- Blueprint section coverage strip
- `getSessionAnalytics` / `toSessionAnalyticsResponse` direct calls
- `BlueprintSectionItem`, `SectionDot` component

**Vocabulary discipline:** same rules as dashboard — no internal enum names exposed, no "yếu"/"kém"/"sai nhiều". `EXAM_READY` → "Sẵn sàng thi", `NOT_READY` → "Đang xây nền".

**Recommendation reason always visible:** `topRec.reason` is rendered for every recommendation, so the student always knows "why Lexi chose this" (e.g. "Em đã gặp dạng này vài lần và đang cải thiện.").

**Data flow (both pages now follow same pattern):**
```
StudentLearningProfile
    ├── dashboard/page.tsx       → StudentLearningSummary
    └── results/page.tsx         → inline rendering
```

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes unchanged)

---

### Milestone 12: Learning Experience Polish v1 (✓ Complete)

UX continuity improvements across the student learning loop. No new intelligence, no schema changes — presentation layer only.

**Three files changed. No new data calls introduced.**

---

#### 1. `StudentLearningSummary.tsx` — Always show a clear next action

**Problem:** When `recommendations` is empty (new student, no error notebook data), the action section disappears entirely. Student sees position card → nothing → (optional map). No "what to do now."

**Fix: `SessionMissionCard` component** — renders when `topRec === null`. Uses `profile.nextSessionNumber` and `profile.nextSessionTitle` from the read model.

- If `nextSessionNumber` is set → "Việc nên làm hôm nay: Buổi N: [title]" + "Bắt đầu buổi học" button → `/practice/N`
- If both null (completely new account, no curriculum yet) → "Bắt đầu hành trình: Hãy bắt đầu buổi luyện tập đầu tiên!" + "Bắt đầu buổi 1" button

Result: `StudentLearningSummary` now always renders an action card. The action is either the smart recommendation or the curriculum mission — never nothing.

**Also:** Improved `LearningPositionSection` empty-state text. Before: "Em mới bắt đầu — cứ học từng buổi..." (too vague). After: "Em mới bắt đầu hành trình. Hoàn thành một buổi luyện tập để Lexi hiểu được trình độ của em và đưa ra nhận xét chính xác hơn nhé." (explains the value, sets expectation).

---

#### 2. `results/page.tsx` — Completion reflection with progress signal

**Problem:** Page went straight to score card. No visual confirmation "you just completed something." No per-session progress signal in the trend bubble.

**Fix 1: Completion banner** — first element on page: `"✓ Buổi N · Hoàn thành"` as an emerald pill. Low height, no box — just a clear marker.

**Fix 2: `trendMessagePostSession()`** — separate function from dashboard's `trendMessage()`. Same trend enum, but session-aware phrasing:
- `PROGRESSING` + risingTopics > 0 → "Buổi luyện tập này đã giúp em tiến bộ — Lexi thấy em đang đi đúng hướng!"
- `PROGRESSING` + no rising topics → "Buổi luyện tập này rất tốt. Lexi thấy em đang tiến bộ!"
- `STABLE` → "Em đang duy trì tốt. Tiếp tục luyện đều đặn..."
- `NEEDS_ATTENTION` → "Có một số nội dung em có thể chú ý thêm — Lexi đã gợi ý bên dưới."
- `INSUFFICIENT_DATA` → "Em vừa hoàn thành một buổi! Cứ tiếp tục..."

**Fix 3: Progress signal** — inside the Lexi bubble, after the trend message:
```
{risingTopics.length} chủ đề đang đi đúng hướng.
```
Shown only when `risingTopics.length > 0`. Gives a concrete number, doesn't expose "IMPROVING" enum.

---

#### 3. `dashboard/page.tsx` — Skill bars empty state

**Problem:** When `skillSnapshot` is empty (new student with no sessions), the "Tiến độ kỹ năng" section header renders but its content area is blank — an invisible nothing.

**Fix:** Added conditional render:
- If `skillSnapshot.length > 0` → render bars as before
- If empty → "Hoàn thành buổi luyện tập đầu tiên để xem tiến độ theo từng kỹ năng của em nhé."

---

#### Empty state audit result

| Location | Before | After |
|---|---|---|
| Dashboard position card (new student) | "Em mới bắt đầu — cứ học từng buổi" | "Em mới bắt đầu hành trình. Hoàn thành một buổi để Lexi hiểu trình độ..." |
| Dashboard action card (no recommendation) | Hidden | `SessionMissionCard` — always shows next session |
| Dashboard skill bars (no data) | Blank section | Encouraging text with call-to-action |
| Results page top | Score card (no context) | Completion banner + score card |
| Results page Lexi bubble | Generic trend message | Session-aware message + rising topic count |
| Results page (no recommendation) | "Buổi học xuất sắc! Hãy tiếp tục..." | Unchanged (already warm) |

**Vocabulary discipline maintained:** no "yếu", "kém", "IMPROVING", "NEEDS_REVIEW", "INSUFFICIENT_DATA" ever visible to student.

**Verified:**
- `npx tsc --noEmit` ✓ clean
- `npm run build` ✓ clean (35 routes unchanged)

---

### Phase 1 Polish: Topic Alias Audit + Mid-Exam Prompt (✓ Complete — 2026-06-25)

#### Topic Alias Audit

Ran `SELECT DISTINCT topic FROM "Question"` against dev.db (2026-06-25). Found 73 distinct topic values.

**Real variant discovered:** `present_perfect_since_for` and `present_perfect_for_since` both exist in the live data — same concept, different word order. Added alias `present_perfect_since_for → present_perfect_for_since`.

**Critical bugs fixed in `TOPIC_ALIASES`:** The pre-audit table contained speculative aliases that redirected real canonical DB topics to non-existent targets:
- `present_simple → tenses_present_simple` — WRONG (DB uses `present_simple` as canonical)
- `past_simple → tenses_past_simple` — WRONG (DB uses `past_simple` as canonical)
- `present_perfect → tenses_present_perfect` — WRONG (DB uses `present_perfect` as canonical)
- `sounds → phonetics_sounds`, `stress → phonetics_stress`, `word_stress → phonetics_stress` — WRONG (DB uses `ch_sound`, `th_sound_voiced_voiceless`, `word_stress_two_syllables` etc. as canonicals; `phonetics_sounds`/`phonetics_stress` don't exist)

These would have silently broken analytics grouping for the most common grammar topics. All removed.

Retained safe aliases: relative_clause variants, conditional variants, passive voice shortforms.

**File changed:** `lib/analytics/canonicalTopic.ts` — aliases now explicitly audit-dated with instructions for future updates.

#### Mid-Exam Attention Prompt

Added a 5-second attention-reset prompt shown when a MOCK_EXAM session (sessions 22–24) reaches question 21.

**Implementation (pure client-side):**
- `PracticeQuiz` gains optional `sessionType?: string` prop (backward-compatible — no existing call site breaks)
- `handleNext` triggers the prompt when `nextIndex === 20 && sessionType === "MOCK_EXAM"`
- A `useEffect` countdown (5 → 1) auto-dismisses after 5 seconds; student can also dismiss early
- Prompt text: "Nửa chặng đường rồi! Hít thở một chút. Kiểm tra tốc độ của em nhé."
- Practice `page.tsx` passes `session.sessionType` down to `PracticeQuiz`

**Files changed:** `app/(app)/practice/[sessionNumber]/PracticeQuiz.tsx`, `app/(app)/practice/[sessionNumber]/page.tsx`

---

### Phase 1 — COMPLETE (2026-06-25)

**Key architectural decisions (frozen):**
- Three-layer analytics: Repository (DB queries) → Engine (pure compute) → Narrative (text generation)
- Canonical topic normalization via `canonicalTopic()` function + `TOPIC_ALIASES` map (phase 2 → database-driven)
- `scoreAchieved` uses 0.0–1.0 convention (proportion, not percentage)
- Pattern observation threshold: N=2 tutor-only, N≥3 student-visible
- CoverageDepthScore measures depth per section relative to exam expectations
- Score display: X.X/10 navigation signal, not a grade. No raw engine intermediates exposed.

**Final test matrix:**
- `npm run test:analytics` → 24/24 ✓
- `npm run test:narrative` → 37/37 ✓
- `npm run test:results` → 31/31 ✓
- `npm run test:notebook` → 18/18 ✓
- `npm run test:recommendations` → 30/30 ✓
- `npm run test:mastery` → 24/24 ✓
- `npm run test:recommendations-v2` → 52/52 ✓
- `npm run test:learning-profile` → 68/68 ✓
- **Total: 284/284 ✓**

`npx tsc --noEmit` ✓ clean · `npm run build` ✓ clean (35 routes)

## 10. Recommended Next Priorities

1. **Phase 1 — COMPLETE** (2026-06-25)
   - ✓ Milestone 1: Readiness analytics foundation
   - ✓ Milestone 2: Session context tracking (schema + routes)
   - ✓ Milestone 3: Analytics repository layer
   - ✓ Milestone 4/4b/4c/4d: Service, exam blueprint, API contract layer
   - ✓ Milestone 5a–5c: Narrative + results page + validation
   - ✓ Milestone 5d: Error notebook intelligence
   - ✓ Milestone 6: Adaptive practice recommendation
   - ✓ Milestone 7: Mastery tracking foundation
   - ✓ Milestone 8: Mastery-aware recommendation v2
   - ✓ Milestone 9: StudentLearningProfile unified read model
   - ✓ Milestone 10: Student experience layer v1 (dashboard)
   - ✓ Milestone 11: Learning journey UI v1 (results page)
   - ✓ Milestone 12: Learning experience polish v1
   - ✓ Polish: Topic alias audit (73 topics audited, bugs fixed, real variant added)
   - ✓ Polish: Mid-exam attention prompt at Q21 for MOCK_EXAM sessions

2. After Phase 1 ships:
   - Add OCR for IMAGE sources in `extractor.ts` (currently a placeholder string)
   - Add admin/registration path (currently only seeded student/admin exist)
   - Provision Postgres instance and test schema swap
   - Browser-test full flow manually

3. Phase 2:
   - Recovery rate as readiness score component (requires data quality confirmation from real students)
   - Topic Registry database table (when `TOPIC_ALIASES` grows past 60 entries)
   - Analytics snapshot caching for tutor dashboard (multiple students)

4. **(Blocked/Deprioritized) Gemini real-output verification** — investigation closed. Do not test another key without independently confirming nonzero quota on Google's dashboard ([ai.dev/rate-limit](https://ai.dev/rate-limit)). Revisit only with new external information or if `ANTHROPIC_API_KEY` becomes available.
