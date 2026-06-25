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
 */

import { prisma } from "@/lib/db/prisma";
import type { ReadinessResult } from "./types";
import { getTopicNotebookSummaries } from "./notebookIntelligence";
import type { TopicNotebookSummary, ImprovementSignal } from "./notebookIntelligence";
import {
  computeTopicMastery,
  countByMasteryState,
} from "./masteryTracking";
import type { MasteryState, TopicMasteryProfile } from "./masteryTracking";
import { getSessionAnalytics } from "./service";
import {
  buildQuestionCountMap,
  computeRecommendations,
} from "@/lib/services/practiceRecommendation";
import type { PracticeRecommendation } from "@/lib/services/practiceRecommendation";
import { getSkillMatrix } from "@/lib/services/skillMatrix";
import { getCurrentMission } from "@/lib/services/curriculum";

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
  nextSessionNumber: number | null;
  nextSessionTitle: string | null;
  nextSessionObjective: string | null;
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
 *   nextSessionNumber  — number of the next curriculum session to advance
 *   nextSessionTitle   — display title of that session
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
  nextSessionNumber: number | null;
  nextSessionTitle: string | null;
  nextSessionObjective: string | null;
}

// ─────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────

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
    nextSessionNumber: ctx.nextSessionNumber,
    nextSessionTitle: ctx.nextSessionTitle,
    nextSessionObjective: ctx.nextSessionObjective,
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
 *             mostRecentCompletedSession, allQuestionTopics
 *   Sequential (if session found): getSessionAnalytics (for readiness + weaknesses)
 *   Pure: mastery derivation, recommendation computation, profile assembly
 */
export async function getStudentLearningProfile(
  userId: string
): Promise<StudentLearningProfile> {
  const [topicSummaries, skillEntries, mission, recentCompleted, allQuestionTopics] =
    await Promise.all([
      getTopicNotebookSummaries(userId),
      getSkillMatrix(userId),
      getCurrentMission(userId),
      prisma.userSessionProgress.findFirst({
        where: { userId, status: "COMPLETED" },
        orderBy: { curriculumSession: { sessionNumber: "desc" } },
        select: {
          curriculumSessionId: true,
          curriculumSession: { select: { sessionNumber: true } },
        },
      }),
      prisma.question.findMany({ select: { topic: true } }),
    ]);

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
  }));

  // Fetch analytics for the most recently completed session
  let readiness: ReadinessResult | null = null;
  let weaknessSignalTopics: { topic: string; label: string; accuracy: number }[] = [];

  if (recentCompleted) {
    try {
      const analytics = await getSessionAnalytics(
        userId,
        recentCompleted.curriculumSessionId,
        recentCompleted.curriculumSession.sessionNumber
      );
      readiness = analytics.readiness;
      weaknessSignalTopics = analytics.weaknessTopics
        .filter((w) => w.accuracy < 0.7)
        .map((w) => ({ topic: w.topic, label: w.label, accuracy: w.accuracy }));
    } catch {
      // Proceed without readiness data if analytics fails
    }
  }

  // Compute recommendations from shared data — no duplicate fetches
  const recommendations = computeRecommendations({
    topicSummaries,
    weaknessSignalTopics,
    nextSessionNumber: mission?.sessionNumber ?? null,
    nextSessionTitle: mission?.title ?? null,
    questionCountByTopic,
    masteryByTopic,
  });

  return buildLearningProfile({
    userId,
    generatedAt: new Date().toISOString(),
    topicSummaries,
    masteryProfiles,
    masteryByTopic,
    recommendations,
    readiness,
    skillSnapshot,
    nextSessionNumber: mission?.sessionNumber ?? null,
    nextSessionTitle: mission?.title ?? null,
    nextSessionObjective: mission?.objective ?? null,
  });
}
