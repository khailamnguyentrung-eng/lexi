import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { assembleRealExamTemplates } from "@/lib/services/mocktest/realExamAssembler";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await assembleRealExamTemplates();
  return NextResponse.json(result);
}
