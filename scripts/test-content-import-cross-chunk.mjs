/**
 * Final whole-branch review — Finding 1 & 2: normalizeAndPersistDrafts()
 * must (1) reject BOTH copies of a questionCode that recurs across chunks
 * (normalizeLargeDocument()'s duplicateQuestionCodesAcrossBatches was
 * previously computed but discarded — both copies got persisted as
 * PENDING_REVIEW, and approving the second one threw on the DB's unique
 * constraint), and (2) never silently no-op when every chunk's AI call
 * fails (previously indistinguishable from "no questions found").
 *
 * This drives the real chunker (chunkBySections) with two "PHẦN N – ĐỀ
 * TEST" headers so the document splits into two independent AI calls. In
 * this repo's current env (AI_PROVIDER=gemini with a known-dead quota —
 * see MEMORY.md), each call falls back to mockProvider, whose
 * buildMockDrafts() derives questionCode from the ContentSource's
 * fileName only (not chunk content) — so both chunks deterministically
 * produce the same two codes. That is exactly the seam Finding 1 covers.
 *
 * Finding 2's total-failure path (every chunk throwing) is NOT exercised
 * here — withRuntimeFallback's mock fallback never throws for well-formed
 * input, so there is no way to force a real total AI failure without
 * reaching into provider internals. That branch was verified by manual
 * code review instead (see final-review-fix-report.md).
 *
 * Run: node --import tsx scripts/test-content-import-cross-chunk.mjs
 */
import { prisma } from "../lib/db/prisma.ts";
import { createContentSource, normalizeAndPersistDrafts } from "../lib/services/content-import/importer.ts";

let passed = 0;
let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.log("  (skip: no ADMIN user in DB — run npm run db:seed first)");
    process.exitCode = 1;
    return;
  }

  const fileName = `test-cross-chunk-${Date.now()}.docx`;
  const contentSource = await createContentSource({
    userId: admin.id,
    fileName,
    fileType: "DOCX",
    storagePath: "test/does-not-exist.docx",
  });
  const importJob = await prisma.importJob.create({
    data: { contentSourceId: contentSource.id, status: "EXTRACTING" },
  });

  // Two PHẦN headers force chunkBySections() to split into 2 independent
  // chunks (see lib/services/content-import/chunker.ts) — each gets its
  // own normalizeWithAI() call.
  const rawText = [
    "PHẦN 1 – ĐỀ TEST ĐẦU VÀO",
    "1. Some question text for part 1.",
    "",
    "PHẦN 2 – ĐỀ TEST GIỮA KỲ",
    "1. Some question text for part 2.",
  ].join("\n");

  try {
    await normalizeAndPersistDrafts(importJob.id, rawText, contentSource);

    const drafts = await prisma.extractedQuestionDraft.findMany({
      where: { importJobId: importJob.id },
    });
    check("drafts were persisted", drafts.length > 0, `got ${drafts.length}`);

    const byCode = new Map();
    for (const d of drafts) {
      const data = JSON.parse(d.normalizedData);
      const list = byCode.get(data.questionCode) ?? [];
      list.push(d);
      byCode.set(data.questionCode, list);
    }

    const duplicated = [...byCode.entries()].filter(([, list]) => list.length > 1);
    check(
      "this fixture actually produced a cross-chunk duplicate questionCode (precondition for the test)",
      duplicated.length > 0,
      `codes: ${[...byCode.keys()].join(", ")}`,
    );

    // The core regression check for Finding 1: no two drafts sharing a
    // questionCode may BOTH be PENDING_REVIEW — that's the exact state
    // that used to throw on Question_questionCode_key at approve time.
    let anyDuplicatePendingTogether = false;
    for (const [code, list] of duplicated) {
      const pendingCount = list.filter((d) => d.reviewStatus === "PENDING_REVIEW").length;
      if (pendingCount > 1) {
        anyDuplicatePendingTogether = true;
        console.log(`    ! ${code} has ${pendingCount} PENDING_REVIEW copies`);
      }
      // Every copy of a duplicated code should be REJECTED with a note
      // that mentions the cross-chunk duplicate, per the fix.
      for (const d of list) {
        check(
          `duplicate draft ${code} (${d.id}) is REJECTED`,
          d.reviewStatus === "REJECTED",
          `actual: ${d.reviewStatus}`,
        );
        check(
          `duplicate draft ${code} (${d.id}) reviewNote mentions cross-chunk duplicate`,
          typeof d.reviewNote === "string" && d.reviewNote.includes("trùng questionCode"),
          `actual note: ${d.reviewNote}`,
        );
      }
    }
    check("no duplicated questionCode has more than one PENDING_REVIEW copy", !anyDuplicatePendingTogether);
  } finally {
    await prisma.extractedQuestionDraft.deleteMany({ where: { importJobId: importJob.id } });
    await prisma.importJob.delete({ where: { id: importJob.id } });
    await prisma.contentSource.delete({ where: { id: contentSource.id } });
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  passed: ${passed}   failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
  await prisma.$disconnect();
}

main();
