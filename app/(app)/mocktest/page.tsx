import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { StartMockTestButton } from "./StartMockTestButton";

export default async function MockTestPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [templates, myAttempts] = await Promise.all([
    prisma.mockTestTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, timeLimitMin: true, totalQuestions: true },
    }),
    prisma.mockTestAttempt.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, status: true, score: true, startedAt: true, template: { select: { title: true } } },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">🎯 Thi thử</h1>
        <p className="text-sm text-zinc-500">
          Luyện tập với đề thi có tính giờ, mô phỏng cấu trúc đề thi thật — không xem đáp án cho đến khi nộp bài.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
          Chưa có đề thi thử nào. Quản trị viên cần tạo đề trước (Admin → Thi thử).
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-3xl border border-zinc-100 bg-white p-5">
              <p className="font-medium text-foreground">{t.title}</p>
              {t.description && <p className="mt-1 text-xs text-zinc-500">{t.description}</p>}
              <p className="mt-1 text-xs text-zinc-400">
                {t.totalQuestions} câu · {t.timeLimitMin} phút
              </p>
              <div className="mt-3">
                <StartMockTestButton templateId={t.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {myAttempts.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-600">Lịch sử làm bài</h2>
          <div className="flex flex-col gap-2">
            {myAttempts.map((a) => (
              <Link
                key={a.id}
                href={
                  a.status === "IN_PROGRESS" ? `/mocktest/attempt/${a.id}` : `/mocktest/attempt/${a.id}/results`
                }
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm hover:border-lexi-primary"
              >
                <span>{a.template.title}</span>
                <span className="text-xs text-zinc-400">
                  {a.status === "IN_PROGRESS" ? "Đang làm — tiếp tục" : `${Math.round((a.score ?? 0) * 100)}%`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
