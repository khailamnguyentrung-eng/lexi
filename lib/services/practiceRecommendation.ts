import { prisma } from "@/lib/db/prisma";
import {
  getTopicNotebookSummaries,
  getSessionAnalytics,
  findMostRecentlyCompletedScope,
  canonicalTopic,
  computeTopicMastery,
} from "@/lib/analytics";
import type { TopicNotebookSummary, MasteryState } from "@/lib/analytics";
import { getNextMission } from "./program/nextMission";
import type { NextMission } from "./program/nextMission";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type RecommendationPriority =
  | "RECURRING_MISTAKE"
  | "DUE_REVIEW"
  | "WEAKNESS_SIGNAL"
  | "CURRICULUM_PROGRESS";

export type SuggestedAction =
  | "REVIEW_NOTEBOOK"
  | "PRACTICE_TOPIC"
  | "ADVANCE_SESSION";

/**
 * Confidence in a recommendation based on strength of evidence.
 *
 * HIGH:   Strong pattern — multiple recurrences, remedial flag, or very low accuracy
 * MEDIUM: Moderate evidence — some occurrences, concrete signal, or low accuracy
 * LOW:    Weak signal — single occurrence, no post-review data, or borderline accuracy
 */
export type RecommendationConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface PracticeRecommendation {
  topic: string;
  label: string;
  reason: string;
  priority: 1 | 2 | 3 | 4;
  priorityLabel: RecommendationPriority;
  suggestedAction: SuggestedAction;
  questionCount: number;
  mission?: NextMission;
  confidence: RecommendationConfidence;
}

// ─────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────

/**
 * Build a canonical-topic → question count map from raw question topic strings.
 * Pure — no DB access.
 */
export function buildQuestionCountMap(rawTopics: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of rawTopics) {
    const canonical = canonicalTopic(raw);
    map.set(canonical, (map.get(canonical) ?? 0) + 1);
  }
  return map;
}

/**
 * Estimate evidence confidence from a notebook topic summary.
 * Pure — no DB access.
 *
 * HIGH:   RECURRING signal with 3+ total occurrences, or remedial-flagged with 2+ entries
 * MEDIUM: Multiple occurrences with IMPROVED or IMPROVING signal
 * LOW:    Single occurrence, no post-review data, or NO_DATA signal
 */
export function computeNotebookConfidence(
  s: TopicNotebookSummary
): RecommendationConfidence {
  if (s.improvementSignal === "RECURRING" && s.totalOccurrences >= 3) return "HIGH";
  if (s.isRemedialFlagged && s.entryCount >= 2) return "HIGH";
  if (s.totalOccurrences <= 1 || s.improvementSignal === "NO_DATA") return "LOW";
  return "MEDIUM";
}

/**
 * Estimate evidence confidence from a session weakness accuracy.
 * Pure — no DB access.
 *
 * HIGH:   accuracy < 0.50 — clearly struggling
 * MEDIUM: accuracy 0.50–0.59 — below average
 * LOW:    accuracy 0.60–0.69 — borderline (below the 70% threshold but not far off)
 */
export function computeWeaknessConfidence(
  accuracy: number
): RecommendationConfidence {
  if (accuracy < 0.5) return "HIGH";
  if (accuracy < 0.6) return "MEDIUM";
  return "LOW";
}

interface WeaknessSignalInput {
  topic: string;
  label: string;
  accuracy: number;
}

export interface RecommendationContext {
  topicSummaries: TopicNotebookSummary[];
  weaknessSignalTopics: WeaknessSignalInput[];
  nextMission: NextMission | null;
  questionCountByTopic: Map<string, number>;
  /**
   * Optional mastery state per canonical topic (v2 mastery-aware mode).
   *
   * When provided, adjusts priority based on mastery evidence:
   *   MASTERED     → removed from all active recommendation tiers (1, 2, 3)
   *   STABLE       → removed from tier 1 (not shown as a recurring mistake);
   *                  tier 2 (DUE_REVIEW) deferred to after tier 3;
   *                  kept in tier 3 as a learning opportunity
   *   IMPROVING    → unchanged — full priority across all tiers
   *   NEEDS_REVIEW → unchanged — full priority across all tiers
   *
   * When absent, all topics are treated as NEEDS_REVIEW (backward-compatible v1 behavior).
   * Topics not present in the map are also treated as NEEDS_REVIEW.
   */
  masteryByTopic?: Map<string, MasteryState>;
}

/**
 * Compute prioritized recommendations from pre-fetched data.
 * Pure function — no DB access, deterministic.
 *
 * MAINTENANCE — if you change these priority tiers or how a recommendation is
 * selected, bump PROCEDURE_ID's version suffix in
 * lib/services/recommendationIssuance.ts. That constant is compared as
 * Ch.3 §3.1 "Procedure" identity; leaving it unbumped means an old and a new
 * ranking silently register as the same procedure.
 *
 * Priority tiers (mastery-aware v2):
 *   1.  RECURRING_MISTAKE — reviewed but still wrong; NEEDS_REVIEW/IMPROVING only
 *   2.  DUE_REVIEW        — spaced-rep schedule; STABLE topics deferred after tier 3
 *   3.  WEAKNESS_SIGNAL   — session accuracy < 70%; STABLE kept as learning opportunity
 *   3.5 (STABLE DUE_REVIEW) — STABLE topics with due items, if not already in tier 3
 *   4.  CURRICULUM_PROGRESS — next session in the curriculum plan
 *
 * De-duplicates by canonical topic: each topic appears at most once at its
 * highest applicable tier. If a STABLE topic qualifies for both the deferred
 * DUE_REVIEW bucket and tier 3 WEAKNESS_SIGNAL, WEAKNESS_SIGNAL (PRACTICE_TOPIC)
 * takes priority — more actionable for a topic showing accuracy weakness.
 *
 * Maximum 4 recommendations returned.
 */
export function computeRecommendations(
  ctx: RecommendationContext
): PracticeRecommendation[] {
  const seen = new Set<string>();
  const results: PracticeRecommendation[] = [];
  // STABLE topics that are due for review — inserted after tier 3, before tier 4.
  // Not added to `seen` until insertion, so tier 3 WEAKNESS_SIGNAL can claim them first.
  const stableDueBucket: PracticeRecommendation[] = [];

  function getMastery(topic: string): MasteryState | undefined {
    return ctx.masteryByTopic?.get(topic);
  }

  // ── Tier 1: RECURRING_MISTAKE ─────────────────────────────────────────────
  // Skip MASTERED (topic is closed) and STABLE (don't alarm on stable topics).
  for (const s of ctx.topicSummaries) {
    if (s.improvementSignal !== "RECURRING") continue;
    const m = getMastery(s.topic);
    if (m === "MASTERED" || m === "STABLE") continue;
    if (seen.has(s.topic)) continue;
    seen.add(s.topic);
    results.push({
      topic: s.topic,
      label: s.label,
      reason:
        "Bạn đã ôn chủ đề này nhưng vẫn cần luyện thêm — thử lại sẽ giúp bạn vững hơn.",
      priority: 1,
      priorityLabel: "RECURRING_MISTAKE",
      suggestedAction: "PRACTICE_TOPIC",
      questionCount: ctx.questionCountByTopic.get(s.topic) ?? 0,
      confidence: computeNotebookConfidence(s),
    });
  }

  // ── Tier 2: DUE_REVIEW ────────────────────────────────────────────────────
  // Skip MASTERED. Defer STABLE to stableDueBucket (reduced priority after tier 3).
  // STABLE is NOT yet added to `seen` when deferred, so tier 3 can still claim it.
  for (const s of ctx.topicSummaries) {
    if (s.dueCount === 0) continue;
    const m = getMastery(s.topic);
    if (m === "MASTERED") continue;
    if (seen.has(s.topic)) continue;
    const rec: PracticeRecommendation = {
      topic: s.topic,
      label: s.label,
      reason:
        m === "STABLE"
          ? "Chủ đề này đang ổn định — ôn ngắn để giữ vững kiến thức."
          : "Đến lúc ôn lại chủ đề này rồi — đây là lịch ôn hôm nay của bạn.",
      priority: 2,
      priorityLabel: "DUE_REVIEW",
      suggestedAction: "REVIEW_NOTEBOOK",
      questionCount: ctx.questionCountByTopic.get(s.topic) ?? 0,
      confidence: computeNotebookConfidence(s),
    };
    if (m === "STABLE") {
      stableDueBucket.push(rec);
    } else {
      seen.add(s.topic);
      results.push(rec);
    }
  }

  // ── Tier 3: WEAKNESS_SIGNAL ───────────────────────────────────────────────
  // Skip MASTERED. STABLE topics are allowed here as a learning opportunity.
  // If a STABLE topic is in stableDueBucket AND has a weakness signal, WEAKNESS_SIGNAL
  // (PRACTICE_TOPIC) takes priority over the deferred REVIEW_NOTEBOOK — more actionable.
  for (const { topic, label, accuracy } of ctx.weaknessSignalTopics) {
    if (accuracy >= 0.7) continue;
    const m = getMastery(topic);
    if (m === "MASTERED") continue;
    if (seen.has(topic)) continue;
    seen.add(topic);
    const pct = Math.round(accuracy * 100);
    results.push({
      topic,
      label,
      reason: `Bạn trả lời đúng ${pct}% câu hỏi chủ đề này — luyện thêm sẽ giúp bạn vững hơn.`,
      priority: 3,
      priorityLabel: "WEAKNESS_SIGNAL",
      suggestedAction: "PRACTICE_TOPIC",
      questionCount: ctx.questionCountByTopic.get(topic) ?? 0,
      confidence: computeWeaknessConfidence(accuracy),
    });
  }

  // ── Tier 3.5: STABLE DUE_REVIEW (deferred) ───────────────────────────────
  // Insert STABLE due items that weren't claimed by tier 3 WEAKNESS_SIGNAL.
  for (const rec of stableDueBucket) {
    if (!seen.has(rec.topic)) {
      seen.add(rec.topic);
      results.push(rec);
    }
  }

  // ── Tier 4: CURRICULUM_PROGRESS ──────────────────────────────────────────
  if (ctx.nextMission !== null) {
    const missionTopic = `program_slot_${ctx.nextMission.order}`;
    if (!seen.has(missionTopic)) {
      results.push({
        topic: missionTopic,
        label: ctx.nextMission.title,
        reason: "Tiếp tục lộ trình — bài học tiếp theo đang chờ bạn.",
        priority: 4,
        priorityLabel: "CURRICULUM_PROGRESS",
        suggestedAction: "ADVANCE_SESSION",
        questionCount: 0,
        mission: ctx.nextMission,
        confidence: "MEDIUM",
      });
    }
  }

  return results.slice(0, 4);
}

// ─────────────────────────────────────────────────────────
// Repository function
// ─────────────────────────────────────────────────────────

/**
 * Fetch all data needed for recommendations and compute them.
 *
 * Data fetched in parallel:
 *   - Notebook topic summaries (improvement signals, due items)
 *   - Current mission (next curriculum session)
 *   - Most recently completed session (for weakness signals)
 *   - All question topics (for count map)
 *
 * Mastery is derived from the already-fetched notebook summaries using
 * computeTopicMastery() — no additional DB query.
 *
 * Then: fetches session analytics for the most recent completed session
 * to extract weakness signals (tier 3).
 */
export async function getAdaptiveRecommendations(
  userId: string
): Promise<PracticeRecommendation[]> {
  const [topicSummaries, mission, recentCompleted, allQuestionTopics] =
    await Promise.all([
      getTopicNotebookSummaries(userId),
      getNextMission(userId),
      findMostRecentlyCompletedScope(userId),
      prisma.question.findMany({ select: { topic: true } }),
    ]);

  const questionCountByTopic = buildQuestionCountMap(
    allQuestionTopics.map((q) => q.topic)
  );

  // Derive mastery from already-fetched summaries — no extra DB query.
  // Topics not in the notebook have no mastery context (treated as NEEDS_REVIEW by default).
  const masteryByTopic = new Map<string, MasteryState>(
    topicSummaries.map((s) => [s.topic, computeTopicMastery(s)])
  );

  let weaknessSignalTopics: WeaknessSignalInput[] = [];

  if (recentCompleted) {
    try {
      const analytics = await getSessionAnalytics(userId, recentCompleted.programCurriculumId, recentCompleted.label);
      weaknessSignalTopics = analytics.weaknessTopics
        .filter((w) => w.accuracy < 0.7)
        .map((w) => ({
          topic: w.topic,
          label: w.label,
          accuracy: w.accuracy,
        }));
    } catch {
      // Proceed without weakness signals if analytics fails (e.g. no attempts yet)
    }
  }

  return computeRecommendations({
    topicSummaries,
    weaknessSignalTopics,
    nextMission: mission,
    questionCountByTopic,
    masteryByTopic,
  });
}
