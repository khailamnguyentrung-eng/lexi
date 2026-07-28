/**
 * KU-1 part B, Path A — taxonomyReader.ts end-to-end, against a real
 * ContentSource whose file genuinely exists on disk (see the DOCX lookup
 * below). NOT part of db:seed — ContentSource rows only ever come from an
 * actual upload through /admin/content-import, and no .docx/.pdf fixture
 * is committed to this repo (see DECISION_LOG for why: a binary test
 * fixture is a real decision, not added here in passing). So this script
 * looks up whichever real DOCX ContentSource currently exists rather than
 * hardcoding a specific cuid — a hardcoded id had to be manually re-pointed
 * after every `prisma migrate reset` (discovered 2026-07-28 when the
 * CurriculumSession Phase 2 retirement's fresh-reseed verification step
 * first ran a genuine reset); this lookup removes that maintenance burden.
 * If NO DOCX ContentSource exists (e.g. right after a fresh reset, before
 * anyone has re-uploaded one), this script exits early with a clear message
 * telling you to upload one via /admin/content-import, rather than a
 * cryptic Prisma P2025.
 *
 * Uses fileExtractor.extract() for real (real mammoth DOCX parsing, not a
 * fixture string) and whatever AI provider getAIProvider() actually
 * resolves to in this environment — AI_PROVIDER=gemini is set, and Gemini's
 * quota is documented dead (429, "limit: 0"), so this is expected to
 * exercise the REAL runtime-fallback-to-mock path, not a mocked one. If the
 * environment ever changes (quota fixed, or AI_PROVIDER changed), the
 * assertions that don't depend on servedBy still hold; the ones that check
 * fallbackReason report what actually happened rather than assuming it.
 *
 * Cleanup: deletes only rows this script itself creates — the SourceRead and
 * TaxonomyJob rows it makes (tracked by id), any PendingKnowledgeUnit whose
 * proposedTopic starts with "demo_topic_from_mock" (mock's own topic naming,
 * unlikely to ever collide with a real proposal), and a throwaway
 * KnowledgeUnit fixture used to test the alreadyInRegistry skip. Never
 * touches the real 71 KnowledgeUnit registry or any PendingKnowledgeUnit
 * rows it didn't itself create. Never touches the ContentSource it looked
 * up either — that row is owned by whoever uploaded it, not this script.
 */

import { PrismaClient } from "@prisma/client";
import { runTaxonomyJob, getOrCreateSourceRead } from "../lib/services/content-intelligence/taxonomyReader.ts";

const prisma = new PrismaClient();

const realDocxSource = await prisma.contentSource.findFirst({
  where: { fileType: "DOCX" },
  orderBy: { createdAt: "asc" },
  select: { id: true, fileName: true },
});
if (!realDocxSource) {
  console.error(
    "\nSKIPPED — no DOCX ContentSource exists in dev.db.\n" +
      "This test needs a real uploaded document to exercise real mammoth DOCX\n" +
      "parsing (not a fixture string). Upload any .docx via /admin/content-import\n" +
      "(logged in as admin@lexi.local), then re-run this test.\n"
  );
  await prisma.$disconnect();
  process.exit(1);
}
console.log(`Using ContentSource "${realDocxSource.fileName}" (${realDocxSource.id})`);
const REAL_CONTENT_SOURCE_ID = realDocxSource.id;

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
function ok(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const created = { sourceReadIds: [], taxonomyJobIds: [], knowledgeUnitIds: [] };

async function teardown() {
  await prisma.pendingKnowledgeUnit.deleteMany({
    where: { proposedTopic: { startsWith: "demo_topic_from_mock" } },
  });
  await prisma.taxonomyJob.deleteMany({ where: { id: { in: created.taxonomyJobIds } } });
  await prisma.sourceRead.deleteMany({ where: { id: { in: created.sourceReadIds } } });
  await prisma.knowledgeUnit.deleteMany({ where: { id: { in: created.knowledgeUnitIds } } });
}

async function main() {
  console.log("\nExtraction — real mammoth DOCX parsing, real file on disk");
  const sourceRead1 = await getOrCreateSourceRead(REAL_CONTENT_SOURCE_ID);
  created.sourceReadIds.push(sourceRead1.id);
  check("SourceRead status is READ", sourceRead1.status, "READ");
  ok(
    "rawExtractedText is real, substantial content (not empty, not a placeholder)",
    (sourceRead1.rawExtractedText?.length ?? 0) > 500,
    `length was ${sourceRead1.rawExtractedText?.length ?? 0}`
  );

  console.log("\nSourceRead reuse — extract once, fan out (design doc §1.5)");
  const beforeCount = await prisma.sourceRead.count({ where: { contentSourceId: REAL_CONTENT_SOURCE_ID } });
  const sourceRead2 = await getOrCreateSourceRead(REAL_CONTENT_SOURCE_ID);
  const afterCount = await prisma.sourceRead.count({ where: { contentSourceId: REAL_CONTENT_SOURCE_ID } });
  check("a second call reuses the SAME SourceRead id, does not re-extract", sourceRead2.id, sourceRead1.id);
  check("no new SourceRead row was created", afterCount, beforeCount);

  console.log("\nrunTaxonomyJob — first run against the real document");
  const result1 = await runTaxonomyJob(REAL_CONTENT_SOURCE_ID);
  created.taxonomyJobIds.push(result1.taxonomyJobId);
  console.log(`  (servedBy=${result1.servedBy}, fallbackReason=${result1.fallbackReason ? "SET" : "null"}, retryCount=${result1.retryCount})`);
  console.log(`  proposalsCreated=${result1.proposalsCreated}, duplicatesSkipped=${result1.duplicatesSkipped}, alreadyInRegistry=${result1.alreadyInRegistry}, rejectedByVerification=${result1.rejectedByVerification}`);

  const job1 = await prisma.taxonomyJob.findUniqueOrThrow({ where: { id: result1.taxonomyJobId } });
  check("TaxonomyJob transitioned to PROPOSED (not left at PROPOSING)", job1.status, "PROPOSED");
  check("TaxonomyJob is linked to the reused SourceRead", job1.sourceReadId, sourceRead1.id);

  // This is the invariant that matters most and holds regardless of which
  // provider actually served the call (mock or real): every proposal this
  // run created must carry a quote that genuinely appears in the extracted
  // text, and must be linked back to THIS taxonomyJob (not left null, the
  // way Path B's miss-handling deliberately leaves it — see DECISION_LOG).
  const createdProposals = await prisma.pendingKnowledgeUnit.findMany({
    where: { taxonomyJobId: result1.taxonomyJobId },
  });
  check("number of persisted proposals matches the reported count", createdProposals.length, result1.proposalsCreated);
  const rawText = sourceRead1.rawExtractedText.replace(/\s+/g, " ");
  for (const p of createdProposals) {
    ok(
      `proposal "${p.proposedTopic}"'s evidenceQuote is a REAL substring of the extracted document`,
      rawText.includes(p.evidenceQuote.replace(/\s+/g, " ")),
      `quote was: "${p.evidenceQuote}"`
    );
    ok(`proposal "${p.proposedTopic}" is linked to this TaxonomyJob (Path A, not Path B)`, p.taxonomyJobId === result1.taxonomyJobId);
  }

  console.log("\nDuplicate run — same source, no new KnowledgeUnit created in between");
  const result2 = await runTaxonomyJob(REAL_CONTENT_SOURCE_ID);
  created.taxonomyJobIds.push(result2.taxonomyJobId);
  const sourceReadCountAfterTwoRuns = await prisma.sourceRead.count({ where: { contentSourceId: REAL_CONTENT_SOURCE_ID } });
  check("second runTaxonomyJob call still reuses the same SourceRead (no re-extraction)", sourceReadCountAfterTwoRuns, beforeCount);
  ok(
    "second run reports its proposals as duplicates of the first run's still-pending ones, not new rows",
    result2.duplicatesSkipped >= result1.proposalsCreated || result1.proposalsCreated === 0,
    `run1 created=${result1.proposalsCreated}, run2 duplicatesSkipped=${result2.duplicatesSkipped}`
  );

  console.log("\nexistingTopics wiring — the provider actually receives and respects the registry");
  // Pre-create the exact KnowledgeUnit mock would otherwise propose, then run
  // again. mockProvider.ts's own buildMockTaxonomyProposal() checks
  // existingTopics and renames its proposal on a collision (correct behaviour
  // for ANY well-behaved provider, real or mock) — so this does NOT exercise
  // taxonomyReader.ts's defensive alreadyInRegistry filter (that filter is
  // for a LESS compliant model that ignores the instruction; a mock that
  // faithfully honours existingTopics can't be used to force it). What this
  // DOES prove, and is arguably the more important thing: existingTopics is
  // correctly read from the real KnowledgeUnit table and actually reaches the
  // provider call, not silently dropped somewhere in the plumbing.
  const collisionTopic = "demo_topic_from_mock";
  const existingCollision = await prisma.knowledgeUnit.findUnique({ where: { topic: collisionTopic } });
  if (!existingCollision) {
    const fixture = await prisma.knowledgeUnit.create({
      data: { topic: collisionTopic, label: "Collision fixture (test)" },
    });
    created.knowledgeUnitIds.push(fixture.id);

    const result3 = await runTaxonomyJob(REAL_CONTENT_SOURCE_ID);
    created.taxonomyJobIds.push(result3.taxonomyJobId);
    const noLongerColliding = await prisma.pendingKnowledgeUnit.findFirst({
      where: { taxonomyJobId: result3.taxonomyJobId, proposedTopic: collisionTopic },
    });
    if (result3.servedBy === "mock") {
      ok(
        "mock avoided the now-registered topic itself (existingTopics reached the provider call)",
        noLongerColliding === null,
        `a proposal for the collision topic was created anyway: ${JSON.stringify(noLongerColliding)}`
      );
    } else {
      console.log(`  (servedBy=${result3.servedBy}, not mock this run — skipping the mock-specific assertion)`);
    }
  } else {
    console.log("  (skipped — a real KnowledgeUnit with this exact topic already exists, collision test not needed)");
  }
}

main()
  .then(async () => {
    await teardown();
    console.log(`\n${"─".repeat(50)}`);
    console.log(`  passed: ${passed}   failed: ${failed}`);
    await prisma.$disconnect();
    if (failed > 0) process.exitCode = 1;
  })
  .catch(async (e) => {
    console.error("\nFATAL:", e);
    await teardown().catch((cleanupErr) => console.error("teardown also failed:", cleanupErr));
    await prisma.$disconnect();
    process.exitCode = 1;
  });
