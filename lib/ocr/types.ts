// OCRProvider abstraction — mirrors lib/ai/providers/types.ts's shape so
// OCR engines are as swappable as AI providers are. Only one implementation
// (tesseractProvider) exists today; this interface is the seam for a future
// second engine (e.g. a scanned-PDF-page OCR path, see the FUTURE SEAM
// comment in adapters/pdf.ts) without touching extractor.ts.
export type OCRInput =
  | { kind: "filePath"; filePath: string }
  | { kind: "buffer"; buffer: Buffer; mimeType?: string };

export interface OCRResult {
  text: string;
  engine: string; // e.g. "tesseract" — logged, never persisted to the DB
  durationMs: number;
  textLength: number; // text.length, surfaced for the console log line
}

export interface OCRProvider {
  name: "tesseract";
  // Only `kind: "filePath"` is implemented today (the IMAGE upload case).
  // `kind: "buffer"` exists on the type now so a future caller (e.g. a
  // rendered PDF page, which would naturally be an in-memory buffer rather
  // than a file on disk) doesn't force a breaking interface change later —
  // tesseractProvider.ts throws a clear "not implemented" error for it
  // until that future caller actually exists.
  recognize(input: OCRInput): Promise<OCRResult>;
}
