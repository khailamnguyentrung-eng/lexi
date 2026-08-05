// Sub-project C — reads the founder's existing per-file classification
// spreadsheet (04_Classification_Metadata/Master_Data.xlsx) into a
// lookup by file name. Used only to populate scan-sources-database.mjs's
// masterDataHint field — an informational hint, never authoritative (see
// the plan's Global Constraints).
//
// .xlsx is a zip of XML files. jszip unpacks the zip; @xmldom/xmldom
// parses the two XML files that matter: xl/sharedStrings.xml (the pool of
// text strings cells reference by index) and xl/worksheets/sheet1.xml
// (the actual grid, referencing cells like <c r="A2" t="s"><v>7</v></c>
// where a t="s" cell's value 7 is an INDEX into sharedStrings, not the
// text itself).
import fs from "node:fs/promises";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

function parseSharedStrings(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = Array.from(doc.getElementsByTagName("si"));
  return items.map((si) => {
    // A shared string can contain multiple <t> runs (rich text formatting
    // splits one logical string across several <r><t> pairs) — concatenate
    // all <t> text within this <si>, not just the first.
    const tNodes = Array.from(si.getElementsByTagName("t"));
    return tNodes.map((t) => t.textContent ?? "").join("");
  });
}

// Column letter from a cell reference like "C7" -> "C".
function columnLetterOf(cellRef) {
  const match = cellRef.match(/^([A-Z]+)\d+$/);
  return match ? match[1] : "";
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const rowNodes = Array.from(doc.getElementsByTagName("row"));
  return rowNodes.map((rowNode) => {
    const cells = Array.from(rowNode.getElementsByTagName("c"));
    const row = {};
    for (const cell of cells) {
      const ref = cell.getAttribute("r");
      if (!ref) continue;
      const col = columnLetterOf(ref);
      const type = cell.getAttribute("t");
      const vNode = cell.getElementsByTagName("v")[0];
      const rawValue = vNode?.textContent ?? "";
      row[col] = type === "s" ? (sharedStrings[Number(rawValue)] ?? "") : rawValue;
    }
    return row;
  });
}

const HEADER_LABELS = {
  name: "TÊN",
  domain: "MÔN",
  skill: "KỸ NĂNG",
  difficulty: "MỨC ĐỘ",
};

export async function parseMasterDataXlsx(xlsxFilePath) {
  const buffer = await fs.readFile(xlsxFilePath);
  const zip = await JSZip.loadAsync(buffer);

  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!sharedStringsXml || !sheetXml) {
    throw new Error(`${xlsxFilePath} is missing xl/sharedStrings.xml or xl/worksheets/sheet1.xml`);
  }

  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseSheetRows(sheetXml, sharedStrings);

  // Row 1 is the header — map each known label to its column letter so
  // this doesn't hardcode "name is column A" (robust to column reordering).
  const headerRow = rows[0] ?? {};
  const columnFor = {};
  for (const [key, label] of Object.entries(HEADER_LABELS)) {
    const found = Object.entries(headerRow).find(([, value]) => value?.trim() === label);
    if (found) columnFor[key] = found[0];
  }
  if (!columnFor.name) {
    throw new Error(`${xlsxFilePath}: could not find a "${HEADER_LABELS.name}" header column`);
  }
  // domain/skill/difficulty/status are informational hints, not required —
  // don't throw if their header is missing/renamed, but don't fail silently
  // either: warn so a renamed/reordered/whitespace-mismatched column shows
  // up as an obvious signal instead of every row quietly getting `null`.
  for (const [key, label] of Object.entries(HEADER_LABELS)) {
    if (key === "name") continue;
    if (!columnFor[key]) {
      console.warn(
        `parseMasterDataXlsx: could not find a "${label}" header column in ${xlsxFilePath} — all rows will get null for "${key}"`,
      );
    }
  }

  const hints = new Map();
  for (const row of rows.slice(1)) {
    const fileName = row[columnFor.name]?.trim();
    if (!fileName) continue;
    // Keyed on a case/whitespace-normalized basename: Windows filenames are
    // case-insensitive, and the spreadsheet's file names sometimes differ
    // from the on-disk basename only in case — normalize both sides of the
    // lookup the same way (see scan-sources-database.mjs's hints.get call).
    hints.set(fileName.toLowerCase().trim(), {
      domain: row[columnFor.domain]?.trim() || null,
      skill: row[columnFor.skill]?.trim() || null,
      difficulty: row[columnFor.difficulty]?.trim() || null,
    });
  }
  return hints;
}
