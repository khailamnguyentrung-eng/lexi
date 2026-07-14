import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { parseJsonBody } from "@/lib/api/parseJsonBody";
import {
  getKnowledgeCoverageReport,
  getAllKnowledgeUnits,
} from "@/lib/services/content-intelligence/knowledgeMapping";
import { createGenerationJob } from "@/lib/services/content-generation/generationJob";
import { generateDraftsForGap } from "@/lib/services/content-generation/aiDraftGenerator";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * M4.5 — Admin-triggered AI question generation for one KnowledgeUnit's
 * coverage gap. Orchestration only: every step below is an existing,
 * separately-tested service (M4.1–M4.4).
 *
 * Synchronous by decision (see docs/superpowers/specs/
 * 2026-07-15-m45-admin-question-generation-design.md): this project has no
 * queue/worker, and firing an un-awaited generation from a route handler
 * would let a serverless freeze strand the job in GENERATING forever —
 * invisibly. A synchronous timeout at least surfaces to the caller. The job
 * record + status machine already exist, so moving to a real background
 * runner later is additive, not a redesign.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { knowledgeUnitId, difficulty, requestedCount } = body as Record<string, unknown>;

  if (typeof knowledgeUnitId !== "string" || !knowledgeUnitId.trim()) {
    return NextResponse.json({ error: "knowledgeUnitId is required" }, { status: 400 });
  }
  if (typeof difficulty !== "string" || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    return NextResponse.json(
      { error: `difficulty must be one of: ${DIFFICULTIES.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof requestedCount !== "number" || !Number.isInteger(requestedCount) || requestedCount < 1) {
    return NextResponse.json(
      { error: "requestedCount must be a positive integer" },
      { status: 400 },
    );
  }

  const unit = await prisma.knowledgeUnit.findUnique({
    where: { id: knowledgeUnitId },
    select: {
      id: true,
      topic: true,
      label: true,
      targetEasyCount: true,
      targetMediumCount: true,
      targetHardCount: true,
    },
  });
  if (!unit) {
    return NextResponse.json({ error: "KnowledgeUnit not found" }, { status: 404 });
  }

  // Resolve the gap BEFORE creating a job: buildGenerationContext() throws
  // when a band has no gap, and creating the job first would leave a
  // pointless FAILED row behind for a request that was never viable.
  const report = await getKnowledgeCoverageReport();
  const gap = report.gaps.find((g) => g.knowledgeUnitId === unit.id);
  if (!gap) {
    return NextResponse.json(
      { error: `KnowledgeUnit "${unit.topic}" has no coverage gap — nothing to generate` },
      { status: 400 },
    );
  }

  // Passed to generateDraftsForGap for M3.4 mapping-quality validation.
  // Never omit: its [] default would silently weaken validation on every draft.
  const knowledgeUnits = await getAllKnowledgeUnits();

  const job = await createGenerationJob({
    topic: unit.topic,
    difficulty: difficulty as Difficulty,
    targetCount: requestedCount,
  });

  try {
    const result = await generateDraftsForGap(
      job.id,
      unit,
      gap,
      difficulty as Difficulty,
      requestedCount,
      knowledgeUnits,
    );
    return NextResponse.json({
      jobId: result.jobId,
      generatorUsed: result.generatorUsed,
      drafts: result.drafts,
    });
  } catch (err) {
    // generateDraftsForGap already marked the job FAILED with a message —
    // that row is the durable record. This response is best-effort.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed", jobId: job.id },
      { status: 500 },
    );
  }
}
