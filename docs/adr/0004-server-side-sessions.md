# ADR-0004: Phiên đăng nhập lưu trong CSDL, không dùng JWT

- Trạng thái: Đã chấp nhận
- Liên quan: US-01, US-12 (phân quyền ADMIN), `backend/db/migrations/002_sessions.sql`

## Bối cảnh

Hệ thống có hai vai trò (sinh viên, quản trị viên). Cần đăng nhập an toàn, đăng xuất có hiệu lực ngay,
và không để lộ thông tin phiên cho JavaScript trên trình duyệt. Frontend và backend chạy cùng một nguồn
gốc (qua proxy của Vite khi phát triển, qua nginx trong Docker).

## Các lựa chọn đã cân nhắc

1. **JWT lưu ở `localStorage`**: không cần bảng phiên, nhưng mã độc JavaScript (XSS) đọc được token;
   đăng xuất không thu hồi được token còn hạn nếu không dựng thêm danh sách đen.
2. **JWT trong cookie `httpOnly`**: tránh được XSS đọc token, nhưng vẫn khó thu hồi, và phải quản lý khóa ký.
3. **Phiên lưu phía máy chủ**: cookie `httpOnly` chỉ chứa một mã ngẫu nhiên; thông tin phiên nằm trong CSDL.

## Quyết định

Chọn **phương án 3**:

- Đăng nhập thành công: tạo mã phiên ngẫu nhiên 32 byte, **chỉ lưu bản băm SHA-256** trong bảng `sessions`
  (kèm `expires_at`, 24 giờ), gửi mã gốc trong cookie `sid` với `httpOnly`, `sameSite: 'lax'`, `secure`
  khi chạy production.
- Mỗi yêu cầu: `requireAuth` băm cookie, tìm phiên còn hạn; `requireRole('STUDENT' | 'ADMIN')` kiểm tra vai trò.
- Đăng xuất: xóa dòng phiên, phiên mất hiệu lực ngay.
- Mật khẩu băm bằng **scrypt** có muối ngẫu nhiên, so sánh bằng `timingSafeEqual`.

## Hệ quả

- Tích cực:
  - JavaScript không đọc được cookie; lộ bảng `sessions` cũng không dùng được vì chỉ có bản băm.
  - Đăng xuất có hiệu lực ngay lập tức (xóa dòng phiên là xong).
  - Không phải quản lý khóa ký JWT.
- Tiêu cực / phải chấp nhận:
  - Mỗi yêu cầu tốn thêm một truy vấn tìm phiên (theo khóa chính nên rất nhanh).
  - Chạy nhiều máy chủ vẫn được vì phiên nằm trong CSDL dùng chung, nhưng CSDL thành điểm phụ thuộc chung.
  - Cần dọn phiên hết hạn định kỳ (có chỉ mục `idx_sessions_expires` sẵn cho việc này).

## Bằng chứng trong repo

- `backend/src/auth/auth.session.ts`, `auth.password.ts`, `auth.middleware.ts`, `auth.routes.ts`.
- `backend/tests/auth.*.test.ts`; Playwright `tests/api/` kiểm tra 401 khi chưa đăng nhập, 403 khi sai vai trò.
