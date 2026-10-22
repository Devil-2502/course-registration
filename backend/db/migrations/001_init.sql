
-- Migration 001: schema ban đầu theo docs/erd/README.md.
-- Chạy tự động khi tạo CSDL lần đầu bằng docker compose
-- (thư mục này gắn vào /docker-entrypoint-initdb.d).

-- 1. Tài khoản và sinh viên
CREATE TABLE users (
  id            BIGSERIAL    PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(200) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('STUDENT', 'ADMIN')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      BIGINT       NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  student_code VARCHAR(20)  NOT NULL UNIQUE,
  program      VARCHAR(100)
);

-- 2. Học kỳ
CREATE TABLE semesters (
  id                 BIGSERIAL    PRIMARY KEY,
  code               VARCHAR(20)  NOT NULL UNIQUE,
  name               VARCHAR(100) NOT NULL,
  registration_start TIMESTAMPTZ  NOT NULL,
  registration_end   TIMESTAMPTZ  NOT NULL,
  max_credits        INT          NOT NULL DEFAULT 24 CHECK (max_credits > 0),
  CHECK (registration_end > registration_start)
);

-- 3. Môn học và quan hệ tiên quyết
CREATE TABLE courses (
  id          BIGSERIAL    PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  name        VARCHAR(200) NOT NULL,
  credits     INT          NOT NULL CHECK (credits > 0),
  description TEXT
);

CREATE TABLE prerequisites (
  course_id       BIGINT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  prerequisite_id BIGINT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, prerequisite_id),
  CHECK (course_id <> prerequisite_id)
);

-- 4. Lớp học phần và lịch học
CREATE TABLE sections (
  id             BIGSERIAL    PRIMARY KEY,
  course_id      BIGINT       NOT NULL REFERENCES courses (id),
  semester_id    BIGINT       NOT NULL REFERENCES semesters (id),
  code           VARCHAR(30)  NOT NULL,
  lecturer_name  VARCHAR(200),
  capacity       INT          NOT NULL CHECK (capacity > 0),
  enrolled_count INT          NOT NULL DEFAULT 0,
  UNIQUE (course_id, semester_id, code),
  CONSTRAINT sections_enrolled_count_check
    CHECK (enrolled_count >= 0 AND enrolled_count <= capacity)
);

CREATE TABLE section_slots (
  id           BIGSERIAL   PRIMARY KEY,
  section_id   BIGINT      NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  day_of_week  SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_period SMALLINT    NOT NULL,
  end_period   SMALLINT    NOT NULL,
  room         VARCHAR(50),
  CHECK (start_period >= 1 AND end_period >= start_period AND end_period <= 15)
);

-- 5. Đăng ký, hàng chờ, kết quả học
CREATE TABLE enrolments (
  id         BIGSERIAL   PRIMARY KEY,
  student_id BIGINT      NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  section_id BIGINT      NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'ENROLLED'
             CHECK (status IN ('ENROLLED', 'DROPPED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped_at TIMESTAMPTZ
);

CREATE TABLE waitlist_entries (
  id         BIGSERIAL   PRIMARY KEY,
  student_id BIGINT      NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  section_id BIGINT      NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'WAITING'
             CHECK (status IN ('WAITING', 'PROMOTED', 'SKIPPED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE completed_courses (
  id            BIGSERIAL    PRIMARY KEY,
  student_id    BIGINT       NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  course_id     BIGINT       NOT NULL REFERENCES courses (id),
  semester_code VARCHAR(20)  NOT NULL,
  grade         NUMERIC(4,2) NOT NULL CHECK (grade BETWEEN 0 AND 10),
  passed        BOOLEAN      NOT NULL,
  UNIQUE (student_id, course_id, semester_code)
);

-- 6. Chỉ mục duy nhất có điều kiện
CREATE UNIQUE INDEX uq_enrolments_active
  ON enrolments (student_id, section_id)
  WHERE status = 'ENROLLED';

CREATE UNIQUE INDEX uq_waitlist_waiting
  ON waitlist_entries (student_id, section_id)
  WHERE status = 'WAITING';

-- 7. Chỉ mục cho các truy vấn thường dùng
CREATE INDEX idx_courses_name ON courses (name);
CREATE INDEX idx_sections_semester_course ON sections (semester_id, course_id);
CREATE INDEX idx_section_slots_section ON section_slots (section_id);
CREATE INDEX idx_enrolments_student_status ON enrolments (student_id, status);
CREATE INDEX idx_enrolments_section_status ON enrolments (section_id, status);
CREATE INDEX idx_waitlist_section_status_created
  ON waitlist_entries (section_id, status, created_at);
CREATE INDEX idx_completed_student_course
  ON completed_courses (student_id, course_id);
CREATE INDEX idx_prerequisites_prerequisite
  ON prerequisites (prerequisite_id);
