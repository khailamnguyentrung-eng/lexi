/**
 * Generation Quality Evaluation Engine — M4.4
 *
 * Pure deterministic quality checks for GeneratedQuestionDraft content.
 * No Prisma, no AI calls, no embeddings.
 *
 * Three checks:
 *   1. Duplicate risk    — exact or normalized promptText / questionCode collision
 *   2. Topic alignment   — draft topic must match KnowledgeUnit.topic exactly
 *   3. Difficulty consistency — draft difficulty vs. KnowledgeUnit target counts
 *
 * Output: GenerationQualityReport { draftId, score, issues[] }
 *
 * The score and issues are informational — they assist human review and NEVER
 * trigger automatic approval or rejection. Final content decisions are always
 * made by a human via approveDraft() / rejectDraft().
 *
 * Architecture: pure functions only. The optional service layer fetches data
 * from Prisma and passes plain ExistingContentSnapshot[] + KnowledgeUnitEvaluationContext
 * to these functions.
 */

import type {
  QualityIssue,
  QualityIssueSeverity,
  GenerationQualityReport,
  DraftEvaluationInput,
  ExistingContentSnapshot,
  KnowledgeUnitEvaluationContext,
} from "./qualityTypes";

// ─────────────────────────────────────────────────────────
// Score constants
// ─────────────────────────────────────────────────────────

const SCORE_DEDUCTIONS: Record<QualityIssueSeverity, number> = {
  HIGH:   30,
  MEDIUM: 15,
  LOW:     5,
};

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

/**
 * Normalise a prompt for near-duplicate detection:
 * lowercase, collapse all whitespace runs to a single space, trim.
 * Does NOT strip punctuation — punctuation changes meaning in grammar MCQs.
 */
function normalizePrompt(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function getTarget(unit: KnowledgeUnitEvaluationContext, difficulty: "EASY" | "MEDIUM" | "HARD"): number {
  if (difficulty === "EASY")   return unit.targetEasyCount;
  if (difficulty === "MEDIUM") return unit.targetMediumCount;
  return unit.targetHardCount;
}

function getActual(unit: KnowledgeUnitEvaluationContext, difficulty: "EASY" | "MEDIUM" | "HARD"): number {
  if (difficulty === "EASY")   return unit.actualEasyCount;
  if (difficulty === "MEDIUM") return unit.actualMediumCount;
  return unit.actualHardCount;
}

// ─────────────────────────────────────────────────────────
// Check 1: Duplicate risk
// ─────────────────────────────────────────────────────────

/**
 * Detect content that already exists in the bank or review queue.
 *
 * HIGH — exact questionCode match: the same code already identifies another question.
 * HIGH — exact promptText match: the prompt is character-for-character identical.
 * MEDIUM — normalised promptText match: after lowercasing and whitespace collapse,
 *   the prompts are identical (e.g. differ only in casing or extra spaces).
 *   If an exact match is already found, the normalised match is not added separately.
 *
 * Multiple issues are possible (e.g. the code collides with one entry and the
 * prompt with a different entry).
 */
export function checkDuplicates(
  draft: Pick<DraftEvaluationInput, "questionCode" | "promptText">,
  existing: ExistingContentSnapshot[],
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const draftNorm = normalizePrompt(draft.promptText);
  let exactPromptFound = false;

  for (const entry of existing) {
    if (entry.questionCode === draft.questionCode) {
      issues.push({
        type: "DUPLICATE_CODE",
        severity: "HIGH",
        message:
          `Question code "${draft.questionCode}" already exists in the content bank. ` +
          "Approve will fail if the code is not changed.",
      });
    }

    if (entry.promptText === draft.promptText) {
      exactPromptFound = true;
      issues.push({
        type: "DUPLICATE_PROMPT",
        severity: "HIGH",
        message: "An identical prompt text already exists. This question tests the same thing as an existing entry.",
      });
    } else if (!exactPromptFound && normalizePrompt(entry.promptText) === draftNorm) {
      issues.push({
        type: "DUPLICATE_PROMPT_NORMALIZED",
        severity: "MEDIUM",
        message:
          "A near-identical prompt was found (same content, different whitespace/capitalisation). " +
          "Verify this is not a duplicate before approving.",
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// Check 2: Topic alignment
// ─────────────────────────────────────────────────────────

/**
 * Verify the draft's topic exactly matches the KnowledgeUnit it was generated for.
 *
 * HIGH — topic mismatch: the AI changed the topic field to something other than
 *   the requested topic. The draft will be linked to the wrong KnowledgeUnit if approved.
 */
export function checkTopicAlignment(
  draft: Pick<DraftEvaluationInput, "topic">,
  unit: Pick<KnowledgeUnitEvaluationContext, "topic">,
): QualityIssue[] {
  if (draft.topic !== unit.topic) {
    return [
      {
        type: "TOPIC_MISMATCH",
        severity: "HIGH",
        message:
          `Draft topic "${draft.topic}" does not match the target KnowledgeUnit topic "${unit.topic}". ` +
          "Approving will link this question to the wrong coverage record.",
      },
    ];
  }
  return [];
}

// ─────────────────────────────────────────────────────────
// Check 3: Difficulty consistency
// ─────────────────────────────────────────────────────────

/**
 * Compare the draft's difficulty band against the KnowledgeUnit's coverage targets.
 *
 * HIGH — target count is zero for this band: the curriculum never intended questions
 *   at this difficulty for this topic. Generating them is off-plan.
 *
 * MEDIUM — band is already at or above its target: the bank already has enough
 *   questions at this difficulty. New questions add redundancy, not coverage.
 *
 * No issue — band has remaining gap (actual < target and target > 0): this is the
 *   expected case — the draft fills a genuine coverage need.
 */
export function checkDifficultyConsistency(
  draft: Pick<DraftEvaluationInput, "difficulty">,
  unit: KnowledgeUnitEvaluationContext,
): QualityIssue[] {
  const target = getTarget(unit, draft.difficulty);
  const actual = getActual(unit, draft.difficulty);

  if (target === 0) {
    return [
      {
        type: "DIFFICULTY_NO_TARGET",
        severity: "HIGH",
        message:
          `KnowledgeUnit has no target for ${draft.difficulty} questions (targetCount = 0). ` +
          "This question is off-curriculum for this topic and difficulty.",
      },
    ];
  }

  if (actual >= target) {
    return [
      {
        type: "DIFFICULTY_BAND_AT_TARGET",
        severity: "MEDIUM",
        message:
          `The ${draft.difficulty} band already has ${actual} question(s), meeting its target of ${target}. ` +
          "Approving adds redundancy rather than filling a coverage gap.",
      },
    ];
  }

  return [];
}

// ─────────────────────────────────────────────────────────
// Score calculation
// ─────────────────────────────────────────────────────────

/**
 * Compute a 0–100 quality score from a list of issues.
 * Each HIGH issue deducts 30, MEDIUM 15, LOW 5. Clamped to [0, 100].
 * A score of 100 means no issues were detected.
 */
export function computeScore(issues: QualityIssue[]): number {
  const deduction = issues.reduce(
    (sum, issue) => sum + SCORE_DEDUCTIONS[issue.severity],
    0,
  );
  return Math.max(0, 100 - deduction);
}

// ─────────────────────────────────────────────────────────
// Main evaluation entry point
// ─────────────────────────────────────────────────────────

/**
 * Run all three quality checks for a single generated draft and return a
 * consolidated report.
 *
 * @param draft    The draft being evaluated (questionCode, promptText, topic, difficulty)
 * @param existing Snapshots of existing Questions and in-queue drafts to check against
 * @param unit     KnowledgeUnit context including targets and current actual counts
 */
export function evaluateDraft(
  draft: DraftEvaluationInput,
  existing: ExistingContentSnapshot[],
  unit: KnowledgeUnitEvaluationContext,
): GenerationQualityReport {
  const issues: QualityIssue[] = [
    ...checkDuplicates(draft, existing),
    ...checkTopicAlignment(draft, unit),
    ...checkDifficultyConsistency(draft, unit),
  ];

  return {
    draftId: draft.draftId,
    score: computeScore(issues),
    issues,
  };
}
