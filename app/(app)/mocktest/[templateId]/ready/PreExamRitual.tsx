"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BreathPhase = "in" | "hold" | "out";

// One cycle: 4s in, 4s hold, 4s out — the common box-breathing cadence,
// slow enough to actually lower heart rate rather than just being decorative.
const PHASE_DURATIONS: Record<BreathPhase, number> = { in: 4000, hold: 4000, out: 4000 };
const PHASE_LABEL: Record<BreathPhase, string> = { in: "Hít vào...", hold: "Giữ...", out: "Thở ra..." };
const NEXT_PHASE: Record<BreathPhase, BreathPhase> = { in: "hold", hold: "out", out: "in" };
const TOTAL_CYCLES = 3;

/**
 * Shown BEFORE a mock test attempt is created — deliberately its own step,
 * not a modal layered on top of the Test Player. The timer only starts once
 * startAttempt() is called (see MockTestAttempt.startedAt), so this screen
 * must live entirely before that call: a calming ritual that eats into the
 * exam's own time budget would rush the learner more than it calms them,
 * defeating the point.
 *
 * The breathing animation runs on its own regardless of whether the learner
 * watches it — "Tôi đã sẵn sàng" is never gated behind waiting for it to
 * finish. Matches the design doc's own emotional annotation for this moment
 * ("anxious — reduce options, respect the learner's own pace") and the
 * general rule this app follows elsewhere (e.g. the mid-exam breathing
 * prompt in PracticeQuiz.tsx auto-advances but also has an explicit
 * "Tiếp tục" the learner can hit early).
 */
export function PreExamRitual({
  templateId,
  title,
  totalQuestions,
  timeLimitMin,
}: {
  templateId: string;
  title: string;
  totalQuestions: number;
  timeLimitMin: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<BreathPhase>("in");
  const [cycle, setCycle] = useState(1);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (cycle > TOTAL_CYCLES) return; // let the last "thở ra" sit rather than snapping back to "in"
    const timer = setTimeout(() => {
      setPhase((p) => {
        const next = NEXT_PHASE[p];
        if (next === "in") setCycle((c) => c + 1); // completed a full cycle
        return next;
      });
    }, PHASE_DURATIONS[phase]);
    return () => clearTimeout(timer);
  }, [phase, cycle]);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    const res = await fetch(`/api/mocktest/templates/${templateId}/start`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      router.push(`/mocktest/attempt/${data.attemptId}`);
    } else {
      setStarting(false);
    }
  }

  const isExpanded = phase === "in" || phase === "hold";
  const ritualDone = cycle > TOTAL_CYCLES;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-3xl border border-lexi-primary/20 bg-lexi-soft p-8 text-center">
      <div>
        <p className="text-lg font-semibold text-lexi-primary-dark">{title}</p>
        <p className="mt-1 text-sm text-zinc-600">
          {totalQuestions} câu · {timeLimitMin} phút — tính giờ từ lúc bạn bấm bắt đầu, không phải bây giờ
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="rounded-full bg-lexi-primary/20 transition-all ease-in-out"
          style={{
            width: isExpanded ? 120 : 70,
            height: isExpanded ? 120 : 70,
            transitionDuration: `${PHASE_DURATIONS[phase]}ms`,
          }}
        />
        <p className="text-sm font-medium text-lexi-primary-dark">
          {ritualDone ? "Sẵn sàng chưa nào?" : PHASE_LABEL[phase]}
        </p>
        {!ritualDone && <p className="text-xs text-zinc-400">Vòng thở {cycle}/{TOTAL_CYCLES}</p>}
      </div>

      <p className="text-sm text-zinc-600">
        Hít thở đều, thả lỏng vai. Trong bài thi sẽ không hiện đáp án đúng/sai cho từng câu — giống
        như thi thật — bạn chỉ xem kết quả sau khi nộp bài. Cứ bình tĩnh làm hết khả năng nhé! 🦄
      </p>

      <button
        onClick={handleStart}
        disabled={starting}
        className="rounded-full bg-lexi-primary px-6 py-3 text-sm font-semibold text-white hover:bg-lexi-primary-dark disabled:opacity-50"
      >
        {starting ? "Đang chuẩn bị..." : "Tôi đã sẵn sàng, bắt đầu →"}
      </button>
    </div>
  );
}
