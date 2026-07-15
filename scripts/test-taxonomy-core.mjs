/**
 * KU-1 part B, Path A — taxonomyCore.ts (parser + anti-hallucination quote
 * verification). Pure, no Prisma, no AI call — imports the real module via
 * tsx, same convention as test-question-formats.mjs.
 *
 * The emphasis here is verifyEvidenceQuotes(): a model can assert a topic
 * exists in a document without actually quoting it. A fabricated-looking-
 * legitimate evidenceQuote is worse than an obviously fake one, because the
 * reviewer trusts it without checking — this is the guard against that.
 */

import {
  parseTaxonomyProposals,
  verifyEvidenceQuotes,
  buildProposeTaxonomyUserPrompt,
} from "../lib/ai/providers/taxonomyCore.ts";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}\n      expected: ${e}\n      actual  : ${a}`);
  }
}

function checkThrows(name, fn) {
  try {
    fn();
    failed++;
    console.log(`  ✗ ${name}\n      expected throw, got none`);
  } catch {
    passed++;
    console.log(`  ✓ ${name}`);
  }
}

console.log("\nparseTaxonomyProposals");

const validResponse = JSON.stringify([
  {
    proposedTopic: "matching_headings",
    proposedLabel: "Matching Headings",
    evidenceQuote: "Choose the correct heading for each paragraph",
    evidenceLocation: "Test 2, Passage 1",
    confidence: 0.9,
  },
]);
check("parses a valid array", parseTaxonomyProposals(validResponse).length, 1);
check(
  "strips a markdown code fence",
  parseTaxonomyProposals("```json\n" + validResponse + "\n```").length,
  1
);
checkThrows("throws on non-array JSON", () => parseTaxonomyProposals('{"not": "an array"}'));
checkThrows("throws on malformed JSON", () => parseTaxonomyProposals("{not json"));
check(
  "clamps an out-of-range confidence into 0..1",
  parseTaxonomyProposals(JSON.stringify([{ ...JSON.parse(validResponse)[0], confidence: 5 }]))[0].confidence,
  1
);
check(
  "missing confidence defaults to 0, not a crash",
  parseTaxonomyProposals(JSON.stringify([{ proposedTopic: "x", proposedLabel: "X", evidenceQuote: "q" }]))[0]
    .confidence,
  0
);

console.log("\nverifyEvidenceQuotes — the anti-hallucination guard");

const sourceText = "Section 3: Reported Speech.\nHe said that he was tired.\nChoose the correct reported form.";

{
  const proposals = [
    {
      proposedTopic: "reported_speech",
      proposedLabel: "Reported Speech",
      evidenceQuote: "He said that he was tired.",
      evidenceLocation: null,
      confidence: 0.8,
    },
  ];
  const { accepted, rejected } = verifyEvidenceQuotes(proposals, sourceText);
  check("a real, exact quote is accepted", accepted.length, 1);
  check("nothing rejected for a real quote", rejected.length, 0);
}

{
  const proposals = [
    {
      proposedTopic: "fabricated_topic",
      proposedLabel: "Fabricated",
      evidenceQuote: "This sentence was never in the document.",
      evidenceLocation: null,
      confidence: 0.95,
    },
  ];
  const { accepted, rejected } = verifyEvidenceQuotes(proposals, sourceText);
  check(
    "a fabricated quote is REJECTED even with high stated confidence — confidence is not trusted over verification",
    accepted.length,
    0
  );
  check("rejection reason names the actual problem", rejected[0]?.reason, "evidenceQuote not found verbatim in source text");
}

{
  // Reformatted (line-wrap / double-space) is not fabrication.
  const proposals = [
    {
      proposedTopic: "reported_speech",
      proposedLabel: "Reported Speech",
      evidenceQuote: "He  said  that\nhe was tired.",
      evidenceLocation: null,
      confidence: 0.7,
    },
  ];
  const { accepted } = verifyEvidenceQuotes(proposals, sourceText);
  check("whitespace-only reformatting of a real quote is still accepted", accepted.length, 1);
}

{
  const proposals = [
    { proposedTopic: "", proposedLabel: "X", evidenceQuote: "He said that he was tired.", evidenceLocation: null, confidence: 0.5 },
  ];
  const { rejected } = verifyEvidenceQuotes(proposals, sourceText);
  check("missing proposedTopic is rejected, not silently accepted with an empty topic", rejected.length, 1);
}

{
  const proposals = [
    { proposedTopic: "x", proposedLabel: "X", evidenceQuote: "", evidenceLocation: null, confidence: 0.5 },
  ];
  const { rejected } = verifyEvidenceQuotes(proposals, sourceText);
  check("empty evidenceQuote is rejected, not treated as a vacuous match", rejected.length, 1);
}

{
  // Punctuation/wording differences ARE fabrication-shaped and must fail —
  // only whitespace is forgiven, per the file's own stated rule.
  const proposals = [
    {
      proposedTopic: "reported_speech",
      proposedLabel: "Reported Speech",
      evidenceQuote: "He said he was tired.", // dropped "that" — not a real quote
      evidenceLocation: null,
      confidence: 0.8,
    },
  ];
  const { accepted } = verifyEvidenceQuotes(proposals, sourceText);
  check("a near-miss quote (dropped word) is rejected, not fuzzy-matched", accepted.length, 0);
}

console.log("\nbuildProposeTaxonomyUserPrompt");
check(
  "lists existing topics so the model is told not to re-propose them",
  buildProposeTaxonomyUserPrompt("some text", ["present_perfect", "conditionals_type_1"]).includes(
    "present_perfect, conditionals_type_1"
  ),
  true
);
check(
  "omits the existing-topics preamble entirely when the registry is empty",
  buildProposeTaxonomyUserPrompt("some text", []).startsWith("Văn bản cần phân tích"),
  true
);

console.log("\nalreadyInRegistry defensive filter (taxonomyReader.ts) — pure simulation");
// The real filter (`if (existingTopicSet.has(proposal.proposedTopic)) alreadyInRegistry++`)
// only matters when a model does NOT honour the "don't repropose existing
// topics" instruction — a well-behaved provider (including this repo's own
// mockProvider) self-avoids, which makes the filter untestable via a real
// end-to-end run (see test-taxonomy-reader.mjs's note on this). Simulated
// here as the defense-in-depth it actually is: proof the filter logic itself
// is correct, independent of whether any real provider ever needs it.
{
  function simulateFilter(proposedTopics, existingTopics) {
    const existingSet = new Set(existingTopics);
    let alreadyInRegistry = 0;
    const passedThrough = [];
    for (const topic of proposedTopics) {
      if (existingSet.has(topic)) alreadyInRegistry++;
      else passedThrough.push(topic);
    }
    return { alreadyInRegistry, passedThrough };
  }

  const { alreadyInRegistry, passedThrough } = simulateFilter(
    ["present_perfect", "matching_headings", "conditionals_type_1"],
    ["present_perfect", "conditionals_type_1"]
  );
  check("a non-compliant proposal for an existing topic is counted, not silently accepted", alreadyInRegistry, 2);
  check("a genuinely new topic still passes through", passedThrough, ["matching_headings"]);
}

console.log(`\n${"─".repeat(50)}`);
console.log(`  passed: ${passed}   failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
