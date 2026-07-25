import { prisma } from "@/lib/db/prisma";
import { AssembleTemplateButton } from "./AssembleTemplateButton";

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
          Tạo đề thi thử mới bằng cách đóng gói câu hỏi có sẵn theo cấu trúc đề thi thật
          (lib/analytics/examBlueprint.ts). Không dùng AI, không cần tài liệu mới — chỉ chọn câu hỏi
          đã có trong ngân hàng theo đúng tỉ lệ từng phần của đề thật.
        </p>
      </div>

      <AssembleTemplateButton />

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
