import type { ModeHandler } from "./types";

// Stub: will teach time management, exam strategy, and question-solving
// methods for the timed entrance exam format.
export const examCoachMode: ModeHandler = {
  mode: "EXAM_COACH",
  isAvailable: false,
  buildSystemPrompt() {
    return "Exam Coach Mode chưa được kích hoạt.";
  },
};
