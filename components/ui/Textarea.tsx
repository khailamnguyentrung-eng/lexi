import { cn } from "@/lib/ui/cn";
import { INPUT_CLASSES } from "./TextField";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  const textarea = <textarea id={id} className={cn(INPUT_CLASSES, className)} {...props} />;
  if (!label) return textarea;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {textarea}
    </div>
  );
}
