import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveSessionId } from "@/lib/analytics/repository";
import { getSessionComparison } from "@/lib/analytics/service";
import { toSessionComparisonResponse } from "@/lib/analytics/contracts";

/**
 * GET /api/analytics/compare/[sessionA]/[sessionB]
 *
 * Returns a topic-level comparison between two curriculum sessions:
 *   - Per-topic direction: IMPROVED / DECLINED / SIMILAR / INSUFFICIENT_DATA
 *   - Accuracy delta per topic (null when insufficient data)
 *   - Aggregate improved/declined/insufficientData counts
 *
 * Topics with < 2 attempts in either session are reported as
 * INSUFFICIENT_DATA rather than silently excluded, so callers always
 * know the full topic list was considered.
 *
 * No Prisma queries here — all DB access goes through the analytics
 * repository and service layers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionA: string; sessionB: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionA: sessionAStr, sessionB: sessionBStr } = await params;
  const sessionANumber = Number(sessionAStr);
  const sessionBNumber = Number(sessionBStr);

  if (!Number.isInteger(sessionANumber) || sessionANumber < 1) {
    return NextResponse.json({ error: "Invalid sessionA" }, { status: 400 });
  }
  if (!Number.isInteger(sessionBNumber) || sessionBNumber < 1) {
    return NextResponse.json({ error: "Invalid sessionB" }, { status: 400 });
  }
  if (sessionANumber === sessionBNumber) {
    return NextResponse.json({ error: "Sessions must be different" }, { status: 400 });
  }

  const [sessionAId, sessionBId] = await Promise.all([
    resolveSessionId(sessionANumber),
    resolveSessionId(sessionBNumber),
  ]);

  if (!sessionAId) return NextResponse.json({ error: "Session A not found" }, { status: 404 });
  if (!sessionBId) return NextResponse.json({ error: "Session B not found" }, { status: 404 });

  const comparison = await getSessionComparison(
    user.id,
    sessionAId,
    sessionBId,
    sessionANumber,
    sessionBNumber
  );

  return NextResponse.json(toSessionComparisonResponse(comparison));
}
