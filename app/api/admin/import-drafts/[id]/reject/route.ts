import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { rejectDraft } from "@/lib/services/content-import/importer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const draft = await rejectDraft(id, admin.id, body.reviewNote);
  return NextResponse.json({ draft });
}
