import { prisma } from "@/lib/db/prisma";

// Rule-based weak-topic detection: ranks concepts by total occurrences in
// the error notebook (repeated mistakes weigh more than one-offs), looking
// only at entries the student hasn't mastered yet. This is intentionally
// simple — it's the foundation a future AI weakness-detection job replaces
// or augments (see SkillMatrixEntry.computedBy = 'AI' in the schema), not
// the final analysis.
export interface WeakTopic {
  concept: string;
  label: string;
  occurrenceCount: number;
  isRemedialFlagged: boolean;
}

function prettifyConcept(concept: string): string {
  return concept
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function getWeakTopics(userId: string, limit = 5): Promise<WeakTopic[]> {
  const entries = await prisma.errorNotebookEntry.findMany({
    where: { userId, status: { not: "MASTERED" } },
    select: { concept: true, occurrenceCount: true, isRemedialFlagged: true },
  });

  const byConcept = new Map<string, WeakTopic>();
  for (const entry of entries) {
    const existing = byConcept.get(entry.concept);
    if (existing) {
      existing.occurrenceCount += entry.occurrenceCount;
      existing.isRemedialFlagged = existing.isRemedialFlagged || entry.isRemedialFlagged;
    } else {
      byConcept.set(entry.concept, {
        concept: entry.concept,
        label: prettifyConcept(entry.concept),
        occurrenceCount: entry.occurrenceCount,
        isRemedialFlagged: entry.isRemedialFlagged,
      });
    }
  }

  return [...byConcept.values()].sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, limit);
}
