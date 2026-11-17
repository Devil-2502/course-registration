-- Dữ liệu demo cho đổi lớp an toàn (cải tiến 2).
-- Test Playwright chỉ nạp 001_seed.sql nên không bị ảnh hưởng; Docker nạp cả file này.
--
-- CS101-01 (thứ Ba tiết 7-9): sức chứa 2, có std_500 và std_700 -> đầy
-- CS101-02 (thứ Sáu tiết 1-3): sức chứa 1, có std_501 -> đầy
-- std_501 đã xin đổi CS101-02 -> CS101-01 và đang chờ người đổi ngược.
-- Demo: đăng nhập std_500, Môn đã đăng ký, Đổi lớp CS101-01 -> CS101-02: hệ thống đổi chéo với std_501.

UPDATE sections SET capacity = 2 WHERE code = 'CS101-01';
UPDATE sections SET capacity = 1 WHERE code = 'CS101-02';

INSERT INTO enrolments (student_id, section_id)
SELECT st.id, sec.id
FROM (VALUES
  ('std_500', 'CS101-01'),
  ('std_700', 'CS101-01'),
  ('std_501', 'CS101-02')
) AS v (student_code, section_code)
JOIN students st ON st.student_code = v.student_code
JOIN sections sec ON sec.code = v.section_code;

UPDATE sections sec
SET enrolled_count = (
  SELECT COUNT(*) FROM enrolments e WHERE e.section_id = sec.id AND e.status = 'ENROLLED'
)
WHERE sec.code IN ('CS101-01', 'CS101-02');

INSERT INTO swap_requests (student_id, from_section_id, to_section_id, created_at)
SELECT st.id, f.id, t.id, now() - interval '1 hour'
FROM students st, sections f, sections t
WHERE st.student_code = 'std_501' AND f.code = 'CS101-02' AND t.code = 'CS101-01';
