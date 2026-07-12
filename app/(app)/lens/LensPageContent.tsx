"use client";

import Link from "next/link";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ThemeSwitcher } from "@/components/lens/ThemeSwitcher";
import { LensCard } from "@/components/lens/LensCard";
import { InsightCard } from "@/components/lens/InsightCard";
import { ProgressCard } from "@/components/lens/ProgressCard";
import { SectionHeader } from "@/components/lens/SectionHeader";
import type {
  LensViewModel,
  LearnerSummary,
  LearningInsights,
  Strengths,
  Challenges,
  RecommendedActions,
} from "@/lib/services/lens/types";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <p
      className="text-sm italic"
      style={{ color: "var(--theme-muted-fg, #71717a)" }}
    >
      {message}
    </p>
  );
}

function ConfidenceDot({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const color =
    level === "HIGH"   ? "var(--theme-confidence-high,   #34d399)" :
    level === "MEDIUM" ? "var(--theme-confidence-medium, #f472b6)" :
                         "var(--theme-confidence-low,    #d4d4d8)";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ background: color }}
      aria-hidden
    />
  );
}

// ─────────────────────────────────────────────────────────
// Section 1 — Learner Summary
// ─────────────────────────────────────────────────────────

function SummarySection({ summary }: { summary: LearnerSummary }) {
  const TREND_LABEL: Record<string, string> = {
    PROGRESSING:       "Progressing",
    STABLE:            "Stable",
    NEEDS_ATTENTION:   "Needs attention",
    INSUFFICIENT_DATA: "Building data",
  };

  return (
    <LensCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Your Learning Profile"
          badge={TREND_LABEL[summary.trendIndicator] ?? summary.trendIndicator}
        />
        <ConfidenceDot level={summary.confidenceLevel} />
      </div>

      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--theme-fg, #2e2150)" }}
      >
        {summary.narrative}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProgressCard
          label="Day Streak"
          value={summary.streakDays === 0 ? "—" : `${summary.streakDays}`}
          confidenceLevel={summary.confidenceLevel}
        />
        <ProgressCard
          label="Topics"
          value={summary.topicCount === 0 ? "—" : summary.topicCount}
          confidenceLevel={summary.confidenceLevel}
        />
        <ProgressCard
          label="Mastered"
          value={summary.masteredCount === 0 ? "—" : summary.masteredCount}
          confidenceLevel={summary.confidenceLevel}
        />
        <ProgressCard
          label="Challenges"
          value={summary.weakCount === 0 ? "—" : summary.weakCount}
          confidenceLevel={summary.confidenceLevel}
        />
      </div>
    </LensCard>
  );
}

// ─────────────────────────────────────────────────────────
// Section 2 — Learning Insights
// ─────────────────────────────────────────────────────────

function InsightsSection({ insights }: { insights: LearningInsights }) {
  return (
    <LensCard title="Key Insights">
      {insights.insights.length === 0 ? (
        <EmptyState message="Complete a few practice sessions to see your first insights." />
      ) : (
        <div className="flex flex-col gap-3">
          {insights.insights.map((insight, i) => (
            <InsightCard
              key={i}
              type={insight.type}
              narrative={insight.narrative}
              confidence={insight.confidence}
              evidence={insight.evidence}
            />
          ))}
        </div>
      )}
    </LensCard>
  );
}

// ─────────────────────────────────────────────────────────
// Section 3 — Strengths
// ─────────────────────────────────────────────────────────

function StrengthsSection({ strengths }: { strengths: Strengths }) {
  return (
    <LensCard
      title="What's Going Well"
      subtitle={strengths.confidenceNote}
    >
      {strengths.strengths.length === 0 ? (
        <EmptyState message="Keep practicing — strengths will appear here as data builds." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {strengths.strengths.map((s, i) => {
            let displayValue: string | number;
            if (s.type === "MASTERED_TOPIC") displayValue = "✓ Mastered";
            else if (s.type === "STRONG_SKILL" && s.percentageOrCount !== undefined)
              displayValue = `${Math.round(s.percentageOrCount)}%`;
            else if (s.percentageOrCount !== undefined) displayValue = s.percentageOrCount;
            else displayValue = "↑";

            return (
              <ProgressCard
                key={i}
                label={s.label}
                value={displayValue}
                detail={s.detail}
                confidenceLevel={s.confidence}
              />
            );
          })}
        </div>
      )}
    </LensCard>
  );
}

// ─────────────────────────────────────────────────────────
// Section 4 — Challenges
// ─────────────────────────────────────────────────────────

function ChallengesSection({ challenges }: { challenges: Challenges }) {
  const SIGNAL_TREND: Record<string, "IMPROVING" | "STABLE" | "DECLINING"> = {
    RECURRING: "DECLINING",
    IMPROVING: "IMPROVING",
    STABLE:    "STABLE",
  };

  return (
    <LensCard title="Areas to Work On">
      {challenges.challenges.length === 0 ? (
        <EmptyState message="No challenges identified yet — keep going and data will build." />
      ) : (
        <div className="flex flex-col gap-3">
          {challenges.challenges.map((c, i) => (
            <div key={i} className="flex flex-col gap-1">
              <ProgressCard
                label={c.label}
                value={c.type === "ACTIVE_WEAKNESS" ? (c.signal ?? "—") : c.type.replace(/_/g, " ")}
                trend={c.signal ? SIGNAL_TREND[c.signal] : "DECLINING"}
                detail={c.reason}
                confidenceLevel={c.confidence}
              />
              {c.dueNow && (
                <span
                  className="self-start rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "var(--theme-soft, #ede9fe)",
                    color:      "var(--theme-primary, #8b5cf6)",
                    borderRadius: "var(--theme-radius-badge, 9999px)",
                  }}
                >
                  Due for review
                </span>
              )}
              {c.actionHint && (
                <p
                  className="text-xs"
                  style={{ color: "var(--theme-muted-fg, #71717a)" }}
                >
                  {c.actionHint}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </LensCard>
  );
}

// ─────────────────────────────────────────────────────────
// Section 5 — Next Actions
// ─────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  REVIEW_NOTEBOOK:  "Open error notebook",
  PRACTICE_TOPIC:   "Practice now",
  ADVANCE_SESSION:  "Start session",
};

const ACTION_HREF: Record<string, (item: { topic?: string; sessionNumber?: number }) => string> = {
  REVIEW_NOTEBOOK: () => "/error-notebook",
  PRACTICE_TOPIC:  (item) => `/practice/topic/${item.topic ?? ""}`,
  ADVANCE_SESSION: (item) => `/practice/${item.sessionNumber ?? ""}`,
};

function ActionsSection({ recommendations }: { recommendations: RecommendedActions }) {
  return (
    <LensCard title="What to Do Next">
      {recommendations.streakContext && (
        <p
          className="rounded px-3 py-2 text-sm font-medium"
          style={{
            background:   "var(--theme-soft, #ede9fe)",
            color:        "var(--theme-primary-dark, #6d28d9)",
            borderRadius: "var(--theme-radius-inner, 1rem)",
          }}
        >
          {recommendations.streakContext}
        </p>
      )}

      {recommendations.actions.length === 0 ? (
        <EmptyState message="Complete your first practice session to get personalised recommendations." />
      ) : (
        <div className="flex flex-col gap-3">
          {recommendations.actions.map((action, i) => {
            const href = ACTION_HREF[action.suggestedAction]?.(action) ?? "/practice";
            const label = ACTION_LABEL[action.suggestedAction] ?? "Start";

            return (
              <div
                key={i}
                className="flex flex-col gap-2 rounded p-3"
                style={{
                  background:   "var(--theme-muted, #f4f4f5)",
                  borderRadius: "var(--theme-radius-inner, 1rem)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: "var(--theme-primary, #8b5cf6)",
                      color:      "#ffffff",
                      borderRadius: "9999px",
                    }}
                  >
                    {action.priority}
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--theme-fg, #2e2150)" }}
                    >
                      {action.label}
                    </span>
                    <span
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--theme-muted-fg, #71717a)" }}
                    >
                      {action.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {action.questionCount !== undefined && action.questionCount > 0 && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--theme-muted-fg, #71717a)" }}
                      >
                        {action.questionCount}q
                      </span>
                    )}
                    <Link
                      href={href}
                      className="whitespace-nowrap px-3 py-1 text-xs font-medium text-white transition"
                      style={{
                        background:   "var(--theme-primary, #8b5cf6)",
                        borderRadius: "var(--theme-radius-button, 0.75rem)",
                      }}
                    >
                      {label}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </LensCard>
  );
}

// ─────────────────────────────────────────────────────────
// Root client component
// ─────────────────────────────────────────────────────────

interface LensPageContentProps {
  viewModel: LensViewModel;
}

/**
 * Client wrapper for the Learner Lens page.
 * Owns theme state (via ThemeProvider) and renders all five Lens sections.
 * Receives only LensViewModel — no engine imports, no intelligence logic.
 */
export function LensPageContent({ viewModel }: LensPageContentProps) {
  return (
    <ThemeProvider>
      {/* Negative margins counteract <main>'s px-4 py-6 sm:px-8 so the theme bg fills the full content area */}
      <div
        className="-mx-4 -my-6 min-h-full px-4 py-6 sm:-mx-8 sm:px-8"
        style={{ background: "var(--theme-bg, #fbf8ff)" }}
      >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div style={{ color: "var(--theme-fg, #2e2150)" }}>
            <h1 className="text-xl font-bold">Learner Lens</h1>
            <p className="text-sm" style={{ color: "var(--theme-muted-fg, #71717a)" }}>
              Your personal learning profile
            </p>
          </div>
          <ThemeSwitcher />
        </div>

        {/* 1 — Summary */}
        <SummarySection summary={viewModel.summary} />

        {/* 2 — Insights */}
        <InsightsSection insights={viewModel.insights} />

        {/* 3 — Strengths */}
        <StrengthsSection strengths={viewModel.strengths} />

        {/* 4 — Challenges */}
        <ChallengesSection challenges={viewModel.challenges} />

        {/* 5 — Next Actions */}
        <ActionsSection recommendations={viewModel.recommendations} />

      </div>
      </div>
    </ThemeProvider>
  );
}
