/**
 * Sub-project C — parseMasterDataXlsx() must read the founder's real
 * classification spreadsheet and return a lookup by file name.
 *
 * Run: npm run test:parse-master-data-xlsx
 */
import fs from "node:fs";
import { parseMasterDataXlsx } from "./lib/parseMasterDataXlsx.mjs";

const MASTER_DATA_PATH =
  "D:\\Khải Lâm\\Lexi\\[lexi] Sources Database\\04_Classification_Metadata\\Master_Data.xlsx";

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

async function main() {
  if (!fs.existsSync(MASTER_DATA_PATH)) {
    console.log(`  (skip: ${MASTER_DATA_PATH} not found on this machine)`);
    return;
  }

  const hints = await parseMasterDataXlsx(MASTER_DATA_PATH);

  check("returns a Map", hints instanceof Map, true);
  check("has more than 50 entries (real spreadsheet has ~100+ rows)", hints.size > 50, true);

  // Keys are normalized (lowercased/trimmed) — see parseMasterDataXlsx.mjs's
  // case-insensitive basename matching fix.
  const knownRow = hints.get("00. file full tuần 4.pdf");
  check("known real row: 00. FILE FULL TUẦN 4.pdf exists (case-insensitive key)", knownRow !== undefined, true);
  check("known real row: domain is THPT", knownRow?.domain, "THPT");
  check("known real row: skill is VERBAL", knownRow?.skill, "VERBAL");
  check("known real row: difficulty is Level 2 - Medium", knownRow?.difficulty, "Level 2 - Medium");
  check("known real row: status is not part of the returned shape", knownRow?.status, undefined);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  passed: ${passed}   failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
