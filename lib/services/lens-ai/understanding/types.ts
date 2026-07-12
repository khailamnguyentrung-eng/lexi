import type { RawImageData } from "../types";

export interface OcrResult {
  extractedText: string | null;
  confidence: number | null;   // 0–1; null if no text was found at all
}

export interface OcrProvider {
  name: string;
  extractText(
    image: RawImageData,
    mimeType?: "image/png" | "image/jpeg" | "image/webp",
  ): Promise<OcrResult>;
}
