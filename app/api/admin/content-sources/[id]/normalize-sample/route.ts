import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { runSampleNormalization } from "@/lib/services/content-import/sampleTest";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const result = await runSampleNormalization(id, 5);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
