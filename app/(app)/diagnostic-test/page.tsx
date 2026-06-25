import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DiagnosticTestForm } from "./DiagnosticTestForm";

export default async function DiagnosticTestPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const latest = await prisma.diagnosticTest.findFirst({
    where: { userId: user.id },
    orderBy: { takenAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold text-lexi-primary-dark">Đánh giá đầu vào</h1>
      <DiagnosticTestForm latestEstimatedLevel={latest?.estimatedLevel ?? null} />
    </div>
  );
}
