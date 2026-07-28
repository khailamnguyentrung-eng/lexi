import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { mergePendingKnowledgeUnit } from "@/lib/services/content-intelligence/pendingKnowledgeUnitReview";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.targetKnowledgeUnitId) {
    return NextResponse.json({ error: "targetKnowledgeUnitId is required" }, { status: 400 });
  }

  const result = await mergePendingKnowledgeUnit(id, body.targetKnowledgeUnitId, admin.id, body.reviewNote);
  return NextResponse.json(result);
}
