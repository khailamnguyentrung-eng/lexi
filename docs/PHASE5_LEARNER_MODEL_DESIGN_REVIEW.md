# LEXI Phase 5 — Learner Model Intelligence
## Design Review

_Created: 2026-06-29. Phase 4 (Content Intelligence) complete. Phase 5 planning._

---

## 1. Phase 5 Goal

Phases 1–2 built intelligence about *practice* (mastery, signals, adaptive recommendations) and *content* (coverage, validation, generation). Both are essential but focused on the external context.

**Phase 5 answers the core question: "Who is this learner?"**

Not from psychology or motivation inference — those are speculative and beyond our scope. Instead, from five observable dimensions of learning:

1. **Knowledge State** — Which topics/skills does this learner understand well? Where are the gaps?
2. **Performance State** — How consistently do they execute what they know? How stable is their accuracy?
3. **Learning Behavior** — How do they interact with the system? What patterns characterise their engagement?
4. **Learning Preference** — What conditions enable their best performance? (time of day, session length, question difficulty)
5. **Problem Solving Pattern** — How do they respond to errors? Do they retry, skip, or give up?

Each dimension is built from **observable learner actions** and produces a **read model snapshot** that informs recommendations, tutoring, and practice design — without ever making claims about intelligence, personality, motivation, or learning style.

---

## 2. Architecture Principles

### StudentLearningProfile is a snapshot, not a logic container.

The profile aggregates five learner model components into one coherent read model. It does NOT contain intelligence logic. All computation happens in pure engines that receive plain input and return plain output. The profile assembles and presents those results.

```
[Observable Data] → [Pure Engine Layer] → [Plain Output] → [StudentLearningProfile reads]
                                                              ↓
                                                     [Snapshot for UI/API]
```

### Confidence tiers guide reliability.

Every assertion about a learner is stamped with a confidence tier: `OBSERVED` (small sample, hypothesis), `EMERGING` (moderate evidence, repeating pattern), or `CONFIRMED` (stable across sufficient data). The UI uses this to choose tone ("might be", "often", "consistently").

### No AI-driven inference.

Phase 5 does NOT add new LLM calls to classify or infer learner traits. All logic is deterministic: thresholds, aggregation functions, and rule-based observation. Any future ML model for prediction (e.g. "predict performance on topic X") would be explicitly designed and tested — not baked into this phase.

### No psychological or motivational labels.

Phrases like "visual learner", "motivated student", "anxious test-taker" are out of scope. These require psychological expertise and rigorous validation we don't have. We observe behavior (spends 30s per question) and system state (mood entries show STRESSED majority) — but we never label the learner's character or psychology.

### Generalizability across learner types.

The design must serve novices (who need more scaffolding, clearer feedback) and advanced learners (who can handle abstract explanations, self-directed practice). Both should be represented in the model, not assumed away.

---

## 3. Knowledge State

### Purpose

"Which topics/skills does this learner understand well? Where are the gaps?"

Knowledge State answers the most fundamental question about learning. It enables practice recommendations (focus on weak topics), tutoring customization (explain weak concepts more deeply), and gap detection (what to generate questions for).

### Data sources

- **MasteryTracking** — mastery state per topic (MASTERED, NEEDS_REVIEW, NOT_ATTEMPTED, REVIEW_DUE)
- **ErrorNotebook** — errors grouped by topic; recurring patterns
- **SkillMatrix** — per-skill accuracy aggregated across all questions
- **DiagnosticTest** — initial baseline estimate (lower confidence)
- **SessionAnalytics** — recent performance on each topic (trending)

### Output shape

```typescript
interface KnowledgeState {
  topics: TopicKnowledgeSnapshot[];
  skills: SkillKnowledgeSnapshot[];
  masteredTopics: string[];         // topics in MASTERED state
  developingTopics: string[];        // topics with progress but not yet MASTERED
  insufficientDataTopics: string[];  // attempted < threshold
  knowledgeProfile: "BROAD" | "NARROW" | "EMERGING"; // see below
  gapDescription: string;            // human-readable summary
  confidenceTier: ConfidenceTier;
}

interface TopicKnowledgeSnapshot {
  topic: string;
  label: string;
  masteryState: MasteryState;
  accuracy: number;                  // % correct across all attempts, or null if < 5 attempts
  attemptCount: number;
  recentTrend: "IMPROVING" | "STABLE" | "DECLINING";
  errorPatterns: ErrorPattern[];     // top recurring mistakes
  confidenceTier: ConfidenceTier;
}

interface SkillKnowledgeSnapshot {
  skill: string;
  label: string;
  accuracy: number;                  // % correct across all questions tagged with this skill
  attemptCount: number;
  developingTopics: string[];        // topics within this skill that need work
  confidenceTier: ConfidenceTier;
}

type KnowledgeProfile = "BROAD" | "NARROW" | "EMERGING";
// BROAD:    6+ topics mastered or nearly mastered
// NARROW:   1–5 topics, but deep competence in those
// EMERGING: few mastered topics, many in development
```

### Confidence rules

- **CONFIRMED**: ≥ 5 sessions per topic AND ≥ 10 attempts
- **EMERGING**: ≥ 2 sessions per topic OR ≥ 5 attempts (early data, patterns visible)
- **OBSERVED**: Attempt count < 5 OR no repeated sessions (small sample, hypothesis only)

Mastery state itself is already confidence-aware: MASTERED requires ≥90% accuracy across ≥ 10 recent attempts.

### What is allowed

✓ Observe accuracy per topic (raw performance data)  
✓ Track mastery state transitions (EMERGING → NEEDS_REVIEW → MASTERED)  
✓ Categorise error types (e.g. "subject-verb agreement mistakes in 40% of errors")  
✓ Compare current accuracy to learner's own baseline on that topic  
✓ Describe breadth of knowledge (# topics mastered)  
✓ Flag topics where confidence is low (< 5 attempts)  
✓ Identify trending improvement (accuracy rising session-over-session)  

### What is prohibited

✗ Claim "the student is good at grammar" as an identity (observable: "80% accuracy on grammar questions")  
✗ Infer aptitude ("natural ability in speaking") — too speculative  
✗ Use knowledge state to predict future unrelated performance ("good at listening → will be good at writing")  
✗ Compare knowledge to peers (norm-referenced) — LEXI is criterion-referenced only  
✗ Assume knowledge persistence without evidence (e.g. "mastered present perfect on 2026-06-15, so they still know it on 2026-06-25" requires recent re-assessment)  

---

## 4. Performance State

### Purpose

"How consistently do they execute what they know? How stable is their accuracy?"

Knowledge State answers *what* the learner knows. Performance State answers *how reliably* they demonstrate it. A learner might know present perfect grammar but struggle to apply it under time pressure, or fluctuate between 70% and 95% depending on fatigue. Performance State captures that variability and consistency.

### Data sources

- **SessionAnalytics** — accuracy per session, attempt-by-attempt progression
- **Timing data** — response time per question, breaks within sessions
- **ErrorNotebook** — same mistake repeated across different questions (consistency failure)
- **QuestionAttempt** — first-attempt accuracy vs. retry performance
- **MoodEntry** — mood at session start vs. performance that session

### Output shape

```typescript
interface PerformanceState {
  overallAccuracy: number;           // % correct across all attempts
  consistencyProfile: "STABLE" | "VARIABLE" | "DECLINING" | "IMPROVING";
  sessionsAnalyzed: number;
  recentSessionsPerformance: SessionPerformanceSnapshot[];
  firstAttemptAccuracy: number;      // % correct on first try (vs. retry attempts)
  retryImprovement: number;          // % of retried questions that then pass
  errorRecurrence: {
    singleTimeErrors: number;        // errors appearing in only one question
    recurringErrors: number;         // errors appearing in 2+ questions
    highRiskErrors: ErrorType[];     // errors appearing 3+ times across attempts
  };
  confidenceTier: ConfidenceTier;
}

interface SessionPerformanceSnapshot {
  sessionNumber: number;
  attemptCount: number;
  accuracy: number;
  progressThroughSession: "IMPROVING" | "DECLINING" | "FLAT";
  moodAtStart: MoodContext | null;
  sessionDurationMin: number | null;
}

type ConsistencyProfile = "STABLE" | "VARIABLE" | "DECLINING" | "IMPROVING";
// STABLE:    accuracy variance < 10%, no significant trend
// VARIABLE:  accuracy swings > 15% between sessions, no consistent direction
// IMPROVING: accuracy trend is positive (trend test p < 0.05)
// DECLINING: accuracy trend is negative (trend test p < 0.05)
```

### Confidence rules

- **CONFIRMED**: ≥ 10 sessions AND ≥ 50 attempts; consistency profile is statistically significant
- **EMERGING**: ≥ 5 sessions AND ≥ 20 attempts (pattern is visible, not yet stable)
- **OBSERVED**: < 5 sessions OR < 20 attempts (too early to trust consistency judgments)

Trends (IMPROVING, DECLINING) require ≥ 5 data points (5 sessions) and a linear trend test (p < 0.05).

### What is allowed

✓ Measure accuracy variability (standard deviation of session accuracies)  
✓ Compare first-attempt accuracy to retry accuracy (learning within session)  
✓ Identify recurring mistakes (same error appearing in multiple questions)  
✓ Observe session-by-session trends (is accuracy rising, falling, or flat?)  
✓ Note correlation with mood (students report STRESSED in 6 sessions, average accuracy 65% in those sessions vs. 82% in NEUTRAL/POSITIVE sessions)  
✓ Flag performance under specific conditions (e.g. "accuracy drops 15% in the last 10 minutes of a session")  

### What is prohibited

✗ Claim consistency is a personality trait ("the student is flaky" vs. "accuracy ranges from 60–90%")  
✗ Infer effort or engagement from consistency (high variability might mean learning, not carelessness)  
✗ Use consistency to predict performance on unrelated topics  
✗ Assume performance changes are permanent without longer observation (a declining trend over 3 sessions might reverse with context/rest)  
✗ Compare performance consistency to peers (norm-referenced judgment)  

---

## 5. Learning Behavior

### Purpose

"How do they interact with the system? What patterns characterise their engagement?"

Learning Behavior is the most directly observable dimension. It describes *how* the learner uses LEXI: when they practice, how long they stay, whether they interact with error notebooks, how they handle difficulty.

### Data sources

- **Session** records (startedAt, completedAt, question sequence)
- **MoodEntry** (emotional check-ins)
- **ErrorNotebookEntry** (viewing/reviewing errors)
- **QuestionAttempt** (response time, retry count)
- **Practice patterns** (frequency, time of day, typical session duration)

### Output shape

```typescript
interface LearningBehavior {
  engagementProfile: EngagementProfile;
  sessionPatterns: SessionPatterns;
  errorNotebookBehavior: ErrorNotebookBehavior;
  difficultyEngagement: DifficultyEngagement;
  retryBehavior: RetryBehavior;
  completionPatterns: CompletionPattern;
  moodReporting: MoodReportingBehavior;
  confidenceTier: ConfidenceTier;
}

interface EngagementProfile {
  totalSessions: number;
  activeDayCount: number;           // days with ≥ 1 session
  avgSessionDurationMin: number | null;
  preferredTimeOfDay: "MORNING" | "AFTERNOON" | "EVENING" | null;
  sessionFrequency: "DAILY" | "FREQUENT" | "SPORADIC" | "RARE";
  streakLength: number;
}

interface SessionPatterns {
  typicalQuestionsPerSession: number;  // median across last 10 sessions
  sessionsWithBreaks: number;          // sessions where response times indicate breaks
  avgTimePerQuestion: number;          // median response time in seconds
  paceProfile: "CONSISTENT" | "DECLINING" | "VARIABLE";
}

interface ErrorNotebookBehavior {
  reviewsPerSession: number | null;     // avg # times viewed after making an error
  revisitsAfterReview: number | null;   // % of reviewed errors that are retried
  daysSinceLastReview: number | null;   // recency of error notebook access
}

interface DifficultyEngagement {
  prefers: "EASY" | "MEDIUM" | "HARD" | "MIXED";
  easyAttempts: number;
  mediumAttempts: number;
  hardAttempts: number;
  performanceByDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
}

interface RetryBehavior {
  immediateRetryRate: number;          // % of incorrect answers immediately retried in same session
  revisitRetryRate: number | null;     // % revisited in future sessions
  giveUpRate: number;                  // % never retried
}

interface CompletionPattern {
  questionsAbandoned: number;          // started but never answered
  sessionAbandonmentRate: number;       // % of sessions quit before natural end
  typicalReasonForStop: "COMPLETED" | "QUIT_VOLUNTARILY" | null;
}

interface MoodReportingBehavior {
  reportingFrequency: number;          // total mood entries
  frequencyPerSession: number;         // mood entries / total sessions
  moodTrend: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "VARIABLE";
  moodAccuracyCorrelation: number | null; // correlation between reported mood and session accuracy
}
```

### Confidence rules

- **CONFIRMED**: ≥ 10 sessions; all patterns have at least 5 data points
- **EMERGING**: ≥ 5 sessions; some patterns have 5+ observations
- **OBSERVED**: < 5 sessions (early, patterns are hypotheses)

Session time-of-day preference requires ≥ 5 sessions; session duration requires ≥ 3 completed sessions with timing data.

### What is allowed

✓ Record when the learner practices (morning/afternoon/evening preference, day-of-week patterns)  
✓ Measure typical session length and question count  
✓ Track frequency (daily, occasional, sporadic)  
✓ Observe retry behavior (immediate vs. deferred, abandon rate)  
✓ Note error notebook engagement (do they review? how often?)  
✓ Track mood reporting frequency and correlation with performance  
✓ Identify session completion patterns (do they finish, or quit early?)  
✓ Categorise response time (fast, moderate, deliberate)  

### What is prohibited

✗ Infer personality from behavior ("likes HARD questions → ambitious person") — observable: "attempts 60% HARD, 20% MEDIUM, 20% EASY"  
✗ Judge motivation from frequency ("practices daily → motivated") — it could mean habit, obligation, anxiety, or genuine interest  
✗ Assume behavioral preferences are fixed ("student is a visual learner") — preferences may change with context  
✗ Use behavior to predict learning success on unrelated tasks  
✗ Compare behavior patterns to peers (norm-referenced)  

---

## 6. Learning Preference

### Purpose

"What conditions enable their best performance?"

Learning Preference is narrowly scoped: it identifies the operational conditions under which this specific learner performs best. Not about personality or learning style labels — just about measurable system parameters that correlate with higher accuracy.

### Data sources

- **Session** metadata (time of day, duration)
- **SessionAnalytics** — accuracy per session vs. time-of-day, session length, question difficulty
- **MoodEntry** — performance in POSITIVE vs. NEUTRAL vs. NEGATIVE mood sessions
- **DifficultyCalibration** — accuracy by Difficulty and learner profile
- **QuestionAttempt** — accuracy on questions with different context (passage-based vs. standalone, timed vs. untimed)
- **SkillMatrix** — relative strength across skills

### Output shape

```typescript
interface LearningPreference {
  optimalSessionConditions: SessionConditionPreference;
  difficultyOptimum: DifficultyPreference;
  contentPreference: ContentPreference;
  scaffoldingLevel: ScaffoldingPreference;
  feedbackPreference: FeedbackPreference;
  confidenceTier: ConfidenceTier;
}

interface SessionConditionPreference {
  bestTimeOfDay: "MORNING" | "AFTERNOON" | "EVENING" | "ANY";
  accuracyByTimeOfDay: {
    morning: number;
    afternoon: number;
    evening: number;
  };
  optimalSessionDuration: "SHORT" | "MEDIUM" | "LONG";  // < 15min, 15–45min, > 45min
  sessionAccuracyTrend: "IMPROVES_THROUGHOUT" | "DECLINES_THROUGHOUT" | "FLAT";
  moodDependence: "HIGH" | "MEDIUM" | "LOW";  // how much does accuracy vary with reported mood?
}

interface DifficultyPreference {
  optimalDifficulty: "EASY" | "MEDIUM" | "HARD" | "MIXED";
  accuracyByDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  engagementByDifficulty: {
    easy: number;      // % of attempts on EASY questions
    medium: number;
    hard: number;
  };
  retryRateByDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
}

interface ContentPreference {
  strongSkills: string[];             // skills with accuracy > 80%
  developingSkills: string[];         // 50–80%
  struggleSkills: string[];           // < 50%
  preferenceByQuestionType: Record<QuestionType, number>; // accuracy per type
}

interface ScaffoldingPreference {
  benefitsFromPassageContext: boolean;  // is accuracy higher on passage-based questions?
  explanationDetailLevel: "BRIEF" | "MODERATE" | "DETAILED";  // inferred from error review and retry success
  requiresRemedialReview: boolean;     // true if recurring mistakes persist after explanation
}

interface FeedbackPreference {
  respondsToImmediateFeedback: boolean;   // do immediate retries have higher success?
  benefitsFromErrorNotebook: boolean;     // do students who review errors improve?
  prefersCorrectionOverExample: boolean;  // TBD: if we track which explanation types are accessed
}
```

### Confidence rules

- **CONFIRMED**: ≥ 10 sessions; correlation/difference is statistically significant (e.g. t-test p < 0.05)
- **EMERGING**: ≥ 5 sessions; pattern is visible but not yet stable (e.g. accuracy difference 5–10%)
- **OBSERVED**: < 5 sessions OR difference < 5% (too early or too small to trust)

Preferences require comparison (morning vs. afternoon accuracy); if there are fewer than 3 observations in any category, that preference is NULL.

### What is allowed

✓ Correlate session time-of-day with accuracy (morning 82%, evening 70% → prefers morning)  
✓ Observe optimal session length (sessions > 45 min show declining pace profile; sessions 20–40 min are most consistent)  
✓ Compare accuracy by difficulty (80% on EASY, 65% on HARD → prefers EASY)  
✓ Track which explanations are reviewed (if student reviews detailed explanations more → benefits from detail)  
✓ Note skill-by-skill performance (strong in grammar, weak in listening → focus should be listening)  
✓ Measure immediate retry success rate (of immediate retries, 70% pass → benefits from instant feedback)  

### What is prohibited

✗ Infer learning style ("prefers EASY → visual learner") — observable: "accuracy is 15% higher on EASY questions"  
✗ Assume preference is permanent (morning preference observed in January might not apply in June)  
✗ Use preference to lower expectations ("prefers EASY → keep them on EASY forever") — preferences should be adjusted over time as learner develops  
✗ Compare preferences to peers  
✗ Infer causality (morning accuracy is higher because of biology) — it's correlation, not causation  

---

## 7. Problem Solving Pattern

### Purpose

"How do they respond to errors? Do they retry, skip, or give up?"

Problem Solving Pattern captures the learner's immediate response to difficulty: Do they persist? Shift strategy? Seek help? Give up? This is the most action-oriented dimension, directly informing how tutoring and practice should adapt.

### Data sources

- **QuestionAttempt** — attempt sequence, correctness, timing
- **ErrorNotebook** — errors grouped by type and learner response (reviewed or ignored)
- **SessionAnalytics** — progression through a session (do they slow down on hard questions?)
- **ErrorTypePatterns** — which mistakes do they make, on what types of questions?
- **SessionPacing** — do response times increase after errors?

### Output shape

```typescript
interface ProblemSolvingPattern {
  errorResponse: ErrorResponse;
  persistenceProfile: PersistenceProfile;
  strategyAdaptation: StrategyAdaptation;
  recoveryPattern: RecoveryPattern;
  helpSeeking: HelpSeeking;
  confidenceTier: ConfidenceTier;
}

interface ErrorResponse {
  immediateRetryRate: number;         // % of errors immediately retried in same session
  thoughtfulnessAfterError: "QUICK" | "DELIBERATE" | "MIXED";
    // QUICK: response time after error < 5s
    // DELIBERATE: response time after error > 10s (suggests re-reading, thinking)
  skipRate: number;                   // % of errors never attempted again
  giveUpRate: number;                 // % of sessions where learner quits after errors
}

interface PersistenceProfile {
  continuesAfterErrors: boolean;      // true if most sessions have ≥ 1 error and learner continues
  maxConsecutiveErrors: number;       // longest streak of consecutive incorrect attempts
  recoverySessionCount: number;       // if learner quit session with error, did they retry that question in next session?
}

interface StrategyAdaptation {
  changePaceAfterError: "SLOWS_DOWN" | "SPEEDS_UP" | "UNCHANGED";
  changesDifficultyPreference: boolean; // does learner shift to EASY after HARD error, or stay?
  revisitsErrorNotebook: boolean;     // reviews errors after making them?
  adjustsApproach: string;            // qualitative: "retries with different reasoning" vs. "rereads passage", etc.
}

interface RecoveryPattern {
  recoverySessionsToMastery: number | null;  // sessions required to go from first error to mastery
  recoveryAccuracy: number;           // accuracy in session immediately after an error
  longTermRetention: number | null;   // accuracy on same topic 7+ days later
}

interface HelpSeeking {
  asksForExplanation: number;         // times learner requested explanation (via UI action, if tracked)
  engagesWithTutoring: boolean;       // true if learner initiates tutor chat
  reviewsErrorNotebookAfterError: boolean;
  averageDelayBeforeSeekingHelp: number; // if tracked: time between error and help-seeking action
}
```

### Confidence rules

- **CONFIRMED**: ≥ 15 errors across ≥ 5 sessions; clear patterns in response
- **EMERGING**: ≥ 7 errors across ≥ 3 sessions; pattern is visible
- **OBSERVED**: < 7 errors OR < 3 sessions (too few errors to characterise response)

Recovery patterns (especially long-term retention) require follow-up observation (7+ days post-error).

### What is allowed

✓ Observe immediate retry behavior (error → retry in same session, or skip?)  
✓ Measure time spent on question after error (quick next attempt vs. thoughtful re-reading)  
✓ Track session continuation (do they quit after an error, or push through?)  
✓ Note error patterns (recurring mistakes vs. sporadic errors)  
✓ Measure recovery trajectory (how many sessions to go from first error to mastery?)  
✓ Observe error notebook engagement (do they review explanations?)  
✓ Track help-seeking (do they ask for explanations, engage with tutor?)  
✓ Measure retention over time (do they remember correct strategies days later?)  

### What is prohibited

✗ Judge "grit" or "resilience" from persistence — observe: "retries 60% of errors immediately; quits 5% of sessions with errors"  
✗ Infer fixed mindset vs. growth mindset from strategy adaptation — too speculative, requires psychological research  
✗ Assume slow response after error means deeper thinking (it might be frustration, confusion, or distraction)  
✗ Use problem-solving pattern to predict success on unrelated content  
✗ Compare patterns to peers (norm-referenced)  

---

## 8. Integration: Five Dimensions → Learner Understanding

These five dimensions are independent but complementary:

| Dimension | Answers | Informs |
|---|---|---|
| **Knowledge State** | "What does the learner know?" | Content selection, gap detection, pre-test recommendations |
| **Performance State** | "How reliably do they execute?" | Confidence in mastery claims, readiness for assessment |
| **Learning Behavior** | "How do they use the system?" | Engagement interventions, practice scheduling |
| **Learning Preference** | "What conditions help them?" | Session design (time, length), difficulty selection |
| **Problem Solving** | "How do they handle errors?" | Tutoring strategy, remedial focus, feedback type |

**Example synthesis:**

- Knowledge State: Math student has mastered fractions, is developing algebra.
- Performance State: Performance is consistent (≈75% accuracy) across all topics.
- Learning Behavior: Practices daily, 30–40 min sessions, 8–10 PM preference, strong error notebook engagement.
- Learning Preference: Accuracy is 5% higher in evening sessions; improves on MEDIUM difficulty (vs. EASY or HARD).
- Problem Solving: Immediately retries 70% of errors; asks for explanations after reviewing mistakes; recovers to mastery in 2–3 sessions.

**Recommendation output:** Schedule evening practice, offer MEDIUM difficulty problems with explanations available for errors, set daily practice targets (aligns with current behavior), focus on algebra gaps.

---

## 9. Snapshot Model: StudentLearningProfile v3

The existing `StudentLearningProfile` (v2) aggregates Phases 1–2 results: mastery, signals, recommendations, narrative.

**Phase 5 extends this into v3** by adding the five learner model dimensions as read-only snapshots:

```typescript
interface StudentLearningProfile {
  // Existing Phase 1/2 fields
  readiness: ReadinessResult;
  masterySummary: MasterySummary;
  activeWeaknesses: ActiveWeakness[];
  learningTrend: LearningTrend;
  recommendations: PracticeRecommendation[];
  signals: LearningSignal[];
  // ... other fields

  // NEW Phase 5 fields — learner model snapshots
  knowledgeState: KnowledgeState;
  performanceState: PerformanceState;
  learningBehavior: LearningBehavior;
  learningPreference: LearningPreference;
  problemSolvingPattern: ProblemSolvingPattern;

  // Timestamp
  generatedAt: string;
}
```

The profile is a **read-only snapshot** assembled by a service layer. No logic lives inside the profile object itself. All computation happens in pure engines:

- `computeKnowledgeState(masteryData, errorNotebook, skillMatrix)`
- `computePerformanceState(sessionAnalytics, attempts, errors)`
- `computeLearningBehavior(sessions, moodEntries, errorNotebook, attempts)`
- `computeLearningPreference(sessions, analytics, mood, calibration)`
- `computeProblemSolvingPattern(attempts, errorNotebook, sessions)`

---

## 10. Confidence & Data Maturity

Each dimension reports a `ConfidenceTier`. The UI respects this:

| Tier | Confidence | UI Language | Action |
|---|---|---|---|
| **CONFIRMED** | High, stable pattern | "consistently", "often", "tends to" | Inform major decisions (practice plan, tutoring focus) |
| **EMERGING** | Moderate, pattern visible | "often seems to", "appears to", "might" | Guide secondary decisions (content format, session timing) |
| **OBSERVED** | Low, provisional | "may", "possibly", "watch for" | Informational only; avoid major decisions |

New learners (< 5 sessions) will have mostly OBSERVED confidence. As they practice, confidence rises to EMERGING, then CONFIRMED.

---

## 11. What Phase 5 Does NOT Include

### No personality inference
LEXI does not assess "the learner is introverted" or "has high self-efficacy" or "is anxious". These are speculative and require psychological expertise.

### No motivation or affect inference
Mood entries are optional check-ins, not psychometric assessments. We observe mood reports (POSITIVE/NEGATIVE) and correlate with performance — but we do NOT infer internal motivation state.

### No learning style classification
LEXI does not label learners as "visual", "auditory", or "kinesthetic". These learning style models lack scientific support and can misdirect teaching.

### No cognitive ability assessment
Diagnostic tests provide a baseline, not an IQ assessment. We do not claim to measure "intelligence" or "aptitude". We measure current knowledge and performance on specific content.

### No AI-driven learner classification
Phase 5 uses no new LLM calls. All logic is threshold-based and deterministic. Any future ML model (e.g. for performance prediction) would be explicitly designed, published, and validated — not baked into this phase.

---

## 12. Implementation Constraints

### Data availability
Some dimensions require more data than others:

- **Knowledge State**: Available from day 1 (after first session)
- **Learning Behavior**: Visible from 2–3 sessions
- **Performance State**: Needs ≥ 5 sessions for stable patterns
- **Learning Preference**: Needs ≥ 5 sessions with comparative data (morning vs. afternoon, etc.)
- **Problem Solving**: Needs ≥ 7 errors across ≥ 3 sessions

Low-session learners will have mostly OBSERVED confidence across all dimensions.

### Performance considerations
Computing all five dimensions for every profile request is expensive. Options:

1. **Cache**: Recompute once per day or on explicit request (admin dashboard)
2. **Incremental**: Update only dimensions that have changed since last computation
3. **Lazy**: Compute on-demand (call when needed, not on every session end)

Recommend: Lazy computation for most dimensions, cached for student-facing UI snapshot.

### UI coordination
The profile snapshot is large. The UI picks the dimensions most relevant for each view:

- **Student Dashboard**: Knowledge State + Learning Preference (what should I practice?)
- **Error Notebook**: Problem Solving Pattern + Knowledge State (what did I get wrong and how do I improve?)
- **Admin/Tutor Dashboard**: All five dimensions (comprehensive understanding)
- **Adaptive Practice**: Performance State + Problem Solving + Learning Preference (how to calibrate?)

---

## 13. Explicitly Out of Scope for Phase 5

- No new Prisma models (reuse existing data)
- No UI changes (Phase 5 is design only)
- No schema migrations beyond what's necessary
- No new LLM integrations or AI calls
- No student-to-student comparisons or cohort analysis
- No exam prediction or success forecasting
- No psychological assessment or profiling
- No real-time monitoring or surveillance features
- No automatic interventions (all recommendations are suggestions, human review required)

---

## 14. Success Criteria

Phase 5 design is complete when:

✓ Five dimensions are fully specified (Purpose, Data, Output, Confidence, Allowed, Prohibited)  
✓ Integration strategy is clear (how dimensions inform recommendations)  
✓ StudentLearningProfile v3 structure is defined (includes all five snapshots)  
✓ Confidence tier rules are deterministic (not subjective)  
✓ No psychological or motivational language creeps in  
✓ Data maturity is transparent (when can each dimension be trusted?)  
✓ Implementation constraints are acknowledged (caching, performance, UI coordination)  
✓ Scope boundaries are explicit (what's in Phase 5, what's future work)  

---

## 15. Phase 5.1 — Learner State Foundation (Implemented 2026-06-29)

Phase 5.1 implements the foundation for two of the five dimensions: **Knowledge State** and **Performance State**. It intentionally scopes down from the full design in Section 3–4 to the pure engine layer only — no Prisma, no AI, no new schema.

### Files created

| File | Purpose |
|---|---|
| `lib/services/learner-intelligence/types.ts` | Shared pure types: KnowledgeState, PerformanceState, ConceptEntry, AttemptRecord, SkillAccuracyInput, SkillPerformance |
| `lib/services/learner-intelligence/knowledgeState.ts` | Pure engine: `computeKnowledgeState(masteryProfiles, activeWeaknesses, signals)` |
| `lib/services/learner-intelligence/performanceState.ts` | Pure engine: `computePerformanceState(attempts, skillAccuracies)` |
| `scripts/test-learner-state-foundation.mjs` | 100 tests across 12 sections |

### Implemented output shapes (Phase 5.1 scope)

**KnowledgeState** (simplified from full design; full per-topic accuracy deferred):
- `masteredConcepts: ConceptEntry[]` — topics at MASTERED state
- `developingConcepts: ConceptEntry[]` — topics at IMPROVING or STABLE
- `weakConcepts: ConceptEntry[]` — topics at NEEDS_REVIEW, priority-ordered (remedial first)
- `confidenceTier: ConfidenceTier` — data richness signal
- `topicCount: number`

**PerformanceState** (simplified from full design; session-by-session snapshots deferred):
- `accuracyTrend: AccuracyTrend` — IMPROVING / STABLE / DECLINING / INSUFFICIENT_DATA
- `overallAccuracy: number` — 0–100
- `consistencyProfile: ConsistencyProfile` — CONSISTENT / VARIABLE / ERRATIC
- `skillPerformance: SkillPerformance[]` — per-skill tier (STRONG / DEVELOPING / WEAK)
- `confidenceTier: ConfidenceTier`

### Confidence tier rules (implemented)

**Knowledge State:**
- CONFIRMED: ≥ 10 notebook topics
- EMERGING: ≥ 3 topics OR ≥ 2 behavioral signals (RECURRING_WEAKNESS, RETENTION_RISK, etc.)
- OBSERVED: fewer than 3 topics and fewer than 2 behavioral signals

**Performance State:**
- CONFIRMED: ≥ 50 attempts
- EMERGING: ≥ 10 attempts
- OBSERVED: < 10 attempts

### What was intentionally deferred to later Phase 5 milestones

- Per-topic accuracy, attempt count, and recentTrend in KnowledgeState
- Session-by-session snapshots and firstAttemptAccuracy in PerformanceState
- Learning Behavior, Learning Preference, and Problem Solving Pattern engines
- StudentLearningProfile v3 integration (Phase 5 wiring milestone)
- New Prisma schema (none added in Phase 5.1)

---

## 16. Phase 5.2 — Learning Behavior State Integration (Implemented 2026-06-29)

Phase 5.2 integrates the existing M2.2 BehaviorProfile into the Phase 5 learner model as a structured `LearningBehaviorState` snapshot. The engine is a pure transformation — no new Prisma queries, no AI.

### Files created / updated

| File | Change |
|---|---|
| `lib/services/learner-intelligence/types.ts` | Added `EngagementLevel`, `SessionPatternObservation`, `CompletionBehaviorObservation`, `PaceObservation`, `RetryBehaviorObservation`, `EngagementObservation`, `BehaviorStateInput`, `LearningBehaviorState` |
| `lib/services/learner-intelligence/behaviorState.ts` | New — `computeLearningBehaviorState(behaviorProfile)` |
| `scripts/test-learning-behavior-state.mjs` | 89 tests across 12 sections |

### Implemented output shape

**LearningBehaviorState:**
- `sessionPattern` — `{ sessionCount, avgSessionDurationMin, preferredTimeOfDay }`
- `completionBehavior` — `{ completedSessionCount }` (abandonment rate deferred; requires started-but-incomplete session tracking)
- `paceObservation` — `{ paceProfile: CONSISTENT | DECLINING | VARIABLE | null }`
- `retryBehavior` — `{ responseTimeSignal: EXTENDED | MODERATE | BRIEF | null }` (direct retry rate deferred)
- `engagementObservation` — `{ engagementLevel: HIGHLY_ACTIVE | ACTIVE | OCCASIONAL | INACTIVE, recentMoodContext }`
- `confidenceTier` — inherited from `BehaviorProfile.confidenceTier` (CONFIRMED ≥10 sessions, EMERGING ≥5, OBSERVED <5)

### Engagement level classification (implemented)

| Level | Sessions |
|---|---|
| HIGHLY_ACTIVE | ≥ 20 |
| ACTIVE | 10–19 |
| OCCASIONAL | 3–9 |
| INACTIVE | 0–2 |

### Design constraint enforced

All output describes observed actions only. No field implies motivation, personality, or learning style. Example: `engagementLevel: "HIGHLY_ACTIVE"` means the count is ≥20 completed sessions — not "this student is motivated". The `RetryBehaviorObservation.responseTimeSignal` is explicitly documented as a behavioral proxy for deliberateness, not an inference about effort.

### What was intentionally deferred

- Abandonment rate (requires fetching `UserSessionProgress` with `status: IN_PROGRESS`)
- Direct retry rate (requires per-attempt retry tracking field)
- Learning Preference and Problem Solving Pattern engines

---

---

## 17. Phase 5.3 — Learning Preference State (Implemented 2026-06-29)

Phase 5.3 implements `LearningPreferenceState` — a seven-dimension preference snapshot. Each dimension is a `PreferenceEntry<T>` with `value`, `source`, and `confidenceTier`. The engine resolves each dimension in priority order: explicit learner choice → observed behavioral pattern → `UNKNOWN`.

### Files created / updated

| File | Change |
|---|---|
| `lib/services/learner-intelligence/types.ts` | Added `PreferenceSource`, `PreferenceEntry<T>`, seven value types, `ExplicitPreferences`, `PreferenceStateInput`, `LearningPreferenceState` |
| `lib/services/learner-intelligence/preferenceState.ts` | New — `computeLearningPreferenceState(behaviorProfile, explicitPreferences?)` |
| `scripts/test-learning-preference-state.mjs` | 154 tests across 12 sections |

### Implemented output shape

**LearningPreferenceState** — seven dimensions, each a `PreferenceEntry<T>`:

| Dimension | Value type | Data source in Phase 5.3 |
|---|---|---|
| `practiceTime` | MORNING / AFTERNOON / EVENING | BehaviorProfile.preferredTimeOfDay (OBSERVED) or explicit |
| `sessionDuration` | SHORT / MEDIUM / LONG | BehaviorProfile.avgSessionDurationMin bucketed (OBSERVED) or explicit |
| `explanationDepth` | BRIEF / DETAILED / STEP_BY_STEP | Explicit only; UNKNOWN if not set |
| `hintFrequency` | NEVER / ON_REQUEST / PROACTIVE | Explicit only; UNKNOWN if not set |
| `feedbackTiming` | IMMEDIATE / END_OF_SESSION | Explicit only; UNKNOWN if not set |
| `practiceMode` | MIXED / TOPIC_FOCUSED / EXAM_SIMULATION | Explicit only; UNKNOWN if not set |
| `languagePreference` | VIETNAMESE / ENGLISH / BILINGUAL | Explicit only; UNKNOWN if not set |

### Confidence tier rules (implemented)

| Source | Confidence tier |
|---|---|
| EXPLICIT | Always OBSERVED (one authoritative data point, not yet a stable pattern) |
| OBSERVED | Inherits from BehaviorProfile.confidenceTier (CONFIRMED ≥10 sessions, EMERGING ≥5) |
| NONE | Always OBSERVED (no evidence; treat any claim as speculative) |

### sessionDuration bucketing

- SHORT: avgSessionDurationMin < 15
- MEDIUM: 15 ≤ avgSessionDurationMin ≤ 45
- LONG: avgSessionDurationMin > 45

### Design constraints enforced

- No inference: `explanationDepth`, `hintFrequency`, `feedbackTiming`, `practiceMode`, `languagePreference` remain UNKNOWN unless explicitly set — even with a CONFIRMED behavior profile. These dimensions require direct learner input or dedicated interaction-tracking data.
- `null` explicit values fall through to observed data (treated as "not set"), not as "set to unknown".
- `ExplicitPreferences` is fully optional — the engine works with only BehaviorProfile.

### What was intentionally deferred

- Dedicated `LearnerPreferences` Prisma model for storing explicit preferences
- In-session interaction data for inferring explanation and hint preferences

---

## 18. Phase 5.4 — Problem Solving Pattern State (Implemented 2026-06-29)

Phase 5.4 implements `ProblemSolvingState` — a four-dimension behavioral snapshot derived from attempt history and error notebook data. Each dimension is a `PatternEntry<T>` with `value`, `evidence`, and `confidenceTier`. All value labels describe observed actions only — no personality, motivation, or trait inference.

### Files created / updated

| File | Change |
|---|---|
| `lib/services/learner-intelligence/types.ts` | Added `PatternEntry<T>`, four value types, `ProblemSolvingStateInput`, `ProblemSolvingState`; re-exports `ActiveWeakness` |
| `lib/services/learner-intelligence/problemSolvingState.ts` | New — `computeProblemSolvingState(attempts, activeWeaknesses)` |
| `scripts/test-problem-solving-state.mjs` | 167 tests across 17 sections |

### Implemented output shape

**ProblemSolvingState** — four dimensions, each a `PatternEntry<T>`:

| Dimension | Value type | Data source |
|---|---|---|
| `retryPattern` | FREQUENT_RETRIER / OCCASIONAL_RETRIER / RARELY_RETRIES | `AttemptRecord[]` — consecutive wrong→any within 10-minute window |
| `feedbackRecovery` | RECOVERS_QUICKLY / GRADUAL_RECOVERY / SLOW_RECOVERY | Post-error retry success rate from same 10-min window scan |
| `helpSeeking` | ACTIVE_ENGAGEMENT / SOME_ENGAGEMENT / LOW_ENGAGEMENT | `ActiveWeakness.isRemedialFlagged` proportion |
| `errorCorrection` | ERRORS_REDUCING / ERRORS_STABLE / ERRORS_PERSISTING | `ActiveWeakness.signal` (IMPROVED/IMPROVING vs. RECURRING) |

### Retry detection algorithm

A single chronological scan of `AttemptRecord[]`:
- Sorted by `attemptedAt` ascending
- For each wrong answer at index `i`: if the next attempt at index `i+1` is within 10 minutes → retry detected
- `retryPattern.value` = FREQUENT_RETRIER (≥60%), OCCASIONAL_RETRIER (≥25%), RARELY_RETRIES (<25%) of wrong answers retried
- `feedbackRecovery.value` = success rate on those retry attempts: RECOVERS_QUICKLY (≥65%), GRADUAL_RECOVERY (≥35%), SLOW_RECOVERY (<35%)

### Confidence tier rules (implemented)

| Source | Rule |
|---|---|
| retryPattern / feedbackRecovery | From wrong attempt count: CONFIRMED ≥20, EMERGING ≥5, OBSERVED <5 |
| helpSeeking / errorCorrection | From active weakness count: CONFIRMED ≥8, EMERGING ≥3, OBSERVED <3 |
| overall (confidenceTier) | From total attempt count: CONFIRMED ≥50, EMERGING ≥10, OBSERVED <10 |

### What was intentionally deferred

- Hint and explanation access tracking (not in data model; `helpSeeking` uses remedial flag as proxy and this is documented in the evidence field and type JSDoc)
- Per-question retry tracking (would require question ID on `AttemptRecord`)
- Deliberateness after error from per-attempt response time (requires timing data beyond what `AttemptRecord` provides)

### No psychological inference enforced

All four value labels were verified against a prohibited list (PERSISTENT, MOTIVATED, GRITTY, RESILIENT, LAZY, UNMOTIVATED, etc.) in the test suite. Section 12 explicitly guards against label drift.

---

## 19. M5.5 — StudentLearningProfile v3 Assembly

### What was built

`lib/services/learner-intelligence/learnerProfileBuilder.ts` — pure assembly layer that composes all five Phase 5 intelligence engines into a single `LearnerModel` snapshot.

`StudentLearningProfile` (v3) extended with `learnerModel: LearnerModel` field in `lib/analytics/studentLearningProfile.ts`.

### How assembly works

`assembleLearnerModel(input: LearnerModelInput): LearnerModel` calls each of the five engines exactly once with pre-fetched data:

```
LearnerModelInput {
  masteryProfiles + activeWeaknesses + learningSignals  → computeKnowledgeState()
  attempts + skillAccuracies                            → computePerformanceState()
  behaviorProfile                                       → computeLearningBehaviorState()
  behaviorProfile + explicitPreferences?                → computeLearningPreferenceState()
  attempts + activeWeaknesses                           → computeProblemSolvingState()
}
→ LearnerModel {
    knowledgeState, performanceState, learningBehaviorState,
    learningPreferenceState, problemSolvingState, assembledAt
  }
```

No new inference rules were added. The builder calls engines and composes output only.

### Two-pass signal injection

`getStudentLearningProfile()` uses a two-pass pattern (established in Phase 2 for `topSignal`):

1. First pass: `buildLearningProfile()` called with `learningSignals: []` → `baseProfile`
2. Compute: `signals = computeLearningSignals(baseProfile, streak)` (requires completed profile)
3. Second pass: `assembleLearnerModel()` called again with real `signals` → overrides `baseProfile.learnerModel`
4. Return: `{ ...baseProfile, topSignal: signals[0] ?? null, learnerModel }`

This ensures `KnowledgeState.confidenceTier` benefits from behavioral signal boost when topic count is low. Overhead is one additional pure function call (no DB or AI access).

### Data sharing (no duplicate fetches)

- `attempts`: shared between `computePerformanceState` and `computeProblemSolvingState`
- `behaviorProfile`: shared between `computeLearningBehaviorState` and `computeLearningPreferenceState`
- `activeWeaknesses`: shared between `computeKnowledgeState` and `computeProblemSolvingState`
- `skillAccuracies`: mapped from the existing `skillSnapshot` field (identical shape)

One new DB fetch added to `getStudentLearningProfile()`: `prisma.questionAttempt.findMany()` for all user attempts, run in the existing `Promise.all`.

### What was intentionally deferred

- `ExplicitPreferences` DB backing (no `LearnerPreferences` Prisma model yet — engine accepts `undefined`, all explicit dimensions stay UNKNOWN)

### Test coverage

`scripts/test-learner-profile-v3.mjs` — 144 tests across 13 sections:
1. Output shape invariants (6 keys, all fields present)
2. assembledAt timestamp (valid ISO, UTC)
3. Empty data (no throws, graceful UNKNOWN/OBSERVED)
4. KnowledgeState routing (masteryProfiles + signals → KS; verified isolation)
5. PerformanceState routing (attempts → PS; skill tiers from skillAccuracies)
6. BehaviorState routing (behaviorProfile → BS + Pref; engagementLevel boundaries)
7. ActiveWeaknesses routing (→ KS weakConcepts + PS helpSeeking/errorCorrection)
8. Explicit preferences routing (EP → preference engine only; other engines isolated)
9. Confidence tier wiring (OBSERVED/EMERGING/CONFIRMED at threshold boundaries)
10. Determinism (same inputs produce same outputs)
11. Engine field shapes (all required sub-fields present)
12. Full realistic scenario (CONFIRMED learner with 70 attempts, 10 topics, 4 weaknesses)
13. Assembly purity (no new fields, no prohibited classifications, no logic duplication)

---

_End of Phase 5 Learner Model Design Review._

_This design is the foundation for Phase 5 implementation. No code, schema, or UI is included here — only the conceptual model and rules that will guide the engineering._
