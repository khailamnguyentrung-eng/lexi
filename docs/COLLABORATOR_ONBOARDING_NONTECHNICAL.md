# LEXI — Phân công công việc cho cộng tác viên phi kỹ thuật

> Tài liệu này dành cho một cộng tác viên **không làm kỹ thuật/code**, theo hướng **sư phạm giáo dục** hoặc
> **truyền thông**, tham gia LEXI để có sản phẩm thực tế đưa vào hồ sơ du học. Không đề xuất công việc
> động vào kiến trúc đã "freeze" (`docs/LEXI_FOUNDATION.md`, `docs/LEXI_SYSTEM.md` Ch.1–4) — những việc dưới
> đây đều nằm ở lớp nội dung, trải nghiệm, và truyền thông, không đụng vào ontology hay engine.

**Cách dùng tài liệu này:** đọc phần "Đọc gì trước" → chọn 1 track (hoặc trộn) → chọn 2–3 task để bắt đầu,
không cần làm hết. Track B (Communications) có một hạng mục thực sự nằm trên roadmap kiến trúc thật
(Communication Policy) — đáng cân nhắc nếu muốn phần đóng góp "đếm" vào một cột mốc kiến trúc, không chỉ
nội dung phụ trợ.

---

## Đọc gì trước khi bắt đầu (30 phút)

1. Bản dossier giới thiệu dự án (đã gửi/publish riêng) — bức tranh tổng.
2. `PROJECT_STATUS.md` §1–§4 — biết sản phẩm hiện có gì, chạy được gì.
3. Nếu chọn Track A: đọc `docs/LEXI_FOUNDATION.md` phần Learning Philosophy.
4. Nếu chọn Track B: đọc `docs/YOUPASS_COMPETITIVE_RESEARCH_AND_PLAN.md` toàn bộ.

Không cần đọc `LEXI_SYSTEM.md` (Ch.1–4) trừ khi tò mò — tài liệu đó dành cho kỹ sư, viết bằng ngôn ngữ hình
thức (invariant, contract), không cần thiết cho công việc dưới đây.

---

## Track A — Nếu theo Sư phạm / Giáo dục

Trọng tâm: chất lượng sư phạm của nội dung và cách LEXI "dạy", không phải cách LEXI được code.

### A1. Rà soát chất lượng giải thích trong ngân hàng câu hỏi
LEXI đã có 118 câu hỏi, mỗi câu có `explanationVi` (giải thích tiếng Việt) và `commonMistake` (lỗi sai phổ
biến). Đây là nội dung do AI hỗ trợ soạn ban đầu, **chưa từng được một người có nền tảng sư phạm rà soát
toàn bộ**. Việc cần làm: đọc qua từng câu, đánh giá xem giải thích có thực sự giúp học sinh *hiểu bản chất*
hay chỉ nêu đáp án; đề xuất viết lại những câu giải thích yếu.
**Vì sao có giá trị thật:** đây là nội dung học sinh thật sẽ đọc — không phải bài tập giả định.

### A2. Xác minh cấu trúc đề thi tuyển sinh lớp 10 Hà Nội (đang là ước lượng)
`lib/analytics/examBlueprint.ts` hiện đang dùng **số câu ước lượng theo từng phần** (phonetics, ngữ pháp,
cloze, đọc hiểu...) vì nhóm dự án chưa có văn bản chính thức từ Sở GD&ĐT Hà Nội. Việc cần làm: tìm đề thi
thật các năm gần nhất, đếm chính xác số câu mỗi phần, đối chiếu với bảng ước lượng hiện tại (ghi trong
`PROJECT_STATUS.md` mục "Milestone 4c"). Đây là việc **một người có nền sư phạm làm tốt hơn kỹ sư** vì cần
đọc hiểu đề thi, không chỉ đếm số.
**Vì sao có giá trị thật:** con số này ảnh hưởng trực tiếp đến độ chính xác của "điểm sẵn sàng thi" — sửa
đúng ở đây có tác động thật, đo lường được.

### A3. Đánh giá chuỗi gợi ý Socratic (Try → Hint → Guidance → Explanation → Solution)
LEXI thiết kế Lexi (persona AI) theo nguyên tắc không đưa đáp án ngay — dẫn dắt học sinh qua từng bước.
Việc cần làm: thử vai học sinh lớp 9 thật, đi qua luồng gợi ý này với vài chủ đề ngữ pháp khó (thì hoàn
thành, câu điều kiện...), đánh giá xem thứ tự/độ khó tăng dần có hợp lý sư phạm không, đề xuất chỉnh sửa.

### A4. Thiết kế/rà soát trình tự 24 buổi học (curriculum sessions)
Chương trình hiện có 24 session chia 3 giai đoạn (Foundation, Core, Exam Prep). Việc cần làm: đánh giá
trình tự chủ điểm ngữ pháp có đi từ dễ đến khó hợp lý không, có buổi nào thiếu tiền đề không, đề xuất sắp
xếp lại nếu cần.

---

## Track B — Nếu theo Truyền thông / Media

Trọng tâm: cách LEXI kể chuyện, giao tiếp, và định vị — cả nội bộ (giọng điệu sản phẩm) lẫn bên ngoài
(marketing, hồ sơ).

### B1. Xây bộ giọng điệu (voice & tone) cho Lexi — **hạng mục có trọng lượng kiến trúc thật**
Kiến trúc LEXI đã "đóng băng" 4 chương, trong đó Ch.4 (Communication Boundary) đảm bảo *thông tin* không bị
sai lệch khi đến tay học sinh — nhưng **cách nói** (giọng điệu, mức độ khích lệ, cách xử lý khi học sinh
làm sai nhiều lần) được chủ đích để dành cho một lớp riêng, gọi là **Communication Policy**, hiện **chưa
được thiết kế**. Đây là chỗ một người truyền thông có thể đóng góp thật: viết bộ nguyên tắc giọng điệu
(khi nào khích lệ, khi nào nghiêm túc hơn, cách nói về một lỗi sai lặp lại mà không làm học sinh nản) dựa
trên persona hiện có ở `lib/ai/persona.ts`. Sản phẩm là một **tài liệu đặc tả giọng điệu**, không phải code.
**Vì sao có giá trị thật:** đây thực sự nằm trên roadmap kiến trúc kế tiếp (xem dossier, mục "Communication
Policy") — không phải việc phụ, mà là input cho một chương kiến trúc sẽ được thiết kế sau.

### B2. Biến bản nghiên cứu đối thủ thành nội dung định vị bên ngoài
`docs/YOUPASS_COMPETITIVE_RESEARCH_AND_PLAN.md` là nghiên cứu nội bộ, viết bằng ngôn ngữ kỹ thuật. Việc
cần làm: viết lại thành nội dung định vị dễ hiểu cho phụ huynh/học sinh — "LEXI khác gì so với các app
luyện thi khác" — dựa trên các điểm khác biệt thật đã xác nhận (không tự bịa thêm).

### B3. Tài liệu giải thích cho phụ huynh và giáo viên
Viết một bản one-pager phi kỹ thuật giải thích LEXI hoạt động thế nào, dữ liệu học sinh được dùng ra sao,
và tại sao AI không tự quyết định "học sinh giỏi hay yếu" (nguyên tắc Constitution). Mục tiêu: phụ huynh
đọc xong tin tưởng, không cần hiểu kiến trúc.

### B4. Kịch bản demo / video giới thiệu sản phẩm
Dựng kịch bản (script) cho một video ngắn 60–90 giây giới thiệu LEXI, dùng đúng câu chuyện trong dossier
(personal learning companion, không phải chatbot trả lời nhanh) — phù hợp để đính kèm hồ sơ.

---

## Cả hai track đều có thể làm chung

### C1. Phỏng vấn học sinh/gia sư thật
Không cần kỹ thuật: chuẩn bị bộ câu hỏi, phỏng vấn 3–5 học sinh lớp 9 hoặc gia sư dạy tiếng Anh, thu thập
phản hồi về cách học hiện tại, đưa vào một bản tổng hợp insight. Có giá trị cho cả pedagogical review (A)
lẫn định vị sản phẩm (B).

---

## Gợi ý cách bắt đầu

- Nếu chưa chắc theo hướng nào: bắt đầu bằng **A2** (xác minh đề thi) hoặc **B2** (viết lại bản định vị) —
  cả hai đều có đầu ra rõ ràng trong 1–2 tuần, không cần hiểu sâu toàn bộ dự án trước.
- Nếu muốn một hạng mục "nặng ký" hơn cho hồ sơ: **B1** (bộ giọng điệu) — vì nó gắn trực tiếp với một
  chương kiến trúc thật sắp được thiết kế, có thể trích dẫn là đóng góp vào roadmap, không chỉ nội dung
  phụ trợ.
- Cả hai track đều **không cần đọc hay hiểu code** — chỉ cần đọc các file markdown liệt kê ở trên và dùng
  sản phẩm (chạy `npm run dev`, xem `README.md` để biết tài khoản đăng nhập demo).
