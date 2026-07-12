# LEXI Engineering Constitution

> **What this is.** Not architecture, not specification, not a style guide. This is the
> **engineering culture** of LEXI — the discipline every contributor follows when they change the
> code. It is institutional memory: each principle below was *earned* during the discovery and
> conformance work, not copied from a book, and each names the real event that produced it.
>
> **Who this is for.** An engineer who is about to open a PR against LEXI. It answers one question
> the other documents do not: *"When I touch this code tomorrow, how am I required to think?"*
>
> **Where it sits.** Three documents form LEXI's DNA, read in this order:
>
> | Document | Answers |
> |---|---|
> | `LEXI_FOUNDATION.md` | *What LEXI believes* (the Constitution — product principles) |
> | `LEXI_SYSTEM.md` (Ch.1–4) | *How LEXI is built* (ontology, engine, policy, boundary) |
> | **`LEXI_ENGINEERING_CONSTITUTION.md`** | *How LEXI is developed* (this document) |
>
> This document governs **how we work**; it is orthogonal to the frozen Baseline, which governs
> **what the system is**. It never overrides a Baseline invariant — where they touch, the Baseline
> wins and this document points to it.
>
> **How to read a principle.** Each has four parts: the **Principle**, **Why it exists**, the
> **Failure mode** it prevents, and a **Review question** you can ask on your own PR. The
> *(Earned from …)* line is the real event that taught us the principle — it is why the rule is not
> negotiable.

---

## Part I — Invariant discipline
*How your code must relate to a learner and their evidence. These are the frozen Baseline's
invariants, restated as things a committing engineer must actively check.*

### E1 — Evidence is append-only
**Principle.** A record of something a learner did is written once and never edited or deleted.
Only things *computed from* it may change.
**Why it exists.** Belief must always be reconstructable from the raw record. The moment a fact
can be silently rewritten, no belief built on it can be trusted or audited (Ch.1 Inv 4; Ch.2 Inv 6).
**Failure mode.** Updating an attempt in place; deleting attempts to "clean up"; overwriting an
observation with a corrected one instead of appending a new one.
**Review question.** *Can I replay the Evidence Log from scratch and obtain the same belief?* If a
change breaks that, it is wrong.

### E2 — Absence is a distinct state, never a value
**Principle.** "We have no evidence" is a first-class state. It must never be encoded as `0`,
`false`, or an empty default that a downstream classifier then reads as a real measurement.
**Why it exists.** *Unknown* and *Low* are different learner states that call for different action
(Ch.2 §2.7). Collapsing them fabricates a confident claim out of nothing, violating Constitution
5.2 (evidence-backed) and 5.10 (calibrated certainty).
**Failure mode.** The exact shape behind our first two drifts:
`absence → default value (0/false) → classifier → learner-facing claim`. A skill with no attempts
rendered as "0%", then classified "WEAK", then shown as *"Weak in X — your accuracy is 0%."*
**Review question.** *Am I about to emit a claim about a learner from a value that stands in for
missing evidence?* If yes, carry the absence explicitly (a distinct state / flag / tier) so every
consumer can tell it apart.
*(Earned from D1 — progress page & dashboard showed 0% for unattempted skills; and D2 — the Lens
classified the same 0% as "WEAK". Both fixed by making absence explicit, never by touching the
Baseline. Curriculum and Diagnostic are the counter-examples: they encode absence as `null`/skip
and were conformant.)*

### E3 — Belief is reconstructable; a cache is never an input
**Principle.** Understanding is a pure projection of the evidence closure. You may cache it and
update incrementally, but the cached value must always equal a from-scratch recomputation.
**Why it exists.** If belief can depend on its own past output, it stops being auditable and starts
drifting on its own history (Ch.2 §2.2, Inv 11; CI-1).
**Failure mode.** Feeding a stored mastery/score back in as an input to computing the next one;
treating a derived cache as the authoritative source of truth.
**Review question.** *If I deleted every cache and recomputed from the Evidence Log, would I get
the same answer?*

### E4 — Decisions are pure functions of a declared closure
**Principle.** What the system recommends or decides depends only on an explicitly enumerated set
of inputs. No hidden state survives between invocations; anything that must persist lives in the
declared inputs.
**Why it exists.** It is what makes a decision auditable and the method replaceable — a rule engine,
a bandit, an LLM planner must all satisfy the same contract (Ch.3 §3.2, §3.3).
**Failure mode.** Private module state read across calls; reaching for an input not in the closure
(another learner's data, an engagement metric); randomness pulled from unlogged internal state.
**Review question.** *Given the same declared inputs, does this always produce the same output — and
is every input it reads actually declared?*

### E5 — Never fabricate learner state
**Principle.** Every claim the product makes about a learner ("you've mastered this," "you often
rush," "weak in X") must be derivable from an authoritative artifact that actually asserts it.
**Why it exists.** Constitution 5.2: a personalized claim with no inspectable evidence behind it is
the fastest way to lose a learner's trust (Ch.4 Corollary 2).
**Failure mode.** A presentation layer inventing a claim the underlying artifact never made; a
narrative sentence that sounds specific but traces to nothing.
**Review question.** *Does an artifact actually assert this about the learner, or am I generating
it at the surface?*

### E6 — Certainty must match evidence
**Principle.** How certain the product *sounds* may never exceed how certain it actually *is*. Thin
evidence means tentative, reversible, more deferential to the learner.
**Why it exists.** Constitution 5.10. A system that sounds equally sure with 2 data points and 2000
gets trusted the same in both — until the thin claim is wrong, and takes the credible ones down
with it.
**Failure mode.** A bare point value (a percentage, a level) presented with no sense of how much
evidence backs it; a low-confidence recommendation rendered as a firm instruction.
**Review question.** *Does the confidence in my wording, emphasis, or firmness track the actual
volume and agreement of the evidence?*

### E7 — Generation is checkable, and verification is independent of it
**Principle.** AI-produced learning content must be checkable against something outside the process
that produced it, and it may not reach a learner until an independent gate has passed it.
**Why it exists.** Constitution 5.3 / 5.8. A wrong answer confidently explained is the single
highest-trust-destroying failure available to a learning product.
**Failure mode.** Generated or extracted content self-publishing straight to learners; removing or
bypassing the human/validation review gate; treating the generator as its own verifier.
**Review question.** *Is there a gate between generation and the learner that the generator does not
control?* (Today: drafts require human approval; invalid drafts can never be approved.)
*(Earned from the Import audit — the human review gate is load-bearing. If a future auto-approve
path ever bypassed it, grounding would cease to be checkable.)*

### E8 — The AI underneath is replaceable; behavior must not secretly depend on it
**Principle.** Belief and decisions are *computed from a learner's own evidence*, never obtained by
asking a generative model for its opinion. Swapping the model must not change what the product
recommends, explains, or refuses.
**Why it exists.** Foundation §7 and Rule 9 — the learning system's behavior must not covertly ride
on which model is plugged in (Ch.2 §2.1).
**Failure mode.** "Ask the LLM how well the student knows X" in place of deriving it from evidence;
product logic that only works because of one model's quirks.
**Review question.** *If the model were swapped tomorrow, would a learner notice a change in what
LEXI decides or refuses?* If yes, the behavior leaked into the model and belongs in policy.

---

## Part II — Method discipline
*How we investigate, classify, and change the system. These are not opinions; each was forced on
us by a specific event.*

### M1 — A drift earns an ID only after audit → classification → disposition
**Principle.** "This looks like a bug" is an **observation**, not a finding. It becomes a named
drift only after it has been audited, classified, and given a disposition.
**Why it exists.** Naming inflates a hunch into a fact and skips the step where a compatible reading
might dissolve it.
**Failure mode.** Labeling something "D-whatever" the moment you spot it, then arguing from the
label instead of the evidence.
**Review question.** *Have I run the full cycle on this, or am I asserting a conclusion I haven't
earned yet?*
*(Earned from O1 → D2 — the Lens issue was held as "Observation O1" until an actual audit turned it
into a Confirmed Drift.)*

### M2 — The audit describes the knowledge state; it never manufactures evidence to complete itself
**Principle.** The evidence used to resolve a question must pre-exist the question. You may not
create a document, ADR, or invariant *in order to* close a finding.
**Why it exists.** Writing the evidence that closes your own investigation is circular — the
conformance analogue of writing an invariant so the code passes.
**Failure mode.** A Pending blocked on "what was this intended to be?", closed by authoring the
intent yourself instead of leaving it open.
**Review question.** *Does the evidence I'm citing already exist, or am I about to create it to get
the answer I want?*
*(Earned from PD3 — the ontological status of the recommendation surface is Pending because the
product intent was never recorded. The correct output is "remains Pending," not "let's write an ADR
to decide it.")*

### M3 — Verification may open a new audit, never a new reconciliation
**Principle.** When verifying a fix surfaces a related problem elsewhere, that is a trigger to
*audit* that surface — not a licence to fix it inline.
**Why it exists.** Fixing what you have not audited turns `audit → reconcile → audit` into
`audit → reconcile → speculate → reconcile`, the exact undisciplined loop the whole method exists
to prevent. (Symmetric partner to *negative evidence yields no positive conclusion*.)
**Failure mode.** "While I'm here, I'll just fix this too" during a verification pass.
**Review question.** *Am I about to change code in a surface I have not audited?*
*(Earned during D1's verification, which revealed the Lens problem — we opened an audit of the Lens,
we did not fix it in the same breath.)*

### M4 — Verification runs on the real product
**Principle.** "Reconciled" and "works" mean you drove the actual flow as a user would and observed
the result — not that types compiled or the source looked right.
**Why it exists.** Source-reading and typecheck miss shipped consumers.
**Failure mode.** Declaring a fix done on a green typecheck.
**Review question.** *Did I run the app, reach the real surface, and see the change with my own
eyes?*
*(Earned from D1 — the typecheck was green and the source looked fixed, but running the app revealed
a second consumer (the dashboard) still showing the drift. Only the running product exposed it.)*

### M5 — One compatible reading defeats a drift call; prefer Pending over Drift
**Principle.** A thing is a Confirmed Drift only when it *positively contradicts* a Baseline
invariant with no reading of the frozen text under which it conforms. Absence of a feature is never
a contradiction. When unsure, classify Pending.
**Why it exists.** Evidence must override intuition, or the audit becomes a way to launder
assumptions into "conformance."
**Failure mode.** Inferring drift from something merely missing; declaring drift on the strongest
interpretation while a benign one survives.
**Review question.** *Is there any reading of the frozen spec under which this conforms?* If yes, it
is not a Drift yet.

### M6 — Never amend the Baseline to legitimize an implementation
**Principle.** The specification is the standard. When code contradicts it, you fix the code
(reconciliation), never the invariant.
**Why it exists.** The Baseline is only worth anything if implementation cannot quietly rewrite it.
Across all of Discovery and Conformance, **zero** frozen documents were amended — every tightening
was absorbed downstream. That track record is the asset; protect it.
**Failure mode.** Editing a clause so failing code "conforms"; softening an invariant because a
heuristic is convenient.
**Review question.** *Am I changing the rule, or the code?* Only the second is allowed here.

### M7 — History describes reality; it never manufactures it
**Principle.** **Repository history is architectural evidence. It must describe reality, never
manufacture it.** Never rewrite it, or artificially split or reorder commits, merely to produce a
cleaner narrative. A commit must represent a real state the project actually occupied.
**Why it exists.** The same discipline as M2 (the audit never manufactures evidence to complete
itself), one layer down into version control: a fabricated history is a fabricated audit trail. If
commits describe states the repository never held, the history stops being a record of what
happened and becomes a story told after the fact.
**Failure mode.** Forcing a "reconciliation-only" commit when the fix already lives inside
uncommitted code — inventing a fictional intermediate state to make the story tidy; splitting one
real change into several staged commits it never existed as; rewriting a commit so the past looks
more deliberate than it was.
**Review question.** *Did this repository actually exist in the state this commit claims?* If not,
the commit is fiction, not history.
*(Earned from Phase 2.5 — D1 and D2 could not be isolated into a standalone "reconciliation" commit
because the fixes already lived in never-committed implementation files. Forcing the split would
have described a state the project never occupied; the honest path was one implementation-baseline
commit that says, in its message, that it includes the reconciliation.)*

---

## Part III — The Constitution protects the Constitution

This document is itself governed, or it becomes a wish list. The meta-rule:

**When this Engineering Constitution may change**
- A principle is **repeatedly falsified** by real practice — not once, not inconveniently, but
  shown across multiple concrete cases to produce worse outcomes than its alternative.
- The **ontology or Baseline changes** underneath it, so a principle now points at something that no
  longer exists.

**When it may *not* change**
- To make a specific implementation pass (that is M6, one level up).
- To close an audit, a finding, or a Pending faster (that is M2).
- Because a heuristic or a deadline makes a principle inconvenient this week.
- On the strength of a single case. A principle earned from a real event is not unlearned by one
  counter-anecdote; it is unlearned by a pattern, deliberately reviewed.

**How a change happens**
Like every other governed document in this project: propose it explicitly, state the evidence that
forces it, make the *minimal* edit, and record the reasoning — reversals included — so the next
reader can see why. An edit that cannot show its forcing evidence is not an amendment; it is drift,
and the same discipline that catches it in the code catches it here.

---

*This document is complete when a new engineer can read `LEXI_FOUNDATION.md`, `LEXI_SYSTEM.md`, and
this file, then open their first PR knowing not just what LEXI is, but how it is required to be
built and changed. Every principle above has already survived contact with real code. That is what
makes it a constitution and not a preference.*
