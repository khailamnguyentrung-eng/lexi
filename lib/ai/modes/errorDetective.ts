import type { ModeHandler } from "./types";

// Stub: will analyze an uploaded question/screenshot for why an answer is
// right/wrong and the exam trap involved. Needs attachmentUrl handling
// (already on ChatMessage) and Claude vision input — not wired up yet.
export const errorDetectiveMode: ModeHandler = {
  mode: "ERROR_DETECTIVE",
  isAvailable: false,
  buildSystemPrompt() {
    return "Error Detective Mode chưa được kích hoạt.";
  },
};
