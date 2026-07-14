import { prisma } from "@/lib/db/prisma";
import type { PracticeRecommendation } from "./practiceRecommendation";

/**
 * Decision Procedure identity (Ch.3 §3.1 Fields) — provenance only, never
 * "what did the procedure contain". §3.1: "the identity exists and changes
 * whenever the producing procedure meaningfully does."
 *
 * MAINTENANCE — READ BEFORE EDITING computeRecommendations() or its priority
 * tiers in practiceRecommendation.ts: bump the version suffix below whenever
 * that ranking/priority logic changes. This constant is compared as identity
 * in isSameRecommendation() — if the algorithm changes silently while this
 * stays "#v1", a Recommendation produced by the old logic and one produced by
 * the new logic will be wrongly treated as the same Procedure. There is no
 * automatic versioning (e.g. a source hash) here — this is a manually
 * maintained discipline, not a code guarantee, which is the honest, smallest
 * fix available: this codebase has no other versioning mechanism to attach
 * to (no build-id, no git-sha available at runtime, no config flag).
 */
const PROCEDURE_ID = "computeRecommendations@practiceRecommendation.ts#v1";

/**
 * Goal citation (Basis, Ch.3 §3.1 Fields; Inv 2) — a snapshot of the Goal
 * values in effect at issuance time, taken from LearnerProfile by the caller.
 * Representational/provenance, NOT identity-bearing: a Goal edit (e.g. the
 * learner raises their targetScore) does not by itself make an already-issued
 * Recommendation "a different one" — it is recorded for traceability, never
 * compared in isSameRecommendation().
 */
export interface RecommendationGoalSnapshot {
  targetExam: string | null;
  targetScore: number | null;
  targetGoalDate: Date | null;
}

/**
 * RT-1 ("Consumed", Ch.3 §3.1 Lifecycle): the id of the RecommendationIssuance
 * row that is current after this resolution — the handle a presentation
 * surface needs so the learner's response (accept) can be recorded against
 * the exact issuance it responds to. Null when no recommendation exists.
 * Deliberately returned ALONGSIDE the candidates, never injected into
 * PracticeRecommendation itself — that type belongs to the Computation layer,
 * which must stay ignorant of Issuance.
 */
export interface RecommendationIssuanceResult {
  recommendations: PracticeRecommendation[];
  currentIssuanceId: string | null;
}

/**
 * Identity-bearing content only (Ch.3 §3.1 Fields: Action, Intent, Basis,
 * Procedure). As-of is deliberately excluded — required by the Contract but
 * non-identity, per the reviewed design. Wording/formatting/explanation are
 * representational and never reach this type at all.
 */
interface RecommendationIdentity {
  topic: string | null;
  sessionNumber: number | null;
  suggestedAction: string; // Intent
  priorityLabel: string; // Basis provenance handle
  procedure: string;
}

function buildRecommendationIdentity(top: PracticeRecommendation): RecommendationIdentity {
  return {
    topic: top.topic,
    sessionNumber: top.sessionNumber ?? null,
    suggestedAction: top.suggestedAction,
    priorityLabel: top.priorityLabel,
    procedure: PROCEDURE_ID,
  };
}

function isSameRecommendation(
  a: RecommendationIdentity,
  b: RecommendationIdentity
): boolean {
  return (
    a.topic === b.topic &&
    a.sessionNumber === b.sessionNumber &&
    a.suggestedAction === b.suggestedAction &&
    a.priorityLabel === b.priorityLabel &&
    a.procedure === b.procedure
  );
}

/**
 * Recommendation Issuance boundary (Ch.3 §3.1 Lifecycle — "Published... becoming
 * current. This act is itself logged as Evidence, regardless of which surface
 * eventually displays it.").
 *
 * Sits between Computation (computeRecommendations — pure, unchanged) and
 * Presentation (Home dashboard, Results page). This is the H-1/H-2 reconciliation
 * (PD3 Reading A) — Option B, Phase 3 of 5.
 *
 * Phase 3 (this file): reads the latest RecommendationIssuance for the learner
 * (append-only history — "current" is derived as "most recent row," never a
 * stored flag) and compares its identity-bearing fields against the newly
 * computed candidate. Writes a new row only when there is no previous issuance
 * (Case A) or the identity differs (Case C — supersession, represented solely
 * by the new row existing, never by touching the old one). An identity match
 * (Case B) writes nothing. The candidates are always returned untouched —
 * this function only decides whether to log, never what gets displayed —
 * alongside the current issuance's id (RT-1: the handle surfaces use to
 * record the learner's response against the exact issuance responded to).
 *
 * Phase 4 (Evidence enrichment): on the write path only, the row now also
 * carries the two remaining §3.1 Contract fields — Rationale (reason) and
 * Firmness (confidence). These are representational and NON-identity: they are
 * written but never read by isSameRecommendation(), so the Phase-3 gating is
 * unchanged. Stored so the logged Evidence is a faithful record of the whole
 * Recommendation issued, supporting §3.1 Invariant 5's "stay auditable".
 *
 * Post-implementation audit follow-up: Basis previously had no Goal citation
 * at all (Inv 2 requires every Goal served to be cited; none was). `goal`
 * closes that gap by snapshotting the Goal in effect at issuance time — still
 * enrichment, not identity, same treatment as Rationale/Firmness above.
 *
 * Post-implementation audit follow-up: As-of previously degenerated to write
 * time (asOf === issuedAt always). `evidenceAsOf` — the caller's most recent
 * QuestionAttempt timestamp — replaces it with a real "how fresh is the
 * evidence this reflects" signal. Still not a real Understanding-version
 * identifier (none exists to point to anywhere in this codebase); still
 * non-identity, unchanged in isSameRecommendation().
 */
export async function resolveRecommendationIssuance(
  userId: string,
  candidates: PracticeRecommendation[],
  goal: RecommendationGoalSnapshot,
  evidenceAsOf: Date
): Promise<RecommendationIssuanceResult> {
  const top = candidates[0];
  if (!top) return { recommendations: candidates, currentIssuanceId: null };

  const candidateIdentity = buildRecommendationIdentity(top);

  const latest = await prisma.recommendationIssuance.findFirst({
    where: { userId },
    orderBy: { issuedAt: "desc" },
  });

  if (latest) {
    const latestIdentity: RecommendationIdentity = {
      topic: latest.topic,
      sessionNumber: latest.sessionNumber,
      suggestedAction: latest.suggestedAction,
      priorityLabel: latest.priorityLabel,
      procedure: latest.procedure,
    };

    if (isSameRecommendation(candidateIdentity, latestIdentity)) {
      // Case B: already current. No write — append-only history is untouched.
      // The existing latest row IS the current issuance.
      return { recommendations: candidates, currentIssuanceId: latest.id };
    }
  }

  // Case A (no previous issuance) or Case C (identity differs — supersession,
  // represented solely by this new row's existence).
  const created = await prisma.recommendationIssuance.create({
    data: {
      userId,
      topic: top.topic,
      sessionNumber: top.sessionNumber ?? null,
      suggestedAction: top.suggestedAction,
      priorityLabel: top.priorityLabel,
      procedure: PROCEDURE_ID,
      asOf: evidenceAsOf,
      // Phase 4 enrichment — representational, non-identity (not compared above).
      rationale: top.reason,
      firmness: top.confidence,
      // Goal citation (Basis, Inv 2) — snapshot, not compared above.
      goalTargetExam: goal.targetExam,
      goalTargetScore: goal.targetScore,
      goalTargetDate: goal.targetGoalDate,
      issuedAt: new Date(),
    },
  });

  return { recommendations: candidates, currentIssuanceId: created.id };
}
