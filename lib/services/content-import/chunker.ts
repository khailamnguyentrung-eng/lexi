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
