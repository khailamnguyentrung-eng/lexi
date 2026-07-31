import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/admin";
import { createContentSource, runImportJob } from "@/lib/services/content-import/importer";
import { resolveStoragePath, toStoragePath } from "@/lib/services/content-import/storagePath";
import type { ContentFileType } from "@prisma/client";

const EXT_TO_FILE_TYPE: Record<string, ContentFileType> = {
  ".pdf": "PDF",
  ".doc": "DOCX",
  ".docx": "DOCX",
  ".png": "IMAGE",
  ".jpg": "IMAGE",
  ".jpeg": "IMAGE",
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// No cap existed before; real exam docs in this project are small (<40KB),
// but nothing stopped an admin from uploading something huge and loading
// it entirely into memory via arrayBuffer(). 20MB comfortably covers a
// scanned multi-page exam PDF while avoiding that failure mode.
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const sourceLabel = formData.get("sourceLabel");
  const province = formData.get("province");
  const examYearRaw = formData.get("examYear");
  const examType = formData.get("examType");
  const gradeLevel = formData.get("gradeLevel");
  const subject = formData.get("subject");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  const fileType = EXT_TO_FILE_TYPE[ext];
  if (!fileType) {
    return NextResponse.json({ error: `Unsupported file type: ${ext || "(none)"}` }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 20MB.` },
      { status: 400 },
    );
  }

  const examYear =
    typeof examYearRaw === "string" && examYearRaw.trim() !== "" ? Number(examYearRaw) : undefined;
  if (examYear !== undefined && Number.isNaN(examYear)) {
    return NextResponse.json({ error: "examYear must be a number" }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const storedName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const relativeStoragePath = toStoragePath(storedName);
  await fs.writeFile(resolveStoragePath(relativeStoragePath), Buffer.from(await file.arrayBuffer()));

  const contentSource = await createContentSource({
    userId: admin.id,
    fileName: file.name,
    fileType,
    storagePath: relativeStoragePath,
    sourceLabel: typeof sourceLabel === "string" && sourceLabel ? sourceLabel : undefined,
    province: typeof province === "string" && province ? province : undefined,
    examYear,
    examType: typeof examType === "string" && examType ? examType : undefined,
    gradeLevel: typeof gradeLevel === "string" && gradeLevel ? gradeLevel : undefined,
    subject: typeof subject === "string" && subject ? subject : undefined,
  });

  // Sub-project B: auto-run extraction synchronously on upload instead of
  // requiring a separate manual "Chạy trích xuất" click. Accepted latency
  // tradeoff, same precedent as M4.5 (see DECISION_LOG) — no background job
  // queue exists in this Next.js serverless setup, so a large document's
  // chunked AI calls (Task 6) run sequentially within this one request.
  // A failure here does not fail the upload itself — the ContentSource row
  // already exists and RunExtractionButton remains available to retry.
  let job = null;
  try {
    job = await runImportJob(contentSource.id);
  } catch (err) {
    console.error(`Auto-extraction failed for ContentSource ${contentSource.id}:`, err);
  }

  return NextResponse.json({ contentSource, job }, { status: 201 });
}
