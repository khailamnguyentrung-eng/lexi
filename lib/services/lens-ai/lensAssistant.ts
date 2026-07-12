import { getAIProvider } from "@/lib/ai/providers/index";
import { validateCapturePayload } from "./capture";
import {
  EXPLAIN_SYSTEM_PROMPT,
  buildExplainUserMessage,
  parseLensExplainResponse,
} from "./promptBuilder";
import { extractTextFromImage } from "./understanding/imageProcessor";
import { ANONYMOUS_CONTEXT, IMPLEMENTED_MODES } from "./types";
import type {
  CapturePayload,
  InteractionMode,
  LensFlag,
  LensLearningContext,
  LensResponse,
} from "./types";

export class LensError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LensError";
  }
}

/**
 * LEXI Lens AI — Phase 7.2 entry point.
 *
 * Supported capture types:
 *   TEXT_SELECTION → direct text → AI pipeline
 *   IMAGE_UPLOAD / SCREENSHOT_REGION → OCR → extracted text → AI pipeline
 *
 * Mode check happens BEFORE type routing so unimplemented modes short-circuit
 * without triggering OCR.
 *
 * @param payload   TEXT_SELECTION, IMAGE_UPLOAD, or SCREENSHOT_REGION
 * @param mode      EXPLAIN is the only implemented mode in Phase 7.2
 * @param _userId   Reserved for Phase 7.4 profile integration; ignored now
 */
export async function captureAndAssist(
  payload: CapturePayload,
  mode: InteractionMode,
  _userId?: string,
): Promise<LensResponse> {
  // 1. Validate payload structure
  validateCapturePayload(payload);

  // 2. Mode check first — skip OCR for unimplemented modes
  if (!IMPLEMENTED_MODES.includes(mode)) {
    return {
      requestId: payload.id,
      mode,
      relatedTopics: [],
      confidence: 0,
      flags: ["MODE_NOT_IMPLEMENTED"],
    };
  }

  let text: string;
  let ocrFlags: LensFlag[] = [];

  if (payload.type === "TEXT_SELECTION") {
    text = payload.extractedText ?? "";
    if (!text.trim()) {
      return {
        requestId: payload.id,
        mode,
        relatedTopics: [],
        confidence: 0,
        flags: ["EMPTY_CAPTURE_TEXT"],
      };
    }
  } else {
    // IMAGE_UPLOAD or SCREENSHOT_REGION — OCR path
    const ocrResult = await extractTextFromImage(payload);
    text = ocrResult.text;
    ocrFlags = ocrResult.flags;
    if (!text.trim()) {
      return {
        requestId: payload.id,
        mode,
        relatedTopics: [],
        confidence: 0,
        flags: ["EMPTY_CAPTURE_TEXT", ...ocrFlags],
      };
    }
  }

  // 3. Call AI via the existing abstraction (same for text and image paths)
  const context: LensLearningContext = ANONYMOUS_CONTEXT;
  const provider = getAIProvider();
  const userMessage = buildExplainUserMessage(text, context);
  const rawResponse = await provider.chat({
    system: EXPLAIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // 4. Parse and prepend OCR flags before AI flags
  const response = parseLensExplainResponse(rawResponse, payload.id, mode);
  if (ocrFlags.length === 0) return response;
  return { ...response, flags: [...ocrFlags, ...response.flags] };
}
