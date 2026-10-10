# Kế hoạch kiểm thử - Topic 6

- Người phụ trách: Bùi Quốc Trung (M4 - QA, DevOps & Integration Test)
- Người review: Lê Trung Bảo (M2)
- Trạng thái: bản nháp khởi đầu, người phụ trách cần rà soát, chỉnh sửa rồi mới đưa cả nhóm review

## 1. Mục tiêu

| Yêu cầu của môn học | Cách đáp ứng |
|---|---|
| Unit test cho logic nghiệp vụ, độ phủ từ 60% | Jest, đặt trong `backend/tests/` |
| Playwright API test chạy trong CI | Đặt trong `tests/api/`, chạy bằng GitHub Actions |
| Stress test đăng ký đồng thời | Đặt trong `tests/load/` |
| Phân tích tĩnh | Lint chạy trong CI, không cho merge khi có cảnh báo |

## 2. Cấu trúc thư mục

```
backend/tests/          unit test, đặt cạnh code mà nó kiểm tra
tests/
├── api/                Playwright API test theo docs/openapi-spec.yaml
├── load/               stress test đăng ký đồng thời
└── README.md           file này
```

## 3. Unit test

Chỉ kiểm tra logic thuần, không cần cơ sở dữ liệu.

| Nhóm | Trường hợp cần có | User story |
|---|---|---|
| Đồ thị tiên quyết | Môn không có tiên quyết; thiếu một môn; chuỗi 3 cấp; môn có 2 tiên quyết; môn tiên quyết bị rớt | US-05 |
| Phát hiện vòng lặp | Vòng 2 môn; vòng 3 môn; môn tự trỏ về mình; thêm cạnh hợp lệ vào đồ thị lớn | US-13 |
| Trùng lịch | Giao nhau một phần; lồng nhau; liền kề (không trùng); khác thứ (không trùng); lớp có nhiều buổi | US-06 |
| Giới hạn tín chỉ | Dưới giới hạn; bằng giới hạn; vượt 1 tín chỉ; chưa đăng ký môn nào | US-07 |
| Hàng chờ | Thứ tự vào trước ra trước; bỏ qua người không còn đủ điều kiện; hàng chờ rỗng | US-10 |

## 4. Playwright API test

Mỗi kịch bản Gherkin trong `docs/srs/user-stories.md` tương ứng với ít nhất một test.
Test chạy trên backend thật và cơ sở dữ liệu đã nạp dữ liệu mẫu.

| File | Nội dung | User story |
|---|---|---|
| `health.spec.ts` | Dịch vụ trả 200 | - |
| `auth.spec.ts` | Đăng nhập đúng, sai mật khẩu, gọi API khi chưa đăng nhập | US-01 |
| `courses.spec.ts` | Tìm kiếm, phân trang, chi tiết môn, môn không tồn tại | US-02, US-03 |
| `registration.spec.ts` | Đăng ký thành công, đăng ký trùng môn, ngoài thời gian đăng ký | US-04 |
| `prerequisite.spec.ts` | Thiếu tiên quyết, rớt tiên quyết, chuỗi nhiều cấp | US-05 |
| `schedule-clash.spec.ts` | Trùng lịch, liền kề, khác thứ | US-06 |
| `credit-limit.spec.ts` | Vượt giới hạn, đúng bằng giới hạn | US-07 |
| `waitlist.spec.ts` | Vào hàng chờ, vào hai lần, lớp còn chỗ, rời hàng chờ | US-09 |
| `drop-promotion.spec.ts` | Hủy môn, đẩy người đầu hàng, bỏ qua người không đủ điều kiện | US-10 |
| `admin.spec.ts` | Tạo môn, trùng mã, tạo lớp, sinh viên gọi API quản trị, vòng lặp tiên quyết | US-12, US-13 |

Mỗi test tự chuẩn bị dữ liệu nó cần và không phụ thuộc thứ tự chạy.

## 5. Stress test đăng ký đồng thời

Đây là bài kiểm thử quan trọng nhất của đề tài (US-08).

| Kịch bản | Thiết lập | Kết quả phải đạt |
|---|---|---|
| Giành chỗ cuối | Lớp sức chứa 40, đã có 39; 100 sinh viên đủ điều kiện gửi yêu cầu cùng lúc | Đúng 1 phản hồi 201, 99 phản hồi 409 `SECTION_FULL`, lớp có đúng 40 sinh viên |
| Lớp trống | Lớp sức chứa 40, chưa ai đăng ký; 100 sinh viên gửi cùng lúc | Đúng 40 phản hồi 201, 60 phản hồi 409, lớp có đúng 40 sinh viên |
| Bấm hai lần | Một sinh viên gửi cùng một yêu cầu 10 lần cùng lúc | Đúng 1 phản hồi 201, lớp chỉ tăng 1 chỗ |
| Hủy và đẩy hàng chờ | Lớp đầy, 20 người chờ; 5 sinh viên hủy cùng lúc | Đúng 5 người đầu hàng được đẩy lên, lớp vẫn đầy, không ai bị đẩy hai lần |

Sau mỗi lần chạy, kiểm tra thêm trong cơ sở dữ liệu: `enrolled_count` bằng số dòng `ENROLLED` của lớp và không vượt `capacity`.

Kết quả chạy (số phản hồi theo từng mã, thời gian phản hồi) lưu lại để đưa vào báo cáo và demo.

## 6. CI

Mỗi Pull Request vào `main` phải chạy và qua các bước:

1. Kiểm tra `docs/openapi-spec.yaml` hợp lệ.
2. Backend: cài đặt, lint, build, unit test kèm độ phủ.
3. Frontend: cài đặt, lint, build.
4. Dựng cơ sở dữ liệu và backend, chạy Playwright API test.

Stress test chạy thủ công trước mỗi mốc nộp, không chạy ở mỗi Pull Request vì tốn thời gian.

## 7. Tiêu chí qua

- Mọi unit test và Playwright test đều qua.
- Độ phủ unit test của `backend/src/` từ 60% trở lên.
- Bốn kịch bản stress test cho đúng kết quả trong 5 lần chạy liên tiếp.
- Lint không có cảnh báo.

## 8. Các điểm cần thống nhất

1. Công cụ stress test: k6, hay viết bằng Playwright với các yêu cầu chạy song song.
2. Cách đặt lại dữ liệu giữa các lần chạy test: nạp lại toàn bộ, hay mỗi test tự tạo dữ liệu riêng.
3. Test có cần chạy được khi đợt đăng ký đã đóng không (cần cách chỉnh thời gian của học kỳ trong dữ liệu test).
4. Ngưỡng độ phủ đặt trong cấu hình Jest để CI tự chặn, hay kiểm tra bằng mắt.
