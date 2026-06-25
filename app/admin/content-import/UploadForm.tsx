"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClasses =
  "w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [province, setProvince] = useState("");
  const [examYear, setExamYear] = useState("");
  const [examType, setExamType] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (sourceLabel) formData.append("sourceLabel", sourceLabel);
    if (province) formData.append("province", province);
    if (examYear) formData.append("examYear", examYear);
    if (examType) formData.append("examType", examType);
    if (gradeLevel) formData.append("gradeLevel", gradeLevel);
    if (subject) formData.append("subject", subject);

    const res = await fetch("/api/admin/content-sources", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Tải file lên thất bại.");
      setUploading(false);
      return;
    }

    setFile(null);
    setSourceLabel("");
    setProvince("");
    setExamYear("");
    setExamType("");
    setGradeLevel("");
    setSubject("");
    setUploading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-3xl border border-zinc-100 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">File (PDF / DOCX / Ảnh)</label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Nhãn nguồn (tuỳ chọn)</label>
        <input
          value={sourceLabel}
          onChange={(e) => setSourceLabel(e.target.value)}
          placeholder="VD: Đề thi Hải Phòng 2026"
          className={inputClasses}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Tỉnh/TP</label>
          <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Hà Nội" className={inputClasses} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Năm</label>
          <input
            type="number"
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
            placeholder="2026"
            className={inputClasses}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Loại đề</label>
          <input
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            placeholder="official_exam"
            className={inputClasses}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Lớp</label>
          <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="grade9" className={inputClasses} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Môn</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="english" className={inputClasses} />
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={!file || uploading}
        className="self-start rounded-xl bg-lexi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-lexi-primary-dark disabled:opacity-60"
      >
        {uploading ? "Đang tải lên..." : "Tải lên"}
      </button>
    </form>
  );
}
