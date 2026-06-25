import { tesseractProvider } from "./tesseractProvider";
import type { OCRProvider } from "./types";

// Selector function, not a bare export — mirrors getAIProvider()'s role.
// Only one engine exists today, so there's nothing to fall back *from*
// (unlike getAIProviderStatus()'s isFallback/fallbackReason machinery);
// add that only once a second OCR provider actually exists.
export function getOCRProvider(): OCRProvider {
  return tesseractProvider;
}

export type { OCRProvider, OCRInput, OCRResult } from "./types";
