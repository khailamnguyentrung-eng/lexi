import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getResults } from "@/lib/services/mocktest/attempts";
import { describeResponse, describeCorrectAnswer } from "@/lib/services/question-format";

export default async function MockTestResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { attemptId } = await params;
  const results = await getResults(user.id, attemptId);

  const percent = Math.round(results.score * 100);
  const durationMin = Math.round((results.submittedAt.getTime() - results.startedAt.getTime()) / 60000);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="rounded-3xl border border-zinc-100 bg-white p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Kết quả thi thử</p>
        <p className="mt-2 text-4xl font-bold text-lexi-primary-dark">{percent}%</p>
        <p className="mt-1 text-sm text-zinc-500">
          Đúng {results.correctCount}/{results.totalCount} câu · Hoàn thành trong {durationMin} phút
        </p>
        <Link
          href="/mocktest"
          className="mt-4 inline-block rounded-full bg-lexi-primary px-5 py-2 text-xs font-semibold text-white hover:bg-lexi-primary-dark"
        >
          Quay lại Thi thử
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {results.questions.map((q) => (
          <div
            key={q.questionId}
            className={`rounded-2xl border p-4 text-sm ${q.isCorrect ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
          >
            <p className="text-xs font-medium text-zinc-500">
              Câu {q.slotOrder} — {q.isCorrect ? "✅ Đúng" : q.answered ? "❌ Sai" : "⬜ Chưa trả lời"}
              {!q.isCorrect && q.score > 0 && ` (đúng một phần: ${Math.round(q.score * 100)}%)`}
            </p>
            <p className="mt-1 text-foreground">{q.promptText}</p>
            {/* correctPayload is only ever null for a question whose payload
                became invalid after the attempt was assembled — an edge
                case, not the common "unanswered" path (that still has a
                valid payload, just no submittedResponse). Guarded rather
                than assumed, so a data problem shows a blank line instead
                of crashing the whole results page. */}
            {!q.isCorrect && q.correctPayload && (
              <p className="mt-2 text-zinc-600">
                Bạn trả lời:{" "}
                <span className="font-medium text-rose-600">
                  {describeResponse(q.responseFormat, q.correctPayload, q.submittedResponse)}
                </span>
                <br />
                Đáp án đúng:{" "}
                <span className="font-medium text-emerald-600">
                  {describeCorrectAnswer(q.responseFormat, q.correctPayload)}
                </span>
              </p>
            )}
            <p className="mt-2 text-zinc-700">
              <span className="font-medium">Vì sao: </span>
              {q.explanationVi}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
