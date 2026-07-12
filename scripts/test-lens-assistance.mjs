/**
 * test-lens-assistance.mjs
 *
 * Phase 7.3 — Contextual Learning Assistance
 * All logic inlined in JavaScript. No TypeScript compilation. No DB. No real AI calls.
 *
 * Sections:
 *   1.  detectIntent — captured question (math problem)
 *   2.  detectIntent — captured concept
 *   3.  detectIntent — vocabulary words and phrases
 *   4.  detectIntent — study text and unknown content
 *   5.  detectIntent — deterministic (same input → same output, always)
 *   6.  planAssistance — style mapping
 *   7.  planAssistance — prompt structure
 *   8.  parseAssistanceResponse — GUIDED_STEPS (math)
 *   9.  parseAssistanceResponse — explanation styles + error handling
 *  10.  assistFromCapture — end-to-end with mock AI provider
 *
 * Run: node scripts/test-lens-assistance.mjs
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

// ─── Inlined: capture.ts ─────────────────────────────────────────────────────

class CaptureValidationError extends Error {
  constructor(message) { super(message); this.name = "CaptureValidationError"; }
}

function createTextSelectionCapture(text, metadata = {}) {
  if (!text || text.trim().length === 0)
    throw new CaptureValidationError("Text selection cannot be empty");
  return {
    id: randomUUID(), type: "TEXT_SELECTION",
    extractedText: text.trim(),
    metadata: { capturedAt: new Date().toISOString(), sourceApp: "browser", ...metadata },
  };
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

// ─── Inlined: assistance/intentDetector.ts ───────────────────────────────────

const MATH_SYMBOL = /[×÷√∑∫∂±]|\d+\s*[-+*/^]\s*\d+|[a-z]\s*=\s*[\d(]/i;
const MATH_KEYWORD = /\b(?:solve|calculate|compute|simplify|evaluate)\b/i;
const VOCAB_MAX_WORDS = 4;
const STUDY_MIN_WORDS = 100;

function isMathProblem(text) {
  if (MATH_SYMBOL.test(text)) return true;
  return MATH_KEYWORD.test(text) && /\d/.test(text);
}

function detectIntent(text) {
  const trimmed = text.trim();
  if (!trimmed) return "UNKNOWN";
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (isMathProblem(trimmed)) return "MATH_PROBLEM";
  if (wordCount <= VOCAB_MAX_WORDS) return "VOCABULARY_WORD";
  if (wordCount >= STUDY_MIN_WORDS) return "STUDY_TEXT";
  return "CONCEPT_EXPLANATION";
}

// ─── Inlined: assistance/assistancePlanner.ts ────────────────────────────────

const PLANS = {
  MATH_PROBLEM: {
    style: "GUIDED_STEPS",
    systemPrompt: "You are a math tutor. Break the problem into clear numbered steps. Show reasoning at each step. Do not just state the answer.\nReturn JSON: {\"steps\":[{\"stepNumber\":1,\"instruction\":\"...\",\"reasoning\":\"...\"}],\"relatedTopics\":[],\"confidence\":0.9}",
    buildUserMessage: (text) => `Walk the student through this problem step by step:\n\n${text}`,
  },
  VOCABULARY_WORD: {
    style: "VOCABULARY_MEANING",
    systemPrompt: "You are a vocabulary tutor for English learners. Give part of speech, a clear definition, and 1–2 example sentences. Keep it concise.\nReturn JSON: {\"explanation\":\"...\",\"relatedTopics\":[],\"confidence\":0.9}",
    buildUserMessage: (text) => `Explain this vocabulary for a student:\n\n${text}`,
  },
  CONCEPT_EXPLANATION: {
    style: "CONCEPT_EXPLANATION",
    systemPrompt: "You are an educational assistant. Explain the concept clearly with a concrete example the student can relate to.\nReturn JSON: {\"explanation\":\"...\",\"relatedTopics\":[],\"confidence\":0.9}",
    buildUserMessage: (text) => `Explain this concept for a student:\n\n${text}`,
  },
  STUDY_TEXT: {
    style: "SUMMARY",
    systemPrompt: "You are a study assistant. Distil the text into 3–5 key points a student should remember. Be specific, not vague.\nReturn JSON: {\"explanation\":\"...\",\"relatedTopics\":[],\"confidence\":0.9}",
    buildUserMessage: (text) => `Summarise this study material into key points:\n\n${text}`,
  },
  UNKNOWN: {
    style: "GENERAL_HELP",
    systemPrompt: "You are a helpful learning assistant. Provide the most useful educational context you can for whatever the student has captured.\nReturn JSON: {\"explanation\":\"...\",\"relatedTopics\":[],\"confidence\":0.7}",
    buildUserMessage: (text) => `Help the student understand this:\n\n${text}`,
  },
};

function planAssistance(intent) {
  return PLANS[intent];
}

// ─── Inlined: assistance/assistant.ts (parseAssistanceResponse) ───────────────

function stripCodeFence(raw) {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

function parseAssistanceResponse(rawText, requestId, style, ocrFlags = []) {
  const flags = [...ocrFlags, "ANONYMOUS_NO_PERSONALIZATION"];
  try {
    const json = JSON.parse(stripCodeFence(rawText));
    const relatedTopics = Array.isArray(json.relatedTopics)
      ? json.relatedTopics.filter((t) => typeof t === "string") : [];
    const confidence = typeof json.confidence === "number"
      ? Math.min(1, Math.max(0, json.confidence)) : 0.7;

    if (style === "GUIDED_STEPS" && Array.isArray(json.steps)) {
      const steps = json.steps.map((s, i) => ({
        stepNumber: typeof s.stepNumber === "number" ? s.stepNumber : i + 1,
        instruction: typeof s.instruction === "string" ? s.instruction : "",
        ...(typeof s.reasoning === "string" ? { reasoning: s.reasoning } : {}),
      }));
      return { requestId, assistanceStyle: style, steps, relatedTopics, confidence, flags };
    }
    return {
      requestId, assistanceStyle: style,
      explanation: typeof json.explanation === "string" ? json.explanation : rawText.trim(),
      relatedTopics, confidence, flags,
    };
  } catch {
    flags.push("AI_PARSE_ERROR");
    return {
      requestId, assistanceStyle: style,
      explanation: rawText.trim(),
      relatedTopics: [], confidence: 0.5, flags,
    };
  }
}

// ─── Inlined: assistFromCapture (injectable AI for tests) ─────────────────────

async function simulateAssistance(payload, aiProvider, ocrProvider) {
  validateCapturePayload(payload);
  let text = "";
  let ocrFlags = [];
  if (payload.type === "TEXT_SELECTION") {
    text = payload.extractedText ?? "";
  } else {
    const r = await extractTextFromImage(payload, ocrProvider);
    text = r.text; ocrFlags = r.flags;
  }
  if (!text.trim()) {
    return {
      requestId: payload.id, assistanceStyle: "GENERAL_HELP",
      relatedTopics: [], confidence: 0, flags: ["EMPTY_CAPTURE_TEXT", ...ocrFlags],
    };
  }
  const intent = detectIntent(text);
  const plan = planAssistance(intent);
  const rawResponse = await aiProvider.chat({
    system: plan.systemPrompt,
    messages: [{ role: "user", content: plan.buildUserMessage(text) }],
  });
  return parseAssistanceResponse(rawResponse, payload.id, plan.style, ocrFlags);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ── Section 1: detectIntent — captured question (math problem) ────────────────

console.log("\n1. detectIntent — captured question (math problem)");

assert("equation with = → MATH_PROBLEM",
  detectIntent("Solve: 2x + 5 = 15") === "MATH_PROBLEM");
assert("arithmetic expression → MATH_PROBLEM",
  detectIntent("Calculate 3 + 4 × 2") === "MATH_PROBLEM");
assert("variable equation x = 5 → MATH_PROBLEM",
  detectIntent("x = 5") === "MATH_PROBLEM");
assert("arithmetic without keyword → MATH_PROBLEM",
  detectIntent("3 + 4 = 7") === "MATH_PROBLEM");
assert("keyword + digits → MATH_PROBLEM",
  detectIntent("Compute the value 2^8") === "MATH_PROBLEM");
assert("keyword alone (no digits) is NOT MATH_PROBLEM",
  detectIntent("Solve the puzzle") !== "MATH_PROBLEM");
assert("division symbol → MATH_PROBLEM",
  detectIntent("10 ÷ 2 = 5") === "MATH_PROBLEM");

// ── Section 2: detectIntent — captured concept ────────────────────────────────

console.log("\n2. detectIntent — captured concept");

assert("short paragraph about tense → CONCEPT_EXPLANATION",
  detectIntent("The present perfect connects a past action to the present moment.") === "CONCEPT_EXPLANATION");
assert("multi-sentence definition → CONCEPT_EXPLANATION",
  detectIntent("Photosynthesis is the process by which plants use sunlight to produce food from carbon dioxide.") === "CONCEPT_EXPLANATION");
assert("grammar rule → CONCEPT_EXPLANATION",
  detectIntent("We use the present perfect with since and for to talk about duration.") === "CONCEPT_EXPLANATION");
assert("5+ word sentence without math → CONCEPT_EXPLANATION",
  detectIntent("The passive voice is formed with be and a past participle.") === "CONCEPT_EXPLANATION");
assert("question about a concept → CONCEPT_EXPLANATION",
  detectIntent("What is the difference between since and for in English grammar?") === "CONCEPT_EXPLANATION");

// ── Section 3: detectIntent — vocabulary words and phrases ────────────────────

console.log("\n3. detectIntent — vocabulary words and phrases");

assert("single word → VOCABULARY_WORD",
  detectIntent("photosynthesis") === "VOCABULARY_WORD");
assert("two-word term → VOCABULARY_WORD",
  detectIntent("present perfect") === "VOCABULARY_WORD");
assert("two-word term 2 → VOCABULARY_WORD",
  detectIntent("phrasal verbs") === "VOCABULARY_WORD");
assert("three-word phrase → VOCABULARY_WORD",
  detectIntent("present perfect continuous") === "VOCABULARY_WORD");
assert("four-word phrase → VOCABULARY_WORD",
  detectIntent("run out of time") === "VOCABULARY_WORD");
assert("single word (verb) → VOCABULARY_WORD",
  detectIntent("ameliorate") === "VOCABULARY_WORD");

// ── Section 4: detectIntent — study text and unknown content ──────────────────

console.log("\n4. detectIntent — study text and unknown content");

{
  // Build a 160-word passage
  const studyText = ("The present perfect tense is one of the most important tenses in English. " +
    "It connects the past to the present in a meaningful way. " +
    "We form it using have or has plus the past participle of the main verb. " +
    "For example, I have lived here for ten years tells us the action started in the past and continues now. " +
    "We also use it for experiences without specifying when. " +
    "I have visited Paris means at some point in my life I was there. " +
    "The present perfect is different from the simple past, which refers to a completed action at a specific time. " +
    "Students often confuse these two tenses. " +
    "The key is to ask whether the connection to the present matters or not. ").trim();
  const wc = studyText.split(/\s+/).filter(Boolean).length;
  assert(`study text (${wc} words) → STUDY_TEXT`,
    wc >= STUDY_MIN_WORDS && detectIntent(studyText) === "STUDY_TEXT");
}
assert("empty string → UNKNOWN", detectIntent("") === "UNKNOWN");
assert("whitespace only → UNKNOWN", detectIntent("   ") === "UNKNOWN");

// ── Section 5: detectIntent — deterministic ───────────────────────────────────

console.log("\n5. detectIntent — deterministic (same input → same output)");

{
  const inputs = [
    "Solve: 2x + 5 = 15",
    "photosynthesis",
    "The present perfect connects past to present.",
    "",
  ];
  for (const input of inputs) {
    const r1 = detectIntent(input);
    const r2 = detectIntent(input);
    const r3 = detectIntent(input);
    assert(`"${input.slice(0, 30)}" is deterministic`, r1 === r2 && r2 === r3);
  }
}

// ── Section 6: planAssistance — style mapping ─────────────────────────────────

console.log("\n6. planAssistance — style mapping");

assert("MATH_PROBLEM → GUIDED_STEPS", planAssistance("MATH_PROBLEM").style === "GUIDED_STEPS");
assert("VOCABULARY_WORD → VOCABULARY_MEANING", planAssistance("VOCABULARY_WORD").style === "VOCABULARY_MEANING");
assert("CONCEPT_EXPLANATION → CONCEPT_EXPLANATION", planAssistance("CONCEPT_EXPLANATION").style === "CONCEPT_EXPLANATION");
assert("STUDY_TEXT → SUMMARY", planAssistance("STUDY_TEXT").style === "SUMMARY");
assert("UNKNOWN → GENERAL_HELP", planAssistance("UNKNOWN").style === "GENERAL_HELP");

// ── Section 7: planAssistance — prompt structure ──────────────────────────────

console.log("\n7. planAssistance — prompt structure");

for (const [intent, style] of [
  ["MATH_PROBLEM", "GUIDED_STEPS"],
  ["VOCABULARY_WORD", "VOCABULARY_MEANING"],
  ["CONCEPT_EXPLANATION", "CONCEPT_EXPLANATION"],
  ["STUDY_TEXT", "SUMMARY"],
  ["UNKNOWN", "GENERAL_HELP"],
]) {
  const plan = planAssistance(intent);
  assert(`${intent} plan has non-empty systemPrompt`,
    typeof plan.systemPrompt === "string" && plan.systemPrompt.length > 0);
  assert(`${intent} buildUserMessage includes the capture text`,
    plan.buildUserMessage("TEST_TEXT").includes("TEST_TEXT"));
}

// ── Section 8: parseAssistanceResponse — GUIDED_STEPS ────────────────────────

console.log("\n8. parseAssistanceResponse — GUIDED_STEPS (math response)");

{
  const raw = JSON.stringify({
    steps: [
      { stepNumber: 1, instruction: "Subtract 5 from both sides", reasoning: "Isolate the x term" },
      { stepNumber: 2, instruction: "Divide both sides by 2", reasoning: "Solve for x" },
    ],
    relatedTopics: ["linear_equations"],
    confidence: 0.95,
  });
  const r = parseAssistanceResponse(raw, "req-1", "GUIDED_STEPS");
  assert("GUIDED_STEPS response has steps array", Array.isArray(r.steps));
  assert("steps has correct count", r.steps.length === 2);
  assert("first step has stepNumber", r.steps[0].stepNumber === 1);
  assert("first step has instruction", r.steps[0].instruction === "Subtract 5 from both sides");
  assert("first step has reasoning", r.steps[0].reasoning === "Isolate the x term");
  assert("GUIDED_STEPS assistanceStyle set", r.assistanceStyle === "GUIDED_STEPS");
  assert("GUIDED_STEPS relatedTopics", r.relatedTopics.includes("linear_equations"));
  assert("GUIDED_STEPS confidence 0.95", r.confidence === 0.95);
}
{
  // If AI returns GUIDED_STEPS without steps array → falls back to explanation
  const raw = JSON.stringify({ explanation: "Here is the solution.", relatedTopics: [], confidence: 0.8 });
  const r = parseAssistanceResponse(raw, "req-2", "GUIDED_STEPS");
  assert("GUIDED_STEPS without steps falls back to explanation",
    typeof r.explanation === "string" && r.explanation === "Here is the solution.");
}
{
  // Invalid JSON
  const r = parseAssistanceResponse("not json at all", "req-3", "GUIDED_STEPS");
  assert("invalid JSON → AI_PARSE_ERROR flag", r.flags.includes("AI_PARSE_ERROR"));
  assert("invalid JSON → confidence 0.5", r.confidence === 0.5);
  assert("invalid JSON → raw text as explanation", r.explanation === "not json at all");
}

// ── Section 9: parseAssistanceResponse — explanation styles + error handling ──

console.log("\n9. parseAssistanceResponse — explanation styles + error handling");

{
  const raw = JSON.stringify({ explanation: "Photosynthesis is the process...", relatedTopics: ["biology"], confidence: 0.9 });
  const r = parseAssistanceResponse(raw, "req-4", "VOCABULARY_MEANING");
  assert("VOCABULARY_MEANING sets assistanceStyle", r.assistanceStyle === "VOCABULARY_MEANING");
  assert("VOCABULARY_MEANING has explanation", r.explanation === "Photosynthesis is the process...");
  assert("VOCABULARY_MEANING has relatedTopics", r.relatedTopics.includes("biology"));
  assert("VOCABULARY_MEANING has ANONYMOUS_NO_PERSONALIZATION", r.flags.includes("ANONYMOUS_NO_PERSONALIZATION"));
}
{
  const raw = JSON.stringify({ explanation: "Key summary points.", relatedTopics: [], confidence: 0.85 });
  const r = parseAssistanceResponse(raw, "req-5", "SUMMARY");
  assert("SUMMARY sets assistanceStyle", r.assistanceStyle === "SUMMARY");
  assert("no AI_PARSE_ERROR for valid JSON", !r.flags.includes("AI_PARSE_ERROR"));
}
{
  // Code-fenced JSON
  const raw = "```json\n" + JSON.stringify({ explanation: "Fenced response.", relatedTopics: [], confidence: 0.8 }) + "\n```";
  const r = parseAssistanceResponse(raw, "req-6", "CONCEPT_EXPLANATION");
  assert("code-fenced JSON is parsed correctly", r.explanation === "Fenced response.");
  assert("code-fenced response has no AI_PARSE_ERROR", !r.flags.includes("AI_PARSE_ERROR"));
}
{
  // With OCR flags passed in
  const raw = JSON.stringify({ explanation: "Content from blurry image.", relatedTopics: [], confidence: 0.7 });
  const r = parseAssistanceResponse(raw, "req-7", "GENERAL_HELP", ["OCR_CONFIDENCE_LOW"]);
  assert("OCR flags prepended before AI flags", r.flags[0] === "OCR_CONFIDENCE_LOW");
  assert("ANONYMOUS_NO_PERSONALIZATION follows OCR flag",
    r.flags.indexOf("OCR_CONFIDENCE_LOW") < r.flags.indexOf("ANONYMOUS_NO_PERSONALIZATION"));
}

// ── Section 10: assistFromCapture — end-to-end with mock AI ──────────────────

console.log("\n10. assistFromCapture — end-to-end with mock AI provider");

{
  // Math problem — TEXT_SELECTION
  const stepsAI = {
    async chat() {
      return JSON.stringify({
        steps: [{ stepNumber: 1, instruction: "Subtract 5", reasoning: "Isolate x" }, { stepNumber: 2, instruction: "Divide by 2", reasoning: "Solve" }],
        relatedTopics: ["linear_equations"], confidence: 0.95,
      });
    },
  };
  const p = createTextSelectionCapture("Solve: 2x + 5 = 15");
  const r = await simulateAssistance(p, stepsAI, null);
  assert("math capture → assistanceStyle GUIDED_STEPS", r.assistanceStyle === "GUIDED_STEPS");
  assert("math capture → steps array", Array.isArray(r.steps) && r.steps.length > 0);
  assert("math capture → requestId matches payload", r.requestId === p.id);
  assert("math capture → confidence in [0,1]", r.confidence >= 0 && r.confidence <= 1);
  assert("math capture → ANONYMOUS_NO_PERSONALIZATION flag", r.flags.includes("ANONYMOUS_NO_PERSONALIZATION"));
}
{
  // Vocabulary — TEXT_SELECTION
  const vocabAI = {
    async chat() {
      return JSON.stringify({ explanation: "Photosynthesis: the process plants use to make food from sunlight.", relatedTopics: ["biology"], confidence: 0.9 });
    },
  };
  const p = createTextSelectionCapture("photosynthesis");
  const r = await simulateAssistance(p, vocabAI, null);
  assert("vocab capture → assistanceStyle VOCABULARY_MEANING", r.assistanceStyle === "VOCABULARY_MEANING");
  assert("vocab capture → has explanation", typeof r.explanation === "string" && r.explanation.length > 0);
  assert("vocab capture → no steps (explanation style)", r.steps === undefined);
}
{
  // Concept — TEXT_SELECTION
  const conceptAI = {
    async chat() {
      return JSON.stringify({ explanation: "Present perfect connects past actions to now.", relatedTopics: ["present_perfect"], confidence: 0.88 });
    },
  };
  const p = createTextSelectionCapture("The present perfect tense is used to talk about past actions that affect the present.");
  const r = await simulateAssistance(p, conceptAI, null);
  assert("concept capture → assistanceStyle CONCEPT_EXPLANATION", r.assistanceStyle === "CONCEPT_EXPLANATION");
}
{
  // Image capture — OCR produces a concept text → CONCEPT_EXPLANATION
  const screenshotText = "The passive voice is formed with the verb to be and a past participle.";
  const imageOCR = {
    name: "text-ocr",
    async extractText() { return { extractedText: screenshotText, confidence: 0.85 }; },
  };
  const conceptAI = {
    async chat() {
      return JSON.stringify({ explanation: "Passive voice explanation.", relatedTopics: [], confidence: 0.85 });
    },
  };
  const p = createImageCapture("SCREENSHOT_REGION", { base64: "data", widthPx: 1920, heightPx: 1080 });
  const r = await simulateAssistance(p, conceptAI, imageOCR);
  assert("image capture → assistanceStyle detected from OCR text", r.assistanceStyle === "CONCEPT_EXPLANATION");
  assert("image capture → no OCR_CONFIDENCE_LOW (confidence 0.85)", !r.flags.includes("OCR_CONFIDENCE_LOW"));
}
{
  // Empty capture → EMPTY_CAPTURE_TEXT
  const emptyOCR = { name: "e", async extractText() { return { extractedText: null, confidence: null }; } };
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "blank", widthPx: 100, heightPx: 100 });
  const r = await simulateAssistance(p, null, emptyOCR);
  assert("empty capture → EMPTY_CAPTURE_TEXT flag", r.flags.includes("EMPTY_CAPTURE_TEXT"));
  assert("empty capture → assistanceStyle GENERAL_HELP (fallback)", r.assistanceStyle === "GENERAL_HELP");
  assert("empty capture → confidence is 0", r.confidence === 0);
}
{
  // Low-confidence OCR propagates to response flags
  const lowOCR = { name: "low", async extractText() { return { extractedText: "blurry concept text here", confidence: 0.4 }; } };
  const anyAI = { async chat() { return JSON.stringify({ explanation: "Some explanation.", relatedTopics: [], confidence: 0.7 }); } };
  const p = createImageCapture("IMAGE_UPLOAD", { base64: "blurry", widthPx: 100, heightPx: 100 });
  const r = await simulateAssistance(p, anyAI, lowOCR);
  assert("low OCR → OCR_CONFIDENCE_LOW in response flags", r.flags.includes("OCR_CONFIDENCE_LOW"));
  assert("low OCR → still produces an assistanceStyle", typeof r.assistanceStyle === "string");
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
