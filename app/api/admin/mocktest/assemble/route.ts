import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { assembleBlueprintTemplate } from "@/lib/services/mocktest/templateAssembler";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Thi thử vào 10 — Hà Nội";

  const result = await assembleBlueprintTemplate(title);
  return NextResponse.json(result);
}
