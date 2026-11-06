
-- Seed P2: Du lieu mau cho demo va kiem thu.
-- Mat khau chung: Password@123
-- Hash su dung scrypt tu ham hashPassword() cua backend.
-- Chi su dung cho moi truong development/test.

BEGIN;

-- 1. Tao 2 tai khoan ADMIN.
INSERT INTO users (email, password_hash, full_name, role)
VALUES
(
  'admin1@tdtu.edu.vn',
  'scrypt:43cd09b4fdc2491a1543c29d5ec1805b:66d09ad802d88612b707008e925b09742998189127dc67fc9ccfd4cc0f24544583396fdb5b8c1f6c05bf818ea67e4a9d1553b6dde1611290c0be65e8993a9e43',
  'Quản trị viên 1',
  'ADMIN'
),
(
  'admin2@tdtu.edu.vn',
  'scrypt:43cd09b4fdc2491a1543c29d5ec1805b:66d09ad802d88612b707008e925b09742998189127dc67fc9ccfd4cc0f24544583396fdb5b8c1f6c05bf818ea67e4a9d1553b6dde1611290c0be65e8993a9e43',
  'Quản trị viên 2',
  'ADMIN'
);


-- 2. Tao 160 tai khoan sinh vien (std_101 den std_260).
INSERT INTO users (email, password_hash, full_name, role)
SELECT
  'std_' || n || '@student.edu.vn',
  'scrypt:43cd09b4fdc2491a1543c29d5ec1805b:66d09ad802d88612b707008e925b09742998189127dc67fc9ccfd4cc0f24544583396fdb5b8c1f6c05bf818ea67e4a9d1553b6dde1611290c0be65e8993a9e43',
  'Sinh viên ' || n,
  'STUDENT'
FROM generate_series(101, 260) AS n;

-- 3. Tao 6 tai khoan sinh vien cho cac kich ban Gherkin.
INSERT INTO users (email, password_hash, full_name, role)
SELECT
  'std_' || v.student_number || '@student.edu.vn',
  'scrypt:43cd09b4fdc2491a1543c29d5ec1805b:66d09ad802d88612b707008e925b09742998189127dc67fc9ccfd4cc0f24544583396fdb5b8c1f6c05bf818ea67e4a9d1553b6dde1611290c0be65e8993a9e43',
  v.full_name,
  'STUDENT'
FROM (VALUES
  (402, 'Nguyễn Văn An'),
  (500, 'Trần Thị Bình'),
  (501, 'Lê Văn Cường'),
  (610, 'Phạm Thị Dung'),
  (611, 'Hoàng Văn Em'),
  (700, 'Võ Thị Giang')
) AS v(student_number, full_name);

-- 4. Tao ho so sinh vien lien ket voi users.
INSERT INTO students (user_id, student_code, program)
SELECT
  id,
  split_part(email, '@', 1),
  'Khoa học máy tính'
FROM users
WHERE role = 'STUDENT';


-- 5. Tao du lieu hoc ky.
INSERT INTO semesters (
  code,
  name,
  registration_start,
  registration_end,
  max_credits
)
VALUES
(
  '2025-2',
  'Học kỳ 2 năm học 2025-2026',
  now() - interval '200 days',
  now() - interval '170 days',
  24
),
(
  '2026-1',
  'Học kỳ 1 năm học 2026-2027',
  now() - interval '7 days',
  now() + interval '60 days',
  24
);



-- 6. Tao 20 mon hoc.
INSERT INTO courses (code, name, credits, description)
VALUES
  ('CS101', 'Introduction to Programming', 4, 'Nhập môn lập trình'),
  ('CS201', 'Data Structures and Algorithms', 4, 'Cấu trúc dữ liệu và giải thuật'),
  ('CS301', 'Design and Analysis of Algorithms', 4, 'Phân tích và thiết kế giải thuật'),
  ('CS202', 'Object-Oriented Programming', 4, 'Lập trình hướng đối tượng'),
  ('CS210', 'Discrete Mathematics', 3, 'Toán rời rạc'),
  ('CS220', 'Computer Architecture', 3, 'Kiến trúc máy tính'),
  ('CS230', 'Database Systems', 4, 'Hệ cơ sở dữ liệu'),
  ('CS240', 'Operating Systems', 4, 'Hệ điều hành'),
  ('CS250', 'Computer Networks', 3, 'Mạng máy tính'),
  ('CS310', 'Software Engineering', 4, 'Công nghệ phần mềm'),
  ('CS320', 'Web Programming', 3, 'Lập trình web'),
  ('CS330', 'Artificial Intelligence', 4, 'Nhập môn trí tuệ nhân tạo'),
  ('MA101', 'Calculus 1', 3, 'Giải tích 1'),
  ('MA102', 'Calculus 2', 3, 'Giải tích 2'),
  ('MA201', 'Linear Algebra', 3, 'Đại số tuyến tính'),
  ('MA202', 'Probability and Statistics', 3, 'Xác suất thống kê'),
  ('EN101', 'English 1', 2, 'Tiếng Anh 1'),
  ('EN102', 'English 2', 2, 'Tiếng Anh 2'),
  ('PE101', 'Physical Education 1', 1, 'Giáo dục thể chất 1'),
  ('SS101', 'Philosophy', 2, 'Triết học');


-- 7. Tao quan he mon hoc tien quyet.
INSERT INTO prerequisites (course_id, prerequisite_id)
SELECT c.id, p.id
FROM (VALUES
  ('CS201', 'CS101'),
  ('CS301', 'CS201'),
  ('CS330', 'CS301'),
  ('CS202', 'CS101'),
  ('CS220', 'CS101'),
  ('CS230', 'CS201'),
  ('CS240', 'CS201'),
  ('CS240', 'CS220'),
  ('CS250', 'CS220'),
  ('CS310', 'CS202'),
  ('CS320', 'CS202'),
  ('MA102', 'MA101'),
  ('MA202', 'MA101'),
  ('EN102', 'EN101')
) AS rel (course_code, prerequisite_code)
JOIN courses c ON c.code = rel.course_code
JOIN courses p ON p.code = rel.prerequisite_code;


-- 8. Tao 15 lop hoc phan cho hoc ky 2026-1.
INSERT INTO sections (
  course_id,
  semester_id,
  code,
  lecturer_name,
  capacity
)
SELECT
  c.id,
  s.id,
  v.section_code,
  v.lecturer_name,
  v.capacity
FROM (VALUES
  ('MA101', 'MA101-01', 'ThS. Nguyễn Văn Toán', 40),
  ('CS201', 'CS201-01', 'TS. Trần Minh Khoa', 40),
  ('CS201', 'CS201-02', 'TS. Trần Minh Khoa', 40),
  ('CS201', 'CS201-03', 'ThS. Lê Thu Hà', 40),
  ('CS101', 'CS101-01', 'ThS. Phạm Quốc Huy', 60),
  ('CS101', 'CS101-02', 'ThS. Phạm Quốc Huy', 60),
  ('CS301', 'CS301-01', 'PGS. TS. Đỗ Văn Nam', 40),
  ('CS202', 'CS202-01', 'ThS. Lê Thu Hà', 40),
  ('CS210', 'CS210-01', 'TS. Bùi Thị Lan', 40),
  ('CS220', 'CS220-01', 'TS. Ngô Đức Mạnh', 40),
  ('CS230', 'CS230-01', 'TS. Trần Minh Khoa', 40),
  ('CS310', 'CS310-01', 'TS. Hồ Thanh Phong', 40),
  ('MA201', 'MA201-01', 'ThS. Nguyễn Văn Toán', 50),
  ('EN101', 'EN101-01', 'ThS. Mai Anh', 30),
  ('PE101', 'PE101-01', 'ThS. Lý Văn Khỏe', 60)
) AS v(course_code, section_code, lecturer_name, capacity)
JOIN courses c ON c.code = v.course_code
JOIN semesters s ON s.code = '2026-1';

-- 9. Lịch học (khớp các kịch bản trùng lịch trong user-stories.md)
INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room)
SELECT sec.id, v.day, v.start_p, v.end_p, v.room
FROM (VALUES
  ('MA101-01', 1, 1, 3, 'A101'),   -- Thứ Hai tiết 1-3
  ('CS201-01', 1, 2, 4, 'B201'),   -- Thứ Hai tiết 2-4: trùng với MA101-01
  ('CS201-02', 1, 4, 6, 'B202'),   -- Thứ Hai tiết 4-6: liền kề MA101-01, không trùng
  ('CS201-03', 2, 1, 3, 'B203'),   -- Thứ Ba tiết 1-3: khác thứ, không trùng
  ('CS101-01', 2, 7, 9, 'C101'),
  ('CS101-02', 5, 1, 3, 'C102'),   -- Thứ Sáu tiết 1-3: trùng buổi thứ Sáu của EN101-01
  ('CS301-01', 4, 1, 3, 'B301'),
  ('CS202-01', 3, 7, 9, 'C201'),
  ('CS210-01', 3, 1, 3, 'A201'),
  ('CS220-01', 5, 4, 6, 'C220'),
  ('CS230-01', 4, 7, 9, 'B230'),
  ('CS310-01', 5, 7, 9, 'B310'),
  ('MA201-01', 6, 4, 6, 'A301'),
  ('EN101-01', 3, 4, 5, 'D101'),
  ('EN101-01', 5, 1, 2, 'D101'),   -- lớp học 2 buổi một tuần
  ('PE101-01', 7, 1, 2, 'San 1')
) AS v (section_code, day, start_p, end_p, room)
JOIN sections sec ON sec.code = v.section_code;


-- 10. Kết quả học tập
-- std_402: đã đạt CS101 (đủ điều kiện CS201). Kịch bản chuỗi tiên quyết CS301 tự thêm kết quả CS201 khi test.
-- std_501: rớt CS101 (điểm 4.0); std_500, std_700: chưa học gì
-- std_101 .. std_260, std_610, std_611: đã đạt CS101 (đủ điều kiện đăng ký CS201)
INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
SELECT st.id, c.id, '2025-2', v.grade, v.grade >= 5.0
FROM (VALUES
  ('std_402', 'CS101', 8.0),
  ('std_501', 'CS101', 4.0),
  ('std_610', 'CS101', 7.0),
  ('std_611', 'CS101', 6.5)
) AS v (student_code, course_code, grade)
JOIN students st ON st.student_code = v.student_code
JOIN courses c ON c.code = v.course_code;
 
INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
SELECT st.id, c.id, '2025-2', 7.0, TRUE
FROM students st
JOIN courses c ON c.code = 'CS101'
WHERE st.student_code BETWEEN 'std_101' AND 'std_260';


-- 11. Dang ky hoc phan co san.

-- std_402 dang hoc MA101-01 (Thu Hai tiet 1-3).
-- Dung de kiem thu trung lich va thoi khoa bieu.
INSERT INTO enrolments (student_id, section_id)
SELECT st.id, sec.id
FROM students st, sections sec
WHERE st.student_code = 'std_402'
  AND sec.code = 'MA101-01';

-- CS210-01: 39/40 sinh vien, con dung 1 cho.
INSERT INTO enrolments (student_id, section_id)
SELECT st.id, sec.id
FROM students st, sections sec
WHERE sec.code = 'CS210-01'
  AND st.student_code BETWEEN 'std_101' AND 'std_139';

-- EN101-01: 30/30 sinh vien, lop da day.
INSERT INTO enrolments (student_id, section_id)
SELECT st.id, sec.id
FROM students st, sections sec
WHERE sec.code = 'EN101-01'
  AND st.student_code BETWEEN 'std_140' AND 'std_169';

-- 12. Dong bo so luong sinh vien da dang ky.
UPDATE sections sec
SET enrolled_count = (
  SELECT COUNT(*)
  FROM enrolments e
  WHERE e.section_id = sec.id
    AND e.status = 'ENROLLED'
);
-- 13. Tao danh sach cho cho lop EN101-01.
-- Thu tu: std_610, std_611, std_170.
INSERT INTO waitlist_entries (student_id, section_id, created_at)
SELECT st.id, sec.id, now() - v.ago
FROM (VALUES
  ('std_610', interval '3 hours'),
  ('std_611', interval '2 hours'),
  ('std_170', interval '1 hour')
) AS v (student_code, ago)
JOIN students st ON st.student_code = v.student_code
JOIN sections sec ON sec.code = 'EN101-01';

-- Ket thuc giao dich Seed P2.
COMMIT;

 
