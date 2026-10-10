# Bản nháp endpoint API - Topic 6

- Người phụ trách: Lê Trung Bảo (M2 - Backend API)
- Người review: Tăng Hoàng Phúc (M3), Nguyễn Thiên Trí (M1)
- Trạng thái: bản nháp khởi đầu, người phụ trách cần rà soát, chỉnh sửa rồi mới đưa cả nhóm review
- Đối chiếu với: `docs/openapi-spec.yaml` phiên bản 0.2.0

Tài liệu này giải thích các endpoint bằng lời để cả nhóm dễ đọc và góp ý.
Bản chính thức mà frontend và backend phải tuân theo là `docs/openapi-spec.yaml`.
Khi hai file khác nhau thì sửa cả hai trong cùng một Pull Request.

Địa chỉ gốc: `http://localhost:3000/api/v1`

## 1. Tài nguyên chính

| Tài nguyên | Ý nghĩa |
|---|---|
| User | Tài khoản đăng nhập, có vai trò `STUDENT` hoặc `ADMIN` |
| Semester | Học kỳ, kèm thời gian mở đăng ký và giới hạn tín chỉ |
| Course | Môn học: mã, tên, số tín chỉ |
| Prerequisite | Quan hệ "môn A phải đạt trước khi học môn B" |
| Section | Lớp học phần của một môn trong một học kỳ, có sức chứa và lịch học |
| Registration | Một lần sinh viên đăng ký vào một lớp học phần |
| WaitlistEntry | Một vị trí trong hàng chờ của lớp đã đầy |
| CompletedCourse | Kết quả các môn sinh viên đã học, dùng để kiểm tra tiên quyết |

## 2. Danh sách endpoint

### 2.1 Hệ thống và đăng nhập (M3)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/health` | Kiểm tra dịch vụ còn chạy | Công khai |
| POST | `/auth/login` | Đăng nhập, tạo phiên | Công khai |
| POST | `/auth/logout` | Đăng xuất | Đã đăng nhập |
| GET | `/auth/me` | Thông tin người đang đăng nhập | Đã đăng nhập |

### 2.2 Học kỳ (M3)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/semesters` | Danh sách học kỳ | Đã đăng nhập |
| GET | `/semesters/current` | Học kỳ đang mở đăng ký | Đã đăng nhập |

### 2.3 Môn học (M2)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/courses?q=&page=&pageSize=` | Tìm kiếm danh mục môn | Đã đăng nhập |
| GET | `/courses/{courseId}` | Chi tiết môn, môn tiên quyết, các lớp đang mở | Đã đăng nhập |
| POST | `/courses` | Tạo môn | Admin |
| PUT | `/courses/{courseId}` | Sửa môn | Admin |

### 2.4 Môn tiên quyết (M2)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/courses/{courseId}/prerequisites` | Các môn tiên quyết trực tiếp | Đã đăng nhập |
| POST | `/courses/{courseId}/prerequisites` | Thêm một môn tiên quyết | Admin |
| DELETE | `/courses/{courseId}/prerequisites/{prerequisiteId}` | Gỡ một môn tiên quyết | Admin |

Thêm quan hệ phải kiểm tra vòng lặp: nếu từ môn tiên quyết mới đi theo các cạnh tiên quyết mà quay về được môn đang xét thì từ chối với `PREREQUISITE_CYCLE`.

### 2.5 Lớp học phần (M2, M3)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/sections?semesterId=&courseId=` | Danh sách lớp học phần | Đã đăng nhập |
| GET | `/sections/{sectionId}` | Chi tiết lớp, lịch học, số chỗ còn lại | Đã đăng nhập |
| POST | `/sections` | Tạo lớp kèm lịch học | Admin |
| PUT | `/sections/{sectionId}` | Sửa lớp | Admin |
| GET | `/sections/{sectionId}/enrolments` | Danh sách sinh viên của lớp | Admin |
| GET | `/sections/{sectionId}/waitlist` | Hàng chờ của lớp theo thứ tự | Admin |

### 2.6 Đăng ký môn (M2)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/registrations?semesterId=` | Các lớp tôi đã đăng ký | Student |
| POST | `/registrations` | Đăng ký một lớp học phần | Student |
| POST | `/registrations/validate` | Kiểm tra thử, không lưu, trả về mọi vi phạm | Student |
| DELETE | `/registrations/{registrationId}` | Hủy môn, tự đẩy hàng chờ | Student (chủ sở hữu) |

### 2.7 Hàng chờ (M2)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/waitlist?semesterId=` | Các hàng chờ tôi đang tham gia | Student |
| POST | `/waitlist` | Vào hàng chờ của lớp đã đầy | Student |
| DELETE | `/waitlist/{entryId}` | Rời hàng chờ | Student (chủ sở hữu) |

### 2.8 Dữ liệu của sinh viên (M2)

| Phương thức | Đường dẫn | Mô tả | Quyền |
|---|---|---|---|
| GET | `/students/me/schedule?semesterId=` | Thời khóa biểu tuần và tổng tín chỉ | Student |
| GET | `/students/me/completed-courses` | Các môn đã học kèm kết quả | Student |

Tổng cộng 28 thao tác trên 21 đường dẫn.

## 3. Luồng xử lý `POST /registrations`

Các bước kiểm tra chạy theo đúng thứ tự dưới đây. Bước nào sai thì dừng và trả lỗi của bước đó.

| Bước | Kiểm tra | Mã HTTP | Mã lỗi |
|---|---|---|---|
| 1 | Có phiên đăng nhập hợp lệ | 401 | `UNAUTHENTICATED` |
| 2 | Người dùng là sinh viên | 403 | `FORBIDDEN` |
| 3 | Lớp học phần tồn tại | 404 | `NOT_FOUND` |
| 4 | Học kỳ đang trong thời gian đăng ký | 403 | `REGISTRATION_CLOSED` |
| 5 | Chưa đăng ký lớp nào của môn này trong học kỳ | 409 | `ALREADY_ENROLLED` |
| 6 | Chưa đạt môn này từ trước | 422 | `COURSE_ALREADY_PASSED` |
| 7 | Đã đạt mọi môn tiên quyết | 422 | `PREREQUISITE_NOT_MET` |
| 8 | Không trùng lịch với lớp đã đăng ký | 409 | `SCHEDULE_CLASH` |
| 9 | Tổng tín chỉ không vượt giới hạn | 422 | `CREDIT_LIMIT_EXCEEDED` |
| 10 | Lớp còn chỗ (trong transaction, có khóa) | 409 | `SECTION_FULL` |

Quy ước phân biệt hai mã: **409** khi yêu cầu xung đột với trạng thái hiện tại và có thể hết xung đột nếu trạng thái đổi
(lớp có người hủy, sinh viên hủy lớp bị trùng); **422** khi sinh viên chưa đủ điều kiện theo quy định.

Bước 10 phải nằm trong một transaction: khóa dòng của lớp học phần (`SELECT ... FOR UPDATE`), đọc lại số chỗ,
thêm bản ghi đăng ký, tăng số đã đăng ký, rồi mới commit. Các bước 5, 8 và 9 cũng phải chạy lại bên trong transaction này,
vì cùng một sinh viên có thể gửi hai yêu cầu cùng lúc.

## 4. Luồng xử lý `DELETE /registrations/{registrationId}`

Trong một transaction:

1. Khóa dòng của lớp học phần.
2. Chuyển bản ghi đăng ký sang `DROPPED`, giảm số đã đăng ký.
3. Lấy người đang `WAITING` có thời điểm vào hàng sớm nhất.
4. Chạy lại kiểm tra tiên quyết, trùng lịch và tín chỉ cho người đó.
5. Nếu đạt: tạo bản ghi đăng ký `ENROLLED`, chuyển vị trí hàng chờ sang `PROMOTED`, tăng số đã đăng ký, kết thúc.
6. Nếu không đạt: chuyển sang `SKIPPED`, quay lại bước 3.
7. Hết hàng chờ thì chỗ để trống.

## 5. Định dạng lỗi

Mọi lỗi trả về cùng một cấu trúc:

```json
{
  "code": "PREREQUISITE_NOT_MET",
  "message": "You have not passed all prerequisites of CS201.",
  "details": {
    "missingCourses": [{ "id": 1, "code": "CS101", "name": "Introduction to Programming" }]
  }
}
```

Nội dung `details` theo từng mã lỗi:

| Mã lỗi | `details` |
|---|---|
| `VALIDATION_ERROR` | `fields`: danh sách trường sai và lý do |
| `PREREQUISITE_NOT_MET` | `missingCourses`: các môn tiên quyết chưa đạt |
| `SCHEDULE_CLASH` | `conflictsWith`: lớp bị trùng và buổi học bị trùng |
| `CREDIT_LIMIT_EXCEEDED` | `currentCredits`, `requestedCredits`, `limit` |
| `SECTION_FULL` | `waitlistCount`: số người đang chờ |
| `PREREQUISITE_CYCLE` | `path`: chuỗi mã môn tạo thành vòng lặp |

## 6. Ma trận quyền

| Nhóm chức năng | Khách | Student | Admin |
|---|---|---|---|
| Đăng nhập, kiểm tra dịch vụ | Có | Có | Có |
| Xem danh mục môn, lớp, học kỳ | Không | Có | Có |
| Đăng ký, hủy môn, hàng chờ của chính mình | Không | Có | Không |
| Xem thời khóa biểu, kết quả học của chính mình | Không | Có | Không |
| Tạo, sửa môn và lớp học phần | Không | Không | Có |
| Thêm, gỡ môn tiên quyết | Không | Không | Có |
| Xem danh sách sinh viên và hàng chờ của lớp | Không | Không | Có |

Sinh viên không bao giờ truyền `studentId` trong yêu cầu. Backend luôn lấy sinh viên từ phiên đăng nhập,
nên không thể đăng ký hay hủy môn thay người khác.

## 7. Các điểm cần thống nhất

1. **Cách xác thực.** Bản nháp dùng phiên lưu ở server và cookie `sid`, theo phần việc "user session management" của M3. Nếu M3 chọn JWT thì đổi `securitySchemes` trong OpenAPI.
2. **Kiểu định danh.** Bản nháp dùng số nguyên tự tăng. Nếu M3 muốn dùng UUID thì đổi đồng loạt trong OpenAPI.
3. **Tiên quyết gián tiếp.** Bản nháp chỉ kiểm tra môn tiên quyết trực tiếp, vì muốn đạt môn trực tiếp thì đã phải đạt các môn phía trước. Dữ liệu cũ nhập tay có thể vi phạm giả định này.
4. **`/registrations/validate`.** Endpoint này trả về mọi vi phạm cùng lúc, còn `POST /registrations` chỉ trả vi phạm đầu tiên. Cần M1 xác nhận giao diện có dùng cả hai kiểu không.
5. **Vào hàng chờ.** Bản nháp kiểm tra tiên quyết ngay khi vào hàng chờ, còn trùng lịch và tín chỉ thì kiểm tra lúc được đẩy lên. Cần chốt có kiểm tra cả ba ngay từ đầu không.
6. **Giảm sức chứa.** Bản nháp chặn việc giảm sức chứa xuống dưới số đã đăng ký. Cần chốt admin có được tăng sức chứa khi lớp đang có hàng chờ không, và khi đó có tự đẩy hàng chờ không.
7. **Dữ liệu kết quả học.** Đề tài không có chức năng nhập điểm. Bản nháp coi bảng kết quả học là dữ liệu mẫu do M3 nạp sẵn.
8. **Thông báo.** Khi được đẩy từ hàng chờ vào lớp, sinh viên biết bằng cách nào: chỉ hiện trong trang "Môn đã đăng ký", hay có thêm thông báo trong ứng dụng.
