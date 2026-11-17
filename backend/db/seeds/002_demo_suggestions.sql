-- Dữ liệu demo cho gợi ý thời khóa biểu (cải tiến 1).
-- Thêm lớp thứ hai cho vài môn để sinh viên có nhiều cách ghép lớp.
-- Test Playwright chỉ nạp 001_seed.sql nên không bị ảnh hưởng; Docker nạp cả file này.

INSERT INTO sections (course_id, semester_id, code, lecturer_name, capacity)
SELECT c.id, s.id, v.section_code, v.lecturer_name, v.capacity
FROM (VALUES
  ('CS202', 'CS202-02', 'ThS. Lê Thu Hà', 40),
  ('CS210', 'CS210-02', 'TS. Bùi Thị Lan', 40),
  ('CS220', 'CS220-02', 'TS. Ngô Đức Mạnh', 40),
  ('MA201', 'MA201-02', 'ThS. Nguyễn Văn Toán', 50),
  ('EN101', 'EN101-02', 'ThS. Mai Anh', 30),
  ('PE101', 'PE101-02', 'ThS. Lý Văn Khỏe', 60)
) AS v (course_code, section_code, lecturer_name, capacity)
JOIN courses c ON c.code = v.course_code
JOIN semesters s ON s.code = '2026-1';

INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room)
SELECT sec.id, v.day, v.start_p, v.end_p, v.room
FROM (VALUES
  ('CS202-02', 1, 7, 9, 'C202'),   -- Thứ Hai chiều: học cùng ngày với MA101-01
  ('CS210-02', 2, 4, 6, 'A202'),   -- Thứ Ba tiết 4-6
  ('CS220-02', 4, 7, 9, 'C221'),   -- Thứ Năm chiều
  ('MA201-02', 2, 1, 3, 'A302'),   -- Thứ Ba tiết 1-3: trùng CS201-03
  ('EN101-02', 3, 7, 8, 'D102'),   -- Thứ Tư chiều: trùng CS202-01
  ('EN101-02', 5, 7, 8, 'D102'),   -- lớp 2 buổi một tuần
  ('PE101-02', 4, 1, 2, 'San 2')   -- Thứ Năm sáng: thay cho PE101-01 Chủ nhật
) AS v (section_code, day, start_p, end_p, room)
JOIN sections sec ON sec.code = v.section_code;
