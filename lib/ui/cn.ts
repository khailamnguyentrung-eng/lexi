// Minimal class-name joiner — avoids pulling in clsx/tailwind-merge for
// what's currently just string concatenation with falsy filtering.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
