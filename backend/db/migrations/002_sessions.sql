-- Migration 002: phiên đăng nhập lưu trong PostgreSQL.
-- Cookie "sid" trên trình duyệt chứa id của một dòng trong bảng này.

CREATE TABLE sessions (
  id         VARCHAR(64) PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at); 