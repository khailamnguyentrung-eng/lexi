// Real OCR via tesseract.js, fully offline (no CDN fetch for either the
// WASM core — tesseract.js-core resolves locally via `require()` in Node —
// or the trained-data language files, bundled under lang-data/ and pointed
// at via `langPath`). This is the IMAGE branch's engine, called from
// extractor.ts through getOCRProvider() rather than imported directly, so
// a future second engine can be added without touching extractor.ts.
import { createWorker } from "tesseract.js";
import path from "node:path";
import type { OCRInput, OCRProvider } from "./types";

// Bundled standard (not _fast) vie + eng trained data — accuracy over repo
// size and OCR speed, per product decision (this is a low-volume, accuracy-
// sensitive education workflow, not a high-throughput OCR service).
const LANG_DATA_PATH = path.join(process.cwd(), "lib/ocr/lang-data");
const LANGS = "eng+vie";
const TIMEOUT_MS = 15_000;

type RaceResult = { status: "done"; text: string } | { status: "timeout" };

async function recognizeFilePath(filePath: string): Promise<{ text: string }> {
  const worker = await createWorker(LANGS, undefined, {
    langPath: LANG_DATA_PATH,
    // Bundled files are raw .traineddata, not the gzipped CDN default.
    gzip: false,
    // Never write a "cache" copy of the trained data back to disk — we
    // always read directly from the bundled lang-data/ files.
    cacheMethod: "readOnly",
    logger: () => {}, // per-progress callback; console logging happens once below, not per-tick
  });

  let timer: NodeJS.Timeout | undefined;
  let timedOut = false;

  const recognizePromise: Promise<RaceResult> = worker.recognize(filePath).then((result) => ({
    status: "done" as const,
    text: result.data.text,
  }));
  // Keep a handler on the original promise so a rejection arriving *after*
  // we've already terminated the worker on timeout doesn't surface as an
  // unhandled rejection — Promise.race below still independently observes
  // the same rejection while this is live, so real errors still propagate.
  recognizePromise.catch(() => {});

  const timeoutPromise = new Promise<RaceResult>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve({ status: "timeout" });
    }, TIMEOUT_MS);
  });

  try {
    const winner = await Promise.race([recognizePromise, timeoutPromise]);
    if (winner.status === "timeout") {
      await worker.terminate();
      throw new Error(`OCR timed out after ${TIMEOUT_MS}ms`);
    }
    return { text: winner.text };
  } finally {
    clearTimeout(timer);
    // Every path through recognize() terminates the worker exactly once —
    // the timeout branch above already did it, so skip the second call.
    if (!timedOut) {
      try {
        await worker.terminate();
      } catch (err) {
        console.warn(
          `[OCR] failed to terminate worker cleanly: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}

export const tesseractProvider: OCRProvider = {
  name: "tesseract",
  async recognize(input: OCRInput) {
    if (input.kind === "buffer") {
      // Not implemented yet — only the IMAGE-upload (file path) case is
      // wired up today. See the FUTURE SEAM comment in adapters/pdf.ts for
      // the intended future caller of this branch.
      throw new Error("OCRProvider.recognize() with kind=\"buffer\" is not implemented yet");
    }

    const start = Date.now();
    const { text } = await recognizeFilePath(input.filePath);
    const durationMs = Date.now() - start;
    const textLength = text.length;

    console.log(`[OCR] engine=tesseract durationMs=${durationMs} textLength=${textLength}`);

    return { text, engine: "tesseract", durationMs, textLength };
  },
};
