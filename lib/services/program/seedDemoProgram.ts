/**
 * Seed the demo Program from the existing 24-session curated curriculum
 * (prisma/seed-data/curriculum.json) — the "demo data filling a fixed
 * structure" the founder asked for. Reads from the SAME file `seed.ts`
 * already uses to seed CurriculumSession; does not touch or duplicate that
 * data source, and does not touch CurriculumSession itself.
 *
 * Matching a session's grammarTopics to real KnowledgeUnits reuses
 * `findMatchingKnowledgeUnitId()` — the same exact-string-only matcher used
 * everywhere else in this codebase (M3.3's "no fuzzy matching" decision).
 * Measured before writing this: 29 of 54 grammarTopics strings across the 24
 * sessions match a real KnowledgeUnit exactly; the other 25 don't (curriculum-
 * authoring spelling drift like "modals_advice" vs the real
 * "modal_verbs_advice", or genuinely cumulative review/checkpoint sessions
 * with no single topic by design). Unmatched topics are SKIPPED and
 * reported, never guessed at — a wrong KU link would be a silently
 * fabricated fact the review queue's whole discipline exists to prevent
 * elsewhere.
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { findMatchingKnowledgeUnitId } from "@/lib/services/content-intelligence/questionKnowledgeMapping";

interface ProgramSeedSessionSource {
  sessionNumber: number;
  title: string;
  objective: string;
  grammarTopics: string[];
  sessionType: string;
}

interface CurriculumSeedFile {
  sessions: ProgramSeedSessionSource[];
}

export interface SeedDemoProgramResult {
  programId: string;
  slug: string;
  alreadyExisted: boolean;
  slotsCreated: number;
  sessionsWithNoMatchedKU: { sessionNumber: number; title: string }[];
  unmatchedTopics: string[];
}

const DEMO_PROGRAM_SLUG = "thi-vao-10-ha-noi";

/**
 * Idempotent: if the demo Program already exists (by slug), returns it
 * untouched rather than creating a duplicate or re-seeding its slots — this
 * function seeds the INITIAL 24 slots once; growing the Program afterward is
 * assembleProgramGaps()'s job, not this function's.
 */
export async function seedDemoProgram(): Promise<SeedDemoProgramResult> {
  const existing = await prisma.program.findUnique({ where: { slug: DEMO_PROGRAM_SLUG } });
  if (existing) {
    return {
      programId: existing.id,
      slug: existing.slug,
      alreadyExisted: true,
      slotsCreated: 0,
      sessionsWithNoMatchedKU: [],
      unmatchedTopics: [],
    };
  }

  const filePath = path.join(process.cwd(), "prisma/seed-data/curriculum.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CurriculumSeedFile;

  const units = await prisma.knowledgeUnit.findMany({ select: { id: true, topic: true } });

  const program = await prisma.program.create({
    data: {
      slug: DEMO_PROGRAM_SLUG,
      title: "Thi thử vào 10 — Hà Nội",
      description:
        "Chương trình mẫu, chuyển từ 24 buổi học đã curate sang cấu trúc Program mới. Đây là dữ liệu demo trong một cấu trúc chung — không phải chương trình duy nhất có thể có.",
      targetExam: "hanoi_thpt",
    },
  });

  const sessionsWithNoMatchedKU: SeedDemoProgramResult["sessionsWithNoMatchedKU"] = [];
  const unmatchedTopics = new Set<string>();
  let slotsCreated = 0;

  for (const session of data.sessions) {
    const matchedUnitIds: string[] = [];
    for (const topic of session.grammarTopics ?? []) {
      const unitId = findMatchingKnowledgeUnitId(topic, units);
      if (unitId) matchedUnitIds.push(unitId);
      else unmatchedTopics.add(topic);
    }
    if (matchedUnitIds.length === 0) {
      sessionsWithNoMatchedKU.push({ sessionNumber: session.sessionNumber, title: session.title });
    }

    await prisma.programCurriculum.create({
      data: {
        programId: program.id,
        order: session.sessionNumber,
        title: session.title,
        objective: session.objective,
        sessionType: session.sessionType as never,
        knowledgeUnits: {
          create: matchedUnitIds.map((knowledgeUnitId) => ({ knowledgeUnitId })),
        },
      },
    });
    slotsCreated++;
  }

  return {
    programId: program.id,
    slug: program.slug,
    alreadyExisted: false,
    slotsCreated,
    sessionsWithNoMatchedKU,
    unmatchedTopics: [...unmatchedTopics],
  };
}

export { DEMO_PROGRAM_SLUG };
