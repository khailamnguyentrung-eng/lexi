import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveSessionId } from "@/lib/analytics/repository";
import { getSessionAnalytics } from "@/lib/analytics/service";
import { toSessionAnalyticsResponse } from "@/lib/analytics/contracts";

/**
 * GET /api/analytics/session/[sessionNumber]
 *
 * Returns full analytics for one curriculum session:
 *   - readiness score, band, confidence
 *   - blueprint coverage (assessed/partial/unassessed per section)
 *   - top-3 weakness topics with notebook context
 *   - section-level breakdown for tutor view
 *
 * No Prisma queries here — all DB access goes through the analytics
 * repository and service layers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionNumber: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionNumber: sessionNumberStr } = await params;
  const sessionNumber = Number(sessionNumberStr);
  if (!Number.isInteger(sessionNumber) || sessionNumber < 1) {
    return NextResponse.json({ error: "Invalid session number" }, { status: 400 });
  }

  const curriculumSessionId = await resolveSessionId(sessionNumber);
  if (!curriculumSessionId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const analytics = await getSessionAnalytics(user.id, curriculumSessionId, sessionNumber);
  return NextResponse.json(toSessionAnalyticsResponse(analytics));
}
