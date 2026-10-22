# Tiến độ và phụ thuộc phần việc M1 Nguyễn Thiên Trí

Rà soát ngày 22/10/2026 trên `main` tại commit `9d1ce17` và nhánh F2 đã đồng bộ commit này. Đối chiếu hướng dẫn M1, code mẫu, README, OpenAPI, mã nguồn frontend/backend, cấu hình Docker, CI và các bộ kiểm thử hiện có.

## Trạng thái theo hướng dẫn

| Bước | Phạm vi | Trạng thái |
|---|---|---|
| F0 | Nhận user story #9, #10, #18; tạo Task riêng | Các story đã gán cho Trí; Task [#34](https://github.com/Devil-2502/course-registration/issues/34), [#35](https://github.com/Devil-2502/course-registration/issues/35) đã tạo và gán. Chưa thêm Task vào Project vì quyền GitHub hiện có thiếu quyền đọc Project. |
| F1 | Wireframe và danh sách màn hình | Đã push 13 PNG và nguồn draw.io; [PR #36](https://github.com/Devil-2502/course-registration/pull/36) chờ review/merge. Các lựa chọn thiết kế còn là đề xuất chờ nhóm xác nhận. |
| F2 | Lớp API, dữ liệu giả, tiện ích và unit test | Đã push; [PR #37](https://github.com/Devil-2502/course-registration/pull/37) chờ review/merge. Giữ nguyên App.tsx và luồng giao diện đã merge ở PR #25. |
| F3 | Định tuyến, đăng nhập, trang chủ và thành phần chung | Chờ F2 được review và merge; chưa tạo nhánh. |
| F4 | Tìm kiếm môn theo cấu trúc pages/ mới | Chờ F3 merge. Tận dụng hành vi và kiểm thử hiện có, không sao chép chồng hai luồng giao diện. |
| F5 | Chi tiết môn, đăng ký, hàng chờ và xem trước | Chờ F4 merge. Kết quả kiểm tra nghiệp vụ phải lấy từ API. |
| F6 | Thời khóa biểu tuần | Chờ F5 merge. Đối chiếu câu Gherkin US-11 trong repo mới nhất và dữ liệu API. |
| F7 | Môn đã đăng ký, hàng chờ, kết quả học tập | Chờ F6 merge. |
| F8 | Giao diện quản trị | Chờ F7 merge. |
| Tích hợp và minh chứng | API thật, ảnh demo, báo cáo/slide | Thực hiện sau khi các màn hình và API tương ứng sẵn sàng; chưa đánh dấu hoàn thành. |

Theo lựa chọn của người phụ trách, tiếp tục giữ quy trình PR trước được thành viên khác approve và merge rồi mới tạo nhánh PR sau. Không tự approve, merge hoặc đóng user story khi mới hoàn thành một phần frontend.

## Kết quả rà soát và điều chỉnh F2

- Nhánh F2 đã merge `origin/main` để nhận quy tắc hàng chờ mới của M2; không sửa mã triển khai backend của thành viên khác. Phần chênh lệch PR F2 với main vẫn thuộc frontend và tài liệu M1.
- F1 được kiểm tra khả năng merge với main bằng `git merge-tree`; không có xung đột tại commit nền nêu trên. F2 đã chứa main mới nhất tại lần rà soát này. Main thay đổi tiếp thì phải kiểm tra lại.
- Fetch client dùng `Headers` để giữ header truyền dưới dạng object, mảng cặp hoặc đối tượng Headers. Không tự ghi đè Content-Type đã chỉ định.
- Thông báo `SCHEDULE_CLASH` giữ nguyên mẫu `Schedule clash with ...` từ backend, đúng kịch bản US-11. Khi backend chỉ trả details, dùng mã lớp để tạo câu tương ứng.
- Giữ proxy Vite/Nginx cùng nguồn; mặc định API thật, dữ liệu giả chỉ dùng khi chủ động bật `VITE_USE_MOCK=true` ở lớp API mới. F2 chưa nối App.tsx với lớp mới.
- Không sửa hợp đồng OpenAPI, CI hoặc cơ sở dữ liệu để thay phần việc của M2/M3/M4. CI frontend hiện chạy lint/build; unit test frontend đã được chạy tại máy. Theo hướng dẫn, việc bổ sung test frontend vào CI là T8 của M4 sau F2.

## Các điểm phải điều chỉnh mẫu khi đến F3–F8

- F3: xử lý 401 sau khi đã đăng nhập, tách lỗi kết nối khỏi hết phiên; tránh kết quả kiểm tra phiên cũ ghi đè lần đăng nhập mới.
- Hook tải dữ liệu: khi đổi courseId hoặc từ khóa phải bỏ kết quả cũ, không hiển thị môn trước trong lúc tải môn sau.
- F5: dùng `POST /registrations/validate` cho quyết định khóa nút và lý do từ chối. Hàm giao nhau ở frontend chỉ định vị ô tô màu. Khóa thao tác đang gửi và tải lại số chỗ/lịch sau kết quả đăng ký.
- F7: hiển thị đúng trạng thái API của hàng chờ, không cố định mọi mục là WAITING; thông báo thất bại phải là lỗi. Khóa nút rời hàng chờ khi đang gửi và hỏi xác nhận hủy môn.
- F8: không chỉ dựa vào 100 môn đầu để quản lý toàn bộ danh mục. Giữ mã sinh viên/họ tên ở roster là dữ liệu tùy chọn cho tới khi hợp đồng API hỗ trợ, không tự đổi response của backend.

Những mục trên là tiêu chí cho các PR tiếp theo, chưa phải mã đã triển khai trong F2.

## Phụ thuộc tích hợp hiện tại

`backend/src/app.ts` hiện chỉ gắn route `/api/v1/health`; các hàm quy tắc đã có nhưng chưa được nối thành toàn bộ endpoint phục vụ giao diện. Migration trên main hiện vẫn là khung ban đầu. Vì vậy chưa thể xác nhận đăng nhập, danh mục, đăng ký hoặc quản trị chạy với dữ liệu thật chỉ bằng unit test.

Các API cần đối chiếu lần lượt: auth và phiên; học kỳ; danh mục/chi tiết môn; validate/đăng ký; hàng chờ/hủy; lịch/kết quả học tập; quản trị môn/lớp/tiên quyết/roster. Chế độ giả phục vụ phát triển độc lập, không chứng minh giao dịch đồng thời hoặc đẩy hàng chờ thật đã hoạt động.

## Minh chứng kiểm tra tại máy

- Frontend: lint không cảnh báo, build thành công, **47/47 test**; coverage dòng **87,66%**, câu lệnh **87,44%**, hàm **82,75%**, nhánh **78,81%**.
- Backend tại main đã đồng bộ: build thành công, **75/75 unit test**. Không bổ sung hoặc sửa logic backend trong lần rà soát này.
- Playwright: **1/1 health check qua** khi chạy với backend thật tại máy. Sandbox chặn socket localhost nên ca này được chạy ngoài sandbox; không sửa cấu hình bảo mật của repo. Kết quả health check không thay cho kiểm thử tích hợp đầy đủ các user story.

Mỗi PR vẫn cần review độc lập, CI đạt và merge trước khi ghi Done theo README.
