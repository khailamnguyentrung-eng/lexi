/**
 * Content Validation Engine — M3.4
 *
 * Pure deterministic validation of question content and KnowledgeUnit coverage.
 * No Prisma, no AI, no LLM calls.
 *
 * Three checks:
 *   1. Question completeness  — required fields present and structurally valid
 *   2. Knowledge mapping quality — KnowledgeUnit assignment consistent with topic
 *   3. Difficulty distribution  — actual question counts vs. per-band targets
 *
 * Architecture: pure functions only. The service layer (contentValidationService.ts)
 * fetches data from Prisma and passes plain objects here.
 */

import type {
  QuestionValidationInput,
  KnowledgeUnitValidationInput,
  CoverageValidationInput,
  QuestionValidationResult,
  CoverageValidationResult,
  ValidationIssue,
  ValidationStatus,
} from "./validationTypes";

// ─────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

function deriveStatus(issues: ValidationIssue[]): ValidationStatus {
  if (issues.some((i) => i.severity === "HIGH")) return "FAIL";
  if (issues.length > 0) return "WARNING";
  return "PASS";
}

// ─────────────────────────────────────────────────────────
// Check 1: Question completeness
// ─────────────────────────────────────────────────────────

/**
 * Validate that a question has all required fields with valid values.
 *
 * FAIL (HIGH):
 *   - promptText missing or blank
 *   - any option (A–D) missing or blank
 *   - correctOption not in { A, B, C, D }
 *   - topic missing or blank
 *
 * WARNING (MEDIUM):
 *   - explanationVi missing or blank
 */
export function validateQuestionCompleteness(q: QuestionValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!q.promptText?.trim()) {
    issues.push({
      type: "MISSING_PROMPT",
      severity: "HIGH",
      message: "Question has no prompt text",
    });
  }

  const emptyOptions = (["A", "B", "C", "D"] as const).filter(
    (opt) => !q[`option${opt}` as keyof QuestionValidationInput]?.toString().trim()
  );
  if (emptyOptions.length > 0) {
    issues.push({
      type: "MISSING_OPTION",
      severity: "HIGH",
      message: `Answer option(s) are empty: ${emptyOptions.map((o) => `option${o}`).join(", ")}`,
    });
  }

  if (!VALID_OPTIONS.has(q.correctOption)) {
    issues.push({
      type: "INVALID_CORRECT_OPTION",
      severity: "HIGH",
      message: `correctOption '${q.correctOption}' is not one of A, B, C, D`,
    });
  }

  if (!q.explanationVi?.trim()) {
    issues.push({
      type: "MISSING_EXPLANATION",
      severity: "MEDIUM",
      message: "Question has no Vietnamese explanation (explanationVi is blank)",
    });
  }

  if (!q.topic?.trim()) {
    issues.push({
      type: "MISSING_TOPIC",
      severity: "HIGH",
      message: "Question has no topic",
    });
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// Check 2: Knowledge mapping quality
// ─────────────────────────────────────────────────────────

/**
 * Validate that a question's KnowledgeUnit assignment is consistent.
 *
 * WARNING (MEDIUM):
 *   - knowledgeUnitId is null (not yet formally mapped)
 *
 * FAIL (HIGH):
 *   - knowledgeUnitId is set but the resolved unit is missing (stale FK)
 *   - knowledgeUnitId is set but unit.topic !== question.topic (inconsistent)
 *
 * @param unit  The resolved KnowledgeUnit, or null if not found / not assigned.
 */
export function validateKnowledgeMappingQuality(
  q: QuestionValidationInput,
  unit: KnowledgeUnitValidationInput | null
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!q.knowledgeUnitId) {
    issues.push({
      type: "NOT_MAPPED",
      severity: "MEDIUM",
      message: `Question topic '${q.topic}' is not formally assigned to a KnowledgeUnit`,
    });
    return issues;
  }

  if (!unit) {
    issues.push({
      type: "UNIT_NOT_FOUND",
      severity: "HIGH",
      message: `KnowledgeUnit '${q.knowledgeUnitId}' referenced by question does not exist`,
    });
    return issues;
  }

  if (unit.topic !== q.topic) {
    issues.push({
      type: "TOPIC_MISMATCH",
      severity: "HIGH",
      message: `Question topic '${q.topic}' does not match KnowledgeUnit topic '${unit.topic}'`,
    });
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// Check 3: Difficulty distribution
// ─────────────────────────────────────────────────────────

/**
 * Validate that a KnowledgeUnit's question bank meets per-difficulty targets.
 *
 * HIGH   — HARD questions below target (gaps in high-difficulty content)
 * MEDIUM — MEDIUM questions below target
 * LOW    — EASY questions below target
 *
 * Extra questions above target produce no issue (surplus is fine).
 */
export function validateDifficultyDistribution(
  input: CoverageValidationInput
): CoverageValidationResult {
  const { unit, actual } = input;
  const issues: ValidationIssue[] = [];

  const missingHard = Math.max(0, unit.targetHardCount - actual.hard);
  const missingMedium = Math.max(0, unit.targetMediumCount - actual.medium);
  const missingEasy = Math.max(0, unit.targetEasyCount - actual.easy);

  if (missingHard > 0) {
    issues.push({
      type: "MISSING_HARD_QUESTIONS",
      severity: "HIGH",
      message: `'${unit.label}' needs ${missingHard} more HARD question(s) (has ${actual.hard}, target ${unit.targetHardCount})`,
    });
  }

  if (missingMedium > 0) {
    issues.push({
      type: "MISSING_MEDIUM_QUESTIONS",
      severity: "MEDIUM",
      message: `'${unit.label}' needs ${missingMedium} more MEDIUM question(s) (has ${actual.medium}, target ${unit.targetMediumCount})`,
    });
  }

  if (missingEasy > 0) {
    issues.push({
      type: "MISSING_EASY_QUESTIONS",
      severity: "LOW",
      message: `'${unit.label}' needs ${missingEasy} more EASY question(s) (has ${actual.easy}, target ${unit.targetEasyCount})`,
    });
  }

  return {
    unitId: unit.id,
    topic: unit.topic,
    label: unit.label,
    status: deriveStatus(issues),
    issues,
  };
}

// ─────────────────────────────────────────────────────────
// Composite validator — combines completeness + mapping
// ─────────────────────────────────────────────────────────

/**
 * Run all question-level checks: completeness + knowledge mapping quality.
 * Difficulty distribution is a KnowledgeUnit-level check — call
 * validateDifficultyDistribution() separately with the unit's full question set.
 *
 * @param unit  Pass the resolved KnowledgeUnit if available; null otherwise.
 */
export function validateQuestion(
  q: QuestionValidationInput,
  unit: KnowledgeUnitValidationInput | null = null
): QuestionValidationResult {
  const issues: ValidationIssue[] = [
    ...validateQuestionCompleteness(q),
    ...validateKnowledgeMappingQuality(q, unit),
  ];

  return {
    questionId: q.id,
    status: deriveStatus(issues),
    issues,
  };
}

/**
 * Batch-validate a set of questions.
 * Resolves each question's KnowledgeUnit from the provided units array.
 */
export function validateQuestions(
  questions: QuestionValidationInput[],
  units: KnowledgeUnitValidationInput[]
): QuestionValidationResult[] {
  const unitById = new Map(units.map((u) => [u.id, u]));
  return questions.map((q) => {
    const unit = q.knowledgeUnitId ? (unitById.get(q.knowledgeUnitId) ?? null) : null;
    return validateQuestion(q, unit);
  });
}
