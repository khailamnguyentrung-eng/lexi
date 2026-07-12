import type { ContentIntent } from "../types";

// Math symbols that only appear in equations, not in text
const MATH_SYMBOL = /[×÷√∑∫∂±]|\d+\s*[-+*/^]\s*\d+|[a-z]\s*=\s*[\d(]/i;

// Math action keywords — only trigger when digits are also present
// to avoid "solve the crossword" being classified as math
const MATH_KEYWORD = /\b(?:solve|calculate|compute|simplify|evaluate)\b/i;

// Short phrases (≤ 4 words) without math patterns are vocabulary terms:
// "photosynthesis", "present perfect", "phrasal verbs", "run out of"
const VOCAB_MAX_WORDS = 4;

// Longer passages (≥ 100 words) are study text to be summarised
const STUDY_MIN_WORDS = 100;

function isMathProblem(text: string): boolean {
  // Symbol match is sufficient on its own
  if (MATH_SYMBOL.test(text)) return true;
  // Keyword match only counts when the text also contains digits
  return MATH_KEYWORD.test(text) && /\d/.test(text);
}

/**
 * Heuristic, deterministic, no I/O.
 * Returns the most likely ContentIntent for the extracted text.
 */
export function detectIntent(text: string): ContentIntent {
  const trimmed = text.trim();
  if (!trimmed) return "UNKNOWN";

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (isMathProblem(trimmed)) return "MATH_PROBLEM";
  if (wordCount <= VOCAB_MAX_WORDS) return "VOCABULARY_WORD";
  if (wordCount >= STUDY_MIN_WORDS) return "STUDY_TEXT";
  return "CONCEPT_EXPLANATION";
}
