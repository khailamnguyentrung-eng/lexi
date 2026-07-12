/**
 * Generation Quality Types — M4.4
 *
 * Shared types for the deterministic generation quality evaluation engine.
 * No Prisma types cross this boundary — all inputs are plain objects.
 *
 * Architecture:
 *   qualityEvaluation.ts (pure engine) → these types ← service layer (optional)
 */

// ─────────────────────────────────────────────────────────
// Issues
// ─────────────────────────────────────────────────────────

export type QualityIssueSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface QualityIssue {
  type: string;              // machine-readable code, e.g. "DUPLICATE_CODE"
  severity: QualityIssueSeverity;
  message: string;           // human-readable description for the admin review UI
}

// ─────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────

/**
 * Quality evaluation result for a single generated draft.
 *
 * score: 0–100, where 100 = no issues detected.
 *   Each HIGH issue deducts 30 points, MEDIUM 15, LOW 5. Clamped to [0, 100].
 *   The score is informational — it assists human review and does NOT trigger
 *   automatic approval or rejection.
 */
export interface GenerationQualityReport {
  draftId: string;
  score: number;
  issues: QualityIssue[];
}

// ─────────────────────────────────────────────────────────
// Evaluation inputs (plain objects, no Prisma)
// ─────────────────────────────────────────────────────────

/** Minimal shape of the draft being evaluated. */
export interface DraftEvaluationInput {
  draftId: string;
  questionCode: string;
  promptText: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

/**
 * Minimal snapshot of an existing question or pending draft used for
 * duplicate detection. The caller assembles this from approved Questions
 * and/or other GeneratedQuestionDraft rows in the review queue.
 */
export interface ExistingContentSnapshot {
  questionCode: string;
  promptText: string;
}

/**
 * KnowledgeUnit context required by the consistency and alignment checks.
 * actualXxxCount = current number of approved questions for that difficulty band.
 */
export interface KnowledgeUnitEvaluationContext {
  topic: string;
  targetEasyCount: number;
  targetMediumCount: number;
  targetHardCount: number;
  actualEasyCount: number;   // approved questions already in the bank
  actualMediumCount: number;
  actualHardCount: number;
}
