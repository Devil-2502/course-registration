# Danh sách màn hình - Topic 6

- Người phụ trách: Nguyễn Thiên Trí (M1 - Frontend / UI-UX)
- Người review chính: Bùi Quốc Trung (M4); dự phòng: Lê Trung Bảo (M2)
- Trạng thái: đề xuất theo hướng dẫn M1 phần tiếp; chờ nhóm review. Các màn hình nằm trực tiếp trong `frontend/src/`, tiếp tục cấu trúc đã merge ở PR #25.

Tài liệu liệt kê các màn hình, thành phần dùng chung và luồng điều hướng.
Wireframe của từng màn hình lưu trong `docs/wireframes/` (file nguồn và ảnh xuất ra, xem `docs/wireframes/README.md`).

## 1. Màn hình

### 1.1 Dùng chung

| Mã | Màn hình | Vai trò | Mục đích | User story |
|---|---|---|---|---|
| UI-01 | Đăng nhập | Tất cả | Nhập email và mật khẩu, báo lỗi khi sai | US-01 |

### 1.2 Sinh viên

| Mã | Màn hình | Mục đích | User story |
|---|---|---|---|
| UI-02 | Trang chủ sinh viên | Học kỳ hiện tại, thời gian đăng ký, số tín chỉ đã đăng ký so với giới hạn, lối tắt tới các trang chính | US-07, US-11 |
| UI-03 | Tìm kiếm môn học | Ô tìm theo mã hoặc tên, danh sách kết quả có phân trang | US-02 |
| UI-04 | Chi tiết môn học | Thông tin môn, danh sách môn tiên quyết kèm trạng thái đã đạt hay chưa, các lớp học phần với lịch và số chỗ còn lại, nút đăng ký hoặc vào hàng chờ | US-03, US-04, US-09 |
| UI-05 | Cổng đăng ký | Gộp vào UI-04 (quyết định 2, mục 8): đăng ký từng lớp ngay trên thẻ lớp, khóa nút khi trùng lịch, hiển thị lý do bị từ chối theo mã lỗi | US-04, US-05, US-06, US-07 |
| UI-06 | Thời khóa biểu tuần | Lưới thứ và tiết, mỗi lớp là một khối; xem trước một lớp và tô đỏ ô bị trùng | US-06, US-11 |
| UI-07 | Môn đã đăng ký | Danh sách lớp đã đăng ký, nút hủy môn, danh sách hàng chờ kèm vị trí, nút rời hàng chờ | US-09, US-10 |
| UI-08 | Kết quả học tập | Các môn đã học và kết quả, để sinh viên tự đối chiếu môn tiên quyết | US-05 |

### 1.3 Quản trị

| Mã | Màn hình | Mục đích | User story |
|---|---|---|---|
| UI-09 | Quản lý môn học | Danh sách, thêm và sửa môn | US-12 |
| UI-10 | Quản lý môn tiên quyết | Xem và thêm, gỡ môn tiên quyết của một môn; báo lỗi khi tạo vòng lặp | US-13 |
| UI-11 | Quản lý lớp học phần | Thêm và sửa lớp, sức chứa, các buổi học | US-12 |
| UI-12 | Danh sách lớp | Sinh viên đã đăng ký và hàng chờ của một lớp | US-12 |

Tổng cộng 12 màn hình. Ưu tiên làm trước: UI-01, UI-03, UI-04, UI-06, UI-07.

## 2. Thành phần dùng chung

| Thành phần | Dùng ở | Ghi chú |
|---|---|---|
| Thanh điều hướng | Mọi màn hình sau đăng nhập | Mục hiển thị theo vai trò, có nút đăng xuất |
| Thẻ lớp học phần | UI-04, UI-05, UI-07 | Mã lớp, giảng viên, lịch học, số chỗ còn lại, số người chờ |
| Lưới thời khóa biểu | UI-06, phần xem trước ở UI-04 | 7 cột theo thứ, hàng theo tiết |
| Thanh tín chỉ | UI-02, UI-05, UI-06 | Số tín chỉ hiện tại trên giới hạn |
| Nhãn trạng thái | UI-04, UI-07 | Đã đăng ký, Đang chờ, Đã đạt, Chưa đạt, Hết chỗ |
| Hộp xác nhận | UI-07 | Hỏi lại trước khi hủy môn |
| Thông báo lỗi nghiệp vụ | UI-04, UI-05 | Nội dung theo mã lỗi của API |

## 3. Trạng thái mỗi màn hình phải xử lý

- Đang tải dữ liệu.
- Không có dữ liệu (không tìm thấy môn, chưa đăng ký lớp nào).
- Lỗi kết nối, kèm nút thử lại.
- Phiên hết hạn (API trả 401): chuyển về UI-01.
- Không có quyền (API trả 403).
- Đang gửi yêu cầu: khóa nút đăng ký để tránh bấm hai lần.

## 4. Hiển thị lỗi khi đăng ký

Giao diện không tự kiểm tra quy tắc. Nó gọi API và hiển thị theo mã lỗi trả về.

| Mã lỗi | Nội dung hiển thị |
|---|---|
| `PREREQUISITE_NOT_MET` | "Bạn chưa đạt môn tiên quyết: ..." kèm danh sách môn còn thiếu |
| `SCHEDULE_CLASH` | "Trùng lịch với lớp ..." và tô đỏ ô bị trùng trên thời khóa biểu |
| `CREDIT_LIMIT_EXCEEDED` | "Vượt giới hạn tín chỉ: đang có ..., giới hạn ..." |
| `SECTION_FULL` | "Lớp đã đủ sĩ số" kèm nút "Vào hàng chờ" |
| `ALREADY_ENROLLED` | "Bạn đã đăng ký một lớp của môn này" |
| `REGISTRATION_CLOSED` | "Hiện không trong thời gian đăng ký" |

## 5. Luồng điều hướng

Sinh viên:

```
UI-01 Đăng nhập
  -> UI-02 Trang chủ
       -> UI-03 Tìm kiếm môn -> UI-04 Chi tiết môn (đăng ký, vào hàng chờ, xem trước lịch) -> UI-07 Môn đã đăng ký
       -> UI-06 Thời khóa biểu tuần
       -> UI-07 Môn đã đăng ký
       -> UI-08 Kết quả học tập
```

Quản trị:

```
UI-01 Đăng nhập
  -> UI-09 Quản lý môn học -> UI-10 Quản lý môn tiên quyết (nút "Tiên quyết")
                          -> UI-11 Quản lý lớp học phần (nút "Lớp học phần") -> UI-12 Danh sách lớp
```

## 6. API mỗi màn hình cần

| Màn hình | Endpoint |
|---|---|
| UI-01 | `POST /auth/login` |
| UI-02 | `GET /auth/me`, `GET /semesters/current`, `GET /students/me/schedule` |
| UI-03 | `GET /courses?q=&page=&pageSize=` |
| UI-04 | `GET /courses/{courseId}`, `GET /students/me/schedule`, `POST /registrations`, `POST /waitlist` |
| UI-05 | Gộp vào UI-04 |
| UI-06 | `GET /students/me/schedule` |
| UI-07 | `GET /registrations`, `DELETE /registrations/{registrationId}`, `GET /waitlist`, `DELETE /waitlist/{entryId}` |
| UI-08 | `GET /students/me/completed-courses` |
| UI-09 | `GET /courses?pageSize=100`, `POST /courses`, `PUT /courses/{courseId}` |
| UI-10 | `GET /courses/{courseId}/prerequisites`, `POST` và `DELETE` cùng đường dẫn, `GET /courses` (danh sách để chọn) |
| UI-11 | `GET /courses/{courseId}` (các lớp của môn), `GET /semesters/current`, `POST /sections`, `PUT /sections/{sectionId}` |
| UI-12 | `GET /sections/{sectionId}/enrolments`, `GET /sections/{sectionId}/waitlist` |

Giao diện gọi API qua `frontend/src/api.ts`. Frontend không có chế độ dữ liệu giả; kiểm thử mô phỏng phản hồi fetch.

## 7. Wireframe

Đã vẽ đủ 12 màn hình, lưu trong `docs/wireframes/`. Bốn màn hình vẽ trước (tuần 1): UI-01, UI-03, UI-04, UI-06.
UI-06 có thêm bản cho điện thoại.

## 8. Các đề xuất thiết kế chờ nhóm xác nhận

Các điểm dưới đây lấy từ hướng dẫn M1 và code mẫu, chưa phải biên bản thống nhất của nhóm. Reviewer xác nhận hoặc yêu cầu điều chỉnh trước khi merge F1.

1. Trên điện thoại, thời khóa biểu giữ dạng lưới và cuộn ngang (bảng rộng tối thiểu 760px), giống bản máy tính.
2. Không làm cổng đăng ký nhiều lớp. Sinh viên đăng ký từng lớp ngay tại UI-04, nên không cần API xử lý nhiều lớp một lần.
3. Thứ hiển thị từ Thứ Hai đến Chủ nhật (`dayOfWeek` 1 đến 7), tiết từ 1 đến 15 (`frontend/src/utils/timetable.ts`).
4. Số chỗ còn lại cập nhật khi mở trang và sau mỗi thao tác đăng ký, vào hàng chờ, hủy; không tự cập nhật theo thời gian thực.
5. Quản trị dùng chung bố cục với sinh viên; thanh điều hướng đổi mục theo vai trò.
6. Câu chữ ghi nguyên văn trong Gherkin giữ đúng tiếng Anh: "No courses found" (US-02), "Passed" (US-03), "Schedule clash with ..." (US-11). Phần còn lại của giao diện dùng tiếng Việt.
