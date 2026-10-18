# Frontend — phần việc Nguyễn Thiên Trí (M1)

React + Vite + TypeScript, giao tiếp REST theo `../docs/openapi-spec.yaml`.

## Phạm vi

- US-02 / Issue #9: tìm môn theo mã hoặc tên, phân trang 20 môn, trạng thái không tìm thấy.
- US-03 / Issue #10: chi tiết môn, trạng thái tiên quyết do API trả về, lớp học phần, lịch và số chỗ.
- US-11 / Issue #18: thời khóa biểu 7 ngày, tiết 1–15, tổng tín chỉ và giới hạn do API trả về; xem trước lớp, tô ô trùng khi API báo `SCHEDULE_CLASH`.
- Luồng hỗ trợ: đăng nhập bằng cookie, đăng xuất, quay về đăng nhập khi gặp 401; kiểm tra và xác nhận đăng ký từng lớp. Nút đăng ký bị khóa khi chưa có kết quả hợp lệ hoặc đang gửi yêu cầu.

Không triển khai nghiệp vụ kiểm tra tại frontend. Không triển khai màn hình quản trị, kết quả học tập, hủy môn, quản lý hàng chờ hay đăng ký nhiều lớp trong một yêu cầu.

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

Backend hiện tại mới có `/api/v1/health`; cần M2/M3 triển khai các endpoint theo hợp đồng trước khi dùng dữ liệu thật:

- `GET /auth/me`, `POST /auth/login`, `POST /auth/logout`.
- `GET /courses?q=...&page=...&pageSize=20`, `GET /courses/{courseId}`.
- `GET /students/me/schedule`, có hỗ trợ `semesterId` khi xem trước lớp.
- `POST /registrations/validate`, `POST /registrations`, body `{ "sectionId": <number> }`.

Không có dữ liệu giả hoặc đăng nhập giả trong mã ứng dụng. Kiểm thử trong `tests/` mô phỏng phản hồi API theo hợp đồng, bao gồm lỗi 401/403/404, lỗi kết nối và lỗi cấp chỗ sau khi xem trước hợp lệ. Chúng kiểm tra giao diện và yêu cầu HTTP, không chứng minh backend đã triển khai hoặc hệ thống đã tích hợp hoàn chỉnh. Ngưỡng coverage đặt ở 60% cho dòng, câu lệnh, hàm và nhánh.

Trên màn hình hẹp, bảng thời khóa biểu cuộn ngang để giữ đủ 7 ngày. Số chỗ được cập nhật bằng nút tải lại và sau đăng ký, không tự thăm dò liên tục.

Kết quả kiểm tra trên Node.js 24.21.0: build thành công, lint không cảnh báo; 17/17 kiểm thử qua. Báo cáo Vitest: lines 95.90%, statements 92.77%, functions 91.93%, branches 87.87%. Chưa kiểm thử chạy ảnh Docker và chưa kiểm thử tích hợp với API thật.
