# LEXI Lens — Visual AI Learning Assistant
## Architecture Design Review

_Created: 2026-06-30. Phase 6 complete. M7.1 + M7.2 implemented 2026-06-30._

### Implementation Status

| Milestone | Status | Files |
|---|---|---|
| M7.1 — Text Selection Lens Foundation | ✓ Complete | `lib/services/lens-ai/types.ts`, `capture.ts`, `promptBuilder.ts`, `lensAssistant.ts` |
| M7.2 — Screenshot + OCR | ✓ Complete | `lib/services/lens-ai/understanding/types.ts`, `ocr.ts`, `imageProcessor.ts`, updated `capture.ts`, `lensAssistant.ts` |
| M7.3 — Image Upload + Vision | Pending | — |
| M7.4 — Learner Profile Integration | Pending | — |

### M7.1 Implementation Notes

**Scope delivered:** `captureAndAssist(payload, "EXPLAIN")` for TEXT_SELECTION payloads. Entry point is `lib/services/lens-ai/lensAssistant.ts`.

**Constraints honored:**
- Reuses `getAIProvider()` — no new AI client, no new interface method
- All functions are pure (capture + promptBuilder) or depend only on AIProvider (lensAssistant)
- No DB access, no profile reads — context is always `ANONYMOUS_CONTEXT`
- Non-EXPLAIN modes return `MODE_NOT_IMPLEMENTED` flag (not throw) so UI can present "not available yet"
- Image capture types throw `LensError` (not flag) — caller must not silently proceed without image data

**Parse fallback:** `parseLensExplainResponse` handles non-JSON AI output (e.g. mock provider free text) by setting `AI_PARSE_ERROR` flag and using raw text as explanation at confidence 0.5. This means the mock provider produces usable (though unflagged-as-confident) responses without any mock changes.

**Test coverage:** 87 assertions in `scripts/test-lens-ai-foundation.mjs` (node-only, no server required).

### M7.2 Implementation Notes

**Scope delivered:** `IMAGE_UPLOAD` and `SCREENSHOT_REGION` payloads now route through `extractTextFromImage()` (mock OCR) before entering the existing AI pipeline. Entry point unchanged: `captureAndAssist()` in `lib/services/lens-ai/lensAssistant.ts`.

**Constraints honored:**
- No new AI client — OCR result feeds into the same `AIProvider.chat()` call used in Phase 7.1
- No DB access — images held in memory only; OCR result is ephemeral
- CAMERA_CAPTURE removed — not a supported input source
- Mode check moved before type routing — unimplemented modes short-circuit without triggering OCR
- OCR flags (`OCR_CONFIDENCE_LOW`) prepended to AI response flags so callers can distinguish OCR quality from AI quality

**OcrProvider interface:** `lib/services/lens-ai/understanding/types.ts`. Mock: `MockOcrProvider` in `understanding/ocr.ts` — returns `confidence: 0.9` for non-empty base64; `null` for empty. Real OCR (Tesseract.js or cloud) plugs in via `getOcrProvider()` in Phase 7.3.

**Test coverage:** 92 assertions in `scripts/test-lens-image-understanding.mjs` (node-only, async, no server required).

---

## 0. What LEXI Lens Is (and Is Not)

### What it is

LEXI Lens is a **visual AI learning assistant** — like Google Lens, but specialized for education.

The learner captures content from their environment (a screenshot region, a photo, a paragraph they are reading, a math problem they are stuck on) and receives instant, personalized learning assistance. The AI responds in a mode chosen by the learner: explain it, solve it step-by-step, give a hint, translate it, summarize it, or generate a practice question from it.

```
User highlights a paragraph from a textbook
   ↓
LEXI Lens identifies: "TEXT_PARAGRAPH — grammar topic"
   ↓
AI explains the concept at the learner's level
   ↓
Learner understands and moves on
```

```
User captures a vocabulary word they don't know
   ↓
LEXI Lens identifies: "VOCABULARY_WORD"
   ↓
AI returns: meaning, pronunciation, 3 usage examples, common collocations
```

```
User photographs a math problem from their homework
   ↓
LEXI Lens identifies: "MATH_PROBLEM"
   ↓
AI returns: 4-step solution with reasoning at each step (never just the answer)
```

### What it is NOT

| Misconception | Correct |
|---|---|
| A learner dashboard | That is the Phase 6 Learner Lens (profile view) |
| A StudentLearningProfile viewer | Phase 6 handles that. This is a real-time capture-and-assist tool |
| A Question Bank editor | Lens AI never writes to the Question Bank directly |
| A replacement for the chat interface | Chat is conversational; Lens is context-capture-first |
| A new intelligence engine | Lens reuses existing engines, never duplicates them |

### Naming distinction

Two "Lens" concepts exist in LEXI:

| System | Phase | Code location | Purpose |
|---|---|---|---|
| **Learner Lens** | 6 | `lib/services/lens/`, `app/(app)/lens/` | Profile presentation — shows StudentLearningProfile as narrative |
| **LEXI Lens** | 7 | `lib/services/lens-ai/`, `app/(app)/capture/` | Visual AI assistant — capture → understand → assist |

These are independent systems. LEXI Lens (Phase 7) reads from StudentLearningProfile but does not modify it.

---

## 1. Capture Layer

The first boundary: raw input from the user becomes a structured `CapturePayload`.

### Input types

| Type | Source | Has image | Has text |
|---|---|---|---|
| `TEXT_SELECTION` | User selects text on a web page | No | ✓ (direct, no OCR needed) |
| `SCREENSHOT_REGION` | User drags a region on screen | ✓ | Via OCR |
| `IMAGE_UPLOAD` | File picker, drag-and-drop (optional) | ✓ | Via OCR |

### CapturePayload contract

```typescript
interface CapturePayload {
  id: string;                        // UUID — tracks this payload through the pipeline
  type: CaptureType;
  image?: RawImageData;              // present for all image-type captures
  extractedText?: string;            // pre-extracted for TEXT_SELECTION; null for image types
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  metadata: CaptureMetadata;
}

type CaptureType =
  | "TEXT_SELECTION"
  | "SCREENSHOT_REGION"
  | "IMAGE_UPLOAD";

interface RawImageData {
  base64: string;                    // base64-encoded image content
  widthPx: number;
  heightPx: number;
}

interface CaptureMetadata {
  capturedAt: string;                // ISO 8601 timestamp
  sourceUrl?: string;                // populated if captured from a web page
  userLocale?: string;               // e.g. "vi-VN" — used to anchor language detection
  sourceApp?: string;                // "browser", "mobile", "desktop-app"
}
```

### Capture rules

- `image` is required for `SCREENSHOT_REGION` and `IMAGE_UPLOAD`
- `extractedText` is required for `TEXT_SELECTION`; the image fields are absent
- `id` is assigned by the capture layer before any processing begins
- The capture layer does NOT perform OCR or classification — it only assembles the payload and validates it is well-formed
- Maximum image size: 4 MB (after compression). Larger captures are rejected before reaching the understanding layer
- Images are held in-memory only; they are never written to the database or filesystem

---

## 2. Understanding Layer

The understanding layer converts a `CapturePayload` into a `CaptureUnderstanding` — a structured, semantic description of what was captured.

### Responsibilities

1. **OCR** — extract readable text from images
2. **Content classification** — identify what type of learning content this is
3. **Language detection** — detect the language(s) present
4. **Object detection** (future) — identify visual structures: diagram, table, equation, chart

### Out of scope for this layer

- Answering questions
- Deciding how to explain content
- Modifying learner state
- Writing to any database

### CaptureUnderstanding contract

```typescript
interface CaptureUnderstanding {
  captureId: string;                     // links back to CapturePayload.id
  extractedText: string | null;          // null if OCR fails or image has no readable text
  contentType: ContentType;             // classifier output
  detectedLanguages: string[];           // e.g. ["vi", "en"] — ordered by prevalence
  ocrConfidence: number | null;          // 0–1; null if no OCR was performed (text selection)
  detectedObjects?: DetectedObject[];    // future: diagram, table, equation markers
  classifierConfidence: number;          // 0–1 confidence in contentType assignment
}

type ContentType =
  | "MATH_PROBLEM"              // equation, numerical formula, arithmetic or algebraic problem
  | "VOCABULARY_WORD"           // single word or short phrase (≤ 3 words)
  | "TEXT_PARAGRAPH"            // prose — textbook, article, instruction text
  | "DIAGRAM"                   // chart, flow diagram, visual schematic
  | "TABLE"                     // tabular data with rows/columns
  | "CODE_SNIPPET"              // source code in any language
  | "MULTIPLE_CHOICE"           // question with labeled options (A/B/C/D)
  | "FILL_IN_BLANK"             // cloze or short-answer prompt
  | "MIXED"                     // multiple content types in the same capture
  | "UNKNOWN";                  // classifier could not determine type

interface DetectedObject {
  label: string;                         // e.g. "equation", "graph_axes", "table_header"
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
}
```

### OCR provider boundary

OCR is injected via an interface so the runtime implementation can be swapped:

```
OcrProvider interface
  ├── TesseractProvider   — runs locally in Node.js; no data leaves the server
  └── CloudOcrProvider    — Google Vision API / Azure OCR; faster, handles handwriting
```

Selection rule: local provider is the default. Cloud provider is only used when the admin has opted in AND the content is not privacy-sensitive (determined by user preference).

### Content classifier

The classifier receives `{ extractedText, ocrConfidence, metadata }` and returns `ContentType`.

Classification is **deterministic heuristics first**, AI fallback last:
1. If text matches `=|≠|∑|∫|\d+[+\-×÷]\d+` → `MATH_PROBLEM`
2. If text word count ≤ 3 and no punctuation → `VOCABULARY_WORD`
3. If text matches `^[A-D]\\.` option pattern (≥ 2 matches) → `MULTIPLE_CHOICE`
4. If text contains `___` or `[ ]` → `FILL_IN_BLANK`
5. If text word count ≥ 40 → `TEXT_PARAGRAPH`
6. If detected objects include "graph_axes" or "flow_arrow" → `DIAGRAM`
7. If detected objects include "table_header" → `TABLE`
8. If classified image is code-like (`function`, `{`, `;` density) → `CODE_SNIPPET`
9. Otherwise → AI fallback (single classification call, low cost)
10. If AI returns low confidence → `UNKNOWN`

---

## 3. Learning Context Layer

The learning context layer connects LEXI Lens to LEXI's existing intelligence systems.

### Purpose

The same captured content should generate different responses based on who is asking:

```
Content: "The present perfect tense expresses..."

Beginner learner who has never practiced this topic:
  → "Present perfect is used to describe actions that happened at some unspecified time
     before now. Example: I have eaten sushi. [more examples, simple language]"

Advanced learner who has practiced this but keeps making errors:
  → "You've seen this before — your recent errors suggest confusion between present perfect
     and simple past. The key: use present perfect when the exact time is unspecified or
     irrelevant. Compare: 'I have visited Paris' vs 'I visited Paris last year.'"
```

Context does NOT change what the content is. It changes how the AI responds to it.

### LensLearningContext contract

```typescript
interface LensLearningContext {
  learnerId: string | "anonymous";

  // All fields below are optional.
  // Lens works without any of them — context layer is skipped for anonymous users.

  // From StudentLearningProfile / learnerModel (M5.x)
  knowledgeState?: KnowledgeState;
  performanceState?: PerformanceState;
  preferenceState?: LearningPreferenceState;
  problemSolvingState?: ProblemSolvingState;
  activeWeaknesses?: ActiveWeakness[];

  // Derived signals — computed by contextBuilder, used to build the AI prompt
  depthHint: DepthHint;                       // derived from performanceState
  languagePreference: "vi" | "en" | "vi_en"; // derived from preferenceState; default "vi_en"
  topicFamiliarity?: TopicFamiliarity;        // if content topic matches a known KnowledgeState topic
}

type DepthHint =
  | "BEGINNER"       // accuracyTrend: DECLINING, low attempt count, or no data
  | "INTERMEDIATE"   // STABLE trend, moderate attempt count
  | "ADVANCED";      // IMPROVING trend, high attempt count, several MASTERED topics

type TopicFamiliarity =
  | "FIRST_ENCOUNTER"   // topic not found in masteryProfiles or activeWeaknesses
  | "SEEN_BEFORE"       // topic in masteryProfiles with low mastery
  | "PRACTICED"         // topic in masteryProfiles with medium mastery
  | "MASTERED"          // topic in masteryProfiles with high mastery / MASTERED_TOPIC signal
  | "STRUGGLING";       // topic is in activeWeaknesses with RECURRING signal
```

### How context is assembled

`contextBuilder.ts` receives a `StudentLearningProfile` and returns `LensLearningContext`:

```
StudentLearningProfile.learnerModel.performanceState.accuracyTrend
  → "IMPROVING"  → depthHint: "ADVANCED"
  → "STABLE"     → depthHint: "INTERMEDIATE"
  → "DECLINING"  → depthHint: "BEGINNER"
  → no data      → depthHint: "INTERMEDIATE" (safe neutral default)

StudentLearningProfile.learnerModel.preferenceState.languagePreference.value
  → matches "vi" / "en" / "vi_en"
  → default: "vi_en" (mixed Vietnamese and English — LEXI's primary audience)

If topic extracted from CaptureUnderstanding is identifiable:
  StudentLearningProfile.learnerModel.knowledgeState.masteredTopics.includes(topic)
    → "MASTERED"
  StudentLearningProfile.activeWeaknesses.some(w => w.topic === topic && w.signal === "RECURRING")
    → "STRUGGLING"
  (etc.)
```

### Anonymous mode

LEXI Lens operates without authentication. If the user is not signed in, context layer is bypassed:
- `learnerId: "anonymous"`
- `depthHint: "INTERMEDIATE"` (safe default)
- `languagePreference: "vi_en"` (LEXI's default audience)
- All profile fields: absent

---

## 4. AI Reasoning Layer

The AI reasoning layer assembles a `LensRequest`, calls the existing `AIProvider`, and parses the response into a typed `LensResponse`.

### Key rule

This layer reuses `AIProvider` exactly as defined. It does not define a new AI client, does not hardcode a provider, and does not bypass the provider abstraction. The same mock/claude/gemini injection that Phase 4 uses applies here.

### LensRequest contract

```typescript
interface LensRequest {
  id: string;                            // UUID — same as CapturePayload.id
  understanding: CaptureUnderstanding;
  context: LensLearningContext;
  mode: InteractionMode;
  followUpText?: string;                 // learner's typed clarification or follow-up question
  sessionId?: string;                    // for multi-turn continuity within one Lens session
}

type InteractionMode =
  | "EXPLAIN"
  | "SOLVE"
  | "HINT"
  | "TRANSLATE"
  | "SUMMARIZE"
  | "PRACTICE";
```

### LensResponse contract

```typescript
interface LensResponse {
  requestId: string;                     // echoes LensRequest.id
  mode: InteractionMode;

  // Mode-specific fields — at most one primary payload is populated per response
  explanation?: string;                  // EXPLAIN, TRANSLATE (word sense)
  steps?: LensStep[];                    // SOLVE — numbered reasoning steps
  hints?: LensHint[];                    // HINT — ordered from least to most revealing
  translation?: TranslationResult;       // TRANSLATE
  summary?: SummaryResult;              // SUMMARIZE
  practiceQuestion?: LensPracticeQuestion; // PRACTICE

  // Always present
  relatedTopics: string[];               // topic strings the content touches
  confidence: number;                    // 0–1, AI's self-reported confidence
  flags: LensFlag[];                     // warnings or informational notes
}

interface LensStep {
  stepNumber: number;
  instruction: string;
  reasoning?: string;                    // "why this step"
}

interface LensHint {
  level: 1 | 2 | 3;                     // 1 = gentle direction; 2 = approach; 3 = near-answer
  text: string;
}

interface TranslationResult {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translated: string;
  pronunciation?: string;               // phonetic (for vocabulary in VOCABULARY_WORD mode)
  partOfSpeech?: string;               // "noun", "verb", "adjective", etc.
  exampleSentences?: string[];         // 2–3 usage examples in context
  commonCollocations?: string[];       // for vocabulary: common word pairs
}

interface SummaryResult {
  keyPoints: string[];                  // bullet-point list
  conceptCount: number;                 // how many distinct concepts identified
}

interface LensPracticeQuestion {
  promptText: string;
  options?: { label: "A" | "B" | "C" | "D"; text: string }[];
  correctOption?: "A" | "B" | "C" | "D";
  explanation: string;
  ephemeral: true;                      // this question MUST NOT be written to the Question Bank without human review
}

type LensFlag =
  | "OCR_CONFIDENCE_LOW"               // OCR was < 0.7; text may be inaccurate
  | "CONTENT_TYPE_UNCERTAIN"           // classifierConfidence < 0.6
  | "PRACTICE_NOT_PERSISTED"           // reminder that LensPracticeQuestion is ephemeral
  | "LANGUAGE_MISMATCH"               // detected language differs from learner preference
  | "ANONYMOUS_NO_PERSONALIZATION"     // response is not personalized (anonymous mode)
  | "IMAGE_QUALITY_LOW";              // image too blurry or small for reliable analysis
```

### Prompt construction

`promptBuilder.ts` assembles the AI system prompt from three inputs:
1. The interaction mode → selects the mode prompt template
2. `CaptureUnderstanding` → provides the content (extracted text, content type)
3. `LensLearningContext` → provides depth hint, language preference, topic familiarity

Prompt construction is a pure function: `buildPrompt(mode, understanding, context) → string`. No AI calls, no DB access. This makes it fully testable.

The prompt format follows the same system-prompt pattern already used in `normalizationCore.ts`.

---

## 5. Interaction Modes

Each mode defines: **what the learner wants**, **what the AI must produce**, **what the AI must not do**.

---

### EXPLAIN mode

**Learner intent:** "I don't understand this. Explain it to me."

**Input:** any `ContentType`

**Output:** `explanation` (string) + `relatedTopics` + optional `examples`

**AI contract:**
- Adapt explanation depth to `depthHint`:
  - BEGINNER → simple language, concrete examples, avoid jargon
  - INTERMEDIATE → normal explanation with one example
  - ADVANCED → assume prior knowledge; focus on nuance, edge cases
- Respond in `languagePreference` (vi / en / vi_en)
- If `topicFamiliarity` is STRUGGLING → acknowledge the difficulty, offer a different angle
- Never ask the learner to look it up themselves

---

### SOLVE mode

**Learner intent:** "Help me solve this problem."

**Input:** `MATH_PROBLEM`, `MULTIPLE_CHOICE`, `FILL_IN_BLANK`

**Output:** `steps[]` — numbered step-by-step solution with reasoning

**AI contract:**
- Always show steps; never return only the final answer
- Each step includes `instruction` (what to do) and `reasoning` (why)
- If content type is `MULTIPLE_CHOICE`, explain why the correct option is correct AND why each distractor is wrong
- If `depthHint` is BEGINNER → use simpler notation, define terms
- If `depthHint` is ADVANCED → use concise notation, skip obvious steps

---

### HINT mode

**Learner intent:** "I want to try to solve this myself. Just give me a nudge."

**Input:** any question type

**Output:** `hints[]` — three progressive hints, ordered from least to most revealing

**AI contract:**
- Hint 1 → direction only: "Think about what [concept] means in this context."
- Hint 2 → approach: "Try applying [technique]. What happens when you [action]?"
- Hint 3 → near-answer: "The answer involves [key insight]. What would you get if you [concrete step]?"
- Never reveal the final answer in any hint
- The learner controls how many hints they see — AI returns all three, UI reveals progressively

---

### TRANSLATE mode

**Learner intent:** "What does this word/sentence mean in my language?"

**Input:** `VOCABULARY_WORD`, `TEXT_PARAGRAPH`

**Output:** `translation` (TranslationResult)

**AI contract:**
- For `VOCABULARY_WORD`: provide translation, pronunciation, part of speech, 3 example sentences, 2–3 common collocations
- For `TEXT_PARAGRAPH`: provide full translation, then identify the 2–3 most important vocabulary items within it
- Always provide both languages side by side (source + translated)
- Pronunciation uses a simple phonetic representation, not IPA, unless the learner's level is ADVANCED

---

### SUMMARIZE mode

**Learner intent:** "Too long. Give me the key points."

**Input:** `TEXT_PARAGRAPH`, `DIAGRAM`, `TABLE`

**Output:** `summary` (SummaryResult) with `keyPoints[]`

**AI contract:**
- Return 3–7 key points as bullet items
- Do not include framing language ("Here are the key points:") — return the points directly
- For `DIAGRAM` or `TABLE` content: describe what the visual represents, then list the key data points
- Length of each point: one sentence maximum

---

### PRACTICE mode

**Learner intent:** "Generate a question from this content so I can test myself."

**Input:** any `ContentType`

**Output:** `practiceQuestion` (LensPracticeQuestion)

**AI contract:**
- Generate one multiple-choice or fill-in-blank question based on the captured content
- The question must test understanding of the content, not just recall of wording
- Include `correctOption` and a full `explanation` of why the answer is correct
- Always set `ephemeral: true` — the response is explicit that this question is NOT persisted
- The generated question may be submitted to the human review pipeline (M4.3) by an admin, but this is never automatic
- If `topicFamiliarity` is MASTERED → generate a harder/more nuanced question
- If `topicFamiliarity` is FIRST_ENCOUNTER → generate a foundational comprehension question

**Important:** PRACTICE mode never writes to the Question Bank. It returns an ephemeral `LensPracticeQuestion` object. If the admin wants to persist it, they must run it through the existing `approveDraft()` path with human review.

---

## 6. Full Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  USER                                                        │
│  selects content: screenshot / upload / camera / text       │
└─────────────────────────┬───────────────────────────────────┘
                          │ raw input
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  CAPTURE LAYER          lib/services/lens-ai/capture/       │
│                                                             │
│  • Assign id (UUID)                                         │
│  • Detect input type                                        │
│  • Validate size / format                                   │
│  • Assemble CapturePayload                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ CapturePayload
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  UNDERSTANDING LAYER    lib/services/lens-ai/ocr/           │
│                         lib/services/lens-ai/vision/        │
│                                                             │
│  If image:                                                  │
│    • Run OCR → extractedText                                │
│    • Run content classifier → contentType                   │
│  If text selection:                                         │
│    • Use extractedText directly                             │
│    • Run content classifier → contentType                   │
│                                                             │
│  Output: CaptureUnderstanding                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ CaptureUnderstanding
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  LEARNING CONTEXT LAYER lib/services/lens-ai/context/       │
│                                                             │
│  If authenticated + opted in:                               │
│    • Fetch StudentLearningProfile (via existing service)    │
│    • Derive depthHint from performanceState                 │
│    • Derive languagePreference from preferenceState         │
│    • Match topic to knowledgeState / activeWeaknesses       │
│  Else:                                                      │
│    • LensLearningContext with anonymous defaults            │
│                                                             │
│  Output: LensLearningContext                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ CaptureUnderstanding + LensLearningContext
                          │ + InteractionMode (chosen by user)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  AI REASONING LAYER     lib/services/lens-ai/assistant/     │
│                                                             │
│  • Build LensRequest                                        │
│  • Select mode prompt template                              │
│  • Build system prompt (pure function, no AI calls)         │
│  • Call AIProvider.generateResponse()  ← existing contract  │
│  • Parse and validate AI response                           │
│  • Attach flags (OCR_CONFIDENCE_LOW, etc.)                  │
│                                                             │
│  Output: LensResponse                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ LensResponse
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER               app/(app)/capture/                  │
│                                                             │
│  • Render response by mode                                  │
│  • Show flags / warnings                                    │
│  • Offer mode switcher (learner can re-request as HINT      │
│    after seeing EXPLAIN, etc.)                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ (optional — if topic match found)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  SIGNAL LOG             (future — Phase 7.4)                │
│                                                             │
│  If content matches a topic in activeWeaknesses:            │
│    • Log "learner sought help on [topic]"                   │
│    • Increments helpSeeking signal in M5.4 (advisory)       │
│    • Does NOT modify mastery scores or question bank        │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Module Structure

```
lib/services/lens-ai/
├── capture/
│   ├── captureTypes.ts          CapturePayload, CaptureType, RawImageData, CaptureMetadata
│   └── captureValidator.ts      validates size, format, required fields; pure function
│
├── ocr/
│   ├── ocrTypes.ts              OcrResult, OcrProvider interface
│   ├── ocrService.ts            orchestrates OCR provider; selects local vs cloud
│   └── providers/
│       ├── tesseractProvider.ts local OCR — Node.js, no external calls
│       └── cloudOcrProvider.ts  cloud OCR — injectable, requires opt-in
│
├── vision/
│   ├── visionTypes.ts           DetectedObject, ContentType
│   ├── contentClassifier.ts     heuristic + AI fallback classification; pure function for heuristics
│   └── visionService.ts         orchestrates OCR output → contentType assignment
│
├── context/
│   ├── contextTypes.ts          LensLearningContext, DepthHint, TopicFamiliarity
│   └── contextBuilder.ts        StudentLearningProfile → LensLearningContext; pure function
│
├── assistant/
│   ├── lensTypes.ts             LensRequest, LensResponse, InteractionMode, all sub-types
│   ├── promptBuilder.ts         pure: (mode, understanding, context) → system prompt string
│   ├── responseParser.ts        pure: AI raw output → LensResponse with flags
│   ├── lensAssistant.ts         orchestrator: LensRequest → AIProvider → LensResponse
│   └── modes/
│       ├── explainMode.ts       EXPLAIN prompt template + depth variants
│       ├── solveMode.ts         SOLVE prompt template + step parser
│       ├── hintMode.ts          HINT prompt template + 3-level structure
│       ├── translateMode.ts     TRANSLATE prompt template + vocabulary expansion
│       ├── summarizeMode.ts     SUMMARIZE prompt template + key-point extractor
│       └── practiceMode.ts      PRACTICE prompt template + ephemeral question builder
│
└── index.ts                     public surface: captureAndAssist(payload, mode, userId?)
                                 Returns: Promise<LensResponse>
```

### Public API surface

```typescript
// lib/services/lens-ai/index.ts

export async function captureAndAssist(
  payload: CapturePayload,
  mode: InteractionMode,
  userId?: string
): Promise<LensResponse>
```

This is the only function callers need. The pipeline (understand → context → assist) is internal to the service.

---

## 8. Architecture Rules

### LEXI Lens MUST reuse

| Existing system | How Lens uses it |
|---|---|
| `AIProvider` (`lib/ai/`) | All AI calls go through the provider interface. No direct API calls. |
| `StudentLearningProfile` | Context layer reads it to build `LensLearningContext`. Read-only. |
| `KnowledgeState`, `PerformanceState` | Extracted from `learnerModel` inside the existing profile. |
| `LearningPreferenceState` | Used to derive `languagePreference` and `depthHint`. |
| `ActiveWeakness[]` | Used to detect `topicFamiliarity: "STRUGGLING"`. |
| OCR stub in `extractor.ts` (M3.x) | Phase 7.2 replaces the stub with a real implementation that both systems share. |

### LEXI Lens MUST NOT

| Prohibited action | Why |
|---|---|
| Create a new learner profile system | `StudentLearningProfile` is the single source of truth |
| Write directly to the Question Bank | Question creation requires human review via `approveDraft()` |
| Bypass the AI provider abstraction | Mock mode must remain usable for tests |
| Store raw images in the database | Images are ephemeral; only the extracted text and response may be stored |
| Run inference that duplicates existing engines | If content intelligence logic already exists, call it |
| Modify mastery scores in response to a Lens interaction | Mastery is computed from question attempts, not from Lens sessions |
| Auto-approve LensPracticeQuestion | Practice questions are ephemeral; only admin-approved questions enter the bank |

---

## 9. Security and Privacy

### Image handling

- Raw image data (`base64`) exists only in working memory during the pipeline execution
- Images are never written to the database, filesystem, or any persistent store
- If cloud OCR is enabled, the image is transmitted to the cloud provider over TLS; this is opt-in per user
- Image content is never attached to AI training datasets

### Text retention

| Retention scope | Default | Maximum |
|---|---|---|
| Extracted text (from OCR or selection) | Session only (in-memory) | 30 minutes, then purged |
| LensResponse (explanation, steps, etc.) | Session only | Until browser tab closed |
| Learner signal log (topic help-seeking) | Optional; off by default | Stored per M5.4 signal model |
| Practice question generated | Never persisted automatically | Ephemeral — lost at session end |

### User controls

Users can configure Lens behavior independently of each other:

| Control | Default | Effect |
|---|---|---|
| Lens AI enabled | On | Disabling prevents all Lens capture and AI calls |
| Profile integration | On | Disabling makes all requests anonymous (INTERMEDIATE depth) |
| Cloud OCR | Off | Opt-in only; required for handwriting or low-quality images |
| Session logging | Off | Opt-in; stores extracted text and response for review in profile history |
| Signal contribution | Off | Opt-in; allows topic help-seeking to increment learner signals |

### Authentication model

- LEXI Lens is available to anonymous users (unauth) with reduced personalization
- Authenticated users get personalized depth and language adaptation
- No authentication is required to use EXPLAIN, TRANSLATE, or SUMMARIZE modes
- PRACTICE mode is available to all users; practice questions are always ephemeral

---

## 10. Future Roadmap

### Phase 7.1 — Capture Pipeline

**Goal:** Establish the capture data contract and the text selection path.

**Scope:**
- `lib/services/lens-ai/capture/captureTypes.ts` — all types
- `lib/services/lens-ai/capture/captureValidator.ts` — validation logic
- `lib/services/lens-ai/context/contextTypes.ts` — context types
- Text selection capture path only (no OCR, no image upload)
- `captureAndAssist()` works for TEXT_SELECTION with anonymous context

**Does NOT include:** image capture, OCR, camera, cloud providers

**Independently shippable:** yes — text selection is useful on its own for explaining highlighted vocabulary or paragraphs

---

### Phase 7.2 — OCR and Vision Integration

**Goal:** Make image-based captures work.

**Scope:**
- Tesseract OCR provider (local, no external calls)
- `visionService.ts` and `contentClassifier.ts`
- Support for `SCREENSHOT_REGION` and `IMAGE_UPLOAD` capture types
- Content type classification (heuristic + AI fallback)
- Integration with Phase 3 OCR stub replacement (shared implementation)

**Does NOT include:** camera capture, cloud OCR, handwriting recognition

**Independently shippable:** yes — local OCR adds image support without external dependencies

---

### Phase 7.3 — AI Learning Assistant

**Goal:** Connect all layers to the AI provider. Full pipeline working.

**Scope:**
- `lib/services/lens-ai/assistant/` — all files
- All 6 interaction modes
- Prompt builder (pure functions, fully testable)
- Response parser with flag assignment
- `captureAndAssist()` complete for all capture types
- Anonymous context (no profile integration yet)
- UI route `app/(app)/capture/` — basic single-page Lens UI

**Does NOT include:** profile integration, signal logging, camera capture

**Independently shippable:** yes — a fully working anonymous visual learning assistant

---

### Phase 7.4 — Personalized Lens Responses

**Goal:** Connect context layer to StudentLearningProfile for personalized responses.

**Scope:**
- `lib/services/lens-ai/context/contextBuilder.ts` — full profile integration
- Depth hint derivation from PerformanceState
- Language preference from LearningPreferenceState
- Topic familiarity from KnowledgeState and activeWeaknesses
- Optional signal logging (helpSeeking increment in M5.4)
- Camera capture support (mobile path)
- Session history UI (if session logging is enabled)

**Independently shippable:** yes — adds personalization on top of Phase 7.3

---

## 11. Open Questions for Future Design

These are deferred — they require either implementation experience from 7.1–7.3 or stakeholder decisions:

1. **Multi-turn Lens sessions** — Should a learner be able to ask follow-up questions in the same Lens context, or is each capture independent? If multi-turn: what is the session state contract and how long does it live?

2. **Lens history in the learner profile** — Should Lens interactions (what topics a learner searched for help on) appear in the Learner Lens (Phase 6) profile view? If yes, what is the integration point between Phase 7.4 signal logging and Phase 6 `LensViewModel`?

3. **Cloud OCR eligibility rules** — What content types justify the privacy trade-off of cloud OCR? Screenshots of handwritten text are a candidate; screenshots of printed text are not.

4. **Practice question review flow** — If a learner generates a practice question via PRACTICE mode, should there be a one-click "suggest to admin" path that pre-fills the draft review queue? This is a UX question with M4.3 implications.

5. **Rate limiting and cost management** — Each Lens interaction calls an AI provider. What is the per-user request budget? Is there a caching strategy for identical captures?
