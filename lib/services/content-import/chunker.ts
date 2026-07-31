// Splits a raw extracted document into independently-normalizable chunks,
// so a single AI call never has to ingest (or return) all 118 questions
// of a large exam document at once. Detection looks for "PHẦN <n> – ĐỀ
// TEST..." section headers — the exact convention used by the real
// 118-question source (Bo_de_test_Tieng_Anh_9.docx), which has 3 such
// headers, one per exam part (36 / 37 / 45 questions — verified against
// the actual extracted text). Each chunk includes that part's question
// section AND its own answer-key section (they sit between one header and
// the next), which matters since explanationVi should be grounded in the
// source, not invented.
//
// Falls back to a single chunk covering the whole document if no such
// headers are found, so documents that don't follow this exact convention
// still normalize (just without the chunking benefit).
export interface DocumentChunk {
  batchIndex: number; // 1-based
  label: string; // the header line itself, e.g. "PHẦN 1 – ĐỀ TEST ĐẦU VÀO"
  rawText: string;
}

// Case-sensitive on purpose: the document's table of contents mentions
// "PHẦN 1 – Đề test đầu vào" (lowercase "test"), while the real section
// headers read "PHẦN 1 – ĐỀ TEST ĐẦU VÀO" (uppercase "TEST"). Matching only
// the uppercase form avoids splitting at the table-of-contents mentions.
const PART_HEADER = /^PHẦN\s*\d+\s*[–-]\s*ĐỀ TEST/;

export function chunkBySections(rawText: string): DocumentChunk[] {
  const lines = rawText.split("\n");
  const headerLineIndexes: number[] = [];
  lines.forEach((line, i) => {
    if (PART_HEADER.test(line.trim())) headerLineIndexes.push(i);
  });

  if (headerLineIndexes.length === 0) {
    return [{ batchIndex: 1, label: "Toàn bộ văn bản", rawText }];
  }

  return headerLineIndexes.map((startIdx, i) => {
    const endIdx = headerLineIndexes[i + 1] ?? lines.length;
    return {
      batchIndex: i + 1,
      label: lines[startIdx].trim(),
      rawText: lines.slice(startIdx, endIdx).join("\n"),
    };
  });
}

// Generic fallback for documents that don't follow the PHẦN-N-header
// convention chunkBySections() was built for (any IELTS/SAT/THPT source —
// none of them use that Vietnamese heading). Splits on paragraph
// boundaries (blank lines) so a question is never cut in half mid-text,
// packing paragraphs into a chunk until adding the next one would exceed
// targetChars, then starting a new chunk. A single paragraph longer than
// targetChars becomes its own oversized chunk rather than being cut mid-
// paragraph — normalizeLargeDocument.ts's oversizedChunkWarning already
// flags this case for visibility.
export function chunkByLength(rawText: string, targetChars: number): DocumentChunk[] {
  const paragraphs = rawText.split(/\n\n+/);
  const chunks: DocumentChunk[] = [];
  let current: string[] = [];
  let currentLength = 0;

  function flush() {
    if (current.length === 0) return;
    chunks.push({
      batchIndex: chunks.length + 1,
      label: `Đoạn ${chunks.length + 1}`,
      rawText: current.join("\n\n"),
    });
    current = [];
    currentLength = 0;
  }

  for (const para of paragraphs) {
    const paraLength = para.length + 2; // +2 for the \n\n separator this paragraph will need
    if (currentLength > 0 && currentLength + paraLength > targetChars) {
      flush();
    }
    current.push(para);
    currentLength += paraLength;
  }
  flush();

  return chunks.length > 0 ? chunks : [{ batchIndex: 1, label: "Toàn bộ văn bản", rawText }];
}

// Soft budget for chunkByLength's fallback path — matches
// normalizeLargeDocument.ts's SOFT_CHUNK_SIZE_WARNING_CHARS order of
// magnitude (~10K tokens) so a normal-sized chunk doesn't also trip that
// warning immediately after being created here.
const DEFAULT_LENGTH_CHUNK_BUDGET_CHARS = 30_000;

// The single entry point normalizeLargeDocument.ts calls. Tries the
// section-header convention first (exact match for
// Bo_de_test_Tieng_Anh_9.docx and any future document following the same
// convention — unchanged behavior for that file); falls back to
// length-based chunking for everything else (IELTS/SAT/THPT sources),
// instead of chunkBySections()'s own fallback of "1 chunk = whole
// document".
export function chunkDocument(rawText: string): DocumentChunk[] {
  const sectioned = chunkBySections(rawText);
  const foundRealSections = sectioned.length > 1 || (sectioned.length === 1 && sectioned[0].label !== "Toàn bộ văn bản");
  if (foundRealSections) return sectioned;
  return chunkByLength(rawText, DEFAULT_LENGTH_CHUNK_BUDGET_CHARS);
}
