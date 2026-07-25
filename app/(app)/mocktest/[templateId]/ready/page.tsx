import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PreExamRitual } from "./PreExamRitual";

export default async function MockTestReadyPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { templateId } = await params;
  const template = await prisma.mockTestTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, title: true, totalQuestions: true, timeLimitMin: true },
  });
  if (!template) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-8">
      <PreExamRitual
        templateId={template.id}
        title={template.title}
        totalQuestions={template.totalQuestions}
        timeLimitMin={template.timeLimitMin}
      />
    </div>
  );
}
