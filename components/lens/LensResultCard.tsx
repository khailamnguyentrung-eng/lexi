"use client";

import type { LensResponse, AssistanceStyle } from "@/lib/services/lens-ai/types";

const STYLE_LABEL: Record<AssistanceStyle, string> = {
  GUIDED_STEPS: "Hướng dẫn từng bước",
  VOCABULARY_MEANING: "Từ vựng",
  CONCEPT_EXPLANATION: "Giải thích",
  SUMMARY: "Tóm tắt",
  GENERAL_HELP: "Giải đáp",
};

interface LensResultCardProps {
  response: LensResponse;
  onContinue: () => void;
  onRetry: () => void;
}

export function LensResultCard({ response, onContinue, onRetry }: LensResultCardProps) {
  const { assistanceStyle, explanation, steps, relatedTopics, flags } = response;

  return (
    <div className="rounded-2xl border border-lexi-primary/20 bg-lexi-soft p-5 text-sm">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-lexi-primary">
          LEXI LENS
        </p>
        {assistanceStyle && (
          <span className="rounded-full bg-lexi-primary/10 px-2.5 py-0.5 text-xs font-medium text-lexi-primary-dark">
            {STYLE_LABEL[assistanceStyle]}
          </span>
        )}
      </div>

      {/* Steps */}
      {steps && steps.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {steps.map((step) => (
            <li key={step.stepNumber} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lexi-primary text-[10px] font-bold text-white">
                {step.stepNumber}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{step.instruction}</span>
                {step.reasoning && (
                  <span className="text-xs text-zinc-500">{step.reasoning}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : explanation ? (
        <p className="leading-relaxed text-foreground">{explanation}</p>
      ) : null}

      {/* Related topics */}
      {relatedTopics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {relatedTopics.map((topic) => (
            <span key={topic} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Quality warnings */}
      {flags.includes("OCR_CONFIDENCE_LOW") && (
        <p className="mt-2 text-xs text-amber-700">
          Hình ảnh không rõ — kết quả có thể chưa chính xác.
        </p>
      )}
      {flags.includes("AI_PARSE_ERROR") && (
        <p className="mt-2 text-xs text-zinc-500">
          Lexi không chắc về câu trả lời này — hãy kiểm tra lại.
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onContinue}
          className="rounded-full bg-lexi-primary px-4 py-2 text-xs font-semibold text-white hover:bg-lexi-primary-dark"
        >
          Tiếp tục luyện tập
        </button>
        <button
          onClick={onRetry}
          className="rounded-full border border-lexi-primary px-4 py-2 text-xs font-medium text-lexi-primary-dark hover:bg-lexi-soft"
        >
          Hỏi thêm
        </button>
      </div>
    </div>
  );
}
