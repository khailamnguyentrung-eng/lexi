"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export function ProfileForm({
  initialTargetScore,
  initialCurrentScore,
  initialStrengths,
  initialWeaknesses,
}: {
  initialTargetScore: number;
  initialCurrentScore: number | null;
  initialStrengths: string[];
  initialWeaknesses: string[];
}) {
  const router = useRouter();
  const [targetScore, setTargetScore] = useState(String(initialTargetScore));
  const [currentScore, setCurrentScore] = useState(initialCurrentScore !== null ? String(initialCurrentScore) : "");
  const [strengths, setStrengths] = useState(initialStrengths.join(", "));
  const [weaknesses, setWeaknesses] = useState(initialWeaknesses.join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetScore,
        currentScore: currentScore || null,
        strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean),
        weaknesses: weaknesses.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-zinc-100 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Điểm mục tiêu"
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={targetScore}
          onChange={(e) => setTargetScore(e.target.value)}
        />
        <TextField
          label="Điểm hiện tại"
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={currentScore}
          onChange={(e) => setCurrentScore(e.target.value)}
        />
      </div>
      <TextField
        label="Điểm mạnh (cách nhau bởi dấu phẩy)"
        value={strengths}
        onChange={(e) => setStrengths(e.target.value)}
        placeholder="VD: reading_comprehension, vocabulary"
      />
      <TextField
        label="Điểm yếu (cách nhau bởi dấu phẩy)"
        value={weaknesses}
        onChange={(e) => setWeaknesses(e.target.value)}
        placeholder="VD: reported_speech, word_formation"
      />
      <Button type="submit" disabled={saving} className="self-start">
        {saving ? "Đang lưu..." : "Lưu hồ sơ"}
      </Button>
    </form>
  );
}
