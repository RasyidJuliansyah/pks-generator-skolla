#!/usr/bin/env bash
# Postgres lokal berisi SKEMA produksi (tanpa data) untuk membuktikan migrasi (catatan/24).
# Pemakaian: uji/db-lokal/siapkan.sh [migrasi.sql ...]
#   lalu:    docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 < berkas.sql
set -euo pipefail
cd "$(dirname "$0")"
colima status >/dev/null 2>&1 || colima start
docker rm -f kerjasama-uji >/dev/null 2>&1 || true
docker run -d --name kerjasama-uji -e POSTGRES_PASSWORD=uji -p 55432:5432 postgres:17 >/dev/null
until docker exec kerjasama-uji pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2
[ -f skema.sql ] || (cd ../.. && supabase db dump --linked -s public,private -f uji/db-lokal/skema.sql)
psql() { docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql < stub.sql
psql < skema.sql
for m in "$@"; do echo "== $m"; psql -1 < "$m"; done
echo "siap: docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1"
