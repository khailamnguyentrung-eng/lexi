import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resumeAttempt, MockTestStateError } from "@/lib/services/mocktest/attempts";
import { MockTestPlayer } from "./MockTestPlayer";

export default async function MockTestAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { attemptId } = await params;

  let attempt;
  try {
    attempt = await resumeAttempt(user.id, attemptId);
  } catch (err) {
    // Redirect only for "already submitted" — go where the data actually is.
    // A wrong-user error (someone else's attempt id) must NOT redirect
    // there too: getResults() re-checks ownership and would just throw the
    // same error again, but silently funnelling every MockTestStateError
    // through one redirect would make an ownership failure look identical
    // to "you're done", which is the wrong signal to give back.
    if (err instanceof MockTestStateError && err.message.includes("already submitted")) {
      redirect(`/mocktest/attempt/${attemptId}/results`);
    }
    throw err;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <MockTestPlayer
        attemptId={attempt.attemptId}
        timeLimitMin={attempt.timeLimitMin}
        startedAt={attempt.startedAt.toISOString()}
        questions={attempt.questions}
      />
    </div>
  );
}
