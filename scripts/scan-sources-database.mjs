// Sub-project C — one-time scan of the external source database folder,
// producing docs/superpowers/state/2026-07-31-c-import-progress.json.
// Not a regression test, not wired into npm run test:all — this is a
// one-off operational tool, matching scripts/backfill-*.{ts,mjs}'s
// precedent in this repo.
//
// Run: node --import tsx scripts/scan-sources-database.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { classifySourceFile } from "./lib/classifySourceFile.mjs";
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

// pdf-parse's joined getText() output inserts a "-- N of M --" separator
// between every page's text, even for pages with zero real text content —
// for a genuinely scanned multi-page PDF this boilerplate alone can exceed
// classifySourceFile's PDF_TEXT_LAYER_MIN_CHARS threshold (measured: a
// 24-page scanned PDF returns 423 raw characters that are 100% separator
// noise, none of it real text). Strip the separators before measuring
// length so "has a text layer" reflects actual extracted content, not
// how many pages the scanned file happens to have.
const PDF_PAGE_SEPARATOR_RE = /--\s*\d+\s*of\s*\d+\s*--/g;

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
  console.log(`Scanning ${SOURCE_ROOT} ...`);
  const allFiles = await walkFiles(SOURCE_ROOT);
  console.log(`Found ${allFiles.length} files.`);

  console.log(`Reading Master_Data.xlsx hints ...`);
  const hints = await parseMasterDataXlsx(MASTER_DATA_PATH);
  console.log(`Loaded ${hints.size} hint rows.`);

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
        extractedTextLength = text.replace(PDF_PAGE_SEPARATOR_RE, "").trim().length;
      } catch (err) {
        console.warn(`  ! failed to extract text from ${relativePath}: ${err.message}`);
        extractedTextLength = 0;
      }
      if (pdfChecked % 25 === 0) console.log(`  ...checked ${pdfChecked} PDFs so far`);
    }

    const { status, reason } = classifySourceFile({ relativePath, extractedTextLength });
    const fileName = path.basename(fullPath);
    const hint = hints.get(fileName);

    files.push({
      relativePath,
      status,
      reason,
      masterDataHint: hint
        ? { domain: hint.domain, skill: hint.skill, difficulty: hint.difficulty }
        : null,
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
}

main();
