# Cải tiến 2: Đổi lớp an toàn

## Vấn đề

Muốn chuyển từ CS201-01 sang CS201-02, sinh viên phải **hủy lớp cũ rồi đăng ký lớp mới**. Giữa hai
thao tác, chỗ cũ có thể đã được đôn cho người trong hàng chờ, và chỗ mới có thể bị người khác lấy mất:
sinh viên **mất cả hai lớp**. Khi cả hai lớp đều đầy thì không thể đổi được, kể cả khi có một bạn ở
lớp kia cũng đang muốn đổi ngược.

## User story

**US-15.** Là sinh viên, tôi muốn đổi sang lớp khác của cùng một môn mà không có lúc nào bị mất chỗ,
và được tự động đổi chéo với bạn đang muốn đổi ngược khi cả hai lớp đều đầy.

## Tiêu chí chấp nhận (Gherkin)

```gherkin
Feature: Đổi lớp an toàn

  Scenario: Lớp mới còn chỗ thì chuyển ngay
    Given std_402 đang học CS201-03 và CS201-02 còn chỗ
    When std_402 xin đổi sang CS201-02
    Then kết quả là MOVED
    And std_402 ở CS201-02, sĩ số CS201-03 giảm 1, CS201-02 tăng 1
    And người đầu hàng chờ của CS201-03 (nếu có) được xếp vào

  Scenario: Lớp mới đầy và chưa ai muốn đổi ngược
    Given std_101 ở CS201-02, std_102 ở CS201-03, cả hai lớp đều đầy
    When std_101 xin đổi sang CS201-03
    Then kết quả là PENDING và std_101 vẫn giữ chỗ ở CS201-02

  Scenario: Đổi chéo khi có người muốn đổi ngược
    Given yêu cầu CS201-02 -> CS201-03 của std_101 đang chờ
    When std_102 xin đổi CS201-03 -> CS201-02
    Then kết quả là SWAPPED
    And std_101 ở CS201-03, std_102 ở CS201-02, sĩ số hai lớp không đổi

  Scenario: Lớp mới trùng lịch với lớp khác đang học
    Given std_402 học MA101-01 (thứ Hai tiết 1-3) và CS201-03
    When std_402 xin đổi sang CS201-01 (thứ Hai tiết 2-4)
    Then hệ thống trả 409 SCHEDULE_CLASH kèm lớp bị trùng MA101-01
    And std_402 vẫn ở CS201-03

  Scenario: Nhiều người đổi chéo cùng lúc
    Given 10 sinh viên ở CS201-02 và 10 sinh viên ở CS201-03, cả hai lớp đầy
    When cả 20 người cùng gửi yêu cầu đổi sang lớp kia
    Then cả 20 yêu cầu hoàn tất, mỗi lớp vẫn đúng 10 người, enrolled_count khớp số dòng thật
```

## Thiết kế

### Dữ liệu

Migration `003_swap_requests.sql`, bảng `swap_requests`:

| Cột | Ý nghĩa |
|---|---|
| `student_id`, `from_section_id`, `to_section_id` | Ai xin đổi, từ lớp nào sang lớp nào |
| `status` | `OPEN` (đang chờ), `COMPLETED` (đã đổi), `CANCELLED` (sinh viên hủy hoặc hết hiệu lực) |
| `outcome` | `MOVED` hoặc `SWAPPED` khi `COMPLETED` (ràng buộc CHECK bắt buộc có khi hoàn tất) |
| `partner_request_id` | Yêu cầu được ghép cặp khi `SWAPPED` |

Chỉ mục duy nhất có điều kiện `uq_swap_requests_open (student_id, from_section_id) WHERE status = 'OPEN'`
bảo đảm mỗi lớp đang học chỉ có một yêu cầu đang chờ.

### API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| `POST` | `/api/v1/swap-requests` | Body `{ toSectionId }`. Trả `201 { outcome: MOVED \| SWAPPED \| PENDING, request }` |
| `GET` | `/api/v1/swap-requests` | Yêu cầu của sinh viên trong học kỳ hiện tại |
| `DELETE` | `/api/v1/swap-requests/{id}` | Hủy yêu cầu đang chờ (`409 SWAP_REQUEST_NOT_OPEN` nếu đã xong) |

### Một lần xin đổi (`backend/src/swaps/swap.repository.ts`), trong một transaction

1. Đọc lớp muốn sang và lớp sinh viên đang học của cùng môn.
2. **Khóa cả hai lớp theo thứ tự id tăng dần**, rồi khóa sinh viên (cùng quy ước "lớp trước, sinh viên
   sau" như khi đăng ký). Mọi giao dịch đổi lớp khóa theo cùng một thứ tự nên không thể deadlock.
3. Đọc lại sau khi khóa; nếu lớp của sinh viên vừa đổi thì trả `409 REGISTRATION_CHANGED`.
4. Kiểm tra theo thứ tự (`swap-rules.ts`): còn hạn đăng ký → đang học môn này → không phải cùng lớp →
   chưa có yêu cầu đang chờ → lớp mới không trùng lịch với các lớp khác đang học. Không cần xét tiên
   quyết hay tín chỉ vì cùng môn.
5. Chọn cách (`planSwap`), ưu tiên theo thứ tự:
   - **SWAP**: có yêu cầu ngược chiều đang chờ (ai đến trước xét trước, bỏ qua và hủy yêu cầu không còn
     hiệu lực). Đổi `section_id` của hai dòng đăng ký, sĩ số giữ nguyên. Ưu tiên vì giúp được hai người.
   - **MOVE**: lớp mới còn chỗ. Chuyển dòng đăng ký sang lớp mới, cập nhật sĩ số hai lớp, rồi đôn người
     đầu hàng chờ của lớp cũ (dùng lại `promoteFromWaitlist`).
   - **QUEUE**: lưu yêu cầu `OPEN`, sinh viên vẫn giữ chỗ cũ.

Hủy lớp (`DELETE /registrations/{id}`) thì yêu cầu đổi từ lớp đó tự chuyển `CANCELLED`. Hủy yêu cầu
cũng khóa hai lớp như lúc ghép cặp, để không hủy đúng lúc yêu cầu đang được ghép.

### Vì sao đúng khi nhiều người cùng đổi

Mọi giao dịch đụng tới cặp lớp A, B đều phải giữ khóa dòng của cả A và B, nên chúng chạy **lần lượt**.
Mỗi giao dịch thấy đúng trạng thái giao dịch trước để lại: nếu có yêu cầu ngược chiều đang chờ thì ghép,
không thì xếp hàng. Vì vậy các yêu cầu đang chờ luôn cùng một chiều, và khi số người hai chiều bằng
nhau thì cuối cùng tất cả đều được ghép. Đây chính là cơ chế `FOR UPDATE` mà thí nghiệm ở
`06-lock-comparison.md` chứng minh là phù hợp nhất cho hệ thống.

## Giao diện

Trang **Môn đã đăng ký**: mỗi lớp có nút **Đổi lớp**, mở danh sách các lớp khác của môn kèm lịch và số
chỗ còn lại. Kết quả hiện bằng câu tiếng Việt cho từng trường hợp; lỗi trùng lịch hiện kèm lớp bị trùng.
Mục **Yêu cầu đổi lớp** liệt kê các yêu cầu, yêu cầu đang chờ có nút hủy.

## Kiểm thử

| Loại | File | Nội dung |
|---|---|---|
| Unit + route | `backend/tests/swap.routes.test.ts` | Thứ tự kiểm tra, chọn cách đổi, body, mã HTTP |
| CSDL thật | `backend/tests/swap.repository.db.test.ts` | 14 test: chuyển thẳng, đôn hàng chờ, chờ, đổi chéo, ai đến trước, yêu cầu hết hiệu lực, hủy lớp, các lỗi, **20 người đổi chéo cùng lúc**, **5 người giành 1 chỗ** |
| API (Playwright) | `tests/api/swap-requests.spec.ts` | 6 kịch bản trên dữ liệu mẫu, kể cả 20 người đổi chéo cùng lúc qua HTTP |
| Giao diện | `frontend/tests/swap.test.tsx` | 7 test: danh sách lớp, 3 kết quả, trùng lịch, hủy yêu cầu, đóng |

## Dữ liệu demo

`backend/db/seeds/003_demo_swaps.sql` (Docker tự nạp): CS101-01 đầy (std_500, std_700), CS101-02 đầy
(std_501), std_501 đang chờ đổi CS101-02 → CS101-01.

1. Đăng nhập `std_500` → Môn đã đăng ký → Đổi lớp CS101-01 → Đổi sang CS101-02: **đổi chéo** với std_501.
2. Đăng nhập `std_700` → đổi CS101-01 → CS101-02: lớp đầy, **lưu yêu cầu**, vẫn giữ chỗ CS101-01.
3. Đăng nhập `std_402` → đăng ký CS201-03 → Đổi lớp → CS201-01 báo **trùng lịch** MA101-01 →
   CS201-02 **chuyển ngay**.

## Giới hạn và hướng phát triển

- Chỉ đổi trong cùng môn. Đổi vòng nhiều người (A → B → C → A) chưa hỗ trợ.
- Khi lớp mới có người hủy và trống chỗ, yêu cầu đang chờ chưa tự chuyển; hàng chờ của lớp vẫn được ưu
  tiên, sinh viên có thể xin lại.
