# ADR-0007: Đổi lớp bằng ghép cặp trong một giao dịch khóa hai lớp

- Trạng thái: Đã chấp nhận (cải tiến 2, #67)
- Liên quan: US-15, ADR-0003, ADR-0005, `docs/improvements/02-section-swap.md`

## Bối cảnh

Trước đây muốn đổi lớp phải hủy rồi đăng ký lại; ở giữa hai bước sinh viên có thể mất cả hai lớp. Khi cả
hai lớp đều đầy thì không đổi được, dù có một bạn ở lớp kia đang muốn đổi ngược. Đổi lớp đụng tới **hai
lớp và có khi hai sinh viên** cùng lúc, khó hơn đăng ký (chỉ một lớp).

## Các lựa chọn đã cân nhắc

1. **Giữ nguyên: hủy rồi đăng ký lại**: có khoảng hở mất chỗ, không giải quyết được hai lớp cùng đầy.
2. **Đổi chỗ thủ công qua quản trị viên**: không mất chỗ nhưng tốn công, chậm, không tự động.
3. **Ghép vòng nhiều người** (A → B → C → A): giúp được nhiều người hơn nhưng phải tìm chu trình trên
   đồ thị và khóa nhiều lớp cùng lúc; quá phức tạp so với lợi ích.
4. **Ghép cặp hai người + chuyển thẳng khi còn chỗ**, tất cả trong một giao dịch.

## Quyết định

Chọn **phương án 4**. Bảng `swap_requests` lưu yêu cầu (`OPEN`, `COMPLETED`, `CANCELLED`). Một yêu cầu
chạy trong một giao dịch:

1. Khóa **hai lớp theo id tăng dần**, rồi khóa sinh viên (cùng quy ước của ADR-0003, nên không deadlock).
2. Đọc lại sau khi khóa và kiểm tra: còn hạn, đang học môn này, khác lớp, chưa có yêu cầu đang chờ, lớp
   mới không trùng lịch với các lớp khác đang học.
3. Ưu tiên theo thứ tự:
   - **SWAP**: có yêu cầu ngược chiều đang chờ (ai đến trước xét trước, bỏ qua và hủy yêu cầu hết hiệu
     lực) thì đổi chéo; sĩ số giữ nguyên.
   - **MOVE**: lớp mới còn chỗ thì chuyển thẳng, rồi đôn hàng chờ lớp cũ (dùng lại ADR-0005).
   - **QUEUE**: lưu yêu cầu, sinh viên vẫn giữ chỗ cũ.

Hủy yêu cầu cũng khóa hai lớp như lúc ghép; hủy lớp thì yêu cầu từ lớp đó tự hủy.

## Hệ quả

- Tích cực:
  - Không bao giờ mất chỗ: chỉ có "đổi xong trọn vẹn" hoặc "không đổi gì".
  - Hai lớp đầy vẫn đổi được nhờ ghép cặp.
  - Tái sử dụng khóa dòng và hàng chờ có sẵn, không thêm cơ chế mới.
- Tiêu cực / phải chấp nhận:
  - Chưa hỗ trợ đổi vòng nhiều người.
  - Khi lớp mới có người hủy, yêu cầu đang chờ không tự chuyển vào chỗ trống (hàng chờ được ưu tiên);
    sinh viên phải xin lại.

## Bằng chứng trong repo

- `backend/src/swaps/swap.repository.ts`, `swap-rules.ts`; `backend/db/migrations/003_swap_requests.sql`.
- `backend/tests/swap.repository.db.test.ts`: 20 sinh viên ở hai lớp đầy cùng xin đổi chéo, cả 20 đổi
  xong, mỗi lớp vẫn đúng 10 người; chạy lặp 10 lần không có deadlock.
- `tests/api/swap-requests.spec.ts`: cùng kịch bản 20 người qua HTTP.
