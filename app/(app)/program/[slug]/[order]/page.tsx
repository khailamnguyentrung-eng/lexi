import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getQuestionPayload, toPublicPayload, type QuestionFormatFields } from "@/lib/services/question-format";
import { PracticeQuiz } from "./PracticeQuiz";

/**
 * Practice a Program lesson slot — the "how" this actually reads live.
 * Queries Question.knowledgeUnitId IN (this slot's linked KUs), not a topic
 * string match: a slot's content is defined by which KnowledgeUnits it
 * covers (possibly several — see the schema's ProgramCurriculumKnowledgeUnit
 * comment), and knowledgeUnitId is the FK the whole KU-1/QM-1 arc this
 * session built exists to make authoritative.
 */
export default async function ProgramSlotPage({
  params,
}: {
  params: Promise<{ slug: string; order: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { slug, order } = await params;
  const orderNum = Number(order);
  if (!Number.isInteger(orderNum)) notFound();

  const program = await prisma.program.findUnique({ where: { slug }, select: { id: true, slug: true } });
  if (!program) notFound();

  const slot = await prisma.programCurriculum.findUnique({
    where: { programId_order: { programId: program.id, order: orderNum } },
    include: { knowledgeUnits: { select: { knowledgeUnitId: true } } },
  });
  if (!slot) notFound();

  const knowledgeUnitIds = slot.knowledgeUnits.map((k) => k.knowledgeUnitId);

  const rawQuestions =
    knowledgeUnitIds.length > 0
      ? await prisma.question.findMany({
          where: { knowledgeUnitId: { in: knowledgeUnitIds } },
          take: 15, // matches the practical cap used elsewhere (e.g. /practice/topic's slice(0,10)) — a review session's worth, not the whole bank
        })
      : [];

  const questions = rawQuestions.flatMap((q) => {
    const payload = getQuestionPayload(q as unknown as QuestionFormatFields);
    if (!payload) return [];
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
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">
          Bài {slot.order}: {slot.title}
        </h1>
        {slot.objective && <p className="text-sm text-zinc-500">{slot.objective}</p>}
      </div>
      <PracticeQuiz
        questions={questions}
        programCurriculumId={slot.id}
        completionHref={`/program/${program.slug}`}
      />
    </div>
  );
}
