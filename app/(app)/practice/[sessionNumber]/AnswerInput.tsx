"use client";

import { useState } from "react";
import { splitForUnderline } from "@/lib/phonetics";
import type {
  PublicQuestionPayload,
  PublicSingleChoicePayload,
  PublicMultiChoicePayload,
  PublicShortTextPayload,
  PublicMatchingPayload,
  PublicOrderingPayload,
  ResponseFormatName,
  QuestionResponse,
  SingleChoiceResponse,
  MultiChoiceResponse,
  ShortTextResponse,
  MatchingResponse,
  OrderingResponse,
} from "@/lib/services/question-format";

/**
 * One component per ResponseFormat, dispatched by AnswerInput below.
 *
 * SINGLE_CHOICE submits on click — unchanged UX from before this format
 * existed. The other four need an explicit submit action: a learner is
 * composing a multi-part answer (several blanks, several pairs, an order),
 * and submitting on the first partial interaction would be premature.
 *
 * `initialResponse` (all formats) hydrates a previously-given answer — used
 * by the mock test Test Player, where a learner can navigate away from a
 * question and back before final submission and must see their own prior
 * answer still there, not a blank slate. Practice mode passes no initial
 * response (there is nothing to hydrate: PracticeQuiz locks a question after
 * one answer).
 *
 * None of these render post-submission feedback themselves — the generic
 * feedback panel in PracticeQuiz.tsx (submitted vs. correct, in plain text)
 * covers every format uniformly. Bespoke per-format visual highlighting
 * (e.g. colouring each matched pair) is real, separate polish work — see
 * docs/QUESTION_MODEL_REFORM.md §7; not attempted here.
 */

interface FormatComponentProps<Payload, Response> {
  payload: Payload;
  onSubmit: (response: Response) => void;
  disabled: boolean;
  initialResponse?: Response | null;
}

function SingleChoiceAnswer({
  payload,
  onSubmit,
  disabled,
  selectedOptionId,
  correctOptionId,
  isUnderlineType,
  underlineTopic,
}: FormatComponentProps<PublicSingleChoicePayload, SingleChoiceResponse> & {
  selectedOptionId: string | null;
  // null before an answer is revealed (mock test: never, until results;
  // practice: until the learner answers). A truthy value switches this
  // component from "neutral selection" to "graded" colouring.
  correctOptionId: string | null;
  isUnderlineType: boolean;
  underlineTopic: string;
}) {
  function renderText(text: string) {
    if (!isUnderlineType) return text;
    const { before, underline, after } = splitForUnderline(text, underlineTopic);
    if (!underline) return text;
    return (
      <>
        {before}
        <span className="underline">{underline}</span>
        {after}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {payload.options.map((opt) => {
        const isSelected = selectedOptionId === opt.id;
        const isCorrectOpt = correctOptionId === opt.id;
        let style = "border-zinc-200 hover:border-lexi-primary";
        if (correctOptionId) {
          if (isCorrectOpt) style = "border-emerald-400 bg-emerald-50";
          else if (isSelected) style = "border-rose-300 bg-rose-50";
          else style = "border-zinc-100 opacity-60";
        } else if (isSelected) {
          // Chosen but not yet graded/revealed (mock test, before submit) —
          // a neutral highlight so the learner can see their own pick
          // without it implying right/wrong.
          style = "border-lexi-primary bg-lexi-soft";
        }
        return (
          <button
            key={opt.id}
            onClick={() => onSubmit({ optionId: opt.id })}
            disabled={disabled}
            className={`rounded-xl border px-4 py-2 text-left text-sm transition ${style}`}
          >
            <span className="font-medium">{opt.id}.</span> {renderText(opt.text)}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceAnswer({
  payload,
  onSubmit,
  disabled,
  initialResponse,
}: FormatComponentProps<PublicMultiChoicePayload, MultiChoiceResponse>) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialResponse?.optionIds ?? []));

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {payload.options.map((opt) => (
        <label
          key={opt.id}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:border-lexi-primary"
        >
          <input
            type="checkbox"
            checked={picked.has(opt.id)}
            disabled={disabled}
            onChange={() => toggle(opt.id)}
          />
          {opt.text}
        </label>
      ))}
      <button
        onClick={() => onSubmit({ optionIds: Array.from(picked) })}
        disabled={disabled || picked.size === 0}
        className="mt-1 self-start rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        Ghi câu trả lời
      </button>
    </div>
  );
}

function ShortTextAnswer({
  payload,
  onSubmit,
  disabled,
  initialResponse,
}: FormatComponentProps<PublicShortTextPayload, ShortTextResponse>) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialResponse?.answers ?? {});
  const allFilled = payload.blanks.every((b) => (answers[b.id] ?? "").trim().length > 0);

  return (
    <div className="flex flex-col gap-2">
      {payload.blanks.map((b, i) => (
        <div key={b.id} className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Chỗ trống {i + 1}</span>
          <input
            type="text"
            value={answers[b.id] ?? ""}
            disabled={disabled}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [b.id]: e.target.value }))}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            placeholder="Nhập câu trả lời..."
          />
        </div>
      ))}
      <button
        onClick={() => onSubmit({ answers })}
        disabled={disabled || !allFilled}
        className="mt-1 self-start rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        Ghi câu trả lời
      </button>
    </div>
  );
}

function MatchingAnswer({
  payload,
  onSubmit,
  disabled,
  initialResponse,
}: FormatComponentProps<PublicMatchingPayload, MatchingResponse>) {
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries((initialResponse?.pairs ?? []).map((p) => [p.leftId, p.rightId]))
  );
  const allChosen = payload.left.every((l) => Boolean(choices[l.id]));

  return (
    <div className="flex flex-col gap-2">
      {payload.left.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <span className="w-1/2 text-sm">{l.text}</span>
          <select
            value={choices[l.id] ?? ""}
            disabled={disabled}
            onChange={(e) => setChoices((prev) => ({ ...prev, [l.id]: e.target.value }))}
            className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              Chọn...
            </option>
            {payload.right.map((r) => (
              <option key={r.id} value={r.id}>
                {r.text}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        onClick={() =>
          onSubmit({ pairs: Object.entries(choices).map(([leftId, rightId]) => ({ leftId, rightId })) })
        }
        disabled={disabled || !allChosen}
        className="mt-1 self-start rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        Ghi câu trả lời
      </button>
    </div>
  );
}

function OrderingAnswer({
  payload,
  onSubmit,
  disabled,
  initialResponse,
}: FormatComponentProps<PublicOrderingPayload, OrderingResponse>) {
  const [order, setOrder] = useState<string[]>(
    () => initialResponse?.order ?? payload.items.map((it) => it.id)
  );
  const byId = new Map(payload.items.map((it) => [it.id, it.text]));

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {order.map((id, i) => (
        <div key={id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
          <span className="text-xs text-zinc-400">{i + 1}.</span>
          <span className="flex-1">{byId.get(id)}</span>
          <button
            onClick={() => move(i, -1)}
            disabled={disabled || i === 0}
            aria-label="Di chuyển lên"
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={() => move(i, 1)}
            disabled={disabled || i === order.length - 1}
            aria-label="Di chuyển xuống"
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ↓
          </button>
        </div>
      ))}
      <button
        onClick={() => onSubmit({ order })}
        disabled={disabled}
        className="mt-1 self-start rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        Ghi câu trả lời
      </button>
    </div>
  );
}

export function AnswerInput({
  responseFormat,
  payload,
  onSubmit,
  disabled,
  selectedOptionId,
  correctOptionId,
  isUnderlineType,
  underlineTopic,
  initialResponse,
}: {
  responseFormat: ResponseFormatName;
  payload: PublicQuestionPayload;
  onSubmit: (response: QuestionResponse) => void;
  disabled: boolean;
  // SINGLE_CHOICE-only, for the click-to-submit + post-answer highlight UX.
  selectedOptionId: string | null;
  correctOptionId: string | null;
  isUnderlineType: boolean;
  underlineTopic: string;
  // Non-SINGLE_CHOICE formats only — see the file header.
  initialResponse?: QuestionResponse | null;
}) {
  switch (responseFormat) {
    case "SINGLE_CHOICE":
      return (
        <SingleChoiceAnswer
          payload={payload as PublicSingleChoicePayload}
          onSubmit={onSubmit}
          disabled={disabled}
          selectedOptionId={selectedOptionId}
          correctOptionId={correctOptionId}
          isUnderlineType={isUnderlineType}
          underlineTopic={underlineTopic}
        />
      );
    case "MULTI_CHOICE":
      return (
        <MultiChoiceAnswer
          payload={payload as PublicMultiChoicePayload}
          onSubmit={onSubmit}
          disabled={disabled}
          initialResponse={initialResponse as MultiChoiceResponse | null}
        />
      );
    case "SHORT_TEXT":
      return (
        <ShortTextAnswer
          payload={payload as PublicShortTextPayload}
          onSubmit={onSubmit}
          disabled={disabled}
          initialResponse={initialResponse as ShortTextResponse | null}
        />
      );
    case "MATCHING":
      return (
        <MatchingAnswer
          payload={payload as PublicMatchingPayload}
          onSubmit={onSubmit}
          disabled={disabled}
          initialResponse={initialResponse as MatchingResponse | null}
        />
      );
    case "ORDERING":
      return (
        <OrderingAnswer
          payload={payload as PublicOrderingPayload}
          onSubmit={onSubmit}
          disabled={disabled}
          initialResponse={initialResponse as OrderingResponse | null}
        />
      );
  }
}
