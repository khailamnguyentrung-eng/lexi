/**
 * Student Learning Profile — unified read model.
 *
 * Aggregates data from all intelligence layers into one coherent view
 * that answers the four key learning questions:
 *   - Where is the student now?       (readiness, masterySummary, skillSnapshot)
 *   - What is improving?              (learningTrend, improvingTopics)
 *   - What needs attention?           (activeWeaknesses)
 *   - What should happen next?        (recommendations, nextSession)
 *
 * Import hierarchy:
 *   This file imports from lib/services/practiceRecommendation, which in turn
 *   imports from lib/analytics (the barrel). To prevent a circular dependency,
 *   this file is intentionally NOT re-exported from lib/analytics/index.ts.
 *   Consumers should import directly:
 *     import { getStudentLearningProfile } from "@/lib/analytics/studentLearningProfile"
 *
 * No duplicate calculations:
 *   getStudentLearningProfile() fetches all shared data once (one Promise.all),
 *   derives mastery inline from the same summaries, and calls computeRecommendations()
 *   directly — reusing the same data that getAdaptiveRecommendations() would fetch.
 *
 * NOT read-only (Option B):
 *   Since Option B, getStudentLearningProfile() resolves the Recommendation
 *   issuance boundary (see resolveRecommendationIssuance, Ch.1 Inv 12) and may
 *   append a RecommendationIssuance Evidence row as a side effect of being
 *   called. This is deliberate: it is the single shared choke point both
 *   consuming surfaces (dashboard, results page) pass through, so issuance
 *   resolution happens exactly once per profile read rather than being
 *   duplicated at each call site. The write is non-blocking (Constitution
 *   5.4) — failure degrades to currentIssuanceId: null rather than throwing —
 *   but it is still a write. Callers that want a pure read must not call this
 *   function; getLearningSignals() (learningSignalEngine.ts) is aware of this
 *   and accepts the side effect rather than working around it.
 */

import { prisma } from "@/lib/db/prisma";
import type { ReadinessResult } from "./types";
import { ConfidenceTier } from "./types";
import { getTopicNotebookSummaries } from "./notebookIntelligence";
import type { TopicNotebookSummary, ImprovementSignal } from "./notebookIntelligence";
import {
  computeTopicMastery,
  countByMasteryState,
} from "./masteryTracking";
import type { MasteryState, TopicMasteryProfile } from "./masteryTracking";
import { getSessionAnalytics } from "./service";
import { findMostRecentlyCompletedScope } from "./repository";
import {
  buildQuestionCountMap,
  computeRecommendations,
} from "@/lib/services/practiceRecommendation";
import type { PracticeRecommendation } from "@/lib/services/practiceRecommendation";
import { resolveRecommendationIssuance } from "@/lib/services/recommendationIssuance";
import { getSkillMatrix } from "@/lib/services/skillMatrix";
import { getNextMission } from "@/lib/services/program/nextMission";
import type { NextMission } from "@/lib/services/program/nextMission";
import { getBehaviorProfile } from "./behaviorEngine";
import type { BehaviorProfile } from "./behaviorEngine";
import { computeLearningSignals } from "./learningSignalEngine";
import type { LearningSignal } from "./learningSignalEngine";
import { getLearningStreak } from "@/lib/services/streak";
import { assembleLearnerModel } from "@/lib/services/learner-intelligence/learnerProfileBuilder";
import type { LearnerModel } from "@/lib/services/learner-intelligence/learnerProfileBuilder";
import type { AttemptRecord, ExplicitPreferences } from "@/lib/services/learner-intelligence/types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * Distribution of mastered and at-risk topics in the student's notebook.
 */
export interface MasterySummary {
  totalTopics: number;
  byState: Record<MasteryState, number>;
  masteredTopics: string[];    // display labels of MASTERED topics
  needsReviewTopics: string[]; // display labels of NEEDS_REVIEW topics (top 5)
}

/**
 * A topic that needs immediate student attention.
 * Derived from notebook summaries: RECURRING signal or NEEDS_REVIEW mastery state.
 * MASTERED topics are always excluded.
 */
export interface ActiveWeakness {
  topic: string;
  label: string;
  signal: ImprovementSignal;
  isRemedialFlagged: boolean;
  dueCount: number;
  masteryState: MasteryState;
  totalOccurrences: number;
}

/**
 * Overall learning trajectory inferred from mastery distribution and signals.
 *
 * PROGRESSING      — clear positive movement: mastered topics present or improving count rising
 * STABLE           — holding steady: no urgent signals, balanced distribution
 * NEEDS_ATTENTION  — recurring mistakes present, or majority of topics NEEDS_REVIEW
 * INSUFFICIENT_DATA — no notebook topics yet (new student)
 */
export type LearningTrend =
  | "PROGRESSING"
  | "STABLE"
  | "NEEDS_ATTENTION"
  | "INSUFFICIENT_DATA";

/**
 * Per-skill accuracy snapshot from the skill matrix.
 */
export interface SkillSnapshot {
  skill: string;
  label: string;
  percentage: number;
  // False when there is no evidence for this skill yet (no SkillMatrixEntry).
  // Consumers must not render `percentage` as a mastery claim when false —
  // "0%" for an unattempted skill collapses Ignorance into Confident-low
  // (LEXI_SYSTEM Ch.2 §2.7; Constitution 5.2/5.10).
  hasData: boolean;
}

/**
 * Countdown to a student's self-declared learning goal deadline
 * (e.g. upcoming exam, end of term, personal milestone).
 * Stored as LearnerProfile.targetGoalDate; null when not set.
 */
export interface GoalCountdown {
  targetGoalDate: string; // ISO date string "YYYY-MM-DD"
  daysRemaining: number;  // positive = future, 0 = today, negative = past
  isUrgent: boolean;      // 0 < daysRemaining <= 30
}

/**
 * The full pre-fetched context passed to buildLearningProfile().
 * Pure input — no DB access after this point.
 */
export interface LearningProfileContext {
  userId: string;
  generatedAt: string;
  topicSummaries: TopicNotebookSummary[];
  masteryProfiles: TopicMasteryProfile[];
  masteryByTopic: Map<string, MasteryState>;
  recommendations: PracticeRecommendation[];
  readiness: ReadinessResult | null;
  skillSnapshot: SkillSnapshot[];
  nextMission: NextMission | null;
  behaviorProfile: BehaviorProfile;
  currentStreak: number;
  targetGoalDate: Date | null;
  // Phase 5 additions (M5.5)
  allAttempts: AttemptRecord[];
  learningSignals: LearningSignal[];
  explicitPreferences?: ExplicitPreferences;
}

/**
 * The unified student learning profile read model.
 *
 * Where is the student now?
 *   readiness       — exam-readiness band and score from most recent session
 *   masterySummary  — topic mastery distribution across the error notebook
 *   skillSnapshot   — per-skill accuracy from the skill matrix
 *
 * What is improving?
 *   learningTrend   — overall trajectory (PROGRESSING / STABLE / NEEDS_ATTENTION / INSUFFICIENT_DATA)
 *   improvingTopics — topics at IMPROVING or STABLE mastery state
 *
 * What needs attention?
 *   activeWeaknesses — RECURRING or NEEDS_REVIEW topics, capped at 5, priority-ordered
 *
 * What should happen next?
 *   recommendations    — up to 4 mastery-aware prioritized recommendations
 *   nextMission        — the next ProgramCurriculum slot to advance to
 */
export interface StudentLearningProfile {
  userId: string;
  generatedAt: string;

  readiness: ReadinessResult | null;
  masterySummary: MasterySummary;
  skillSnapshot: SkillSnapshot[];

  learningTrend: LearningTrend;
  improvingTopics: TopicMasteryProfile[];

  activeWeaknesses: ActiveWeakness[];

  recommendations: PracticeRecommendation[];
  nextMission: NextMission | null;
  behaviorProfile: BehaviorProfile;

  // Phase 2 additions (M2.2–M2.5)
  currentStreak: number;              // consecutive active days from getLearningStreak()
  topSignal: LearningSignal | null;   // highest-priority signal from M2.4; set by two-pass in service
  goalCountdown: GoalCountdown | null; // derived from LearnerProfile.targetGoalDate

  // Phase 5 additions (M5.5)
  learnerModel: LearnerModel;          // five-engine intelligence snapshot

  // RT-1 ("Consumed", Ch.3 §3.1): id of the RecommendationIssuance row that is
  // current for this learner — the handle presentation surfaces use to record
  // the learner's response (accept) against the exact issuance responded to.
  // Null when no recommendation exists.
  currentRecommendationIssuanceId: string | null;
}

// ─────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────

/**
 * Compute goal countdown from a stored goal date and the current time.
 * Pure — no DB access. Takes `now` as a parameter for testability.
 *
 * daysRemaining uses Math.ceil so that "less than one full day left" rounds
 * up to 1, not 0 (a student with 23 hours remaining still has "1 day left").
 */
export function computeGoalCountdown(
  targetGoalDate: Date | null,
  now: Date
): GoalCountdown | null {
  if (!targetGoalDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil(
    (targetGoalDate.getTime() - now.getTime()) / msPerDay
  );
  return {
    targetGoalDate: targetGoalDate.toISOString().split("T")[0],
    daysRemaining,
    isUrgent: daysRemaining > 0 && daysRemaining <= 30,
  };
}

/**
 * Build mastery summary from mastery profiles.
 * Pure — no DB access.
 */
export function buildMasterySummary(
  profiles: TopicMasteryProfile[]
): MasterySummary {
  const byState = countByMasteryState(profiles);
  return {
    totalTopics: profiles.length,
    byState,
    masteredTopics: profiles
      .filter((p) => p.masteryState === "MASTERED")
      .map((p) => p.label),
    needsReviewTopics: profiles
      .filter((p) => p.masteryState === "NEEDS_REVIEW")
      .map((p) => p.label)
      .slice(0, 5),
  };
}

/**
 * Identify topics that need immediate attention.
 * Pure — no DB access.
 *
 * Includes:
 *   - Topics with RECURRING improvement signal (reviewed but still wrong)
 *   - Topics with NEEDS_REVIEW mastery state (struggling, not improving)
 *
 * Excludes MASTERED topics. Input summaries are already priority-ordered
 * (RECURRING → remedial → due → occurrence count), so the cap preserves urgency order.
 */
export function buildActiveWeaknesses(
  summaries: TopicNotebookSummary[],
  masteryByTopic: Map<string, MasteryState>
): ActiveWeakness[] {
  const weaknesses: ActiveWeakness[] = [];
  for (const s of summaries) {
    if (weaknesses.length >= 5) break;
    const masteryState = masteryByTopic.get(s.topic) ?? "NEEDS_REVIEW";
    if (masteryState === "MASTERED") continue;
    if (s.improvementSignal === "RECURRING" || masteryState === "NEEDS_REVIEW") {
      weaknesses.push({
        topic: s.topic,
        label: s.label,
        signal: s.improvementSignal,
        isRemedialFlagged: s.isRemedialFlagged,
        dueCount: s.dueCount,
        masteryState,
        totalOccurrences: s.totalOccurrences,
      });
    }
  }
  return weaknesses;
}

/**
 * Derive overall learning trend from mastery profiles and recurring signal count.
 * Pure — no DB access.
 *
 * Evaluation order:
 *   INSUFFICIENT_DATA — no notebook topics yet
 *   NEEDS_ATTENTION   — any recurring mistakes, or NEEDS_REVIEW majority
 *   PROGRESSING       — any MASTERED topics, or IMPROVING count ≥ NEEDS_REVIEW
 *   STABLE            — otherwise (balanced, holding steady)
 */
export function deriveLearningTrend(
  profiles: TopicMasteryProfile[],
  recurringCount: number
): LearningTrend {
  if (profiles.length === 0) return "INSUFFICIENT_DATA";

  const counts = countByMasteryState(profiles);
  const positiveCount = counts.MASTERED + counts.STABLE + counts.IMPROVING;

  if (recurringCount > 0 || counts.NEEDS_REVIEW > positiveCount) {
    return "NEEDS_ATTENTION";
  }
  if (counts.MASTERED > 0 || counts.IMPROVING >= counts.NEEDS_REVIEW) {
    return "PROGRESSING";
  }
  return "STABLE";
}

/**
 * Assemble the student learning profile from pre-fetched context.
 * Pure — no DB access.
 */
export function buildLearningProfile(
  ctx: LearningProfileContext
): StudentLearningProfile {
  const masterySummary = buildMasterySummary(ctx.masteryProfiles);

  const recurringCount = ctx.topicSummaries.filter(
    (s) => s.improvementSignal === "RECURRING"
  ).length;
  const learningTrend = deriveLearningTrend(ctx.masteryProfiles, recurringCount);

  const activeWeaknesses = buildActiveWeaknesses(
    ctx.topicSummaries,
    ctx.masteryByTopic
  );

  const improvingTopics = ctx.masteryProfiles.filter(
    (p) => p.masteryState === "IMPROVING" || p.masteryState === "STABLE"
  );

  // Assemble Phase 5 learner model.
  // learningSignals may be [] on first pass — getStudentLearningProfile()
  // overrides this with real signals in the same two-pass pattern as topSignal.
  const learnerModel = assembleLearnerModel({
    masteryProfiles: ctx.masteryProfiles,
    activeWeaknesses,
    learningSignals: ctx.learningSignals,
    attempts: ctx.allAttempts,
    skillAccuracies: ctx.skillSnapshot,
    behaviorProfile: ctx.behaviorProfile,
    explicitPreferences: ctx.explicitPreferences,
  });

  return {
    userId: ctx.userId,
    generatedAt: ctx.generatedAt,
    readiness: ctx.readiness,
    masterySummary,
    skillSnapshot: ctx.skillSnapshot,
    learningTrend,
    improvingTopics,
    activeWeaknesses,
    recommendations: ctx.recommendations,
    nextMission: ctx.nextMission,
    behaviorProfile: ctx.behaviorProfile,
    currentStreak: ctx.currentStreak,
    goalCountdown: computeGoalCountdown(ctx.targetGoalDate, new Date()),
    // topSignal is null here — getStudentLearningProfile() overrides it
    // in a two-pass step after the base profile is built, because
    // computeLearningSignals() requires the completed profile as input.
    topSignal: null,
    learnerModel,
    // Null here — getStudentLearningProfile() overrides it with the id from
    // resolveRecommendationIssuance(), same override pattern as topSignal.
    // The builder stays pure/DB-ignorant.
    currentRecommendationIssuanceId: null,
  };
}

// ─────────────────────────────────────────────────────────
// Repository function
// ─────────────────────────────────────────────────────────

/**
 * Fetch and assemble the full student learning profile.
 *
 * All independent data sources are fetched in a single Promise.all.
 * Mastery is derived inline from the already-fetched notebook summaries
 * (no second call to getTopicNotebookSummaries).
 * Recommendations are computed via computeRecommendations() directly,
 * sharing the same topicSummaries and masteryByTopic — no duplicate fetches
 * compared to getAdaptiveRecommendations().
 *
 * Fetch plan:
 *   Parallel: topicSummaries, skillMatrix, currentMission,
 *             mostRecentCompletedSession, allQuestionTopics, behaviorProfile,
 *             allUserAttempts (for Phase 5 learner model engines)
 *   Sequential (if session found): getSessionAnalytics (for readiness + weaknesses)
 *   Pure: mastery derivation, recommendation computation, profile assembly
 */
export async function getStudentLearningProfile(
  userId: string
): Promise<StudentLearningProfile> {
  const [
    topicSummaries,
    skillEntries,
    mission,
    recentCompleted,
    allQuestionTopics,
    behaviorProfile,
    streak,
    learnerGoalData,
    rawAllAttempts,
  ] = await Promise.all([
    getTopicNotebookSummaries(userId),
    getSkillMatrix(userId),
    getNextMission(userId),
    findMostRecentlyCompletedScope(userId),
    prisma.question.findMany({ select: { topic: true } }),
    getBehaviorProfile(userId).catch(() => ({
      preferredTimeOfDay: null,
      paceProfile: null,
      avgSessionDurationMin: null,
      responseTimeSignal: null,
      recentMoodContext: null,
      sessionCount: 0,
      confidenceTier: ConfidenceTier.OBSERVED,
    })),
    getLearningStreak(userId).catch(() => 0),
    prisma.learnerProfile
      .findUnique({ where: { userId }, select: { targetGoalDate: true, targetExam: true, targetScore: true } })
      .catch(() => null),
    // Phase 5 (M5.5): all attempts for performance + problem-solving engines
    prisma.questionAttempt.findMany({
      where: { userId },
      select: { isCorrect: true, attemptedAt: true },
      orderBy: { attemptedAt: "asc" },
    }).catch(() => [] as { isCorrect: boolean; attemptedAt: Date }[]),
  ]);

  const allAttempts: AttemptRecord[] = rawAllAttempts.map((a) => ({
    isCorrect: a.isCorrect,
    attemptedAt: a.attemptedAt.toISOString(),
  }));

  // Derive mastery from already-fetched summaries — no extra DB query
  const masteryProfiles: TopicMasteryProfile[] = topicSummaries.map((s) => ({
    topic: s.topic,
    label: s.label,
    masteryState: computeTopicMastery(s),
    summary: s,
  }));
  const masteryByTopic = new Map<string, MasteryState>(
    masteryProfiles.map((p) => [p.topic, p.masteryState])
  );

  const questionCountByTopic = buildQuestionCountMap(
    allQuestionTopics.map((q) => q.topic)
  );

  const skillSnapshot: SkillSnapshot[] = skillEntries.map((e) => ({
    skill: e.skill,
    label: e.label,
    percentage: e.percentage,
    hasData: e.hasData,
  }));

  // Fetch analytics for the most recently completed session
  let readiness: ReadinessResult | null = null;
  let weaknessSignalTopics: { topic: string; label: string; accuracy: number }[] = [];

  if (recentCompleted) {
    try {
      const analytics = await getSessionAnalytics(userId, recentCompleted.programCurriculumId, recentCompleted.label);
      readiness = analytics.readiness;
      weaknessSignalTopics = analytics.weaknessTopics
        .filter((w) => w.accuracy < 0.7)
        .map((w) => ({ topic: w.topic, label: w.label, accuracy: w.accuracy }));
    } catch {
      // Proceed without readiness data if analytics fails
    }
  }

  // Compute recommendations from shared data — no duplicate fetches
  const candidateRecommendations = computeRecommendations({
    topicSummaries,
    weaknessSignalTopics,
    nextMission: mission,
    questionCountByTopic,
    masteryByTopic,
  });

  // Issuance boundary (Ch.3 §3.1) — H-1/H-2 reconciliation, Option B Phases 1-4.
  // Goal citation (Basis, Inv 2) snapshotted from the same LearnerProfile fetch
  // already made above for goalCountdown — no duplicate query.
  //
  // As-of: the timestamp of the most recent QuestionAttempt this computation
  // could have reflected — already fetched above (rawAllAttempts) for the
  // Learning Signal engine, so this costs no extra query. This is NOT a real
  // Understanding-version identifier (none exists anywhere in this codebase
  // to point to) — it is the closest available proxy for "how fresh is the
  // evidence this belief reflects," which is what §3.1's "belief is
  // time-relative" rationale for As-of actually cares about. Falls back to
  // the write moment only when a learner has no attempts at all yet (nothing
  // to be "as of").
  const mostRecentEvidenceAt =
    rawAllAttempts.length > 0
      ? rawAllAttempts[rawAllAttempts.length - 1].attemptedAt
      : new Date();

  // Non-blocking per Constitution 5.4 and this file's own convention (see the
  // guarded calls above): an Evidence write must never break the learner's
  // action. Here the "action" is viewing the profile itself, so a transient
  // failure resolving/persisting the RecommendationIssuance degrades to
  // currentIssuanceId: null rather than throwing out of the Promise.all on
  // the dashboard and results pages. Consuming surfaces already treat a null
  // issuance id as "don't record acceptance" (AcceptRecommendationLink falls
  // back to a plain Link) — the recommendation still displays; only the
  // Evidence row is lost, the same trade RV-1 and RT-1 already make.
  const { recommendations, currentIssuanceId } = await resolveRecommendationIssuance(
    userId,
    candidateRecommendations,
    {
      targetExam: learnerGoalData?.targetExam ?? null,
      targetScore: learnerGoalData?.targetScore ?? null,
      targetGoalDate: learnerGoalData?.targetGoalDate ?? null,
    },
    mostRecentEvidenceAt
  ).catch((err) => {
    console.error("[Option B] Failed to resolve RecommendationIssuance", err);
    return { recommendations: candidateRecommendations, currentIssuanceId: null };
  });

  const baseProfile = buildLearningProfile({
    userId,
    generatedAt: new Date().toISOString(),
    topicSummaries,
    masteryProfiles,
    masteryByTopic,
    recommendations,
    readiness,
    skillSnapshot,
    nextMission: mission,
    behaviorProfile,
    currentStreak: streak,
    targetGoalDate: learnerGoalData?.targetGoalDate ?? null,
    // Phase 5 (M5.5): learningSignals starts empty — overridden below after signals are computed
    allAttempts,
    learningSignals: [],
    explicitPreferences: undefined,
  });

  // Two-pass: computeLearningSignals requires the completed profile as input.
  // Override the null/empty placeholders set by buildLearningProfile.
  const signals = computeLearningSignals(baseProfile, streak);

  // Re-assemble learnerModel with real signals so KnowledgeState.confidenceTier
  // benefits from behavioral signal count when topic count is low.
  const learnerModel = assembleLearnerModel({
    masteryProfiles,
    activeWeaknesses: baseProfile.activeWeaknesses,
    learningSignals: signals,
    attempts: allAttempts,
    skillAccuracies: skillSnapshot,
    behaviorProfile,
    explicitPreferences: undefined,
  });

  return {
    ...baseProfile,
    topSignal: signals[0] ?? null,
    learnerModel,
    currentRecommendationIssuanceId: currentIssuanceId,
  };
}
