import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { findMatchingKnowledgeUnitId } from "../lib/services/content-intelligence/questionKnowledgeMapping";

const prisma = new PrismaClient();

interface SeedQuestion {
  questionCode: string;
  type: string;
  skill: string;
  difficulty: string;
  topic: string;
  promptText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanationVi: string;
  commonMistake: string | null;
  learningObjective: string | null;
  source: string;
  sourceExam: string | null;
  passageTitle: string | null;
  passageBody: string | null;
  curriculumSessionNumber: number | null;
}

interface SeedKnowledgeUnit {
  topic: string;
  label: string;
  targetEasyCount: number;
  targetMediumCount: number;
  targetHardCount: number;
}

interface SeedCurriculum {
  phases: Array<{ order: number; name: string; startSession: number; endSession: number; goal: string }>;
  sessions: Array<{
    sessionNumber: number;
    phaseOrder: number;
    title: string;
    objective: string;
    grammarTopics: string[];
    vocabThemes: string[];
    exercises: Array<{ type: string; description: string }>;
    resources: Array<{ label: string; url: string }>;
    timeBlocks: Array<{ label: string; startMin: number; endMin: number }>;
    unitMapping: string | null;
    sessionType: string;
  }>;
}

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Seed data not found: ${relativePath} — skipping.`);
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

async function seedStudent() {
  const email = process.env.STUDENT_EMAIL ?? "student@lexi.local";
  const password = process.env.STUDENT_PASSWORD ?? "lexi1234";
  const name = process.env.STUDENT_NAME ?? "Bạn học";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: {
      email,
      name,
      passwordHash,
      profile: {
        create: {
          gradeLevel: "grade9",
          targetExam: "hanoi_thpt_2027",
          targetScore: 9.5,
          currentScore: 6.5,
        },
      },
    },
  });

  console.log(`Seeded student user: ${email} / ${password}`);
  return user;
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@lexi.local";
  const password = process.env.ADMIN_PASSWORD ?? "lexi-admin-1234";
  const name = process.env.ADMIN_NAME ?? "Quản trị viên";

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { name, role: "ADMIN" },
    create: { email, name, passwordHash, role: "ADMIN" },
  });

  console.log(`Seeded admin user: ${email} / ${password}`);
}

async function seedCurriculum() {
  const data = readJson<SeedCurriculum>("seed-data/curriculum.json");
  if (!data) return;

  const phaseIdByOrder = new Map<number, string>();
  for (const phase of data.phases) {
    const created = await prisma.curriculumPhase.upsert({
      where: { id: `phase-${phase.order}` },
      update: { ...phase },
      create: { id: `phase-${phase.order}`, ...phase },
    });
    phaseIdByOrder.set(phase.order, created.id);
  }

  for (const session of data.sessions) {
    const phaseId = phaseIdByOrder.get(session.phaseOrder);
    if (!phaseId) continue;

    await prisma.curriculumSession.upsert({
      where: { sessionNumber: session.sessionNumber },
      update: {
        phaseId,
        title: session.title,
        objective: session.objective,
        grammarTopics: JSON.stringify(session.grammarTopics ?? []),
        vocabThemes: JSON.stringify(session.vocabThemes ?? []),
        exercises: JSON.stringify(session.exercises ?? []),
        resources: JSON.stringify(session.resources ?? []),
        timeBlocks: JSON.stringify(session.timeBlocks ?? []),
        unitMapping: session.unitMapping,
        sessionType: session.sessionType as never,
      },
      create: {
        sessionNumber: session.sessionNumber,
        phaseId,
        title: session.title,
        objective: session.objective,
        grammarTopics: JSON.stringify(session.grammarTopics ?? []),
        vocabThemes: JSON.stringify(session.vocabThemes ?? []),
        exercises: JSON.stringify(session.exercises ?? []),
        resources: JSON.stringify(session.resources ?? []),
        timeBlocks: JSON.stringify(session.timeBlocks ?? []),
        unitMapping: session.unitMapping,
        sessionType: session.sessionType as never,
      },
    });
  }

  console.log(`Seeded ${data.phases.length} phases and ${data.sessions.length} curriculum sessions.`);
}

/**
 * The canonical topic taxonomy.
 *
 * Seeded BEFORE questions so the registry exists before anything classifies
 * into it.
 *
 * History: started narrow (KU-1, 2026-07-15) — only the 12 topics that
 * carried >=3 questions, curated by hand (Ch.1 §9: Content-Item curation
 * belongs to a curating authority, not to a script). Grew to all 71 distinct
 * topics via KU-1 part B's review queue (docs/KU1_PARTB_DESIGN.md):
 * `autoAssignKnowledgeUnit()`'s miss-handling recorded every unmatched topic
 * as a `PendingKnowledgeUnit` instead of discarding it, a human resolved all
 * 62 real proposals through `pendingKnowledgeUnitReview.ts` (55 approved, 1
 * merge — see DECISION_LOG "KU-1 part B — merge criterion"), and this file is
 * that resolution made durable. Encoding it here is what makes the
 * `V1_V2_RECONCILIATION.md` §6 gate (122/122 questions linked) survive a
 * reseed — before this, it existed only in the live dev.db.
 *
 * `topic` must match `Question.topic` EXACTLY for all 71 — coverage matches
 * on the string (`computeCoverageReport`: `questions.filter(q => q.topic ===
 * unit.topic)`), not on `Question.knowledgeUnitId`, a decision recorded
 * before this queue existed (DECISION_LOG "M3.2"). The registry's remaining 3
 * distinct topics (the two `present_perfect_*` phrasing variants plus
 * `modal_verbs_should`) were resolved by MERGE rather than by their own KU —
 * intentionally not listed here; `linkQuestionsToKnowledgeUnits()` below
 * reaches them via `knowledgeUnitId`, which is why that FK, not string
 * coverage, is this repo's growing source of truth for "is this topic
 * covered" (see the same DECISION_LOG entry's coverage-report caveat).
 */
async function seedKnowledgeUnits() {
  const units = readJson<SeedKnowledgeUnit[]>("seed-data/knowledge-units.json");
  if (!units) return;

  for (const u of units) {
    await prisma.knowledgeUnit.upsert({
      where: { topic: u.topic },
      update: {
        label: u.label,
        targetEasyCount: u.targetEasyCount,
        targetMediumCount: u.targetMediumCount,
        targetHardCount: u.targetHardCount,
      },
      create: {
        topic: u.topic,
        label: u.label,
        targetEasyCount: u.targetEasyCount,
        targetMediumCount: u.targetMediumCount,
        targetHardCount: u.targetHardCount,
      },
    });
  }

  console.log(`Seeded ${units.length} knowledge units.`);
}

async function seedQuestions() {
  const questions = readJson<SeedQuestion[]>("seed-data/questions.json");
  if (!questions) return;

  const passageIdByTitle = new Map<string, string>();

  for (const q of questions) {
    let passageId: string | undefined;
    if (q.passageTitle) {
      if (passageIdByTitle.has(q.passageTitle)) {
        passageId = passageIdByTitle.get(q.passageTitle);
      } else if (q.passageBody) {
        const passage = await prisma.passage.create({
          data: { title: q.passageTitle, bodyText: q.passageBody },
        });
        passageIdByTitle.set(q.passageTitle, passage.id);
        passageId = passage.id;
      }
    }

    let curriculumSessionId: string | undefined;
    if (q.curriculumSessionNumber) {
      const session = await prisma.curriculumSession.findUnique({
        where: { sessionNumber: q.curriculumSessionNumber },
      });
      curriculumSessionId = session?.id;
    }

    await prisma.question.upsert({
      where: { questionCode: q.questionCode },
      update: {
        type: q.type as never,
        skill: q.skill as never,
        difficulty: q.difficulty as never,
        topic: q.topic,
        promptText: q.promptText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanationVi: q.explanationVi,
        commonMistake: q.commonMistake,
        learningObjective: q.learningObjective,
        source: q.source,
        sourceExam: q.sourceExam,
        passageId,
        curriculumSessionId,
      },
      create: {
        questionCode: q.questionCode,
        type: q.type as never,
        skill: q.skill as never,
        difficulty: q.difficulty as never,
        topic: q.topic,
        promptText: q.promptText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanationVi: q.explanationVi,
        commonMistake: q.commonMistake,
        learningObjective: q.learningObjective,
        source: q.source,
        sourceExam: q.sourceExam,
        passageId,
        curriculumSessionId,
      },
    });
  }

  console.log(`Seeded ${questions.length} questions and ${passageIdByTitle.size} passages.`);
}

/**
 * Topics resolved by MERGE rather than their own KnowledgeUnit (KU-1 part B
 * review queue, 2026-07-15 — see DECISION_LOG "KU-1 part B — merge
 * criterion"). No KnowledgeUnit row has these as its `topic`, so the plain
 * string match in `linkQuestionsToKnowledgeUnits()` can never reach them —
 * verified on a from-scratch reseed: without this map, 4 of 118 seeded
 * questions land unmapped, all four on exactly these three topics. This map
 * is what makes that merge decision durable, the same way the 71-entry
 * registry above makes the 55 approvals durable.
 */
const KNOWN_TOPIC_MERGES: Record<string, string> = {
  present_perfect_for_since: "present_perfect",
  present_perfect_since_for: "present_perfect",
  modal_verbs_should: "modal_verbs_advice",
};

/**
 * Backfill `Question.knowledgeUnitId` by exact topic-string match, for every
 * question in the database — not just ones this run just seeded, so a
 * question created outside the seed script (e.g. via the content-import
 * pipeline) still gets linked. Reuses `findMatchingKnowledgeUnitId()` (the
 * same pure, deterministic matcher `autoAssignKnowledgeUnit()` uses) rather
 * than reimplementing the match, so seed-time linking and import-time linking
 * can never quietly diverge.
 *
 * Runs AFTER seedKnowledgeUnits() and seedQuestions(), and only ever fills a
 * currently-null knowledgeUnitId — never overwrites an existing assignment,
 * so this is safe to re-run on a database that already has manual
 * reassignments from the admin `assignQuestionToKnowledgeUnit()` tools.
 *
 * A leftover unmatched question after this step is expected in general (the
 * registry only covers what's been curated or reviewed — see
 * seedKnowledgeUnits()'s comment), but as of 2026-07-15 the registry above
 * covers every topic in `seed-data/questions.json`, so on a clean seed this
 * should report 0 unmatched. Logged either way rather than silently passing,
 * since a silent gap here is exactly the failure mode
 * V1_V2_RECONCILIATION.md §6's gate exists to catch.
 */
async function linkQuestionsToKnowledgeUnits() {
  const units = await prisma.knowledgeUnit.findMany({ select: { id: true, topic: true } });
  const unmapped = await prisma.question.findMany({
    where: { knowledgeUnitId: null },
    select: { id: true, topic: true },
  });

  let linked = 0;
  for (const q of unmapped) {
    const effectiveTopic = KNOWN_TOPIC_MERGES[q.topic] ?? q.topic;
    const knowledgeUnitId = findMatchingKnowledgeUnitId(effectiveTopic, units);
    if (!knowledgeUnitId) continue;
    await prisma.question.update({ where: { id: q.id }, data: { knowledgeUnitId } });
    linked++;
  }

  const stillUnmapped = unmapped.length - linked;
  console.log(`Linked ${linked} question(s) to a KnowledgeUnit by topic match.`);
  if (stillUnmapped > 0) {
    console.log(`${stillUnmapped} question(s) remain unmapped — no KnowledgeUnit exists for their topic yet.`);
  }
}

async function main() {
  await seedStudent();
  await seedAdmin();
  await seedCurriculum();
  await seedKnowledgeUnits();
  await seedQuestions();
  await linkQuestionsToKnowledgeUnits();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
