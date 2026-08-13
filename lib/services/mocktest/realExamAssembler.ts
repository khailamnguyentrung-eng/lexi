// Builds one MockTestTemplate per real, complete exam paper already sitting
// in the approved question bank — grouped by Question.sourceExam. Unlike
// the old assembleBlueprintTemplate() (deleted; see
// docs/superpowers/specs/2026-08-13-mocktest-real-exam-catalog-design.md),
// this surfaces the actual distinct papers Sub-project C imported (THPT,
// IELTS Reading, SAT Digital) instead of blending them into one synthetic
// paper.
//
// A "real complete paper" is a sourceExam group with >= 40 questions —
// smaller groups are partial subsets kept by the AGENT_INFERRED gate
// (structure-only-resolvable items only), not full exams a learner should
// sit as a timed test. This is a snapshot threshold: re-running this
// function after future Sub-project C batches land will pick up any newly-
// qualifying group, since the idempotency check is per-title, not a fixed
// list.
import { prisma } from "@/lib/db/prisma";
import { classifySourceExam } from "./realExamClassifier";

const MIN_QUESTIONS_FOR_REAL_PAPER = 40;

export interface AssembleRealExamsResult {
  created: { title: string; totalQuestions: number; timeLimitMin: number }[];
  skipped: { title: string; reason: string }[];
}

export async function assembleRealExamTemplates(): Promise<AssembleRealExamsResult> {
  const groups = await prisma.question.groupBy({
    by: ["sourceExam"],
    _count: true,
  });

  const created: AssembleRealExamsResult["created"] = [];
  const skipped: AssembleRealExamsResult["skipped"] = [];

  for (const group of groups) {
    const sourceExam = group.sourceExam;
    const count = group._count;
    if (!sourceExam || count < MIN_QUESTIONS_FOR_REAL_PAPER) continue;

    const classification = classifySourceExam(sourceExam, count);
    if (classification.skip) {
      skipped.push({ title: sourceExam, reason: classification.reason });
      continue;
    }

    const existing = await prisma.mockTestTemplate.findFirst({
      where: { title: sourceExam },
      select: { id: true },
    });
    if (existing) {
      skipped.push({ title: sourceExam, reason: "a template with this title already exists" });
      continue;
    }

    const questions = await prisma.question.findMany({
      where: { sourceExam },
      select: { id: true, questionCode: true },
      orderBy: { questionCode: "asc" },
    });

    await prisma.mockTestTemplate.create({
      data: {
        title: sourceExam,
        timeLimitMin: classification.timeLimitMin,
        totalQuestions: questions.length,
        questions: {
          create: questions.map((q, i) => ({ questionId: q.id, order: i + 1 })),
        },
      },
    });

    created.push({ title: sourceExam, totalQuestions: questions.length, timeLimitMin: classification.timeLimitMin });
  }

  return { created, skipped };
}
