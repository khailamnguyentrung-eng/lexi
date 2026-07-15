import { prisma } from "@/lib/db/prisma";
import { UploadForm } from "./UploadForm";
import { RunExtractionButton } from "./RunExtractionButton";
import { SampleTestButton } from "./SampleTestButton";
import { DryRunButton } from "./DryRunButton";
import { ProposeTaxonomyButton } from "./ProposeTaxonomyButton";
import { DraftReviewCard } from "./DraftReviewCard";

export default async function ContentImportPage() {
  const sources = await prisma.contentSource.findMany({
    orderBy: { createdAt: "desc" },
    include: { importJobs: { orderBy: { createdAt: "desc" }, include: { drafts: true } } },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">Nhập nội dung (Content Import)</h1>
        <p className="text-sm text-zinc-500">
          Tải lên đề thi/tài liệu, chạy trích xuất (DOCX/PDF: trích xuất văn bản thật; AI chuẩn hoá thành câu
          hỏi — dùng Gemini hoặc Claude nếu đã cấu hình AI_PROVIDER, ngược lại dùng dữ liệu mẫu), rồi duyệt
          từng câu hỏi trước khi đưa vào ngân hàng câu hỏi chính thức.
        </p>
      </div>

      <UploadForm />

      <div className="flex flex-col gap-4">
        {sources.length === 0 && (
          <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
            Chưa có file nào được tải lên.
          </p>
        )}
        {sources.map((source) => (
          <div key={source.id} id={`source-${source.id}`} className="rounded-3xl border border-zinc-100 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{source.fileName}</p>
                <p className="text-xs text-zinc-400">
                  {source.fileType} {source.sourceLabel ? `· ${source.sourceLabel}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[source.province, source.examYear, source.examType, source.gradeLevel, source.subject]
                    .filter(Boolean)
                    .map((tag, i) => (
                      <span key={i} className="rounded-full bg-lexi-soft px-2 py-0.5 text-[11px] text-lexi-primary-dark">
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
              <RunExtractionButton contentSourceId={source.id} />
            </div>

            <SampleTestButton contentSourceId={source.id} />
            <DryRunButton contentSourceId={source.id} />
            <ProposeTaxonomyButton contentSourceId={source.id} />

            {source.importJobs.map((job) => {
              const pendingDrafts = job.drafts.filter((d) => d.reviewStatus === "PENDING_REVIEW");
              const autoRejectedDrafts = job.drafts.filter(
                (d) => d.reviewStatus === "REJECTED" && d.reviewNote?.startsWith("Tự động từ chối"),
              );
              return (
                <div key={job.id} className="mt-4 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Job {job.id.slice(-6)} — {job.status}
                  </p>
                  {pendingDrafts.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-3">
                      {pendingDrafts.map((draft) => (
                        <DraftReviewCard key={draft.id} draftId={draft.id} data={JSON.parse(draft.normalizedData)} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-400">
                      {job.drafts.length > 0 ? "Đã xử lý xong tất cả câu hỏi của job này." : "Chưa có câu hỏi nào."}
                    </p>
                  )}
                  {autoRejectedDrafts.length > 0 && (
                    <div className="mt-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                      <p className="font-medium">{autoRejectedDrafts.length} câu bị tự động từ chối do lỗi kiểm tra:</p>
                      <ul className="mt-1 list-disc pl-4">
                        {autoRejectedDrafts.map((d) => (
                          <li key={d.id}>{d.reviewNote}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
