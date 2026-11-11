#!/bin/sh
# Chạy tự động MỘT LẦN khi PostgreSQL trong Docker tạo CSDL mới (volume còn trống):
# tạo bảng từ các file migration, rồi nạp dữ liệu mẫu.
# Muốn chạy lại từ đầu: docker compose down -v && docker compose up -d db
set -e
DB_DIR="${DB_DIR:-/db}"

for file in "$DB_DIR"/migrations/*.sql "$DB_DIR"/seeds/*.sql; do
  [ -f "$file" ] || continue
  echo "Running $file"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
done
