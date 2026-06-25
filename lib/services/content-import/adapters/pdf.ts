// Real PDF -> plain text extraction. Purely mechanical (no AI) — used as
// the PDF branch of extractor.ts's file-type dispatch. Turning this raw
// text into structured question drafts is still normalizer.ts's job, and
// that step remains a mock until AI/NLP normalization is built.
import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export async function extractPdfText(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    // FUTURE SEAM (not implemented): a scanned PDF with no embedded text
    // layer makes pdf-parse return empty/near-empty text here even though
    // the file visibly has content. The fix is NOT here — it belongs in
    // extractor.ts's PDF case: if extractPdfText() returns near-empty
    // text, render each page to an image and run it through lib/ocr's
    // OCRProvider (the same one IMAGE files use), then concatenate the
    // per-page OCR text as the fallback rawText. Intentionally not
    // implemented — it requires a new PDF-to-image rendering dependency,
    // out of scope for this change.
    return result.text;
  } finally {
    await parser.destroy();
  }
}
