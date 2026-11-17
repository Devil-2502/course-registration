# Cải tiến 1: Gợi ý thời khóa biểu tự động

## User story

**US-14.** Là sinh viên, tôi muốn chọn các môn định học và để hệ thống tự tìm các cách xếp lớp
không trùng lịch, xếp hạng theo sở thích của tôi, để không phải tự thử từng tổ hợp lớp.

## Tiêu chí chấp nhận (Gherkin)

```gherkin
Feature: Gợi ý thời khóa biểu

  Background:
    Given sinh viên std_402 đã đạt CS101
    And đang học MA101-01 (thứ Hai, tiết 1-3)

  Scenario: Bỏ lớp trùng lịch với lớp đang học
    When std_402 yêu cầu gợi ý cho môn CS201
    Then không phương án nào có CS201-01 (thứ Hai, tiết 2-4)
    And mọi phương án đều giữ MA101-01

  Scenario: Ưu tiên ngày muốn nghỉ
    Given sinh viên std_500 chưa đăng ký lớp nào
    When std_500 yêu cầu gợi ý cho CS101 và chọn muốn nghỉ thứ Ba
    Then phương án 1 là CS101-02 (thứ Sáu)
    And phương án CS101-01 (thứ Ba) ghi "vẫn học vào Thứ 3"

  Scenario: Ghi rõ lý do môn không được xếp
    When std_402 yêu cầu gợi ý cho CS101, CS301 và MA101
    Then CS101 có trạng thái COURSE_ALREADY_PASSED
    And CS301 có trạng thái PREREQUISITE_NOT_MET kèm môn còn thiếu CS201
    And MA101 có trạng thái ALREADY_ENROLLED

  Scenario: Đăng ký cả phương án
    Given std_402 đang xem phương án 1
    When std_402 bấm "Đăng ký phương án này" và xác nhận
    Then từng lớp được đăng ký qua POST /registrations như bình thường
    And lớp nào không đăng ký được thì báo lý do riêng cho lớp đó
```

## API

`POST /api/v1/schedule-suggestions` (chỉ sinh viên). Chi tiết schema trong `docs/openapi-spec.yaml`.

```json
{
  "courseIds": [2, 9, 19],
  "preferences": { "avoidMorning": false, "compactDays": true, "freeDays": [6, 7] },
  "limit": 5
}
```

Kết quả gồm: lý do từng môn (`courses[].status`), các lớp đang học (`enrolled`), tín chỉ
(`currentCredits`, `requestedCredits`, `exceedsCreditLimit`) và tối đa `limit` phương án
(`suggestions[]`, mỗi phương án có `penalty`, `metrics`, `sections`).

API chỉ đọc, không giữ chỗ. Sinh viên vẫn đăng ký từng lớp qua `POST /registrations`, nên mọi
kiểm tra và cơ chế khóa chống tranh chấp chỗ cuối cùng vẫn áp dụng.

## Thuật toán (`backend/src/suggestions/schedule-suggester.ts`)

1. **Lọc trước** (`buildSuggestions`): mỗi môn xét theo thứ tự đã đăng ký → đã đạt → thiếu tiên
   quyết → không còn lớp còn chỗ → mọi lớp trùng lớp đang học. Môn qua hết thì giữ lại các lớp
   còn chỗ và không trùng lớp đang học.
2. **Quay lui (backtracking)**: chọn lần lượt một lớp cho từng môn, bỏ ngay nhánh nào trùng lịch
   (dùng lại `sectionsClash` của US-06). Môn có ít lớp được xét trước để cắt nhánh sớm.
   Dừng ở 2 000 phương án hợp lệ (`truncated = true`) để yêu cầu không chạy quá lâu.
3. **Chấm điểm phạt** cho cả tuần (lớp đang học + lớp mới), thấp hơn là tốt hơn:

   | Tiêu chí | Điểm phạt | Khi nào tính |
   |---|---|---|
   | Ngày muốn nghỉ nhưng vẫn có lịch | 40 / ngày | luôn tính nếu có chọn ngày nghỉ |
   | Buổi học bắt đầu tiết 1-6 | 10 / buổi | khi chọn "Tránh học buổi sáng" |
   | Số ngày phải đến trường | 10 / ngày | khi chọn "Dồn lịch vào ít ngày" |
   | Tiết trống giữa hai buổi cùng ngày | 2 / tiết | luôn tính |

4. **Xếp hạng**: điểm phạt, rồi ít tiết trống, rồi ít ngày học, cuối cùng theo mã lớp để cùng dữ
   liệu luôn cho cùng kết quả.

**Độ phức tạp:** trường hợp xấu nhất là tích số lớp của các môn (tối đa 8 môn), nhưng nhánh trùng
lịch bị cắt sớm và có giới hạn 2 000 phương án, nên mỗi yêu cầu chạy trong vài mili giây.

## Kiểm thử

| Loại | File | Nội dung |
|---|---|---|
| Unit | `backend/tests/schedule-suggester.test.ts` | Đo tuần học, điểm phạt, quay lui, giới hạn, thứ tự ổn định |
| Unit + route | `backend/tests/schedule-suggestions.test.ts` | Kiểm tra body, lý do từng môn, tín chỉ, 400 / 404 |
| CSDL thật | `backend/tests/schedule-suggestions.repository.db.test.ts` | Đọc đúng học kỳ, lớp đầy, lịch sắp xếp |
| API (Playwright) | `tests/api/schedule-suggestions.spec.ts` | 6 kịch bản trên dữ liệu mẫu, kể cả admin bị 403 |
| Giao diện | `frontend/tests/suggestions.test.tsx` | Chọn môn, sở thích, đổi phương án, đăng ký từng lớp |

## Dữ liệu demo

`backend/db/seeds/002_demo_suggestions.sql` thêm lớp thứ hai cho CS202, CS210, CS220, MA201, EN101
và PE101 để có nhiều cách ghép. Docker tự nạp file này. Test Playwright chỉ nạp `001_seed.sql`
nên không bị ảnh hưởng.

Kịch bản demo: đăng nhập `std_402`, chọn CS201, CS202, CS210, MA201, EN101, PE101, tick
"Dồn lịch vào ít ngày" và muốn nghỉ Thứ 7, Chủ nhật → 12 cách xếp, phương án 1 dùng 5 ngày,
0 tiết trống, không học cuối tuần.
