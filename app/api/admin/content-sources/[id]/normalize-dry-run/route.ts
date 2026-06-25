import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { fileExtractor } from "@/lib/services/content-import/extractor";
import { normalizeLargeDocument } from "@/lib/services/content-import/normalizeLargeDocument";

// Dry run only — never creates an ImportJob, ExtractedQuestionDraft, or
// Question row. Extracts + chunks + normalizes + validates the whole
// document and returns a summary (incl. a full run report — provider,
// model, chunk/timing/retry counts, never an API key) for the admin to
// inspect before deciding whether a real import is worth running.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const contentSource = await prisma.contentSource.findUniqueOrThrow({ where: { id } });
    const { rawText } = await fileExtractor.extract(contentSource);
    const result = await normalizeLargeDocument(rawText, contentSource);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
