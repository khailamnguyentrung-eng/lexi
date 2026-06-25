import { cn } from "@/lib/ui/cn";

const INPUT_CLASSES = "w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

// Extracted from the `rounded-xl border border-zinc-200 px-3 py-2 text-sm`
// input pattern repeated 15+ times across ProfileForm, NewEntryForm,
// DiagnosticTestForm, login page, ChatWindow.
export function TextField({ label, className, id, ...props }: TextFieldProps) {
  const input = <input id={id} className={cn(INPUT_CLASSES, className)} {...props} />;
  if (!label) return input;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {input}
    </div>
  );
}

export { INPUT_CLASSES };
