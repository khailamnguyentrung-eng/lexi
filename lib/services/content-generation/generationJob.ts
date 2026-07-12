/**
 * Generation Job Service — M4.1
 *
 * Prisma access layer for QuestionGenerationJob lifecycle management.
 * All state transitions are validated before any DB write.
 *
 * Architecture: Prisma only here.
 *   Admin trigger → createGenerationJob() → PENDING
 *   draftGenerator.ts → updateJobStatus("GENERATING") → ... → "REVIEWING"
 *   Human review complete → updateJobStatus("COMPLETED")
 */

import { prisma } from "@/lib/db/prisma";
import type {
  GenerationJobInput,
  GenerationJobStatus,
  GenerationJobSummary,
} from "./types";
import { VALID_JOB_TRANSITIONS } from "./types";

// ─────────────────────────────────────────────────────────
// Pure state-machine helper — exported for testing
// ─────────────────────────────────────────────────────────

/**
 * Returns true if transitioning from → to is a valid job status move.
 * COMPLETED and FAILED are terminal states with no outbound transitions.
 */
export function isValidTransition(
  from: GenerationJobStatus,
  to: GenerationJobStatus
): boolean {
  return (VALID_JOB_TRANSITIONS[from] ?? []).includes(to);
}

// ─────────────────────────────────────────────────────────
// Repository helpers (private)
// ─────────────────────────────────────────────────────────

function toSummary(row: {
  id: string;
  topic: string;
  difficulty: string;
  targetCount: number;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): GenerationJobSummary {
  return {
    id: row.id,
    topic: row.topic,
    difficulty: row.difficulty as "EASY" | "MEDIUM" | "HARD",
    targetCount: row.targetCount,
    status: row.status as GenerationJobStatus,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────
// Public service functions
// ─────────────────────────────────────────────────────────

/**
 * Create a new generation job in PENDING state.
 * targetCount is clamped to [1, 20] — no single job requests an unbounded batch.
 */
export async function createGenerationJob(
  input: GenerationJobInput
): Promise<GenerationJobSummary> {
  if (!input.topic.trim()) throw new Error("topic is required");
  if (!["EASY", "MEDIUM", "HARD"].includes(input.difficulty)) {
    throw new Error(`Invalid difficulty: ${input.difficulty}`);
  }
  const targetCount = Math.min(20, Math.max(1, input.targetCount));

  const row = await prisma.questionGenerationJob.create({
    data: {
      topic: input.topic,
      difficulty: input.difficulty,
      targetCount,
      status: "PENDING",
    },
  });
  return toSummary(row);
}

/**
 * Transition a job to a new status.
 * Throws if the transition is invalid — callers must not attempt illegal moves.
 */
export async function updateJobStatus(
  jobId: string,
  to: GenerationJobStatus,
  errorMessage?: string
): Promise<GenerationJobSummary> {
  const current = await prisma.questionGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  const from = current.status as GenerationJobStatus;
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid job status transition: ${from} → ${to}`
    );
  }

  const row = await prisma.questionGenerationJob.update({
    where: { id: jobId },
    data: {
      status: to,
      errorMessage: to === "FAILED" ? (errorMessage ?? "Unknown error") : null,
    },
  });
  return toSummary(row);
}

/**
 * Fetch a single job by id.
 */
export async function getGenerationJob(
  jobId: string
): Promise<GenerationJobSummary> {
  const row = await prisma.questionGenerationJob.findUniqueOrThrow({
    where: { id: jobId },
  });
  return toSummary(row);
}

/**
 * List all jobs for a given topic, most recent first.
 */
export async function listJobsByTopic(
  topic: string
): Promise<GenerationJobSummary[]> {
  const rows = await prisma.questionGenerationJob.findMany({
    where: { topic },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

/**
 * List all jobs in a given status.
 */
export async function listJobsByStatus(
  status: GenerationJobStatus
): Promise<GenerationJobSummary[]> {
  const rows = await prisma.questionGenerationJob.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}
