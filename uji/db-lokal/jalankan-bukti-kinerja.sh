#!/usr/bin/env bash
# Bukti migrasi kinerja RLS (20260927010000): skema produksi + migrasi sesudah dump, sidik policy
# dicatat, bukti RLS lama dijalankan (keluaran SEBELUM), migrasi diterapkan DUA KALI (idempoten),
# lalu sidik dibandingkan dan bukti RLS lama dijalankan lagi: keluarannya harus identik.
set -euo pipefail
cd "$(dirname "$0")/../.."
M="$PWD/supabase/migrations"
uji/db-lokal/siapkan.sh "$M"/20260925010000_empat_penanda_enum.sql "$M"/20260925020000_empat_penanda_tangan.sql \
  "$M"/20260926010000_gerbang_ekstraksi.sql "$M"/20260926020000_ekstraksi_po.sql \
  "$M"/20260926030000_konfirmasi_langkah.sql >/dev/null
D="docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
bukti_rls() {
  for f in bukti-gerbang-ekstraksi bukti-rpc-ekstraksi bukti-empat-ttd; do
    $D < "uji/db-lokal/$f.sql" 2>&1 | grep -E "NOTICE|ERROR|WARNING" | sed -E 's/^psql:[^:]*:[0-9]+: //'
  done
}
$D -q -v mode=catat < uji/db-lokal/bukti-kinerja-rls.sql >/dev/null
bukti_rls > "$T/sebelum.txt"
$D -q -1 < "$M"/20260927010000_kinerja_rls_indeks.sql
$D -q -1 < "$M"/20260927010000_kinerja_rls_indeks.sql
$D -v mode=banding < uji/db-lokal/bukti-kinerja-rls.sql 2>&1 | grep -E "NOTICE|ERROR|WARNING"
bukti_rls > "$T/sesudah.txt"
echo "bukti RLS lama: $(grep -c . "$T/sebelum.txt") baris sebelum, $(grep -c . "$T/sesudah.txt") sesudah"
diff "$T/sebelum.txt" "$T/sesudah.txt" && echo "K5 OK: keluaran bukti RLS lama identik sebelum/sesudah"
