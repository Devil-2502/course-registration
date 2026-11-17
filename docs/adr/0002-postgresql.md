# ADR-0002: Dùng PostgreSQL

- Trạng thái: Đã chấp nhận
- Liên quan: BR-05, BR-06, US-08 (giành chỗ cuối), `backend/db/migrations/`

## Bối cảnh

Dữ liệu của bài toán có **quan hệ chặt**: sinh viên ↔ đăng ký ↔ lớp học phần ↔ môn ↔ học kỳ, môn ↔
môn tiên quyết, lớp ↔ buổi học. Yêu cầu quan trọng nhất (BR-05) là **không bao giờ vượt sức chứa**, kể
cả khi hàng trăm sinh viên đăng ký cùng lúc. Điều này cần giao dịch có tính ACID và cơ chế khóa đáng tin.

## Các lựa chọn đã cân nhắc

1. **MongoDB** (tài liệu): linh hoạt về cấu trúc, nhưng dữ liệu ở đây vốn là quan hệ (nhiều phép nối);
   giao dịch nhiều tài liệu và ràng buộc toàn vẹn phải tự làm ở ứng dụng.
2. **MySQL**: cũng là CSDL quan hệ, có `FOR UPDATE`, nhưng không có chỉ mục duy nhất có điều kiện
   (partial unique index), thứ nhóm cần để chặn đăng ký trùng mà vẫn giữ lịch sử đã hủy.
3. **PostgreSQL**.

## Quyết định

Chọn **PostgreSQL 16**, và dùng chính CSDL làm **lớp bảo vệ cuối** cho các luật quan trọng:

| Tính năng PostgreSQL | Dùng để |
|---|---|
| Giao dịch + `SELECT ... FOR UPDATE` | Xếp hàng các yêu cầu cùng lớp (ADR-0003) |
| `CHECK (enrolled_count >= 0 AND enrolled_count <= capacity)` | Không bao giờ vượt sức chứa, kể cả nếu code có lỗi |
| Chỉ mục duy nhất có điều kiện `uq_enrolments_active ... WHERE status = 'ENROLLED'` | Chặn đăng ký trùng (bấm hai lần) mà vẫn giữ dòng `DROPPED` làm lịch sử |
| `uq_waitlist_waiting`, `uq_swap_requests_open` | Mỗi người chỉ một chỗ đang chờ / một yêu cầu đổi đang chờ |
| Khóa ngoại `ON DELETE CASCADE` | Xóa sinh viên hay lớp không để lại dữ liệu mồ côi |
| `json_agg`, `json_build_object` | Trả lớp kèm lịch học trong một truy vấn |

## Hệ quả

- Tích cực:
  - Tính đúng được bảo đảm ở hai lớp: code (khóa, kiểm tra) và CSDL (ràng buộc).
  - Truy vấn nối bảng tự nhiên, schema rõ ràng và tự mô tả qua các file migration.
- Tiêu cực / phải chấp nhận:
  - Đổi schema phải viết migration (`001`, `002`, `003`) và nạp lại dữ liệu mẫu.
  - Cột `enrolled_count` là dữ liệu dư (đếm được từ bảng `enrolments`) nên phải luôn cập nhật trong cùng
    giao dịch; test và stress test đều kiểm tra `enrolled_count` bằng số dòng `ENROLLED` thật.

## Bằng chứng trong repo

- `backend/db/migrations/001_init.sql` (ràng buộc, chỉ mục), `003_swap_requests.sql`.
- Stress test kịch bản "bấm hai lần": 10 yêu cầu cùng lúc chỉ tạo 1 đăng ký, 9 lần `409 ALREADY_ENROLLED` (#63).
- `docker-compose.yml`: `postgres:16-alpine`.
