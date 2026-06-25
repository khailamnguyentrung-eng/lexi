import type { ModeHandler } from "./types";

// Stub: will generate targeted practice questions from a student's current
// weaknesses. Will read SkillMatrixEntry + ErrorNotebookEntry.concept once built.
export const practiceGeneratorMode: ModeHandler = {
  mode: "PRACTICE_GENERATOR",
  isAvailable: false,
  buildSystemPrompt() {
    return "Practice Generator Mode chưa được kích hoạt.";
  },
};
