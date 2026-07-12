# LEXI — Discovery Backlog

> Questions and proof obligations only. No design, no architecture, no solutions, no speculation.
> Not a roadmap — a roadmap presumes what comes next; this doesn't. An item graduates out of this
> backlog only when its Required proof is actually run, not when it "seems obviously true."
>
> **Status:** pending. Baseline v1 + Ch.4 is **Internally Certified** (`BASELINE_CERTIFICATION.md`)
> — the human onboarding audit remains a target, not a blocking gate, so Ch.5-and-beyond discovery
> may proceed against this backlog whenever evidence is ready. This file exists so evidence has
> somewhere to land, not to pre-select what's next.

---

**1.**
- Observation: Assessment-like capabilities (tests, exams, scoring) aren't modeled as their own
  authority anywhere in Baseline v1.
- Why it matters: if Assessment needs its own authority, it's a semantic (Type I) chapter; if not,
  it may already be expressible via existing Ch.1–3 artifacts.
- Unknown: does Assessment require new authority, or does it fold into existing Evidence/
  Understanding/Recommendation?
- Required proof: removal test — does the system hold without a separate Assessment authority?
- Current status: **removal test run (2026-07-10, landscape discovery) — ELIMINATED.** Decomposes
  fully into existing entities (test = Practice Items Ch.1; taking it = Evidence Ch.1; judging =
  Evaluator Ch.1; resulting belief = Understanding Ch.2; "readiness" = a Goal-relative query over
  Understanding). Nothing lost on removal. Additionally possibly *anti*-necessary: elevating a
  score to its own authority risks the Constitution 5.7 (short-term-scores) failure mode.

**2.**
- Observation: Content Architecture (how the concept graph is curated/built) is named as
  not-started in `BASELINE_ARCHITECTURE.md` §7.
- Why it matters: determines whether Content has its own authoritative artifact or is a
  curation process over Ch.1's existing entities.
- Unknown: does Content Architecture introduce a new authoritative artifact, or only a governance
  process over Concept/Source/Content Item?
- Required proof: removal test + minimality test against Ch.1's existing entity taxonomy.
- Current status: **removal test run (2026-07-10, landscape discovery) — SURVIVOR (strongest
  necessity of the four candidates).** On removal, the system can no longer state how the concept
  graph comes to exist and stay trustworthy: proposed→confirmed lifecycle, Pending-KU promotion,
  split/merge governance, and the "Curating authority" that Ch.1 §9 references but never defines.
  Named gap already exists in the frozen baseline (Ch.1 §11 defers it here explicitly) — but that
  citation is evidence of a name, not proof of necessity (ARB challenge, 2026-07-10).

  **Necessity re-run without citing Ch.1 §11 (2026-07-10) — survives independently.** Independence
  construction: Implementation A (an independent curator confirms an AI-proposed Concept) vs.
  Implementation B (the same AI process auto-confirms its own proposal, fully logged and tracked).
  Both satisfy every literal Ch.1 invariant (Inv 2's "explicit and tracked" is satisfied by B) and
  the §9 ownership table (nothing requires "curating authority" to be independent from whatever
  proposed the Concept). Yet Constitution 5.8 ("checkable against something independent of its own
  production") forbids exactly what B does. Same shape as Ch.4's Conflict→Ignorance proof: every
  clause literally satisfied, a real distinction lost. **Necessity confirmed independent of the
  forward-reference.**

  **Second ARB challenge (2026-07-10) — is the crossing even the source of necessity?** Tested by
  deleting "Pending" entirely: collapse to two implementations with no state transition at all —
  A (human independently verifies), B (generator verifies itself), confirmed instantly, no crossing
  exists. **Constitution 5.8 still separates A from B.** Necessity survives with the crossing
  removed — so the crossing was never the source; the earlier "relation layer" framing was
  unconsciously importing Ch.4's shape onto a different problem.

  **Re-stress-tested the open-world claim rather than assuming it:** sketched a candidate lifting
  invariant ("confirmer must be independent of proposer") and asked whether new confirming-authority
  types force an edit. "Teacher consensus" as confirmer: no edit needed (independence holds
  per-instance). "Community review" (proposer/confirmer populations overlap) or a self-updating
  "external scientific source": **does force new content** — quorum size, whether a past-proposer
  can vote, how much time/distance counts as independence are domain-policy questions with no
  existing chapter to lift from. **This is what a relation layer cannot do and a semantic chapter
  must** — confirms the shape is semantic, not relational.

  **Textual confirmation (not just inference):** Ch.1 §2's Entity Taxonomy — Nodes list is exactly
  *Learner, Concept, Source, Content Item, Pathway, Goal, Learning Activity, Evaluator*. **"Curating
  authority" is absent from this list**, despite being the named actor in §9's Ownership table for
  Concept, Concept Relationship, Source, Pathway, and Concept Attribution — more load-bearing than
  most Nodes that *did* get full treatment, yet given no identity, contract, or invariant of its own.
  This directly answers "is there a semantic authority referenced but never specified?" — yes.

  **Structural lead (not yet tested):** Ch.1 already solved a same-shaped problem for Evaluator —
  gave it a persistent identity (§3.1) *in Ch.1*, while deliberately deferring the harder question
  (Evaluator Reliability's computation) to Ch.2. If Curating Authority is the same shape, the
  minimal semantic content needed may be just as small: an identity/contract for the role, with
  "how much independence is enough" deferred onward the same way — worth testing before assuming
  a large chapter is needed.

  **Working classification: leans semantic (Type I — an unspecified authority), not relational
  (Type II).** Not yet formally closed.

  **Third ARB pass (2026-07-10) — the frame shifted again, from actor to semantic change. This is
  now the frontier.** Running the existence/authority/removal/independence/family checklist on
  "Curating Authority" as an *actor* exposed that the actor framing was itself premature:
  - "Authority already exists, only a constraint is missing" (my Bước 2) was wrong — it assumed
    "confirm" is a defined act. It isn't: Ch.2's closure names the input "Ontology Snapshot" without
    pinning it to the *confirmed-only* subset, so whether a *proposed* Concept can even produce
    Understanding is unstated. We knew there was a verb ("confirm"), not what it grants.
  - "Only one invariant is missing (independence)" was also premature — at least two independent
    Constitution clauses bear on confirmation (5.8 → independence; 5.2/5.8 → the confirmation act
    must itself be attributable/checkable). Two independent sources constraining one act is the
    signature of a *contract*, not a lone invariant.
  - The tempting asymmetry "Evidence/Understanding/Recommendation have contracts, Concept doesn't"
    is a **false lead** (named: *Projection-envy*, a sibling of the recency-bias trap): Source,
    Pathway, Goal, Evaluator also have no field-level contract — the real pattern is Nodes get
    lifecycle+identity, Projections/Facts get contracts, and that is *consistent*, not an anomaly.
    Do not chase "Concept needs a contract."

  **Reframed frontier question (replaces "What is Curating Authority?"):** *What does it mean for a
  Concept to become authoritative — after the proposed→active transition, what is the system
  permitted to believe or do that it was not permitted before?* This is a pure semantic question,
  assumes no entity/chapter/relation/invariant. Two concrete, textually-verifiable gaps it already
  exposes: (1) Ch.2 closure doesn't state whether a proposed (non-active) Concept participates in
  Understanding computation; (2) Ch.3 §3.4 Admissibility pins "active Content Item" but never pins
  whether a Recommendation may target a non-confirmed *Concept*. Same missing semantic surfacing at
  two layers: **the meaning of a Concept's authoritative status is named in the lifecycle (§10) but
  never defined.** Whether closing it needs a chapter, an amendment, or a single clause is still
  unknown — and deliberately not guessed. Open the next session with the reframed question above,
  not with any actor, name, or chapter title.

  Do not assume the eventual chapter is named "Content" — name follows necessity, not the reverse
  (same lesson as Ch.4's own naming history: Communication → Delivery → Interaction, all rejected
  before the real shape was found). **Still not confirmed as the next chapter.** Next session should
  open with "is there already a semantic authority that has been referenced but never specified?" —
  answered here provisionally yes (Curating Authority) — then formally run family/independence
  tests on *that specific entity question*, not open with a chapter title ("Content Architecture")
  already assumed. Full family/minimality/independence checklist still to run on whichever shape
  survives.

  **Fourth ARB pass (2026-07-11) — reframe from *state* to *permission*, plus the test instrument
  for the next session.** The two gaps from the third pass are *symptoms*, not the problem: each is
  patchable in one sentence ("only confirmed Concepts enter the Ontology Snapshot" / "Recommendations
  may only reference confirmed Concepts"). Suspiciously cheap — and both patches say the *same* thing
  (op X may only use confirmed Concepts) applied to two ops, i.e. we'd be writing two rows of a
  permission table without noticing. Reframe: "authoritative" may not be a boolean *state* of a
  Concept but an operation-relative *permission* — existence and authority may be separable (a
  proposed Concept exists; which operations may *use* it is unstated). **Hypothesis, explicitly not
  yet believed** — it rhymes with Ch.4's object→obligation move, so may be recency-bias (same family
  as the lifting-invariant and Projection-envy traps). Safe to carry only because it is falsifiable,
  via the instrument below.
  - **Instrument (next session builds it, does not pre-fill):** a blank table
    `[ Operation | may it use a non-authoritative Concept? | why ]` over every Baseline-defined
    operation (build Understanding, issue Recommendation, create Evidence, update Ontology Snapshot,
    Concept Attribution, query, projection, …).
  - **Falsification criterion 1 (column split):** if the "may use" column is *uniform* (every op
    forbids non-authoritative Concepts) → "authoritative" is just a global gate, permission-framing
    adds nothing over a state+gate, framing dies (Occam). If it *splits* (≥1 op legitimately uses
    proposed Concepts, ≥1 forbids) → "authoritative" is genuinely operation-relative, a different
    shape than a lifecycle state.
  - **Falsification criterion 2 (circularity test, on the "why?" column):** every "why?" cell must
    ground in an *already-existing* invariant or Constitution obligation (learner safety,
    reconstructability, checkability/5.8, groundedness/5.3, …). If any cell answers "because the
    Concept is authoritative," the discovery has failed by definitional loop — it is explaining the
    term with itself. This is the same discipline as thin-questions applied to the justification
    side: the term being defined must not appear in its own explanation.
  - **What a failure kills:** if either criterion fails, it kills the *framing*, not just a
    hypothesis — "permission" is itself an assumption embedded in the current question, so its death
    means the question must be re-thinned (one more assumption stripped), not that a different answer
    to the same question should be tried.
  - **Caution for building the table:** Ch.1 has *two* confirmation lifecycles — Concept (§10) and
    Concept Attribution (§3.3, its own proposed/confirmed/rejected). The real gap may live in
    Attribution-authority, not Concept-authority (a Concept receives Evidence only via a confirmed
    Attribution). Do not build the table assuming it is only about the Concept; leave room for an
    Attribution axis.

  **Fifth ARB pass (2026-07-11) — the whole tower may have failed a pure removal test. PROVISIONAL,
  pending one open attack.** The instrument above was never fully filled; a smaller falsification
  ran first and appears to collapse the entire line. Sequence of shrinking units this session:
  `permission → authority → legitimacy → claim → property/proposal → (does "legitimacy" exist at
  all?)`. The decisive move: instead of asking where legitimacy lives, **delete "legitimacy"
  entirely (don't replace it with claim/proposal) and ask what breaks.**
  - **Result (provisional):** nothing in the runtime breaks. Traced a Concept add→merge (Bayes →
    Probability Theory): everything works via *structural* operations + governance events (Inv 2
    explicit merge, §2.9 Attribution re-resolution, forward-mapping, Understanding recompute). No
    contract, invariant, or closure reads a Concept `confirmed`-status (verified across Ch.1 13
    invariants, Ch.2 14, Ch.3 6 — none reference it).
  - **Three attacks run to resist agreeing (all fail to save legitimacy):** (1) proposed/pending vs
    confirmed = "edit applied yet?", lives in the edit-log not on the Concept; (2) 5.8 "enforced
    structurally" is carried by Content Item (verified/active) + Attribution (confirmed) — even
    10,000 uncurated AI-proposed Concepts are *inert* until a verified Content Item + confirmed
    Attribution exist, so Concept-legitimacy is redundant to 5.8; (3) structural participation
    (edges) is read by kind, never by confirmed-status.
  - **Deepest reframe (ties to Ch.1 §5 Events-vs-State + durability gradient):** the ontology graph
    is a *curated structure* — governed, not derived. Runtime reads its current structure (+ version
    for reconstruction), never a legitimacy-state. "Confirmed" = "this edit was applied," an event in
    the ontology's edit-history — the classic *saw-an-event, inferred-a-state* modeling error. The
    whole tower (permission/authority/legitimacy/claim/property/proposal) was an attempt to model a
    *thing*; removal suggests there is only a *process* (curation) + *history*, no thing. The
    original frontier question is not answered but shown **malformed**: there is no authoritative-
    status to permit anything.
  - **The one open attack (residual):** what survives removal is NOT a smaller legitimacy but a
    *category-distinct* thing — the distinction between the authoritative structure and the
    *pending-edit / proposal space* (uncurated proposals must live somewhere distinguishable), and
    the governance of edits over the curated structure. This is structural/process, not a node-state.
    Open question, genuinely different from everything chased so far: **does the curated structure's
    own edit-history/governance need to be *architected* (a governance chapter) or is it pure
    process?** Attack surface: is "pending-edit space" legitimacy smuggled back under a new name? (Best
    current read: no — it has no truth-value and no contract reads it — but not closed as hard as the
    three attacks above.)
  - **Disposition if this holds:** resolves toward **governance, not runtime architecture** — a
    *complete* result per the method (no new runtime chapter), not a failure. Removes an assumption
    from the question rather than adding a chapter.

  **Sixth ARB pass (2026-07-11) — CORRECTION of the fifth pass's over-step; the fifth pass is kept
  intact as the reversal trail.** The fifth pass made a *negative→positive leap*: the removal test
  licenses only "runtime does not need a confirmed-state" (negative); it does NOT license "confirmed
  IS an event in edit-history" (positive ontology claim). Retracted. The error is named
  **object conservation**: killing one object (property → claim → proposal → history) and reaching
  for the next, preserving the un-stripped assumption *that an object exists at all*. The cure is the
  *pure* removal test (delete, don't replace), which strips that meta-assumption — and it was then
  applied to the residuals:
  - **Edit-history removal test:** delete the audit story (who confirmed, when, merge-count, reject
    timeline), keep versioned structure. Nothing runtime breaks — reconstruction (Ch.2 Inv 12) needs
    *version-addressable structure* (already frozen in the Ch.2 closure), NOT the edit story. 5.8 is
    carried by Content Item + Attribution, not by confirmation-audit. → edit-history dies to the same
    test as legitimacy; the "history" framing was object conservation.
  - **Pending-space independence test:** proposals stored in a DB vs a Git branch vs email between
    curators — all satisfy Baseline identically (no contract reads the pending space). → fails
    independence; a *tool-state*, not a domain object (the Git working-tree analogy). "Must live
    somewhere" ≠ "needs a semantic object."
  - **What is actually licensed (and only this):** *runtime does not establish the necessity of any
    semantic object representing "Concept legitimacy."* Plus two further negatives (edit-history-audit
    fails removal; pending-space fails independence). Three successive object-framings dying to the
    same tests is **convergent-negative** evidence the original frontier question is likely
    *malformed* (it presupposed an object) — NOT a positive proof that "nothing exists."
  - **Last untested thread (honestly open, leaning but NOT closed):** does *governance* need a
    model/chapter, or only *policy*? Its strongest semantic candidate — "confirmer must be independent
    of proposer" (5.8) — is read by no contract output and breaks no runtime on removal, so it *leans*
    policy-not-architecture. Not declared closed (guarding against a repeat over-claim). If governance
    too resolves to policy, the discovery ends at the strongest result available: the question was
    malformed; after stripping every assumption, no new semantic phenomenon needs architecting;
    Baseline covers more than assumed.

  **Seventh pass (2026-07-11) — FRONTIER CLOSED by anomaly exhaustion.** ARB declined to test
  governance (a new frontier, not this one — opening it idea-driven would be object conservation in
  another form) and instead ran the closing standard: *enumerate every anomaly that started this
  frontier; check which remain unexplained after the falsification chain.* Result — all five
  founding anomalies are explained:
  1. **Independence A/B (self-confirming AI)** — 5.8 bites *directly* on B ("independent of its own
     production" is violated literally). Contrast with Ch.4's founding anomaly, where *every* clause
     was literally satisfied while a distinction was lost — there the Constitution could not bite and
     an architectural layer (F1) was necessary; here it bites, so what's needed is conformance/policy,
     not architecture. The Ch.4-necessity shape is absent.
  2. **"Curating authority" absent from the Entity Taxonomy** — entity status is earned by being
     computed-over (Evaluator has identity because reliability is computed from its history). No
     contract reads curator identity/history → a role in governance actions, not an ontology entity.
     The Evaluator-parallel lead dies by the same criterion.
  3. **Ch.2 closure not pinned to confirmed-only** — malformed: there is no runtime-readable
     confirmed-state to pin to; the snapshot is the curated structure at a version; protection is
     carried by Content Item/Attribution gates; proposed nodes are inert.
  4. **Ch.3 "available Concept" hook** — grounding gates live on evidence-bearing entities; the hook
     never crystallizes into a dependency.
  5. **§10 gives Concept a proposed→confirmed lifecycle nothing reads** — §10 describes curation
     trajectories; lifecycle states are heterogeneous *consistently*: runtime-read states live
     exactly on evidence-bearing entities (Content Item), governance-only states (Concept, Source)
     are read by nothing. Editorial observation at most.
  Non-anomalies remaining: Ch.1 §11's defer note is an *expectation* in frozen text, not an
  unexplained phenomenon (and may be satisfiable by policy rather than a chapter — a question that
  waits for a real anomaly); B1/B2 belong to other frontiers, already tracked.
  **Disposition: Discovery complete (for this frontier). The frontier produced no architectural
  necessity.** Not "Chapter 5 cancelled," not "governance wins" — governance is NOT opened as a new
  frontier (no anomaly licenses it). **Reopening condition: a new anomaly with evidence** (e.g. real
  multi-curator conflict producing a phenomenon Baseline cannot state), never a new idea. This is
  evidence-relative closure: current evidence demands no further explanation — not a proof that
  nothing will ever be found here.

**3.**
- Observation: Identity/Account layer is explicitly scoped out of Ch.1 (`BASELINE_ARCHITECTURE.md`
  §9, Finding A).
- Why it matters: determines whether Identity is semantic (Type I — new authority) or relational
  (Type II — like Ch.4, a boundary/lifting concern) — the two require different discovery methods.
- Unknown: semantic or relational?
- Required proof: family test (§6, `ARCHITECTURE_RETROSPECTIVE.md`) before any other test.
- Current status: **removal test run (2026-07-10, landscape discovery) — ELIMINATED at baseline.**
  Learning ontology is complete without it; already pre-classified as infrastructure/platform by
  Finding A (`BASELINE_ARCHITECTURE.md` §9). One thin seam remains (the learner↔account binding
  when data is erased). **Correction (2026-07-10, ARB review):** do not call this seam "subsumed by
  5.9" — 5.9 only states the learner controls their data; it says nothing about account merge,
  multi-device, impersonation, guardian accounts, or classroom accounts. Precise status:
  **the seam has no demonstrated necessity yet**, not "resolved elsewhere." Deferred, not closed.

**4.**
- Observation: Data Architecture (storage, the Constitution 5.9 erasure mechanism) is named
  not-started.
- Why it matters: erasure interacts directly with Ch.1 Invariant 4 (append-only) and Ch.2's
  Reconstructability Scope — determines whether Data Architecture needs its own lifecycle or only
  implements an already-bounded guarantee.
- Unknown: does Data Architecture introduce a new independent lifecycle, or only implement a
  scope boundary Ch.1–2 already stated?
- Required proof: irreducibility test against Ch.1 Inv 4 + Ch.2 Reconstructability Scope.
- Current status: **removal test run (2026-07-10, landscape discovery) — ELIMINATED as
  implementation, not a chapter.** The *semantic* constraints on data are already owned by Ch.1–2
  (append-only, reconstructability, versioned Ontology Snapshot); erasure was settled by Ch.2's C4
  review as an observable guarantee agnostic to mechanism. On removal, no *architectural* statement
  is lost — only implementation choices, which are by definition not baseline architecture. Data
  Architecture must *conform to* Ch.1–2, it does not extend them.

**5.**
- Observation: Ch.4 is the only confirmed relation layer so far (n=1) — `lexi_semantic_compression_heuristic`
  in institutional memory notes this isn't yet a pattern.
- Why it matters: whether any Ch.5 candidate turns out relational (not semantic) changes which
  proof family applies, and would be the second data point needed to promote "thin relation layers"
  from observation to convention.
- Unknown: does any candidate above turn out to be a second relation layer?
- Required proof: family test, applied across all candidates once discovery opens.
- Current status: **candidate weakened, likely withdrawn (2026-07-10, second ARB challenge).** The
  item 2 "relation layer" reading didn't survive its own stress test: deleting the proposed→
  confirmed crossing entirely (collapse to instant-confirm, no state transition) left Constitution
  5.8's distinction fully intact — meaning the crossing was never the necessity's source. Separately,
  a candidate lifting invariant for it ("confirmer independent of proposer") was shown to require
  real edits for new confirmer types (community review, self-updating institutional sources) —
  domain-policy content a relation layer cannot carry by construction. Current best read: item 2's
  necessity is a **semantic authority gap** (Curating Authority, referenced in Ch.1 §9 but absent
  from §2's Entity Taxonomy), not a second relation layer. **n is still 1.** Do not treat this as
  resolved either way — the entity-level independence test (does Curating Authority need its own
  identity/contract?) is still to be run and could yet surface a relational component within it.

  **Resolved (2026-07-11, with item 2's closure): candidate WITHDRAWN.** Item 2's frontier closed by
  anomaly exhaustion — no semantic object (and therefore no relation over one) survived the
  falsification chain. **n remains 1** (Ch.4 is still the only relation layer). The
  `lexi_semantic_compression_heuristic` promotion criterion stays unmet; the "thin relation layers"
  pattern remains an observation, exactly as its own sample-size discipline requires.

---

*Add items here as they surface. Remove or graduate an item only when its Required proof has
actually been run — never on the strength of "this seems right."*
