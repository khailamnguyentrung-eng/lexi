/**
 * test-review-engagement.mjs
 *
 * Validates didAchieveMastery — the reachedMastery decision logic for RV-1's
 * ReviewEngagement Evidence write.
 * Plain JS — no TypeScript compilation, no DB connection.
 * Inlines the pure function from lib/services/errorNotebook.ts.
 *
 * Regression context: an earlier inline version of this expression
 * (`wasFinalStage` alone, with no already-MASTERED check) recorded
 * reachedMastery: true on every re-review of an already-mastered entry, not
 * only on the review that achieved mastery — double-counting mastery events.
 * Caught only by a live whole-branch review, by nothing committed. This test
 * exists so that regression cannot recur silently.
 *
 * Run: node scripts/test-review-engagement.mjs
 */

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

// ── Inlined pure function (mirrors lib/services/errorNotebook.ts) ─────────────

function didAchieveMastery(statusBefore, wasFinalStage) {
  return statusBefore !== "MASTERED" && wasFinalStage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n1. didAchieveMastery — not at final stage");

assert("OPEN, not final stage → false", didAchieveMastery("OPEN", false) === false);
assert("REVIEWING, not final stage → false", didAchieveMastery("REVIEWING", false) === false);

console.log("\n2. didAchieveMastery — at final stage, achieving mastery for the first time");

assert("OPEN, final stage → true (first-ever mastery)", didAchieveMastery("OPEN", true) === true);
assert("REVIEWING, final stage → true (the review that achieves mastery)",
  didAchieveMastery("REVIEWING", true) === true);

console.log("\n3. didAchieveMastery — the regression case: re-review of an already-mastered entry");

assert("MASTERED, final stage → false (re-review achieves nothing new)",
  didAchieveMastery("MASTERED", true) === false);
assert("MASTERED, not final stage (defensive, should not occur in practice) → false",
  didAchieveMastery("MASTERED", false) === false);

console.log("\n4. didAchieveMastery — deterministic (same input → same output)");

for (const [status, wasFinal] of [["OPEN", false], ["REVIEWING", true], ["MASTERED", true]]) {
  const r1 = didAchieveMastery(status, wasFinal);
  const r2 = didAchieveMastery(status, wasFinal);
  assert(`(${status}, ${wasFinal}) is deterministic`, r1 === r2);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
