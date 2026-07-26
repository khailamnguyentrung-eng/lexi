import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ProgramListPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const programs = await prisma.program.findMany({
    orderBy: { createdAt: "asc" },
    select: { slug: true, title: true, description: true, _count: { select: { curriculum: true } } },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">📚 Chương trình học</h1>
        <p className="text-sm text-zinc-500">Lộ trình học có thứ tự, theo từng chủ điểm kiến thức.</p>
      </div>

      {programs.length === 0 ? (
        <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
          Chưa có chương trình nào.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {programs.map((p) => (
            <Link
              key={p.slug}
              href={`/program/${p.slug}`}
              className="rounded-3xl border border-zinc-100 bg-white p-5 hover:border-lexi-primary"
            >
              <p className="font-medium text-foreground">{p.title}</p>
              {p.description && <p className="mt-1 text-xs text-zinc-500">{p.description}</p>}
              <p className="mt-1 text-xs text-zinc-400">{p._count.curriculum} bài học</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
