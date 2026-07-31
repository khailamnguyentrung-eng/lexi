// Canonical shape for a candidate question produced anywhere in the
// content-import pipeline — by AIProvider.normalizeQuestions() (real or
// mock) before validation, by validator.ts after validation, and by
// importer.ts when persisting/approving. Single source of truth so the AI
// provider layer (lib/ai/providers/) and this feature layer agree on the
// exact fields without duplicating the interface.
export interface NormalizedQuestionDraft {
  questionCode: string;
  skill: string;
  difficulty: string;
  topic: string;
  promptText: string;
  explanationVi: string;
  commonMistake: string | null;
  learningObjective: string | null;
  source: string;
  sourceExam: string | null;

  // ── Extraction path (content-import, sub-project B) ──────────────
  // Set by NORMALIZE_SYSTEM_PROMPT; read by validator.ts and
  // importer.ts::approveDraft(). Undefined on drafts from the generate
  // path (GENERATE_QUESTIONS_SYSTEM_PROMPT never sets these).
  responseFormat?: string;
  payload?: string; // JSON string, shape depends on responseFormat

  // ── Generation path (AI question generation, unchanged) ──────────
  // Set by GENERATE_QUESTIONS_SYSTEM_PROMPT; read by
  // content-generation/aiDraftGenerator.ts::toGeneratedDraft(). Undefined
  // on drafts from the extraction path (NORMALIZE_SYSTEM_PROMPT never
  // sets these after Task 3).
  type?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
}
