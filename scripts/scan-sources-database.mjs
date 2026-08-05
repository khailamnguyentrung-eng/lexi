// Sub-project C — one-time scan of the external source database folder,
// producing docs/superpowers/state/2026-07-31-c-import-progress.json.
// Not a regression test, not wired into npm run test:all — this is a
// one-off operational tool, matching scripts/backfill-*.{ts,mjs}'s
// precedent in this repo.
//
// Run: node --import tsx scripts/scan-sources-database.mjs
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { classifySourceFile, measureRealTextLength } from "./lib/classifySourceFile.mjs";
import { parseMasterDataXlsx } from "./lib/parseMasterDataXlsx.mjs";
import { extractPdfText } from "../lib/services/content-import/adapters/pdf.ts";

const SOURCE_ROOT = "D:\\Khải Lâm\\Lexi\\[lexi] Sources Database";
const MASTER_DATA_PATH = path.join(SOURCE_ROOT, "04_Classification_Metadata", "Master_Data.xlsx");
const OUTPUT_PATH = path.join(
  process.cwd(),
  "docs",
  "superpowers",
  "state",
  "2026-07-31-c-import-progress.json"
);

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  if (fsSync.existsSync(OUTPUT_PATH) && !process.argv.includes("--force")) {
    console.error(
      `Output already exists at ${OUTPUT_PATH} — refusing to overwrite accumulated progress. ` +
        `Pass --force to overwrite anyway.`
    );
    return;
  }

  console.log(`Scanning ${SOURCE_ROOT} ...`);
  const allFiles = await walkFiles(SOURCE_ROOT);
  console.log(`Found ${allFiles.length} files.`);

  // How many real on-disk files share each normalized basename — needed to
  // detect basename collisions (e.g. "Test 1.pdf" existing in 7 different
  // folders) so a hint isn't silently misattached to unrelated files.
  const basenameCounts = new Map();
  for (const fullPath of allFiles) {
    const key = path.basename(fullPath).toLowerCase().trim();
    basenameCounts.set(key, (basenameCounts.get(key) ?? 0) + 1);
  }

  console.log(`Reading Master_Data.xlsx hints ...`);
  const hints = await parseMasterDataXlsx(MASTER_DATA_PATH);
  console.log(`Loaded ${hints.size} hint rows.`);
  const matchedHintKeys = new Set();

  const files = [];
  let pdfChecked = 0;
  for (const fullPath of allFiles) {
    const relativePath = path.relative(SOURCE_ROOT, fullPath).split(path.sep).join("/");
    const ext = path.extname(fullPath).toLowerCase();

    let extractedTextLength = null;
    if (ext === ".pdf") {
      pdfChecked++;
      try {
        const text = await extractPdfText(fullPath);
        extractedTextLength = measureRealTextLength(text);
      } catch (err) {
        console.warn(`  ! failed to extract text from ${relativePath}: ${err.message}`);
        extractedTextLength = 0;
      }
      if (pdfChecked % 25 === 0) console.log(`  ...checked ${pdfChecked} PDFs so far`);
    }

    const { status, reason } = classifySourceFile({ relativePath, extractedTextLength });
    // Case-insensitive lookup: Windows filenames are case-insensitive, and
    // the spreadsheet's names sometimes differ from the on-disk basename
    // only in case (e.g. on-disk "test 1.pdf" vs. spreadsheet "Test 1.pdf").
    const fileNameKey = path.basename(fullPath).toLowerCase().trim();
    const hint = hints.get(fileNameKey);

    let masterDataHint = null;
    if (hint) {
      matchedHintKeys.add(fileNameKey);
      const isAmbiguous = (basenameCounts.get(fileNameKey) ?? 0) > 1;
      masterDataHint = isAmbiguous
        ? { domain: hint.domain, skill: hint.skill, difficulty: hint.difficulty, ambiguousMatch: true }
        : { domain: hint.domain, skill: hint.skill, difficulty: hint.difficulty };
    }

    files.push({
      relativePath,
      status,
      reason,
      masterDataHint,
      questionCodes: [],
      contentSourceId: null,
      processedAt: null,
    });
  }

  const summary = {
    pending: files.filter((f) => f.status === "pending").length,
    skipped: files.filter((f) => f.status === "skipped").length,
    done: 0,
  };

  const output = {
    generatedAt: new Date().toISOString(),
    sourceRoot: SOURCE_ROOT,
    totalFiles: files.length,
    summary,
    files,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log(`Total: ${files.length}  Pending: ${summary.pending}  Skipped: ${summary.skipped}`);
  const byReason = {};
  for (const f of files.filter((f) => f.status === "skipped")) {
    byReason[f.reason] = (byReason[f.reason] ?? 0) + 1;
  }
  console.log("Skipped breakdown:", byReason);

  const unmatchedHintRows = hints.size - matchedHintKeys.size;
  console.log(
    `Hint rows matched to a real file: ${matchedHintKeys.size}/${hints.size}  ` +
      `(unmatched: ${unmatchedHintRows})`
  );
}

main();
