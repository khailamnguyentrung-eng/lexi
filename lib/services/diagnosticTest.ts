// Simple rule-based level estimate from the three skill scores (0-10 scale,
// matching the test-bank scoring already used in seed-data/questions.json).
// Replace with a real CEFR-mapping rubric later if needed — kept obvious
// and easy to tweak rather than over-engineered.
export function estimateLevel(grammarScore: number, vocabularyScore: number, readingScore: number): string {
  const average = (grammarScore + vocabularyScore + readingScore) / 3;
  if (average >= 8.5) return "B1+";
  if (average >= 7) return "B1";
  if (average >= 5.5) return "A2+";
  if (average >= 4) return "A2";
  return "A1";
}
