# Bản ghi quyết định kiến trúc (ADR)

Mỗi file ghi **một quyết định thiết kế quan trọng**: bối cảnh lúc quyết định, các lựa chọn đã cân nhắc,
lựa chọn cuối cùng, hệ quả (cả tốt lẫn xấu) và bằng chứng trong repo. Mục đích là để người đọc sau này
(giảng viên, thành viên mới, chính nhóm khi bảo vệ) hiểu **vì sao** hệ thống được làm như vậy.

| # | Quyết định | Trạng thái |
|---|---|---|
| [0001](0001-layered-monolith-api-first.md) | Ứng dụng nguyên khối nhiều tầng, thiết kế API trước (OpenAPI) | Đã chấp nhận |
| [0002](0002-postgresql.md) | Dùng PostgreSQL (CSDL quan hệ) | Đã chấp nhận |
| [0003](0003-row-locking-for-update.md) | Chống bán lố chỗ bằng khóa dòng `SELECT ... FOR UPDATE` | Đã chấp nhận, xác nhận bằng thí nghiệm |
| [0004](0004-server-side-sessions.md) | Phiên đăng nhập lưu trong CSDL, không dùng JWT | Đã chấp nhận |
| [0005](0005-automatic-waitlist-promotion.md) | Hàng chờ tự đôn người đầu hàng trong cùng giao dịch hủy | Đã chấp nhận |
| [0006](0006-schedule-suggestions-backtracking.md) | Gợi ý thời khóa biểu bằng quay lui và điểm phạt | Đã chấp nhận (cải tiến 1) |
| [0007](0007-safe-section-swap.md) | Đổi lớp bằng ghép cặp trong một giao dịch khóa hai lớp | Đã chấp nhận (cải tiến 2) |

## Mẫu cho ADR mới

```markdown
# ADR-000N: <tên quyết định>

- Trạng thái: Đề xuất | Đã chấp nhận | Thay thế bởi ADR-000M
- Liên quan: <user story, business rule, PR>

## Bối cảnh
Vấn đề cần giải quyết và các ràng buộc lúc đó.

## Các lựa chọn đã cân nhắc
1. ...

## Quyết định
Chọn gì, nói ngắn gọn.

## Hệ quả
- Tích cực: ...
- Tiêu cực / phải chấp nhận: ...

## Bằng chứng trong repo
File, test, kết quả đo.
```

Quy ước: ADR đã chấp nhận thì không sửa nội dung quyết định; nếu đổi hướng thì viết ADR mới và đánh dấu
ADR cũ là "Thay thế bởi ADR-000M".
