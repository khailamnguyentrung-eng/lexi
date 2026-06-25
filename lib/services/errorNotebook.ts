// Spaced-repetition stub: fixed Day 1/3/7/14/30 offsets. reviewStage indexes
// into this array. A future SM-2 scheduler replaces only this function's
// body — reviewStage/nextReviewAt/easeFactor columns are already in place.
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export function nextReviewDate(fromStage: number, from: Date = new Date()) {
  const days = REVIEW_INTERVALS_DAYS[Math.min(fromStage, REVIEW_INTERVALS_DAYS.length - 1)];
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function isFinalStage(stage: number) {
  return stage >= REVIEW_INTERVALS_DAYS.length - 1;
}
