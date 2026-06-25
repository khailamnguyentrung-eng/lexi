// Canonical shape for a candidate question produced anywhere in the
// content-import pipeline — by AIProvider.normalizeQuestions() (real or
// mock) before validation, by validator.ts after validation, and by
// importer.ts when persisting/approving. Single source of truth so the AI
// provider layer (lib/ai/providers/) and this feature layer agree on the
// exact fields without duplicating the interface.
export interface NormalizedQuestionDraft {
  questionCode: string;
  type: string;
  skill: string;
  difficulty: string;
  topic: string;
  promptText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanationVi: string;
  commonMistake: string | null;
  learningObjective: string | null;
  source: string;
  sourceExam: string | null;
}
