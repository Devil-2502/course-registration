# Kịch bản demo M4

Chuẩn bị DB test riêng, seed và các API đã tích hợp; chạy API suite trước demo. Các bước dưới là kịch bản dự kiến, không phải kết quả đã chạy.

1. Đăng nhập sinh viên và tìm môn CS201; hiển thị tiên quyết và số chỗ.
2. Dùng sinh viên thiếu CS101 để minh họa từ chối tiên quyết.
3. Dùng sinh viên có lịch giao nhau để minh họa từ chối trùng lịch.
4. Dùng sinh viên đủ điều kiện đăng ký; kiểm tra lịch và số chỗ giảm một.
5. Vào hàng chờ lớp đầy; hủy một đăng ký rồi kiểm tra người đầu đủ điều kiện được vào lớp.
6. Chạy `npm run test:load -- --runs 5` trong tests trên DB test riêng. Mở JSON kết quả, giải thích số phản hồi 201/409, p95 và đối chiếu enrolled_count.
7. Trình bày CI: lint/format, backend unit test và coverage, frontend test, API smoke hoặc DB suite tùy trạng thái tích hợp.

Chỉ dùng kết quả từ lần chạy thật của nhóm. Khi endpoint chưa có, ghi rõ phần demo còn chờ; không dùng kết quả minh họa trong tài liệu mẫu làm bằng chứng.
