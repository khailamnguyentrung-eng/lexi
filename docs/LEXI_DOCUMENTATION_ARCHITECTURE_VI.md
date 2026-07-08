# Kiến trúc Hệ thống Tài liệu LEXI

## Phần 1: Phân tích Cấu trúc Đề xuất

Đề xuất của bạn (7 tài liệu) có giá trị nhưng có những vấn đề cấu trúc sẽ tạo nợ kỹ thuật dài hạn. Hãy để tôi chỉ ra chúng:

**Vấn đề:**

1. **Thiếu lớp "north star"** — Product Constitution quá mơ hồ. Toàn bộ kiến trúc LEXI dựa trên **Knowledge Graph như nguồn sự thật duy nhất** và **Decision Engine như vòng lặp phản hồi**. Cả hai đều không được nhắc tới trong cấu trúc của bạn, nhưng chúng là cánh cổng cho mọi thứ theo sau.

2. **"Technical Requirements" là một cầu nối mơ hồ** — không rõ đây là yêu cầu không kỹ thuật do sản phẩm viết, hay là một đặc tả kỹ thuật. Tạo sự mơ hồ về ai sở hữu nó và khi nào nó "hoàn thành".

3. **App Flow ≠ tài liệu hạng nhất** — flows là behavioral specs xuất phát từ Product Requirements + quyết định UX. Coi nó riêng biệt tạo ra trùng lặp (flows xuất hiện trong PRD, sau đó lại trong "App Flow", rồi lại trong UI spec). Nên là *được sinh ra từ* các spec cấp cao hơn, không được viết riêng.

4. **Thiếu tài liệu Data Model** — LEXI là *dựa-trên-mô-hình-dữ-liệu* (Knowledge Graph, Learner State, Event Schema, provenance của Question). Đây không phải chi tiết triển khai; đây là kiến trúc. Cần tồn tại trước Backend Architecture, vì mọi thứ đều phụ thuộc vào nó.

5. **Thiếu spec Learning Science** — mô hình mastery, chính sách spacing, định nghĩa signal, contract vòng lặp phản hồi. Đây không phải "mùi hương khoa học"; đây là đặc tả engine. Hiện đang thiếu.

6. **"Backend Architecture" đến quá muộn** — System Architecture (phân rã ba trụ cột: Learner Model vs Content Pipeline vs Decision Engine) nên đi trước Backend Architecture, vì nó là blueprint khái niệm.

7. **Implementation Plan là số ít** — LEXI là multi-phase. Nên là "Implementation Plan (per phase)" hay nên có "Development Roadmap" như một tài liệu riêng sắp xếp nhiều plan.

8. **Thiếu contract Event/Analytics** — những signals nào được ghi lại, ở độ mịn nào, cách chúng được đưa trở lại Learner Model. Quan trọng với vòng lặp phản hồi, hiện không nhìn thấy.

9. **Thiếu Owner/update policy cho mỗi tài liệu** — làm sao ai đó biết khi nào cần cập nhật "Technical Requirements"? Ai sở hữu nó? Cái gì khiến nó lỗi thời?

---

## Phần 2: Kiến trúc Tài liệu Được Thiết kế Lại

Tôi đề xuất một **hệ thống phân tầng, phân cấp** với các phụ thuộc rõ ràng và không trùng lặp:

### **Tầng 0: North Star (Bất biến, hiếm khi thay đổi, là cánh cổng cho tất cả)**

Những tài liệu này định nghĩa *tại sao* và *các ràng buộc lõi*. Thay đổi ở đây lan tỏa khắp nơi, nên chúng được quản lý như một hiến pháp.

#### 1. **Tầm nhìn & Nguyên tắc Sản phẩm (Product Vision & Principles)**
   - **Mục đích:** Thiết lập north star bất khả xâm phạm (LEXI là một companion, không phải chatbot; AI chỉ là orchestration; hệ thống là sản phẩm)
   - **Phạm vi:** Tầm nhìn, các bet lõi, nguyên tắc thiết kế (thứ tự ưu tiên: backend > UX psychology > learning science > scalability > UI), non-goals
   - **Phạm vi KHÔNG bao gồm:** Làm thế nào để xây dựng (Backend Architecture); flows (UX Spec); UI
   - **Phụ thuộc:** Không (đây là tầng 0)
   - **Sở hữu:** Founder / Head of Product
   - **Chính sách cập nhật:** Hàng năm hoặc trên pivoting chiến lược
   - **Mức trừu tượng:** Conceptual (cao cấp, hướng sứ mệnh)
   - **Độ dài:** 3–5 trang

#### 2. **Mô hình Dữ liệu (Knowledge Graph, Learner State, Event Schema)**
   - **Mục đích:** Định nghĩa hình dạng của tất cả thông tin chảy qua LEXI (KnowledgeUnit là gì? Question? LearningAction? Những sự kiện nào tồn tại?)
   - **Phạm vi:** Định nghĩa entity, quan hệ, ràng buộc (ví dụ: "Question luôn map tới KU và Resource, không bao giờ thuộc kỳ thi"; "Một KnowledgeUnit, nhiều Programs"), invariants, cardinality, inheritance
   - **Phạm vi KHÔNG bao gồm:** Làm thế nào để persist/query (đó là Backend); cách render (đó là UI); business rules (đó là tầng tiếp theo)
   - **Phụ thuộc:** Product Vision
   - **Sở hữu:** Engineering Lead + Product Architect
   - **Chính sách cập nhật:** Khi một class entity mới được giới thiệu (hiếm); khi một invariant thay đổi (không thường xuyên); xem xét hàng quý
   - **Mức trừu tượng:** Functional (schema diagrams, ERD, định nghĩa)
   - **Độ dài:** 8–12 trang

#### 3. **Đặc tả Mô hình Học tập (Learning Model Specification)**
   - **Mục đích:** Định nghĩa learning science engine — trạng thái mastery, chính sách spacing, định nghĩa signal, contract vòng lặp phản hồi
   - **Phạm vi:** Mô hình mastery (trạng thái, độ tin cậy, decay), thuật toán spacing (SM-2? Leitner? custom?), taxonomy signal (IMPROVED, RECURRING, RETENTION_RISK, etc.), cách signals → trigger re-plan, confidence tiers
   - **Phạm vi KHÔNG bao gồm:** UI (cách display mastery), triển khai (chi tiết code), persistence backend (đó là tầng tiếp theo)
   - **Phụ thuộc:** Data Model, Product Vision
   - **Sở hữu:** Learning Science Lead + Product Architect
   - **Chính sách cập nhật:** Khi chúng ta thay đổi mastery model hay thuật toán spacing (hiếm); xem xét per semester hoặc sau major A/B test
   - **Mức trừu tượng:** Functional (state diagrams, algorithms in pseudocode, decision tables)
   - **Độ dài:** 10–15 trang

#### 4. **Kiến trúc Hệ thống (Ba Trụ cột) (System Architecture)**
   - **Mục đích:** Phân rã LEXI thành ba trụ cột khái niệm và giao diện của chúng
   - **Phạm vi:** Learner Model (chúng tôi biết gì về học sinh), Content Pipeline (resource → KU → Program → Question), Decision Engine (đọc Model + Goal + Content, phát ra LearningAction), và cách chúng nói chuyện
   - **Phạm vi KHÔNG bao gồm:** Service boundaries (Backend Architecture); triển khai kỹ thuật; UI
   - **Phụ thuộc:** Data Model, Learning Model, Product Vision
   - **Sở hữu:** System Architect + Engineering Lead
   - **Chính sách cập nhật:** Khi trách nhiệm của một trụ thay đổi hoặc interface shifts (không thường xuyên); xem xét tại phase start
   - **Mức trừu tượng:** Conceptual → Functional (block diagram, interface specs, coupling model)
   - **Độ dài:** 8–12 trang

---

### **Tầng 1: Đặc tả Sản phẩm (Thay đổi khi chúng ta học hỏi, nhưng mạch lạc trong một phase)**

Những tài liệu này xuất phát từ Tầng 0 và định nghĩa *cái gì* chúng ta đang xây dựng và *tại sao*.

#### 5. **Yêu cầu Sản phẩm (PRD)**
   - **Mục đích:** Định nghĩa vấn đề người dùng, use cases, phạm vi MVP, success metrics
   - **Phạm vi:** Persona, vấn đề, user journeys, acceptance criteria, out-of-scope constraints, phân biệt MVP/phase 2/future
   - **Phạm vi KHÔNG bao gồm:** Cách xây dựng (Backend Architecture); flows (xuất phát từ PRD); UI (tầng tiếp theo)
   - **Phụ thuộc:** System Architecture, Product Vision
   - **Sở hữu:** Product Manager + Product Architect
   - **Chính sách cập nhật:** Tại phase start, hoặc khi một use case thay đổi; xem xét hàng quý
   - **Mức trừu tượng:** Functional (user stories, acceptance criteria, problem statements)
   - **Độ dài:** 15–25 trang

#### 6. **Đặc tả Trải nghiệm Người dùng (UX Spec) — Flows & Interaction Model**
   - **Mục đích:** Định nghĩa user flows, interaction patterns, nguyên tắc tâm lý trong trò chơi
   - **Phạm vi:** Primary flows (onboarding, vòng lặp học tập, feedback, re-planning), edge cases, nguyên tắc thiết kế (Procrastination & Defense, CAM KẾT, etc.), state transitions, error handling
   - **Phạm vi KHÔNG bao gồm:** Wireframes/mockups (đó là UI Spec); triển khai kỹ thuật; chi tiết backend
   - **Phụ thuộc:** Product Requirements, System Architecture
   - **Sở hữu:** Product Lead + UX/Interaction Designer
   - **Chính sách cập nhật:** Khi user flow thay đổi hoặc chúng ta học được điều gì về tâm lý; xem xét per phase
   - **Mức trừu tượng:** Functional (flowcharts, decision trees, narrative descriptions)
   - **Độ dài:** 10–15 trang

#### 7. **Đặc tả UX/UI (Screens, Components, Responsive, Theme)**
   - **Mục đích:** Định nghĩa mọi screen, component state, responsive behavior, visual language
   - **Phạm vi:** Screen inventory (Home, Dashboard, LearnTab, ReviewTab, etc.), component specs (Button states, Modal variants), responsive breakpoints, dark/light theme, motion principles, accessibility (WCAG 2.1 AA)
   - **Phạm vi KHÔNG bao gồm:** Triển khai (React component code); backend logic; user psychology (đó là UX Spec)
   - **Phụ thuộc:** User Experience Spec, Product Requirements
   - **Sở hữu:** UX Designer + Design System Lead
   - **Chính sách cập nhật:** Khi design thay đổi; xem xét per sprint
   - **Mức trừu tượng:** Technical (wireframes, component library specs, design tokens)
   - **Độ dài:** 20–40 trang

---

### **Tầng 2: Thiết kế Kỹ thuật (Thay đổi thường xuyên, hướng engineering)**

Những tài liệu này xuất phát từ Tầng 1 và định nghĩa *cách* chúng ta xây dựng nó.

#### 8. **Kiến trúc Backend (Services, Data Flow, APIs)**
   - **Mục đích:** Định nghĩa service boundaries, data flow, API contracts, persistence strategy
   - **Phạm vi:** Quyết định microservice/monolith, danh sách service (Learner Model service, Content service, Decision Engine service, etc.), API routes, caching strategy, async job model, event streaming
   - **Phạm vi KHÔNG bao gồm:** Chi tiết triển khai (đó là Implementation Plan); component-level design; UI
   - **Phụ thuộc:** System Architecture, Data Model, Product Requirements
   - **Sở hữu:** Backend Lead + System Architect
   - **Chính sách cập nhật:** Khi service boundaries shift hoặc API contract thay đổi; xem xét per phase
   - **Mức trừu tượng:** Technical (architecture diagram, OpenAPI specs, data flow diagrams)
   - **Độ dài:** 15–25 trang

#### 9. **Kiến trúc Frontend (Component Model, State Management, Libraries)**
   - **Mục đích:** Định nghĩa component hierarchy, state management strategy, third-party libraries
   - **Phạm vi:** Component tree structure, state shape (Redux/Zustand/Context), data fetching strategy (React Query/SWR), routing, build/bundle strategy
   - **Phạm vi KHÔNG bao gồm:** Code component riêng lẻ; UI spec (đó là phụ thuộc); backend APIs (Backend Architecture)
   - **Phụ thuộc:** UX/UI Spec, Product Requirements, System Architecture
   - **Sở hữu:** Frontend Lead
   - **Chính sách cập nhật:** Khi component model hay state strategy thay đổi; xem xét per major refactor
   - **Mức trừu tượng:** Technical (architecture diagram, component tree, state shape diagram)
   - **Độ dài:** 10–15 trang

#### 10. **Điểm Tích hợp (Integration Points) — AI Providers, Caching, Persistence, Analytics**
   - **Mục đích:** Quy định các phụ thuộc bên ngoài và cách chúng kết nối
   - **Phạm vi:** AI provider interface (Claude, Gemini, fallback), caching layer (Redis? in-memory?), database choice và schema (Prisma relations?), analytics/event logging (Segment? custom?), error handling/fallback behavior
   - **Phạm vi KHÔNG bao gồm:** Chi tiết triển khai thuật toán (Learning Model Spec); kiến trúc service (Backend Arch)
   - **Phụ thuộc:** Backend Architecture, Learning Model Spec, Data Model
   - **Sở hữu:** Platform/Infrastructure Lead + Backend Lead
   - **Chính sách cập nhật:** Khi thêm integration mới hay thay đổi provider; xem xét hàng năm
   - **Mức trừu tượng:** Technical
   - **Độ dài:** 8–12 trang

---

### **Tầng 3: Thực thi (Thay đổi hàng tuần, hướng công việc hằng ngày)**

Những tài liệu này là chiến thuật, per-phase, tập trung vào triển khai.

#### 11. **Implementation Plan (Phase X: Cái gì Được Xây dựng Khi nào)**
   - **Mục đích:** Sắp xếp công việc trong một phase, xác định phụ thuộc, ước tính effort
   - **Phạm vi:** Lịch milestone, story breakdown, task dependencies, tech debt, risk register, định nghĩa "done" per milestone
   - **Phạm vi KHÔNG bao gồm:** Code (đó là trong PRs); design mockups (UX/UI Spec); quyết định kiến trúc (tầng trước)
   - **Phụ thuộc:** TẤT CẢ Layer 0–2
   - **Sở hữu:** Engineering Lead + Project Manager
   - **Chính sách cập nhật:** Hàng tuần (sprint planning); xem xét per milestone
   - **Mức trừu tượng:** Implementation (Gantt, task breakdown, burn-down)
   - **Độ dài:** 5–10 trang per phase (thay đổi mỗi 4–6 tuần)

#### 12. **API Reference (OpenAPI/GraphQL Schema)**
   - **Mục đích:** Phục vụ như contract giữa frontend và backend
   - **Phạm vi:** Mọi endpoint, query/mutation, request/response shapes, error codes, examples
   - **Phạm vi KHÔNG bao gồm:** Kiến trúc service (Backend Arch), xác thực (có thể trong Backend Arch hay tài liệu bảo mật riêng)
   - **Phụ thuộc:** Backend Architecture
   - **Sở hữu:** Backend Lead (auto-generated từ code khi có thể)
   - **Chính sách cập nhật:** Liên tục (khi APIs thay đổi); được sinh ra từ code
   - **Mức trừu tượng:** Technical (OpenAPI YAML/JSON or GraphQL SDL)
   - **Độ dài:** 20–50 trang

#### 13. **Tài liệu Component Library / UI Kit**
   - **Mục đích:** Developers có thể tái sử dụng components mà không cần đọc lại design spec
   - **Phạm vi:** Mọi component, props của nó, variants, accessibility notes, examples trong Storybook
   - **Phạm vi KHÔNG bao gồm:** Design rationale (đó là UX/UI Spec); backend logic
   - **Phụ thuộc:** UX/UI Specification
   - **Sở hữu:** Design System Lead + Frontend Lead (ideally auto-generated từ Storybook)
   - **Chính sách cập nhật:** Liên tục (khi components được thêm/sửa)
   - **Mức trừu tượng:** Technical (component inventory + Storybook)
   - **Độ dài:** 30–60 trang (một per component)

---

## Phần 3: Đồ thị Phụ thuộc Hoàn chỉnh

```
┌─ Tầm nhìn & Nguyên tắc Sản phẩm ◄─ (Tầng 0: Immutable North Star)
│
├─ Mô hình Dữ liệu (KU, Learner State, Event Schema)
│  ├─→ Đặc tả Mô hình Học tập (mastery, spacing, signals)
│  └─→ Kiến trúc Backend
│       └─→ API Reference (auto-generated)
│       └─→ Điểm Tích hợp
│
├─ Kiến trúc Hệ thống (Ba Trụ cột)
│  ├─→ Yêu cầu Sản phẩm (PRD)
│  │   └─→ Đặc tả Trải nghiệm Người dùng (flows)
│  │       └─→ Đặc tả UX/UI (screens + components)
│  │           └─→ Tài liệu Component Library / UI Kit
│  │               └─→ Kiến trúc Frontend
│  │
│  ├─→ Kiến trúc Backend (xem trên)
│  │
│  └─→ Kiến trúc Frontend (xem trên)
│
└─ Đặc tả Mô hình Học tập (xem trên)

───────────────────────────────────────────

TẤT CẢ CỦA TRÊN ┐
               └─→ Implementation Plan (Phase X)
                  └─→ (lặp lại per phase)
```

**Nhận xét chính:**
- Tầng 0 bất biến và là cánh cổng cho mọi thứ
- Tầng 1 xuất phát từ Tầng 0 mà không nhánh (luồng logic)
- Tầng 2 thêm độ sâu kỹ thuật song song (backend và frontend có thể tiến độc lập)
- Tầng 3 kết nó lại thành công việc có thể thực thi được
- **Không trùng lặp** — mỗi tài liệu có một source of truth và sở hữu một tầng
- **Rõ ràng sở hữu** — mỗi tài liệu có owner được đặt tên
- **Rõ ràng update cadence** — một số thay đổi hàng tuần (Implementation), một số hàng năm (Vision)

---

## Phần 4: Tập hợp Tối thiểu cho MVP

**Must Have** (không thể ship nếu thiếu những cái này):
1. Tầm nhìn & Nguyên tắc Sản phẩm
2. Mô hình Dữ liệu
3. Đặc tả Mô hình Học tập
4. Kiến trúc Hệ thống
5. Yêu cầu Sản phẩm (PRD)
6. Kiến trúc Backend
7. Đặc tả UX/UI
8. Implementation Plan (Phase 1)

**Should Have** (ship là có thể, nhưng rủi ro/chậm nếu thiếu):
9. Đặc tả Trải nghiệm Người dùng (flows)
10. Kiến trúc Frontend
11. API Reference
12. Điểm Tích hợp

**Nice to Have** (có thể được sinh ra/học sau MVP):
13. Tài liệu Component Library (auto-generated từ Storybook)
14. Implementation Plan (Phase 2+)

---

## Phần 5: Thách thức đối với Đề xuất của Bạn

Cấu trúc của bạn là **tư duy theo thứ tự ship** ("xây cái này, rồi cái này, rồi cái kia"), không phải **tư duy kiến trúc** ("cái gì phải đúng trước khi *bất cứ thứ gì* có thể được xây dựng?").

**Vấn đề cụ thể:**

1. **"Product Constitution" quá mơ hồ.** Nó nên là "Tầm nhìn & Nguyên tắc Sản phẩm" (tại sao, core bets, non-negotiables) + "Mô hình Dữ liệu" (cái gì, schema).

2. **Thiếu spec learning science** → rủi ro. LEXI nếu không có spec mastery model là như ship tàu vũ trụ mà không biết hướng nào lên.

3. **"Technical Requirements" không nên tồn tại.** Gộp nó vào Backend Architecture (owned by engineers) + Product Requirements (owned by product). Đừng tạo một cây cầu mờ.

4. **"App Flow" là phái sinh.** Flows nên được viết trong User Experience Spec (một tài liệu thích hợp), không phải như một artifact riêng. Điều này ngăn trùng lặp.

5. **Thứ tự sai.** Bạn có System Architecture implicit (chỉ trong Backend Arch), nhưng nó nên *rõ ràng và trước hết* — nó là blueprint mà mọi thứ khác treo lên.

---

## Các Bước Kế tiếp Đề xuất (nếu bạn đồng ý với kiến trúc này)

1. **Phê duyệt hoặc thách thức** cấu trúc 13-tài liệu và tổ chức Tầng 0–3
2. **Gán owner** cho mỗi tài liệu (Product / Engineering / UX / AI / Founder)
3. **Khóa đồ thị phụ thuộc** để biết những tài liệu nào có thể được viết song song
4. **Ưu tiên** tập hợp tối thiểu MVP và đồng ý về chuỗi viết
5. **Định nghĩa update cadences** cho mỗi tài liệu (ví dụ: "Data Model khóa trong 6 tháng", "Implementation Plan hàng tuần")

Kiến trúc này có phù hợp, hay tôi nên sửa đổi trước khi chúng ta khóa nó?
