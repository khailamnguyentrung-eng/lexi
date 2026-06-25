"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewEntryForm({
  defaultReason = "",
  defaultConcept = "",
  defaultStudentAnswer = "",
  defaultCorrectAnswer = "",
  questionId,
}: {
  defaultReason?: string;
  defaultConcept?: string;
  defaultStudentAnswer?: string;
  defaultCorrectAnswer?: string;
  questionId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    studentAnswer: defaultStudentAnswer,
    correctAnswer: defaultCorrectAnswer,
    reason: defaultReason,
    concept: defaultConcept,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/error-notebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, questionId }),
    });
    router.push("/error-notebook");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-zinc-100 bg-white p-6">
      <Field label="Chủ điểm (concept)" value={form.concept} onChange={(v) => setForm({ ...form, concept: v })} placeholder="VD: reported_speech" />
      <Field label="Câu trả lời của bạn" value={form.studentAnswer} onChange={(v) => setForm({ ...form, studentAnswer: v })} />
      <Field label="Câu trả lời đúng" value={form.correctAnswer} onChange={(v) => setForm({ ...form, correctAnswer: v })} />
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Vì sao sai?</label>
        <textarea
          required
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
          rows={3}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-xl bg-lexi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-lexi-primary-dark disabled:opacity-60"
      >
        {submitting ? "Đang lưu..." : "Lưu vào sổ lỗi"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
      />
    </div>
  );
}
