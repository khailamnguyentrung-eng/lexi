/**
 * Sub-project C — classifySourceFile() must correctly route every file
 * extension to skip/pending, and apply the 50-character text-layer
 * threshold only to PDFs.
 *
 * Run: npm run test:classify-source-file
 */
import { classifySourceFile } from "./lib/classifySourceFile.mjs";

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

check(
  "audio file is skipped as audio_video",
  classifySourceFile({ relativePath: "a/b/Track 01.mp3", extractedTextLength: null }),
  { status: "skipped", reason: "audio_video" }
);
check(
  "video file is skipped as audio_video",
  classifySourceFile({ relativePath: "a/b/lecture.mp4", extractedTextLength: null }),
  { status: "skipped", reason: "audio_video" }
);
check(
  "wma audio is skipped as audio_video",
  classifySourceFile({ relativePath: "a/b/track.wma", extractedTextLength: null }),
  { status: "skipped", reason: "audio_video" }
);
check(
  "image file is skipped as image",
  classifySourceFile({ relativePath: "a/b/scan.jpg", extractedTextLength: null }),
  { status: "skipped", reason: "image" }
);
check(
  "png image is skipped as image",
  classifySourceFile({ relativePath: "a/b/photo.png", extractedTextLength: null }),
  { status: "skipped", reason: "image" }
);
check(
  "spreadsheet is skipped as spreadsheet",
  classifySourceFile({ relativePath: "a/b/Master_Data.xlsx", extractedTextLength: null }),
  { status: "skipped", reason: "spreadsheet" }
);
check(
  "unrecognized extension is skipped as other",
  classifySourceFile({ relativePath: "a/b/notes.txt", extractedTextLength: null }),
  { status: "skipped", reason: "other" }
);
check(
  "docx is always pending regardless of extractedTextLength",
  classifySourceFile({ relativePath: "a/b/Sample.docx", extractedTextLength: null }),
  { status: "pending", reason: null }
);
check(
  "doc is always pending",
  classifySourceFile({ relativePath: "a/b/Old.doc", extractedTextLength: null }),
  { status: "pending", reason: null }
);
check(
  "pdf with 0 extracted characters is skipped as no_text_layer",
  classifySourceFile({ relativePath: "a/b/Scanned.pdf", extractedTextLength: 0 }),
  { status: "skipped", reason: "no_text_layer" }
);
check(
  "pdf with 49 extracted characters is skipped as no_text_layer (just under threshold)",
  classifySourceFile({ relativePath: "a/b/Borderline.pdf", extractedTextLength: 49 }),
  { status: "skipped", reason: "no_text_layer" }
);
check(
  "pdf with exactly 50 extracted characters is pending (threshold boundary)",
  classifySourceFile({ relativePath: "a/b/Borderline2.pdf", extractedTextLength: 50 }),
  { status: "pending", reason: null }
);
check(
  "pdf with real content length is pending",
  classifySourceFile({ relativePath: "a/b/Real.pdf", extractedTextLength: 8992 }),
  { status: "pending", reason: null }
);
check(
  "extension matching is case-insensitive",
  classifySourceFile({ relativePath: "a/b/UPPER.PDF", extractedTextLength: 100 }),
  { status: "pending", reason: null }
);

console.log(`\n${"─".repeat(50)}`);
console.log(`  passed: ${passed}   failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
