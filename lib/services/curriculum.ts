import { prisma } from "@/lib/db/prisma";
import type { CurriculumSession, Question } from "@prisma/client";

export async function getCurrentMission(userId: string) {
  const completed = await prisma.userSessionProgress.findMany({
    where: { userId, status: "COMPLETED" },
    select: { curriculumSessionId: true },
  });
  const completedIds = new Set(completed.map((c) => c.curriculumSessionId));

  const sessions = await prisma.curriculumSession.findMany({
    orderBy: { sessionNumber: "asc" },
    include: { phase: true },
  });

  const next = sessions.find((s) => !completedIds.has(s.id));
  return next ?? sessions[0] ?? null;
}

// Most sessions have questions directly linked via Question.curriculumSessionId
// (the primary home for a question). A few sessions — checkpoints/mock exams
// that review prior material, or extension sessions with no dedicated test-bank
// items in this small question bank — have none directly linked. Rather than
// showing an empty practice page, fall back to: (1) questions whose topic
// exactly matches one of the session's grammarTopics/vocabThemes (shared
// content with whichever session "owns" that topic), then (2) a broad sample
// across the whole bank so a lesson is never completely empty.
export async function getPracticeQuestions(
  session: CurriculumSession & { questions: Question[] },
): Promise<Question[]> {
  if (session.questions.length > 0) return session.questions;

  const grammarTopics: string[] = session.grammarTopics ? JSON.parse(session.grammarTopics) : [];
  const vocabThemes: string[] = session.vocabThemes ? JSON.parse(session.vocabThemes) : [];
  const topicKeywords = [...grammarTopics, ...vocabThemes];

  if (topicKeywords.length > 0) {
    const byTopic = await prisma.question.findMany({
      where: { topic: { in: topicKeywords } },
      take: 15,
    });
    if (byTopic.length > 0) return byTopic;
  }

  return prisma.question.findMany({ take: 10, orderBy: { questionCode: "asc" } });
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
