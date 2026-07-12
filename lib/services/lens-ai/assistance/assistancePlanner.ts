import type { ContentIntent, AssistanceStyle } from "../types";

export interface AssistancePlan {
  style: AssistanceStyle;
  systemPrompt: string;
  buildUserMessage: (text: string) => string;
}

const PLANS: Record<ContentIntent, AssistancePlan> = {
  MATH_PROBLEM: {
    style: "GUIDED_STEPS",
    systemPrompt:
      "You are a math tutor. Break the problem into clear numbered steps. Show reasoning at each step. Do not just state the answer.\n" +
      'Return JSON: {"steps":[{"stepNumber":1,"instruction":"...","reasoning":"..."}],"relatedTopics":[],"confidence":0.9}',
    buildUserMessage: (text) =>
      `Walk the student through this problem step by step:\n\n${text}`,
  },

  VOCABULARY_WORD: {
    style: "VOCABULARY_MEANING",
    systemPrompt:
      "You are a vocabulary tutor for English learners. Give part of speech, a clear definition, and 1–2 example sentences. Keep it concise.\n" +
      'Return JSON: {"explanation":"...","relatedTopics":[],"confidence":0.9}',
    buildUserMessage: (text) =>
      `Explain this vocabulary for a student:\n\n${text}`,
  },

  CONCEPT_EXPLANATION: {
    style: "CONCEPT_EXPLANATION",
    systemPrompt:
      "You are an educational assistant. Explain the concept clearly with a concrete example the student can relate to.\n" +
      'Return JSON: {"explanation":"...","relatedTopics":[],"confidence":0.9}',
    buildUserMessage: (text) =>
      `Explain this concept for a student:\n\n${text}`,
  },

  STUDY_TEXT: {
    style: "SUMMARY",
    systemPrompt:
      "You are a study assistant. Distil the text into 3–5 key points a student should remember. Be specific, not vague.\n" +
      'Return JSON: {"explanation":"...","relatedTopics":[],"confidence":0.9}',
    buildUserMessage: (text) =>
      `Summarise this study material into key points:\n\n${text}`,
  },

  UNKNOWN: {
    style: "GENERAL_HELP",
    systemPrompt:
      "You are a helpful learning assistant. Provide the most useful educational context you can for whatever the student has captured.\n" +
      'Return JSON: {"explanation":"...","relatedTopics":[],"confidence":0.7}',
    buildUserMessage: (text) =>
      `Help the student understand this:\n\n${text}`,
  },
};

/** Pure — no I/O. Maps a detected intent to a fully-formed assistance plan. */
export function planAssistance(intent: ContentIntent): AssistancePlan {
  return PLANS[intent];
}
