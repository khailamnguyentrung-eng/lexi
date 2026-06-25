import { cn } from "@/lib/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger-outline";
export type ButtonShape = "rounded" | "pill";
export type ButtonSize = "sm" | "xs";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-lexi-primary text-white hover:bg-lexi-primary-dark",
  secondary: "border border-lexi-primary text-lexi-primary-dark",
  success: "bg-lexi-success text-white hover:opacity-90",
  "danger-outline": "border border-rose-300 text-rose-600",
};

const SHAPE_CLASSES: Record<ButtonShape, string> = {
  rounded: "rounded-xl",
  pill: "rounded-full",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm font-semibold",
  xs: "px-3 py-1.5 text-xs font-medium",
};

// Extracted from the button class patterns repeated across forms, the
// quiz, error notebook, and dashboard (primary/secondary/success/danger
// variants, rounded vs. pill shape). Exported as a plain class-string
// function too, since several call sites are <Link> elements styled like
// buttons rather than actual <button>s.
export function buttonClasses(
  variant: ButtonVariant = "primary",
  shape: ButtonShape = "rounded",
  size: ButtonSize = "sm",
  className?: string,
): string {
  return cn(SHAPE_CLASSES[shape], SIZE_CLASSES[size], VARIANT_CLASSES[variant], "transition disabled:opacity-60", className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  size?: ButtonSize;
}

export function Button({ variant = "primary", shape = "rounded", size = "sm", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, shape, size, className)} {...props} />;
}
