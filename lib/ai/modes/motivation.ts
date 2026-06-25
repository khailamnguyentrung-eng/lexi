import type { ModeHandler } from "./types";

// Stub: will provide emotional/motivational support when the student is
// discouraged or losing momentum.
export const motivationMode: ModeHandler = {
  mode: "MOTIVATION",
  isAvailable: false,
  buildSystemPrompt() {
    return "Motivation Mode chưa được kích hoạt.";
  },
};
