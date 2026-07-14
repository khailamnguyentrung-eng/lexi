import { getAIProvider } from "@/lib/ai/providers/index";
import { prisma } from "@/lib/db/prisma";
import { validateCapturePayload } from "../capture";
import { extractTextFromImage } from "../understanding/imageProcessor";
import type { AssistanceStyle, CapturePayload, LensFlag, LensResponse, LensStep } from "../types";
import { detectIntent } from "./intentDetector";
import { planAssistance } from "./assistancePlanner";

export class AssistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistError";
  }
}

function stripCodeFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

export function parseAssistanceResponse(
  rawText: string,
  requestId: string,
  style: AssistanceStyle,
  ocrFlags: LensFlag[] = [],
): LensResponse {
  const flags: LensFlag[] = [...ocrFlags, "ANONYMOUS_NO_PERSONALIZATION"];

  try {
    const json = JSON.parse(stripCodeFence(rawText));

    const relatedTopics = Array.isArray(json.relatedTopics)
      ? json.relatedTopics.filter((t: unknown) => typeof t === "string")
      : [];

    const confidence =
      typeof json.confidence === "number"
        ? Math.min(1, Math.max(0, json.confidence))
        : 0.7;

    if (style === "GUIDED_STEPS" && Array.isArray(json.steps)) {
      const steps: LensStep[] = json.steps.map(
        (s: { stepNumber?: unknown; instruction?: unknown; reasoning?: unknown }, i: number) => ({
          stepNumber: typeof s.stepNumber === "number" ? s.stepNumber : i + 1,
          instruction: typeof s.instruction === "string" ? s.instruction : "",
          ...(typeof s.reasoning === "string" ? { reasoning: s.reasoning } : {}),
        }),
      );
      return { requestId, assistanceStyle: style, steps, relatedTopics, confidence, flags };
    }

    return {
      requestId,
      assistanceStyle: style,
      explanation: typeof json.explanation === "string" ? json.explanation : rawText.trim(),
      relatedTopics,
      confidence,
      flags,
    };
  } catch {
    flags.push("AI_PARSE_ERROR");
    return {
      requestId,
      assistanceStyle: style,
      explanation: rawText.trim(),
      relatedTopics: [],
      confidence: 0.5,
      flags,
    };
  }
}

/**
 * Phase 7.3 entry point — contextual learning assistance.
 *
 * The system detects intent from the captured content and selects the
 * appropriate assistance style. No mode is passed by the caller.
 *
 * Flow:
 *   TEXT_SELECTION → direct text
 *   IMAGE_UPLOAD / SCREENSHOT_REGION → OCR (reuses Phase 7.2 pipeline)
 *   text → detectIntent → planAssistance → AIProvider.chat → LensResponse
 *
 * @param aiProvider  Optional injectable AI provider — used in tests to avoid
 *                    real network calls. Defaults to getAIProvider().
 */
export async function assistFromCapture(
  payload: CapturePayload,
  userId: string,
  aiProvider = getAIProvider(),
): Promise<LensResponse> {
  validateCapturePayload(payload);

  // ── Extract text (reuse Phase 7.2 OCR pipeline) ──────────────────────────
  let text: string;
  let ocrFlags: LensFlag[] = [];

  if (payload.type === "TEXT_SELECTION") {
    text = payload.extractedText ?? "";
  } else {
    const ocrResult = await extractTextFromImage(payload);
    text = ocrResult.text;
    ocrFlags = ocrResult.flags;
  }

  if (!text.trim()) {
    return {
      requestId: payload.id,
      assistanceStyle: "GENERAL_HELP",
      relatedTopics: [],
      confidence: 0,
      flags: ["EMPTY_CAPTURE_TEXT", ...ocrFlags],
    };
  }

  // ── Detect intent and plan assistance ────────────────────────────────────
  const intent = detectIntent(text);
  const plan = planAssistance(intent);

  // ── Call AI (same AIProvider abstraction as Phase 7.1–7.2) ───────────────
  const rawResponse = await aiProvider.chat({
    system: plan.systemPrompt,
    messages: [{ role: "user", content: plan.buildUserMessage(text) }],
  });

  const response = parseAssistanceResponse(rawResponse, payload.id, plan.style, ocrFlags);

  // ── Persist the exchange as Evidence (LX-1 / Constitution 5.5 / Rule 7) ───
  // Append-only: one row per completed exchange. Only the AI-answered path
  // reaches here — the empty-capture early return above is a validation
  // rejection, not an exchange, and is intentionally not recorded.
  await prisma.assistanceExchange.create({
    data: {
      userId,
      captureType: payload.type,
      capturedText: text,
      assistanceStyle: plan.style,
      responseContent: JSON.stringify({
        explanation: response.explanation,
        steps: response.steps,
        relatedTopics: response.relatedTopics,
      }),
      confidence: response.confidence,
      flags: JSON.stringify(response.flags),
      providerName: aiProvider.name,
    },
  });

  return response;
}
