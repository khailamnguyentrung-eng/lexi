import { prisma } from "@/lib/db/prisma";
import type { CurriculumSession, Question } from "@prisma/client";
import {
  computeDifficultyTarget,
  applyDifficultyWeighting,
} from "@/lib/analytics/difficultyCalibration";
import type { AttemptForCalibration } from "@/lib/analytics/difficultyCalibration";
import { canonicalTopic } from "@/lib/analytics";

// Maximum questions served in a single calibrated practice session.
// When the question pool exceeds this, difficulty weighting selects a subset.
// When the pool is at or below this count, all questions are returned as-is.
const TARGET_PRACTICE_COUNT = 10;

// Most sessions have questions directly linked via Question.curriculumSessionId
// (the primary home for a question). A few sessions — checkpoints/mock exams
// that review prior material, or extension sessions with no dedicated test-bank
// items in this small question bank — have none directly linked. Rather than
// showing an empty practice page, fall back to: (1) questions whose topic
// exactly matches one of the session's grammarTopics/vocabThemes (shared
// content with whichever session "owns" that topic), then (2) a broad sample
// across the whole bank so a lesson is never completely empty.
//
// When userId is provided and the session type supports calibration, difficulty
// weighting is applied to select a calibrated subset from the available pool.
// Existing callers that omit userId receive the original behavior unchanged.
export async function getPracticeQuestions(
  session: CurriculumSession & { questions: Question[] },
  userId?: string,
): Promise<Question[]> {
  // ── Resolve base question pool (existing logic, unchanged) ─────────────────
  let questions: Question[];

  if (session.questions.length > 0) {
    questions = session.questions;
  } else {
    const grammarTopics: string[] = session.grammarTopics
      ? JSON.parse(session.grammarTopics)
      : [];
    const vocabThemes: string[] = session.vocabThemes
      ? JSON.parse(session.vocabThemes)
      : [];
    const topicKeywords = [...grammarTopics, ...vocabThemes];

    if (topicKeywords.length > 0) {
      const byTopic = await prisma.question.findMany({
        where: { topic: { in: topicKeywords } },
        take: 15,
      });
      if (byTopic.length > 0) {
        questions = byTopic;
      } else {
        questions = await prisma.question.findMany({
          take: 10,
          orderBy: { questionCode: "asc" },
        });
      }
    } else {
      questions = await prisma.question.findMany({
        take: 10,
        orderBy: { questionCode: "asc" },
      });
    }
  }

  // ── Difficulty calibration (additive — no change when userId is absent) ────

  // Bypass rules: MOCK_EXAM uses full set, CHECKPOINT samples evenly,
  // no userId means no calibration context available.
  const calibrationApplies =
    userId != null &&
    session.sessionType !== "MOCK_EXAM" &&
    session.sessionType !== "CHECKPOINT" &&
    questions.length > TARGET_PRACTICE_COUNT;

  if (calibrationApplies) {
    try {
      // Fetch the student's last 100 attempts across all sessions that have
      // topic overlap with this session's question pool.
      const sessionTopics = new Set(
        questions.map((q) => canonicalTopic(q.topic))
      );

      const rawAttempts = await prisma.questionAttempt.findMany({
        where: { userId: userId! },
        orderBy: { attemptedAt: "desc" },
        take: 100,
        select: {
          isCorrect: true,
          question: { select: { difficulty: true, topic: true } },
        },
      });

      // Keep only attempts on topics present in this session
      const calibrationAttempts: AttemptForCalibration[] = rawAttempts
        .filter((a) => sessionTopics.has(canonicalTopic(a.question.topic)))
        .map((a) => ({
          isCorrect: a.isCorrect,
          difficulty: a.question.difficulty as AttemptForCalibration["difficulty"],
        }));

      const target = computeDifficultyTarget(calibrationAttempts);
      if (target !== null) {
        return applyDifficultyWeighting(questions, target, TARGET_PRACTICE_COUNT);
      }
    } catch {
      // Calibration failure is non-fatal — return the unmodified question set.
    }
  }

  return questions;
}

export async function getPhaseProgress(userId: string) {
  const phases = await prisma.curriculumPhase.findMany({
    orderBy: { order: "asc" },
    include: { sessions: { select: { id: true } } },
  });

  const totalSessions = await prisma.curriculumSession.count();
  const completedSessions = await prisma.userSessionProgress.count({
    where: { userId, status: "COMPLETED" },
  });

  return { phases, totalSessions, completedSessions };
}
