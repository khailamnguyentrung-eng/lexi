// Real DOCX -> plain text extraction. Purely mechanical (no AI) — used as
// the DOCX branch of extractor.ts's file-type dispatch. Turning this raw
// text into structured question drafts is still normalizer.ts's job, and
// that step remains a mock until AI/NLP normalization is built.
import mammoth from "mammoth";

export async function extractDocxText(filePath: string): Promise<string> {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value;
}
