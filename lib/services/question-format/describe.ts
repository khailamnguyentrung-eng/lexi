/**
 * Render "what was answered" / "what the correct answer was" as plain text,
 * one function per format. Shared by the practice Test Player
 * (PracticeQuiz.tsx) and the mock test results page — both need to show a
 * submitted response against the answer key, and duplicating this per page
 * is exactly the kind of drift QM-1's core exists to prevent elsewhere.
 *
 * Deliberately text, not a bespoke visual per format — see
 * app/(app)/practice/[sessionNumber]/AnswerInput.tsx's file header for why
 * that's out of scope.
 */

import type {
  MatchingPayload,
  MatchingResponse,
  MultiChoicePayload,
  MultiChoiceResponse,
  OrderingPayload,
  OrderingResponse,
  QuestionPayload,
  QuestionResponse,
  ResponseFormatName,
  ShortTextPayload,
  ShortTextResponse,
  SingleChoicePayload,
  SingleChoiceResponse,
} from "./types";

export function describeResponse(
  format: ResponseFormatName,
  payload: QuestionPayload,
  response: QuestionResponse | null
): string {
  switch (format) {
    case "SINGLE_CHOICE": {
      const p = payload as SingleChoicePayload;
      const r = response as SingleChoiceResponse | null;
      return p.options.find((o) => o.id === r?.optionId)?.text ?? "(chưa trả lời)";
    }
    case "MULTI_CHOICE": {
      const p = payload as MultiChoicePayload;
      const r = response as MultiChoiceResponse | null;
      const texts = (r?.optionIds ?? []).map((id) => p.options.find((o) => o.id === id)?.text ?? id);
      return texts.length ? texts.join(", ") : "(chưa chọn đáp án nào)";
    }
    case "SHORT_TEXT": {
      const p = payload as ShortTextPayload;
      const r = response as ShortTextResponse | null;
      return p.blanks.map((b, i) => `(${i + 1}) ${r?.answers?.[b.id] || "—"}`).join("; ");
    }
    case "MATCHING": {
      const p = payload as MatchingPayload;
      const r = response as MatchingResponse | null;
      return (r?.pairs ?? [])
        .map((pair) => {
          const left = p.left.find((l) => l.id === pair.leftId)?.text ?? pair.leftId;
          const right = p.right.find((rt) => rt.id === pair.rightId)?.text ?? pair.rightId;
          return `${left} → ${right}`;
        })
        .join("; ") || "(chưa ghép cặp nào)";
    }
    case "ORDERING": {
      const p = payload as OrderingPayload;
      const r = response as OrderingResponse | null;
      const order = r?.order ?? [];
      return order.length ? order.map((id) => p.items.find((it) => it.id === id)?.text ?? id).join(" → ") : "(chưa sắp xếp)";
    }
  }
}

export function describeCorrectAnswer(format: ResponseFormatName, payload: QuestionPayload): string {
  switch (format) {
    case "SINGLE_CHOICE": {
      const p = payload as SingleChoicePayload;
      return p.options.find((o) => o.id === p.correctOptionId)?.text ?? "";
    }
    case "MULTI_CHOICE": {
      const p = payload as MultiChoicePayload;
      return p.correctOptionIds.map((id) => p.options.find((o) => o.id === id)?.text ?? id).join(", ");
    }
    case "SHORT_TEXT": {
      const p = payload as ShortTextPayload;
      return p.blanks.map((b, i) => `(${i + 1}) ${b.acceptedAnswers[0]}`).join("; ");
    }
    case "MATCHING": {
      const p = payload as MatchingPayload;
      return p.correctPairs
        .map((pair) => {
          const left = p.left.find((l) => l.id === pair.leftId)?.text ?? pair.leftId;
          const right = p.right.find((r) => r.id === pair.rightId)?.text ?? pair.rightId;
          return `${left} → ${right}`;
        })
        .join("; ");
    }
    case "ORDERING": {
      const p = payload as OrderingPayload;
      return p.correctOrder.map((id) => p.items.find((it) => it.id === id)?.text ?? id).join(" → ");
    }
  }
}
