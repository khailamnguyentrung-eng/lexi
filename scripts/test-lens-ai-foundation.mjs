/**
 * test-lens-ai-foundation.mjs
 *
 * Phase 7.1 — Text Selection Lens Foundation
 *
 * Tests pure functions from:
 *   lib/services/lens-ai/capture.ts
 *   lib/services/lens-ai/promptBuilder.ts
 *
 * All pure functions are inlined here in JavaScript.
 * No TypeScript compilation required. No DB connection.
 *
 * Sections:
 *   1.  createTextSelectionCapture — shape
 *   2.  createTextSelectionCapture — text trimming and errors
 *   3.  validateCapturePayload — TEXT_SELECTION and image types
 *   4.  buildExplainUserMessage — content and depth adaptation
 *   5.  parseLensExplainResponse — valid JSON
 *   6.  parseLensExplainResponse — invalid / non-JSON (mock provider output)
 *   7.  LensResponse shape invariants
 *   8.  Orchestrator error handling (inlined validation logic)
 *   9.  No DB writes — pure function verification
 *
 * Run: node scripts/test-lens-ai-foundation.mjs
 */

import { randomUUID } from "crypto";

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let section = "";

function describe(name) {
  section = name;
}

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
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
      console.error(
        `  ✗ ${name} — threw "${msg}", expected to include "${expectedSubstring}"`,
      );
      failed++;
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  }
}

// ─── Inlined: lib/services/lens-ai/capture.ts ────────────────────────────────

class CaptureValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CaptureValidationError";
  }
}

function createTextSelectionCapture(text, metadata = {}) {
  if (!text || text.trim().length === 0) {
    throw new CaptureValidationError("Text selection cannot be empty");
  }
  return {
    id: randomUUID(),
    type: "TEXT_SELECTION",
    extractedText: text.trim(),
    metadata: {
      capturedAt: new Date().toISOString(),
      sourceApp: "browser",
      ...metadata,
    },
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
      throw new CaptureValidationError(
        "TEXT_SELECTION payload must have non-empty extractedText",
      );
    return;
  }
  if (IMAGE_CAPTURE_TYPES.includes(payload.type) && !payload.image)
    throw new CaptureValidationError(`${payload.type} payload must include image data`);
}

// ─── Inlined: lib/services/lens-ai/promptBuilder.ts ─────────────────────────

const ANONYMOUS_CONTEXT = {
  learnerId: "anonymous",
  depthHint: "INTERMEDIATE",
  languagePreference: "vi_en",
};

const DEPTH_LINES = {
  BEGINNER:
    "Học sinh còn mới — hãy dùng ngôn ngữ thật đơn giản, nhiều ví dụ minh họa cơ bản.",
  INTERMEDIATE:
    "Học sinh ở trình độ trung bình — giải thích cân bằng giữa lý thuyết và ví dụ.",
  ADVANCED:
    "Học sinh khá giỏi — có thể đi sâu vào sắc thái, ngoại lệ, và cách dùng nâng cao.",
};

function buildExplainUserMessage(text, context) {
  const depthLine = DEPTH_LINES[context.depthHint] ?? DEPTH_LINES.INTERMEDIATE;
  return `Nội dung học sinh chọn:\n\n"${text}"\n\n${depthLine}\n\nHãy giải thích nội dung trên.`;
}

function stripCodeFence(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}

function parseLensExplainResponse(rawText, requestId, mode) {
  const flags = ["ANONYMOUS_NO_PERSONALIZATION"];
  try {
    const parsed = JSON.parse(stripCodeFence(rawText));
    const explanation =
      typeof parsed.explanation === "string" ? parsed.explanation : rawText.trim();
    const relatedTopics = Array.isArray(parsed.relatedTopics)
      ? parsed.relatedTopics.filter((t) => typeof t === "string")
      : [];
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.7;
    return { requestId, mode, explanation, relatedTopics, confidence, flags };
  } catch {
    flags.push("AI_PARSE_ERROR");
    return {
      requestId,
      mode,
      explanation: rawText.trim(),
      relatedTopics: [],
      confidence: 0.5,
      flags,
    };
  }
}

// ─── Inlined: orchestrator guard logic from lensAssistant.ts ─────────────────

class LensError extends Error {
  constructor(message) {
    super(message);
    this.name = "LensError";
  }
}

const IMPLEMENTED_MODES = ["EXPLAIN"];

function simulateOrchestratorGuards(payload, mode) {
  validateCapturePayload(payload); // throws CaptureValidationError
  if (payload.type !== "TEXT_SELECTION") {
    throw new LensError(
      `Phase 7.1 supports TEXT_SELECTION only. Got: ${payload.type}. Image capture requires Phase 7.2.`,
    );
  }
  if (!IMPLEMENTED_MODES.includes(mode)) {
    return {
      requestId: payload.id,
      mode,
      relatedTopics: [],
      confidence: 0,
      flags: ["MODE_NOT_IMPLEMENTED"],
    };
  }
  const text = payload.extractedText ?? "";
  if (!text.trim()) {
    return {
      requestId: payload.id,
      mode,
      relatedTopics: [],
      confidence: 0,
      flags: ["EMPTY_CAPTURE_TEXT"],
    };
  }
  return null; // would proceed to AIProvider.chat() in real code
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ── Section 1: createTextSelectionCapture — shape ─────────────────────────────

describe("1. createTextSelectionCapture — shape");
console.log(`\n${section}`);

{
  const payload = createTextSelectionCapture("The present perfect tense");
  assert("returns an object", typeof payload === "object" && payload !== null);
  assert("id is a non-empty string", typeof payload.id === "string" && payload.id.length > 0);
  assert("type is TEXT_SELECTION", payload.type === "TEXT_SELECTION");
  assert(
    "extractedText matches input",
    payload.extractedText === "The present perfect tense",
  );
  assert(
    "metadata.capturedAt is ISO string",
    typeof payload.metadata.capturedAt === "string" &&
      payload.metadata.capturedAt.includes("T"),
  );
  assert(
    "metadata.sourceApp defaults to browser",
    payload.metadata.sourceApp === "browser",
  );
  assert("image is absent", payload.image === undefined);
  assert("mimeType is absent", payload.mimeType === undefined);
}

// ── Section 2: createTextSelectionCapture — trimming and errors ───────────────

describe("2. createTextSelectionCapture — text trimming and errors");
console.log(`\n${section}`);

{
  const p = createTextSelectionCapture("  hello world  ");
  assert("trims leading/trailing whitespace", p.extractedText === "hello world");
}

assertThrows(
  "throws on empty string",
  () => createTextSelectionCapture(""),
  "cannot be empty",
);
assertThrows(
  "throws on whitespace-only string",
  () => createTextSelectionCapture("   "),
  "cannot be empty",
);

{
  const p1 = createTextSelectionCapture("test");
  const p2 = createTextSelectionCapture("test");
  assert("each capture gets a unique id", p1.id !== p2.id);
}

{
  const p = createTextSelectionCapture("text", {
    sourceUrl: "https://example.com",
    userLocale: "vi-VN",
  });
  assert(
    "accepts optional sourceUrl override",
    p.metadata.sourceUrl === "https://example.com",
  );
  assert("accepts optional userLocale override", p.metadata.userLocale === "vi-VN");
  assert("still has capturedAt when overrides passed", typeof p.metadata.capturedAt === "string");
}

// ── Section 3: validateCapturePayload ────────────────────────────────────────

describe("3. validateCapturePayload — TEXT_SELECTION and image types");
console.log(`\n${section}`);

{
  const valid = {
    id: randomUUID(),
    type: "TEXT_SELECTION",
    extractedText: "hello",
    metadata: { capturedAt: new Date().toISOString() },
  };
  let threw = false;
  try {
    validateCapturePayload(valid);
  } catch {
    threw = true;
  }
  assert("valid TEXT_SELECTION passes without throwing", !threw);
}

assertThrows(
  "throws when id is missing",
  () =>
    validateCapturePayload({
      type: "TEXT_SELECTION",
      extractedText: "x",
      metadata: { capturedAt: new Date().toISOString() },
    }),
  "id is required",
);

assertThrows(
  "throws when type is missing",
  () =>
    validateCapturePayload({
      id: randomUUID(),
      extractedText: "x",
      metadata: { capturedAt: new Date().toISOString() },
    }),
  "type is required",
);

assertThrows(
  "throws when capturedAt is missing",
  () =>
    validateCapturePayload({
      id: randomUUID(),
      type: "TEXT_SELECTION",
      extractedText: "x",
      metadata: {},
    }),
  "capturedAt is required",
);

assertThrows(
  "throws on TEXT_SELECTION with empty extractedText",
  () =>
    validateCapturePayload({
      id: randomUUID(),
      type: "TEXT_SELECTION",
      extractedText: "",
      metadata: { capturedAt: new Date().toISOString() },
    }),
  "non-empty extractedText",
);

assertThrows(
  "throws on TEXT_SELECTION with whitespace-only extractedText",
  () =>
    validateCapturePayload({
      id: randomUUID(),
      type: "TEXT_SELECTION",
      extractedText: "  ",
      metadata: { capturedAt: new Date().toISOString() },
    }),
  "non-empty extractedText",
);

assertThrows(
  "throws on IMAGE_UPLOAD without image data",
  () =>
    validateCapturePayload({
      id: randomUUID(),
      type: "IMAGE_UPLOAD",
      metadata: { capturedAt: new Date().toISOString() },
    }),
  "must include image data",
);

assertThrows(
  "throws on SCREENSHOT_REGION without image data",
  () =>
    validateCapturePayload({
      id: randomUUID(),
      type: "SCREENSHOT_REGION",
      metadata: { capturedAt: new Date().toISOString() },
    }),
  "must include image data",
);

// ── Section 4: buildExplainUserMessage ───────────────────────────────────────

describe("4. buildExplainUserMessage — content and depth adaptation");
console.log(`\n${section}`);

{
  const msg = buildExplainUserMessage("present perfect", ANONYMOUS_CONTEXT);
  assert(
    "contains the captured text in quotes",
    msg.includes('"present perfect"'),
  );
  assert(
    "contains the INTERMEDIATE depth line",
    msg.includes("trình độ trung bình"),
  );
  assert("contains the instruction to explain", msg.includes("giải thích"));
  assert("is a non-empty string", typeof msg === "string" && msg.length > 10);
}

{
  const beginnerCtx = { ...ANONYMOUS_CONTEXT, depthHint: "BEGINNER" };
  const msg = buildExplainUserMessage("verb tenses", beginnerCtx);
  assert(
    "BEGINNER context includes simple language instruction",
    msg.includes("đơn giản"),
  );
  assert(
    "BEGINNER context does not include advanced instruction",
    !msg.includes("sắc thái"),
  );
}

{
  const advancedCtx = { ...ANONYMOUS_CONTEXT, depthHint: "ADVANCED" };
  const msg = buildExplainUserMessage("subjunctive mood", advancedCtx);
  assert("ADVANCED context includes nuance instruction", msg.includes("sắc thái"));
  assert(
    "ADVANCED context does not include simple language instruction",
    !msg.includes("đơn giản"),
  );
}

{
  const msg1 = buildExplainUserMessage("topic", ANONYMOUS_CONTEXT);
  const msg2 = buildExplainUserMessage("topic", ANONYMOUS_CONTEXT);
  assert("same input produces same output (pure function)", msg1 === msg2);
}

{
  const msg = buildExplainUserMessage("test text", ANONYMOUS_CONTEXT);
  assert("message starts with 'Nội dung học sinh chọn'", msg.startsWith("Nội dung học sinh chọn"));
  assert("message ends with 'Hãy giải thích nội dung trên.'", msg.endsWith("Hãy giải thích nội dung trên."));
}

// ── Section 5: parseLensExplainResponse — valid JSON ─────────────────────────

describe("5. parseLensExplainResponse — valid JSON");
console.log(`\n${section}`);

{
  const id = randomUUID();
  const raw = JSON.stringify({
    explanation: "Present perfect is used for past actions with present relevance.",
    relatedTopics: ["past_simple", "time_expressions"],
    confidence: 0.9,
  });
  const r = parseLensExplainResponse(raw, id, "EXPLAIN");

  assert("requestId matches input id", r.requestId === id);
  assert("mode is EXPLAIN", r.mode === "EXPLAIN");
  assert(
    "explanation is a non-trivial string",
    typeof r.explanation === "string" && r.explanation.length > 5,
  );
  assert("relatedTopics is an array", Array.isArray(r.relatedTopics));
  assert(
    "relatedTopics contains past_simple",
    r.relatedTopics.includes("past_simple"),
  );
  assert(
    "relatedTopics contains time_expressions",
    r.relatedTopics.includes("time_expressions"),
  );
  assert("confidence is 0.9", r.confidence === 0.9);
  assert(
    "flags contains ANONYMOUS_NO_PERSONALIZATION",
    r.flags.includes("ANONYMOUS_NO_PERSONALIZATION"),
  );
  assert("flags does NOT contain AI_PARSE_ERROR", !r.flags.includes("AI_PARSE_ERROR"));
}

{
  const raw = JSON.stringify({
    explanation: "text",
    relatedTopics: ["t"],
    confidence: 1.5,
  });
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  assert("confidence clamped to 1.0 when above range", r.confidence === 1.0);
}

{
  const raw = JSON.stringify({
    explanation: "text",
    relatedTopics: ["t"],
    confidence: -0.5,
  });
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  assert("confidence clamped to 0.0 when below range", r.confidence === 0.0);
}

{
  const raw = JSON.stringify({
    explanation: "text",
    relatedTopics: [1, true, "valid_topic", null, "another_topic"],
    confidence: 0.8,
  });
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  assert(
    "non-string topics are filtered out",
    r.relatedTopics.length === 2 &&
      r.relatedTopics.includes("valid_topic") &&
      r.relatedTopics.includes("another_topic"),
  );
}

{
  const raw = JSON.stringify({ explanation: "text", relatedTopics: [], confidence: 0.7 });
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  assert(
    "empty relatedTopics array is accepted",
    Array.isArray(r.relatedTopics) && r.relatedTopics.length === 0,
  );
}

{
  const raw = JSON.stringify({ explanation: "text", relatedTopics: ["t"], confidence: 0.8 });
  // No confidence field — uses default 0.7
  const rawNoConf = JSON.stringify({ explanation: "text", relatedTopics: [] });
  const r = parseLensExplainResponse(rawNoConf, randomUUID(), "EXPLAIN");
  assert("missing confidence field defaults to 0.7", r.confidence === 0.7);
}

{
  // AI wraps JSON in code fence — should still parse correctly
  const inner = JSON.stringify({
    explanation: "fenced response",
    relatedTopics: ["present_perfect"],
    confidence: 0.8,
  });
  const raw = "```json\n" + inner + "\n```";
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  assert("strips JSON code fence before parsing", r.explanation === "fenced response");
  assert("no AI_PARSE_ERROR when code-fenced JSON is valid", !r.flags.includes("AI_PARSE_ERROR"));
}

{
  // Bare code fence (no 'json' label)
  const inner = JSON.stringify({ explanation: "bare fence", relatedTopics: [], confidence: 0.7 });
  const raw = "```\n" + inner + "\n```";
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  assert("strips bare code fence (no json label)", r.explanation === "bare fence");
}

// ── Section 6: parseLensExplainResponse — invalid / non-JSON ─────────────────

describe("6. parseLensExplainResponse — invalid/non-JSON (mock provider output)");
console.log(`\n${section}`);

{
  // This is exactly what the existing mockProvider.chat() returns
  const mockProviderOutput =
    `Đây là phản hồi mẫu (chế độ demo, chưa kết nối AI thật) cho câu hỏi: "present perfect". ` +
    `Khi quản trị viên cấu hình AI_PROVIDER, Lexi sẽ giải thích chi tiết hơn.`;
  const r = parseLensExplainResponse(mockProviderOutput, randomUUID(), "EXPLAIN");

  assert(
    "uses raw text as explanation when JSON is invalid",
    r.explanation === mockProviderOutput.trim(),
  );
  assert(
    "relatedTopics is empty array on parse error",
    Array.isArray(r.relatedTopics) && r.relatedTopics.length === 0,
  );
  assert("confidence is 0.5 on parse error", r.confidence === 0.5);
  assert("AI_PARSE_ERROR flag is set", r.flags.includes("AI_PARSE_ERROR"));
  assert(
    "ANONYMOUS_NO_PERSONALIZATION flag still set",
    r.flags.includes("ANONYMOUS_NO_PERSONALIZATION"),
  );
  assert("mode is still EXPLAIN", r.mode === "EXPLAIN");
}

{
  const r = parseLensExplainResponse("not json at all { broken {{", randomUUID(), "EXPLAIN");
  assert("handles broken JSON gracefully — no throw", typeof r.explanation === "string");
  assert("sets AI_PARSE_ERROR for broken JSON", r.flags.includes("AI_PARSE_ERROR"));
}

{
  const r = parseLensExplainResponse("", randomUUID(), "EXPLAIN");
  assert("empty string sets AI_PARSE_ERROR", r.flags.includes("AI_PARSE_ERROR"));
  assert("empty string produces empty explanation string", r.explanation === "");
}

{
  // AI returns a JSON array instead of an object — should fail gracefully
  const raw = JSON.stringify(["not", "an", "object"]);
  const r = parseLensExplainResponse(raw, randomUUID(), "EXPLAIN");
  // Array is valid JSON but not the expected shape — explanation falls back to raw text
  // (parsed.explanation would be undefined, so we fall back to rawText.trim())
  assert(
    "JSON array (wrong shape) falls back gracefully — no AI_PARSE_ERROR",
    !r.flags.includes("AI_PARSE_ERROR"),
  );
  assert(
    "JSON array response uses raw text as explanation fallback",
    r.explanation === raw.trim(),
  );
}

// ── Section 7: LensResponse shape invariants ──────────────────────────────────

describe("7. LensResponse shape invariants");
console.log(`\n${section}`);

{
  const anyValidRaw = JSON.stringify({
    explanation: "x",
    relatedTopics: [],
    confidence: 0.8,
  });
  const r = parseLensExplainResponse(anyValidRaw, randomUUID(), "EXPLAIN");
  assert("requestId is always a string", typeof r.requestId === "string");
  assert("mode is always present", typeof r.mode === "string");
  assert("relatedTopics is always an array", Array.isArray(r.relatedTopics));
  assert("confidence is always a number", typeof r.confidence === "number");
  assert("flags is always an array", Array.isArray(r.flags));
  assert("confidence is in [0, 1]", r.confidence >= 0 && r.confidence <= 1);
}

{
  const knownId = "test-known-id-xyz";
  const r = parseLensExplainResponse(
    JSON.stringify({ explanation: "y", relatedTopics: [], confidence: 0.5 }),
    knownId,
    "EXPLAIN",
  );
  assert("requestId is echoed from input", r.requestId === knownId);
}

{
  const r = parseLensExplainResponse(
    JSON.stringify({ explanation: "z", relatedTopics: [], confidence: 0.5 }),
    randomUUID(),
    "SOLVE",
  );
  assert("mode SOLVE is preserved in response", r.mode === "SOLVE");
}

// ── Section 8: Orchestrator error handling (inlined guards) ───────────────────

describe("8. Orchestrator error handling — type and mode guards");
console.log(`\n${section}`);

assertThrows(
  "throws CaptureValidationError when payload id is missing",
  () =>
    simulateOrchestratorGuards(
      {
        type: "TEXT_SELECTION",
        extractedText: "x",
        metadata: { capturedAt: new Date().toISOString() },
      },
      "EXPLAIN",
    ),
  "id is required",
);

assertThrows(
  "throws LensError on IMAGE_UPLOAD in Phase 7.1",
  () =>
    simulateOrchestratorGuards(
      {
        id: randomUUID(),
        type: "IMAGE_UPLOAD",
        image: { base64: "abc", widthPx: 100, heightPx: 100 },
        metadata: { capturedAt: new Date().toISOString() },
      },
      "EXPLAIN",
    ),
  "TEXT_SELECTION only",
);

assertThrows(
  "throws LensError on SCREENSHOT_REGION in Phase 7.1",
  () =>
    simulateOrchestratorGuards(
      {
        id: randomUUID(),
        type: "SCREENSHOT_REGION",
        image: { base64: "abc", widthPx: 100, heightPx: 100 },
        metadata: { capturedAt: new Date().toISOString() },
      },
      "EXPLAIN",
    ),
  "Phase 7.2",
);

{
  const payload = createTextSelectionCapture("a vocabulary word");
  const r = simulateOrchestratorGuards(payload, "SOLVE");
  assert(
    "SOLVE mode returns MODE_NOT_IMPLEMENTED flag",
    r !== null && r.flags.includes("MODE_NOT_IMPLEMENTED"),
  );
  assert("SOLVE mode returns confidence 0", r !== null && r.confidence === 0);
  assert("SOLVE mode returns empty relatedTopics", r !== null && r.relatedTopics.length === 0);
}

{
  const payload = createTextSelectionCapture("vocab");
  const r = simulateOrchestratorGuards(payload, "TRANSLATE");
  assert(
    "TRANSLATE mode returns MODE_NOT_IMPLEMENTED flag",
    r !== null && r.flags.includes("MODE_NOT_IMPLEMENTED"),
  );
}

{
  const payload = createTextSelectionCapture("vocab");
  const r = simulateOrchestratorGuards(payload, "HINT");
  assert(
    "HINT mode returns MODE_NOT_IMPLEMENTED flag",
    r !== null && r.flags.includes("MODE_NOT_IMPLEMENTED"),
  );
}

{
  // EXPLAIN with valid payload returns null (would proceed to AIProvider)
  const payload = createTextSelectionCapture("present perfect");
  const r = simulateOrchestratorGuards(payload, "EXPLAIN");
  assert("valid EXPLAIN payload returns null (proceeds to AI)", r === null);
}

// ── Section 9: No DB writes — pure function verification ─────────────────────

describe("9. No DB writes — pure function verification");
console.log(`\n${section}`);

{
  // All pure functions below are synchronous — DB access would require async/await
  const p = createTextSelectionCapture("test content");
  assert(
    "createTextSelectionCapture is synchronous (not a Promise)",
    !(p instanceof Promise),
  );

  const msg = buildExplainUserMessage("test", ANONYMOUS_CONTEXT);
  assert(
    "buildExplainUserMessage is synchronous (not a Promise)",
    !(msg instanceof Promise),
  );

  const r = parseLensExplainResponse(
    JSON.stringify({ explanation: "x", relatedTopics: [], confidence: 0.8 }),
    randomUUID(),
    "EXPLAIN",
  );
  assert(
    "parseLensExplainResponse is synchronous (not a Promise)",
    !(r instanceof Promise),
  );
}

{
  // Determinism: same text input → same extractedText, different id
  const p1 = createTextSelectionCapture("same text");
  const p2 = createTextSelectionCapture("same text");
  assert(
    "two captures with same text have same extractedText",
    p1.extractedText === p2.extractedText,
  );
  assert("two captures with same text have different ids (no shared state)", p1.id !== p2.id);
}

{
  // Pure function: same input → same output every time
  const msg1 = buildExplainUserMessage("present perfect", ANONYMOUS_CONTEXT);
  const msg2 = buildExplainUserMessage("present perfect", ANONYMOUS_CONTEXT);
  const msg3 = buildExplainUserMessage("present perfect", ANONYMOUS_CONTEXT);
  assert(
    "buildExplainUserMessage is deterministic (3 identical calls)",
    msg1 === msg2 && msg2 === msg3,
  );
}

{
  // parseLensExplainResponse does not have any side effects
  // (it reads no external state and writes to nothing)
  const input = JSON.stringify({ explanation: "test", relatedTopics: [], confidence: 0.7 });
  const id = randomUUID();
  const r1 = parseLensExplainResponse(input, id, "EXPLAIN");
  const r2 = parseLensExplainResponse(input, id, "EXPLAIN");
  assert(
    "parseLensExplainResponse is deterministic (same id + same input → same output)",
    r1.explanation === r2.explanation &&
      r1.confidence === r2.confidence &&
      r1.flags.length === r2.flags.length,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
