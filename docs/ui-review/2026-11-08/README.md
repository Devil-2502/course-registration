# Kiểm thử giao diện M1 với backend thật ngày 08/11/2026

Đối chiếu `Viec-tiep-theo-M1-Nguyen-Thien-Tri.docx` với main `875191a` sau khi PR #43 và các API #55–#58 đã merge. Đã chạy backend thật và trình duyệt Edge headless ở viewport 1280 × 960; không chặn request, giả lập fetch hoặc thay dữ liệu phản hồi trong lượt kiểm thử trình duyệt.

## Môi trường và dữ liệu

- Backend Node.js của repo, frontend Vite tại `localhost:5173`, API được proxy tới cổng 3000.
- Docker Desktop gặp lỗi khởi động. Sau khi người phụ trách cho phép, dùng PostgreSQL portable 16.15 từ [EDB](https://www.enterprisedb.com/download-postgresql-binaries), chỉ lắng nghe `127.0.0.1:55432` và có mật khẩu riêng.
- Tạo CSDL kiểm thử riêng cho lượt trước/sau, không xóa hoặc ghi vào CSDL dev đang có. Mỗi lượt nạp nguyên `001_init.sql`, `002_sessions.sql`, `001_seed.sql` của repo.
- Mật khẩu, cấu hình kết nối, binary PostgreSQL và dữ liệu CSDL nằm ngoài repository, không commit.
- Backend/frontend chạy được; `/api/v1/health` trả `{"status":"ok"}`; std_402 đăng nhập thấy đủ 20 môn ban đầu.

## Phát hiện và sửa đúng phạm vi frontend

1. Vòng lặp tiên quyết chỉ có câu báo chung. Bổ sung đường đi `details.path` do backend trả về, vẫn giữ câu cũ nếu không có đường đi hợp lệ.
2. Sai mật khẩu hiện `Invalid email or password.`. Bổ sung ánh xạ `INVALID_CREDENTIALS` sang tiếng Việt, không thay mã lỗi, API hoặc xử lý phiên.
3. Lượt thử đầu dừng tại kịch bản 8: rời hàng chờ thành công nhưng mục Hàng chờ vẫn chứa lịch sử CANCELLED. Đối chiếu repository backend cho thấy API chủ động trả cả lịch sử. Chỉ tách hiển thị WAITING và lịch sử kết thúc, không đổi dữ liệu hoặc quy tắc backend. Sau đó chạy lại toàn bộ từ một CSDL seed mới.

## Kết quả 16 kịch bản sau sửa

| # | Kiểm tra với UI thật | Kết quả |
|---|---|---|
| 1 | std_402 tìm data | Có CS201 và CS230, đúng 2 môn |
| 2 | Chi tiết CS201 | CS101 đã đạt; đủ ba lớp CS201-01, -02, -03 |
| 3 | Xem trước CS201-01 | Trùng MA101-01, khóa xác nhận |
| 4 | Đăng ký CS201-02 | Thành công, sĩ số tăng 1, 7/24 tín chỉ |
| 5 | Lịch tuần | MA101-01 và CS201-02 cùng thứ Hai, liền kề |
| 6 | Hủy CS201-02 | Có xác nhận, thông báo thành công và lớp biến khỏi danh sách |
| 7 | Vào hàng chờ EN101-01 | Máy chủ xác nhận vị trí 4 |
| 8 | Rời hàng chờ | Không còn lượt đang chờ/nút rời; CANCELLED nằm ở Lịch sử hàng chờ |
| 9 | Kết quả học tập | CS101, học kỳ 2025-2, điểm 8, đã đạt |
| 10 | std_500 xem trước CS201-02 | Thiếu CS101, khóa đăng ký |
| 11 | std_501 xem trước CS201-02 | CS101 đã học nhưng chưa đạt, khóa đăng ký |
| 12 | std_140 hủy EN101-01 | std_610 đăng nhập thấy EN101-01 trong lớp đã đăng ký |
| 13 | Admin tạo CS450 rồi nhập trùng CS201 | Lần đầu thành công, lần sau báo trùng mã tiếng Việt |
| 14 | Admin tạo EN101-02 | Thành công, sức chứa 25, một buổi học |
| 15 | Sửa sức chứa EN101-01 thành 10 rồi 31 | Lần đầu bị từ chối; lần sau 31/31 và đôn std_611 (std_610 đã được đôn ở bước 12) |
| 16 | Roster và thêm CS301 làm tiên quyết CS101 | Có mã SV, họ tên, hàng chờ; báo rõ CS101 → CS301 → CS201 → CS101 |

**16/16 đạt, không có lỗi JavaScript trên trang.** Log máy đọc được: [scenarios.json](scenarios.json). Tài khoản và dữ liệu trong ảnh là seed của nhóm.

## Minh chứng trước và sau

| Thay đổi | Trước | Sau |
|---|---|---|
| Vòng lặp tiên quyết | [Ảnh trước](cycle-before.png) | [Ảnh sau](cycle-after.png) |
| Sai mật khẩu | [Ảnh trước](login-before.png) | [Ảnh sau](login-after.png) |
| Hàng chờ và lịch sử | [Ảnh trước tại bước 8](waitlist-before.png) | [Ảnh sau](waitlist-after.png) |

Các ảnh này phục vụ review thay đổi, không phải bộ 14 ảnh giao diện cuối cho báo cáo. Bộ ảnh cuối, video demo và chương báo cáo sẽ thực hiện sau khi PR sửa giao diện được review/merge theo hướng dẫn.

## Kiểm tra tự động frontend

```text
npm run lint: không cảnh báo
npm run test:coverage:
  Test Files: 13 passed (13)
  Tests: 54 passed (54)
  Statements: 94.94%
  Branches: 89.35%
  Functions: 94.01%
  Lines: 97.48%
npm run build: tsc -b và Vite build thành công
```

Đã giữ nguyên hợp đồng OpenAPI, mã backend và CSDL nghiệp vụ. Không đánh dấu các bước yêu cầu review/merge, xuất bản Drive hoặc quay video là đã hoàn thành.
