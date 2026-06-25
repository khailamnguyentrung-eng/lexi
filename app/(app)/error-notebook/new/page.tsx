import { NewEntryForm } from "./NewEntryForm";

export default async function NewErrorEntryPage({
  searchParams,
}: {
  searchParams: Promise<{
    reason?: string;
    concept?: string;
    studentAnswer?: string;
    correctAnswer?: string;
    questionId?: string;
  }>;
}) {
  const { reason, concept, studentAnswer, correctAnswer, questionId } = await searchParams;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold text-lexi-primary-dark">Ghi lỗi mới</h1>
      <p className="text-sm text-zinc-500">
        Ghi lại lỗi sai để Lexi giúp bạn ôn tập đúng lúc, đúng chủ điểm.
      </p>
      <NewEntryForm
        defaultReason={reason ?? ""}
        defaultConcept={concept ?? ""}
        defaultStudentAnswer={studentAnswer ?? ""}
        defaultCorrectAnswer={correctAnswer ?? ""}
        questionId={questionId}
      />
    </div>
  );
}
