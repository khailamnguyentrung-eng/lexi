import {
  describeCorrectAnswer,
  validatePayload,
  RESPONSE_FORMATS,
  type QuestionPayload,
  type ResponseFormatName,
} from "@/lib/services/question-format";

// Shared by DraftReviewCard and SampleTestButton — both show "what is the
// correct answer" for a draft before Tasks 2-5 (sub-project B), that was
// always 4 hardcoded option fields; now it must render whatever
// ResponseFormat the AI chose. Reuses describeCorrectAnswer() (already
// built for the learner-facing results page) rather than writing a second
// per-format renderer.
//
// SampleTestButton intentionally renders REJECTED drafts too, so an admin can
// see why a draft failed. A very common rejection reason is exactly a
// structurally-malformed payload (validatePayload() caught it) — well-formed
// JSON that doesn't match its declared format's shape (e.g. SINGLE_CHOICE
// missing `options`). describeCorrectAnswer() assumes a validated payload and
// will throw (e.g. .find() on undefined) if given one that isn't. So this
// component must re-run validatePayload() itself before calling
// describeCorrectAnswer() — JSON.parse succeeding is not enough.
function isResponseFormatName(value: string): value is ResponseFormatName {
  return (RESPONSE_FORMATS as readonly string[]).includes(value);
}

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
  if (!isResponseFormatName(responseFormat)) {
    return <p className="mt-1 text-rose-600">responseFormat "{responseFormat}" không hợp lệ.</p>;
  }
  let parsed: QuestionPayload;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return <p className="mt-1 text-rose-600">payload không đọc được (JSON lỗi).</p>;
  }
  const validation = validatePayload(responseFormat, parsed);
  if (!validation.valid) {
    return (
      <p className="mt-1 text-rose-600">
        payload sai định dạng cho responseFormat "{responseFormat}"
        {validation.issues.length > 0 && ` — ${validation.issues.map((i) => i.message).join("; ")}`}
      </p>
    );
  }
  return (
    <p className="mt-1 text-emerald-700">
      [{responseFormat}] Đáp án đúng: {describeCorrectAnswer(responseFormat, parsed)}
    </p>
  );
}
