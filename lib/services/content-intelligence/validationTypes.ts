/**
 * Content Validation Types — M3.4
 *
 * Shared types for the deterministic content validation engine.
 * No Prisma types cross this boundary — all inputs are plain objects
 * pre-fetched by the service layer.
 *
 * Architecture:
 *   contentValidationService.ts (Prisma) → contentValidation.ts (pure) → these types
 */

// ─────────────────────────────────────────────────────────
// Severity and status
// ─────────────────────────────────────────────────────────

export type ValidationSeverity = "LOW" | "MEDIUM" | "HIGH";

/**
 * PASS    — all checks passed, no issues
 * WARNING — at least one LOW or MEDIUM issue, no HIGH issues
 * FAIL    — at least one HIGH issue
 */
export type ValidationStatus = "PASS" | "WARNING" | "FAIL";

export interface ValidationIssue {
  type: string;         // machine-readable issue code, e.g. "MISSING_PROMPT"
  severity: ValidationSeverity;
  message: string;      // human-readable description for the admin
}

// ─────────────────────────────────────────────────────────
// Question validation
// ─────────────────────────────────────────────────────────

/** Minimal question shape needed by the pure validation engine. */
export interface QuestionValidationInput {
  id: string;
  topic: string;
  promptText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanationVi: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  knowledgeUnitId: string | null;
}

export interface QuestionValidationResult {
  questionId: string;
  status: ValidationStatus;
  issues: ValidationIssue[];
}

// ─────────────────────────────────────────────────────────
// KnowledgeUnit validation
// ─────────────────────────────────────────────────────────

/** Minimal KnowledgeUnit shape needed by the pure validation engine. */
export interface KnowledgeUnitValidationInput {
  id: string;
  topic: string;
  label: string;
  targetEasyCount: number;
  targetMediumCount: number;
  targetHardCount: number;
}

export interface CoverageValidationInput {
  unit: KnowledgeUnitValidationInput;
  actual: { easy: number; medium: number; hard: number };
}

export interface CoverageValidationResult {
  unitId: string;
  topic: string;
  label: string;
  status: ValidationStatus;
  issues: ValidationIssue[];
}
