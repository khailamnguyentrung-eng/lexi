import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/app/(app)/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛠️</span>
            <span className="font-semibold text-lexi-primary-dark">Lexi Admin</span>
          </div>
          <Link href="/admin/content" className="text-sm text-zinc-600 hover:text-lexi-primary-dark">
            Content
          </Link>
          <Link href="/admin/content-import" className="text-sm text-zinc-600 hover:text-lexi-primary-dark">
            Content Import
          </Link>
          <Link href="/admin/knowledge-units" className="text-sm text-zinc-600 hover:text-lexi-primary-dark">
            Knowledge Units
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-lexi-primary-dark">
            Về app học sinh
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
