import { cn } from "@/lib/ui/cn";

// Extracted from the `rounded-3xl border border-zinc-100 bg-white p-6`
// pattern repeated across dashboard/profile/progress/error-notebook/forms.
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-3xl border border-zinc-100 bg-white p-6", className)}>{children}</div>;
}
