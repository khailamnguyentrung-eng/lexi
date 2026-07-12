import type { RawImageData } from "../types";
import type { OcrProvider, OcrResult } from "./types";

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock-ocr";

  async extractText(image: RawImageData): Promise<OcrResult> {
    if (!image.base64 || image.base64.trim().length === 0) {
      return { extractedText: null, confidence: null };
    }
    return {
      extractedText: `[mock-ocr: ${image.widthPx}×${image.heightPx} image]`,
      confidence: 0.9,
    };
  }
}

export function getOcrProvider(): OcrProvider {
  return new MockOcrProvider();
}
