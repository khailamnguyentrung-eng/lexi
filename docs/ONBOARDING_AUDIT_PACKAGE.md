# LEXI — Onboarding Audit Package

> **Purpose:** test whether the documentation itself — not the people who wrote it — can transfer
> the architecture to someone who did not participate in its discovery. This is the gate between
> "Baseline v1 + Ch.4 is architecturally correct" and "Baseline v1 + Ch.4 is ready for Ch.5
> discovery to build on." Not a style review. A reviewer who "reads and gives feedback" has not
> taken this audit — a reviewer who completes the five tasks below has.
>
> **The real target: two stacks, not one.** It is not enough for a reviewer to reconstruct the
> **architectural stack** (Evidence → Understanding → Recommendation → Communication Boundary).
> They must also reconstruct the **normative stack** (Constitution → System chapters → derived
> docs) and know which one wins when they seem to disagree. Reciting a Ch.2 fact ("Conflict ≠
> Ignorance") is not the same as understanding that Ch.2 *exists to enforce* Constitution 5.2/5.10
> — a reviewer who only has the former has memorized a fact; a reviewer who has the latter can
> reason about a *new* case the docs never spelled out. This package tests for the second kind.
>
> **Status:** process document, not part of the authoritative or derived documentation chain. It
> tests the chain; it is not a link in it. Not added to `DOCUMENT_HIERARCHY.md`.
>
> **This is a Type 1 (onboarding) audit instrument — human reviewers only.** Round 1 (2026-07-10)
> was run against three AI systems instead. All three could not stay closed-book — once an LLM has
> the answer key in the same context, it cannot compartmentalize "what I've seen" from "what I'm
> allowed to have seen" the way a human can choose not to re-read a page. That isn't a discipline
> failure on the model's part; it's a property of the protocol colliding with how LLM reasoning
> works. See `ARCHITECTURE_RETROSPECTIVE.md` §6a for the full writeup, including **Type 2
> (consistency audit)** — a different, legitimate exercise where full context is an asset, not a
> violation, and where the AI-reviewer round actually produced value (findings B1/B2 below). **Do
> not re-run this package against an AI reviewer expecting Type 1 evidence** — if a full-context
> AI reviewer is wanted, that's Type 2, and should be asked for directly as a consistency sweep, not
> disguised as this onboarding package.
>
> **Round 1 status: Baseline PASS / Full PASS claimed, but not valid Type 1 evidence** (closed-book
> condition was violated by all three AI reviewers). **Per `BASELINE_CERTIFICATION.md` (2026-07-10),
> this audit is a target of opportunity, not a blocking gate — Ch.5 discovery may proceed without
> it.** Run it whenever a genuinely fresh reader (see the certification doc for the concrete
> candidate already identified) is available; the result still matters, it just no longer holds up
> the roadmap.

---

## Resolved: the Reviewer Kit gap from the first draft

The first draft of this package excluded `LEXI_FOUNDATION.md` from the kit. **Resolved: it is
included.** Not because the audit-script questions need it (they could technically be answered
from Ch.4's own summary of the Constitution) — but because of what the audit is actually for.

Two different tests were on the table:
- **Model A — "Is Ch.1–4 self-sufficient?"** A valid question, but not the one this gate is
  supposed to answer.
- **Model B — "Can a new person onboard via the *actual published* reading order?"** This is the
  one that matters here. `DOCUMENT_HIERARCHY.md` — itself part of the kit — names the real reading
  order, and it includes the Constitution. A kit that quietly diverges from the project's own
  stated reading order isn't testing the real onboarding path; it's testing a path built to be
  convenient for the audit.

The deeper reason: the Constitution is not architecture, but it *is* the normative ground truth
architecture exists to serve. A reviewer who reads only Ch.2 and reports "Conflict and Ignorance
are different" has learned a fact. A reviewer who has also read Constitution 5.2/5.10 and can
explain *why* Ch.2 needed to keep them distinct — because the Constitution's "never sound more
certain than the evidence" test doesn't by itself catch a certainty-*kind* error — has learned the
relationship. Only the second kind of understanding generalizes to a case the docs never wrote
down explicitly.

---

## Part 1 — Reviewer Kit

**Give the reviewer exactly these files, nothing else — this is the project's own published
reading order (`DOCUMENT_HIERARCHY.md`), not a shortened version built for the audit:**

- `docs/HOW_INFORMATION_FLOWS.md`
- `docs/BASELINE_ARCHITECTURE.md`
- `docs/LEXI_FOUNDATION.md`
- `docs/LEXI_SYSTEM.md` (all four chapters)
- `docs/DOCUMENT_HIERARCHY.md`

**Do not give them:**
- This audit package itself, or any hint of what will be asked.
- Chat logs, discovery transcripts, or any record of *how* the architecture was arrived at.
- `GLOSSARY.md`, `SYSTEM_INVARIANTS_MATRIX.md`, or `ADR-001` — these are aids for someone already
  navigating the system, not part of what a first-time reader is expected to need. If the reviewer
  asks for a glossary and the base kit can't answer without one, that itself is a finding (a term
  used before it's adequately introduced).
- Any member of the team available to answer questions *during* the reading. Confusion must be
  written down, not resolved in the moment — a question answered live never shows up as a
  documentation gap.

**Reviewer profile:** someone technically capable of reading precise, formal writing (an engineer,
a technical PM, a formally-trained reader), but with **zero prior exposure** to LEXI. If everyone
available has already absorbed context informally, the audit is compromised before it starts —
this is worth waiting for the right person over running it early with the wrong one.

**Time-box:** give a generous but finite window (e.g. 90 minutes) for reading, then run the tasks
below without letting them re-read indefinitely — a document that only works given unlimited
re-reading time has a real usability problem even if it's technically complete.

---

## Part 2 — Audit Script

Closed-book, short-answer questions with a **fixed correct answer**, scorable without judgment.
Administer *after* reading, no notes access. For each wrong or vague answer, log which document/
section *should* have made the answer obvious, and how the reviewer actually did answer.

| # | Question | Correct answer (source) |
|---|---|---|
| 1 | Understanding authority nằm ở đâu — chapter nào tính "learner biết gì"? | Chỉ Ch.2 (Learning Engine). Không chapter nào khác được tự suy luận lại capability. *(Ch.2 §2.1; ADR-001 D2)* |
| 2 | Decision Policy (Ch.3) có được phép tự tính lại mastery từ Evidence thô không? | Không. Chỉ đọc Understanding qua contract; được đọc Evidence trực tiếp *chỉ* cho thông tin Understanding cố tình không mang (timestamp, lặp lại, mệt mỏi) — không bao giờ để tái tạo belief. *(Ch.3 §3.2)* |
| 3 | Khi learner phản hồi một Recommendation (chấp nhận/bỏ qua/làm khác), điều gì trở thành Evidence? | Chính phản hồi đó. (Việc *phát hành* Recommendation cũng đã tự log Evidence riêng, tại thời điểm publish — hai sự kiện Evidence khác nhau.) *(Ch.1 Invariant 12; Ch.3 §3.1 Lifecycle)* |
| 4 | Ch.4 (Communication Boundary) sở hữu semantic mới nào? | Không semantic nào. Chỉ sở hữu một *relation* (representation re-expresses artifact) và một lifting invariant (F1) bảo toàn semantic đã có sẵn ở chapter khác. *(Ch.4 §4.1)* |
| 5 | Ch.4 có tạo ra artifact mới không? | Không — đây là kết quả được *chứng minh* (test), không phải giả định. *(Ch.4 opening, Chapter Scope)* |
| 6 | Bản thân Constitution có phân biệt được trạng thái "Conflict" và "Ignorance" của Understanding không? | Không trực tiếp — Constitution 5.10 chỉ kiểm tra *mức độ* chắc chắn, không phân biệt *loại* thiếu chắc chắn. Sự phân biệt Conflict/Ignorance là construct riêng của Ch.2 §2.7. *(Ch.4 §4.3, "Why F1 is irreducible to the Constitution")* |
| 7 | Recommendation có phải là một mệnh lệnh (command) không? | Không — luôn là một đề xuất; learner luôn có thể bỏ qua, và việc bỏ qua vẫn có hiệu lực + được ghi Evidence. *(Ch.3 §3.1 Inv 1, §3.3 Inv 5; Constitution 5.4)* |
| 8 | Evidence có bao giờ bị hệ thống sửa hoặc xoá không? | Không — append-only tuyệt đối bởi hệ thống. Ngoại lệ duy nhất là quyền xoá của chính learner (Constitution 5.9) — cơ chế cụ thể chưa được định nghĩa, thuộc về Data Architecture (chưa viết). *(Ch.1 Inv 4; Ch.2 Reconstructability Scope)* |
| 9 | Ai là người duy nhất có quyền đánh dấu một Goal là "đã đạt" hay "bỏ dở"? | Chỉ Learner. Hệ thống chỉ có thể *recommend* việc đó, không bao giờ tự chuyển trạng thái. *(Ch.1 §9; BASELINE_ARCHITECTURE §9 Finding B)* |
| 10 | Một Learner có thể có nhiều Goal cùng một lúc không? | Có — có thể nhiều, hoặc không có Goal active nào. *(Ch.1 Design Stance 4; Ch.3 §3.2)* |
| 11 | Ch.4 có quyết định *có nên* gửi thông báo tới learner hay không, hoặc *giọng điệu* ra sao không? | Không — đó là Communication Policy, dời sang Phase 3, chưa viết. Ch.4 chỉ giữ fidelity của cái *đã* được quyết định gửi. *(Ch.4 §4.1, §4.5)* |
| 12 | Một implementation có thể thoả mãn *toàn bộ* Constitution 5.2/5.3/5.8/5.9/5.10 mà vẫn vi phạm F1 (Ch.4) không? | Có — đây là kết quả Irreducibility: re-expression biến "Conflict" (92 quan sát mâu thuẫn) thành câu nói giống hệt "Ignorance" (chưa có bằng chứng) vẫn qua được mọi clause Constitution, nhưng vi phạm F1. *(Ch.4 §4.3)* |
| 13 | Data Architecture, Content Architecture, và Identity/Account layer đã được viết chưa? | Chưa — cả ba đều "not started", nằm ngoài Baseline v1. *(BASELINE_ARCHITECTURE §7, §9)* |
| 14 | Recommendation được sinh ra từ đâu (input nào)? | Understanding + active Goal(s) + Pathway/Content khả dụng — không bao giờ trực tiếp từ Evidence thô. *(Ch.1 §3.4; Ch.3 §3.1 Producer)* |
| 15 | Nếu `GLOSSARY.md` (derived) và một chapter đã FROZEN trong `LEXI_SYSTEM.md` (authoritative) mâu thuẫn nhau, cái nào đúng? | Chapter FROZEN luôn đúng — derived doc chỉ phản chiếu, không bao giờ định nghĩa; nếu lệch, đó là bug của derived doc. *(DOCUMENT_HIERARCHY.md, "The single governing rule")* |
| 16 | Nếu một thiết kế trong `LEXI_SYSTEM.md` muốn "bẻ cong" một principle của Constitution để thuận tiện hơn, điều gì phải xảy ra? | Constitution thắng — phải được nêu như một amendment proposal công khai, không được âm thầm lách qua trong System. *(`LEXI_SYSTEM.md` header, "Constraint")* |

**Pass threshold (proposed, adjustable):** ≥ 14/16 correct on first attempt, closed-book. Every
miss — not just misses beyond the threshold — gets logged with its source-document gap; a passing
score does not mean skip logging the misses. Questions 15–16 test the **normative stack**
specifically (which document wins when two disagree) — a miss here is a different kind of gap than
a miss on 1–14 (architectural stack) and should be logged separately.

---

## Part 3 — Reconstruction Task

### 3a. Normative stack (which document governs which)

**Give the reviewer this blank scaffold:**

```
   ?
   ↓
   ?
   ↓
   ?
```

**Instruction:** "Based on what you read, what are the three levels of documents in LEXI, from
most to least authoritative? What happens if a lower level contradicts a higher one?"

**Canonical answer:**
```
Constitution (LEXI_FOUNDATION.md)     — why / never; changes rarely, only by deliberate revision
   ↓ constrains
System chapters (LEXI_SYSTEM.md Ch.1–4) — what exists / what's believed / what's suggested / what
                                           survives the crossing; each FROZEN, amendable only
   ↓ reflected by
Derived docs (BASELINE_ARCHITECTURE, GLOSSARY, SYSTEM_INVARIANTS_MATRIX, DOCUMENT_HIERARCHY,
HOW_INFORMATION_FLOWS)                  — maps and indexes; regenerated, never authoritative
```
If a lower level ever contradicts a higher one, **the higher level wins and the lower one has a
bug** — this must be stated by the reviewer, not just the three-level list, to count as a pass.

### 3b. Architectural stack (the dataflow pipeline)

**Give the reviewer this blank scaffold, nothing filled in:**

The strongest test in the package, because it cannot be gamed by matching keywords — the reviewer
must produce structure, not recognize it.

**Give the reviewer this blank scaffold, nothing filled in:**

```
Learner
   ↓
   ?
   ↓
   ?
   ↓
   ?
   ↓
   ?
   ↓
Learner
```

**Instruction to reviewer:** "Fill in the four steps between the learner acting and the learner
seeing a result, based only on what you read. Use your own words if you don't remember the exact
terms."

**Canonical answer:**
```
Learner acts
   ↓
Evidence
   ↓
Understanding
   ↓
Recommendation
   ↓
Communication Boundary
   ↓
Learner sees something
```

**Bonus (optional, +1 signal, not required for pass):** ask them to also draw the return arrow —
what happens after the learner responds. Correct: the response becomes new Evidence, re-entering
at step 1. A reviewer who draws this unprompted is strong evidence the loop-closure framing landed.

**Scoring is diagnostic, not just pass/fail** — a wrong answer points at a specific gap:

| What the reviewer draws instead | What it reveals |
|---|---|
| Skips "Understanding" (Evidence → Recommendation directly) | The documents did not make clear that a Recommendation is never computed straight from raw Evidence — the belief step got lost. |
| Skips "Communication Boundary" | Ch.4 didn't register as a distinct step — likely read as part of Recommendation or an implementation detail, not a boundary the docs actually name. |
| Inverts Understanding/Recommendation order | The prescriptive-vs-descriptive distinction (Ch.3 opening) didn't land. |
| Invents an extra node (e.g. "AI", "Database", "Dashboard") | Reviewer is reasoning from assumed generic app architecture, not from what the docs actually define — a sign the docs didn't feel authoritative enough to override prior mental models. |

---

## Part 4 — Boundary Audit

Give the reviewer a short list of features/scenarios, one at a time, and ask **only**: *"Which
chapter (or 'not yet architected,' or 'explicitly forbidden') owns this?"* No discussion, no
hints. Compare against the answer key; any mismatch is a wording problem in whichever chapter's
boundary was supposed to make the answer obvious.

| # | Feature/scenario | Correct classification |
|---|---|---|
| 1 | "Congratulations" animation when a learner answers correctly | Communication Policy — deferred, Phase 3, not yet written. (Not Ch.2/Ch.3: neither owns *whether/how* to celebrate.) |
| 2 | Scheduling a reminder notification to nudge a learner back | Communication Policy — deferred, Phase 3. (Not Ch.3: Decision Policy decides *what* to recommend, not *when/whether* to push a notification.) |
| 3 | An "Evidence inspector" screen showing a learner their own raw attempt history | Crosses the Communication Boundary (Ch.4) — its *fidelity* is governed there. The screen itself (rendering, layout) is Experience — not yet written. |
| 4 | Displaying a mastery estimate as a bare percentage, e.g. "87%" | Touches Ch.2 (Understanding is the source) *and* Ch.4 (the representation must not imply more certainty/finality than the belief-confidence actually carries — a bare "87%" may already fail F1 if it hides Ignorance/Conflict). |
| 5 | Deciding when a topic is "due for review" (spaced repetition timing) | Ch.2 §2.8 (Decay — certainty weakens over time) feeding Ch.3 (a Recommendation with `Intent = review`). Not a new chapter. |
| 6 | A teacher's dashboard showing a student's Recommendation history | Crosses the Communication Boundary (Ch.4) as any consumer does — teacher dashboards are a named example. Teacher *write*-authority (assigning work) is explicitly **not modeled** (BASELINE_ARCHITECTURE §9 Finding C) — a **read-only** dashboard is already free. |
| 7 | Deleting a learner's account and all associated data | **Not yet architected** — Constitution 5.9 states the right; the mechanism is explicitly deferred to a future Data/Identity layer (BASELINE_ARCHITECTURE §9 Finding A). |
| 8 | A learner sets their own goal, e.g. "pass the exam by June" | Ch.1 — a `Goal`, owned exclusively by the Learner. |
| 9 | Ranking learners against each other on a leaderboard | **Explicitly forbidden** — Constitution §9 Non-Goals (social network / peer comparison), not a placement question at all. A reviewer who tries to *place* this rather than *reject* it has missed a non-goal, not a chapter. |
| 10 | The AI asking a clarifying Socratic question instead of answering directly | Governed by Constitution §7 (AI Philosophy — AI orchestrates/explains, doesn't originate truth) at the philosophy level; at the architecture level this is Recommendation `Intent` shaping (Ch.3), not a new mechanism. |

**Reading the result:** if the reviewer's classifications match this table, the chapter boundaries
are legible from the text alone. Any systematic miss (e.g. everyone routes "reminder scheduling"
to Ch.3) means that chapter's Freeze Scope / "what this chapter does NOT do" section needs a
sharper explicit exclusion — the same kind of fix as the `LEXI_EXPERIENCE.md` citation issue found
in the editorial audit.

---

## Part 5 — Reviewer Exercise (the highest bar: can they review, not just read?)

Everything above tests **comprehension** — did the documentation transfer knowledge? This part
tests something stronger: **did it transfer review discipline** — the ability to *find* a
documentation defect without ever having seen the discovery process that would make it obvious.

Parts 1–4 confirm a new person can *learn* the architecture. This part confirms a new person could
eventually *help maintain* it — which is the actual precondition for opening Ch.5 without
accumulating documentation debt from day one, since Ch.5 will itself eventually need review from
people who didn't build it either.

**Method:** give the reviewer one short excerpt below — styled exactly like a real passage from the
docs, but with **exactly one planted editorial error**, modeled on real bugs this project already
found and fixed (see the editorial-audit history). Do **not** tell them an error exists — ask them
to review the excerpt "as if for a documentation audit." Use a **different** excerpt each time this
package is re-run with a new reviewer, so no one is ever tested against a bug a previous reviewer
already flagged.

> **Excerpt A (models the "stale count" bug):**
> *"Before building any feature, check it against the following eight questions, in priority order.
> If a feature passes all eight, build it. If it fails one, either redesign it to pass, or bring the
> tradeoff to the founder explicitly."* [followed by a numbered list of 9 items]
>
> **Planted error:** the list has 9 items; the prose says "eight" twice. **Correct find:** the count
> is stale — probably left over from before a later item was added — same shape as the real "all
> nine" bug in `LEXI_FOUNDATION.md` §8, fixed 2026-07-10.

> **Excerpt B (models the "wrong invariant list" bug):**
> *"A Recommendation's non-binding character is fixed by §3.1 Invariant 1; the learner's override
> remaining effective is likewise guaranteed by §3.1 Invariant 5."*
>
> **Planted error:** the second citation is wrong — override-effectiveness is a **Policy**
> invariant (§3.3 Invariant 5 in the real chapter), not a **Recommendation-artifact** invariant
> (§3.1's own list, whose Invariant 5 is actually "Issuance is Evidence"). **Correct find:** the
> excerpt conflates two independently-numbered invariant lists belonging to two different sections
> of the same chapter — same shape as the real `ADR-001` D3 / `SYSTEM_INVARIANTS_MATRIX` row-5.4
> bug, fixed 2026-07-10.

> **Excerpt C (models the "cites a file that doesn't exist" bug):**
> *"How the companion phrases this recommendation to the learner is defined in
> `LEXI_COMMUNICATION_POLICY.md`, which specifies tone, urgency framing, and escalation rules."*
>
> **Planted error:** `LEXI_COMMUNICATION_POLICY.md` is cited as if it already exists and has
> content, but Communication Policy is explicitly **deferred to Phase 3, not yet written**
> (`LEXI_SYSTEM.md` Ch.4 §4.5; `BASELINE_ARCHITECTURE.md` §7). **Correct find:** a reader following
> this citation would go looking for a file that isn't there — same shape as the real
> `LEXI_EXPERIENCE.md` bug, fixed 2026-07-10.

**Scoring:**
- **Full pass:** reviewer identifies the specific defect *and* explains why it's wrong (not just
  "this looks off") *and* proposes the same kind of fix (correct the count / correct the citation /
  flag the file as unwritten) — without being told what to look for.
- **Partial pass:** reviewer flags "something is inconsistent here" but can't pin down what, or
  fixes the surface symptom without naming the underlying category (stale count vs miscitation vs
  dangling reference).
- **Fail:** reviewer reads the excerpt as unremarkable.

A **full pass here, on top of a PASS on Parts 1–4**, is the strongest signal available that the
baseline has reached genuine self-maintaining maturity — a new person can not only learn the
architecture from its own documentation, but participate in keeping that documentation honest,
using the same discipline this project used to build it.

---

## Running the audit and reading the result

1. Hand over the kit (Part 1). Time-box the read.
2. Run the audit script (Part 2), closed-book. Score it; log every miss with its source gap.
3. Run the reconstruction tasks (Part 3a, 3b). Compare structurally, not just for keyword match.
4. Run the boundary audit (Part 4), one item at a time, no discussion between items.
5. Run the reviewer exercise (Part 5), one excerpt, no hint that an error exists.
6. Compile every logged gap into a single findings list: *document, section, what was asked, what
   the reviewer produced, what the gap implies.*

### PASS / FAIL

Two tiers, because Part 5 tests something qualitatively different from Parts 1–4:

- **Baseline PASS (ready for Ch.5 discovery)** — both reconstructions (3a normative, 3b
  architectural) match their canonical shape (wording may vary, structure may not), boundary
  classifications match the key, and the audit script clears its threshold (≥14/16). → **Open Ch.5
  discovery.** No need to revisit Ch.1–4.
- **Full PASS (self-maintaining maturity)** — Baseline PASS, *and* a full pass on the Part 5
  Reviewer Exercise. This is a stronger claim than "ready for Ch.5" — it says the documentation can
  produce reviewers, not just readers. Worth recording as its own milestone if achieved, separate
  from the Ch.5-readiness gate.
- **FAIL** — any structural miss in either reconstruction, any systematic boundary
  misclassification, or the audit script misses cluster around one chapter. → **Do not open Ch.5.**
  Fix the documentation at the specific section each finding points to. **Do not touch semantics,
  authority, ontology, contracts, or invariants unless a finding proves the ambiguity is not
  resolvable by wording alone** — the same discipline the editorial audit already ran on. Re-run
  the audit with a *different* fresh reviewer after fixes — never the same reviewer twice, since
  they are no longer a first-time reader the second time. (A miss confined to Part 5 alone, with a
  clean Baseline PASS on Parts 1–4, does **not** block Ch.5 — it only means "not yet
  self-maintaining," a separate and lesser finding.)

---

*This package tests the documentation, not the architecture. A FAIL here is evidence the writing
needs work; it is not, by itself, evidence any frozen chapter is wrong.*

---

## Addendum — candidate findings carried over from Round 1 (AI, Type 2 evidence), pending human confirmation

Round 1's AI reviewers, once they drifted into Type 2 (consistency review), surfaced two
candidates worth having the eventual human reviewer specifically watch for — **neither is
confirmed, neither has been fixed, both are deliberately left as-is to avoid overfitting the
documentation to an AI reader instead of a human one:**

- **B1 — Recommendation issuance vs. Learning Activity origin.** Disposition: **future-proofing
  question, not a bug.** Ch.1 Invariant 10 requires every Evidence record to originate from exactly
  one Learning Activity; Invariant 12 requires a Recommendation's issuance to be logged as Evidence.
  No frozen chapter currently claims a Recommendation is ever issued *outside* a Learning Activity
  (e.g. a push notification sent while the learner isn't engaged with anything) — if that never
  happens, there's no conflict. It only becomes a live proof obligation if/when a future feature
  needs out-of-activity issuance. **Do not resolve this preemptively** — it belongs to whatever
  future chapter actually introduces that capability.
- **B2 — "authoritative core" (Ch.4's central boundary term) is never formally defined** in any
  frozen chapter. Disposition: **credible documentation-completeness candidate.** Everyone who
  lived through Ch.4's discovery reads it as shorthand for the closed Evidence→Understanding→
  Recommendation loop, which is exactly why no one drafting the chapter noticed it was never
  spelled out. **Action: ask the real human reviewer, unprompted, whether they hit this term and
  what they took it to mean — if they stumble on it independently, fix it with a one-sentence
  definition (in Ch.4 §4.1 or `GLOSSARY.md`); if they don't, leave it alone.**
