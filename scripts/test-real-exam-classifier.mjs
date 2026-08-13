// Manual test — this repo has no Jest/Vitest; tests are plain Node scripts
// that import the pure function and assert with a small helper, run via
// `npm run test:real-exam-classifier`. See scripts/test-passage-backfill.mjs
// for the established pattern.
import { classifySourceExam } from "../lib/services/mocktest/realExamClassifier.ts";

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

console.log("classifySourceExam");

check(
  "THPT exam gets 50 minutes",
  classifySourceExam("Đề thi thử chuẩn cấu trúc kỳ thi tốt nghiệp THPT 2025 (Đề 1) — Fanpage Luyện Thi THPT Quốc Gia", 40),
  { skip: false, timeLimitMin: 50 },
);

check(
  "IELTS exam gets 60 minutes",
  classifySourceExam("IELTS VOL 7 — Reading Test 5", 40),
  { skip: false, timeLimitMin: 60 },
);

check(
  "SAT exam gets 64 minutes",
  classifySourceExam("Digital SAT Practice Test 14 (B_SAT_Verbal) — Reading & Writing, Module 1 + Module 2", 50),
  { skip: false, timeLimitMin: 64 },
);

check(
  "unrecognised exam type falls back to count * 1.5, rounded",
  classifySourceExam("Some Other Exam Series — Paper 3", 44),
  { skip: false, timeLimitMin: 66 },
);

check(
  "title containing 'Course' is skipped as a workbook, not a single-sitting paper",
  classifySourceExam("PrepPros SAT Writing Course", 166),
  { skip: true, reason: "looks like a chapter workbook, not a single-sitting exam (title contains \"Course\")" },
);

check(
  "'Course' match is case-insensitive",
  classifySourceExam("Some course bundle", 50),
  { skip: true, reason: "looks like a chapter workbook, not a single-sitting exam (title contains \"Course\")" },
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
