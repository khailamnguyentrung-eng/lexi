import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "./SignOutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Trang chủ", icon: "🏠" },
  { href: "/chat", label: "Hỏi Lexi", icon: "💬" },
  { href: "/error-notebook", label: "Sổ lỗi sai", icon: "📓" },
  { href: "/progress", label: "Tiến độ", icon: "📊" },
  { href: "/lens", label: "Lens", icon: "🔍" },
  { href: "/profile", label: "Hồ sơ", icon: "👤" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦄</span>
          <span className="font-semibold text-lexi-primary-dark">Lexi</span>
        </div>
        <nav className="hidden gap-5 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-zinc-600 hover:text-lexi-primary-dark"
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <SignOutButton />
      </header>

      <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>

      <nav className="flex justify-between border-t border-zinc-100 bg-white px-2 py-2 sm:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center text-[11px] text-zinc-600"
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
