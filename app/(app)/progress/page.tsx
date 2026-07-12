import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getPhaseProgress } from "@/lib/services/curriculum";
import { getSkillMatrix, recomputeSkillMatrix } from "@/lib/services/skillMatrix";
import { getWeakTopics } from "@/lib/services/weakness";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await recomputeSkillMatrix(user.id);
  const [skillMatrix, phaseProgress, weakTopics] = await Promise.all([
    getSkillMatrix(user.id),
    getPhaseProgress(user.id),
    getWeakTopics(user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-lexi-primary-dark">Tiến độ của bạn</h1>

      <section className="rounded-3xl border border-zinc-100 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Bản đồ kỹ năng
        </h2>
        <div className="flex flex-col gap-4">
          {skillMatrix.map((s) => (
            <div key={s.skill}>
              <div className="mb-1 flex justify-between text-sm text-zinc-700">
                <span>{s.label}</span>
                {s.hasData ? (
                  <span className="font-medium">{s.percentage}%</span>
                ) : (
                  <span className="text-xs text-zinc-400">Chưa đủ dữ liệu</span>
                )}
              </div>
              {/* Only draw a filled bar when there is evidence — an empty rail with
                  "Chưa đủ dữ liệu" reads as "no data yet", never as 0% mastery. */}
              {s.hasData ? (
                <div className="h-3 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-3 rounded-full bg-lexi-primary"
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
              ) : (
                <div className="h-3 w-full rounded-full bg-zinc-50" />
              )}
            </div>
          ))}
        </div>
      </section>

      {weakTopics.length > 0 && (
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-700">
            Chủ điểm cần ôn lại
          </h2>
          <div className="flex flex-col gap-2">
            {weakTopics.map((t) => (
              <div key={t.concept} className="flex items-center justify-between text-sm">
                <span className="text-amber-900">
                  {t.label}
                  {t.isRemedialFlagged && <span className="ml-2 text-xs text-rose-600">⚠ Lỗi lặp lại</span>}
                </span>
                <span className="text-xs text-amber-600">{t.occurrenceCount} lần</span>
              </div>
            ))}
          </div>
          <Link href="/error-notebook" className="mt-3 inline-block text-sm font-medium text-amber-900 underline">
            Xem sổ lỗi sai
          </Link>
        </section>
      )}

      <section className="rounded-3xl border border-zinc-100 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Lộ trình học
        </h2>
        <div className="flex flex-col gap-4">
          {phaseProgress.phases.map((phase) => (
            <div key={phase.id}>
              <div className="mb-1 flex justify-between text-sm text-zinc-700">
                <span>{phase.name}</span>
                <span className="text-xs text-zinc-400">
                  Buổi {phase.startSession}–{phase.endSession}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{phase.goal}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          Đã hoàn thành <span className="font-semibold text-lexi-primary-dark">{phaseProgress.completedSessions}</span>{" "}
          / {phaseProgress.totalSessions || 24} buổi học
        </p>
      </section>
    </div>
  );
}
