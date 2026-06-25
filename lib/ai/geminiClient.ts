import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

// process.env.GOOGLE_GEMINI_API_KEY can be "" (set but empty) in .env, not
// just undefined — both mean "not configured" for our purposes.
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
}

export function getGeminiClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
  }
  return client;
}

// Flash models have the most generous free tier — a deliberate choice
// given there's no budget for this project. Override with GEMINI_MODEL if
// a different model is ever needed.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
