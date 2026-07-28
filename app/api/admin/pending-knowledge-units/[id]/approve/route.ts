import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  approvePendingKnowledgeUnit,
  TopicAlreadyExistsError,
} from "@/lib/services/content-intelligence/pendingKnowledgeUnitReview";

// Also handles Rename: pass { topic, label } in the body to override the
// proposal's own values before approving. See the service function's docstring.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const override =
    body.topic || body.label ? { topic: body.topic, label: body.label } : undefined;

  try {
    const result = await approvePendingKnowledgeUnit(id, admin.id, override);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TopicAlreadyExistsError) {
      return NextResponse.json(
        { error: err.message, existingKnowledgeUnitId: err.existingKnowledgeUnitId },
        { status: 409 }
      );
    }
    throw err;
  }
}
