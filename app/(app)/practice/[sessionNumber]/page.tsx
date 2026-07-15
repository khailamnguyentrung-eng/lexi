import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getPracticeQuestions } from "@/lib/services/curriculum";
import { getQuestionPayload, toPublicPayload, type QuestionFormatFields } from "@/lib/services/question-format";
import { PracticeQuiz } from "./PracticeQuiz";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ sessionNumber: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sessionNumber } = await params;
  const session = await prisma.curriculumSession.findUnique({
    where: { sessionNumber: Number(sessionNumber) },
    include: { questions: true },
  });

  if (!session) notFound();

  const questions = await getPracticeQuestions(session, user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">
          Buổi {session.sessionNumber}: {session.title}
        </h1>
        <p className="text-sm text-zinc-500">{session.objective}</p>
      </div>
      <PracticeQuiz
        sessionNumber={session.sessionNumber}
        sessionType={session.sessionType}
        curriculumSessionId={session.id}
        questions={questions.flatMap((q) => {
          const payload = getQuestionPayload(q as unknown as QuestionFormatFields);
          if (!payload) return []; // no gradeable payload — see getQuestionPayload's docstring
          return [
            {
              id: q.id,
              type: q.type,
              topic: q.topic,
              promptText: q.promptText,
              responseFormat: q.responseFormat,
              publicPayload: toPublicPayload(q.responseFormat, payload),
            },
          ];
        })}
      />
    </div>
  );
}
