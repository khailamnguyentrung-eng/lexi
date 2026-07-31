// AI-assisted normalization: raw extracted document text -> validated
// candidate question drafts. NOT connected to the student chatbot in any
// way — this module is only ever called from the admin import pipeline
// (importer.ts). Uses the same AIProvider switch as chat (lib/ai/providers
// — Gemini/Claude/Mock, selected via AI_PROVIDER) so it automatically
// falls back to MockProvider's canned output when no real provider is
// configured, with no separate wiring needed here.
//
// This module NEVER creates a Question row — it only returns validated
// drafts. importer.ts persists them as ExtractedQuestionDraft with
// reviewStatus PENDING_REVIEW (valid) or REJECTED (invalid), and only a
// human approving a PENDING_REVIEW draft (importer.ts's approveDraft)
// creates a real Question.
import type { ContentSource } from "@prisma/client";
import { getAIProvider } from "@/lib/ai/providers";
import { validateDrafts, type ValidatedDraft } from "./validator";

export interface NormalizeWithAIResult {
  results: ValidatedDraft[];
  retryCount: number; // surfaced for run reports (Task 4) — see normalizationCore.ts
  servedBy: "claude" | "gemini" | "ollama" | "mock"; // who actually produced these drafts
  fallbackReason: string | null; // non-null when a real provider failed and mock took over
}

export async function normalizeWithAI(rawText: string, contentSource: ContentSource): Promise<NormalizeWithAIResult> {
  const provider = getAIProvider();
  const { drafts, retryCount, servedBy, fallbackReason } = await provider.normalizeQuestions({
    rawText,
    sourceFileName: contentSource.fileName,
  });
  const results = await validateDrafts(drafts);
  return { results, retryCount, servedBy, fallbackReason };
}
