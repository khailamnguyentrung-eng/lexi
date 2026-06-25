import type { ModeHandler } from "./types";
import { teacherMode } from "./teacher";
import { errorDetectiveMode } from "./errorDetective";
import { practiceGeneratorMode } from "./practiceGenerator";
import { examCoachMode } from "./examCoach";
import { motivationMode } from "./motivation";

export const modeRegistry: Record<ModeHandler["mode"], ModeHandler> = {
  TEACHER: teacherMode,
  ERROR_DETECTIVE: errorDetectiveMode,
  PRACTICE_GENERATOR: practiceGeneratorMode,
  EXAM_COACH: examCoachMode,
  MOTIVATION: motivationMode,
};
