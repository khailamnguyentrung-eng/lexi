# LEXI Phase 6 — LEXI Lens
## Presentation Intelligence Design Review

_Created: 2026-06-29. Phase 5 (Learner Model Intelligence) complete. Phase 6 planning._
_Updated: 2026-06-30. M6.1–M6.4 implemented._

---

## 1. Phase 6 Goal

Phases 1–5 built intelligence **about the learner** (mastery, signals, preferences, problem-solving patterns). The learner and parent/teacher need to **understand what that intelligence means** and **what to do next**.

**Phase 6 is the lens — how LEXI presents learner understanding.**

Lens transforms Phase 5 intelligence into five coherent narrative views:
1. **Learner Summary** — snapshot of who this learner is right now
2. **Learning Insights** — key patterns and observations
3. **Strengths** — topics and skills where the learner is progressing
4. **Challenges** — topics that need attention
5. **Recommended Actions** — what to practice next, in priority order

Plus supporting trends and progress indicators.

### Key principle

**Lens does NOT create new intelligence.** It only transforms and narrates existing intelligence. No new inference rules, no new DB queries, no AI classification.

---

## 2. Data Sources (Phase 5 + earlier)

### StudentLearningProfile v3 — unified snapshot

```
StudentLearningProfile {
  readiness: ReadinessResult | null          (from M1.2)
  masterySummary: MasterySummary             (from M1.1)
  skillSnapshot: SkillSnapshot[]             (from M1.1)
  learningTrend: LearningTrend               (from M1.1)
  improvingTopics: TopicMasteryProfile[]     (from M1.1)
  activeWeaknesses: ActiveWeakness[]         (from M1.2)
  recommendations: PracticeRecommendation[]  (from M1.4)
  nextSessionNumber: number | null           (from M2.3)
  nextSessionTitle: string | null            (from M2.3)
  nextSessionObjective: string | null        (from M2.3)
  behaviorProfile: BehaviorProfile           (from M2.2)
  currentStreak: number                      (from M2.1)
  topSignal: LearningSignal | null           (from M2.4)
  goalCountdown: GoalCountdown | null        (from M2.5)
  
  // Phase 5 additions (M5.5)
  learnerModel: LearnerModel {
    knowledgeState: KnowledgeState           (M5.1)
    performanceState: PerformanceState       (M5.1)
    learningBehaviorState: LearningBehaviorState   (M5.2)
    learningPreferenceState: LearningPreferenceState (M5.3)
    problemSolvingState: ProblemSolvingState (M5.4)
    assembledAt: string
  }
}
```

### Confidence inheritance

Every piece of intelligence carries a confidence tier:

- **OBSERVED** — early pattern (low data volume)
- **EMERGING** — moderate evidence
- **CONFIRMED** — strong pattern (high data volume)

Lens must preserve and communicate these tiers so the learner knows "this is a reliable insight" vs. "this is preliminary."

### Type hierarchy

```
SignalSeverity: CRITICAL | HIGH | MEDIUM | LOW
SignalConfidence: HIGH | MEDIUM | LOW
RecommendationConfidence: LOW | MEDIUM | HIGH
ConfidenceTier: OBSERVED | EMERGING | CONFIRMED
```

---

## 3. Five Presentation Views

### 3.1 Learner Summary

**Purpose:** Communicate who this learner is in one coherent paragraph.

**Data sources:**
- `learnerModel.knowledgeState.{masteredConcepts, developingConcepts, weakConcepts, topicCount}`
- `learnerModel.learningBehaviorState.engagementObservation.{engagementLevel, recentMoodContext}`
- `learnerModel.problemSolvingState.{retryPattern.value, helpSeeking.value, errorCorrection.value}`
- `masterySummary.{masteredTopics, needsReviewTopics}`
- `learningTrend`
- `currentStreak`

**Transformation rules:**

1. **Opening statement:** Combine engagementLevel + topic count + trend
   - "HIGHLY_ACTIVE learner with strong progress across 12 grammar topics."
   - "OCCASIONAL learner rebuilding foundation in present-perfect tense."
   - "INACTIVE learner with significant gaps in vocabulary."

2. **Problem-solving pattern:** Use problemSolvingState dimension values (already behavioral, not trait-based)
   - "Learner is a FREQUENT_RETRIER, recovering quickly from mistakes."
   - "Learner rarely revisits after errors (RARELY_RETRIES) but shows GRADUAL_RECOVERY when attempting."

3. **Knowledge landscape:** Reference KnowledgeState mastered/developing/weak counts
   - "Has mastered 5 topics, with 4 currently improving."
   - "No mastered topics yet; all 8 are in active review."

4. **Engagement context:** Optional mood context if available
   - "Recent sessions show POSITIVE mood context."
   - "No mood data yet."

**Confidence handling:**

- Use confidence tier only as an internal filter: if KnowledgeState confidence < EMERGING, say "still building a picture of your progress" instead of specific counts
- Suppress learner summary entirely if topicCount < 1 (no meaningful profile yet)

**Output shape:**

```typescript
interface LearnerSummary {
  narrative: string;        // full summary paragraph
  engagementLevel: string;  // HIGHLY_ACTIVE | ACTIVE | OCCASIONAL | INACTIVE
  masteredCount: number;
  developingCount: number;
  weakCount: number;
  streakDays: number;
  topicCount: number;
  trendIndicator: "PROGRESSING" | "STABLE" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA";
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH"; // Derived from knowledgeState.confidenceTier
}
```

---

### 3.2 Learning Insights

**Purpose:** Surface the top 1–3 observations that explain the current learning picture.

**Data sources:**
- `topSignal` (LearningSignal, if present)
- `learnerModel.performanceState.{accuracyTrend, overallAccuracy, consistencyProfile}`
- `learnerModel.learningBehaviorState.paceObservation.paceProfile`
- `learnerModel.problemSolvingState.feedbackRecovery.value`
- `readiness` (session-specific readiness band)
- `activeWeaknesses` (top 2–3 by priority)

**Transformation rules:**

1. **Primary signal (if exists):** Rewrite the LearningSignal in plain language
   - "You just mastered present simple tense! This is a big milestone."
   - "Present perfect is showing a recurring pattern. You've reviewed it 4 times but still making mistakes."
   - "You're at risk of forgetting prepositions — these haven't been reviewed in 7 days."
   - "You're on a 10-day streak! Keep it up."

2. **Accuracy trajectory:** Combine accuracyTrend + overallAccuracy + readiness
   - "Your accuracy is improving (from 58% to 72% across 40 attempts). Great progress!"
   - "You're holding steady at 65% accuracy — good foundation to build on."
   - "Your accuracy has been declining. Let's focus on fundamentals."
   - "Too early to measure — get a few more attempts in."

3. **Consistency observation:** If consistencyProfile shows variance
   - "Your performance varies session to session (VARIABLE). Some days you're sharper than others."
   - "Very consistent performance (CONSISTENT). You're reliable."
   - "Erratic results (ERRATIC). Something is affecting your focus."

4. **Recovery capability:** From feedbackRecovery value
   - "When you make a mistake, you usually correct it immediately (RECOVERS_QUICKLY)."
   - "You recover from errors slowly (SLOW_RECOVERY) — consider reviewing the explanation."

**Confidence handling:**

- If performanceState.confidenceTier = OBSERVED: prefix with "Early observation:"
- If PerformanceState.confidenceTier = CONFIRMED: confidence is implicit (high data volume)
- If readiness is null: omit readiness-specific insights

**Output shape:**

```typescript
interface LearningInsight {
  type: "PRIMARY_SIGNAL" | "ACCURACY_TREND" | "CONSISTENCY" | "RECOVERY";
  narrative: string;
  evidence?: {
    signalType?: string;          // if PRIMARY_SIGNAL
    accuracyChange?: number;      // e.g., +14 for 58→72%
    attempts?: number;            // total attempts for this measurement
    streakDays?: number;          // if streak milestone
  };
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

interface LearningInsights {
  insights: LearningInsight[]; // max 3, priority-ordered
  generatedAt: string;
}
```

---

### 3.3 Strengths

**Purpose:** Celebrate progress and show what's working.

**Data sources:**
- `learnerModel.knowledgeState.{masteredConcepts, developingConcepts}`
- `learnerModel.performanceState.skillPerformance[]`
- `learnerModel.learningBehaviorState.paceObservation.paceProfile` (if ACCELERATING or STRONG)
- `improvingTopics` (from masterySummary)

**Transformation rules:**

1. **Mastered topics** (highest achievement tier)
   - List all topics at MASTERED state
   - Label as "You've mastered..." or "Complete:"
   - Cap at 5; if more, show count

2. **Developing topics** (momentum)
   - Topics at IMPROVING or STABLE state
   - Show as "Making progress on:" with count
   - Optional: highlight the topic with most momentum (IMPROVING > STABLE)

3. **Strong skills** (from skillPerformance.tier = "STRONG", >= 75%)
   - "Strong in {skillLabel}: {percentage}%"
   - Max 3 skills

4. **Pacing strength** (if ACCELERATING)
   - "You're pacing faster — completing more in less time."

**Confidence handling:**

- Omit mastered topics if KnowledgeState.confidenceTier = OBSERVED (not enough evidence yet)
- Always show developing topics; they're the main signal of progress
- Skill strengths inherit PerformanceState.confidenceTier; only show if EMERGING or CONFIRMED

**Output shape:**

```typescript
interface Strength {
  type: "MASTERED_TOPIC" | "DEVELOPING_TOPIC" | "STRONG_SKILL" | "PACING_MOMENTUM";
  label: string;
  detail?: string;
  percentageOrCount?: number; // for skills or topic count
}

interface Strengths {
  strengths: Strength[];  // max 8 items
  generatedAt: string;
  confidenceNote?: string; // "These are early observations" if OBSERVED
}
```

---

### 3.4 Challenges

**Purpose:** Identify what needs attention and why.

**Data sources:**
- `activeWeaknesses[]` (capped at 5, priority-ordered by remedial flag + occurrence count)
- `learnerModel.performanceState.skillPerformance[]` where tier = "WEAK"
- `learnerModel.problemSolvingState.helpSeeking.value` (if LOW_ENGAGEMENT)
- `learnerModel.problemSolvingState.errorCorrection.value` (if ERRORS_PERSISTING)

**Transformation rules:**

1. **Active weakness topics** (from notebook)
   - For each: topic label + signal + dueCount
   - Signal determines description:
     - RECURRING: "You've reviewed this but mistakes continue."
     - IMPROVING: "Still working on this — recent progress shows improvement."
     - STABLE: "No progress yet — needs fresh approach."
     - NO_DATA: (omit; not a challenge if no recent attempts)
   - If dueCount > 0: "Due for review now."
   - If isRemedialFlagged: "You've flagged this for extra help."
   - Cap at 5

2. **Weak skills** (from skillPerformance.tier = "WEAK", < 50%)
   - "Weak in {skillLabel}: {percentage}%"
   - Max 3 skills; include 1–2 active weakness topics related to each

3. **Help-seeking gap** (if LOW_ENGAGEMENT in helpSeeking)
   - "You haven't flagged any topics for extra help, even though {N} topics show recurring mistakes."
   - Actionable: "Try reviewing the error notebook and marking topics for remediation."

4. **Error pattern** (if ERRORS_PERSISTING)
   - "Recorded errors are not decreasing. You're reviewing but not resolving the mistakes."
   - Context: "This usually means the explanation needs to be different, or the topic needs more examples."

**Confidence handling:**

- Use ActiveWeakness.signal and masteryState to determine confidence in ordering
- If ProblemSolvingState.confidenceTier = OBSERVED: prefix with "Early sign:"
- Omit weakness if signal = IMPROVED (belongs in Strengths instead)

**Output shape:**

```typescript
interface Challenge {
  type: "ACTIVE_WEAKNESS" | "WEAK_SKILL" | "HELP_SEEKING_GAP" | "ERROR_PATTERN";
  label: string;
  reason: string;
  signal?: string;         // RECURRING | IMPROVING | STABLE
  dueNow?: boolean;
  relatedTopics?: string[]; // for weak skills
  actionHint?: string;
}

interface Challenges {
  challenges: Challenge[]; // max 7 items
  generatedAt: string;
}
```

---

### 3.5 Recommended Actions

**Purpose:** Tell the learner exactly what to do next, in priority order.

**Data sources:**
- `recommendations[]` (up to 4, already priority-ordered from M1.4)
- `learnerModel.learningPreferenceState` (for practice mode hints)
- `nextSessionNumber` + `nextSessionTitle` (curriculum flow)

**Transformation rules:**

1. **Top 4 recommendations:** Rewrite each `PracticeRecommendation` in plain language
   - Priority 1 (RECURRING_MISTAKE): "Review {topic}: You've practiced this but mistakes continue. {questionCount} questions available."
   - Priority 2 (DUE_REVIEW): "Review {topic}: It's been {daysAgo} days since last review. {questionCount} questions available."
   - Priority 3 (WEAKNESS_SIGNAL): "Practice {topic}: Your recent accuracy was low ({accuracy}%). {questionCount} questions available."
   - Priority 4 (CURRICULUM_PROGRESS): "Advance to Session {N}: {title}. You've finished the current content."

2. **Confidence context:** Show confidence icon or label
   - HIGH: solid recommendation
   - MEDIUM: reasonable next step
   - LOW: optional if you have time

3. **Preference-aware hints (optional):**
   - From LearningPreferenceState: if practiceMode = "EXAM_SIMULATION", suggest "Try a full-length exam simulation" for P4 actions
   - If sessionDuration = "SHORT", suggest "Quick 5-question drill on {topic}" instead of full practice set

4. **Current streak mention (if milestone):**
   - Include in action context if currentStreak >= 7: "Keep your {N}-day streak going!"

**Confidence handling:**

- Inherit confidence from PracticeRecommendation.confidence
- Filter out recommendations with confidence = LOW if total < 2 (always show at least the top 2, even if LOW)
- Add disclaimer if any recommendation has confidence = LOW: "These are lower-priority suggestions if the above are done."

**Output shape:**

```typescript
interface RecommendedAction {
  priority: 1 | 2 | 3 | 4;
  topic: string;
  label: string;
  reason: string;
  suggestedAction: string; // REVIEW_NOTEBOOK | PRACTICE_TOPIC | ADVANCE_SESSION
  questionCount?: number;  // if practice action
  sessionNumber?: number;  // if curriculum action
  sessionTitle?: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

interface RecommendedActions {
  actions: RecommendedAction[]; // max 4
  nextSessionReady: boolean;    // nextSessionNumber is not null
  streakContext?: string;       // motivational message if currentStreak >= 7
  generatedAt: string;
}
```

---

## 4. Supporting Views

### 4.1 Progress Trends

**Purpose:** Show how the learner is moving over time (sessions or attempts).

**Data sources:**
- `performanceState.accuracyTrend` + `overallAccuracy`
- `learningTrend`
- `currentStreak`
- `masterySummary.byState` (topic counts over time — requires external tracking)

**Transformation rules:**

1. **Accuracy trend (3 states):**
   - IMPROVING: "Your accuracy is trending up"
   - STABLE: "Your accuracy is holding steady"
   - DECLINING: "Your accuracy is trending down"
   - INSUFFICIENT_DATA: "Need more attempts to measure progress"

2. **Topic progress:**
   - Count of MASTERED + IMPROVING + STABLE as "progress"
   - Percentage of total: "{X}% of your topics are progressing"

3. **Streak status:**
   - "{currentStreak} consecutive days of active practice"
   - If streak = 0: "No active streak — next practice will start a new one"
   - If streak >= 14: Emoji or badge: "🔥 Long streak! Keep it up."

4. **Goal countdown (if set):**
   - "{daysRemaining} days until your goal date"
   - If daysRemaining <= 0: "Goal date has passed"
   - If daysRemaining <= 7: Badge or highlight for urgency

**Confidence handling:**

- Always show streak (it's factual)
- Always show goal countdown (it's factual)
- Accuracy trend confidence inherited from PerformanceState.confidenceTier
- If topicCount < 3: don't claim topic progress — too early

**Output shape:**

```typescript
interface ProgressTrend {
  accuracyTrend: "IMPROVING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";
  currentAccuracy: number; // 0–100
  topicsProgressing: number;
  totalTopics: number;
  streakDays: number;
  goalDaysRemaining?: number;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
}
```

### 4.2 Skill Breakdown

**Purpose:** Show per-skill accuracy at a glance.

**Data sources:**
- `skillSnapshot[]` (from M1.1)
- `performanceState.skillPerformance[]` (with tier classification)

**Transformation rules:**

1. **Combine skillSnapshot with skillPerformance tiers**
2. **Sort by percentage descending**
3. **Color code by tier:** STRONG (green) / DEVELOPING (yellow) / WEAK (red)
4. **Show percentage and bar chart**

**Confidence handling:**

- Inherit PerformanceState.confidenceTier for all skills (they come from the same source)
- If < 5 attempts per skill: note "Early data" in skill detail

---

## 5. Confidence Handling Strategy

### 5.1 Mapping confidence tiers to communication

| ConfidenceTier | Presentation | Language |
|---|---|---|
| OBSERVED | Early data, preliminary | "This is still developing...", "Early signs show..." |
| EMERGING | Moderate evidence | "You're showing a pattern of...", "It looks like..." |
| CONFIRMED | Strong pattern | Direct statements, no hedging |

### 5.2 When to omit data

- Don't show mastered topics if KnowledgeState confidence = OBSERVED (too early)
- Don't show skill breakdown if PerformanceState confidence = OBSERVED (too few attempts)
- Always show learner summary unless topicCount = 0

### 5.3 Confidence icons (UI layer, design-only)

```
CONFIRMED:    ⬤⬤⬤ (3 dots)
EMERGING:     ⬜⬜◐ (2 full, 1 half)
OBSERVED:     ◯◯◯ (3 empty)
```

---

## 6. Architecture

### Service boundary

```
StudentLearningProfile v3 + LearnerModel
        ↓
LensTransformer (pure functions)
        ↓
LensView (typed output shape)
        ↓
UI Components (render + localization)
```

### LensTransformer functions (pure, no DB/AI)

```typescript
assembleLearnerSummary(profile: StudentLearningProfile): LearnerSummary
assembleLearningInsights(profile: StudentLearningProfile): LearningInsights
assembleStrengths(profile: StudentLearningProfile): Strengths
assembleChallenges(profile: StudentLearningProfile): Challenges
assembleRecommendedActions(profile: StudentLearningProfile): RecommendedActions
assembleProgressTrends(profile: StudentLearningProfile): ProgressTrend
assembleSkillBreakdown(profile: StudentLearningProfile): SkillPerformance[]
```

### Caller integration points

1. **Student dashboard:** Calls `getLearnerLensView(userId)` (service that fetches profile + transforms)
2. **Parent/teacher dashboard:** Calls same function, same Lens output; UI may add additional context or controls
3. **Session results:** After session completes, Lens refreshes top 1–2 insights and recommended actions

### No schema changes

Lens works entirely from existing StudentLearningProfile v3. No new Prisma models, no new DB fields.

---

## 7. Explicitly Out of Scope for Phase 6

- **Personality classification:** No "visual learner", "motivated student", "anxious test-taker" labels
- **AI summaries:** No LLM-generated narratives; all transformations are deterministic
- **Custom explanations:** Lens narrates facts, not causation ("you're improving" not "you studied hard")
- **Gamification:** No points, badges, or leaderboards in Lens (that's a later phase)
- **Student-initiated customization:** Lens output is fixed; filtering/customization happens in UI, not Lens
- **Multi-student analytics:** Lens is single-student only (parent/teacher views reuse Lens, no comparison)

---

## 8. Key Principles

1. **Confidence is transparent.** Every claim carries its confidence tier. Users know which insights are solid vs. preliminary.

2. **No hedging on strong patterns.** If confidence = CONFIRMED, the UI says "You've mastered" not "You might have mastered."

3. **Actionable framing.** Every insight ties to a next step. Challenges always suggest an action.

4. **Observable behavior only.** Lens describes what happened, not why. "You retried 8 times" not "You're persistent."

5. **Respect the Phase 5 boundaries.** Lens narrates KnowledgeState, PerformanceState, PreferenceState, ProblemSolvingState, and BehaviorState exactly as they are. No re-interpretation, no added inference.

---

## 9. Test Plan (Design Only)

Phase 6 will include `scripts/test-lens-transformers.mjs` with test cases for:

1. Empty profile → all views return "insufficient data" gracefully
2. Emerging learner → early observations, no mastered topics shown
3. Confirmed learner → full narrative with confidence
4. Multi-weakness scenario → challenges properly ordered and de-duplicated
5. Strength + challenge collision → strength takes priority for topics in both
6. Streak/goal context → included in recommended actions
7. Preference routing → if practiceMode = "EXAM_SIMULATION", suggested action reflects it
8. Determinism → same profile produces same Lens output

---

## 10. Implementation Order (Future Phases)

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| M6.1 | Lens Transformer Foundation | Pure functions, types, test suite | ✓ Done |
| M6.2 | Service Integration | `getLearnerLens()` service wrapping transformers | ✓ Done |
| M6.3 | Design System Foundation | Token system, three themes, ThemeProvider, base Lens components | ✓ Done |
| M6.4 | Learner Lens Experience | Full `/lens` page: 5 sections, theme switcher, responsive layout | ✓ Done |
| M6.4 | Parent/Teacher Lens | Multi-student view (reuses transformers) | Pending |

---

## 11. Implementation Notes

### M6.4 — Learner Lens Experience Prototype

Route: `/lens` — live in production build.

**Composition pattern:**
```
page.tsx (Server Component)
  getCurrentUser() → getLearnerLens(userId) → LensViewModel
  → <LensPageContent viewModel={vm} />       (Client Component)
       → <ThemeProvider>
            <ThemeSwitcher />                 ("use client", uses useTheme())
            <SummarySection summary={...} />  (5 sections, all data-props only)
            <InsightsSection insights={...} />
            <StrengthsSection strengths={...} />
            <ChallengesSection challenges={...} />
            <ActionsSection recommendations={...} />
         </ThemeProvider>
```

**Files created:**

| File | Purpose |
|---|---|
| `app/(app)/lens/page.tsx` | Server Component — fetches LensViewModel, renders client wrapper |
| `app/(app)/lens/LensPageContent.tsx` | Client Component — owns ThemeProvider, renders 5 sections |
| `components/lens/ThemeSwitcher.tsx` | Client Component — aria-pressed buttons, calls useTheme() |

**Files modified:**
- `app/(app)/layout.tsx` — added 🔍 Lens nav link

**Invariants:**
- `page.tsx` has zero direct imports from intelligence engines or learner state types
- `LensPageContent` accepts only `LensViewModel` as props — the service boundary holds at the page level
- No hardcoded colors anywhere in the page or its sub-sections; all colors via `var(--theme-*)`
- All five sections have explicit empty states (no crashes with empty arrays or zero counts)
- Responsive: `grid-cols-2 sm:grid-cols-4` for summary metrics; `grid-cols-1 sm:grid-cols-2` for strength cards

**Section → component mapping:**

| Section | Component |
|---|---|
| Learner Summary | `LensCard` + `ProgressCard` (4 metric tiles) |
| Learning Insights | `LensCard` + `InsightCard` (per insight) |
| Strengths | `LensCard` + `ProgressCard` (per strength item) |
| Challenges | `LensCard` + `ProgressCard` (per challenge, with signal → trend mapping) |
| Next Actions | `LensCard` (custom priority list with Link buttons) |

**60 tests** in `scripts/test-lens-ui-composition.mjs`.

---

### M6.3 — Design System Foundation

Token-based theme system. No hardcoded colors in any Lens component.

**Files created:**

| File | Purpose |
|---|---|
| `lib/ui/theme/tokens.ts` | `ThemeConfig` interface + all sub-interfaces (`ThemeColors`, `ThemeTypography`, `ThemeSpacing`, `ThemeRadius`, `ThemeShadows`, `ThemeMotion`) + `THEME_VAR_NAMES` constant (all 34 CSS variable name strings) |
| `lib/ui/theme/themes.ts` | `defaultTheme`, `calmTheme`, `focusTheme` + `themeToCssVars(theme)` (serialises to CSS custom property map) + `availableThemes[]` |
| `components/ui/ThemeProvider.tsx` | Client component: `ThemeProvider` (injects CSS vars as inline style on wrapper div, holds active theme state) + `useTheme()` hook |
| `components/lens/LensCard.tsx` | Generic Lens card wrapper — title, subtitle, children; all colors from `var(--theme-*)` |
| `components/lens/InsightCard.tsx` | Single `LearningInsight` display — type badge, confidence accent, narrative text; no intelligence logic |
| `components/lens/ProgressCard.tsx` | Metric with trend direction arrow; 4 trend states; colors from theme tokens |
| `components/lens/SectionHeader.tsx` | H1-level heading with optional subtitle and badge |

**Theme distinctness (not cosmetic copies):**
- `defaultTheme` — violet/purple; matches existing `globals.css` palette; existing pages are unaffected
- `calmTheme` — soft teal-blue; more spacing (`cardPadding: 2rem` vs `1.5rem`); larger radius; slower transitions
- `focusTheme` — high-contrast dark (`background: #0f172a`); indigo/amber accents; sharp radius (`card: 0.75rem`); faster transitions

**CSS variable injection pattern:** `ThemeProvider` calls `themeToCssVars(theme)` → applies result as `style={...}` on a wrapper `<div data-theme={theme.id}>`. CSS variable names follow `--theme-*` convention; all 34 tokens are injected. Components reference `var(--theme-card-bg, fallback)` — fallback values ensure correctness even outside `ThemeProvider`.

**Invariants:**
- No component contains hardcoded color values
- Themes affect visual experience only — no learning logic inside any theme file
- `defaultTheme` values mirror `globals.css :root` so switching from `null` → `defaultTheme` is invisible
- `themeToCssVars` is a pure function; same theme in → same CSS vars out

**78 tests** in `scripts/test-design-system.mjs`.

---

### M6.2 — Lens Service Contract

`lib/services/lens/lensService.ts` exposes two exports:

- `assembleLensViewModel(profile)` — pure orchestrator (no DB); calls all 5 Phase 6.1 transformers and returns `LensViewModel`. Exported separately for testing.
- `getLearnerLens(userId)` — async service entry point; calls `getStudentLearningProfile(userId)` then `assembleLensViewModel`. Single DB round-trip (inherited from StudentLearningProfile fetch).

Transformers are called in order (summary → insights → strengths → challenges → recommendations) and are **independent** — no transformer output is passed as input to another. All five read directly from the `StudentLearningProfile` argument.

**61 tests** in `scripts/test-lens-service.mjs` covering: LensViewModel shape, per-view delegation, empty profile graceful handling, output contract (confidenceTier + source on every item), determinism, and transformer independence.

---

### M6.1 — Files created

| File | Purpose |
|---|---|
| `lib/services/lens/types.ts` | Output contracts — all 5 view types + `LensViewModel` + confidence mapping utilities |
| `lib/services/lens/learnerSummary.ts` | `buildLearnerSummary(profile)` — engagement, trend, problem-solving, knowledge landscape |
| `lib/services/lens/learningInsights.ts` | `extractLearningInsights(profile)` — up to 3 insights, priority-ordered |
| `lib/services/lens/strengths.ts` | `deriveStrengths(profile)` — mastered topics, developing, strong skills |
| `lib/services/lens/challenges.ts` | `deriveChallenges(profile)` — active weaknesses, weak skills, help seeking, error pattern |
| `lib/services/lens/recommendations.ts` | `buildLensRecommendations(profile)` — transforms existing PracticeRecommendation[] only |
| `scripts/test-lexi-lens-foundation.mjs` | 127 tests across 19 sections |

### Invariants enforced

- Every output item carries `confidenceTier` (raw ConfidenceTier enum value) and `source` (field path in StudentLearningProfile).
- No new inference rules: Lens only reads and narrates values already computed by Phase 5 engines.
- No DB access, no AI calls, no schema changes.
- `buildLensRecommendations` transforms `profile.recommendations` only — does not create additional recommendations.
- `PaceProfile` has no `"ACCELERATING"` value in the current data model; pacing-momentum strength is deferred.

### Confidence language rules (implemented)

| ConfidenceTier | Language pattern |
|---|---|
| OBSERVED | "Early observation:", "Early sign:", "Still building a picture..." |
| EMERGING | "It looks like..." (for CONSISTENCY insight) |
| CONFIRMED | Direct statements, no hedging |

### Data suppression rules (implemented)

- `deriveStrengths`: mastered topics omitted when `knowledgeState.confidenceTier = OBSERVED`
- `deriveStrengths`: strong skills omitted when `performanceState.confidenceTier = OBSERVED`
- `extractLearningInsights`: CONSISTENCY insight suppressed when `performanceState.confidenceTier = OBSERVED`
- `buildLearnerSummary`: returns "No learning data yet" when `topicCount < 1`

---

_End of Phase 6 Learner Presentation Design Review._

_This design defines how LEXI will present learner understanding. No code, schema, or UI is included here — only the transformation rules and narrative patterns that will guide Phase 6 implementation._
