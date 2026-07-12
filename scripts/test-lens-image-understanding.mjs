/**
 * test-lens-image-understanding.mjs
 *
 * Phase 7.2 — Image Understanding Foundation
 * All functions inlined in JavaScript. No TypeScript compilation. No DB.
 * Uses top-level await (ES module, Node 14.8+).
 *
 * Sections:
 *   1.  createImageCapture — shape
 *   2.  createImageCapture — validation errors
 *   3.  MockOcrProvider — text extraction from valid image
 *   4.  MockOcrProvider — null extraction for empty base64
 *   5.  extractTextFromImage — happy path (confidence ≥ 0.7)
 *   6.  extractTextFromImage — OCR_CONFIDENCE_LOW flag
 *   7.  extractTextFromImage — empty/null OCR result
 *   8.  Orchestrator routing — image/text/mode dispatch
 *   9.  Pipeline reuse — image payload produces valid LensResponse shape
 *
 * Run: node scripts/test-lens-image-understanding.mjs
 */

import { randomUUID } from "crypto";

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function assertThrowsAsync(name, fn, expectedSubstring = "") {
  try {
    await fn();
    console.error(`  ✗ ${name} — expected throw but did not throw`);
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (expectedSubstring && !msg.includes(expectedSubstring)) {
      console.error(`  ✗ ${name} — threw "${msg}", expected "${expectedSubstring}"`);
      failed++;
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  }
}

function assertThrows(name, fn, expectedSubstring = "") {
  try {
    fn();
    console.error(`  ✗ ${name} — expected throw but did not throw`);
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (expectedSubstring && !msg.includes(expectedSubstring)) {
      console.error(`  ✗ ${name} — threw "${msg}", expected "${expectedSubstring}"`);
      failed++;
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  }
}

// ─── Inlined: capture.ts ─────────────────────────────────────────────────────

class CaptureValidationError extends Error {
  constructor(message) { super(message); this.name = "CaptureValidationError"; }
}

function createImageCapture(type, image, mimeType, metadata = {}) {
  if (!image.base64 || image.base64.trim().length === 0)
    throw new CaptureValidationError("Image capture must have non-empty base64 data");
  if (image.widthPx <= 0 || image.heightPx <= 0)
    throw new CaptureValidationError("Image capture dimensions must be positive (widthPx > 0, heightPx > 0)");
  return {
    id: randomUUID(), type, image, mimeType,
    metadata: { capturedAt: new Date().toISOString(), sourceApp: "browser", ...metadata },
  };
}

const IMAGE_CAPTURE_TYPES = ["SCREENSHOT_REGION", "IMAGE_UPLOAD"];

function validateCapturePayload(payload) {
  if (!payload.id) throw new CaptureValidationError("CapturePayload.id is required");
  if (!payload.type) throw new CaptureValidationError("CapturePayload.type is required");
  if (!payload.metadata?.capturedAt)
    throw new CaptureValidationError("CapturePayload.metadata.capturedAt is required");
  if (payload.type === "TEXT_SELECTION") {
    if (!payload.extractedText || payload.extractedText.trim().length === 0)
      throw new CaptureValidationError("TEXT_SELECTION payload must have non-empty extractedText");
    return;
  }
  if (IMAGE_CAPTURE_TYPES.includes(payload.type) && !payload.image)
    throw new CaptureValidationError(`${payload.type} payload must include image data`);
}

// ─── Inlined: understanding/ocr.ts ───────────────────────────────────────────

class MockOcrProvider {
  constructor() { this.name = "mock-ocr"; }
  async extractText(image) {
    if (!image.base64 || image.base64.trim().length === 0)
      return { extractedText: null, confidence: null };
    return { extractedText: `[mock-ocr: ${image.widthPx}×${image.heightPx} image]`, confidence: 0.9 };
  }
}

// ─── Inlined: understanding/imageProcessor.ts ────────────────────────────────

class OcrExtractionError extends Error {
  constructor(message) { super(message); this.name = "OcrExtractionError"; }
}

const OCR_CONFIDENCE_THRESHOLD = 0.7;

async function extractTextFromImage(payload, provider = new MockOcrProvider()) {
  if (!payload.image)
    throw new OcrExtractionError(`${payload.type} payload must include image data for OCR`);
  const result = await provider.extractText(payload.image, payload.mimeType);
  const flags = [];
  if (result.confidence !== null && result.confidence < OCR_CONFIDENCE_THRESHOLD)
    flags.push("OCR_CONFIDENCE_LOW");
  const text = result.extractedText?.trim() ?? "";
  return { text, flags };
}

// ─── Inlined: lensAssistant.ts (routing only — no real AI called) ─────────────

const IMPLEMENTED_MODES = ["EXPLAIN"];
async function simulateRouting(payload, mode, ocrProvider) {
  validateCapturePayload(payload);
  if (!IMPLEMENTED_MODES.includes(mode))
    return { branch: "mode-flag", flags: ["MODE_NOT_IMPLEMENTED"] };
  if (payload.type === "TEXT_SELECTION") {
    const text = payload.extractedText ?? "";
    if (!text.trim()) return { branch: "empty", flags: ["EMPTY_CAPTURE_TEXT"] };
    return { branch: "text", text };
  }
  // IMAGE_UPLOAD or SCREENSHOT_REGION — OCR path
  const ocrResult = await extractTextFromImage(payload, ocrProvider);
  if (!ocrResult.text.trim())
    return { branch: "empty", flags: ["EMPTY_CAPTURE_TEXT", ...ocrResult.flags] };
  return { branch: "image-ocr", text: ocrResult.text, ocrFlags: ocrResult.flags };
}

// ─── Inlined: promptBuilder.ts (parseLensExplainResponse + mergeOcrFlags) ────

function stripCodeFence(raw) {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

function parseLensExplainResponse(rawText, requestId, mode) {
  const flags = ["ANONYMOUS_NO_PERSONALIZATION"];
  try {
    const parsed = JSON.parse(stripCodeFence(rawText));
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : rawText.trim();
    const relatedTopics = Array.isArray(parsed.relatedTopics)
      ? parsed.relatedTopics.filter((t) => typeof t === "string") : [];
    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7;
    return { requestId, mode, explanation, relatedTopics, confidence, flags };
  } catch {
    flags.push("AI_PARSE_ERROR");
    return { requestId, mode, explanation: rawText.trim(), relatedTopics: [], confidence: 0.5, flags };
  }
}

function mergeOcrFlags(response, ocrFlags) {
  if (ocrFlags.length === 0) return response;
  return { ...response, flags: [...ocrFlags, ...response.flags] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ── Section 1: createImageCapture — shape ─────────────────────────────────────

console.log("\n1. createImageCapture — shape");

{
  const image = { base64: "abc123", widthPx: 800, heightPx: 600 };
  const p = createImageCapture("IMAGE_UPLOAD", image, "image/png");
  assert("returns an object", typeof p === "object" && p !== null);
  assert("id is non-empty string", typeof p.id === "string" && p.id.length > 0);
  assert("type is IMAGE_UPLOAD", p.type === "IMAGE_UPLOAD");
  assert("image is stored by reference", p.image === image);
  assert("mimeType is stored", p.mimeType === "image/png");
  assert("extractedText is absent", p.extractedText === undefined);
  assert("metadata.capturedAt is ISO string", typeof p.metadata.capturedAt === "string" && p.metadata.capturedAt.includes("T"));
  assert("metadata.sourceApp defaults to browser", p.metadata.sourceApp === "browser");
}
{
  const p = createImageCapture("SCREENSHOT_REGION", { base64: "xyz", widthPx: 1920, heightPx: 1080 });
  assert("SCREENSHOT_REGION type stored", p.type === "SCREENSHOT_REGION");
  assert("mimeType is undefined when not passed", p.mimeType === undefined);
}
{
  const p1 = createImageCapture("IMAGE_UPLOAD", { base64: "x", widthPx: 100, heightPx: 100 });
  const p2 = createImageCapture("IMAGE_UPLOAD", { base64: "x", widthPx: 100, heightPx: 100 });
  assert("each capture gets a unique id", p1.id !== p2.id);
}
{
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "abc", widthPx: 400, heightPx: 300 }, undefined,
    { sourceUrl: "https://example.com", userLocale: "vi-VN" });
  assert("accepts sourceUrl override", p.metadata.sourceUrl === "https://example.com");
  assert("accepts userLocale override", p.metadata.userLocale === "vi-VN");
  assert("capturedAt still set with overrides", typeof p.metadata.capturedAt === "string");
}

// ── Section 2: createImageCapture — validation errors ─────────────────────────

console.log("\n2. createImageCapture — validation errors");

assertThrows("throws on empty base64",
  () => createImageCapture("IMAGE_UPLOAD", { base64: "", widthPx: 100, heightPx: 100 }), "non-empty base64");
assertThrows("throws on whitespace-only base64",
  () => createImageCapture("IMAGE_UPLOAD", { base64: "   ", widthPx: 100, heightPx: 100 }), "non-empty base64");
assertThrows("throws on widthPx = 0",
  () => createImageCapture("IMAGE_UPLOAD", { base64: "abc", widthPx: 0, heightPx: 100 }), "positive");
assertThrows("throws on heightPx = 0",
  () => createImageCapture("IMAGE_UPLOAD", { base64: "abc", widthPx: 100, heightPx: 0 }), "positive");
assertThrows("throws on negative widthPx",
  () => createImageCapture("IMAGE_UPLOAD", { base64: "abc", widthPx: -1, heightPx: 100 }), "positive");
assertThrows("throws on negative heightPx",
  () => createImageCapture("SCREENSHOT_REGION", { base64: "abc", widthPx: 100, heightPx: -5 }), "positive");
{
  let err;
  try { createImageCapture("IMAGE_UPLOAD", { base64: "", widthPx: 100, heightPx: 100 }); } catch(e) { err = e; }
  assert("error is CaptureValidationError", err instanceof CaptureValidationError);
  assert("error.name is CaptureValidationError", err.name === "CaptureValidationError");
}

// ── Section 3: MockOcrProvider — valid image ──────────────────────────────────

console.log("\n3. MockOcrProvider — text extraction from valid image");

{
  const p = new MockOcrProvider();
  const r = await p.extractText({ base64: "abc123", widthPx: 800, heightPx: 600 });
  assert("extractedText is a non-empty string", typeof r.extractedText === "string" && r.extractedText.length > 0);
  assert("confidence is a number", typeof r.confidence === "number");
  assert("confidence is 0.9 for valid image", r.confidence === 0.9);
  assert("confidence in [0, 1]", r.confidence >= 0 && r.confidence <= 1);
  assert("extractedText mentions width", r.extractedText.includes("800"));
  assert("extractedText mentions height", r.extractedText.includes("600"));
}
{
  const p = new MockOcrProvider();
  const r1 = await p.extractText({ base64: "x", widthPx: 1920, heightPx: 1080 });
  const r2 = await p.extractText({ base64: "x", widthPx: 1920, heightPx: 1080 });
  assert("MockOcrProvider is deterministic", r1.extractedText === r2.extractedText && r1.confidence === r2.confidence);
}
{
  const p = new MockOcrProvider();
  const r = await p.extractText({ base64: "abc", widthPx: 100, heightPx: 100 }, "image/png");
  assert("accepts mimeType parameter without error", typeof r.extractedText === "string");
}

// ── Section 4: MockOcrProvider — empty base64 ─────────────────────────────────

console.log("\n4. MockOcrProvider — null extraction for empty base64");

{
  const p = new MockOcrProvider();
  const r1 = await p.extractText({ base64: "", widthPx: 100, heightPx: 100 });
  assert("empty base64 → extractedText is null", r1.extractedText === null);
  assert("empty base64 → confidence is null", r1.confidence === null);
  const r2 = await p.extractText({ base64: "   ", widthPx: 100, heightPx: 100 });
  assert("whitespace base64 → extractedText is null", r2.extractedText === null);
  assert("whitespace base64 → confidence is null", r2.confidence === null);
}
{
  const p = new MockOcrProvider();
  const valid = await p.extractText({ base64: "data", widthPx: 50, heightPx: 50 });
  assert("valid result has extractedText field", "extractedText" in valid);
  assert("valid result has confidence field", "confidence" in valid);
  const empty = await p.extractText({ base64: "", widthPx: 50, heightPx: 50 });
  assert("empty result extractedText is null", empty.extractedText === null);
  assert("empty result confidence is null", empty.confidence === null);
}

// ── Section 5: extractTextFromImage — happy path ──────────────────────────────

console.log("\n5. extractTextFromImage — happy path (confidence ≥ 0.7)");

{
  const payload = createImageCapture("IMAGE_UPLOAD", { base64: "testdata", widthPx: 1280, heightPx: 720 });
  const r = await extractTextFromImage(payload);
  assert("returns object with text and flags", typeof r.text === "string" && Array.isArray(r.flags));
  assert("text is non-empty for valid mock image", r.text.length > 0);
  assert("no OCR_CONFIDENCE_LOW at confidence 0.9", !r.flags.includes("OCR_CONFIDENCE_LOW"));
  assert("flags is empty at confidence 0.9", r.flags.length === 0);
}
{
  const borderlineProvider = { name: "b", async extractText() { return { extractedText: "some text", confidence: 0.7 }; } };
  const payload = createImageCapture("SCREENSHOT_REGION", { base64: "data", widthPx: 100, heightPx: 100 });
  const r = await extractTextFromImage(payload, borderlineProvider);
  assert("confidence exactly 0.7 does NOT set OCR_CONFIDENCE_LOW (threshold is strict <)", !r.flags.includes("OCR_CONFIDENCE_LOW"));
  assert("text is extracted at exactly 0.7 confidence", r.text === "some text");
}
{
  const payload = createImageCapture("SCREENSHOT_REGION", { base64: "data", widthPx: 2560, heightPx: 1440 });
  const r = await extractTextFromImage(payload);
  assert("SCREENSHOT_REGION works with extractTextFromImage", typeof r.text === "string");
}

// ── Section 6: extractTextFromImage — OCR_CONFIDENCE_LOW ─────────────────────

console.log("\n6. extractTextFromImage — OCR_CONFIDENCE_LOW flag");

{
  const lowP = { name: "lc", async extractText() { return { extractedText: "blurry text", confidence: 0.5 }; } };
  const payload = createImageCapture("IMAGE_UPLOAD", { base64: "blurry", widthPx: 200, heightPx: 200 });
  const r = await extractTextFromImage(payload, lowP);
  assert("OCR_CONFIDENCE_LOW set when confidence = 0.5", r.flags.includes("OCR_CONFIDENCE_LOW"));
  assert("text still extracted at low confidence", r.text === "blurry text");
  assert("only OCR_CONFIDENCE_LOW flag set", r.flags.length === 1);
}
{
  const p069 = { name: "p", async extractText() { return { extractedText: "ok", confidence: 0.69 }; } };
  const payload = createImageCapture("IMAGE_UPLOAD", { base64: "d", widthPx: 50, heightPx: 50 });
  assert("confidence 0.69 sets OCR_CONFIDENCE_LOW",
    (await extractTextFromImage(payload, p069)).flags.includes("OCR_CONFIDENCE_LOW"));
}
{
  const p01 = { name: "p", async extractText() { return { extractedText: "ok", confidence: 0.1 }; } };
  const payload = createImageCapture("IMAGE_UPLOAD", { base64: "d", widthPx: 50, heightPx: 50 });
  assert("confidence 0.1 sets OCR_CONFIDENCE_LOW",
    (await extractTextFromImage(payload, p01)).flags.includes("OCR_CONFIDENCE_LOW"));
}

// ── Section 7: extractTextFromImage — empty/null OCR ─────────────────────────

console.log("\n7. extractTextFromImage — empty text when OCR returns null");

{
  const nullP = { name: "n", async extractText() { return { extractedText: null, confidence: null }; } };
  const payload = createImageCapture("IMAGE_UPLOAD", { base64: "blank", widthPx: 100, heightPx: 100 });
  const r = await extractTextFromImage(payload, nullP);
  assert("text is empty string when OCR returns null", r.text === "");
  assert("no OCR_CONFIDENCE_LOW when confidence is null", !r.flags.includes("OCR_CONFIDENCE_LOW"));
  assert("flags is empty array when confidence is null", r.flags.length === 0);
}
{
  const wsP = { name: "w", async extractText() { return { extractedText: "   ", confidence: 0.8 }; } };
  const payload = createImageCapture("IMAGE_UPLOAD", { base64: "data", widthPx: 100, heightPx: 100 });
  const r = await extractTextFromImage(payload, wsP);
  assert("whitespace OCR text trimmed to empty string", r.text === "");
  assert("no OCR_CONFIDENCE_LOW for whitespace text at confidence 0.8", !r.flags.includes("OCR_CONFIDENCE_LOW"));
}
{
  const payloadNoImage = { id: randomUUID(), type: "IMAGE_UPLOAD", metadata: { capturedAt: new Date().toISOString() } };
  let threw = false; let errorName = "";
  try { await extractTextFromImage(payloadNoImage); } catch(e) { threw = true; errorName = e.name; }
  assert("throws when payload.image is absent", threw);
  assert("throws OcrExtractionError", errorName === "OcrExtractionError");
}

// ── Section 8: Orchestrator routing ──────────────────────────────────────────

console.log("\n8. Orchestrator routing — image/text/mode dispatch");

{
  const p = { id: randomUUID(), type: "TEXT_SELECTION", extractedText: "present perfect", metadata: { capturedAt: new Date().toISOString() } };
  const r = await simulateRouting(p, "EXPLAIN");
  assert("TEXT_SELECTION → text branch", r.branch === "text");
  assert("TEXT_SELECTION text preserved", r.text === "present perfect");
}
{
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "imagedata", widthPx: 640, heightPx: 480 });
  const r = await simulateRouting(p, "EXPLAIN");
  assert("IMAGE_UPLOAD → image-ocr branch", r.branch === "image-ocr");
  assert("image-ocr branch has extracted text", typeof r.text === "string" && r.text.length > 0);
  assert("image-ocr branch has ocrFlags array", Array.isArray(r.ocrFlags));
}
{
  const p = createImageCapture("SCREENSHOT_REGION", { base64: "ss", widthPx: 1920, heightPx: 1080 });
  const r = await simulateRouting(p, "EXPLAIN");
  assert("SCREENSHOT_REGION → image-ocr branch", r.branch === "image-ocr");
}
{
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "x", widthPx: 100, heightPx: 100 });
  const r = await simulateRouting(p, "SOLVE");
  assert("SOLVE + IMAGE_UPLOAD → mode-flag branch (no OCR)", r.branch === "mode-flag");
  assert("SOLVE sets MODE_NOT_IMPLEMENTED", r.flags.includes("MODE_NOT_IMPLEMENTED"));
}
{
  const p = { id: randomUUID(), type: "TEXT_SELECTION", extractedText: "text", metadata: { capturedAt: new Date().toISOString() } };
  const r = await simulateRouting(p, "TRANSLATE");
  assert("TRANSLATE + TEXT_SELECTION → mode-flag branch", r.branch === "mode-flag");
}
{
  const emptyP = { name: "e", async extractText() { return { extractedText: null, confidence: null }; } };
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "blank", widthPx: 100, heightPx: 100 });
  const r = await simulateRouting(p, "EXPLAIN", emptyP);
  assert("empty OCR → empty branch", r.branch === "empty");
  assert("empty branch has EMPTY_CAPTURE_TEXT", r.flags.includes("EMPTY_CAPTURE_TEXT"));
}
{
  const lowP = { name: "l", async extractText() { return { extractedText: "blurry", confidence: 0.3 }; } };
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "b", widthPx: 100, heightPx: 100 });
  const r = await simulateRouting(p, "EXPLAIN", lowP);
  assert("low-confidence OCR with text → image-ocr branch", r.branch === "image-ocr");
  assert("OCR_CONFIDENCE_LOW in ocrFlags", r.ocrFlags.includes("OCR_CONFIDENCE_LOW"));
}

// ── Section 9: Pipeline reuse — LensResponse shape ────────────────────────────

console.log("\n9. Pipeline reuse — image payload produces valid LensResponse shape");

{
  const imgP = createImageCapture("IMAGE_UPLOAD", { base64: "data", widthPx: 800, heightPx: 600 });
  const { text, flags: ocrFlags } = await extractTextFromImage(imgP);
  const aiRaw = JSON.stringify({ explanation: "Image explanation.", relatedTopics: ["past_simple"], confidence: 0.85 });
  const resp = mergeOcrFlags(parseLensExplainResponse(aiRaw, imgP.id, "EXPLAIN"), ocrFlags);

  assert("requestId matches imagePayload.id", resp.requestId === imgP.id);
  assert("mode is EXPLAIN", resp.mode === "EXPLAIN");
  assert("explanation is non-empty string", typeof resp.explanation === "string" && resp.explanation.length > 0);
  assert("relatedTopics is an array", Array.isArray(resp.relatedTopics));
  assert("confidence is number in [0, 1]", typeof resp.confidence === "number" && resp.confidence >= 0 && resp.confidence <= 1);
  assert("flags is an array", Array.isArray(resp.flags));
  assert("ANONYMOUS_NO_PERSONALIZATION flag present", resp.flags.includes("ANONYMOUS_NO_PERSONALIZATION"));
  assert("no AI_PARSE_ERROR for valid JSON", !resp.flags.includes("AI_PARSE_ERROR"));
  assert("no OCR_CONFIDENCE_LOW (mock OCR confidence 0.9)", !resp.flags.includes("OCR_CONFIDENCE_LOW"));
}
{
  const imgP = createImageCapture("IMAGE_UPLOAD", { base64: "blurry", widthPx: 100, heightPx: 100 });
  const lowP = { name: "l", async extractText() { return { extractedText: "blurry text", confidence: 0.4 }; } };
  const { text, flags: ocrFlags } = await extractTextFromImage(imgP, lowP);
  const aiRaw = JSON.stringify({ explanation: "Low-conf explanation.", relatedTopics: [], confidence: 0.6 });
  const resp = mergeOcrFlags(parseLensExplainResponse(aiRaw, imgP.id, "EXPLAIN"), ocrFlags);

  assert("OCR_CONFIDENCE_LOW in merged response", resp.flags.includes("OCR_CONFIDENCE_LOW"));
  assert("ANONYMOUS_NO_PERSONALIZATION also in merged response", resp.flags.includes("ANONYMOUS_NO_PERSONALIZATION"));
  assert("OCR flag BEFORE AI flag in flags array",
    resp.flags.indexOf("OCR_CONFIDENCE_LOW") < resp.flags.indexOf("ANONYMOUS_NO_PERSONALIZATION"));
  assert("explanation still populated at low OCR confidence", typeof resp.explanation === "string" && resp.explanation.length > 0);
}
{
  const txtP = { id: randomUUID(), type: "TEXT_SELECTION", extractedText: "present perfect", metadata: { capturedAt: new Date().toISOString() } };
  const txtResp = parseLensExplainResponse(JSON.stringify({ explanation: "Text", relatedTopics: [], confidence: 0.9 }), txtP.id, "EXPLAIN");
  const imgP = createImageCapture("IMAGE_UPLOAD", { base64: "d", widthPx: 100, heightPx: 100 });
  const { flags: ocrFlags } = await extractTextFromImage(imgP);
  const imgResp = mergeOcrFlags(parseLensExplainResponse(JSON.stringify({ explanation: "Img", relatedTopics: [], confidence: 0.8 }), imgP.id, "EXPLAIN"), ocrFlags);

  for (const field of ["requestId", "mode", "explanation", "relatedTopics", "confidence", "flags"]) {
    assert(`both text and image responses have field '${field}'`, field in txtResp && field in imgResp);
  }
}
{
  const imgP = createImageCapture("IMAGE_UPLOAD", { base64: "async", widthPx: 100, heightPx: 100 });
  const promise = extractTextFromImage(imgP);
  assert("extractTextFromImage returns a Promise", promise instanceof Promise);
  const result = await promise;
  assert("Promise resolves to { text, flags }", typeof result.text === "string" && Array.isArray(result.flags));
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
