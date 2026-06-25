import { prisma } from "@/lib/db/prisma";

// Foundation for the future "learning streak" gamification feature — no new
// table needed yet. Computed from existing activity timestamps (quiz
// attempts, chat messages, mood check-ins) rather than a dedicated
// StreakEntry model, since the raw activity is already recorded elsewhere.
// If a real streak feature (badges, freezes, etc.) is built later, this
// function is the one place to swap for a maintained counter.
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getLearningStreak(userId: string): Promise<number> {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - 60); // cap lookback window, plenty for a streak

  const [attempts, messages, moods] = await Promise.all([
    prisma.questionAttempt.findMany({
      where: { userId, attemptedAt: { gte: since } },
      select: { attemptedAt: true },
    }),
    prisma.chatMessage.findMany({
      where: { role: "USER", chatSession: { userId }, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.moodEntry.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const activeDays = new Set<number>();
  for (const a of attempts) activeDays.add(startOfDay(a.attemptedAt).getTime());
  for (const m of messages) activeDays.add(startOfDay(m.createdAt).getTime());
  for (const m of moods) activeDays.add(startOfDay(m.createdAt).getTime());

  let streak = 0;
  const cursor = startOfDay(new Date());
  while (activeDays.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
