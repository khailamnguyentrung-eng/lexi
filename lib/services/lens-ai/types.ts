// ─── Capture Layer ──────────────────────────────────────────────────────────

export type CaptureType =
  | "SCREENSHOT_REGION"    // Phase 7.2: OCR path via extractTextFromImage()
  | "IMAGE_UPLOAD"         // Phase 7.2: OCR path via extractTextFromImage()
  | "TEXT_SELECTION";      // Phase 7.1: direct text, no OCR

export interface RawImageData {
  base64: string;
  widthPx: number;
  heightPx: number;
}

export interface CaptureMetadata {
  capturedAt: string;      // ISO 8601
  sourceUrl?: string;
  userLocale?: string;     // e.g. "vi-VN"
  sourceApp?: string;      // "browser" | "mobile" | "desktop-app"
}

export interface CapturePayload {
  id: string;              // UUID — assigned by capture layer
  type: CaptureType;
  image?: RawImageData;    // image types only; absent for TEXT_SELECTION
  extractedText?: string;  // present for TEXT_SELECTION; absent for image types
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  metadata: CaptureMetadata;
}

// ─── Understanding Layer (Phase 7.2+) ──────────────────────────────────────

export type ContentType =
  | "MATH_PROBLEM"
  | "VOCABULARY_WORD"
  | "TEXT_PARAGRAPH"
  | "DIAGRAM"
  | "TABLE"
  | "CODE_SNIPPET"
  | "MULTIPLE_CHOICE"
  | "FILL_IN_BLANK"
  | "MIXED"
  | "UNKNOWN";

// ─── Context Layer ──────────────────────────────────────────────────────────

export type DepthHint = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type TopicFamiliarity =
  | "FIRST_ENCOUNTER"
  | "SEEN_BEFORE"
  | "PRACTICED"
  | "MASTERED"
  | "STRUGGLING";

export interface LensLearningContext {
  learnerId: string | "anonymous";
  depthHint: DepthHint;
  languagePreference: "vi" | "en" | "vi_en";
  topicFamiliarity?: TopicFamiliarity;
  // Phase 7.4 additions (not yet implemented):
  // knowledgeState?: import("@/lib/services/learner-intelligence/types").KnowledgeState;
  // performanceState?: import("@/lib/services/learner-intelligence/types").PerformanceState;
}

export const ANONYMOUS_CONTEXT: LensLearningContext = {
  learnerId: "anonymous",
  depthHint: "INTERMEDIATE",
  languagePreference: "vi_en",
};

// ─── AI Reasoning Layer ─────────────────────────────────────────────────────

export type InteractionMode =
  | "EXPLAIN"
  | "SOLVE"
  | "HINT"
  | "TRANSLATE"
  | "SUMMARIZE"
  | "PRACTICE";

// Only EXPLAIN is implemented in Phase 7.1.
export const IMPLEMENTED_MODES: InteractionMode[] = ["EXPLAIN"];

// ─── Assistance Layer (Phase 7.3) ────────────────────────────────────────────

export type ContentIntent =
  | "MATH_PROBLEM"
  | "VOCABULARY_WORD"
  | "CONCEPT_EXPLANATION"
  | "STUDY_TEXT"
  | "UNKNOWN";

export type AssistanceStyle =
  | "GUIDED_STEPS"        // math: numbered step-by-step walkthrough
  | "VOCABULARY_MEANING"  // single word/phrase: definition + examples
  | "CONCEPT_EXPLANATION" // paragraph concept: clear explanation with context
  | "SUMMARY"             // long study text: distilled key points
  | "GENERAL_HELP";       // fallback for unrecognised content

// ─────────────────────────────────────────────────────────────────────────────

export type LensFlag =
  | "OCR_CONFIDENCE_LOW"            // future: OCR confidence < 0.7
  | "CONTENT_TYPE_UNCERTAIN"        // future: classifier confidence < 0.6
  | "PRACTICE_NOT_PERSISTED"        // PRACTICE mode: question is ephemeral
  | "LANGUAGE_MISMATCH"             // future: detected lang ≠ preference
  | "ANONYMOUS_NO_PERSONALIZATION"  // context is anonymous; depth not personalized
  | "IMAGE_QUALITY_LOW"             // future: blurry or small image
  | "AI_PARSE_ERROR"                // AI response was not valid JSON
  | "MODE_NOT_IMPLEMENTED"          // requested mode not yet implemented
  | "EMPTY_CAPTURE_TEXT";           // capture text was blank

export interface LensStep {
  stepNumber: number;
  instruction: string;
  reasoning?: string;
}

export interface LensHint {
  level: 1 | 2 | 3;
  text: string;
}

export interface TranslationResult {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translated: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentences?: string[];
  commonCollocations?: string[];
}

export interface SummaryResult {
  keyPoints: string[];
  conceptCount: number;
}

export interface LensPracticeQuestion {
  promptText: string;
  options?: { label: "A" | "B" | "C" | "D"; text: string }[];
  correctOption?: "A" | "B" | "C" | "D";
  explanation: string;
  ephemeral: true;
}

export interface LensResponse {
  requestId: string;
  // Phase 7.1–7.2: set when the caller specified a mode.
  // Phase 7.3+: absent — the system selects assistanceStyle automatically.
  mode?: InteractionMode;
  assistanceStyle?: AssistanceStyle;
  // Payload — at most one populated per response
  explanation?: string;
  steps?: LensStep[];
  hints?: LensHint[];
  translation?: TranslationResult;
  summary?: SummaryResult;
  practiceQuestion?: LensPracticeQuestion;
  // Always present
  relatedTopics: string[];
  confidence: number;     // 0–1
  flags: LensFlag[];
}
