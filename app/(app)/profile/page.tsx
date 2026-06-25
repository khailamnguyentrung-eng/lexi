import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await prisma.learnerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return (
      <p className="mx-auto max-w-lg rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
        Hồ sơ học tập chưa được khởi tạo.
      </p>
    );
  }

  const strengths: string[] = profile.strengths ? JSON.parse(profile.strengths) : [];
  const weaknesses: string[] = profile.weaknesses ? JSON.parse(profile.weaknesses) : [];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold text-lexi-primary-dark">Hồ sơ học tập</h1>
      <p className="text-sm text-zinc-500">
        Lớp {profile.gradeLevel === "grade9" ? "9" : profile.gradeLevel} · Mục tiêu: {profile.targetExam}
      </p>
      <ProfileForm
        initialTargetScore={profile.targetScore}
        initialCurrentScore={profile.currentScore}
        initialStrengths={strengths}
        initialWeaknesses={weaknesses}
      />
    </div>
  );
}
