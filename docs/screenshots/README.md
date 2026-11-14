# Ảnh màn hình giao diện cập nhật ngày 14/11/2026

Bộ 14 ảnh phục vụ báo cáo cuối kỳ của Nguyễn Thiên Trí (M1).
Ảnh 04, 05, 09 chụp lại ngày 14/11/2026 trên main `58bdc57`, sau khi PR #62 và #63 đã merge.
11 ảnh còn lại giữ nguyên bản gốc ngày 08/11/2026 theo hướng dẫn của nhóm; không cắt ảnh thành các phần như bản Word.

- Dữ liệu: nạp lại `backend/db/migrations/001_init.sql`, `002_sessions.sql` và `backend/db/seeds/001_seed.sql` vào CSDL kiểm thử riêng; backend thật, không mock phản hồi.
- Trình duyệt rộng 1280 px, zoom 100%, chụp toàn trang. Ảnh cũ dùng Edge, 3 ảnh mới dùng Chrome; cùng viewport 1280 × 800.
- Mỗi ảnh dưới 500 KB, giữ nguyên độ phân giải để chữ rõ.
- Thứ tự chụp lại: std_402 xem trước CS201-01 → đăng ký CS201-02 để có 7/24 tín chỉ → vào hàng chờ EN101-01 ở vị trí 4 → std_500 xem trước CS201-02.
- 04 hiển thị “Trùng lịch với lớp bạn đã đăng ký.” và mã lớp MA101-01; 05 hiển thị “Bạn chưa đạt môn tiên quyết.” và mã, tên CS101; 09 hiển thị “Lớp đã đủ sĩ số.” cùng xác nhận vào hàng chờ. Không hiện ID nội bộ trong các thông báo này.

| Ảnh | Màn hình | Tài khoản |
|---|---|---|
| [01-dang-nhap.png](01-dang-nhap.png) | Đăng nhập | — |
| [02-danh-muc.png](02-danh-muc.png) | Danh mục môn học | std_402 |
| [03-chi-tiet-mon.png](03-chi-tiet-mon.png) | Chi tiết CS201 và trạng thái tiên quyết | std_402 |
| [04-trung-lich.png](04-trung-lich.png) | Xem trước CS201-01 bị trùng lịch | std_402 |
| [05-thieu-tien-quyet.png](05-thieu-tien-quyet.png) | Thiếu môn tiên quyết CS101 | std_500 |
| [06-dang-ky-thanh-cong.png](06-dang-ky-thanh-cong.png) | Đăng ký CS201-02 thành công | std_402 |
| [07-thoi-khoa-bieu.png](07-thoi-khoa-bieu.png) | Thời khóa biểu tuần | std_402 |
| [08-mon-da-dang-ky.png](08-mon-da-dang-ky.png) | Môn đã đăng ký và hàng chờ | std_402 |
| [09-hang-cho.png](09-hang-cho.png) | Vào hàng chờ EN101-01 khi lớp đầy | std_402 |
| [10-ket-qua-hoc-tap.png](10-ket-qua-hoc-tap.png) | Kết quả học tập | std_402 |
| [11-admin-mon-hoc.png](11-admin-mon-hoc.png) | Quản lý môn học | admin1 |
| [12-admin-lop-hoc-phan.png](12-admin-lop-hoc-phan.png) | Quản lý lớp học phần EN101 | admin1 |
| [13-admin-danh-sach-lop.png](13-admin-danh-sach-lop.png) | Danh sách lớp và hàng chờ EN101-01 | admin1 |
| [14-admin-vong-lap.png](14-admin-vong-lap.png) | Từ chối vòng lặp môn tiên quyết | admin1 |
