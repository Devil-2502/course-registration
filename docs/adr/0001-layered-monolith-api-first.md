# ADR-0001: Ứng dụng nguyên khối nhiều tầng, thiết kế API trước

- Trạng thái: Đã chấp nhận
- Liên quan: toàn bộ US-01 đến US-15, `docs/openapi-spec.yaml`

## Bối cảnh

Nhóm 4 người, mỗi người phụ trách một phần (giao diện, nghiệp vụ, CSDL và đăng nhập, kiểm thử), làm
song song trong khoảng 8 tuần. Cần một kiến trúc mà:

- Frontend và backend làm song song được, không phải chờ nhau.
- Phần nghiệp vụ khó nhất (đăng ký đồng thời, tiên quyết, trùng lịch) test được mà không cần dựng cả hệ thống.
- Triển khai đơn giản (một lệnh Docker), vì không có người vận hành riêng.

## Các lựa chọn đã cân nhắc

1. **Microservices** (dịch vụ riêng cho môn học, đăng ký, đăng nhập): tách biệt tốt nhưng giao dịch
   đăng ký phải đi qua nhiều dịch vụ, khó giữ tính đúng khi tranh chấp, và quá nặng cho 4 người.
2. **Ứng dụng web render phía máy chủ** (một khối, trả HTML): đơn giản nhưng frontend và backend dính
   chặt, khó chia việc song song và khó test API riêng.
3. **Nguyên khối nhiều tầng + SPA, thiết kế API trước**: một backend REST duy nhất, một SPA React, hợp
   đồng giữa hai bên viết trước bằng OpenAPI.

## Quyết định

Chọn **phương án 3**:

- **Frontend:** React + Vite + TypeScript, chỉ nói chuyện với backend qua REST `/api/v1`.
- **Backend:** Express + TypeScript, chia tầng: `routes` (đọc request, trả mã HTTP) → **luật nghiệp
  vụ thuần** (ví dụ `registration-rules.ts`, `schedule-clash.ts`, `prerequisite-check.ts`, không đụng
  CSDL) → **repository** (`createXRepository(db)`, chỉ đọc ghi CSDL).
- **Hợp đồng API:** `docs/openapi-spec.yaml` viết trước, CI kiểm tra hợp lệ ở mỗi PR (job `api-contract`).
- **Tiêm phụ thuộc đơn giản:** router nhận repository qua tham số (`createRegistrationsRouter(store, …)`),
  repository nhận `db` (`Pick<Pool, 'query'>` hoặc `Pick<Pool, 'query' | 'connect'>`).

## Hệ quả

- Tích cực:
  - Frontend dùng dữ liệu giả theo OpenAPI để làm trước, rồi nối backend thật sau.
  - Luật nghiệp vụ thuần test rất nhanh, không cần CSDL (phần lớn trong khoảng 290 test chạy trên CI).
  - Route test bằng repository giả; repository test trên PostgreSQL thật (`*.db.test.ts`).
  - Cả hệ thống chạy bằng một lệnh `docker compose up`.
- Tiêu cực / phải chấp nhận:
  - Một backend duy nhất: muốn mở rộng thì phải chạy nhiều bản sao sau bộ cân bằng tải (ghi ở hướng phát triển).
  - Phải giữ OpenAPI khớp với code bằng kỷ luật review (có kiểm tra cú pháp, chưa kiểm tra tự động
    phản hồi thật có khớp schema không; phần này do Playwright API test gánh một phần).

## Bằng chứng trong repo

- `backend/src/app.ts`: gắn từng router với repository thật.
- `backend/src/registration/registration-rules.ts` + `tests/registration-rules.test.ts`: luật thuần.
- `backend/tests/*.routes.test.ts` (repository giả) và `backend/tests/*.db.test.ts` (CSDL thật).
- `.github/workflows/ci.yml`: 4 job `api-contract`, `backend`, `frontend`, `api-test`.
