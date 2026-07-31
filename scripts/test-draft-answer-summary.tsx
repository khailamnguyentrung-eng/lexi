/**
 * DraftAnswerSummary must never throw during render — it is the component
 * SampleTestButton uses to show REJECTED drafts (styled red) so an admin can
 * see why a draft was rejected, and a very common rejection reason is a
 * structurally-malformed payload that validatePayload() caught (e.g. a
 * SINGLE_CHOICE payload missing `options`). describeCorrectAnswer() assumes
 * an already-validated payload and will throw (e.g. .find() on undefined) on
 * one that isn't — so DraftAnswerSummary must re-run validatePayload() before
 * calling it, not just confirm JSON.parse succeeded.
 *
 * Renders via react-dom/server (no jsdom needed for a pure server render) and
 * asserts each case produces a graceful message, never an uncaught throw.
 *
 * Run: npm run test:draft-answer-summary
 */
import { renderToStaticMarkup } from "react-dom/server";
import { DraftAnswerSummary } from "../app/admin/content-import/DraftAnswerSummary.tsx";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

function renderSafely(responseFormat: string | undefined, payload: string | undefined) {
  try {
    return { html: renderToStaticMarkup(DraftAnswerSummary({ responseFormat, payload })), threw: false };
  } catch (err) {
    return { html: "", threw: true, error: err };
  }
}

async function main() {
  // 1. Missing fields — existing guard, must still work.
  {
    const { html, threw } = renderSafely(undefined, undefined);
    check("missing responseFormat/payload does not throw", !threw);
    check("missing responseFormat/payload shows guard message", html.includes("Thiếu responseFormat/payload"));
  }

  // 2. Malformed JSON string — existing guard, must still work.
  {
    const { html, threw } = renderSafely("SINGLE_CHOICE", "{not valid json");
    check("malformed JSON does not throw", !threw);
    check("malformed JSON shows guard message", html.includes("JSON lỗi"));
  }

  // 3. responseFormat outside RESPONSE_FORMATS — the Minor finding.
  {
    const { html, threw } = renderSafely("NOT_A_REAL_FORMAT", JSON.stringify({ foo: "bar" }));
    check("unknown responseFormat does not throw", !threw);
    check("unknown responseFormat shows a message (not silently empty)", html.trim().length > 0);
  }

  // 4. THE Important finding: valid JSON, structurally wrong for its
  // declared format — SINGLE_CHOICE payload missing `options` entirely.
  // Before the fix, describeCorrectAnswer() would throw reading
  // options.find(...) on undefined.
  {
    const malformed = JSON.stringify({ correctOptionId: "A" }); // no `options` key at all
    const { html, threw, error } = renderSafely("SINGLE_CHOICE", malformed);
    check(
      "SINGLE_CHOICE payload missing `options` does not throw",
      !threw,
      threw ? `threw: ${(error as Error)?.message}` : undefined,
    );
    check("shows a graceful malformed-payload message", html.includes("payload sai định dạng"));
  }

  // 5. Same failure mode for a second format, to confirm the fix isn't
  // SINGLE_CHOICE-specific — MATCHING missing `left`/`right`.
  {
    const malformed = JSON.stringify({ correctPairs: [] });
    const { html, threw } = renderSafely("MATCHING", malformed);
    check("MATCHING payload missing left/right does not throw", !threw);
    check("shows a graceful malformed-payload message for MATCHING", html.includes("payload sai định dạng"));
  }

  // 6. Sanity: a well-formed payload still renders the real answer summary
  // (regression guard — the new validation gate must not reject good data).
  {
    const wellFormed = JSON.stringify({
      options: [
        { id: "A", text: "has lived" },
        { id: "B", text: "lived" },
      ],
      correctOptionId: "A",
    });
    const { html, threw } = renderSafely("SINGLE_CHOICE", wellFormed);
    check("well-formed SINGLE_CHOICE payload does not throw", !threw);
    check("well-formed payload renders the real answer", html.includes("has lived"));
    check("well-formed payload does not show the malformed-payload message", !html.includes("sai định dạng"));
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  passed: ${passed}   failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
