"use client";

interface LensButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function LensButton({ onClick, disabled }: LensButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 self-start rounded-full border border-lexi-primary px-3 py-1.5 text-xs font-medium text-lexi-primary-dark transition hover:bg-lexi-soft disabled:opacity-50"
    >
      🔍 Ask Lexi
    </button>
  );
}
