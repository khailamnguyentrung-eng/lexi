"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCorrectMessage, getIncorrectIntro } from "@/lib/ai/encouragement";
import { LensFloatingAssistant } from "@/components/lens/LensFloatingAssistant";
import { AnswerInput } from "./AnswerInput";
import type { PublicQuestionPayload, QuestionPayload, QuestionResponse, ResponseFormatName } from "@/lib/services/question-format";

interface QuizQuestion {
  id: string;
  type: string;
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

/**
 * Renders "what you answered" / "the correct answer was" as plain text, one
 * function per format. Deliberately text, not a bespoke visual per format —
 * see AnswerInput.tsx's file header for why that's out of scope here.
 */
function describeResponse(format: ResponseFormatName, payload: QuestionPayload, response: QuestionResponse): string {
  switch (format) {
    case "SINGLE_CHOICE": {
      const p = payload as import("@/lib/services/question-format").SingleChoicePayload;
      const r = response as import("@/lib/services/question-format").SingleChoiceResponse;
      return p.options.find((o) => o.id === r?.optionId)?.text ?? "(chưa trả lời)";
    }
    case "MULTI_CHOICE": {
      const p = payload as import("@/lib/services/question-format").MultiChoicePayload;
      const r = response as import("@/lib/services/question-format").MultiChoiceResponse;
      const texts = (r?.optionIds ?? []).map((id) => p.options.find((o) => o.id === id)?.text ?? id);
      return texts.length ? texts.join(", ") : "(chưa chọn đáp án nào)";
    }
    case "SHORT_TEXT": {
      const p = payload as import("@/lib/services/question-format").ShortTextPayload;
      const r = response as import("@/lib/services/question-format").ShortTextResponse;
      return p.blanks.map((b, i) => `(${i + 1}) ${r?.answers?.[b.id] || "—"}`).join("; ");
    }
    case "MATCHING": {
      const p = payload as import("@/lib/services/question-format").MatchingPayload;
      const r = response as import("@/lib/services/question-format").MatchingResponse;
      return (r?.pairs ?? [])
        .map((pair) => {
          const left = p.left.find((l) => l.id === pair.leftId)?.text ?? pair.leftId;
          const right = p.right.find((rt) => rt.id === pair.rightId)?.text ?? pair.rightId;
          return `${left} → ${right}`;
        })
        .join("; ");
    }
    case "ORDERING": {
      const p = payload as import("@/lib/services/question-format").OrderingPayload;
      const r = response as import("@/lib/services/question-format").OrderingResponse;
      return (r?.order ?? []).map((id) => p.items.find((it) => it.id === id)?.text ?? id).join(" → ");
    }
  }
}

function describeCorrectAnswer(format: ResponseFormatName, payload: QuestionPayload): string {
  switch (format) {
    case "SINGLE_CHOICE": {
      const p = payload as import("@/lib/services/question-format").SingleChoicePayload;
      return p.options.find((o) => o.id === p.correctOptionId)?.text ?? "";
    }
    case "MULTI_CHOICE": {
      const p = payload as import("@/lib/services/question-format").MultiChoicePayload;
      return p.correctOptionIds.map((id) => p.options.find((o) => o.id === id)?.text ?? id).join(", ");
    }
    case "SHORT_TEXT": {
      const p = payload as import("@/lib/services/question-format").ShortTextPayload;
      return p.blanks.map((b, i) => `(${i + 1}) ${b.acceptedAnswers[0]}`).join("; ");
    }
    case "MATCHING": {
      const p = payload as import("@/lib/services/question-format").MatchingPayload;
      return p.correctPairs
        .map((pair) => {
          const left = p.left.find((l) => l.id === pair.leftId)?.text ?? pair.leftId;
          const right = p.right.find((r) => r.id === pair.rightId)?.text ?? pair.rightId;
          return `${left} → ${right}`;
        })
        .join("; ");
    }
    case "ORDERING": {
      const p = payload as import("@/lib/services/question-format").OrderingPayload;
      return p.correctOrder.map((id) => p.items.find((it) => it.id === id)?.text ?? id).join(" → ");
    }
  }
}

export function PracticeQuiz({
  sessionNumber,
  sessionType,
  curriculumSessionId,
  questions,
  completionHref,
}: {
  sessionNumber?: number;
  sessionType?: string;
  curriculumSessionId?: string;
  questions: QuizQuestion[];
  completionHref?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [midExamPrompt, setMidExamPrompt] = useState(false);
  const [midExamCountdown, setMidExamCountdown] = useState(5);

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

  useEffect(() => {
    if (!midExamPrompt) return;
    setMidExamCountdown(5);
    const interval = setInterval(() => {
      setMidExamCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          setMidExamPrompt(false);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [midExamPrompt]);

  async function handleAnswer(response: QuestionResponse) {
    if (feedback || submitting) return;
    setSubmitting(true);

    const timeSpentSec = Math.round((Date.now() - questionShownAtRef.current) / 1000);
    const body: Record<string, unknown> = { response, timeSpentSec };
    if (curriculumSessionId) body.curriculumSessionId = curriculumSessionId;

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
      // Show 5-second attention prompt at question 21 of a mock exam (index 20 = Q21)
      if (nextIndex === 20 && sessionType === "MOCK_EXAM") {
        setMidExamPrompt(true);
      }
    } else if (sessionNumber !== undefined) {
      await fetch(`/api/curriculum/sessions/${sessionNumber}/complete`, { method: "POST" });
      router.push(`/practice/${sessionNumber}/results`);
    } else {
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

  if (midExamPrompt) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-3xl border border-lexi-primary/20 bg-lexi-soft p-10 text-center">
        <p className="text-4xl">🌬️</p>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-lexi-primary-dark">Nửa chặng đường rồi!</p>
          <p className="text-sm text-zinc-600">Hít thở một chút. Kiểm tra tốc độ của em nhé.</p>
        </div>
        <p className="text-3xl font-bold text-lexi-primary">{midExamCountdown}</p>
        <button
          onClick={() => setMidExamPrompt(false)}
          className="rounded-full bg-lexi-primary px-5 py-2 text-xs font-semibold text-white hover:bg-lexi-primary-dark"
        >
          Tiếp tục →
        </button>
      </div>
    );
  }

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
                {index + 1 < questions.length
                  ? "Câu tiếp theo"
                  : sessionNumber !== undefined
                    ? "Xem kết quả buổi học"
                    : "Hoàn thành luyện tập"}
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
