import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getPhaseProgress } from "@/lib/services/curriculum";
import { getLearningStreak } from "@/lib/services/streak";
import { getGreeting } from "@/lib/ai/encouragement";
import { getStudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import { MoodPicker } from "./MoodPicker";
import { LexiAvatar } from "./LexiAvatar";
import { StudentLearningSummary } from "./StudentLearningSummary";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [profile, phaseProgress, dueReviewCount, todayMoodEntry, streak, learningProfile] =
    await Promise.all([
      prisma.learnerProfile.findUnique({ where: { userId: user.id } }),
      getPhaseProgress(user.id),
      prisma.errorNotebookEntry.count({
        where: {
          userId: user.id,
          status: { not: "MASTERED" },
          nextReviewAt: { lte: new Date() },
        },
      }),
      prisma.moodEntry.findFirst({
        where: { userId: user.id, createdAt: { gte: startOfToday } },
      }),
      getLearningStreak(user.id),
      getStudentLearningProfile(user.id),
    ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Greeting header */}
      <section className="rounded-3xl bg-gradient-to-br from-lexi-primary to-lexi-accent p-6 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LexiAvatar size="text-3xl" />
            <div>
              <p className="text-lg font-semibold">
                {getGreeting(user.name?.split(" ").pop() ?? "bạn")}
              </p>
              <p className="text-sm text-white/80">
                {profile
                  ? `Mục tiêu của bạn: ${profile.targetScore.toFixed(1)} điểm. Mỗi ngày tiến bộ một chút nhé!`
                  : "Hãy hoàn thiện hồ sơ học tập để Lexi đồng hành tốt hơn."}
              </p>
            </div>
          </div>
          {streak > 0 && (
            <div className="flex flex-col items-center rounded-2xl bg-white/15 px-3 py-2">
              <span className="text-lg">🔥{streak}</span>
              <span className="text-[10px] text-white/80">ngày liên tiếp</span>
            </div>
          )}
        </div>
      </section>

      {/* Intelligence sections — learning position, recommendation, learning map */}
      <StudentLearningSummary profile={learningProfile} />

      {/* Mission card */}
      <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-lexi-primary-dark">
          Nhiệm vụ hôm nay
        </h2>
        {learningProfile.nextSessionNumber !== null ? (
          <div>
            <p className="text-lg font-medium text-foreground">
              Buổi {learningProfile.nextSessionNumber}: {learningProfile.nextSessionTitle}
            </p>
            {learningProfile.nextSessionObjective && (
              <p className="mt-1 text-sm text-zinc-600">
                {learningProfile.nextSessionObjective}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/practice/${learningProfile.nextSessionNumber}`}
                className="rounded-full bg-lexi-primary px-4 py-2 text-sm font-medium text-white hover:bg-lexi-primary-dark"
              >
                Luyện tập buổi này
              </Link>
              <Link
                href="/chat"
                className="rounded-full border border-lexi-primary px-4 py-2 text-sm font-medium text-lexi-primary-dark"
              >
                Học với Lexi
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Chưa có lộ trình học nào được thiết lập. Lexi sẽ chuẩn bị ngay khi dữ liệu sẵn sàng.
          </p>
        )}
      </section>

      {/* Notebook review nudge */}
      {dueReviewCount > 0 && (
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Bạn có <span className="font-semibold">{dueReviewCount}</span> lỗi sai cần ôn lại hôm nay.
          </p>
          <Link
            href="/error-notebook"
            className="mt-2 inline-block text-sm font-medium text-amber-900 underline"
          >
            Ôn lại ngay
          </Link>
        </section>
      )}

      {/* Diagnostic prompt */}
      {!profile?.diagnosticScore && (
        <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
          <p className="text-sm text-sky-800">
            Bạn chưa làm bài đánh giá đầu vào. Hãy nhập điểm để Lexi hiểu rõ trình độ hiện tại của bạn.
          </p>
          <Link
            href="/diagnostic-test"
            className="mt-2 inline-block text-sm font-medium text-sky-900 underline"
          >
            Làm đánh giá đầu vào
          </Link>
        </section>
      )}

      {/* Mood check-in */}
      <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-lexi-primary-dark">
          Hôm nay bạn thấy thế nào?
        </h2>
        <MoodPicker loggedToday={Boolean(todayMoodEntry)} />
      </section>

      {/* Skill progress bars */}
      <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-lexi-primary-dark">
            Tiến độ kỹ năng
          </h2>
          <span className="text-xs text-zinc-400">
            Buổi {phaseProgress.completedSessions}/{phaseProgress.totalSessions || 24}
          </span>
        </div>
        {learningProfile.skillSnapshot.length > 0 ? (
          <div className="flex flex-col gap-3">
            {learningProfile.skillSnapshot.map((s) => (
              <div key={s.skill}>
                <div className="mb-1 flex justify-between text-xs text-zinc-600">
                  <span>{s.label}</span>
                  <span>{s.percentage}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-lexi-success"
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Hoàn thành buổi luyện tập đầu tiên để xem tiến độ theo từng kỹ năng của em nhé.
          </p>
        )}
      </section>
    </div>
  );
}
