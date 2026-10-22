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

Giao diện hiện tại cần M2/M3 cung cấp các endpoint theo hợp đồng trước khi dùng dữ liệu thật:

- `GET /auth/me`, `POST /auth/login`, `POST /auth/logout`.
- `GET /courses?q=...&page=...&pageSize=20`, `GET /courses/{courseId}`.
- `GET /students/me/schedule`, có hỗ trợ `semesterId` khi xem trước lớp.
- `POST /registrations/validate`, `POST /registrations`, body `{ "sectionId": <number> }`.

Kiểm thử trong `tests/` mô phỏng phản hồi API theo hợp đồng, bao gồm lỗi 401/403/404, lỗi kết nối và lỗi cấp chỗ sau khi xem trước hợp lệ. Chúng kiểm tra giao diện và yêu cầu HTTP, không chứng minh hệ thống đã tích hợp hoàn chỉnh. Ngưỡng coverage đặt ở 60% cho dòng, câu lệnh, hàm và nhánh.

Trên màn hình hẹp, bảng thời khóa biểu cuộn ngang để giữ đủ 7 ngày. Số chỗ được cập nhật bằng nút tải lại và sau đăng ký, không tự thăm dò liên tục.

## F2 — lớp API và dữ liệu giả (Task #35)

Theo hướng dẫn M1 và `Code-mau-M1-Tri.zip`, F2 bổ sung:

- `src/api/types.ts`: kiểu dữ liệu theo OpenAPI; `client.ts`: fetch dùng cookie, lỗi HTTP, lỗi mạng và phản hồi 204.
- `src/api/api.ts`: hàm endpoint cho đăng nhập, danh mục, đăng ký, hàng chờ, học tập và quản trị.
- `src/mocks/`: bộ dữ liệu và API giả để phát triển giao diện độc lập với backend. Chỉ mô phỏng các quy tắc chính, không thay kiểm thử nghiệp vụ backend, giao dịch đồng thời hay tự động đẩy hàng chờ.
- `src/utils/`: dựng lưới thời khóa biểu, định vị xung đột để tô màu và thông báo lỗi tiếng Việt, kèm 14 unit test từ mẫu.

`api` chọn dữ liệu giả khi `VITE_USE_MOCK=true`, mặc định dùng API thật. Có thể đổi địa chỉ API thật bằng `VITE_API_URL`; mặc định `/api/v1` để tận dụng proxy Vite/Nginx hiện có. Ví dụ cấu hình trong `frontend/.env` (tự tạo, không commit):

```dotenv
VITE_USE_MOCK=true
# VITE_API_URL=http://localhost:3000/api/v1
```

Tài khoản giả: `std_402@student.edu.vn` và `admin1@tdtu.edu.vn`, mật khẩu chung `Password@123`; chỉ phục vụ demo, không phải thông tin đăng nhập thật. Trạng thái giả nằm trong bộ nhớ, tải lại trang sẽ khởi tạo lại dữ liệu.

**F2 chưa chuyển App.tsx sang lớp API mới.** Giao diện đã merge vẫn dùng `src/api.ts`; cấu hình mock ở trên phục vụ lớp mới và các trang F3–F8 khi được tích hợp sau. Giữ hai lớp song song ở bước này để tránh thay luồng đang có trước khi review F2. Không sao chép toàn bộ mã mẫu vào một nhánh.

Nguồn tham khảo: tài liệu `Huong-dan-M1-Nguyen-Thien-Tri.docx` và gói `Code-mau-M1-Tri.zip` do nhóm cung cấp. Đã điều chỉnh client dùng proxy cùng nguồn và `SectionInput.lecturerName` theo kiểu chuỗi tùy chọn trong OpenAPI hiện tại.

Kết quả F2 sau rà soát với main `9d1ce17`: lint không cảnh báo, build thành công, 47/47 kiểm thử qua; coverage dòng 87,66%, câu lệnh 87,44%, hàm 82,75%, nhánh 78,81%. Chưa kiểm thử tích hợp toàn bộ với backend thật và chưa chạy ảnh Docker ở bước này.

Xem [tiến độ, phụ thuộc và kết quả rà soát M1](../docs/m1-progress.md) trước khi tiếp tục F3–F8. PR F2 vẫn chờ review/merge; không đánh dấu toàn bộ phần việc M1 là hoàn thành.
