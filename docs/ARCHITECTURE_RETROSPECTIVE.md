# LEXI — Architecture Retrospective: Baseline v1 + Chapter 4

> **Audience: future ARB sessions, not end users.** This is not a specification, not governance,
> not a revision log. It is a method handbook — what discovery actually taught us across
> Constitution → Ch.1 → Ch.2 → Ch.3 → Ch.4, distilled out of the revision logs and institutional
> memory scattered across five documents, so the next chapter's discovery starts with the toolkit
> already sharpened instead of re-deriving it from scratch.
>
> **Status: non-normative.** Nothing here redefines a rule. If this document and a chapter's own
> revision log ever disagree about what happened, the revision log wins — this is a distillation of
> it, not an authority over it.

---

## 1. What discovery actually was

Four chapters, four different discovery processes, one constant method: **never name or freeze a
concept before running it through a battery of necessity tests.** The method sharpened as it went —
Ch.1 ran a two-directional minimality proof across seven domains; by Ch.4, discovery ran a
seven-step test *chain*, each step changing the answer to the previous one, before a single word of
specification was written.

The pattern that held across all four: **architecture was discovered, not designed.** Every
candidate — Domain as an entity, Communication as an artifact, a "Single Authority" invariant, a
`(Learner × Domain)` grain — was proposed, tested against a specific failure mode, and either
survived or was cut. Nothing was frozen because it sounded right. Everything frozen survived an
attempt to remove it.

---

## 2. Heuristics that worked

### 2.1 The removal test
*If the system holds without this entity/artifact/rule, it doesn't belong in the baseline.*

This is the single most productive test in the whole process. It:
- Merged **Domain** into Concept (D1) — a Domain is just a Concept with no `Composes` parent;
  keeping it separate would have solved the same granularity problem twice.
- Demoted **Communication Policy** to Phase 3 — a system of {Decision Policy + Learning Engine +
  faithful, deterministic re-expression} violates no Constitution clause, so policy over *whether/
  how* to communicate is real but not baseline-necessary.
- Confirmed **institutional/teacher authority** stays out of Ch.1 — five full learner-journey
  simulations, none of which needed a second learner's authority over a first learner's goal.

### 2.2 The independence test — stronger than irreducibility
*Do two implementations, otherwise indistinguishable, get separated by this rule?*

This turned out to be a **strictly stronger** freeze-gating property than irreducibility, and the
difference matters for every future chapter:
- **Irreducibility** asks: does this rule say something the Constitution doesn't already say?
  Necessary, but only shows the layer has *new content*.
- **Independence** asks: does this rule *distinguish implementations* every layer beneath it
  cannot tell apart? This is what proved Ch.4 (F1) is a real normative layer and not commentary —
  two implementations with bit-identical internal Understanding/Recommendation objects, one
  faithfully re-expressed and one collapsing Conflict into a developing-label, are indistinguishable
  to Ch.1–3 and the Constitution alike. Only F1 tells them apart.

**Lesson for Ch.5+:** run independence before declaring a new layer real. Irreducibility alone can
pass on a layer that's technically novel but never actually binds any implementation choice.

### 2.3 The open-world (lifting) test
*If a later chapter adds a new authoritative artifact, does this chapter need editing?*

If the answer is "yes," the chapter has secretly encoded knowledge from the chapters below it — a
coupling. F1 ranges over *any* authoritative artifact and references *whatever authority its
defining chapter grants*, so a hypothetical Ch.5 `Assessment` would be covered automatically. This
is what makes a chapter survive chapters written after it without amendment.

### 2.4 Contract-before-algorithm
*Define the output artifact/interface before the computation that produces it.*

This is why Ch.2 and Ch.3 could each leave their entire inference/decision method **open** (§2.10,
§3.5) while still being precise about what they emit. The acceptance test for any future method is
always the invariants over the contract, never a specific algorithm.

### 2.5 One-new-artifact-per-chapter
*A chapter that starts minting several new nouns at once is an early sign the layer boundary has
blurred.*

Caught two real drifts before freeze: a "Plan" artifact nearly smuggled in through Recommendation's
`Intent`/`Action` fields (kept singular; a multi-step strategy is a *sequence* of Recommendations,
never one artifact carrying several intents), and a "decline marker" nearly added in Ch.3 §3.4
(kept as a non-artifact outcome — declining to recommend is a first-class *result*, not a new thing
that exists).

### 2.6 Sample-size discipline
*Don't promote an observation to a binding convention from a single instance.*

Ch.4 turned out to be a relation layer — a genuinely new *kind* of chapter, not just a new
instance of the old kind. The temptation was to immediately generalize this into a documented §0
convention. Declined, twice, in favor of recording it as an **observation with an explicit
promotion criterion** ("if a second relation layer independently needs this, promote then"). This
kept the convention list honest — a rule earned by evidence, not asserted by pattern-matching on
n=1.

---

## 3. Heuristics that were tried and abandoned

### 3.1 "Single Authority" as an explicit Ch.2 invariant
Proposed: an invariant in Ch.2 stating that Decision Policy may only consume capability judgments
via Understanding, never re-derive them from Evidence. **Withdrawn** — this is an upper layer's
constraint being dictated by a lower layer, a genuine layering violation (Ch.2 telling Ch.3 how to
behave). The same guarantee survives instead through **each layer's own self-governance**: Ch.2
owns belief computation and says nothing about consumers; Ch.3 independently declares itself
"prescriptive, not descriptive" and states its own closure restriction. Same protection, correct
ownership. **Lesson:** if a guarantee seems to require one chapter to constrain another, look for
a way to state it as two chapters' independent self-restrictions instead — it's almost always
possible, and it's the only way that respects strict downward authority.

### 3.2 Naming Ch.4's central relation as a formal concept
The relation "representation re-expresses artifact" was tested with entity-level questions
(identity? lifecycle? contract?) to decide whether it needed a name and a glossary entry. **This
was a category error**, caught mid-discovery: an entity test can only decide whether an abstraction
needs *entity status*, never whether the abstraction *exists* at all. The abstraction is real (a
relation-level abstraction, like *Boundary* or *Projection*) — it simply doesn't need a name,
because F1 stays fully statable without one. **Lesson:** "does this need a name" and "does this
exist" are different questions, and answering the first with tools meant for the second silently
answers the second wrong.

### 3.3 Reintroducing a merged entity after the merge was frozen
Mid-drafting Ch.2, a `(Learner × Domain)` grain was listed as a third Understanding grain —
despite Ch.1 having already merged Domain into Concept as a root node. This wasn't caught by the
primary chapter review; it surfaced in a **separate, later, whole-system coherence checkpoint**
run after Constitution + Ch.1 + Ch.2 were all individually frozen. **Lesson:** a decision being
frozen in one chapter does not stop a later chapter from silently re-deriving the thing that
decision removed. A dedicated "does this reintroduce something an earlier chapter explicitly
merged or rejected" pass is worth running across the whole baseline periodically, not just within
each chapter's own review.

---

## 4. False leads — looked necessary, proved unnecessary

- **Domain as a separate entity from Concept.** Felt structurally obvious at first (a domain
  really does feel different from a topic within it). Rejected by the removal/minimality test —
  Domain granularity is the same curatorial choice as Concept granularity, just applied at the
  root.
- **"Communication" as a Ch.4 artifact.** The first framing of Ch.4 assumed it needed to own
  *something* — a Communication object, an Interaction record. Both "Delivery" (too narrow — only
  covers the outbound act) and "Interaction" (too broad — a two-directional, UI-swallowing
  abstraction) were considered and rejected before the actual shape (a relation, not an artifact)
  was found.
- **Communication Policy and identity-bearing communication units at baseline.** The
  implementation-variability test confirmed communicative intent (celebrate vs. stay silent) is
  genuinely policy-shaped — a real design space. But the removal test showed it's not
  baseline-*necessary*. The two deferrals **arrive together**: an identity-bearing "the specific
  thing that was communicated" unit is only needed once multiple concurrently-respondable,
  non-Recommendation communications coexist — exactly the situation a future Communication Policy
  creates, and not before.
- **A "decline marker" as a Ch.3 artifact.** Once "declining to recommend" was established as a
  legitimate first-class outcome, the instinct was to give it its own observable artifact so
  downstream consumers could distinguish it from silence. Rejected — inventing a marker would have
  been a second new artifact in one chapter, violating §0's own convention. Left as an open
  question for §3.5 instead (does a decline need its own signal downstream? — deliberately
  unresolved, a later chapter's call).
- **Explicit "Single Authority" invariant** (see §3.1 above) — looked like the cleanest way to
  state a real guarantee; wrong layer to state it in.

---

## 5. Why the final architecture has the shape it does

### 5.1 Semantic and relational layers are orthogonal axes, not sequential nodes
Before Ch.4, the architecture read as one pipeline: `Evidence → Understanding → Recommendation`.
After Ch.4, it reads as two axes:
```
Semantic axis:   Evidence → Understanding → Recommendation   (each layer: new authority + artifact)
Relational axis:  authority → boundary preservation           (no new authority/artifact, only a
                                                                 lifted invariant, applies to all
                                                                 nodes on the semantic axis at once)
```
This is why Ch.4 has no closure, no artifact, and why "lifting" was the natural form for its one
invariant to take — it isn't a fourth node in the pipeline, it's a constraint that applies
orthogonally to every node already there (and every node a future chapter adds).

### 5.2 Locality of authority is a *result*, not an assumption
The project always intended each chapter to own only its own artifact's semantics. Ch.4 is what
actually **tested** that intention rather than merely stating it: F1 had to preserve Ch.2's and
Ch.3's authority across a boundary without owning or duplicating either. It succeeded staying thin
— no reconciliation logic, no restated semantics — and it could only do that because **D2** (Ch.2's
Constitutional Grounding: Understanding is the sole authority over learner capability; Decision
Policy consumes it only through contract) had been kept absolutely strict through Ch.2 and Ch.3.
If D2 had ever been relaxed — if Decision Policy held even a partial, independent capability
judgment — F1 would have needed to arbitrate between two conflicting semantics at the boundary,
and the whole chapter would have swelled into a reconciliation layer. **Locality survived because
discipline upstream paid for it, not because the property is free.**

### 5.3 A relation layer can only appear once the semantic layer it mediates is closed
Ch.4 could not have been discovered before Ch.2 and Ch.3 were frozen — there was nothing yet whose
authority needed preserving across a boundary. This is not a scheduling convenience; it's a
structural dependency the sequencing decision (semantics before behavior) is grounded in: a
boundary-preservation layer's entire content is defined relative to what it's preserving. Write it
too early and it has nothing to reference.

### 5.4 Discovery difficulty is diagnostic of upstream drift
The clearest methodological lesson to carry forward: **if a new chapter struggles to define itself
without reaching into an upstream chapter's internals, the default hypothesis should be "upstream
locality has drifted," not "this needs a bigger new layer."** Ch.4's thinness is the positive
proof of this — because it *didn't* need to reach into Ch.2/Ch.3 internals, it stayed a single
invariant. Any future chapter that starts needing dense reconciliation logic against what's
supposedly already-closed semantics should be treated as a red flag pointed backward, not forward.

### 5.5 Semantic compression is not correlated with architectural weight (observed, not yet a rule)
Ch.2 carries authority, artifact, fourteen invariants, closure, lifecycle, and semantics. Ch.4
carries none of that — one relation, one invariant. Both pass every necessity/independence test
equally. **A chapter's size is not a proxy for its architectural importance.** Recorded as an
observation (see `lexi_semantic_compression_heuristic` in institutional memory) with an explicit
promotion criterion: confirmed as a real pattern only once a second thin-but-independent layer is
found (Ch.5+), not asserted from this single case.

---

## 6. The toolkit for Ch.5+ — a checklist, refined by cost of getting it wrong the first time

When a new chapter is proposed, in order:

1. **Family test:** is this semantic-layer-shaped (new authority + artifact) or
   relation-layer-shaped (no new authority, only a relation between existing authorities)? Answer
   this before running any other test — it determines which proof family (§2 of this document)
   applies.
2. **Removal test:** does the system hold without this? If yes, it isn't baseline-necessary,
   regardless of how real the capability is.
3. **Minimality test (two-directional):** for every entity/artifact proposed, can it be folded
   into something that already exists? For every entity/artifact that already exists, is there a
   real case that breaks without it?
4. **Irreducibility test:** does this say something the Constitution/upstream chapters don't
   already say?
5. **Independence test (the decisive one):** does this actually *distinguish* implementations
   every layer beneath it cannot tell apart? If irreducibility passes but independence fails, the
   layer is real but may be commentary, not a binding rule.
6. **Open-world test:** if a later chapter adds a new authoritative artifact, does this chapter
   need an edit? If yes, it's secretly coupled to today's enumerated set.
7. **Locality diagnostic:** if this chapter is struggling to stay thin, check whether an upstream
   chapter's authority has drifted before adding mechanism here to compensate.
8. **Sample-size check:** if this chapter reveals a new pattern (a new "kind" of chapter, a new
   authoring convention), record it as an observation with an explicit promotion criterion —
   do not generalize into a binding rule from one instance.

---

## 6b. Thin questions — a candidate discovery heuristic (OBSERVED once, n=1, not yet a method)

Surfaced during the post-Ch.4 landscape discovery (2026-07-11), recorded here under the same
sample-size discipline it describes: this is an **observation from one discovery**, on LEXI, not a
validated law — despite how general it *feels*.

**The observation.** The landscape discovery's frontier question was reframed four times —
`Content Architecture?` → `Curating Authority?` → `what does "authoritative" mean?` → `is
"authoritative" a state or a permission?` — and **not one answer was retained across the reframes**,
yet discovery still progressed. It progressed because each reframe *removed an embedded assumption
from the question* rather than *adding a hypothesis to the answer*: the name (solution is
"content"-shaped), then the roadmap dependency, then the actor, then the assumption that
"authoritative" is a boolean state. Discovery advanced by making the **question thinner**, not the
answer bigger — until the question described only the phenomenon to be explained, with no implied
shape of its solution.

**Proposed sharpening — falsifiability is the measure of correct thinness (floor *and* ceiling).**
A question is thin enough exactly when it yields a falsifiable instrument, and no thinner. The first
three reframes admitted no clean falsification (they forced circular family-arguments); the fourth
did (the operations table + its column-split / circularity criteria). A question thinner *than* that
— "something about Concepts is unclear" — also yields no test. So thinness is not measured by how
few words remain but by whether the question has become testable. This unifies "thin questions" with
the falsification criterion: they are one thing seen from two sides.

**The circularity test (same discipline, applied to the justification side).** When checking a
candidate answer, no justification may invoke the term being defined ("X is permitted because the
Concept is authoritative" is a definitional loop). Every justification must ground in an
already-existing invariant or Constitution obligation. This is thin-questions applied to the answer:
the thing being explained must not appear in its own explanation.

**The mechanism, not just the effect — the part most easily lost.** The four reframes were *not*
produced by anyone deciding "let me strip an assumption." They were produced by **adversarial
challenge**: each conclusion was attacked as if by an ARB reviewer hunting specifically for the
hidden assumption, and stripping it was the *result* of the attack succeeding. Thinning is the
effect; adversarial assumption-hunting is the cause. If this heuristic is ever applied by thinning a
question *by fiat* (removing words to look clean) rather than *earning* each removal through a
challenge that exposed a real embedded assumption, it degrades into "use fewer words" — a dead
version of itself. **Record the mechanism or the heuristic rots.**

**Promotion criterion.** This graduates from observation to method only when a *second, independent*
architecture discovery — ideally not LEXI — exhibits the same assumption-stripping progression. The
claim that it is "more general than semantic-before-behavior or contract-before-algorithm" is
plausible but is exactly the n=1 leap this project has disciplined itself against; it is held as a
hypothesis about method, tested the next time a genuinely new discovery is run, not asserted now.

---

## 6a. A methodological discovery from running the audit itself: two kinds of audit, not one

Running `ONBOARDING_AUDIT_PACKAGE.md` against three different AI systems (rather than a human)
surfaced a distinction worth keeping for every future audit round — not just this one.

**Audit Type 1 — Onboarding audit.** *Can a fresh reader, with no prior exposure, reconstruct the
architecture from the documents alone?* This requires **closed-book compartmentalization** — the
reviewer must be exposed to the reading kit but never to the answer key, and must not be able to
"un-see" it once shown. **Only a human can run this audit.** An LLM given the same context window
as the answer key cannot compartmentalize the two the way a human can choose not to re-read a page
— once the answer key is in context, it is available, and using it isn't a discipline failure, it's
an architectural property of how the reasoning is done. `ONBOARDING_AUDIT_PACKAGE.md` is, and stays,
a Type 1 instrument.

**Audit Type 2 — Consistency audit.** *Given complete project knowledge, can another reasoning
process find inconsistencies the people who built it missed?* This one **does not require
closed-book conditions** — more context is strictly better, not worse. This is what actually
happened when an AI reviewer was given the full onboarding kit *and* the audit package *and* then
asked to go further and hunt for ambiguity/inconsistency: it wasn't failing Type 1, it wasn't even
running Type 1 — it had already collapsed into Type 2, and it found two genuine candidate findings
that way (documented and dispositioned as B1/B2 below and in the audit package).

**The reframe that matters:** the correct conclusion is not *"AI cannot audit"* or *"the AI reviewer
failed."* It is narrower and more useful:

> **An LLM cannot faithfully execute a protocol that requires it to ignore information already
> present in its own context.** This is a limit of the *protocol*, not of the *architecture*, and
> not a competence failure of the model — a reasoning process that can't partition "what I've seen"
> from "what I'm allowed to have seen" will always drift from Type 1 (reconstruction) toward Type 2
> (consistency review) the moment both are visible in the same context.

**How to apply for future audit rounds:** decide up front which audit type is wanted, and match the
reviewer to it. Want onboarding validation → find a real human who hasn't seen the answer key, full
stop, no AI substitute. Want a consistency sweep across everything already written → an AI reviewer
with maximum context is the *right* tool, not a compromised one — give it everything, including
prior findings, and treat its output as Type 2 evidence (candidate inconsistencies to disposition),
never as Type 1 evidence (onboarding validated).

### Dispositioning the two findings this produced

- **B1 (Recommendation issuance vs. Learning Activity origin) — reclassified as a *future-proofing
  question*, not an inconsistency.** It rests on an unproven assumption: that a Recommendation can
  be issued entirely outside any Learning Activity (e.g. a push notification sent while the learner
  isn't engaged with anything). No frozen chapter currently claims this happens. If the baseline
  implicitly assumes every Recommendation is issued *within* a Learning Activity, Ch.1 Invariants 10
  and 12 do not conflict. The question only becomes a real proof obligation if/when a future feature
  (push notification, reminder, spaced-repetition ping) needs to issue outside that context — at
  which point there are three live options (the notification opens a new Learning Activity; a
  notification isn't modeled as `Recommendation` issuance at all; or Invariant 10 is deliberately
  extended) and choosing between them is that future chapter's discovery, not a defect in this one.
- **B2 ("authoritative core" undefined) — kept as a *documentation completeness issue*, not a
  semantic issue, and left unfixed pending confirmation.** Everyone who lived through Ch.4's
  discovery reads "authoritative core" as shorthand for the closed Evidence→Understanding→
  Recommendation loop without needing it spelled out — which is exactly why no one writing the
  chapter noticed the term was never formally defined. This is a real, credible onboarding-bug
  candidate. **Deliberately not fixed yet** — fixing it now, on AI-reviewer signal alone, risks
  overfitting the documentation to how a context-saturated LLM reads it rather than how a genuinely
  fresh human reader would. Disposition: fix it only if a real, closed-book human reviewer also
  stumbles on the term; otherwise leave it, since "an AI with full context found it ambiguous"
  and "a first-time human reader finds it ambiguous" are not the same evidence.

---

## 7. What this retrospective is not

It does not add, remove, or reinterpret any invariant, contract, or Constitution principle. It
does not carry authority over any frozen chapter's own revision log — where they overlap, the
chapter's revision log is the primary source and this document is a summary of it. It exists so
that the *next* discovery — Data Architecture, Content Architecture, Identity, or whatever comes
after — starts with the method already sharpened, instead of re-learning what removal, minimality,
irreducibility, and independence each catch and miss.

---

*Compiled 2026-07-10, after Baseline v1 + Ch.4 freeze and the onboarding-audit gate. Draws on the
revision logs of `LEXI_FOUNDATION.md`, `LEXI_SYSTEM.md` Ch.1–4, `ADR-001-baseline-v1.md`, and
institutional memory of the discovery conversations that produced them.*
