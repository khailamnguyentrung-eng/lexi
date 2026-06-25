import type { AssembledContext } from "@/lib/ai/contextAssembler";

export interface ModeHandler {
  mode: "TEACHER" | "ERROR_DETECTIVE" | "PRACTICE_GENERATOR" | "EXAM_COACH" | "MOTIVATION";
  isAvailable: boolean;
  buildSystemPrompt(ctx: AssembledContext): string;
}
