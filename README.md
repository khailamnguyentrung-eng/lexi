# Lexi

AI English coach for a Hanoi grade-10 entrance exam student. Next.js (App
Router, TypeScript) + Prisma + a multi-provider AI layer (Gemini / Claude /
Mock). See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for the full
architecture/schema/feature overview.

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with
`student@lexi.local` / `lexi1234` (or your `STUDENT_*` overrides, see below)
for the student app, or `admin@lexi.local` / `lexi-admin-1234` (or your
`ADMIN_*` overrides) for `/admin/content-import`.

## AI provider setup

Lexi's chat and admin content-import normalization both go through the same
`AIProvider` abstraction (`lib/ai/providers/`), which supports three
providers — pick one with `AI_PROVIDER` in `.env`:

| `AI_PROVIDER` value | Needs | Notes |
|---|---|---|
| `gemini` (recommended) | `GOOGLE_GEMINI_API_KEY` | **Free tier** — get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Default model: `gemini-2.0-flash` (override with `GEMINI_MODEL`). |
| `anthropic` | `ANTHROPIC_API_KEY` | Paid only, no free tier. Get a key at [console.anthropic.com](https://console.anthropic.com/). |
| `mock` | nothing | Clearly-labeled canned demo replies — no AI cost, no network calls. |

**If `AI_PROVIDER` is left unset**, Lexi auto-detects: Gemini first (if
`GOOGLE_GEMINI_API_KEY` is set), then Claude, then falls back to Mock.

**If `AI_PROVIDER` names a provider whose key is missing** (e.g.
`AI_PROVIDER=gemini` with an empty `GOOGLE_GEMINI_API_KEY`), Lexi falls back
to Mock automatically — it never lets a request fail because of a missing
key. Every place an AI call happens shows this transparently:
- The chat page banner shows the exact reason (e.g. "AI_PROVIDER=gemini
  nhưng GOOGLE_GEMINI_API_KEY chưa được cấu hình — dùng Mock").
- The admin content-import "Chạy mẫu AI" and dry-run panels show which
  provider + model actually ran, what was requested, and the fallback
  reason if they differ.

### Example `.env` for Gemini (recommended — free tier)

```bash
AI_PROVIDER="gemini"
GOOGLE_GEMINI_API_KEY="your-key-from-aistudio.google.com"
# GEMINI_MODEL="gemini-2.0-flash"   # optional override
```

### Example `.env` to run with no AI at all (Mock only, zero cost)

```bash
AI_PROVIDER="mock"
```

Everything except chat replies and content-import AI normalization works
identically regardless of provider — dashboard, practice, error notebook,
progress, and the content-import upload/extract/validate/review/approve
flow are all provider-independent.

## Content import workflow (`/admin/content-import`)

Admins ingest real exam documents through this page — never by hand-writing
JSON. The flow:

1. **Upload** a DOCX/PDF/image, optionally with exam metadata: **Tỉnh/TP**
   (province), **Năm** (exam year), **Loại đề** (exam type, e.g.
   `official_exam`/`mock_exam`/`practice`), **Lớp** (grade level), **Môn**
   (subject), and a free-text **Nhãn nguồn** (source name/label, e.g.
   "Hanoi Entrance Exam 2025"). All metadata is optional and stored on
   `ContentSource`; every `ImportJob` for that file is linked to it via
   `contentSourceId`, so the metadata doesn't need to be duplicated anywhere.
2. **"Chạy mẫu AI" (5-question sample test)** — run extraction + AI
   normalization + validation on just the first 5 questions before
   committing to the whole document. Shows a full run report (provider,
   model, input size, output count, valid/invalid, retries, timing — see
   below) plus a checklist: 3 items are checked automatically (JSON schema,
   no missing options, no duplicate question codes); 2 items
   ("giữ đúng tiếng Việt gốc" and "đáp án/giải thích đúng với nguồn") need
   the admin to read the source text and the AI draft side by side — these
   are judgment calls a script can't make reliably, so the UI is explicit
   about that rather than pretending otherwise.
3. **"Chạy thử toàn bộ đề bằng AI (dry run)"** — same idea at full scale:
   chunks the document by exam section, normalizes + validates every chunk,
   reports the same metrics, and **never writes anything to the database**
   (no `ImportJob`, `ExtractedQuestionDraft`, or `Question` row). Pure
   preview before a real run.
4. **Review and approve** — only after a real (non-dry-run) extraction,
   each AI-produced draft becomes an `ExtractedQuestionDraft` with
   `PENDING_REVIEW` (valid) or `REJECTED` (failed validation, with the
   reason shown). Only a human clicking "Duyệt" creates a real `Question`
   row — nothing upstream of that click can.

### Every AI normalization run reports

Shown in the UI (chat banner, sample test, dry run) — never an API key:

- **provider** (`gemini` / `claude` / `mock`) and **model**
- whether this is a **fallback** and **why** (e.g. requested provider's key
  missing)
- **chunks processed**, **input size** (chars), **output question count**
- **valid** / **invalid** counts (post-validation)
- **retry count** (how many times the JSON-repair prompt was needed)
- **processing time**

### Organizing source files outside the app

The app only ever receives files through the upload form above — nothing
is hardcoded into the repository. If you're collecting exam PDFs/DOCX
files before uploading them, a suggested *local-only* folder structure
(not part of this repo, just a personal organization scheme) is:

```
LEXI_DATA/
  exams/
    Vietnam/
      Hanoi/
        2025/
        2024/
      HaiPhong/
        2025/
```

This is purely a filing convention for your own filesystem — keep it
wherever you like outside the project. There is no project-side dependency
on this structure; every file still goes through the admin upload form.

## All environment variables (`.env`)

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | SQLite file path locally (`file:./dev.db`); Postgres connection string in production |
| `NEXTAUTH_SECRET` | Login | Any random string; NextAuth JWT signing secret |
| `NEXTAUTH_URL` | Login | Base URL, e.g. `http://localhost:3000` |
| `AI_PROVIDER` | AI features | `gemini` \| `anthropic` \| `mock`. See above. |
| `GOOGLE_GEMINI_API_KEY` | Gemini only | Free tier — see above |
| `GEMINI_MODEL` | Optional | Override the Gemini model (default `gemini-2.0-flash`) |
| `ANTHROPIC_API_KEY` | Claude only | Paid — see above |
| `STUDENT_EMAIL` / `STUDENT_PASSWORD` / `STUDENT_NAME` | Optional | Override the seeded student's login at `npm run db:seed` time |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Optional | Override the seeded admin's login — the only account that can reach `/admin/content-import` |

All AI-related keys can be left empty — the app runs fully on Mock with zero
cost and zero network calls. That's an intentional, supported state, not a
bug.
