# ADR-0003: Chống bán lố chỗ bằng khóa dòng `SELECT ... FOR UPDATE`

- Trạng thái: Đã chấp nhận; được xác nhận bằng thí nghiệm (cải tiến 3, #66)
- Liên quan: BR-05, US-08, US-10, `docs/improvements/06-lock-comparison.md`

## Bối cảnh

Một lần đăng ký đọc nhiều thứ (sĩ số, kết quả học, tiên quyết, lịch học, tín chỉ) rồi mới ghi. Nếu hai
giao dịch cùng đọc "còn 1 chỗ" trước khi ai kịp ghi, cả hai sẽ cùng vào lớp. Đây là lỗi *lost update /
write skew* kinh điển và là rủi ro lớn nhất của đề tài.

## Các lựa chọn đã cân nhắc

1. **Không khóa**, chỉ dựa vào ràng buộc `CHECK` của CSDL: dữ liệu không sai nhưng người thua nhận lỗi
   500 khó hiểu thay vì `409 SECTION_FULL`.
2. **Mức cô lập `SERIALIZABLE`**: PostgreSQL tự phát hiện xung đột và hủy giao dịch; ứng dụng phải bọc
   mọi giao dịch trong vòng thử lại.
3. **Khóa lạc quan** (cột `version`, cập nhật kèm `WHERE version = …`): cũng phải thử lại, và phải thêm
   cột cho mọi bảng liên quan.
4. **Khóa dòng bi quan `SELECT ... FOR UPDATE`** trên dòng của lớp.

## Quyết định

Chọn **phương án 4**. Mỗi đăng ký chạy trong một giao dịch `READ COMMITTED`:

1. Khóa dòng của **lớp** (`SELECT id FROM sections WHERE id = $1 FOR UPDATE`).
2. Khóa dòng của **sinh viên** (chặn hai yêu cầu của cùng một người vào hai lớp khác nhau cùng lúc,
   ví dụ vượt tín chỉ).
3. Đọc lại toàn bộ dữ kiện, kiểm tra luật theo thứ tự, rồi ghi.

**Thứ tự khóa luôn là lớp trước, sinh viên sau**, ở đăng ký, hủy, đôn hàng chờ và đổi lớp. Khi cần khóa
nhiều lớp (đổi lớp) thì khóa theo **id tăng dần**. Nhờ vậy không có hai giao dịch chờ nhau theo vòng tròn,
nên không có deadlock.

## Hệ quả

- Tích cực:
  - Đúng tuyệt đối mà không cần logic thử lại.
  - Khóa chỉ đặt trên **một dòng đang bị tranh**; các lớp khác nhau không chặn nhau.
  - Dễ giải thích và dễ review: chỉ cần kiểm tra mỗi giao dịch có khóa đúng thứ tự không.
- Tiêu cực / phải chấp nhận:
  - Các yêu cầu cùng một lớp phải **xếp hàng**; lớp "nóng" sẽ chậm hơn một chút khi rất đông.
  - Phải giữ kỷ luật thứ tự khóa ở mọi chỗ ghi mới (đã có test tranh chấp để phát hiện).

## Bằng chứng trong repo

Thí nghiệm `tests/load/lock-compare.mjs` (100 yêu cầu đồng thời, 5 lần mỗi kịch bản, PostgreSQL 16):

| | Không khóa | **FOR UPDATE** | SERIALIZABLE |
|---|---|---|---|
| Giành chỗ cuối (10 kết nối) | Sai 5/5, vượt 9 người | **Đúng 5/5**, 0 lần thử lại | Đúng 5/5, 9 lần thử lại |
| Ít tranh chấp (20 kết nối) | Đúng | **Đúng, 0 lần thử lại** | 298,8 lần thử lại, **17 sinh viên bị từ chối dù lớp còn chỗ** |
| Thời gian TB khi ít tranh chấp (10 kết nối) | 28 ms | **25 ms** | 71 ms |

Stress test qua API thật (#63): giành chỗ cuối với 100 người, 12/12 lần đúng, trung bình 234 ms, p95 344 ms.

Code: `lockSection`, `lockStudent` trong `backend/src/registration/enrolment.repository.ts`.
