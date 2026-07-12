/**
 * LEXI Lens Service — Phase 6.2 — Stable view contract.
 *
 * Single entry point for all Lens consumers (student dashboard, session results,
 * parent/teacher view). Fetches StudentLearningProfile v3, passes it through
 * the five Lens transformers, and returns a complete LensViewModel.
 *
 * Responsibilities:
 *   - Fetch:       call getStudentLearningProfile(userId)
 *   - Orchestrate: call each Phase 6.1 transformer in order
 *   - Return:      assembled LensViewModel
 *
 * Must NOT:
 *   - Contain intelligence logic (no new inference rules)
 *   - Duplicate anything from Phase 5 engines
 *   - Access DB directly (delegated to getStudentLearningProfile)
 */

import { getStudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import { buildLearnerSummary } from "./learnerSummary";
import { extractLearningInsights } from "./learningInsights";
import { deriveStrengths } from "./strengths";
import { deriveChallenges } from "./challenges";
import { buildLensRecommendations } from "./recommendations";
import type { LensViewModel } from "./types";

// ─────────────────────────────────────────────────────────
// Pure assembly helper
// ─────────────────────────────────────────────────────────

/**
 * Assemble a LensViewModel from a pre-fetched StudentLearningProfile v3.
 * Pure — no DB access. Exported for testing without triggering a real DB fetch.
 *
 * Calls each transformer exactly once.
 * Transformers are independent: no output from one is fed into another.
 */
export function assembleLensViewModel(
  profile: Awaited<ReturnType<typeof getStudentLearningProfile>>
): LensViewModel {
  return {
    summary: buildLearnerSummary(profile),
    insights: extractLearningInsights(profile),
    strengths: deriveStrengths(profile),
    challenges: deriveChallenges(profile),
    recommendations: buildLensRecommendations(profile),
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Service entry point
// ─────────────────────────────────────────────────────────

/**
 * Fetch and assemble the full Lens view for a learner.
 *
 * Flow:
 *   getStudentLearningProfile(userId)  — one DB round-trip via the existing service
 *     → StudentLearningProfile v3
 *     → assembleLensViewModel(profile)
 *     → LensViewModel
 *
 * Callers:
 *   - Student dashboard API route (/api/profile or a dedicated /api/lens endpoint)
 *   - Session results page (top 1–2 insights + recommendations after session completes)
 *   - Parent/teacher view (same output, UI adds additional context)
 */
export async function getLearnerLens(userId: string): Promise<LensViewModel> {
  const profile = await getStudentLearningProfile(userId);
  return assembleLensViewModel(profile);
}
