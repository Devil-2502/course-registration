# Wireframe - Topic 6

- Người phụ trách: Nguyễn Thiên Trí (M1)
- Công cụ: draw.io (nguồn XML có thể chỉnh sửa); PNG xuất từ cùng bố cục bằng Pillow.
- File nguồn: [wireframes.drawio](wireframes.drawio), gồm 13 trang cho UI-01 đến UI-12 và UI-06 trên điện thoại.
- Trạng thái: đề xuất F1 chờ review; đối chiếu `Huong-dan-M1-Nguyen-Thien-Tri.docx` và `Code-mau-M1-Tri.zip` do nhóm cung cấp.

Mỗi màn hình một ảnh PNG, đặt tên theo mã trong `docs/ui-screen-list.md`.

| Mã | Màn hình | Ảnh |
|---|---|---|
| UI-01 | Đăng nhập | `UI-01-login.png` |
| UI-02 | Trang chủ sinh viên | `UI-02-student-home.png` |
| UI-03 | Tìm kiếm môn học | `UI-03-course-search.png` |
| UI-04 | Chi tiết môn học | `UI-04-course-detail.png` |
| UI-05 | Cổng đăng ký (gộp vào UI-04; ảnh mô tả luồng thao tác) | `UI-05-registration.png` |
| UI-06 | Thời khóa biểu tuần | `UI-06-weekly-schedule.png`, `UI-06-weekly-schedule-mobile.png` |
| UI-07 | Môn đã đăng ký | `UI-07-my-registrations.png` |
| UI-08 | Kết quả học tập | `UI-08-completed-courses.png` |
| UI-09 | Quản lý môn học | `UI-09-admin-courses.png` |
| UI-10 | Quản lý môn tiên quyết | `UI-10-admin-prerequisites.png` |
| UI-11 | Quản lý lớp học phần | `UI-11-admin-sections.png` |
| UI-12 | Danh sách lớp | `UI-12-section-roster.png` |

## Ghi chú thiết kế

- Màu chính `#1f5fbf`, màu lỗi `#c0392b`, màu thành công `#2e7d32` (khai báo trong `frontend/src/index.css`).
- Lỗi nghiệp vụ hiện trong hộp màu đỏ, nội dung theo mã lỗi (bảng mục 4 của `docs/ui-screen-list.md`).
- Nút đăng ký bị khóa khi đang gửi yêu cầu (tránh bấm hai lần) và khi lớp trùng lịch.
