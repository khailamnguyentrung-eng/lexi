/**
 * QM-1 backfill — derive `Question.payload` from the legacy A/B/C/D columns.
 *
 * Run:  npx tsx prisma/backfill-question-payload.ts [--apply]
 *
 * Dry-run by default. This repo has a documented history of dry-run paths
 * behaving differently from real ones (see the chunker: only the dry-run calls
 * it), so this script deliberately runs the SAME derivation in both modes and
 * differs only in whether it writes.
 *
 * Idempotent: rows that already have a payload are skipped, so re-running after
 * a partial failure is safe.
 *
 * Why every existing row is SINGLE_CHOICE: all 122 are 4-option MCQ, which is
 * faithful to the exam they came from — examBlueprint.ts records Hà Nội G10 as
 * "100% multiple choice (A/B/C/D), machine-marked". The reform is about what
 * comes NEXT (IELTS, academic sources), not about correcting this data.
 *
 * QuestionAttempt.response is deliberately NOT backfilled: V1_V2_RECONCILIATION.md
 * rules all 31 attempt rows are developer click-testing and get dropped, so
 * converting them would be work spent on rows already scheduled for deletion.
 */

import { PrismaClient } from "@prisma/client";
import {
  payloadFromLegacyColumns,
  validatePayload,
  type QuestionFormatFields,
} from "../lib/services/question-format";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: apply (writing)" : "MODE: dry-run (no writes) — pass --apply to write");

  const questions = await prisma.question.findMany({
    select: {
      id: true,
      questionCode: true,
      responseFormat: true,
      payload: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctOption: true,
    },
  });

  let skipped = 0;
  let written = 0;
  const invalid: { code: string; issues: string[] }[] = [];

  for (const q of questions) {
    if (q.payload !== null && q.payload.length > 0) {
      skipped++;
      continue;
    }
    if (q.responseFormat !== "SINGLE_CHOICE") {
      // Cannot derive a non-MCQ payload from four MCQ columns. Surface it
      // rather than guessing — guessing is what produced the problem.
      invalid.push({ code: q.questionCode, issues: [`responseFormat=${q.responseFormat} has no legacy source`] });
      continue;
    }

    const payload = payloadFromLegacyColumns(q as QuestionFormatFields);
    if (payload === null) {
      // SINGLE_CHOICE but one or more legacy columns are null (sub-project B
      // widened them) — nothing to derive from, and no payload already present
      // (checked above), so this row genuinely has no answer key to backfill.
      invalid.push({ code: q.questionCode, issues: ["responseFormat=SINGLE_CHOICE but legacy A/B/C/D columns are null"] });
      continue;
    }
    const result = validatePayload("SINGLE_CHOICE", payload);

    if (!result.valid) {
      invalid.push({ code: q.questionCode, issues: result.issues.map((i) => `${i.field}: ${i.message}`) });
      continue;
    }

    if (apply) {
      await prisma.question.update({
        where: { id: q.id },
        data: { payload: JSON.stringify(payload) },
      });
    }
    written++;
  }

  console.log(`\n  total      : ${questions.length}`);
  console.log(`  ${apply ? "written   " : "would write"} : ${written}`);
  console.log(`  skipped    : ${skipped} (already had a payload)`);
  console.log(`  invalid    : ${invalid.length}`);

  if (invalid.length > 0) {
    console.log("\nINVALID — not written, needs a human:");
    for (const row of invalid) console.log(`  ${row.code}: ${row.issues.join("; ")}`);
  }

  // Verification is part of the run, not a separate trust-me step.
  if (apply) {
    const remaining = await prisma.question.count({ where: { payload: null } });
    console.log(`\nVERIFY: questions still without a payload = ${remaining}`);
    if (remaining > 0 && invalid.length === 0) {
      console.log("  ⚠️  unexpected — a row was neither written nor reported invalid");
      process.exitCode = 1;
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
