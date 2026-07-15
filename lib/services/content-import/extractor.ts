// Step 1 of the pipeline: turn a stored file (PDF/DOCX/image) into raw
// text. DOCX/PDF use real, mechanical extraction (mammoth / pdf-parse — no
// AI involved). IMAGE uses real OCR (lib/ocr's OCRProvider, Tesseract
// today). The interface is the extension point: a future extractor (e.g.
// a different OCR engine, or an AI-based extractor) only needs to
// implement `extract()`; nothing else in the pipeline (normalizer.ts,
// importer.ts) changes.
import type { ContentSource } from "@prisma/client";
import { getOCRProvider } from "@/lib/ocr";
import { extractDocxText } from "./adapters/docx";
import { extractPdfText } from "./adapters/pdf";
import { resolveStoragePath } from "./storagePath";

export interface Extractor {
  extract(contentSource: ContentSource): Promise<{ rawText: string }>;
}

export const fileExtractor: Extractor = {
  async extract(contentSource) {
    const filePath = resolveStoragePath(contentSource.storagePath);
    switch (contentSource.fileType) {
      case "DOCX":
        return { rawText: await extractDocxText(filePath) };
      case "PDF":
        // See the FUTURE SEAM comment in adapters/pdf.ts — a scanned PDF
        // with no embedded text layer would need an OCR fallback wired in
        // here; not implemented yet.
        return { rawText: await extractPdfText(filePath) };
      case "IMAGE": {
        const result = await getOCRProvider().recognize({
          kind: "filePath",
          filePath,
        });
        return { rawText: result.text };
      }
    }
  },
};
