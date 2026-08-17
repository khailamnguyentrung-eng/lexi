// Decides, per sourceExam group, whether it's a real single-sitting exam
// paper (vs. a chapter-organized workbook like "PrepPros SAT Writing
// Course" — CH6_01, CH6_02, ... isn't one sitting) and what time limit it
// should get. Pure and synchronous so it's unit-testable without a DB —
// see scripts/test-real-exam-classifier.mjs.
//
// The "Course" substring check is a heuristic based on the one concrete
// workbook-shaped source found in the bank at design time (2026-08-13),
// not a guarantee every workbook will be named this way. If a future
// batch introduces another non-exam sourceExam that slips through, extend
// this function — don't special-case it in the caller.

export type ClassifyResult =
  | { skip: true; reason: string }
  | { skip: false; timeLimitMin: number };

export function classifySourceExam(sourceExam: string, count: number): ClassifyResult {
  if (/course/i.test(sourceExam)) {
    return {
      skip: true,
      reason: 'looks like a chapter workbook, not a single-sitting exam (title contains "Course")',
    };
  }

  if (/thpt/i.test(sourceExam)) return { skip: false, timeLimitMin: 50 };
  if (/ielts/i.test(sourceExam)) return { skip: false, timeLimitMin: 60 };
  if (/sat/i.test(sourceExam)) return { skip: false, timeLimitMin: 64 };

  return { skip: false, timeLimitMin: Math.round(count * 1.5) };
}
