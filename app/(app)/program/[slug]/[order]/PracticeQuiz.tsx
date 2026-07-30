"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCorrectMessage, getIncorrectIntro } from "@/lib/ai/encouragement";
import { LensFloatingAssistant } from "@/components/lens/LensFloatingAssistant";
import { AnswerInput } from "./AnswerInput";
import {
  describeResponse,
  describeCorrectAnswer,
  type PublicQuestionPayload,
  type QuestionPayload,
  type QuestionResponse,
  type ResponseFormatName,
} from "@/lib/services/question-format";

interface QuizQuestion {
  id: string;
  // Nullable từ A2 (di sản — xem prisma/schema.prisma trên Question.type).
  // `current.type === "PHONETICS_SOUND"` cho ra false khi null, đã an toàn.
  type: string | null;
  topic: string;
  promptText: string;
  responseFormat: ResponseFormatName;
  publicPayload: PublicQuestionPayload;
}

interface AttemptFeedback {
  isCorrect: boolean;
  score: number;
  correctPayload: QuestionPayload;
  explanationVi: string;
  commonMistake: string | null;
  concept: string;
  submittedResponse: QuestionResponse;
}

export function PracticeQuiz({
  programCurriculumId,
  questions,
  completionHref,
}: {
  programCurriculumId?: string;
  questions: QuizQuestion[];
  completionHref?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const current = questions[index];
  // Pick once per question so the message doesn't shuffle on re-render.
  const correctMessage = useMemo(() => getCorrectMessage(), [current?.id]);
  const incorrectIntro = useMemo(() => getIncorrectIntro(), [current?.id]);

  // Tracks when the current question was first shown, so handleAnswer can
  // report timeSpentSec — feeds the response-time signals in the learner
  // intelligence layer (PerformanceState, ProblemSolvingState), which
  // otherwise never receive real timing data.
  const questionShownAtRef = useRef(Date.now());
  useEffect(() => {
    questionShownAtRef.current = Date.now();
  }, [current?.id]);

  // Record session/slot start exactly once per mount — fire-and-forget so a
  // transient failure never blocks the student from seeing the first
  // question. This is the first real caller either start route has ever
  // had (docs/superpowers/plans/2026-07-26-user-program-progress.md) — both
  // routes are idempotent, so a remount (e.g. fast refresh) is harmless.
  useEffect(() => {
    if (programCurriculumId) {
      fetch(`/api/program/slots/${programCurriculumId}/start`, { method: "POST" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnswer(response: QuestionResponse) {
    if (feedback || submitting) return;
    setSubmitting(true);

    const timeSpentSec = Math.round((Date.now() - questionShownAtRef.current) / 1000);
    const body: Record<string, unknown> = { response, timeSpentSec };
    if (programCurriculumId) body.programCurriculumId = programCurriculumId;

    const res = await fetch(`/api/questions/${current.id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setFeedback({ ...data, submittedResponse: response });
    setSubmitting(false);
  }

  async function handleNext() {
    if (index + 1 < questions.length) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setFeedback(null);
    } else {
      if (programCurriculumId) {
        await fetch(`/api/program/slots/${programCurriculumId}/complete`, { method: "POST" });
      }
      router.push(completionHref ?? "/dashboard");
    }
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
        Buổi học này chưa có câu hỏi luyện tập.
      </p>
    );
  }

  const isUnderlineType = current.type === "PHONETICS_SOUND";

  // SINGLE_CHOICE-only bits AnswerInput needs for its click-to-submit UX.
  const selectedOptionId =
    feedback && current.responseFormat === "SINGLE_CHOICE"
      ? (feedback.submittedResponse as import("@/lib/services/question-format").SingleChoiceResponse).optionId
      : null;
  const correctOptionId =
    feedback && current.responseFormat === "SINGLE_CHOICE"
      ? (feedback.correctPayload as import("@/lib/services/question-format").SingleChoicePayload).correctOptionId
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-400">
        Câu {index + 1}/{questions.length}
      </p>
      <div className="rounded-3xl border border-zinc-100 bg-white p-6">
        <p className="mb-4 text-foreground">{current.promptText}</p>

        <AnswerInput
          responseFormat={current.responseFormat}
          payload={current.publicPayload}
          onSubmit={handleAnswer}
          disabled={!!feedback || submitting}
          selectedOptionId={selectedOptionId}
          correctOptionId={correctOptionId}
          isUnderlineType={isUnderlineType}
          underlineTopic={current.topic}
        />

        {feedback && (
          <div className="mt-4 rounded-2xl bg-lexi-soft p-4 text-sm">
            {feedback.isCorrect ? (
              <p className="font-medium text-lexi-primary-dark">{correctMessage}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-medium text-lexi-primary-dark">{incorrectIntro}</p>
                {/* SINGLE_CHOICE keeps its own inline correct/incorrect colouring in
                    AnswerInput; other formats show the plain-text comparison here since
                    there is no shared answer letter to colour a specific option by. */}
                {current.responseFormat !== "SINGLE_CHOICE" && (
                  <p className="text-zinc-600">
                    Bạn trả lời:{" "}
                    <span className="font-medium text-rose-600">
                      {describeResponse(current.responseFormat, feedback.correctPayload, feedback.submittedResponse)}
                    </span>
                    <br />
                    Đáp án đúng:{" "}
                    <span className="font-medium text-emerald-600">
                      {describeCorrectAnswer(current.responseFormat, feedback.correctPayload)}
                    </span>
                  </p>
                )}
                {current.responseFormat === "SINGLE_CHOICE" && (
                  <p className="text-zinc-600">
                    Bạn chọn:{" "}
                    <span className="font-medium text-rose-600">{selectedOptionId}</span> — đáp án đúng là{" "}
                    <span className="font-medium text-emerald-600">{correctOptionId}</span>
                  </p>
                )}
              </div>
            )}
            {!feedback.isCorrect && feedback.score > 0 && (
              <p className="mt-1 text-xs text-lexi-primary-dark">
                Đúng một phần: {Math.round(feedback.score * 100)}%
              </p>
            )}
            <p className="mt-2 text-zinc-700">
              <span className="font-medium">Vì sao: </span>
              {feedback.explanationVi}
            </p>
            {!feedback.isCorrect && feedback.commonMistake && (
              <p className="mt-1 text-zinc-500">
                <span className="font-medium">Cạm bẫy thường gặp: </span>
                {feedback.commonMistake}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleNext}
                className="rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white hover:bg-lexi-primary-dark"
              >
                {index + 1 < questions.length ? "Câu tiếp theo" : "Hoàn thành luyện tập"}
              </button>
              {!feedback.isCorrect && current.responseFormat === "SINGLE_CHOICE" && (
                <Link
                  href={`/error-notebook/new?concept=${encodeURIComponent(feedback.concept)}&studentAnswer=${encodeURIComponent(
                    selectedOptionId ?? ""
                  )}&correctAnswer=${encodeURIComponent(correctOptionId ?? "")}&reason=${encodeURIComponent(
                    feedback.explanationVi
                  )}&questionId=${current.id}`}
                  className="rounded-full border border-lexi-primary px-4 py-2 text-xs font-medium text-lexi-primary-dark"
                >
                  Ghi vào sổ lỗi
                </Link>
              )}
            </div>

            {/* Lens — only available after the student has seen the explanation */}
            <div className="mt-4 border-t border-lexi-primary/10 pt-3">
              <p className="mb-2 text-xs text-zinc-500">Vẫn còn thắc mắc?</p>
              <LensFloatingAssistant />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
