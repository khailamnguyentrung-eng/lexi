import type { CapturePayload, LensFlag } from "../types";
import type { OcrProvider } from "./types";
import { getOcrProvider } from "./ocr";

export class OcrExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrExtractionError";
  }
}

const OCR_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Runs OCR on an image CapturePayload and returns extracted text + flags.
 * Throws OcrExtractionError if the payload has no image data.
 * Returns { text: "", flags } (not throw) when the image has no readable text.
 *
 * @param provider  Injected OcrProvider; defaults to MockOcrProvider (swappable for tests)
 */
export async function extractTextFromImage(
  payload: CapturePayload,
  provider: OcrProvider = getOcrProvider(),
): Promise<{ text: string; flags: LensFlag[] }> {
  if (!payload.image) {
    throw new OcrExtractionError(
      `${payload.type} payload must include image data for OCR`,
    );
  }

  const result = await provider.extractText(payload.image, payload.mimeType);
  const flags: LensFlag[] = [];

  if (result.confidence !== null && result.confidence < OCR_CONFIDENCE_THRESHOLD) {
    flags.push("OCR_CONFIDENCE_LOW");
  }

  const text = result.extractedText?.trim() ?? "";
  return { text, flags };
}
