/**
 * Sub-project B — chunkByLength() must split long text into
 * roughly-budgeted pieces on paragraph boundaries, and chunkDocument()
 * must prefer chunkBySections() when it finds real section headers,
 * falling back to chunkByLength() otherwise.
 *
 * Run: npm run test:content-import-chunker
 */
import { chunkBySections, chunkByLength, chunkDocument } from "../lib/services/content-import/chunker.ts";

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}\n      expected: ${e}\n      actual  : ${a}`);
  }
}

// Build a document with 5 paragraphs, no PHẦN headers, long enough to force
// multiple chunks at a small budget.
const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraph ${i + 1}. `.repeat(50));
const longText = paragraphs.join("\n\n");

const smallBudgetChunks = chunkByLength(longText, 300);
check("splits into more than 1 chunk at a small budget", smallBudgetChunks.length > 1, true);
check(
  "no chunk exceeds budget by more than one paragraph's worth",
  smallBudgetChunks.every((c) => c.rawText.length <= 300 + paragraphs[0].length),
  true
);
check(
  "concatenating all chunks (trimmed) reconstructs the original paragraphs",
  smallBudgetChunks.map((c) => c.rawText.trim()).join("\n\n"),
  paragraphs.map((p) => p.trim()).join("\n\n")
);
check("batchIndex is 1-based and sequential", smallBudgetChunks.map((c) => c.batchIndex), smallBudgetChunks.map((_, i) => i + 1));

const wholeDocChunks = chunkByLength(longText, 1_000_000);
check("budget larger than document produces exactly 1 chunk", wholeDocChunks.length, 1);

// chunkDocument: prefers section-header chunking when present
const sectioned = "PHẦN 1 – ĐỀ TEST ĐẦU VÀO\nsome text\nPHẦN 2 – ĐỀ TEST GIỮA KỲ\nmore text";
check("chunkDocument uses chunkBySections when headers are present", chunkDocument(sectioned), chunkBySections(sectioned));

// chunkDocument: falls back to chunkByLength when no headers found
const noHeaders = "just plain text with no section markers at all, ".repeat(20);
check(
  "chunkDocument falls back to chunkByLength when no PHẦN headers found",
  chunkDocument(noHeaders).length >= 1 && chunkDocument(noHeaders)[0].label !== "Toàn bộ văn bản",
  true
);

console.log(`\n${"─".repeat(50)}`);
console.log(`  passed: ${passed}   failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
