// Task 2: before trusting AI normalization on the full document, an admin
// should check 5 things on the 5-question sample. Three are mechanically
// checked already (validator.ts); two genuinely need a human reading the
// source text alongside the AI draft — this component is honest about
// that split rather than pretending semantic faithfulness can be verified
// automatically.
export function EvaluationChecklist({ allValid }: { allValid: boolean }) {
  return (
    <div className="mt-3 rounded-xl border border-zinc-100 bg-white p-3 text-xs">
      <p className="font-medium text-zinc-700">Checklist trước khi chạy toàn bộ đề:</p>
      <ul className="mt-1 flex flex-col gap-1">
        <li className="text-zinc-600">
          {allValid ? "✅" : "⚠️"} <span className="font-medium">JSON schema hợp lệ</span> — tự động kiểm tra
          (questionCode/type/skill/difficulty/correctOption/explanationVi/learningObjective)
        </li>
        <li className="text-zinc-600">
          {allValid ? "✅" : "⚠️"} <span className="font-medium">Không thiếu lựa chọn nào</span> — tự động
          kiểm tra (A/B/C/D đều có nội dung)
        </li>
        <li className="text-zinc-600">
          {allValid ? "✅" : "⚠️"} <span className="font-medium">questionCode không trùng</span> — tự động
          kiểm tra (với ngân hàng câu hỏi và trong cùng lô)
        </li>
        <li className="text-amber-700">
          👀 <span className="font-medium">Giữ đúng tiếng Việt/tiếng Anh gốc</span> — cần admin đối chiếu
          promptText/options với "Văn bản trích xuất" ở trên
        </li>
        <li className="text-amber-700">
          👀 <span className="font-medium">Đáp án &amp; giải thích đúng với nguồn</span> — cần admin đối
          chiếu correctOption/explanationVi với phần "ĐÁP ÁN &amp; GIẢI THÍCH" trong văn bản gốc
        </li>
      </ul>
    </div>
  );
}
