import { prisma } from "@/lib/db/prisma";
import { listPendingKnowledgeUnits } from "@/lib/services/content-intelligence/pendingKnowledgeUnitReview";
import { PendingKnowledgeUnitCard } from "./PendingKnowledgeUnitCard";

export default async function KnowledgeUnitsPage() {
  const [proposals, existingUnits] = await Promise.all([
    listPendingKnowledgeUnits(),
    prisma.knowledgeUnit.findMany({
      select: { id: true, topic: true, label: true },
      orderBy: { topic: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">Knowledge Units — hàng đợi duyệt</h1>
        <p className="text-sm text-zinc-500">
          Các chủ đề (topic) từ câu hỏi đã nhập vào nhưng chưa khớp với KnowledgeUnit nào trong danh mục
          (KU-1 part B). Duyệt để tạo KnowledgeUnit mới, gộp vào một KU có sẵn nếu đây là cùng một khái niệm,
          đổi tên nếu nhãn AI đề xuất chưa chuẩn, hoặc từ chối nếu không phải một khái niệm thật.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {existingUnits.length} KnowledgeUnit hiện có &middot; {proposals.length} đề xuất đang chờ
        </p>
      </div>

      {proposals.length === 0 ? (
        <p className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
          Không có đề xuất nào đang chờ duyệt.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {proposals.map((p) => (
            <PendingKnowledgeUnitCard key={p.id} proposal={p} existingUnits={existingUnits} />
          ))}
        </div>
      )}
    </div>
  );
}
