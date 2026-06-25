import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canonicalTopic } from "@/lib/analytics";
import { PracticeQuiz } from "../../[sessionNumber]/PracticeQuiz";

export default async function TopicPracticePage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { topic: topicParam } = await params;
  const canonical = canonicalTopic(decodeURIComponent(topicParam));

  const allQuestions = await prisma.question.findMany({
    select: {
      id: true,
      type: true,
      topic: true,
      promptText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
    },
  });

  const questions = allQuestions
    .filter((q) => canonicalTopic(q.topic) === canonical)
    .slice(0, 10);

  if (questions.length === 0) notFound();

  const label = canonical
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">
          Luyện tập: {label}
        </h1>
        <p className="text-sm text-zinc-500">
          {questions.length} câu hỏi về chủ đề này
        </p>
      </div>
      <PracticeQuiz
        questions={questions.map((q) => ({
          id: q.id,
          type: q.type,
          topic: q.topic,
          promptText: q.promptText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
        }))}
        completionHref="/dashboard"
      />
    </div>
  );
}
