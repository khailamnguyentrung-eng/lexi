import { SkillCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const SKILL_LABELS_VI: Record<SkillCategory, string> = {
  PHONETICS_STRESS: "Ngữ âm & Trọng âm",
  VOCAB_GRAMMAR: "Từ vựng & Ngữ pháp",
  COMMUNICATION: "Giao tiếp",
  READING: "Đọc hiểu",
  WRITING_TRANSFORMATION: "Viết & Biến đổi câu",
};

const ALL_SKILLS = Object.keys(SKILL_LABELS_VI) as SkillCategory[];

export async function getSkillMatrix(userId: string) {
  const entries = await prisma.skillMatrixEntry.findMany({ where: { userId } });
  const bySkill = new Map(entries.map((e) => [e.skill, e]));

  return ALL_SKILLS.map((skill) => {
    const entry = bySkill.get(skill);
    return {
      skill,
      label: SKILL_LABELS_VI[skill],
      percentage: entry?.percentage ?? 0,
      computedBy: entry?.computedBy ?? "MANUAL",
    };
  });
}

// Rule-based recompute: percent correct per skill from QuestionAttempt history.
export async function recomputeSkillMatrix(userId: string) {
  for (const skill of ALL_SKILLS) {
    const attempts = await prisma.questionAttempt.findMany({
      where: { userId, question: { skill } },
      select: { isCorrect: true },
    });

    if (attempts.length === 0) continue;

    const correct = attempts.filter((a) => a.isCorrect).length;
    const percentage = Math.round((correct / attempts.length) * 100);

    await prisma.skillMatrixEntry.upsert({
      where: { userId_skill: { userId, skill } },
      update: { percentage, computedBy: "RULE_BASED", lastComputedAt: new Date() },
      create: { userId, skill, percentage, computedBy: "RULE_BASED" },
    });
  }
}
