/**
 * Content Validation Service — M3.4
 *
 * Prisma access layer for the content validation engine.
 * Fetches questions and KnowledgeUnits, then delegates all validation
 * logic to the pure engine (contentValidation.ts).
 *
 * Architecture: Prisma only here — the pure engine has no DB access.
 *   contentValidationService (Prisma) → contentValidation (pure) → ValidationResult
 */

import { prisma } from "@/lib/db/prisma";
import type {
  QuestionValidationInput,
  KnowledgeUnitValidationInput,
  QuestionValidationResult,
  CoverageValidationResult,
} from "./validationTypes";
import {
  validateQuestion,
  validateQuestions,
  validateDifficultyDistribution,
} from "./contentValidation";

// ─────────────────────────────────────────────────────────
// Repository queries (private)
// ─────────────────────────────────────────────────────────

async function fetchQuestionsForValidation(
  questionIds?: string[]
): Promise<QuestionValidationInput[]> {
  const rows = await prisma.question.findMany({
    where: questionIds ? { id: { in: questionIds } } : undefined,
    select: {
      id: true,
      topic: true,
      promptText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctOption: true,
      explanationVi: true,
      difficulty: true,
      knowledgeUnitId: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    difficulty: r.difficulty as "EASY" | "MEDIUM" | "HARD",
  }));
}

async function fetchKnowledgeUnitsForValidation(): Promise<KnowledgeUnitValidationInput[]> {
  return prisma.knowledgeUnit.findMany({
    select: {
      id: true,
      topic: true,
      label: true,
      targetEasyCount: true,
      targetMediumCount: true,
      targetHardCount: true,
    },
  });
}

// ─────────────────────────────────────────────────────────
// Public service functions
// ─────────────────────────────────────────────────────────

/**
 * Validate all questions in the question bank.
 * Returns one result per question, sorted by status (FAIL first).
 */
export async function validateAllQuestions(): Promise<QuestionValidationResult[]> {
  const [questions, units] = await Promise.all([
    fetchQuestionsForValidation(),
    fetchKnowledgeUnitsForValidation(),
  ]);
  const results = validateQuestions(questions, units);
  return results.sort((a, b) => {
    const order = { FAIL: 0, WARNING: 1, PASS: 2 };
    return order[a.status] - order[b.status];
  });
}

/**
 * Validate a single question by id.
 */
export async function validateSingleQuestion(
  questionId: string
): Promise<QuestionValidationResult> {
  const [questions, units] = await Promise.all([
    fetchQuestionsForValidation([questionId]),
    fetchKnowledgeUnitsForValidation(),
  ]);
  if (questions.length === 0) {
    throw new Error(`Question '${questionId}' not found`);
  }
  const unitById = new Map(units.map((u) => [u.id, u]));
  const q = questions[0];
  const unit = q.knowledgeUnitId ? (unitById.get(q.knowledgeUnitId) ?? null) : null;
  return validateQuestion(q, unit);
}

/**
 * Validate the difficulty distribution for a specific KnowledgeUnit.
 * Counts questions by topic (same matching strategy as the coverage engine).
 */
export async function validateKnowledgeUnitCoverage(
  knowledgeUnitId: string
): Promise<CoverageValidationResult> {
  const unit = await prisma.knowledgeUnit.findUnique({
    where: { id: knowledgeUnitId },
    select: {
      id: true,
      topic: true,
      label: true,
      targetEasyCount: true,
      targetMediumCount: true,
      targetHardCount: true,
    },
  });
  if (!unit) throw new Error(`KnowledgeUnit '${knowledgeUnitId}' not found`);

  // Count by topic (not FK) — matches the coverage engine's strategy
  const questions = await prisma.question.findMany({
    where: { topic: unit.topic },
    select: { difficulty: true },
  });

  const actual = {
    easy: questions.filter((q) => q.difficulty === "EASY").length,
    medium: questions.filter((q) => q.difficulty === "MEDIUM").length,
    hard: questions.filter((q) => q.difficulty === "HARD").length,
  };

  return validateDifficultyDistribution({ unit, actual });
}

/**
 * Validate difficulty distribution for all KnowledgeUnits.
 * Returns results sorted: FAIL first, then WARNING, then PASS.
 */
export async function validateAllKnowledgeUnitCoverage(): Promise<CoverageValidationResult[]> {
  const units = await fetchKnowledgeUnitsForValidation();

  const questions = await prisma.question.findMany({
    select: { topic: true, difficulty: true },
  });

  const results = units.map((unit) => {
    const unitQuestions = questions.filter((q) => q.topic === unit.topic);
    const actual = {
      easy: unitQuestions.filter((q) => q.difficulty === "EASY").length,
      medium: unitQuestions.filter((q) => q.difficulty === "MEDIUM").length,
      hard: unitQuestions.filter((q) => q.difficulty === "HARD").length,
    };
    return validateDifficultyDistribution({ unit, actual });
  });

  return results.sort((a, b) => {
    const order = { FAIL: 0, WARNING: 1, PASS: 2 };
    return order[a.status] - order[b.status];
  });
}
