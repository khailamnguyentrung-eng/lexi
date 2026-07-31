import { describeCorrectAnswer, type QuestionPayload, type ResponseFormatName } from "@/lib/services/question-format";

// Shared by DraftReviewCard and SampleTestButton — both show "what is the
// correct answer" for a draft before Tasks 2-5 (sub-project B), that was
// always 4 hardcoded option fields; now it must render whatever
// ResponseFormat the AI chose. Reuses describeCorrectAnswer() (already
// built for the learner-facing results page) rather than writing a second
// per-format renderer.
export function DraftAnswerSummary({
  responseFormat,
  payload,
}: {
  responseFormat: string | undefined;
  payload: string | undefined;
}) {
  if (!responseFormat || !payload) {
    return <p className="mt-1 text-rose-600">Thiếu responseFormat/payload — câu này sẽ bị từ chối khi duyệt.</p>;
  }
  let parsed: QuestionPayload;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return <p className="mt-1 text-rose-600">payload không đọc được (JSON lỗi).</p>;
  }
  return (
    <p className="mt-1 text-emerald-700">
      [{responseFormat}] Đáp án đúng: {describeCorrectAnswer(responseFormat as ResponseFormatName, parsed)}
    </p>
  );
}
