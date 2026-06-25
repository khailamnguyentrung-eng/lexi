// Placeholder for Lexi's mascot — a cute, non-copyrighted fantasy/pony-style
// character per the product spec. Currently an emoji; swap the inner markup
// for an illustrated SVG/image asset later without touching call sites.
export function LexiAvatar({ size = "text-3xl" }: { size?: string }) {
  return <span className={size}>🦄</span>;
}
