# ADR-0005: Hàng chờ tự đôn người đầu hàng trong cùng giao dịch hủy

- Trạng thái: Đã chấp nhận
- Liên quan: BR-08, US-09, US-10, US-12

## Bối cảnh

Lớp đầy thì sinh viên vào hàng chờ (US-09). Khi có người hủy (US-10), quản trị viên tăng sức chứa (US-12)
hoặc có người chuyển lớp đi (cải tiến 2), một chỗ trống xuất hiện. Câu hỏi: chỗ đó giao cho ai, lúc nào,
và làm sao không để người khác "chen ngang" trong khoảnh khắc chỗ còn trống.

## Các lựa chọn đã cân nhắc

1. **Báo cho người đầu hàng và giữ chỗ trong X giờ**: công bằng và cho sinh viên quyền từ chối, nhưng
   cần gửi thông báo (email, ứng dụng), bộ hẹn giờ chạy nền để hết hạn thì chuyển người tiếp theo.
2. **Mở chỗ cho tất cả, ai nhanh người đó được**: đơn giản nhưng hàng chờ mất ý nghĩa.
3. **Tự động xếp người đầu hàng còn đủ điều kiện vào lớp, ngay trong giao dịch tạo ra chỗ trống**.

## Quyết định

Chọn **phương án 3**, cài trong hàm dùng chung `promoteFromWaitlist(client, sectionId)`:

- Gọi trong **cùng giao dịch** với thao tác tạo chỗ trống (hủy lớp, tăng sức chứa, chuyển lớp đi), lúc
  dòng của lớp **vẫn đang bị khóa**. Vì vậy không ai chen được vào chỗ trống trước người đầu hàng.
- Xét theo thứ tự vào trước ra trước (`ORDER BY created_at, id`). Với từng người: khóa sinh viên, đọc lại
  dữ kiện và kiểm tra **đúng các luật như khi đăng ký** (tiên quyết, trùng lịch, tín chỉ…).
- Đủ điều kiện thì xếp vào lớp (`PROMOTED`); không đủ thì đánh dấu `SKIPPED` và xét người kế tiếp; hết
  hàng thì để chỗ trống.

## Hệ quả

- Tích cực:
  - Công bằng tuyệt đối theo thứ tự vào hàng, không có khoảnh khắc chỗ trống bị lấy mất.
  - Không cần hệ thống thông báo hay tác vụ chạy nền.
  - Một hàm dùng lại ở ba nơi; người được đôn luôn hợp lệ như vừa tự đăng ký.
- Tiêu cực / phải chấp nhận:
  - Sinh viên được xếp lớp mà không được hỏi lại; nếu không muốn học nữa thì phải tự hủy.
  - Giao dịch hủy lâu hơn một chút khi phải bỏ qua nhiều người không đủ điều kiện.
  - Thông báo và hạn xác nhận giữ chỗ được ghi ở **hướng phát triển**.

## Bằng chứng trong repo

- `promoteFromWaitlist` trong `backend/src/registration/enrolment.repository.ts`, được gọi từ
  `drop` (cùng file), `backend/src/admin/catalog.repository.ts` (tăng sức chứa) và
  `backend/src/swaps/swap.repository.ts` (chuyển lớp).
- `docs/uml/sequence-drop-promotion.png`.
- Stress test "hủy và đẩy hàng chờ" (#63): 5 người hủy cùng lúc, đúng 5 người đầu hàng
  (std_181 đến std_185) được xếp, lớp vẫn đầy.
