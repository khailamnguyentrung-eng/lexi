import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { MarkReviewedButton } from "./MarkReviewedButton";
import { LensFloatingAssistant } from "@/components/lens/LensFloatingAssistant";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Mới",
  REVIEWING: "Đang ôn",
  MASTERED: "Đã nắm vững",
};

export default async function ErrorEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const entry = await prisma.errorNotebookEntry.findFirst({
    where: { id, userId: user.id },
    include: { question: true },
  });

  if (!entry) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="rounded-3xl border border-zinc-100 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">{entry.concept}</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            {STATUS_LABEL[entry.status]}
          </span>
        </div>

        {entry.question && (
          <p className="mb-3 rounded-xl bg-lexi-soft p-3 text-sm text-foreground">
            {entry.question.promptText}
          </p>
        )}

        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="font-medium text-zinc-500">Bạn đã trả lời</dt>
            <dd className="text-rose-600">{entry.studentAnswer}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Đáp án đúng</dt>
            <dd className="text-emerald-600">{entry.correctAnswer}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Vì sao sai</dt>
            <dd>{entry.reason}</dd>
          </div>
          {entry.question?.commonMistake && (
            <div>
              <dt className="font-medium text-zinc-500">Lỗi thường gặp</dt>
              <dd>{entry.question.commonMistake}</dd>
            </div>
          )}
        </dl>

        {entry.status !== "MASTERED" && (
          <div className="mt-5">
            <MarkReviewedButton entryId={entry.id} />
          </div>
        )}
      </div>

      {/* Lens — available during error review to dig deeper into the mistake */}
      <div className="rounded-3xl border border-zinc-100 bg-white p-6">
        <p className="mb-3 text-xs text-zinc-500">Vẫn còn thắc mắc về lỗi này?</p>
        <LensFloatingAssistant />
      </div>
    </div>
  );
}
