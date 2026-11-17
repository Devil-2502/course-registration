# ADR-0006: Gợi ý thời khóa biểu bằng quay lui và điểm phạt

- Trạng thái: Đã chấp nhận (cải tiến 1, #65)
- Liên quan: US-14, BR-03, `docs/improvements/01-schedule-suggestions.md`

## Bối cảnh

Sinh viên muốn học vài môn, mỗi môn có vài lớp; tự thử từng tổ hợp xem có trùng lịch không rất mất công.
Cần tính năng chọn mỗi môn một lớp sao cho không trùng (kể cả với lớp đang học), rồi xếp hạng theo sở
thích (tránh học sáng hoặc chiều, dồn lịch, ngày muốn nghỉ). Số lượng nhỏ: tối đa 8 môn, mỗi môn vài lớp.

## Các lựa chọn đã cân nhắc

1. **Tham lam** (mỗi môn chọn lớp tốt nhất lúc đó): nhanh nhưng dễ bỏ sót phương án tốt, có khi không
   tìm ra phương án dù có tồn tại.
2. **Bộ giải tối ưu** (quy hoạch nguyên, ràng buộc): tối ưu thật nhưng thêm thư viện nặng, khó giải
   thích và khó test cho đồ án môn học.
3. **Thuật toán di truyền / tìm kiếm ngẫu nhiên**: không bảo đảm tìm thấy, kết quả mỗi lần một khác.
4. **Quay lui có cắt nhánh + chấm điểm phạt**: liệt kê mọi tổ hợp hợp lệ (bỏ nhánh trùng lịch ngay khi
   phát hiện), chấm điểm từng tổ hợp, sắp xếp.

## Quyết định

Chọn **phương án 4**:

- Lọc trước từng môn theo đúng thứ tự kiểm tra khi đăng ký (đã học, đã đạt, thiếu tiên quyết, hết chỗ,
  trùng lớp đang học) và **ghi rõ lý do** môn nào bị loại.
- Quay lui, **môn ít lớp xét trước** để cắt nhánh sớm; dùng lại `sectionsClash` của US-06.
- Dừng ở 2 000 phương án hợp lệ (`truncated = true`) để mọi yêu cầu chạy trong vài mili giây.
- Điểm phạt: ngày muốn nghỉ 40/ngày; buổi sáng hoặc chiều 10/buổi (khi chọn tránh); số ngày học 10/ngày
  (khi chọn dồn lịch); tiết trống 2/tiết. Hòa điểm thì xếp theo mã lớp để kết quả ổn định.
- API **chỉ đọc, không giữ chỗ**; đăng ký phương án vẫn đi qua `POST /registrations` từng lớp.

## Hệ quả

- Tích cực:
  - Không bỏ sót phương án; cùng dữ liệu luôn cho cùng kết quả (test được).
  - Thuật toán là hàm thuần, không đụng CSDL: test đầy đủ mà không cần dựng gì.
  - Không đi vòng qua cơ chế khóa: giữ nguyên tính đúng của ADR-0003.
- Tiêu cực / phải chấp nhận:
  - Trường hợp xấu nhất tăng theo cấp số nhân; chấp nhận được nhờ giới hạn 8 môn và mốc 2 000 phương án.
  - Trọng số điểm phạt do nhóm chọn, chưa cho sinh viên tự chỉnh.
  - Phương án có thể mất hiệu lực nếu có người lấy chỗ trước khi sinh viên đăng ký; giao diện báo lỗi riêng
    từng lớp.

## Bằng chứng trong repo

- `backend/src/suggestions/schedule-suggester.ts` + `backend/tests/schedule-suggester.test.ts`.
- `tests/api/schedule-suggestions.spec.ts` (7 kịch bản trên dữ liệu mẫu).
