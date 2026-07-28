"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerInput } from "../../../practice/[sessionNumber]/AnswerInput";
import type { QuestionResponse } from "@/lib/services/question-format";
// Type-only import from a server module (attempts.ts touches Prisma) — erased
// at compile time, so this stays safe from a "use client" file. Reusing the
// server's own shape instead of redeclaring it here is what keeps the two
// from quietly drifting apart.
import type { AttemptQuestionView as PlayerQuestion } from "@/lib/services/mocktest/attempts";

export type { PlayerQuestion };

/**
 * Timed, sequential, no per-question reveal — the "test player = focused,
 * zero chrome, no companion interruptions" note in
 * docs/MOCKTESTTAB_DESIGN.md §4. Deliberately a different component from
 * PracticeQuiz.tsx rather than a shared one with a mode flag: the two UXs
 * genuinely diverge (immediate feedback + linear-only vs. no feedback +
 * free navigation + a countdown that can end the session on its own), and a
 * single component branching on every one of those would be harder to read
 * than two components sharing the parts that actually are shared
 * (AnswerInput, the grading core).
 */
export function MockTestPlayer({
  attemptId,
  timeLimitMin,
  startedAt,
  questions,
}: {
  attemptId: string;
  timeLimitMin: number;
  startedAt: string; // ISO — serialized across the server/client boundary
  questions: PlayerQuestion[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({});
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  const deadline = useMemo(() => new Date(startedAt).getTime() + timeLimitMin * 60_000, [startedAt, timeLimitMin]);
  const [remainingSec, setRemainingSec] = useState(() => Math.max(0, Math.round((deadline - Date.now()) / 1000)));

  const submitTest = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    await fetch(`/api/mocktest/attempts/${attemptId}/submit`, { method: "POST" });
    router.push(`/mocktest/attempt/${attemptId}/results`);
  }, [attemptId, router, submitting]);

  // Countdown — ticks every second; auto-submits exactly once when it hits
  // zero. Real exams don't ask permission when time is up.
  useEffect(() => {
    const interval = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSec(secondsLeft);
      if (secondsLeft === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submitTest();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, submitTest]);

  const current = questions[index];
  const questionShownAtRef = useRef(Date.now());
  useEffect(() => {
    questionShownAtRef.current = Date.now();
  }, [current?.questionId]);

  async function handleAnswer(response: QuestionResponse) {
    const timeSpentSec = Math.round((Date.now() - questionShownAtRef.current) / 1000);
    setAnswers((prev) => ({ ...prev, [current.questionId]: response }));
    await fetch(`/api/mocktest/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: current.questionId, response, timeSpentSec }),
    });
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
        Đề thi này chưa có câu hỏi.
      </p>
    );
  }

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const isLowTime = remainingSec <= 5 * 60; // last 5 minutes — matches the exam-anxiety framing in the design doc

  return (
    <div className="flex flex-col gap-4">
      {/* Zero-chrome header: just the timer and progress, no companion, no distractions. */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-2xl border border-zinc-100 bg-white/95 px-4 py-2 backdrop-blur">
        <p className="text-xs text-zinc-500">
          Câu {index + 1}/{questions.length}
        </p>
        <p className={`text-sm font-semibold tabular-nums ${isLowTime ? "text-rose-600" : "text-lexi-primary-dark"}`}>
          ⏱ {minutes}:{String(seconds).padStart(2, "0")}
        </p>
      </div>

      {/* Question palette — jump to any question, answered/unanswered at a glance. */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const answered = Boolean(answers[q.questionId]);
          const isCurrent = i === index;
          return (
            <button
              key={q.questionId}
              onClick={() => setIndex(i)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium transition ${
                isCurrent
                  ? "bg-lexi-primary text-white"
                  : answered
                    ? "bg-lexi-soft text-lexi-primary-dark"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-zinc-100 bg-white p-6">
        <p className="mb-4 text-foreground">{current.promptText}</p>

        <AnswerInput
          key={current.questionId}
          responseFormat={current.responseFormat}
          payload={current.publicPayload}
          onSubmit={handleAnswer}
          disabled={false}
          // Never revealed mid-test — correctOptionId stays null until results.
          selectedOptionId={
            current.responseFormat === "SINGLE_CHOICE"
              ? ((answers[current.questionId] as { optionId?: string } | undefined)?.optionId ?? null)
              : null
          }
          correctOptionId={null}
          isUnderlineType={current.type === "PHONETICS_SOUND"}
          underlineTopic={current.topic}
          initialResponse={answers[current.questionId] ?? null}
        />

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 disabled:opacity-40"
            >
              ← Câu trước
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={index === questions.length - 1}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 disabled:opacity-40"
            >
              Câu tiếp →
            </button>
          </div>

          {!confirmingSubmit ? (
            <button
              onClick={() => setConfirmingSubmit(true)}
              className="rounded-full bg-lexi-primary px-5 py-2 text-xs font-semibold text-white hover:bg-lexi-primary-dark"
            >
              Nộp bài
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">
                Đã trả lời {Object.keys(answers).length}/{questions.length} câu. Chắc chắn nộp?
              </span>
              <button
                onClick={submitTest}
                disabled={submitting}
                className="rounded-full bg-rose-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Đang nộp..." : "Xác nhận nộp bài"}
              </button>
              <button
                onClick={() => setConfirmingSubmit(false)}
                className="rounded-full border border-zinc-200 px-3 py-2 text-zinc-500"
              >
                Huỷ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
