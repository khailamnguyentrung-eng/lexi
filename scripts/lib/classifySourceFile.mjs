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
