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
import { getQuestionPayload } from "@/lib/services/question-format";
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
      select: {
        id: true,
        questionCode: true,
        responseFormat: true,
        payload: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        correctOption: true,
      },
      orderBy: { questionCode: "asc" },
    });

    // The 40-question threshold above gates on the raw row count (a property
    // of the source exam), but the player (buildQuestionViews in attempts.ts)
    // silently drops any question getQuestionPayload() can't grade. Filter
    // here so totalQuestions/the created rows match what a learner actually
    // sees — a group that cleared the threshold can still end up with fewer
    // gradeable questions, and that's fine; we don't re-check the threshold.
    const gradeableQuestions = questions.filter((q) => getQuestionPayload(q) !== null);

    if (gradeableQuestions.length === 0) {
      skipped.push({
        title: sourceExam,
        reason: "no gradeable questions remain after filtering (check Question.payload / legacy option columns for this source)",
      });
      continue;
    }

    await prisma.mockTestTemplate.create({
      data: {
        title: sourceExam,
        timeLimitMin: classification.timeLimitMin,
        totalQuestions: gradeableQuestions.length,
        questions: {
          create: gradeableQuestions.map((q, i) => ({ questionId: q.id, order: i + 1 })),
        },
      },
    });

    created.push({ title: sourceExam, totalQuestions: gradeableQuestions.length, timeLimitMin: classification.timeLimitMin });
  }

  return { created, skipped };
}
