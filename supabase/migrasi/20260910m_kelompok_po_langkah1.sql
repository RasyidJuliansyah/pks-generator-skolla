-- Langkah 1 dari catatan/07-spesifikasi-kelompok-po.md: kolom kelompok, tanpa
-- perubahan perilaku.
--
-- `default 1` membuat migrasi ini tidak menyentuh PO lama sama sekali: seluruh rombel
-- dan komponennya jatuh ke kelompok 1, dan hasilnya identik dengan kemarin. Dijaga
-- uji/emas.test.mjs — Form PO, Surat, PKS, dan harga tiga PO contoh direkam SEBELUM
-- perubahan dan harus keluar sama byte per byte.
--
-- KENAPA DIKUNCI KE 1 SAMPAI LANGKAH 3
--
-- Kolomnya ada, tapi `check (kelompok = 1)` menutupnya. Tanpa kunci ini, peran sales
-- bisa menulis kelompok 2 lewat PostgREST sekarang juga — sementara
-- `private.lantai_siswa()` masih menjumlah SEMUA komponen PO tanpa memisahkan
-- kelompok, dan `po_komponen` masih berkunci (po_id, komponen_id). Spesifikasi 07
-- mensyaratkan lantai per kelompok masuk DI PEKERJAAN YANG SAMA dengan pelebaran
-- permukaannya, bukan menyusul. Maka pintunya dibuka di langkah 3, bersama lantainya:
-- constraint `*_kelompok_satu_dulu` dilepas, kunci primer `po_komponen` diperluas
-- dengan `kelompok`, dan `lantai_siswa()` dihitung per kelompok.
--
-- `po_kelompok` (nama dan harga per kelompok) juga BELUM dibuat. Tabel itu hanya punya
-- arti kalau ada yang menulisnya; membuatnya sekarang berarti setiap PO baru lahir
-- tanpa baris kelompok sampai langkah 3 — keadaan tidak konsisten yang harus
-- dijelaskan ke siapa pun yang membacanya. Ia datang bersama kode yang mengisinya.

alter table po_rombel   add column if not exists kelompok smallint not null default 1;
alter table po_komponen add column if not exists kelompok smallint not null default 1;

alter table po_rombel   drop constraint if exists po_rombel_kelompok_satu_dulu;
alter table po_rombel   add  constraint po_rombel_kelompok_satu_dulu   check (kelompok = 1);
alter table po_komponen drop constraint if exists po_komponen_kelompok_satu_dulu;
alter table po_komponen add  constraint po_komponen_kelompok_satu_dulu check (kelompok = 1);
