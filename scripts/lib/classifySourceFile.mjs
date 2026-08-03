// Sub-project C — pure classification rule for one file in the source
// database. No I/O: the caller (scan-sources-database.mjs) does the real
// file reading and passes in what this function needs to decide.
//
// The 50-character threshold for PDF text-layer detection is chosen from
// real measurements on this project's actual source files: a genuinely
// scanned PDF returns 0 extracted characters via extractPdfText() (the
// same extractor the real app uses); a short 4-page PDF with a real text
// layer returns ~9000 characters even with minimal content, because
// headers/footers repeat on every page. See the plan's Global Constraints
// for the measurement this threshold is based on.
const AUDIO_VIDEO_EXTENSIONS = new Set([".mp3", ".mp4", ".m4a", ".wma"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls"]);
const DOC_EXTENSIONS = new Set([".docx", ".doc"]);
const PDF_TEXT_LAYER_MIN_CHARS = 50;

// pdf-parse's joined getText() output inserts a "-- N of M --" separator
// between every page's text, even for pages with zero real text content —
// for a genuinely scanned multi-page PDF this boilerplate alone can exceed
// PDF_TEXT_LAYER_MIN_CHARS (measured: a 24-page scanned PDF returns 423 raw
// characters that are 100% separator noise, none of it real text). Strip
// the separators before measuring length so "has a text layer" reflects
// actual extracted content, not how many pages the scanned file happens to
// have.
const PDF_PAGE_SEPARATOR_RE = /--\s*\d+\s*of\s*\d+\s*--/g;

// Pure — no I/O. Strips pdf-parse's page-separator boilerplate and returns
// the length of what's left, trimmed.
export function measureRealTextLength(text) {
  return text.replace(PDF_PAGE_SEPARATOR_RE, "").trim().length;
}

function extensionOf(relativePath) {
  const dot = relativePath.lastIndexOf(".");
  return dot === -1 ? "" : relativePath.slice(dot).toLowerCase();
}

export function classifySourceFile({ relativePath, extractedTextLength }) {
  const ext = extensionOf(relativePath);

  if (AUDIO_VIDEO_EXTENSIONS.has(ext)) return { status: "skipped", reason: "audio_video" };
  if (IMAGE_EXTENSIONS.has(ext)) return { status: "skipped", reason: "image" };
  if (SPREADSHEET_EXTENSIONS.has(ext)) return { status: "skipped", reason: "spreadsheet" };
  if (DOC_EXTENSIONS.has(ext)) return { status: "pending", reason: null };

  if (ext === ".pdf") {
    if ((extractedTextLength ?? 0) < PDF_TEXT_LAYER_MIN_CHARS) {
      return { status: "skipped", reason: "no_text_layer" };
    }
    return { status: "pending", reason: null };
  }

  return { status: "skipped", reason: "other" };
}
