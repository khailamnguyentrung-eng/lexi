import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseJsonBody } from "@/lib/api/parseJsonBody";

/**
 * RT-1 ("Consumed", Ch.3 §3.1 Lifecycle / §3.3 Invariant 5): records the
 * learner's ACCEPTED response to a specific Recommendation issuance as
 * append-only Evidence. Called by the recommendation CTA on Home and Results
 * just before navigation.
 *
 * Only ACCEPTED exists today — OVERRIDDEN/IGNORED need §3.5 thresholds that
 * are deliberately still open, so no responseType is taken from the client.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { issuanceId } = body as Record<string, unknown>;
  if (typeof issuanceId !== "string" || !issuanceId) {
    return NextResponse.json({ error: "issuanceId is required" }, { status: 400 });
  }

  // The issuance must exist and belong to this learner — §3.1: only the
  // *targeted Learner's own* response becomes Evidence.
  const issuance = await prisma.recommendationIssuance.findFirst({
    where: { id: issuanceId, userId: user.id },
    select: { id: true },
  });
  if (!issuance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const response = await prisma.recommendationResponse.create({
    data: {
      userId: user.id,
      recommendationIssuanceId: issuance.id,
      responseType: "ACCEPTED",
    },
  });

  return NextResponse.json({ response }, { status: 201 });
}
