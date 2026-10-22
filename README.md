# University Course Registration & Prerequisite Validation Engine

Đồ án cuối kỳ môn Công nghệ Phần mềm (502045) - Đề tài 6.

Hệ thống cho phép sinh viên tìm môn học, đăng ký lớp học phần và xem thời khóa biểu tuần.
Mỗi lần đăng ký, hệ thống tự kiểm tra môn tiên quyết, trùng lịch, giới hạn tín chỉ và số chỗ còn lại;
khi lớp đã đầy, sinh viên có thể vào hàng chờ và được tự động xếp vào lớp khi có người hủy.

File này là tài liệu làm việc chung của nhóm: cách cài đặt, quy trình Git và các quy ước.
Mỗi thành viên đọc hết một lượt trước khi bắt đầu code.

## Mục lục

- [Thành viên và phân công](#thành-viên-và-phân-công)
- [Tính năng cốt lõi](#tính-năng-cốt-lõi)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tài liệu](#tài-liệu)
- [Cài đặt môi trường](#cài-đặt-môi-trường)
- [Quy trình Git](#quy-trình-git)
- [Pull Request và review](#pull-request-và-review)
- [Những việc không được làm](#những-việc-không-được-làm)
- [Khi nào một task được coi là xong](#khi-nào-một-task-được-coi-là-xong)

## Thành viên và phân công

| Vai trò | Họ tên | MSSV | GitHub | Phụ trách |
|---|---|---|---|---|
| M1 - Frontend / UI-UX | Nguyễn Thiên Trí | 52400059 | NguyenThienTri-52400059 | Tìm kiếm môn học, thời khóa biểu tuần, cổng đăng ký |
| M2 - Backend API | Lê Trung Bảo | 52400042 | Devil-2502 | Dịch vụ kiểm tra đồ thị tiên quyết, API đăng ký có khóa đồng thời, hàng chờ |
| M3 - Database, Auth & Security | Tăng Hoàng Phúc | 52400307 | PECOCCNA | Thiết kế CSDL (Courses, Enrolments, Prerequisites), đăng nhập và quản lý phiên |
| M4 - QA, DevOps & Integration Test | Bùi Quốc Trung | 52400250 | trungforwork1 | Stress test đăng ký đồng thời, unit test đồ thị tiên quyết, Docker, CI |

Việc của ai người đó chủ động làm. Cần sửa vào phần của người khác thì trao đổi trước trong Issue hoặc nhóm chat.

## Tính năng cốt lõi

| # | Tính năng | Mô tả ngắn |
|---|---|---|
| 1 | Danh mục môn học | Tìm kiếm môn, xem chi tiết, môn tiên quyết và các lớp học phần đang mở |
| 2 | Kiểm tra môn tiên quyết | Chỉ cho đăng ký khi sinh viên đã đạt mọi môn tiên quyết |
| 3 | Phát hiện trùng lịch | Từ chối lớp có buổi học chồng lên lớp đã đăng ký trong cùng học kỳ |
| 4 | Giới hạn tín chỉ | Tổng tín chỉ trong học kỳ không vượt mức tối đa |
| 5 | Hàng chờ | Lớp đầy thì vào hàng chờ; có người hủy thì người đầu hàng được xếp vào lớp |

## Kiến trúc hệ thống

Ba lớp, giao tiếp qua REST API. Frontend không truy cập cơ sở dữ liệu trực tiếp.

```
Frontend (React + Vite + TypeScript)
        |
        |  REST/JSON, phiên đăng nhập qua cookie
        v
Backend (Node.js + Express + TypeScript)
    - auth            đăng nhập, phiên, phân quyền
    - courses         danh mục môn, lớp học phần
    - prerequisites   đồ thị môn tiên quyết
    - registration    đăng ký, trùng lịch, tín chỉ, cấp chỗ
    - waitlist        hàng chờ
        |
        v
Database (PostgreSQL)
```

Các nguyên tắc thiết kế cả nhóm cần nhớ:

- Mọi kiểm tra nghiệp vụ (tiên quyết, trùng lịch, tín chỉ, số chỗ) nằm ở backend. Frontend chỉ hiển thị kết quả, không tự quyết định.
- Cấp chỗ phải nằm trong một transaction có khóa dòng của lớp học phần. Khi nhiều sinh viên cùng giành chỗ cuối, đúng một người thành công.
- Quan hệ tiên quyết là đồ thị có hướng không chu trình. Thêm một quan hệ tạo ra vòng lặp thì bị từ chối.
- Hủy môn và đẩy người trong hàng chờ lên phải nằm trong cùng một transaction.
- Frontend và backend chỉ giao tiếp theo `docs/openapi-spec.yaml`. Muốn đổi API thì sửa file này trước, qua Pull Request.

Stack ở trên là lựa chọn hiện tại của nhóm. Nếu đổi framework hay cơ sở dữ liệu thì sửa lại mục này trong cùng Pull Request.

## Cấu trúc thư mục

```
course-registration/
├── .github/
│   ├── ISSUE_TEMPLATE/          # mẫu Issue: user story, task, bug
│   ├── workflows/               # CI (M4)
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── srs/
│   │   └── user-stories.md      # user story + Gherkin
│   ├── uml/                     # Use Case, Class, Sequence (PDF)
│   ├── erd/
│   │   └── README.md            # thiết kế CSDL + ERD
│   ├── api-endpoints-draft.md   # bản nháp endpoint, ma trận quyền
│   ├── ui-screen-list.md        # danh sách màn hình
│   └── openapi-spec.yaml        # hợp đồng API (OpenAPI 3.1)
├── frontend/                    # M1
├── backend/                     # M2, M3
│   ├── src/
│   │   ├── auth/
│   │   ├── courses/
│   │   ├── prerequisites/
│   │   ├── registration/
│   │   └── waitlist/
│   ├── db/
│   │   ├── migrations/
│   │   └── seeds/
│   └── tests/                   # unit test
├── tests/                       # M4
│   ├── api/                     # Playwright API test
│   ├── load/                    # stress test đăng ký đồng thời
│   └── README.md                # kế hoạch kiểm thử
├── .env.example
├── docker-compose.yml
└── README.md
```

Một số thư mục (`frontend/`, `backend/`, `.env.example`, `docker-compose.yml`) sẽ xuất hiện dần khi người phụ trách mở Pull Request khởi tạo.

## Tài liệu

| Tài liệu | Nội dung | Người giữ |
|---|---|---|
| [docs/srs/user-stories.md](docs/srs/user-stories.md) | Quy tắc nghiệp vụ, 13 user story kèm Gherkin | Cả nhóm |
| [docs/api-endpoints-draft.md](docs/api-endpoints-draft.md) | Danh sách endpoint, ma trận quyền, mã lỗi | M2 |
| [docs/openapi-spec.yaml](docs/openapi-spec.yaml) | Hợp đồng API chính thức | M2 |
| [docs/ui-screen-list.md](docs/ui-screen-list.md) | Danh sách màn hình và luồng điều hướng | M1 |
| [docs/erd/README.md](docs/erd/README.md) | Bảng dữ liệu, ràng buộc, ERD | M3 |
| [docs/uml/README.md](docs/uml/README.md) | Sơ đồ Use Case, Class, Sequence | Cả nhóm |
| [tests/README.md](tests/README.md) | Kế hoạch kiểm thử | M4 |

## Cài đặt môi trường

Cần có: Git, Node.js 22 trở lên, Docker Desktop (để chạy PostgreSQL).

```bash
git clone https://github.com/Devil-2502/course-registration.git
cd course-registration
cp .env.example .env        # rồi điền giá trị thật, không commit file .env
```

Chạy từng phần:

```bash
docker compose up -d db                      # cơ sở dữ liệu
cd backend && npm install && npm run dev     # API tại http://localhost:3000
cd frontend && npm install && npm run dev    # giao diện tại http://localhost:5173
```

Kiểm tra backend đã chạy: mở `http://localhost:3000/api/v1/health`, thấy `{"status":"ok"}` là được.

## Quy trình Git

Không ai commit thẳng vào `main`. Mọi thay đổi đi theo thứ tự:

```
Issue -> nhánh riêng -> commit -> push -> Pull Request -> review -> approve -> merge -> xóa nhánh
```

Bắt đầu một task:

```bash
git checkout main
git pull
git checkout -b feature/us-04-register-section
```

Trong lúc làm:

```bash
git status
git add <các file của task>
git commit -m "feat: add section registration endpoint"
git push -u origin feature/us-04-register-section
```

Nếu `main` có commit mới trong lúc bạn đang làm:

```bash
git checkout main && git pull
git checkout feature/us-04-register-section
git merge main
```

Có xung đột thì mở file, sửa tay, chạy lại test rồi mới commit.

Quy ước đặt tên nhánh (chữ thường, không dấu, nối bằng gạch ngang):

| Tiền tố | Dùng khi | Ví dụ |
|---|---|---|
| `feature/` | Thêm tính năng | `feature/us-06-schedule-clash` |
| `fix/` | Sửa lỗi | `fix/waitlist-promotion-order` |
| `test/` | Thêm hoặc sửa test | `test/concurrent-registration` |
| `docs/` | Tài liệu | `docs/openapi-registrations` |
| `chore/` | Cấu hình, công cụ | `chore/setup-ci` |

Quy ước commit: `<loại>: <mô tả ngắn>`, loại là một trong `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.
Tránh các message như `update`, `fix loi`, `final`: đọc lại lịch sử sẽ không ai biết đã đổi gì.

## Pull Request và review

- Mô tả PR điền theo mẫu có sẵn, có dòng `Closes #<số Issue>`.
- Ghi rõ đã test gì và kèm ảnh chụp hoặc log test chạy qua.
- Người mở PR không tự approve. Mỗi PR cần ít nhất một thành viên khác review, nhận xét và approve.
- Luân phiên người review để ai cũng có lượt review trong lịch sử.
- Merge bằng nút **Merge pull request**. Nút **Close pull request** là hủy PR, không đưa code vào `main`.

## Những việc không được làm

- Không push thẳng lên `main`, không dùng tùy chọn bỏ qua quy tắc bảo vệ nhánh cho PR có code.
- Không commit `.env`, mật khẩu, khóa bí mật hay chuỗi kết nối cơ sở dữ liệu thật.
- Không commit code bằng tài khoản GitHub của người khác.
- Không tự đổi request hoặc response của API mà chưa sửa `docs/openapi-spec.yaml` và báo người liên quan.
- Không dồn code vào một commit lớn cuối kỳ. Commit nhỏ, đều, mỗi commit một ý.
- Không cập nhật số chỗ của lớp bên ngoài transaction đăng ký hoặc hủy môn.
- Không `git push --force` lên nhánh người khác đang làm.
- Không merge khi CI đang đỏ.

## Khi nào một task được coi là xong

- Có Issue, gán đúng một người.
- Có nhánh đặt tên đúng quy ước.
- Code chạy được ở máy, lint không cảnh báo.
- Có unit test cho logic nghiệp vụ mới, độ phủ không dưới 60%.
- Đã mở PR, liên kết đúng Issue.
- Có ít nhất một người khác review và approve.
- CI xanh, đã merge vào `main`.

Thiếu một mục thì task chưa xong, kể cả khi code đã chạy đúng.
