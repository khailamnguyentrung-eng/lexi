"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { splitForUnderline } from "@/lib/phonetics";
import { getCorrectMessage, getIncorrectIntro } from "@/lib/ai/encouragement";

interface QuizQuestion {
  id: string;
  type: string;
  topic: string;
  promptText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
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
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    explanationVi: string;
    commonMistake: string | null;
    concept: string;
    selectedOption: string;
    correctOption: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [midExamPrompt, setMidExamPrompt] = useState(false);
  const [midExamCountdown, setMidExamCountdown] = useState(5);

  const current = questions[index];
  // Pick once per question so the message doesn't shuffle on re-render.
  const correctMessage = useMemo(() => getCorrectMessage(), [current?.id]);
  const incorrectIntro = useMemo(() => getIncorrectIntro(), [current?.id]);

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

  async function handleAnswer(option: string) {
    if (feedback || submitting) return;
    setSubmitting(true);

    const body: Record<string, string> = { selectedOption: option };
    if (curriculumSessionId) body.curriculumSessionId = curriculumSessionId;

    const res = await fetch(`/api/questions/${current.id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setFeedback({ ...data, selectedOption: option });
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

  function renderOptionText(opt: "A" | "B" | "C" | "D") {
    const text = current[`option${opt}` as keyof QuizQuestion] as string;
    if (!isUnderlineType) return text;

    const { before, underline, after } = splitForUnderline(text, current.topic);
    if (!underline) return text;
    return (
      <>
        {before}
        <span className="underline">{underline}</span>
        {after}
      </>
    );
  }

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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-400">
        Câu {index + 1}/{questions.length}
      </p>
      <div className="rounded-3xl border border-zinc-100 bg-white p-6">
        <p className="mb-4 text-foreground">{current.promptText}</p>
        <div className="flex flex-col gap-2">
          {(["A", "B", "C", "D"] as const).map((opt) => {
            const isSelected = feedback?.selectedOption === opt;
            const isCorrectOpt = feedback?.correctOption === opt;
            let style = "border-zinc-200 hover:border-lexi-primary";
            if (feedback) {
              if (isCorrectOpt) style = "border-emerald-400 bg-emerald-50";
              else if (isSelected) style = "border-rose-300 bg-rose-50";
              else style = "border-zinc-100 opacity-60";
            }
            return (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={!!feedback || submitting}
                className={`rounded-xl border px-4 py-2 text-left text-sm transition ${style}`}
              >
                <span className="font-medium">{opt}.</span> {renderOptionText(opt)}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="mt-4 rounded-2xl bg-lexi-soft p-4 text-sm">
            {feedback.isCorrect ? (
              <p className="font-medium text-lexi-primary-dark">{correctMessage}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-medium text-lexi-primary-dark">{incorrectIntro}</p>
                <p className="text-zinc-600">
                  Bạn chọn: <span className="font-medium text-rose-600">{feedback.selectedOption}</span> —{" "}
                  đáp án đúng là <span className="font-medium text-emerald-600">{feedback.correctOption}</span>
                </p>
              </div>
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
              {!feedback.isCorrect && (
                <Link
                  href={`/error-notebook/new?concept=${encodeURIComponent(feedback.concept)}&studentAnswer=${encodeURIComponent(
                    feedback.selectedOption
                  )}&correctAnswer=${encodeURIComponent(feedback.correctOption)}&reason=${encodeURIComponent(
                    feedback.explanationVi
                  )}&questionId=${current.id}`}
                  className="rounded-full border border-lexi-primary px-4 py-2 text-xs font-medium text-lexi-primary-dark"
                >
                  Ghi vào sổ lỗi
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
