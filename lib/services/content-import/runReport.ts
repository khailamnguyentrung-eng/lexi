// Shared shape for "what happened during this AI normalization run" —
// returned by both the 5-question sample test and the full dry run, and
// rendered by the same AIStatusLine/report UI. Deliberately excludes any
// API key — only ever carries provider name/model/counts/timing.
export interface AIRunReport {
  aiStatus: {
    name: "claude" | "gemini" | "ollama" | "mock";
    model: string | null;
    requestedProvider: string | null;
    isFallback: boolean;
    fallbackReason: string | null;
  };
  chunksProcessed: number;
  inputSizeChars: number;
  outputQuestionCount: number;
  validCount: number;
  invalidCount: number;
  retryCount: number;
  processingTimeMs: number;
}
