-- Migration 003: yêu cầu đổi lớp (cải tiến 2, US-15).
-- Sinh viên đang học một lớp xin sang lớp khác của cùng môn. Viết IF NOT EXISTS để chạy lại an toàn
-- trên CSDL đã có bảng (test Playwright chạy lại các migration từ 003 trở đi).

CREATE TABLE IF NOT EXISTS swap_requests (
  id                 BIGSERIAL   PRIMARY KEY,
  student_id         BIGINT      NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  from_section_id    BIGINT      NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  to_section_id      BIGINT      NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  -- OPEN: đang chờ người đổi ngược; COMPLETED: đã đổi xong; CANCELLED: sinh viên hủy hoặc hết hiệu lực
  status             VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
  -- Cách hoàn tất: MOVED (lớp mới còn chỗ, chuyển thẳng) hoặc SWAPPED (đổi chéo với một yêu cầu ngược)
  outcome            VARCHAR(20) CHECK (outcome IN ('MOVED', 'SWAPPED')),
  partner_request_id BIGINT      REFERENCES swap_requests (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ,
  CHECK (from_section_id <> to_section_id),
  CHECK ((status = 'COMPLETED') = (outcome IS NOT NULL))
);

-- Mỗi lớp đang học chỉ có tối đa một yêu cầu đang chờ.
CREATE UNIQUE INDEX IF NOT EXISTS uq_swap_requests_open
  ON swap_requests (student_id, from_section_id)
  WHERE status = 'OPEN';

-- Tìm yêu cầu ngược chiều theo thứ tự đến trước.
CREATE INDEX IF NOT EXISTS idx_swap_requests_match
  ON swap_requests (from_section_id, to_section_id, status, created_at);
