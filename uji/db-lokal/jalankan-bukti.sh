#!/usr/bin/env bash
# Seluruh bukti empat penanda tangan dari nol (catatan/24 Tugas 2): basis data baru, P9
# dicatat sebelum migrasi, kedua migrasi 20260925* diterapkan, lalu P9 dibandingkan dan P1-P8(+P10).
set -euo pipefail
cd "$(dirname "$0")/../.."
uji/db-lokal/siapkan.sh >/dev/null
D="docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1"
$D -q -v mode=catat < uji/db-lokal/bukti-sidik.sql >/dev/null
$D -q -1 < supabase/migrations/20260925010000_empat_penanda_enum.sql
$D -q -1 < supabase/migrations/20260925020000_empat_penanda_tangan.sql
$D -v mode=banding < uji/db-lokal/bukti-sidik.sql 2>&1 | grep -E "NOTICE|ERROR"
$D < uji/db-lokal/bukti-empat-ttd.sql 2>&1 | grep -E "NOTICE|ERROR"
