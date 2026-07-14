import Link from "next/link";
import { AcceptRecommendationLink } from "@/components/recommendations/AcceptRecommendationLink";
import type { StudentLearningProfile, LearningTrend } from "@/lib/analytics/studentLearningProfile";
import type { PracticeRecommendation, SuggestedAction } from "@/lib/services/practiceRecommendation";
import type { ReadinessResult } from "@/lib/analytics";

// ─────────────────────────────────────────────────────────
// Translation helpers — internal enums → student-facing Vietnamese
// ─────────────────────────────────────────────────────────

function trendMessage(trend: LearningTrend): string {
  switch (trend) {
    case "PROGRESSING":       return "Lexi thấy em đang tiến bộ tốt.";
    case "STABLE":            return "Lexi thấy em đang giữ vững được.";
    case "NEEDS_ATTENTION":   return "Lexi thấy có một số điểm em có thể chú ý thêm.";
    case "INSUFFICIENT_DATA": return "Lexi đang tìm hiểu thêm về cách học của em.";
  }
}

function bandLabel(band: ReadinessResult["band"]): string {
  switch (band) {
    case "EXAM_READY":   return "Em đang rất sẵn sàng cho kỳ thi.";
    case "NEARLY_READY": return "Em gần như đã sẵn sàng rồi.";
    case "DEVELOPING":   return "Em đang trên đà tiến bộ.";
    case "NOT_READY":    return "Em cần luyện thêm một chút.";
  }
}

function recommendationHref(rec: PracticeRecommendation): string {
  if (rec.suggestedAction === "PRACTICE_TOPIC")
    return `/practice/topic/${encodeURIComponent(rec.topic)}`;
  if (rec.suggestedAction === "REVIEW_NOTEBOOK") return "/error-notebook";
  return `/practice/${rec.sessionNumber}`;
}

function recommendationCta(action: SuggestedAction): string {
  switch (action) {
    case "PRACTICE_TOPIC":  return "Luyện tập ngay";
    case "REVIEW_NOTEBOOK": return "Ôn lại trong sổ lỗi";
    case "ADVANCE_SESSION": return "Bắt đầu buổi học";
  }
}

// ─────────────────────────────────────────────────────────
// Section 1 — Learning position
// ─────────────────────────────────────────────────────────

function LearningPositionSection({
  readiness,
  trend,
}: {
  readiness: ReadinessResult | null;
  trend: LearningTrend;
}) {
  const isInsufficient =
    trend === "INSUFFICIENT_DATA" || readiness === null || readiness.insufficientData;

  return (
    <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lexi-primary">
        Vị trí học tập của em
      </p>

      {isInsufficient ? (
        <>
          <p className="text-sm text-zinc-600">
            Em mới bắt đầu hành trình. Hoàn thành một buổi luyện tập để Lexi hiểu được trình
            độ của em và đưa ra nhận xét chính xác hơn nhé.
          </p>
          {trend !== "INSUFFICIENT_DATA" && (
            <p className="mt-2 text-sm font-medium text-lexi-primary">{trendMessage(trend)}</p>
          )}
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-lexi-primary-dark">
            {(readiness!.readinessScore / 10).toFixed(1)}
            <span className="text-base font-normal text-zinc-400">/10</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600">{bandLabel(readiness!.band)}</p>
          <p className="mt-3 text-sm font-medium text-lexi-primary">{trendMessage(trend)}</p>
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// Section 2a — Recommendation (when intelligence has a suggestion)
// ─────────────────────────────────────────────────────────

function TodayRecommendationSection({
  rec,
  issuanceId,
}: {
  rec: PracticeRecommendation;
  issuanceId: string | null;
}) {
  const isHighPriority = rec.priority <= 2;
  const href = recommendationHref(rec);

  return (
    <section
      className={`rounded-3xl border p-5 ${
        isHighPriority
          ? "border-amber-100 bg-amber-50"
          : "border-lexi-soft bg-lexi-soft/40"
      }`}
    >
      <p
        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
          isHighPriority ? "text-amber-700" : "text-lexi-primary"
        }`}
      >
        Lexi đề xuất hôm nay
      </p>
      <p
        className={`text-base font-semibold ${
          isHighPriority ? "text-amber-900" : "text-lexi-primary-dark"
        }`}
      >
        {rec.label}
      </p>
      <p
        className={`mt-1 text-sm ${
          isHighPriority ? "text-amber-800" : "text-zinc-600"
        }`}
      >
        {rec.reason}
      </p>
      {/* RT-1: clicking the CTA is the learner ACCEPTING this recommendation —
          recorded as Evidence against the exact issuance (Ch.3 §3.1 Consumed). */}
      <AcceptRecommendationLink
        href={href}
        issuanceId={issuanceId}
        className={`mt-3 inline-block rounded-full px-4 py-2 text-sm font-medium text-white ${
          isHighPriority
            ? "bg-amber-600 hover:bg-amber-700"
            : "bg-lexi-primary hover:bg-lexi-primary-dark"
        }`}
      >
        {recommendationCta(rec.suggestedAction)}
      </AcceptRecommendationLink>
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// Section 2b — Session mission (fallback when no recommendation yet)
//   Shown when there is no recommendation — ensures student always
//   sees one clear action regardless of how much history exists.
// ─────────────────────────────────────────────────────────

function SessionMissionCard({
  sessionNumber,
  sessionTitle,
}: {
  sessionNumber: number | null;
  sessionTitle: string | null;
}) {
  // No curriculum at all — brand new account, point to session 1
  const targetSession = sessionNumber ?? 1;
  const isFirstEver = sessionNumber === null;

  return (
    <section className="rounded-3xl border border-lexi-soft bg-lexi-soft/40 p-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-lexi-primary">
        {isFirstEver ? "Bắt đầu hành trình" : "Việc nên làm hôm nay"}
      </p>
      <p className="text-base font-semibold text-lexi-primary-dark">
        {isFirstEver
          ? "Hãy bắt đầu buổi luyện tập đầu tiên!"
          : `Buổi ${targetSession}${sessionTitle ? `: ${sessionTitle}` : ""}`}
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        {isFirstEver
          ? "Lexi sẽ theo dõi tiến trình và đưa ra gợi ý sau mỗi buổi học."
          : "Luyện tập đều đặn mỗi ngày giúp em tiến bộ nhanh hơn."}
      </p>
      <Link
        href={`/practice/${targetSession}`}
        className="mt-3 inline-block rounded-full bg-lexi-primary px-4 py-2 text-sm font-medium text-white hover:bg-lexi-primary-dark"
      >
        {isFirstEver ? "Bắt đầu buổi 1" : "Bắt đầu buổi học"}
      </Link>
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// Section 3 — Learning map
// ─────────────────────────────────────────────────────────

function TopicChips({
  labels,
  maxVisible = 4,
  colorClass,
}: {
  labels: string[];
  maxVisible?: number;
  colorClass: string;
}) {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, maxVisible);
  const overflow = labels.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((label) => (
        <span
          key={label}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
        >
          {label}
        </span>
      ))}
      {overflow > 0 && (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} opacity-60`}>
          +{overflow} chủ đề nữa
        </span>
      )}
    </div>
  );
}

function LearningMapSection({ profile }: { profile: StudentLearningProfile }) {
  const improvingLabels = profile.improvingTopics
    .filter((p) => p.masteryState === "IMPROVING")
    .map((p) => p.label);

  const stableLabels = [
    ...profile.improvingTopics
      .filter((p) => p.masteryState === "STABLE")
      .map((p) => p.label),
    ...profile.masterySummary.masteredTopics,
  ];

  const needsAttentionLabels = profile.activeWeaknesses.map((w) => w.label);

  const hasContent =
    improvingLabels.length > 0 ||
    stableLabels.length > 0 ||
    needsAttentionLabels.length > 0;

  if (!hasContent) return null;

  return (
    <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-lexi-primary-dark">
        Bản đồ học tập
      </p>
      <div className="flex flex-col gap-4">
        {needsAttentionLabels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-amber-700">Cần chú ý</p>
            <TopicChips
              labels={needsAttentionLabels}
              colorClass="bg-amber-100 text-amber-800"
            />
          </div>
        )}
        {improvingLabels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-sky-700">Đang cải thiện</p>
            <TopicChips
              labels={improvingLabels}
              colorClass="bg-sky-100 text-sky-800"
            />
          </div>
        )}
        {stableLabels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-emerald-700">Đã vững</p>
            <TopicChips
              labels={stableLabels}
              colorClass="bg-emerald-100 text-emerald-800"
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// Composed export
// ─────────────────────────────────────────────────────────

export function StudentLearningSummary({
  profile,
}: {
  profile: StudentLearningProfile;
}) {
  const topRec = profile.recommendations[0] ?? null;
  const hasTopics =
    profile.improvingTopics.length > 0 ||
    profile.activeWeaknesses.length > 0 ||
    profile.masterySummary.masteredTopics.length > 0;

  return (
    <>
      <LearningPositionSection
        readiness={profile.readiness}
        trend={profile.learningTrend}
      />

      {/* Always show one clear action — recommendation if available, next session otherwise */}
      {topRec ? (
        <TodayRecommendationSection
          rec={topRec}
          issuanceId={profile.currentRecommendationIssuanceId}
        />
      ) : (
        <SessionMissionCard
          sessionNumber={profile.nextSessionNumber}
          sessionTitle={profile.nextSessionTitle}
        />
      )}

      {hasTopics && <LearningMapSection profile={profile} />}
    </>
  );
}
