import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

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
 * The canonical topic taxonomy (KU-1, 2026-07-15).
 *
 * Seeded BEFORE questions so the registry exists before anything classifies
 * into it. Deliberately narrow: only the 12 topics that actually carry >=3
 * questions today, not all 74 distinct `Question.topic` strings. `topic` is
 * free text entered at import time, so deriving the taxonomy from it wholesale
 * would inherit its noise — 51 of those 74 are backed by a single question, and
 * the resulting registry would demand ~840 generated questions to fill gaps
 * that shouldn't exist. This list is curated instead (Ch.1 §9: Content-Item
 * curation belongs to a curating authority, not to a script).
 *
 * `topic` must match `Question.topic` EXACTLY — coverage matches on the string
 * (`computeCoverageReport`: `questions.filter(q => q.topic === unit.topic)`),
 * not on `Question.knowledgeUnitId`. Growing this list is how the taxonomy
 * grows until the FigJam v2 Pending-KU review queue exists.
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

async function main() {
  await seedStudent();
  await seedAdmin();
  await seedCurriculum();
  await seedKnowledgeUnits();
  await seedQuestions();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
