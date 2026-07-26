/**
 * The "add a source, get a lesson" mechanism the founder asked for.
 *
 * Idempotent and additive-only: for every KnowledgeUnit not yet covered by
 * ANY slot in a Program, appends exactly one new ProgramCurriculum slot for
 * it (order = current max + 1, title = the KU's own label). Never touches an
 * existing slot — never reorders, never edits, never merges into it. That
 * constraint is deliberate: a learner partway through a Program must never
 * have their progress reshuffled under them because someone imported a new
 * document. Growing a Program is monotonic — always additions at the end.
 *
 * Called from two places:
 *   - lib/services/content-intelligence/pendingKnowledgeUnitReview.ts, right
 *     after approvePendingKnowledgeUnit()/mergePendingKnowledgeUnit() resolve
 *     a KU-1 part B proposal — so a newly-approved KnowledgeUnit gets a
 *     lesson slot in the SAME action a human approves it, not a separate
 *     manual step. This is what makes "ngay" (immediately) literally true.
 *   - an admin action, for re-running by hand if ever needed.
 *
 * Only touches the demo Program by default (see DEMO_PROGRAM_SLUG) — v1 has
 * exactly one Program, and auto-growing every Program that might exist later
 * on every KU approval is a decision for whenever a second Program exists,
 * not one to make now.
 */

import { prisma } from "@/lib/db/prisma";
import { DEMO_PROGRAM_SLUG } from "./seedDemoProgram";

export interface AssembleGapsResult {
  programId: string;
  slotsCreated: number;
  createdForTopics: string[];
}

export async function assembleProgramGaps(programSlug: string = DEMO_PROGRAM_SLUG): Promise<AssembleGapsResult> {
  const program = await prisma.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true,
      curriculum: {
        select: { order: true, knowledgeUnits: { select: { knowledgeUnitId: true } } },
      },
    },
  });
  // No Program yet (seedDemoProgram() hasn't run) — nothing to grow.
  // Not an error: callers (e.g. the review-queue approve path) fire on every
  // KU resolution regardless of whether a Program exists yet.
  if (!program) return { programId: "", slotsCreated: 0, createdForTopics: [] };

  const alreadyCoveredUnitIds = new Set(
    program.curriculum.flatMap((slot) => slot.knowledgeUnits.map((k) => k.knowledgeUnitId))
  );
  let nextOrder = program.curriculum.reduce((max, slot) => Math.max(max, slot.order), 0) + 1;

  const allUnits = await prisma.knowledgeUnit.findMany({
    where: { id: { notIn: [...alreadyCoveredUnitIds] } },
    select: { id: true, topic: true, label: true },
    orderBy: { topic: "asc" }, // deterministic order for units that arrive in the same batch
  });

  const createdForTopics: string[] = [];
  for (const unit of allUnits) {
    await prisma.programCurriculum.create({
      data: {
        programId: program.id,
        order: nextOrder,
        title: unit.label,
        objective: null, // no curated objective yet — the UI falls back to the KU label; a human can edit later via existing admin tooling once it exists
        knowledgeUnits: { create: [{ knowledgeUnitId: unit.id }] },
      },
    });
    createdForTopics.push(unit.topic);
    nextOrder++;
  }

  return { programId: program.id, slotsCreated: createdForTopics.length, createdForTopics };
}
