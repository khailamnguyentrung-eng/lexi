"use client";

import { useState } from "react";

const MOODS: { value: string; emoji: string; label: string }[] = [
  { value: "GREAT", emoji: "🤩", label: "Tuyệt vời" },
  { value: "GOOD", emoji: "🙂", label: "Tốt" },
  { value: "OKAY", emoji: "😐", label: "Bình thường" },
  { value: "TIRED", emoji: "😴", label: "Mệt" },
  { value: "STRESSED", emoji: "😣", label: "Căng thẳng" },
];

export function MoodPicker({ loggedToday }: { loggedToday: boolean }) {
  const [saved, setSaved] = useState(loggedToday);
  const [selected, setSelected] = useState<string | null>(null);

  async function handlePick(mood: string) {
    setSelected(mood);
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood }),
    });
    setSaved(true);
  }

  if (saved) {
    return <p className="text-sm text-zinc-500">Cảm ơn bạn đã chia sẻ cảm xúc hôm nay! 💛</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((m) => (
        <button
          key={m.value}
          onClick={() => handlePick(m.value)}
          className={`flex flex-col items-center rounded-xl border px-3 py-2 text-xs transition ${
            selected === m.value
              ? "border-lexi-primary bg-lexi-primary/10"
              : "border-zinc-200 hover:border-lexi-primary"
          }`}
        >
          <span className="text-xl">{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
