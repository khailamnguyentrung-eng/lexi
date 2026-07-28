/**
 * Mock test attempt lifecycle: start → answer (per question, no reveal) →
 * submit (score, reveal). No separate AnswerRecord table — every submitted
 * answer is a QuestionAttempt tagged with mockTestAttemptId, reusing the
 * grading core (getQuestionPayload/gradeResponse) QM-1 already built. See
 * the schema's "MOCK TEST" section header for why.
 *
 * Re-answering a question during a test APPENDS a new QuestionAttempt rather
 * than updating/deleting the previous one — QuestionAttempt is Evidence
 * (Ch.1 Invariant 4: append-only, matching every other Evidence table in
 * this schema — ReviewEngagement, RecommendationIssuance, AssistanceExchange
 * are all append-only for the same reason). Scoring reads only the LATEST
 * QuestionAttempt per question within the attempt — the same "most-recent-
 * row-wins" idiom RecommendationIssuance already uses for "current", not a
 * new pattern.
 */

import { prisma } from "@/lib/db/prisma";
import {
  getQuestionPayload,
  gradeResponse,
  toPublicPayload,
  type PublicQuestionPayload,
  type QuestionFormatFields,
  type QuestionPayload,
  type QuestionResponse,
  type ResponseFormatName,
} from "@/lib/services/question-format";

export class MockTestStateError extends Error {}

export interface AttemptQuestionView {
  slotOrder: number;
  questionId: string;
  type: string;
  topic: string;
  promptText: string;
  responseFormat: ResponseFormatName;
  publicPayload: PublicQuestionPayload;
}

export interface StartedAttempt {
  attemptId: string;
  timeLimitMin: number;
  startedAt: Date;
  questions: AttemptQuestionView[];
}

/**
 * Start a new attempt at a template. Always creates a fresh MockTestAttempt
 * — resuming an existing IN_PROGRESS one is a separate, explicit function
 * (resumeAttempt) so a learner accidentally double-clicking "start" doesn't
 * silently abandon their in-progress test.
 */
export async function startAttempt(userId: string, templateId: string): Promise<StartedAttempt> {
  const template = await prisma.mockTestTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { questions: { orderBy: { order: "asc" }, include: { question: true } } },
  });

  const attempt = await prisma.mockTestAttempt.create({
    data: { userId, templateId },
  });

  const questions = buildQuestionViews(template.questions);

  return { attemptId: attempt.id, timeLimitMin: template.timeLimitMin, startedAt: attempt.startedAt, questions };
}

/** Resume an IN_PROGRESS attempt the learner already started. */
export async function resumeAttempt(userId: string, attemptId: string): Promise<StartedAttempt> {
  const attempt = await prisma.mockTestAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      template: { include: { questions: { orderBy: { order: "asc" }, include: { question: true } } } },
    },
  });
  if (attempt.userId !== userId) throw new MockTestStateError("Not your attempt");
  if (attempt.status !== "IN_PROGRESS") throw new MockTestStateError("Attempt already submitted");

  const questions = buildQuestionViews(attempt.template.questions);
  return { attemptId: attempt.id, timeLimitMin: attempt.template.timeLimitMin, startedAt: attempt.startedAt, questions };
}

function buildQuestionViews(
  slots: { order: number; question: QuestionFormatFields & { id: string; type: string; topic: string; promptText: string } }[]
): AttemptQuestionView[] {
  return slots.flatMap(({ order, question }) => {
    const payload = getQuestionPayload(question);
    if (!payload) return []; // no gradeable payload — skip, matching PracticeQuiz's page.tsx
    return [
      {
        slotOrder: order,
        questionId: question.id,
        type: question.type,
        topic: question.topic,
        promptText: question.promptText,
        responseFormat: question.responseFormat,
        publicPayload: toPublicPayload(question.responseFormat, payload),
      },
    ];
  });
}

/**
 * Record one answer. Grades it immediately (so scoring at submit time is
 * cheap and deterministic) but returns NOTHING about correctness — a real
 * exam doesn't tell you mid-test. The grade lives only in the database until
 * submitAttempt() reveals it.
 */
export async function submitAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  response: QuestionResponse,
  timeSpentSec: number | null
): Promise<void> {
  const attempt = await prisma.mockTestAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  if (attempt.userId !== userId) throw new MockTestStateError("Not your attempt");
  if (attempt.status !== "IN_PROGRESS") throw new MockTestStateError("Attempt already submitted");

  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  const payload = getQuestionPayload(question as unknown as QuestionFormatFields);
  if (!payload) throw new MockTestStateError("Question has no gradeable payload");

  const grade = gradeResponse(question.responseFormat, payload, response);
  const selectedOption =
    question.responseFormat === "SINGLE_CHOICE"
      ? ((response as { optionId?: string })?.optionId ?? "")
      : `[${question.responseFormat}]`;

  await prisma.questionAttempt.create({
    data: {
      userId,
      questionId,
      mockTestAttemptId: attemptId,
      selectedOption,
      response: JSON.stringify(response),
      isCorrect: grade.isCorrect,
      score: grade.score,
      timeSpentSec,
    },
  });
}

export interface ResultQuestion {
  slotOrder: number;
  questionId: string;
  promptText: string;
  responseFormat: ResponseFormatName;
  answered: boolean;
  isCorrect: boolean;
  score: number;
  submittedResponse: QuestionResponse | null;
  correctPayload: QuestionPayload | null;
  explanationVi: string;
}

export interface MockTestResults {
  attemptId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  startedAt: Date;
  submittedAt: Date;
  questions: ResultQuestion[];
}

/**
 * Finalize an attempt: read the LATEST QuestionAttempt per question (the
 * append-only "most recent wins" read), compute the aggregate score, mark
 * SUBMITTED, and return the full per-question review — this is the one
 * moment correctness is revealed.
 *
 * Idempotent-safe: calling submit twice on an already-SUBMITTED attempt
 * returns the same stored result rather than re-scoring (re-scoring would
 * let a learner keep answering after "submitting" by racing this endpoint).
 */
export async function submitAttempt(userId: string, attemptId: string): Promise<MockTestResults> {
  const attempt = await prisma.mockTestAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      template: { include: { questions: { orderBy: { order: "asc" }, include: { question: true } } } },
    },
  });
  if (attempt.userId !== userId) throw new MockTestStateError("Not your attempt");

  if (attempt.status === "SUBMITTED") {
    return buildResultsFromStoredAttempt(attempt);
  }

  const slots = attempt.template.questions;
  const results: ResultQuestion[] = [];
  let correctCount = 0;
  let scoreSum = 0;

  for (const slot of slots) {
    const latest = await prisma.questionAttempt.findFirst({
      where: { mockTestAttemptId: attemptId, questionId: slot.questionId },
      orderBy: { attemptedAt: "desc" },
    });
    const payload = getQuestionPayload(slot.question as unknown as QuestionFormatFields);
    if (latest?.isCorrect) correctCount++;
    if (latest) scoreSum += latest.score ?? (latest.isCorrect ? 1 : 0);

    results.push({
      slotOrder: slot.order,
      questionId: slot.questionId,
      promptText: slot.question.promptText,
      responseFormat: slot.question.responseFormat,
      answered: latest !== null,
      isCorrect: latest?.isCorrect ?? false,
      score: latest?.score ?? 0,
      submittedResponse: latest?.response ? JSON.parse(latest.response) : null,
      correctPayload: payload,
      explanationVi: slot.question.explanationVi,
    });
  }

  const totalCount = slots.length;
  const overallScore = totalCount > 0 ? scoreSum / totalCount : 0;

  const submitted = await prisma.mockTestAttempt.update({
    where: { id: attemptId },
    data: { status: "SUBMITTED", submittedAt: new Date(), score: overallScore, correctCount, totalCount },
  });

  return {
    attemptId,
    score: overallScore,
    correctCount,
    totalCount,
    startedAt: attempt.startedAt,
    submittedAt: submitted.submittedAt!,
    questions: results,
  };
}

/**
 * Read-only: view a SUBMITTED attempt's results. Deliberately does NOT call
 * submitAttempt() as a fallback for an IN_PROGRESS one — a page VIEW must
 * never have the side effect of ENDING a test. A learner navigating to the
 * results URL early (back button, a stray bookmark) gets a clear "not
 * submitted yet" error, not an accidental submission.
 */
export async function getResults(userId: string, attemptId: string): Promise<MockTestResults> {
  const attempt = await prisma.mockTestAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      template: { include: { questions: { orderBy: { order: "asc" }, include: { question: true } } } },
    },
  });
  if (attempt.userId !== userId) throw new MockTestStateError("Not your attempt");
  if (attempt.status !== "SUBMITTED") throw new MockTestStateError("Attempt not submitted yet");

  return buildResultsFromStoredAttempt(attempt);
}

/** Rebuild the same result shape from an already-SUBMITTED attempt's stored aggregate + Evidence rows. */
async function buildResultsFromStoredAttempt(
  attempt: Awaited<ReturnType<typeof prisma.mockTestAttempt.findUniqueOrThrow>> & {
    template: {
      questions: {
        order: number;
        questionId: string;
        question: QuestionFormatFields & {
          id: string;
          promptText: string;
          responseFormat: ResponseFormatName;
          explanationVi: string;
        };
      }[];
    };
  }
): Promise<MockTestResults> {
  const results: ResultQuestion[] = [];
  for (const slot of attempt.template.questions) {
    const latest = await prisma.questionAttempt.findFirst({
      where: { mockTestAttemptId: attempt.id, questionId: slot.questionId },
      orderBy: { attemptedAt: "desc" },
    });
    const payload = getQuestionPayload(slot.question);
    results.push({
      slotOrder: slot.order,
      questionId: slot.questionId,
      promptText: slot.question.promptText,
      responseFormat: slot.question.responseFormat,
      answered: latest !== null,
      isCorrect: latest?.isCorrect ?? false,
      score: latest?.score ?? 0,
      submittedResponse: latest?.response ? JSON.parse(latest.response) : null,
      correctPayload: payload,
      explanationVi: slot.question.explanationVi,
    });
  }
  return {
    attemptId: attempt.id,
    score: attempt.score ?? 0,
    correctCount: attempt.correctCount ?? 0,
    totalCount: attempt.totalCount ?? 0,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt!,
    questions: results,
  };
}
