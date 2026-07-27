import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AcceptRecommendationLink } from "@/components/recommendations/AcceptRecommendationLink";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveSessionId } from "@/lib/analytics";
import type { ReadinessBand } from "@/lib/analytics";
import { getStudentLearningProfile } from "@/lib/analytics/studentLearningProfile";
import type { LearningTrend } from "@/lib/analytics/studentLearningProfile";
import type { PracticeRecommendation, SuggestedAction } from "@/lib/services/practiceRecommendation";

// ─────────────────────────────────────────────────────────
// Band display config — colours only, no intelligence
// ─────────────────────────────────────────────────────────

const BAND_STYLE: Record<
  ReadinessBand,
  { card: string; score: string; badge: string; badgeText: string }
> = {
  EXAM_READY: {
    card: "border-emerald-200 bg-emerald-50",
    score: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    badgeText: "Sẵn sàng thi",
  },
  NEARLY_READY: {
    card: "border-lexi-primary bg-lexi-soft",
    score: "text-lexi-primary-dark",
    badge: "bg-lexi-soft text-lexi-primary-dark",
    badgeText: "Gần sẵn sàng",
  },
  DEVELOPING: {
    card: "border-amber-200 bg-amber-50",
    score: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "Đang phát triển",
  },
  NOT_READY: {
    card: "border-zinc-200 bg-zinc-50",
    score: "text-zinc-700",
    badge: "bg-zinc-100 text-zinc-600",
    badgeText: "Đang xây nền",
  },
};

// ─────────────────────────────────────────────────────────
// Translation helpers — enums → student-facing Vietnamese
// ─────────────────────────────────────────────────────────

function bandExplanation(band: ReadinessBand): string {
  switch (band) {
    case "EXAM_READY":
      return "Em đã nắm vững các nội dung quan trọng. Hãy tiếp tục duy trì phong độ này.";
    case "NEARLY_READY":
      return "Em đã nắm được nhiều nội dung. Chỉ cần thêm một chút luyện tập là sẵn sàng rồi.";
    case "DEVELOPING":
      return "Em đang củng cố kiến thức tốt. Mỗi buổi luyện tập đều giúp em tiến thêm một bước.";
    case "NOT_READY":
      return "Em đang ở giai đoạn đầu của hành trình. Tiến độ nhỏ mỗi ngày sẽ cộng lại thành kết quả lớn.";
  }
}

// Post-session wording — acknowledges the session just completed
function trendMessagePostSession(trend: LearningTrend, risingCount: number): string {
  switch (trend) {
    case "PROGRESSING":
      return risingCount > 0
        ? `Buổi luyện tập này đã giúp em tiến bộ — Lexi thấy em đang đi đúng hướng!`
        : "Buổi luyện tập này rất tốt. Lexi thấy em đang tiến bộ!";
    case "STABLE":
      return "Em đang duy trì tốt. Tiếp tục luyện đều đặn và kết quả sẽ ngày càng cải thiện.";
    case "NEEDS_ATTENTION":
      return "Có một số nội dung em có thể chú ý thêm — Lexi đã gợi ý bên dưới.";
    case "INSUFFICIENT_DATA":
      return "Em vừa hoàn thành một buổi! Cứ tiếp tục và Lexi sẽ theo dõi tiến trình của em nhé.";
  }
}

function recommendationHref(rec: PracticeRecommendation): string {
  if (rec.suggestedAction === "PRACTICE_TOPIC")
    return `/practice/topic/${encodeURIComponent(rec.topic)}`;
  if (rec.suggestedAction === "REVIEW_NOTEBOOK") return "/error-notebook";
  return `/program/${rec.mission?.programSlug}/${rec.mission?.order}`;
}

function recommendationCta(action: SuggestedAction): string {
  switch (action) {
    case "PRACTICE_TOPIC":  return "Luyện tập ngay";
    case "REVIEW_NOTEBOOK": return "Ôn lại trong sổ lỗi";
    case "ADVANCE_SESSION": return "Bắt đầu bài học";
  }
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export default async function SessionResultsPage({
  params,
}: {
  params: Promise<{ sessionNumber: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { sessionNumber: sessionNumberStr } = await params;
  const sessionNumber = Number(sessionNumberStr);
  if (!Number.isInteger(sessionNumber) || sessionNumber < 1) notFound();

  // Parallel: validate session exists + fetch unified learning profile
  const [curriculumSessionId, profile] = await Promise.all([
    resolveSessionId(sessionNumber),
    getStudentLearningProfile(user.id),
  ]);
  if (!curriculumSessionId) notFound();

  const { readiness, learningTrend, improvingTopics, recommendations } = profile;
  const hasReadiness = readiness !== null && !readiness.insufficientData;
  const bandStyle = hasReadiness ? BAND_STYLE[readiness!.band] : null;
  const topRec = recommendations[0] ?? null;
  const nextSessionNumber = sessionNumber + 1;

  // Topics actively moving upward — drives the progress signal
  const risingTopics = improvingTopics.filter((p) => p.masteryState === "IMPROVING");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 pb-8">

      {/* ── 0. Completion banner — confirms what the student just did ── */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          ✓ Buổi {sessionNumber} · Hoàn thành
        </span>
      </div>

      {/* ── 1. Score / level card ── */}
      {hasReadiness ? (
        <div className={`rounded-3xl border p-6 ${bandStyle!.card}`}>
          <div className="mb-3 flex items-end gap-3">
            <span className={`text-5xl font-bold tabular-nums ${bandStyle!.score}`}>
              {(readiness!.readinessScore / 10).toFixed(1)}
            </span>
            <span className={`mb-1 text-xl font-medium opacity-60 ${bandStyle!.score}`}>
              /10
            </span>
            <span
              className={`mb-1 ml-auto rounded-full px-3 py-1 text-xs font-semibold ${bandStyle!.badge}`}
            >
              {bandStyle!.badgeText}
            </span>
          </div>
          <p className="text-sm text-zinc-600">{bandExplanation(readiness!.band)}</p>
        </div>
      ) : (
        /* New student — no score yet */
        <div className="rounded-3xl border border-lexi-soft bg-lexi-soft p-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl">🦄</span>
            <span className="font-semibold text-lexi-primary-dark">Lexi</span>
          </div>
          <p className="text-base font-semibold text-lexi-primary-dark">
            Em vừa hoàn thành buổi {sessionNumber}!
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Cứ tiếp tục luyện tập và Lexi sẽ theo dõi tiến trình của em sau mỗi buổi nhé.
          </p>
        </div>
      )}

      {/* ── 2. Lexi reflection — trend + progress signal ── */}
      <div className="rounded-3xl border border-lexi-soft bg-lexi-soft p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xl">🦄</span>
          <span className="text-sm font-semibold text-lexi-primary-dark">Lexi nói:</span>
        </div>
        <p className="text-sm font-medium text-lexi-primary-dark">
          {trendMessagePostSession(learningTrend, risingTopics.length)}
        </p>
        {/* Progress signal — how many topics are moving in the right direction */}
        {risingTopics.length > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            {risingTopics.length === 1
              ? "1 chủ đề đang đi đúng hướng."
              : `${risingTopics.length} chủ đề đang đi đúng hướng.`}
          </p>
        )}
      </div>

      {/* ── 3. What's improving — named topics ── */}
      {risingTopics.length > 0 && (
        <div className="rounded-3xl border border-zinc-100 bg-white p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Đang cải thiện
          </p>
          <div className="flex flex-wrap gap-1.5">
            {risingTopics.map((p) => (
              <span
                key={p.topic}
                className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Next recommended action (reason always visible) ── */}
      {topRec ? (
        <div
          className={`rounded-3xl border p-5 ${
            topRec.priority <= 2
              ? "border-amber-100 bg-amber-50"
              : "border-lexi-soft bg-lexi-soft/40"
          }`}
        >
          <p
            className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
              topRec.priority <= 2 ? "text-amber-700" : "text-lexi-primary"
            }`}
          >
            Lexi đề xuất tiếp theo
          </p>
          <p
            className={`text-base font-semibold ${
              topRec.priority <= 2 ? "text-amber-900" : "text-lexi-primary-dark"
            }`}
          >
            {topRec.label}
          </p>
          <p
            className={`mt-1 text-sm ${
              topRec.priority <= 2 ? "text-amber-800" : "text-zinc-600"
            }`}
          >
            {topRec.reason}
          </p>
          {/* RT-1: clicking the CTA is the learner ACCEPTING this recommendation —
              recorded as Evidence against the exact issuance (Ch.3 §3.1 Consumed). */}
          <AcceptRecommendationLink
            href={recommendationHref(topRec)}
            issuanceId={profile.currentRecommendationIssuanceId}
            className={`mt-3 inline-block rounded-full px-4 py-2 text-sm font-medium text-white ${
              topRec.priority <= 2
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-lexi-primary hover:bg-lexi-primary-dark"
            }`}
          >
            {recommendationCta(topRec.suggestedAction)}
          </AcceptRecommendationLink>
        </div>
      ) : (
        /* No focused recommendation — session was excellent or student is brand new */
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-700">Buổi học xuất sắc! 🎉</p>
          <p className="mt-1 text-sm text-zinc-600">
            Em đã làm rất tốt. Hãy tiếp tục với buổi tiếp theo để mở rộng phạm vi luyện tập.
          </p>
        </div>
      )}

      {/* ── 5. Action footer ── */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/practice/${nextSessionNumber}`}
          className="flex items-center justify-center rounded-full bg-lexi-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-lexi-primary-dark"
        >
          Luyện buổi {nextSessionNumber} →
        </Link>
        <div className="flex gap-3">
          <Link
            href="/chat"
            className="flex flex-1 items-center justify-center rounded-full border border-lexi-primary px-4 py-2 text-sm font-medium text-lexi-primary-dark transition hover:bg-lexi-soft"
          >
            Hỏi Lexi
          </Link>
          <Link
            href="/dashboard"
            className="flex flex-1 items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
