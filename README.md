# LEXI

> An adaptive learning system that answers one question for a learner, every day, correctly:
> **"What should I do next, and why?"**

LEXI turns what a learner *does* into what the system should *suggest they do next* — continuously,
grounded in evidence, without ever pretending to know more than it does. Today it coaches a Hanoi
grade-10 entrance-exam student; the architecture is built so that scope is never structurally
hard-coded. Next.js (App Router, TypeScript) + Prisma + a multi-provider AI layer (Gemini / Claude /
Mock).

---

## Mission

Not "what is available." Not "what would you like to talk about." **One** recommended action,
grounded in evidence about what this specific learner has and hasn't mastered, that moves them
measurably closer to their goal. LEXI is a *learning system with an AI component* — never an AI
product with a learning skin. Full product constitution: [`docs/LEXI_FOUNDATION.md`](docs/LEXI_FOUNDATION.md).

---

## Architecture

LEXI's design is a **frozen Baseline** — discovered, validated across seven domains, and audited
against the implementation. Its spine is one closed loop:

```
Evidence  ─►  Understanding  ─►  Recommendation  ─►  Communication Boundary  ─►  Learner
 (fact)       (belief, always     (one suggestion,      (fidelity: nothing         │
   ▲           confidence-          never a command)      added or lost on the way) │
   └───────────  qualified) ──────────────────────────────────────────────────────┘
                          the learner's response becomes new Evidence
```

Four frozen chapters define it, all in [`docs/LEXI_SYSTEM.md`](docs/LEXI_SYSTEM.md):

| Chapter | Answers |
|---|---|
| **Ch.1 — Learning Domain Model** | What exists in the learning world? (ontology) |
| **Ch.2 — Learning Engine** | What does the system believe about the learner? |
| **Ch.3 — Decision Policy** | Given belief, what does it suggest? |
| **Ch.4 — Communication Boundary** | When an artifact reaches a consumer, is its authority preserved? |

Five-minute tour of the whole shape: [`docs/HOW_INFORMATION_FLOWS.md`](docs/HOW_INFORMATION_FLOWS.md).

---

## Documentation

All documentation lives in [`docs/`](docs/). Three documents form LEXI's DNA — read them in order:

| Document | Answers | Authority |
|---|---|---|
| [`LEXI_FOUNDATION.md`](docs/LEXI_FOUNDATION.md) | *Why LEXI exists* | Philosophy |
| [`LEXI_SYSTEM.md`](docs/LEXI_SYSTEM.md) | *How LEXI is built* | Architecture & Ontology |
| [`LEXI_ENGINEERING_CONSTITUTION.md`](docs/LEXI_ENGINEERING_CONSTITUTION.md) | *How LEXI is developed* | Engineering Governance |

Supporting maps: [`DOCUMENT_HIERARCHY.md`](docs/DOCUMENT_HIERARCHY.md) (authority ladder, authoritative
vs derived), [`BASELINE_ARCHITECTURE.md`](docs/BASELINE_ARCHITECTURE.md) (system map),
[`GLOSSARY.md`](docs/GLOSSARY.md), [`SYSTEM_INVARIANTS_MATRIX.md`](docs/SYSTEM_INVARIANTS_MATRIX.md).
Living status is [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md); the full historical record is
under [`docs/archive/`](docs/archive/).

---

## Getting Started

The dev database is SQLite — zero external services required.

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # create the local dev database from migrations
npm run db:seed             # seed curriculum, questions, and demo accounts
npm run dev                 # http://localhost:3000
```

Seeded logins: **student@lexi.local** / **lexi1234** (student app), and
**admin@lexi.local** / **lexi-admin-1234** for `/admin/content-import` (override with `STUDENT_*` /
`ADMIN_*` env vars at seed time).

> This project targets a customized build of Next.js — read the relevant guide under
> `node_modules/next/dist/docs/` before writing framework code (see [`AGENTS.md`](AGENTS.md)).

### AI provider

Chat and admin content-import normalization go through one `AIProvider` abstraction
(`lib/ai/providers/`). Pick one with `AI_PROVIDER` in `.env`:

| `AI_PROVIDER` | Needs | Notes |
|---|---|---|
| `gemini` (recommended) | `GOOGLE_GEMINI_API_KEY` | **Free tier** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Default model `gemini-2.0-flash` (`GEMINI_MODEL` to override). |
| `anthropic` | `ANTHROPIC_API_KEY` | Paid — [console.anthropic.com](https://console.anthropic.com/). |
| `mock` | nothing | Clearly-labeled canned replies — no cost, no network. |

If unset, LEXI auto-detects (Gemini → Claude → Mock); if a named provider's key is missing it falls
back to Mock automatically and shows the reason in the UI — a request never fails for a missing key.
Everything except chat replies and content-import normalization is provider-independent.

### Content import (`/admin/content-import`)

Admins ingest real exam documents here — never by hand-writing JSON. AI extraction/normalization
produces **drafts**, never live questions; validation auto-rejects malformed drafts; and **only a
human clicking "Duyệt" creates a real `Question`**. This human review gate is load-bearing
(Constitution 5.8 — verification independent of generation) and nothing upstream of that click can
bypass it. A 5-question sample run and a full dry-run (writes nothing to the DB) let admins preview
before a real import; every run reports provider, model, counts, retries, and timing.

### Environment variables (`.env`)

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | SQLite locally (`file:./dev.db`); Postgres in production |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Login | JWT signing secret; base URL (e.g. `http://localhost:3000`) |
| `AI_PROVIDER` | AI features | `gemini` \| `anthropic` \| `mock` |
| `GOOGLE_GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini | Free tier; optional model override |
| `ANTHROPIC_API_KEY` | Claude | Paid |
| `STUDENT_*` / `ADMIN_*` | Optional | Override seeded account logins |

All AI keys may be left empty — the app runs fully on Mock at zero cost. That's a supported state,
not a bug.

---

## Current Status

**`architecture-v1`** — the first fully **discovered, validated, reconciled, and stabilized**
architecture.

- **Architecture:** Constitution + Chapters 1–4 frozen; Discovery closed with **no** new chapter forced.
- **Conformance:** every implemented surface audited against the Baseline. Zero open implementation
  drift (the two found — D1, D2 — reconciled and verified on the running product).
- **Governance:** the Engineering Constitution and the full architecture corpus are preserved in
  version history.

On every audited surface the specification and the implementation have **not** diverged — the
Baseline behaves as a real operational specification, not decorative design.

---

## Roadmap

```
Phase 1    Foundation                   ✓  why LEXI exists
Phase 2    Architecture                 ✓  Ch.1–4, discovered & validated
Phase 2.5  Repository Stabilization     ✓  audit, reconciliation, history preserved
           ── architecture-v1 (tag) ──
Phase 3    Product Evolution            →  recommendation, learning activities,
                                           conversation evidence, knowledge graph,
                                           AI teaching — built on a proven foundation
```

---

## Contributing

Before your first PR, read — in order — [`LEXI_FOUNDATION.md`](docs/LEXI_FOUNDATION.md),
[`LEXI_SYSTEM.md`](docs/LEXI_SYSTEM.md), and
[`LEXI_ENGINEERING_CONSTITUTION.md`](docs/LEXI_ENGINEERING_CONSTITUTION.md).

The Engineering Constitution is not a style guide — it is how LEXI is required to be built and
changed, each principle tied to the real event that earned it (e.g. *"absence is a distinct state,
never a value"*; *"never amend the Baseline to legitimize an implementation"*). When code and the
frozen Baseline disagree, **the Baseline wins and the code is fixed** — never the reverse.
Documentation belongs in `docs/`. Repository history is architectural evidence: commits describe real
states the project occupied — never split or rewritten to manufacture a cleaner story.
