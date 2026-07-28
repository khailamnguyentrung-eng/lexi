import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { slug } = await params;
  const program = await prisma.program.findUnique({
    where: { slug },
    include: {
      curriculum: {
        orderBy: { order: "asc" },
        include: {
          knowledgeUnits: {
            include: { knowledgeUnit: { select: { id: true, label: true, _count: { select: { questions: true } } } } },
          },
        },
      },
    },
  });
  if (!program) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">{program.title}</h1>
        {program.description && <p className="mt-1 text-sm text-zinc-500">{program.description}</p>}
        <p className="mt-1 text-xs text-zinc-400">{program.curriculum.length} bài học</p>
      </div>

      <div className="flex flex-col gap-2">
        {program.curriculum.map((slot) => {
          const questionCount = slot.knowledgeUnits.reduce((sum, k) => sum + k.knowledgeUnit._count.questions, 0);
          return (
            <Link
              key={slot.id}
              href={`/program/${program.slug}/${slot.order}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm hover:border-lexi-primary"
            >
              <div>
                <p className="font-medium text-foreground">
                  Bài {slot.order}. {slot.title}
                </p>
                {slot.objective && <p className="mt-0.5 text-xs text-zinc-500">{slot.objective}</p>}
                <p className="mt-0.5 text-xs text-zinc-400">
                  {slot.knowledgeUnits.map((k) => k.knowledgeUnit.label).join(" · ") || "(chưa gắn chủ điểm)"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-zinc-400">{questionCount} câu</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
