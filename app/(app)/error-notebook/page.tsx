import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTopicNotebookSummaries } from "@/lib/analytics";
import type { TopicNotebookSummary, ImprovementSignal } from "@/lib/analytics";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Mới",
  REVIEWING: "Đang ôn",
  MASTERED: "Đã nắm vững",
};

const SIGNAL_STYLE: Record<
  ImprovementSignal,
  { badge: string; text: string }
> = {
  IMPROVED:  { badge: "bg-emerald-100 text-emerald-700", text: "Đã cải thiện" },
  IMPROVING: { badge: "bg-lexi-soft text-lexi-primary-dark", text: "Đang tiến bộ" },
  RECURRING: { badge: "bg-amber-100 text-amber-700", text: "Cần luyện thêm" },
  NO_DATA:   { badge: "bg-zinc-100 text-zinc-600", text: "Chưa thực hành lại" },
};

export default async function ErrorNotebookPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [entries, topicSummaries] = await Promise.all([
    prisma.errorNotebookEntry.findMany({
      where: { userId: user.id },
      orderBy: [{ nextReviewAt: "asc" }, { createdAt: "desc" }],
    }),
    getTopicNotebookSummaries(user.id),
  ]);

  const now = new Date();
  const due = entries.filter((e) => e.status !== "MASTERED" && e.nextReviewAt && e.nextReviewAt <= now);
  const upcoming = entries.filter((e) => !due.includes(e));

  // Topics that need active attention: still recurring after review, or due today
  const priorityTopics = topicSummaries
    .filter((s) => s.improvementSignal === "RECURRING" || s.dueCount > 0)
    .slice(0, 3);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-lexi-primary-dark">Sổ lỗi sai</h1>
        <Link
          href="/error-notebook/new"
          className="rounded-full bg-lexi-primary px-4 py-2 text-sm font-medium text-white hover:bg-lexi-primary-dark"
        >
          + Ghi lỗi mới
        </Link>
      </div>

      {entries.length === 0 && (
        <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
          Chưa có lỗi nào được ghi lại. Khi bạn làm sai một câu, hãy ghi lại ở đây để Lexi giúp bạn ôn tập đúng lúc.
        </p>
      )}

      {/* ── Chủ đề cần chú ý — intelligence summary (new) ── */}
      {priorityTopics.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-lexi-primary-dark">
            Chủ đề cần chú ý ({priorityTopics.length})
          </h2>
          <div className="flex flex-col gap-2">
            {priorityTopics.map((topic) => (
              <PriorityTopicCard key={topic.topic} topic={topic} />
            ))}
          </div>
        </section>
      )}

      {due.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
            Cần ôn lại hôm nay ({due.length})
          </h2>
          <div className="flex flex-col gap-2">
            {due.map((entry) => (
              <EntryCard key={entry.id} entry={entry} highlight />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tất cả lỗi đã ghi
          </h2>
          <div className="flex flex-col gap-2">
            {upcoming.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PriorityTopicCard({ topic }: { topic: TopicNotebookSummary }) {
  const signal = SIGNAL_STYLE[topic.improvementSignal];
  const isRecurring = topic.improvementSignal === "RECURRING";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isRecurring ? "border-amber-200 bg-amber-50" : "border-zinc-100 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{topic.label}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${signal.badge}`}>
          {signal.text}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {topic.totalOccurrences} lần sai đã ghi
        {topic.dueCount > 0 && ` · ${topic.dueCount} mục cần ôn hôm nay`}
      </p>
      {isRecurring && topic.preReviewAccuracy !== null && topic.postReviewAccuracy !== null && (
        <p className="mt-1 text-xs text-amber-700">
          Độ chính xác sau khi ôn: {Math.round(topic.postReviewAccuracy * 100)}%
          {topic.preReviewAccuracy > 0 &&
            ` (trước: ${Math.round(topic.preReviewAccuracy * 100)}%)`}
        </p>
      )}
      <Link
        href={`/chat?topic=${encodeURIComponent(topic.label)}`}
        className="mt-3 inline-block text-xs font-medium text-lexi-primary-dark underline underline-offset-2"
      >
        Ôn tập ngay →
      </Link>
    </div>
  );
}

function EntryCard({
  entry,
  highlight,
}: {
  entry: {
    id: string;
    concept: string;
    reason: string;
    status: string;
    occurrenceCount: number;
    isRemedialFlagged: boolean;
  };
  highlight?: boolean;
}) {
  return (
    <Link
      href={`/error-notebook/${entry.id}`}
      className={`rounded-2xl border p-4 transition hover:shadow-md ${
        highlight ? "border-amber-200 bg-amber-50" : "border-zinc-100 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{entry.concept}</span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
          {STATUS_LABEL[entry.status]}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{entry.reason}</p>
      {entry.isRemedialFlagged && (
        <p className="mt-1 text-xs font-medium text-rose-500">
          Lỗi này lặp lại {entry.occurrenceCount} lần — cần ôn kỹ hơn
        </p>
      )}
    </Link>
  );
}
