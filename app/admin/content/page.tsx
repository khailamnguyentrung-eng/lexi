import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function ContentOverviewPage() {
  const sources = await prisma.contentSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      importJobs: {
        orderBy: { createdAt: "desc" },
        include: { drafts: { select: { reviewStatus: true } } },
      },
    },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-lexi-primary-dark">Nguồn nội dung (Content)</h1>
          <p className="text-sm text-zinc-500">
            Tổng quan các file đã tải lên: trạng thái xử lý và số câu hỏi đã được duyệt vào ngân hàng.
          </p>
        </div>
        <Link
          href="/admin/content-import"
          className="rounded-full bg-lexi-primary px-4 py-2 text-sm font-medium text-white hover:bg-lexi-primary-dark"
        >
          Tải lên nguồn mới
        </Link>
      </div>

      {sources.length === 0 && (
        <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
          Chưa có nguồn nội dung nào. Tải lên ở trang Content Import.
        </p>
      )}

      <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Thông tin đề</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Đã nhập</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const latestJob = source.importJobs[0];
              const approvedCount = source.importJobs.reduce(
                (sum, job) => sum + job.drafts.filter((d) => d.reviewStatus === "APPROVED").length,
                0,
              );
              const tags = [source.province, source.examYear, source.examType, source.gradeLevel, source.subject].filter(
                Boolean,
              );

              return (
                <tr key={source.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{source.fileName}</p>
                    <p className="text-xs text-zinc-400">
                      {source.fileType} {source.sourceLabel ? `· ${source.sourceLabel}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag, i) => (
                          <span key={i} className="rounded-full bg-lexi-soft px-2 py-0.5 text-[11px] text-lexi-primary-dark">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-zinc-600">{latestJob?.status ?? "Chưa chạy"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{approvedCount} câu</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/content-import#source-${source.id}`}
                      className="text-xs font-medium text-lexi-primary-dark underline"
                    >
                      Xem & duyệt
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
