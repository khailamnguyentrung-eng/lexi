# YouPass.vn Research & LEXI Integration Plan

**Status:** Research only. No implementation. No schema changes. No code written.
**Purpose:** Understand how youpass.vn (Vietnamese IELTS self-study platform) is built and operates, then identify which of its patterns are worth adapting into LEXI.

---

## Part 1: What YouPass Is

YouPass is a Vietnamese **online IELTS self-study platform**, launched August 2023, built by the team behind **IELTS 1984** ("Tám Bốn"), an established offline IELTS training center in Ho Chi Minh City. It is not a standalone startup — it's a digital spin-off of an existing offline teaching business, monetizing that brand's credibility online.

**Target user:** Vietnamese IELTS candidates who want a cheaper, more flexible alternative to in-person coaching, but still want access to real teacher feedback and structured content — not just a free practice app.

**Confidence:** Confirmed (press coverage: Tiền Phong, vanhoavaphattrien.vn; site copy).

---

## Part 2: Frontend / UX (partial — site was bot-protected, so this is copy-derived, not visually inspected)

**Information architecture observed:**
```
/                                          — marketing homepage
/thi-thu-ielts                             — free mock test / Reading practice hub
/khoa-hoc-ielts-elearning-youpass          — course catalog
/youpass-premium                           — premium tier marketing
/youpasspro-cham-bai-khong-gioi-han        — "PRO" unlimited AI-grading upsell page
/course/{id}/{slug}                        — individual course detail (curriculum, price, enroll)
/bai-viet/kien-thuc-nen-tang-ielts/...     — SEO blog / knowledge base
/hanh-trinh-hoc-ielts-cung-youpass         — student testimonial/journey wall (paginated)
/luyen-thi/ielts/...-collect-review-de-thi-that — crowdsourced "real exam question" archive
```

**Named features (confirmed to exist, UI details not observed):**
- **"Smart Dashboard"** — progress tracking across skills
- **AI Writing grading tool** — submit an essay, get an automated band-score estimate + revision suggestions
- **Mock test interface** — timed, exam-format practice
- **Retry-limited practice** — free/PRO tiers differ by *how many times* you can re-submit for AI grading (3 / 5 / 15 attempts depending on plan length)

**Community/support layer:** Zalo Official Account + Facebook group — typical for Vietnamese consumer products; support and retention happen partly off-platform, not just in-app.

**Design language (colors, density, layout):** Unknown — could not render the live site.

---

## Part 3: User Workflow (inferred from feature copy)

1. **Discovery** — SEO blog content, Facebook groups, YouTube, or referral from IELTS 1984's existing offline students.
2. **Free hook** — user tries free Reading/Listening practice or a mock test, low/no signup friction.
3. **AI Writing hook** — user submits a Writing Task 1/2 essay, gets instant AI score + feedback. This is the flagship differentiator called out repeatedly in press coverage.
4. **Dashboard check-in** — "Smart Dashboard" shows skill-by-skill performance.
5. **Monetization trigger** — free AI grading attempts run out (rate-limited by design) → upsell to:
   - **PRO** (200k–750k VND) — self-serve, unlimited(-ish) AI grading, no teacher
   - **Paid courses** (~2.2M–4M VND) — structured curriculum + teacher-led 1-1 Q&A + weekly reports
6. **Core loop** — practice → AI/teacher feedback → dashboard check → repeat, punctuated by periodic mock tests to benchmark band score.
7. **Retention hooks** — weekly reports, mentor Q&A (paid tier), community groups, continuously refreshed "real exam question" content (crowdsourced from students right after they sit the real test).

**Key mechanic worth noting:** the monetization lever is not content-gating — it's *attempt-gating*. Free users can see and try everything; they just can't retry a graded submission infinitely. This is a lighter-touch paywall than "pay to unlock this content."

---

## Part 4: Backend (confirmed via job postings — this is the most reliable data in this research)

| Layer | Technology |
|---|---|
| Backend languages | Go, Python |
| Databases | PostgreSQL + MongoDB (polyglot) |
| Messaging/queues | RabbitMQ, Kafka — implies async job processing (likely AI grading runs as a queued job, not sync request/response) |
| Observability | Elasticsearch + Fluentd + Kibana (EFK stack) |
| Cloud | AWS + DigitalOcean |
| Frontend framework | Unknown (not retrievable) |
| AI Writing tech | Unknown — could be a wrapped commercial LLM, a fine-tuned model, or rules-based scoring marketed as "AI" |
| Native mobile app | Unconfirmed — job listings say "potentially mobile," suggesting it may not exist yet |

**Team structure:** three pillars — Tech Team, Teaching Team, Operations & Marketing Team. This split matters: YouPass isn't purely automated — human teachers are a first-class part of the product, not a legacy afterthought.

---

## Part 5: Business Model (confirmed, pricing partially confirmed)

**Freemium EdTech**, three tiers:

| Tier | Price | What you get |
|---|---|---|
| Free | 0 | Reading/Listening/partial Writing practice, mock tests, crowdsourced real-exam-question archive |
| PRO | 200k–750k VND (14d/1mo/3mo) | Unlimited-ish AI grading retries, no teacher involvement |
| Courses | ~2.2M–4M VND | Structured curriculum, 1-1 teacher Q&A, weekly progress reports, personalized study plan |

**Funding:** Likely bootstrapped as a spin-off of the existing offline IELTS 1984 business, not VC-funded (inference, not confirmed).

**Named competitors** (from a Facebook comparison post): DOL.vn, Study4.com, Mini-IELTS.com.

---

## Part 6: Inferred Data Model

Not confirmed — reconstructed from observed feature set, for structural comparison purposes only:

```
User, Subscription/Entitlement, Course, CourseModule/Lesson, Enrollment,
PracticeItem/Question, Attempt/Submission, AIGradingResult (with sub-scores:
Task Achievement, Coherence, Lexical Resource, Grammar), MockTest/MockTestResult,
Teacher/Mentor, WeeklyReport, Testimonial, Payment/Transaction
```

This is a standard LMS + freemium-SaaS schema shape — notably **simpler** than LEXI's current schema in the intelligence layer (no equivalent to LEXI's LearnerModel, SM-2 spaced repetition, behavior engine, or learning signals appears to exist at YouPass). YouPass's sophistication is concentrated in **AI grading + monetization gating**, not in adaptive learning intelligence.

---

## Part 7: What YouPass Does That LEXI Doesn't — Mapped to LEXI's Architecture

| YouPass capability | LEXI today | Gap / Opportunity |
|---|---|---|
| **AI-graded open-ended writing** (essay in → band score + feedback out) | LEXI is 100% MCQ (`Question.type` has 8 enum values, all objective/closed-form). No free-text answer evaluation exists anywhere in the schema or AI layer. | This is the single biggest capability gap. Nothing in LEXI's `AIProvider` interface, chat modes, or Lens pipeline evaluates open-ended writing against a rubric. Would need a new `WritingSubmission` model + a new AI evaluation flow. |
| **Retry-limited freemium gating** (attempts, not content, are the paywall) | LEXI has no monetization/tier concept at all — no `Subscription`/`Entitlement` model, no Role beyond STUDENT/PARENT/TUTOR/ADMIN (which is access-role, not payment-tier). | If LEXI ever monetizes, YouPass's "gate the retries, not the content" pattern is worth copying — it's less punishing than a hard paywall and still creates upgrade pressure. |
| **Teacher-in-the-loop tier** (1-1 Q&A, weekly reports, mentor-authored feedback) | LEXI's `User.role` includes TUTOR, but no tutor-facing UI, no mentor-assignment model, no weekly report generation exists. This role is schema-present but functionally unused. | LEXI already has the schema seed (`Role.TUTOR`) for this. A "weekly report" feature could reuse `StudentLearningProfile` — it's already a point-in-time snapshot generator, just needs a scheduled digest + tutor delivery surface. |
| **Mock test as a distinct, timed, exam-simulating experience** | LEXI has `SessionType.MOCK_EXAM` and a mid-exam breathing-break UX already built (`PracticeQuiz.tsx`), but no visible countdown timer or exam-clock pressure simulation in what was read. | Minor — LEXI is closer here than in any other row. Worth confirming whether a timer exists; if not, it's a cheap addition to an already-built session type. |
| **Crowdsourced "real exam questions" content loop** | LEXI's content pipeline is admin-upload-driven only (`ContentSource` → `ImportJob` → review → approve). No student-submitted content path exists. | Interesting but higher-risk for LEXI's target age group (grade 9 students, not adults) — crowdsourcing exam content from minors raises different guardrails than an adult IELTS audience. Lower priority. |
| **Community layer (Zalo/Facebook) for retention** | LEXI has no external community integration. | Out of scope for a webapp architecture review — this is a marketing/ops decision, not a backend one. |
| **Async job queue for grading** (Kafka/RabbitMQ) | LEXI's Lens AI calls are synchronous request/response (`/api/lens-ai/assist` calls the AI provider inline). | If LEXI adds writing evaluation (which is inherently slower/heavier than MCQ scoring), a queue becomes necessary — a Kafka/RabbitMQ-style async job is standard practice for LLM-graded submissions, to avoid blocking the request thread and to allow retry-on-failure. |

---

## Part 8: What LEXI Already Does Better

Worth stating plainly, since this is a two-way comparison:

- **Adaptive intelligence.** LEXI's 5-engine `LearnerModel` (knowledge, performance, behavior, preference, problem-solving), SM-2 spaced repetition schema, and `learningSignalEngine` have no YouPass equivalent found in this research. YouPass's dashboard is a **reporting** surface; LEXI's is (or is architected to be) a **predictive/adaptive** one.
- **Curriculum sequencing.** LEXI has a structured `CurriculumPhase → CurriculumSession` model driving what a student does next. YouPass appears to be closer to "browse a course catalog and pick one" — less sequenced guidance.
- **Content intelligence (Phase 3).** LEXI's `KnowledgeUnit` + gap analysis + AI question generation pipeline is a more mature content-supply system than anything observed at YouPass (which appears to rely on manually authored courses + crowdsourced questions).

---

## Part 9: Recommended Integration Plan (highest-leverage first)

This is a plan for discussion, not an implementation order — sequencing should be confirmed with you before any brainstorming/spec work begins.

### Option A — Add open-ended writing evaluation (biggest capability gap)
- **What:** New question/interaction type where a student writes a free-text answer (sentence transformation, paragraph, or essay) and gets AI-graded feedback, similar to YouPass's Writing AI.
- **Why it fits LEXI:** LEXI already has `QuestionType.SENTENCE_TRANSFORMATION` as a *closed-form* type — this suggests writing-style output is already a design intent, just not yet AI-evaluated as free text.
- **Architecture impact:** New model (e.g., `WritingSubmission`), new AI provider method (e.g., `evaluateWriting()` alongside existing `generateQuestions()`), likely an async job pattern given LLM grading latency.
- **Risk:** Needs a queue since grading is not sub-second like MCQ scoring; needs careful rubric design since grade-9 students ≠ IELTS adult candidates (different exam, different band system — Vietnamese THPT exam doesn't use IELTS bands).

### Option B — Activate the dormant TUTOR role
- **What:** Give `Role.TUTOR` a real surface: assign students to a tutor, generate weekly digest reports from `StudentLearningProfile`, allow tutor comments.
- **Why it fits LEXI:** The schema already has the role. `getStudentLearningProfile()` already produces a rich enough snapshot to summarize into a weekly report with no new intelligence needed — just a new consumer of existing data.
- **Architecture impact:** Low — mostly new UI + a scheduled digest job + a `TutorAssignment` join model.

### Option C — Freemium/entitlement layer
- **What:** Introduce a subscription tier concept, gate by *attempts* (Lens AI calls, chat messages, writing evaluations) rather than by content, following YouPass's model.
- **Why it fits LEXI:** LEXI has no monetization concept today. This is a prerequisite if the product intends to charge, but is **not urgent** unless monetization is on the near-term roadmap.
- **Architecture impact:** Medium — new `Subscription`/`Entitlement` models, rate-limiting middleware on AI-calling routes (this also happens to fix Architecture Risk 7 from the earlier audit — no rate limiting on `/api/lens-ai/assist`).

### Option D — Timed mock-exam clock
- **What:** Add a visible countdown timer to `SessionType.MOCK_EXAM` sessions to simulate real exam pressure.
- **Why it fits LEXI:** Cheapest item on this list — `PracticeQuiz.tsx` and `SessionType.MOCK_EXAM` already exist; this is additive UI, not new architecture.

---

## Part 10: Suggested Discussion Order

1. **Is monetization on the roadmap at all?** This gates whether Option C matters now or can be deferred indefinitely. If LEXI stays free/personal-use, skip C entirely.
2. **Is open-ended writing evaluation (Option A) something the Hà Nội THPT exam format even needs?** IELTS has a Writing section with essays; the THPT English exam (grade 9's actual target, per `LearnerProfile.targetExam = "hanoi_thpt_2027"`) is primarily multiple-choice and short transformation — worth confirming whether free-text AI grading is actually exam-relevant for LEXI's real target, or whether it's borrowing a feature that doesn't map to the target exam's format.
3. **Tutor role (Option B)** is the lowest-risk, highest-reuse option — it activates existing schema and existing intelligence with the least new surface area. Good candidate for "next thing to build" if you want quick, low-risk value.
4. **Mock exam timer (Option D)** — near-zero cost, can be bundled into any other work without a separate design cycle.

---

## Part 11: In-App Practice Experience — Feature-by-Feature Detail

A second research pass focused specifically on what happens *during* practice/study usage (not marketing pages). youpass.vn blocks automated fetching site-wide (every URL attempted returned HTTP 403), so everything below is reconstructed from Google-indexed snippets, the official `@youpass.vn` Threads account, and independent reviewer posts — not first-party screenshots. Confidence labeled per item.

### 1. Reading practice — *partially confirmed*
Interface described by multiple users as closely resembling the real computer-based IELTS test ("giống thi máy"), covering standard question types (MCQ, True/False/Not Given, Form Completion, Map Labeling). Detailed per-question answer explanations are provided, including where in the passage the answer is located. A "**Reading Pro Max**" sub-feature offered per-sentence explanations via a dedicated button after finishing a set, plus in-passage word lookup (highlight → translation/usage/examples) — but this sub-feature is **currently suspended for a redesign** (confirmed via its own subdomain, which loaded despite the main domain being blocked). Whether the base Reading mode is timed by default, and whether feedback is instant or delayed, is unconfirmed.

### 2. Listening practice — *partially confirmed*
Standard mode mirrors the real test. A distinct paid feature, "**YouPass Listening Builder**," deliberately withholds the answer after submission and instead walks the student through a "STANDARD Framework" to find the right answer and spot audio traps ("bẫy") themselves — a guided, delayed-feedback design, not instant-reveal. Mock-test mode applies real exam timing with raw-score→band conversion. Audio controls (replay limits, speed) and transcript availability: unconfirmed.

### 3. Writing practice (flagship AI grading) — *confirmed core mechanics, partially confirmed UI*
- Task 1 and Task 2 are separate flows, each including built-in "hướng dẫn" (structural writing guidance), not a blank editor.
- Grading references "Task Response/Achievement" and "Coherence & Cohesion" explicitly; "4 tiêu chí" (4 criteria) is mentioned generally, consistent with all 4 official IELTS Writing criteria, but no single source names all 4 sub-scores together — the full breakdown is inferred, not directly confirmed.
- Self-reported accuracy ~±0.5 band vs. real examiners; user reports are mixed (Task 2 close, Task 1 off by up to 1.5–1.75 bands in some complaints).
- Feedback philosophy stated as "HỌC – LUYỆN – SỬA" (learn–practice–revise) — implies explanation/error-identification, not just a raw score. Inline-annotation vs. summary-report presentation is unconfirmed.
- **Pricing mechanic — a real in-app currency:** grading costs are spent using points called "**Đậu**" (pun on "pass"), earned by completing tasks; each Writing grading costs **15 Đậu**. Unlimited Writing+Speaking AI is bundled into "YouPass PRO" (~300,000 VND/month). A separately-described tiered scheme (3/5/15 revisions on 14-day/1-month/3-month plans) doesn't fully reconcile with the Đậu system in the sources found — likely two overlapping/sequential pricing models from different time periods. Timer and live word-count display: unconfirmed.

### 4. Speaking practice — *confirmed to exist*
YouPass Speaking AI is real, not just marketing — independently confirmed by a third-party reviewer: "format y như giám khảo thật. Có feedback chi tiết theo 4 tiêu chí chấm thi IELTS" (format just like a real examiner, detailed feedback by IELTS criteria). Covers all 3 Speaking parts, sources questions from recent real tests, and comments on Pronunciation, Grammar, and Vocabulary specifically (whether all 4 official IELTS Speaking criteria — including Fluency & Coherence — are scored individually is unconfirmed). Bundled into the same PRO subscription as Writing. Recording/mic UI, Part 2 prep-timer: unconfirmed.

### 5. Full mock test mode — *partially confirmed*
Explicitly designed to mirror the real exam for timed-pressure practice; a `quiz_type=mocktest` URL parameter exists for Listening specifically. The free "giao diện thi thật" (real-exam-style interface) was confirmed by YouPass's own account as free but still being actively refined ("có đôi chỗ chưa mượt mà" — rough edges remain). Whether Reading/Listening/Writing/Speaking combine into **one continuous 4-skill exam session** (like real IELTS test day) vs. separate per-skill mock modules is not confirmed — inference leans toward separate per-skill flows rather than one unified simulation. End-of-test combined band scoring: unknown.

### 6. Vocabulary/grammar tools — *partially confirmed*
A "Vocabulary Notebook" exists — highlight a word during Reading to get translation/usage/examples, save for later review. Sourced from a competitor-comparison post, not YouPass's own marketing, so robustness is uncertain. No evidence of spaced-repetition scheduling, flashcard decks, or standalone grammar drills — these appear absent as distinct features. Vocabulary support seems folded into Reading practice rather than being a standalone tool.

### 7. Progress dashboard — *confirmed to exist, partially confirmed contents*
"Smart Dashboard" is repeatedly referenced as letting learners "track progress and adjust study plans." Concretely documented: attempt history ("lịch sử làm bài"), a visible Đậu points balance, time-spent tracking, and count of tests taken. One less-reliable (AI-paraphrased) source additionally claims per-question-type error tracking. No band-score-history chart was explicitly confirmed, though it's plausible given the "adjust study plan" framing.

### 8. Gamification — *partially confirmed*
The Đậu points currency (earn by completing tasks, spend on AI grading) is a real, confirmed gamification-adjacent mechanic. A "**YouPass Challenge**" campaign is referenced in official copy, framed around building a self-study habit — suggesting a periodic challenge event exists. No confirmed persistent streaks, badges, or leaderboards inside the core practice UI — classic gamification elements appear to be **absent or unconfirmed**, unlike some competitors (e.g., HeyWord, which does streaks/trees/weekly charts).

### 9. Review/history — *partially confirmed*
Attempt history is confirmed as a dashboard feature. Listening Builder functions as an explicit error-pattern review tool (walks through *why* an answer was wrong). A less-reliable snippet claims tracking of incorrect questions/question types for Reading/Listening. No explicit "redo only what I got wrong" mode was confirmed in any source — plausible but unverified.

### 10. AI chatbot / conversational tutor — *unknown, likely does not exist*
No evidence found of a general-purpose conversational AI assistant (e.g., a chat window for open-ended grammar/vocab questions) separate from the Writing and Speaking graders. All AI interaction found is submission-based (write/speak → get graded), not conversational. This is LEXI's `/chat` Teacher mode's closest YouPass equivalent, and YouPass appears not to have one.

### Practice-feature confidence summary

| Area | Confidence |
|---|---|
| Reading | Partially confirmed |
| Listening | Partially confirmed |
| Writing AI grading | Confirmed (core), partially confirmed (UI/exact sub-scores/pricing) |
| Speaking AI | Confirmed to exist, partially confirmed on detail |
| Full mock test | Partially confirmed |
| Vocabulary/grammar tools | Partially confirmed (vocab notebook only; no grammar drills found) |
| Progress dashboard | Confirmed to exist, partially confirmed on contents |
| Gamification | Partially confirmed (points currency + occasional challenge events; no streaks/badges/leaderboard found) |
| Review/history | Partially confirmed |
| AI chatbot tutor | Unknown — likely does not exist |

### What this changes in Part 7's gap table

Two additions to the original comparison, now that practice-level detail is available:

- **Speaking AI evaluation is a second capability LEXI has zero equivalent of** (beyond Writing, called out in Part 7). LEXI has no audio/speech input pipeline anywhere in its architecture (`lib/ai/`, `lib/services/`) — this would be a larger lift than Writing evaluation, requiring speech-to-text plus a pronunciation/fluency scoring model.
- **YouPass's points-based "Đậu" currency is a gamification pattern LEXI doesn't have**, distinct from a subscription tier (Option C in Part 9). It's a lighter-weight, task-completion-driven currency rather than a hard paywall — worth considering as an alternative to (or layer on top of) a pure subscription model if LEXI ever gates AI-heavy features (Lens, chat) by usage.
- **LEXI's `/chat` Teacher mode has no YouPass equivalent** — this is a point in LEXI's favor, not a gap. YouPass's AI interactions are all submission-graded, not conversational.

---

## Caveats on This Research

- youpass.vn blocked direct automated fetching (bot protection); all findings are derived from Google-indexed search snippets and third-party sources (press, job boards), not direct site inspection.
- Visual design (colors, layout, exact screen flows) could not be verified — described only where marketing copy named a feature.
- Pricing figures are indicative (drawn from search snippets), not pulled from a live pricing page.
- The "AI Writing" grading technology (which LLM/model, if any) is unconfirmed.
