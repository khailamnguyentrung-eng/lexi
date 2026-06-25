import { AIStatusLine } from "./AIStatusLine";
import type { AIRunReport } from "@/lib/services/content-import/runReport";

// Shared by SampleTestButton and DryRunButton — every AI normalization
// run shows the same metrics (Task 4: provider, model, chunks, input
// size, output count, validation counts, retry count, processing time).
// Never renders an API key — report only ever carries the fields above.
export function RunReportPanel({ report }: { report: AIRunReport }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <AIStatusLine status={report.aiStatus} />
      <ul className="mt-2 grid grid-cols-2 gap-1 text-zinc-600 sm:grid-cols-3">
        <li>Số batch xử lý: {report.chunksProcessed}</li>
        <li>Kích thước input: {report.inputSizeChars.toLocaleString("vi-VN")} ký tự</li>
        <li>Số câu AI tạo ra: {report.outputQuestionCount}</li>
        <li>Hợp lệ: {report.validCount}</li>
        <li>Không hợp lệ: {report.invalidCount}</li>
        <li>Số lần thử lại JSON: {report.retryCount}</li>
        <li>Thời gian xử lý: {(report.processingTimeMs / 1000).toFixed(1)}s</li>
      </ul>
    </div>
  );
}
