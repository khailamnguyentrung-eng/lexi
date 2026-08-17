import { prisma } from "@/lib/db/prisma";
import { AssembleRealExamsButton } from "./AssembleRealExamsButton";

export default async function AdminMockTestPage() {
  const templates = await prisma.mockTestTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      timeLimitMin: true,
      totalQuestions: true,
      createdAt: true,
      _count: { select: { attempts: true } },
    },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-lexi-primary-dark">Thi thử — quản lý đề</h1>
        <p className="text-sm text-zinc-500">
          Gom các câu hỏi đã duyệt trong ngân hàng theo đề gốc (sourceExam) và tạo một đề thi thử
          cho mỗi đề thật đầy đủ (từ 40 câu trở lên) — ví dụ THPT, IELTS Reading, SAT. Bấm lại an
          toàn: đề đã tồn tại sẽ tự động được bỏ qua, chỉ đề mới đủ điều kiện mới được tạo thêm.
        </p>
      </div>

      <AssembleRealExamsButton />

      <div className="flex flex-col gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border border-zinc-100 bg-white p-4 text-sm">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-zinc-400">
              {t.totalQuestions} câu · {t.timeLimitMin} phút · {t._count.attempts} lượt làm bài · tạo lúc{" "}
              {t.createdAt.toLocaleString("vi-VN")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
