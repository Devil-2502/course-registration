# Frontend — phần việc Nguyễn Thiên Trí (M1)

React + Vite + TypeScript, giao tiếp REST theo `../docs/openapi-spec.yaml`.

## Phạm vi

- US-02 / Issue #9: tìm môn theo mã hoặc tên, phân trang 20 môn, trạng thái không tìm thấy.
- US-03 / Issue #10: chi tiết môn, trạng thái tiên quyết do API trả về, lớp học phần, lịch và số chỗ.
- US-11 / Issue #18: thời khóa biểu 7 ngày, tiết 1–15, tổng tín chỉ và giới hạn do API trả về; xem trước lớp, tô ô trùng khi API báo `SCHEDULE_CLASH`.
- Luồng hỗ trợ: đăng nhập bằng cookie, đăng xuất, quay về đăng nhập khi gặp 401; kiểm tra và xác nhận đăng ký từng lớp. Nút đăng ký bị khóa khi chưa có kết quả hợp lệ hoặc đang gửi yêu cầu.
- US-09 / Issue #16: vào hàng chờ khi API kiểm tra trả `SECTION_FULL`, hiển thị vị trí do máy chủ xác nhận; xem trạng thái và rời lượt đang `WAITING`.
- US-10 / Issue #17: xem lớp đang đăng ký, xác nhận hủy, gửi DELETE và tải lại dữ liệu sau thao tác. Đăng ký `DROPPED` không còn nút hủy.
- UI-08: xem môn đã học, điểm và trạng thái đạt theo `GET /students/me/completed-courses`.

Không triển khai nghiệp vụ kiểm tra tại frontend. Quyết định cấp chỗ, đủ điều kiện hoặc đẩy hàng chờ thuộc backend. Màn hình quản trị được dành cho PR2 sau khi PR1 được review và merge; không đăng ký nhiều lớp trong một yêu cầu.

Tiếp tục trên cấu trúc đã merge ở PR #25: các màn hình nằm trong `src/`, dùng chung `src/api.ts`, `useResource` và `ErrorNotice`. Điều hướng dùng state React; tải lại trang quay về danh mục. Không thêm lớp API thứ hai, router hoặc chế độ dữ liệu giả.

## Chạy và kiểm tra

Yêu cầu Node.js 22.22.2+ (nhánh 22) hoặc 24.15+ (nhánh 24). Tại thư mục `frontend`:

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run test:coverage
```

Vite phục vụ tại `http://localhost:5173` và chuyển tiếp `/api` đến backend `http://localhost:3000` để giữ cookie cùng nguồn. Ảnh Docker frontend dùng Nginx chuyển tiếp `/api` đến service `backend:3000` trong Docker Compose.

## Phụ thuộc tích hợp

Các màn hình cần backend triển khai các endpoint theo hợp đồng trước khi dùng dữ liệu thật:

- `GET /auth/me`, `POST /auth/login`, `POST /auth/logout`.
- `GET /courses?q=...&page=...&pageSize=20`, `GET /courses/{courseId}`.
- `GET /students/me/schedule`, có hỗ trợ `semesterId` khi xem trước lớp.
- `POST /registrations/validate`, `POST /registrations`, body `{ "sectionId": <number> }`.
- `GET /registrations`, `DELETE /registrations/{registrationId}`.
- `GET /waitlist`, `POST /waitlist`, `DELETE /waitlist/{entryId}`.
- `GET /students/me/completed-courses`.

Không có dữ liệu giả hoặc đăng nhập giả trong mã ứng dụng. Kiểm thử trong `tests/` mô phỏng phản hồi API theo hợp đồng, bao gồm lỗi 401/403/404, lỗi kết nối và lỗi cấp chỗ sau khi xem trước hợp lệ. Chúng kiểm tra giao diện và yêu cầu HTTP, không chứng minh backend đã triển khai hoặc hệ thống đã tích hợp hoàn chỉnh. Ngưỡng coverage đặt ở 60% cho dòng, câu lệnh, hàm và nhánh.

Trên màn hình hẹp, bảng thời khóa biểu cuộn ngang để giữ đủ 7 ngày. Số chỗ được cập nhật bằng nút tải lại và sau đăng ký, không tự thăm dò liên tục.

Kết quả PR1 trên Node.js 24.21.0: build thành công, lint không cảnh báo; 33/33 kiểm thử qua. Báo cáo Vitest: lines 95.37%, statements 92.40%, functions 92.04%, branches 86.45%. Chưa kiểm thử chạy ảnh Docker và chưa kiểm thử tích hợp các chức năng mới với backend thật.

Nguồn tham khảo cho PR1: `Huong-dan-M1-Nguyen-Thien-Tri-phan-tiep.docx` và `Code-mau-M1-Tri-phan-tiep.zip` do nhóm cung cấp, thay cho bản hướng dẫn F0–F8 cũ. Đã giữ và kiểm thử sửa header trực tiếp trong client đang chạy, trạng thái đăng ký/hàng chờ và chống gửi thao tác hủy lặp.
