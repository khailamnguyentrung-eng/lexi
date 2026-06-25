import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { runImportJob } from "@/lib/services/content-import/importer";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const job = await runImportJob(id);
  return NextResponse.json({ job });
}
