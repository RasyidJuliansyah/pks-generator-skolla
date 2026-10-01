#!/usr/bin/env bash
# Bukti gerbang ekstraksi (catatan/25 Tugas 1): basis data baru berisi skema produksi, P9
# dicatat sebelum migrasi, migrasi diterapkan, lalu P9 dibandingkan dan probe gerbang dijalankan.
#
# Dua migrasi 20260925* ikut diterapkan LEBIH DULU, dan itu bukan hiasan: uji/db-lokal/skema.sql
# adalah dump skema 25 Sep 09:43, yaitu SEBELUM keduanya. Tanpa itu basis data lokal tidak sama
# dengan produksi -- tanpa po.skema_ttd, tanpa po.nama_rh, dan tanpa nilai enum regional_head --
# sehingga "bukti"-nya menguji medan yang di produksi sudah tidak ada lagi. Urutannya sekaligus
# mencerminkan urutan penerapan sungguhan: 20260925* sudah menyala di produksi, 20260926*
# menyusul sesudahnya.
#
# Tugas 2 dan Tugas 7 menambahkan migrasi dan berkas buktinya ke daftar di bawah saat tiba.
# Bagian yang belum ada TIDAK dilewati diam-diam: berkasnya belum ada, jadi barisnya belum
# ditulis -- bukti yang dilewati tanpa suara terbaca sebagai hijau, dan itu lebih buruk daripada
# tidak ada bukti.
set -euo pipefail
cd "$(dirname "$0")/../.."
uji/db-lokal/siapkan.sh >/dev/null
D="docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1"
$D -q -v mode=catat < uji/db-lokal/bukti-sidik.sql >/dev/null
$D -q -1 < supabase/migrations/20260925010000_empat_penanda_enum.sql
$D -q -1 < supabase/migrations/20260925020000_empat_penanda_tangan.sql
$D -q -1 < supabase/migrations/20260926010000_gerbang_ekstraksi.sql
$D -q -1 < supabase/migrations/20260926020000_ekstraksi_po.sql
$D -q -1 < supabase/migrations/20260926030000_konfirmasi_langkah.sql
$D -v mode=banding < uji/db-lokal/bukti-sidik.sql 2>&1 | grep -E "NOTICE|ERROR"
$D < uji/db-lokal/bukti-gerbang-ekstraksi.sql 2>&1 | grep -E "NOTICE|ERROR"
$D < uji/db-lokal/bukti-rpc-ekstraksi.sql 2>&1 | grep -E "NOTICE|ERROR"
