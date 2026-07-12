# How Information Flows Through LEXI

> **This is not a specification.** It defines no rule, no contract, no invariant — every claim
> here is already owned by a frozen chapter, cited inline. This page exists only to give a new
> reader the shape of the system in five minutes, before they meet the detail. **Read this first,
> then go to `DOCUMENT_HIERARCHY.md` for where to go deeper.**
>
> **Status:** derived, non-normative. **Update rule:** editorial — regenerate if a frozen chapter's
> dataflow shape changes; this page never drives a change, it only narrates one.

---

## The one picture

```
   Learner acts
        │            an attempt, a self-report, a real-world episode
        ▼
   EVIDENCE                         a fact. Immutable. Never edited, never deleted.
        │                           [Ch.1 — Learning Domain Model]
        ▼
   UNDERSTANDING                    a belief about what the learner can do — always
        │                           uncertain, always traceable back to Evidence, never
        │                           asserted without saying how confident it is.
        │                           [Ch.2 — Learning Engine]
        ▼
   RECOMMENDATION                   one suggested next action — a proposal, never an
        │                           order. The learner can always ignore it.
        │                           [Ch.3 — Decision Policy]
        ▼
   COMMUNICATION BOUNDARY           the crossing to wherever the learner actually sees
        │                           this — screen, voice, dashboard, export. Nothing may
        │                           be lost or exaggerated on the way out.
        │                           [Ch.4 — Communication Boundary]
        ▼
   Learner sees something
        │
        ▼
   Learner responds (follows it, ignores it, overrides it)
        │
        └──────────────────────────────────────► becomes new EVIDENCE, loop closes
```

Four arrows, four chapters, one rule each. That's the whole system.

---

## Reading the arrows

**Learner acts → Evidence.**
Something happens — an attempt at a question, a self-report of how a lesson went, a real driving
lesson with no predefined "question" at all. LEXI records it as a fact and never touches that
record again. It doesn't matter yet whether the fact means the learner is doing well; recording
what happened and *judging* what it means are different jobs, done in different places.
*(Ch.1 §3.2, §8 Invariant 4 — Evidence is append-only.)*

**Evidence → Understanding.**
The Learning Engine looks at everything a learner has ever done on a topic and forms a belief:
how likely is it they can do this, and how sure are we? Both halves matter — "we're not sure yet"
and "we're sure they're weak" are different, useful things to know, never collapsed into one
number. Nothing about *what to do next* lives here — this step only answers *what do we believe*.
*(Ch.2 — the whole chapter is this one transformation.)*

**Understanding → Recommendation.**
The Decision Policy looks at that belief, plus the learner's current goal, and proposes exactly
one next action — with a reason, and with a confidence that can never exceed what the belief
actually supports. It is a suggestion, not an instruction: the learner can always do something
else instead, and that choice is respected, not routed around.
*(Ch.3 — the whole chapter is this one transformation.)*

**Recommendation → Communication Boundary → Learner sees something.**
Whatever the Recommendation actually says has to survive being turned into words, a screen, a
voice, a dashboard card — without becoming more certain, more final, or more sweeping than it
really is on the inside. A recommendation LEXI privately holds as "worth trying" must not arrive
sounding like "this is definitely the answer." This is the one job of this layer: nothing added,
nothing lost, on the way out.
*(Ch.4 — one rule, called F1: whatever authority an artifact has, the words carry the same
authority, no more and no less.)*

**Learner responds → new Evidence.**
Whatever the learner actually does about it — tries it, ignores it, does something else — is
itself recorded as a new fact, and the loop starts again. This is what makes LEXI *learn from
being used*: every round trip leaves the belief slightly more informed than before.
*(Ch.1 Invariant 12 + Ch.3 §3.1 Lifecycle — the response, not the suggestion, is what re-enters
the loop.)*

---

## Three things worth holding onto

**Nothing skips a step.** A Recommendation is never generated straight from raw Evidence — it
always passes through Understanding first. If a system claim about "what to do next" can't be
traced back through a belief, back to a fact, something has gone around the loop, not through it.

**Each arrow only trusts what's directly upstream of it.** The Decision Policy doesn't re-read raw
Evidence to double-check the Learning Engine's belief — it takes the belief as given. This is what
lets any one step be rebuilt with entirely different technology later without the others noticing.

**The loop never repeats a decision back into itself.** A Recommendation only influences future
belief *after* the learner has responded to it and that response has become Evidence — the system
never gets to just replay its own past suggestions as if they were new facts about the learner.

---

## Where to go from here

This page told you the shape. It did not tell you the rules that make each arrow trustworthy —
what "uncertain" is allowed to mean, what makes a Recommendation valid, what "preserved" means at
the crossing. That detail lives in the four frozen chapters this page only summarized:

`DOCUMENT_HIERARCHY.md` → `LEXI_FOUNDATION.md` (why any of this exists) → `LEXI_SYSTEM.md`
Ch.1 → Ch.2 → Ch.3 → Ch.4, in that order.
