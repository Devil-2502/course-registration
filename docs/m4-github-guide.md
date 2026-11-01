# Bàn giao code M4 và đưa lên GitHub nhóm

## Trạng thái triển khai

Nhánh chuẩn bị: `codex/m4-qa-devops`, nền `f301e32`. Nội dung tham khảo từ Code-mau-M4-Trung_1.zip và Huong-dan-M4-Bui-Quoc-Trung.docx do người dùng cung cấp; đã chỉnh để phù hợp main hiện tại. Không lấy kết quả chạy trong tài liệu làm bằng chứng cho lần triển khai này.

| Task | Code đã chuẩn bị | Điều kiện xác nhận hoàn thành |
|---|---|---|
| T1 | ESLint, Prettier, coverage 60%, CI | lint, format, build, unit test qua |
| T2 | 7 test bổ sung đồ thị | Jest qua |
| T3 | init SQL theo thứ tự migration/seed, LF, Docker ignore, SPA nginx | Docker trên DB mới có seed của M3 |
| T4 | Playwright serial, auth, helper DB, PostgreSQL CI | auth và seed M3 merge, chạy DB test thật |
| T5 | test học kỳ, admin | các API quản trị merge |
| T6 | test courses/registration/prerequisite/clash/credits/waitlist/promotion | bỏ `test.fixme` từng API khi M2 bàn giao |
| T7 | 4 stress scenario, JSON report | backend thật, seed đúng hợp đồng, 5 lần liên tiếp |
| T8 | frontend Vitest trong CI | frontend test qua |

## Chạy kiểm tra trên máy

Kết quả xác minh cục bộ ngày 01/11/2026:

- Backend lint và Prettier: qua; TypeScript build: qua.
- Backend Jest: 14 suite, 128 test qua; báo cáo coverage hiện tại ghi 100% cho các module được thống kê.
- Frontend: 13 file, 51 test qua; lint, TypeScript và Vite build qua.
- Tests TypeScript: qua; Playwright health: 1 test qua; chế độ DB nhận diện 48 test trong 11 file, chưa chạy DB suite.
- Kiểm thử bảo vệ reset DB: qua; kiểm tra cú pháp stress scripts và git diff --check: qua.
- Docker và stress với DB thật: chưa xác minh do máy chưa có Docker CLI, repo chưa có seed/auth/API tích hợp.
- npm install backend báo 32 cảnh báo lỗ hổng dependency (4 low, 27 moderate, 1 high). Cần nhóm đánh giá bằng npm audit trước khi phát hành; chưa chạy audit fix --force để tránh đổi dependency ngoài phạm vi M4.

Máy hiện có Git user.name là JARVIS và email trungforwork1@gmail.com. Bạn cần xác nhận tác giả mong muốn trước khi commit. npm trên máy cũng từng báo shell trỏ nhầm thư mục Java; khi gặp lỗi spawn, dùng `npm --script-shell=C:/Windows/System32/cmd.exe <lệnh>` hoặc sửa cấu hình script-shell cục bộ.

Yêu cầu Node 22 trở lên. Từ thư mục repo, chạy lần lượt:

```powershell
cd backend
npm ci
npm run lint
npm run format:check
npm run build
npm test -- --runInBand
cd ../frontend
npm ci
npm run lint
npm test
npm run build
cd ../tests
npm ci
npm run typecheck
npm test
cd ..
```

`npm test` trong tests mặc định chỉ chạy health. Điều này không xác nhận API nghiệp vụ đã hoạt động. Các test `fixme` là công việc còn chờ M2 và phải hiện rõ trong báo cáo tích hợp.

## Bật kiểm thử DB thật sau khi M2 M3 bàn giao

Tạo database riêng `course_registration_test`; backend chạy ở cổng 3000 và phải dùng cùng URL DB với test. Không dùng DB cá nhân đang chứa dữ liệu cần giữ. Test reset toàn bộ dữ liệu của DB chỉ định.

```powershell
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/course_registration_test'
$env:ALLOW_TEST_DB_RESET = '1'
$env:API_URL = 'http://localhost:3000'
cd backend
npm run build
npm start
```

Mở terminal thứ hai, đặt lại ba biến trên, rồi:

```powershell
cd tests
npm run test:db
npm run test:load -- --runs 5
```

Seed bắt buộc nằm ở `backend/db/seeds/001_seed.sql`. Nó cần khớp helpers/accounts.ts và dữ liệu mà test dùng: học kỳ 2026-1/2025-2, std_101..std_260 và các sinh viên std_402, std_500, std_501, std_610, std_611; CS101/CS201/CS301, MA101, EN101 và các lớp trong file test. Đối chiếu toàn bộ mã được dùng trong tests/api và tests/load với M3 trước khi chạy.

CI mặc định chạy smoke. Sau khi auth/seed có trên main, tạo Repository variable `RUN_DB_TESTS=1` trong Settings → Secrets and variables → Actions → Variables. CI sẽ chạy toàn bộ suite DB; các test fixme vẫn phải được bật riêng khi endpoint tương ứng hoàn thành. Không bật biến sớm để tránh làm đỏ CI nhóm vì phụ thuộc chưa có.

Docker init chỉ chạy trên volume mới. `init.sh` bỏ qua thư mục seed chưa có SQL để DB vẫn tạo schema được. Việc đó không có nghĩa dữ liệu mẫu đã đầy đủ. Không xóa volume đang có dữ liệu chỉ để thử demo; hãy dùng project Compose riêng.

## Issue và Pull Request

Tạo 8 Issue Task, gán trungforwork1 và thêm vào Project của nhóm. Tiêu đề đề xuất:

1. T1 Backend lint format and coverage threshold
2. T2 Extra prerequisite graph unit tests
3. T3 Docker schema and seed initialization
4. T4 Playwright database setup and authentication tests
5. T5 Semester and admin API tests
6. T6 Registration rules API tests
7. T7 Concurrent registration stress tests
8. T8 Frontend unit tests in CI

Nhánh hiện tại là bản chuẩn bị tổng hợp. Theo quy trình nhóm, khi nộp hãy tách PR theo T1 → T2 → T8; T3–T7 theo phụ thuộc trong bảng. Giữ bản chuẩn bị này để lấy file. Mỗi PR mới tạo từ main mới nhất, chỉ chép file thuộc task đó. Không checkout main khi vẫn còn thay đổi chưa lưu; commit bản chuẩn bị trên nhánh riêng sau khi đã kiểm tra thông tin tác giả.

```powershell
git config user.name
git config user.email
git status
git diff --check
# Sau khi xác nhận đúng tên và email GitHub của bạn:
git add backend tests frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore .github/workflows/ci.yml .gitattributes docker-compose.yml docs/m4-github-guide.md docs/report/demo-script.md
git commit -m "test: prepare M4 QA and DevOps implementation"
git push -u origin codex/m4-qa-devops
```

Nếu nhóm đồng ý review một PR tổng hợp, mở Compare & pull request trên GitHub, chọn base main, head codex/m4-qa-devops và để Draft khi DB/stress chưa xác minh. Nếu nhóm yêu cầu 8 PR, dùng commit bản chuẩn bị để lấy từng nhóm file, không mở PR tổng hợp vào main. Các bước cài package T1 cần cả backend/package.json và package-lock.json; T4 tương tự cho tests. CI của từng PR chỉ thêm bước thuộc task đã đủ phụ thuộc.

Mô tả PR phải ghi Issue liên quan, file thay đổi, kiểm tra thực sự đã chạy, các test còn fixme và phụ thuộc chưa có. Không đánh dấu CI xanh/approve/merge trước khi có kết quả. Chọn PECOCCNA ở Reviewers, dự phòng Devil-2502; T8 có thể nhờ NguyenThienTri-52400059. Chỉ merge sau review và CI xanh.

## Thông tin cần bạn trả lời hoặc bổ sung

- [ ] Email GitHub của trungforwork1 để xác nhận tác giả commit (không cần gửi mật khẩu/token).
- [ ] Nhóm muốn giữ 8 PR theo hướng dẫn hay chấp nhận PR tổng hợp Draft?
- [ ] Nhờ M3 cung cấp/merge `001_seed.sql`, auth và API admin; ghi số PR thực tế.
- [ ] Nhờ M2 xác nhận endpoint nào đã chạy với PostgreSQL để bật test tương ứng.
- [ ] Cài/bật Docker Desktop hoặc cung cấp DB test riêng; hiện chưa tìm thấy docker CLI.
- [ ] Sau khi tạo Issue, điền số Issue T1–T8 và URL Project để liên kết minh chứng.

Không cần cung cấp thông tin này để review code cục bộ. Cần chúng để chốt tích hợp, commit đúng tác giả và hoàn tất quy trình GitHub của nhóm.
