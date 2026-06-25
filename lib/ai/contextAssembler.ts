import { prisma } from "@/lib/db/prisma";
import { getCurrentMission } from "@/lib/services/curriculum";

export interface AssembledContext {
  targetScore: number | null;
  currentScore: number | null;
  weaknesses: string[];
  recentErrorConcepts: string[];
  currentSessionTitle: string | null;
  currentSessionObjective: string | null;
}

export async function assembleContext(userId: string): Promise<AssembledContext> {
  const [profile, recentErrors, mission] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.errorNotebookEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { concept: true },
    }),
    getCurrentMission(userId),
  ]);

  return {
    targetScore: profile?.targetScore ?? null,
    currentScore: profile?.currentScore ?? null,
    weaknesses: profile?.weaknesses ? JSON.parse(profile.weaknesses) : [],
    recentErrorConcepts: recentErrors.map((e) => e.concept),
    currentSessionTitle: mission?.title ?? null,
    currentSessionObjective: mission?.objective ?? null,
  };
}
