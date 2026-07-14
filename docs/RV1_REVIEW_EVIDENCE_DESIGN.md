# RV-1 Reconciliation — Review Action as Evidence

**Status:** Design approved 2026-07-14. Not yet implemented.
**Finding:** RV-1 (Phase 3 conformance audit, Sprint 2) — previously "Confirmed Drift, unreconciled."
**Governing authority:** `LEXI_SYSTEM.md` Ch.3 §3.1 (Recommendation Contract), §3.3 (Policy
Invariants); `LEXI_FOUNDATION.md` 5.4. BI-02 Founder Ruling R-A (review/SM-2 scheduling is within
Ch.3 Decision Policy jurisdiction) is used as-is, not reopened.

---

## 1. Why this design differs from RV-1's original audit conclusion

RV-1 was recorded as a Confirmed Drift on the basis that Review/SM-2 scheduling "fails Q3/Q4/Q5" —
it does not request guidance through Decision Policy / Runtime. That test came from the Sprint-1
**Recommendation Runtime Model**, whose surface-authority rule states a surface may only *request*
Resolution via Runtime, never call Decision Policy directly.

**That framing is not a frozen obligation.** The RT-1 re-scope (2026-07-14) established this
directly, and the same reasoning applies here without modification:

- Ch.1 §0 and the Freeze Scope explicitly exclude *"Storage, indexing, APIs, services, caching"*
  and calling-convention from the frozen architecture.
- Ch.3 §3.4 states the predicates are *"Not a pipeline."*

So "route SM-2 through Decision Policy" is **one way** to satisfy the real invariants — not itself
an invariant. Consistent with RT-1's disposition, the Q3/Q5 calling-convention concern is recorded
here as **not a standalone Ch.1–4 obligation**, and is therefore not tracked as a remaining Drift
under RV-1.

This is a re-scope of what RV-1 *is*, grounded in frozen text — not a reinterpretation of BI-02 and
not a claim that the original audit was careless. BI-02's ruling (review scheduling is within
Decision Policy jurisdiction) still stands and is what makes §3.1/§3.3 binding on this path at all.

## 2. The genuine gap

Checking the two review code paths against the six §3.3 Policy Invariants and the §3.1 contract:

| Path | Assessment |
|---|---|
| `applySM2ForSession()` (`lib/services/errorNotebook.ts`) — session-driven | **No gap.** Triggered by session completion; driven by `QuestionAttempt` rows that are *already* Evidence. The retention update it performs is an Understanding-layer projection over existing Evidence. |
| `mark_reviewed` (`PATCH /api/error-notebook/[id]/route.ts`) — learner-initiated | **Gap.** The learner clicks "Mình đã hiểu rồi, ôn xong!"; the route mutates `reviewStage` / `lastReviewedAt` / `nextReviewAt` / `status` in place and records **no append-only Evidence** of the learner's action. |

The unmet obligation is **§3.3 Invariant 5 / §3.1 Lifecycle "Consumed"** (with Constitution 5.4):
the learner's own response to a recommended Action must be recorded as Evidence. This is the same
family as LX-1 (assistance left no trace) and RT-1 (acceptance left no trace).

**Ontology ruling (Founder, 2026-07-14):** a `mark_reviewed` click **is Evidence** — specifically a
"Consumed"/accepted response to a review-Intent Recommendation, not a Learner Declaration.

Distinguished from PR-2's Reading B (self-reported `weaknesses`/`currentScore` = Learner
Declaration, outside Evidence): PR-2's fields are a **capability self-assessment** ("I am weak at
X") — descriptive, and therefore Understanding's job, which is exactly why they were ruled out of
the Evidence pipeline. `mark_reviewed` asserts no capability; it is a **response to a suggested
action** ("I did the review that was due"). Under BI-02 R-A, "review concept X, it is due" *is* a
Recommendation with `Intent = review`, so responding to it is §3.1 "Consumed" — which the frozen
contract states becomes Evidence. Structurally identical to RT-1's `ACCEPTED`, differing only in
Intent.

## 3. Scope

**Lightweight (LX-1 style).** Record the review action as append-only Evidence. Do **not** build
review-Recommendation issuance.

Today the "due for review" items at `/error-notebook` are computed by SM-2 and displayed directly;
they are never issued through the Option B `RecommendationIssuance` path (which today serves only
practice recommendations on Home/Results). Materialising review items as issued Recommendations and
tying responses to them via FK is a substantially larger build — the review half of the
Recommendation pipeline.

That larger build is **deliberately deferred**, on the RT-1 precedent: RT-1 closed its real Inv-5
gap minimally and explicitly deferred full Runtime orchestration rather than expanding scope. RV-1
does the same. The consequence is stated honestly rather than glossed: the recorded Evidence is
Evidence *of the review engagement*, and is not FK-linked to an issued review Recommendation,
because no such issuance exists to link to.

## 4. What is NOT changed

Explicitly out of scope, and each for a stated reason — not by omission:

- **The in-place retention mutation** (`reviewStage` / `nextReviewAt` / `easeFactor` / `status` on
  `ErrorNotebookEntry`). This is an Understanding-layer retention projection, which is permitted to
  be updated in place. It is not the gap.
- **`lib/services/errorNotebook.ts`** — SM-2 engine and `applySM2ForSession()` untouched.
- **`MarkReviewedButton.tsx`** — no client change needed. Unlike RT-1 (whose accept CTA was a
  navigation action requiring a client component), `mark_reviewed` is already a server PATCH, so
  the Evidence write is purely server-side.
- **Review-Recommendation issuance** — deferred, see §3.
- **The Q3/Q5 "must call via Runtime" concern** — recorded as not a frozen obligation, see §1.

## 5. Data model

New append-only Prisma model. Working name `ReviewEngagement`, **subject to the same
boundary-test naming discipline** LX-1 used before freezing `AssistanceExchange` (candidate names
must be tested against what they permit and forbid; a name implying a mutable request/fulfilment
lifecycle would violate Ch.1 Inv 4 and must be rejected).

```prisma
model ReviewEngagement {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])

  errorNotebookEntryId String
  errorNotebookEntry   ErrorNotebookEntry @relation(fields: [errorNotebookEntryId], references: [id])

  // Snapshot at review time. ErrorNotebookEntry.concept is mutable (the PATCH route's
  // own non-review branch edits it), so an Evidence record must capture what was true
  // when the review happened, never resolve it live later. Same discipline as Option B's
  // Goal citation snapshot.
  concept String

  // Light enrichment — makes the Evidence self-describing ("what did this review
  // accomplish") without any extra query: the route already holds the pre-update entry
  // and computes the new stage. Representational, not identity-bearing.
  reviewStageBefore Int
  reviewStageAfter  Int
  reachedMastery    Boolean

  reviewedAt DateTime @default(now())

  @@index([userId, reviewedAt])
  @@index([errorNotebookEntryId])
}
```

`User` gains `reviewEngagements ReviewEngagement[]`; `ErrorNotebookEntry` gains
`reviewEngagements ReviewEngagement[]`.

Append-only by design (Ch.1 Inv 4): reviewing the same entry twice creates two rows; no row is ever
updated.

## 6. Implementation

One additive write inside the existing `mark_reviewed` branch of
`app/api/error-notebook/[id]/route.ts`, mirroring LX-1's inline
`prisma.assistanceExchange.create()`:

1. The branch already reads `entry` (pre-update) and computes `wasFinalStage` / `newStage`.
2. Perform the existing `errorNotebookEntry.update()` unchanged.
3. Then create the `ReviewEngagement` row using values already in hand:
   - `reviewStageBefore: entry.reviewStage`
   - `reviewStageAfter: newStage`
   - `reachedMastery: wasFinalStage`
   - `concept: entry.concept`

No new service file, no repository layer, no new infrastructure — consistent with LX-1's approved
design (Rule 4: existing models must be proven insufficient before adding new ones; they were —
`ErrorNotebookEntry` is mutable-in-place and cannot carry append-only Evidence, and no generic
event/audit layer exists).

## 7. Error handling

The Evidence write must never make the learner's action fail (Constitution 5.4 — the learner's
response stays effective). Wrap the `create()` so a failure is logged and swallowed, and the route
still returns the successful entry update.

Stated plainly: this means a failed Evidence write produces a silent Evidence gap rather than a
user-visible error. That is the correct trade under 5.4 (the learner's "yes" must take effect), and
matches RT-1's precedent (`keepalive` fetch, failures swallowed, recording never blocks the
action). It is not a claim that the Evidence write is guaranteed.

## 8. Testing

- **Append-only:** reviewing the same entry twice → two rows; neither is mutated.
- **Snapshot integrity:** editing `entry.concept` after a review does not alter the recorded
  `concept` on the existing `ReviewEngagement` row.
- **Enrichment correctness:** `reviewStageBefore`/`After` match the actual transition;
  `reachedMastery` is true exactly when the review advanced the entry to `MASTERED`.
- **Non-blocking:** a failing Evidence write still returns the successful entry update.
- **No regression:** `applySM2ForSession()` writes no `ReviewEngagement` rows (its Evidence is the
  attempts).
- Verification discipline follows LX-1/Option B/RT-1: additive migration inspected (CREATE TABLE +
  indexes only, no ALTER/DROP), `tsc --noEmit` clean, `eslint` clean on touched files, live
  end-to-end click against the seed learner with row inspected and DB cleaned after.

## 9. Audit registry consequence

On completion, RV-1 moves from **Confirmed Drift (unreconciled)** to **partially reconciled**:

- §3.3 Inv 5 / §3.1 "Consumed" gap for the learner-initiated review path: **closed**.
- Q3/Q5 "must route via Decision Policy/Runtime": recorded as **not a standalone Ch.1–4
  obligation** (Sprint-1 architecture choice), so not carried as residual Drift — identical
  disposition to RT-1.
- Review-Recommendation issuance (materialising review items through the Issuance path):
  **open, deferred**, tracked as separate future work alongside RT-1's Runtime orchestration.

## 10. Open, not resolved here

- The frozen entity name (`ReviewEngagement` is a working name pending boundary tests, §5).
- Whether review items should eventually be issued as Recommendations (§3) — a scope decision, not
  an audit finding.
- OVERRIDDEN / IGNORED analogues for review ("learner skipped a due review") — these need the same
  §3.5-open thresholds that blocked RT-1's OVERRIDDEN/IGNORED, and are not addressed.
