# Phase 3 — Product Decision Tension Inventory

**Status:** Discovery complete for the currently known candidate (PD3).

## Scope and method

This inventory tests a narrow hypothesis: whether any recurring product decision cannot be
adjudicated by the frozen Foundation, yet needs a commitment more stable than a roadmap or
feature decision. It neither creates a product layer nor changes the Foundation.

Each candidate is assessed in this order:

> Observation → Evidence → Compatible-reading test → Disposition

An empty open-tension set is a valid result. “Recommendation” below refers to the product
meaning of that term, not to the number or presentation of items in a particular UI.

## Inventory

### PD3 — Lexi recommendation intent

**Decision**

Is a Lexi recommendation fundamentally today’s action, learner reflection, coaching, planning,
or something else?

**Observation**

The term can appear adjacent to several legitimate learning experiences: a learner can be shown
what happened (reflection), receive an explanation or encouragement (coaching), hold a longer
horizon (planning), and be told what to do now (action). The question is whether Foundation
leaves the intended role of a *recommendation* open among those readings.

**Evidence**

- Foundation §1 says Lexi supplies judgment about what to do next, today, for the learner’s
  specific gap, continuously.
- Foundation §2 permits a standing adaptive plan for mastering material; this establishes the
  longer-horizon context in which recommendations operate.
- Foundation §3 answers the daily question “What should I do next, and why?” with **one
  recommended action**, grounded in evidence about mastery and moving the learner toward their
  goal. It expressly distinguishes this from merely showing what is available or inviting a
  conversation.
- Foundation §4 identifies Lexi as a companion that observes, recommends, and adapts across
  sessions, and rejects a chatbot model in which the learner must repeatedly ask what to do.
- Foundation §5.4 requires a recommendation to be guidance, not command: the learner retains
  equally accessible alternatives. §5.5 requires interaction to leave a visible progress trace,
  rather than only producing dialogue. §5.10 requires low-evidence recommendations to be
  tentative, reversible, and easy to override.
- Foundation §7 assigns AI the roles of deciding what to recommend next and explaining; it
  separately reserves learner control over whether to follow a recommendation and what to study
  instead.

**Compatible-reading test**

| Reading | Compatible with Foundation? | Reason |
| --- | --- | --- |
| Today’s evidence-grounded action | Yes — required | This is the express mission-level definition of the recommendation. |
| Learner reflection | Only as supporting context | Reflection can explain the evidence or update the learner’s record, but it does not answer “what should I do next?” on its own. |
| Coaching | Only as supporting communication | Coaching or explanation can make an action understandable; it cannot replace the action with conversation detached from progress. |
| Planning | Yes, as horizon/context; not as the recommendation’s fundamental intent | The standing adaptive plan is required by the vision, while the recommendation is the plan’s current, daily action. |
| Something else | No, if it displaces the next action | It would contradict the mission and product identity unless it remains subordinate to the recommendation of an evidence-grounded action. |

**Why Foundation cannot uniquely decide it**

It can uniquely decide it. Foundation assigns distinct roles to all four concepts: planning is the
standing adaptive horizon; reflection and coaching may support understanding; the recommendation
itself is the daily, evidence-grounded next action. The learner’s agency and confidence handling
constrain *how* that action is offered, not *what kind of product act* a recommendation is.

**Current implementation impact**

The implementation is aligned on the action type:

- `lib/services/practiceRecommendation.ts` ranks evidence-derived actions as
  `REVIEW_NOTEBOOK`, `PRACTICE_TOPIC`, or `ADVANCE_SESSION`.
- The dashboard and session-results pages take the first ranked item as `topRec` and route its
  CTA to the corresponding action.
- `lib/services/lens/recommendations.ts` only transforms upstream recommendations; it neither
  infers a separate intent nor creates new recommendations.

There is one implementation-compliance observation, not a new product tension: the service
returns up to four ranked recommendations and the Lens renders a “Next Actions” list. Foundation
requires one recommended action and accessible alternatives. Whether these lower-ranked entries
are clearly communicated as alternatives to the primary action is a Foundation compliance and
presentation check for the existing implementation; it does not make recommendation intent
ambiguous or require a new governing artifact.

**Disposition**

**Closed.** Recommendation intent is adjudicated by Foundation: Lexi recommends one current,
evidence-grounded learning action and its reason. Planning, reflection, and coaching are
permitted supporting roles under their stated constraints.

**Classification**

Not product strategy, roadmap, feature, Foundation amendment, or evidence for a new governance
layer. This is a closed Foundation interpretation. The ranked-list observation is an existing
implementation compliance check only.

## PD3 result

PD3 introduces no open product decision tension. No new architecture layer, Product Thesis,
product philosophy, or Foundation amendment is justified by that candidate.

---

### PS1 — Primary learning loop: boundary of a learning session

**Decision**

What is a “learning session” in the learner experience: one bounded Learning Activity, a
container that may comprise several Learning Activities, or a curriculum/content unit?

**Observation**

The frozen baseline already defines a closed authoritative loop and a `Learning Activity`, but it
does not define a product-experience object called a “learning session.” The current application
uses `CurriculumSession` and `UserSessionProgress`; these are implementation entities and cannot
by themselves settle the product meaning of the term.

**Evidence**

- Foundation §3 makes the daily product act one evidence-grounded next action and its reason.
  Foundation §5.4 preserves the learner’s ability to choose an alternative; accepting a
  recommendation is therefore not the only valid way a learning encounter can begin.
- Foundation §5.5 and §6 require interactions to produce a visible progress trace and to refine
  Lexi’s belief about what the learner knows. Retrieval, rather than exposure, is the intended
  learning mechanism.
- System Ch.1 §3.1 defines a **Learning Activity** as a bounded real occurrence of engagement.
  It may reference Content Item(s), or be a real-world activity without predefined content.
  System Ch.1 §7 says its weak identity is a grouping context for Evidence, bounded by learner,
  time window, and engagement.
- System Ch.1 §3.2 and Invariant 10 require every Evidence record to originate from exactly one
  Learning Activity. Its lifecycle is opened → accumulates Evidence → closed; a closed activity
  cannot reopen or receive further Evidence.
- The baseline dataflow is `Evidence → Understanding → Recommendation → learner response →
  Evidence`. Recommendation is prescriptive, not descriptive; at most one is current. A
  dashboard, analytics view, or notification is legitimate consumption but creates no Evidence.
- The current implementation persists `QuestionAttempt` records, optionally associated with a
  `CurriculumSession`; completion derives a score and stores `UserSessionProgress`. It computes
  recommendations from those results. A `CurriculumSession` contains reusable planned content,
  whereas `QuestionAttempt` is the record of an individual occurrence.

**Compatible-reading test**

| Reading | Compatible with Foundation and System? | Reason |
| --- | --- | --- |
| A session is exactly one bounded Learning Activity | Yes | It directly adopts the frozen activity boundary and evidence grouping. |
| A session is an experience container containing one or more bounded Learning Activities | Yes, with constraints | Each contained activity must retain its own bounded lifecycle and own its Evidence; the container cannot turn a completed activity into an editable or reopenable record. |
| A session is a curriculum/content unit | Only as a planning or content label | A curriculum unit can make an action available, but it is not evidence of learning until the learner engages and Evidence is recorded. |
| A session is viewing Lens, a dashboard, or a notification | No, as a *learning* session | These are conforming consumption surfaces but, without a learner response captured as Evidence, do not advance the authoritative loop. |
| A session must start by accepting Lexi’s recommendation | No | Learner agency permits an override or choosing another study action; such a response must remain effective and be recorded as Evidence. |
| A session requires an active Goal | No | A Goal supplies context when active, but the Decision Policy explicitly permits a learner momentarily to have no active Goal. |

**Why Foundation cannot uniquely decide it**

Foundation and System uniquely decide the *minimum semantic loop*: a bounded learner engagement
must yield learner-owned Evidence; Understanding is recomputed from that Evidence; a current
Recommendation, when one is justified, proposes one next action; and the learner’s response
returns new Evidence. They do **not** decide whether the product word “session” is synonymous
with one Learning Activity or is a higher-level, bounded experience container for several
Activities. Both readings preserve the frozen entities, lifecycles, and loop.

This is a granularity decision, not an ontology gap: `Learning Activity`, Evidence,
Understanding, and Recommendation already have their required meanings. Naming a product session
must not introduce a new authoritative artifact or alter any of them.

**Current implementation impact**

Today, `CurriculumSession` mixes a reusable curriculum unit with a learner’s completion context,
while `QuestionAttempt` is the strongest available evidence-like event. This supports a
question-practice slice but does not yet establish whether the product session boundary is one
attempt, one curriculum execution, or a composition of activities. Recommendation issuance and
learner response are not represented as the baseline’s full evidence lifecycle in this legacy
implementation, so the implementation cannot settle PS1.

The eventual decision must preserve these already-fixed conditions: no learning session can claim
progress without captured Evidence; a content or presentation visit alone is not learning
progress; and a learner-selected alternative remains valid rather than an exceptional path.

**Disposition**

**Open.** Foundation and System close the loop’s invariants but leave the product-session
granularity legitimately open. Resolve this before screen contracts, using the compatible-reading
constraints above. No new architecture layer is implicated.

**Classification**

**Product strategy.** This is a durable definition of the primary learner journey and its success
condition, not a roadmap ordering, individual feature choice, Foundation amendment, or evidence
for a new governance layer.

## Current inventory result

| Candidate | Status | Classification |
| --- | --- | --- |
| PD3 — Recommendation intent | Closed | Foundation interpretation |
| PS1 — Learning-session boundary | Open | Product strategy |
