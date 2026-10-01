-- C Level hanya ditambahkan ke dua fungsi PEMBACAAN. Itu saja yang diperlukan:
-- setiap jalur tulis di sistem ini menyebut perannya secara eksplisit — sales,
-- head_of_sales, admin_sales, tech_ops_lead, keempat fungsi verifikasi, atau
-- admin_utama — jadi peran yang tidak disebut di mana pun otomatis tidak bisa
-- menulis apa pun. Sifat baca-saja itu lahir dari bentuknya, bukan dari daftar
-- larangan yang harus dijaga tetap lengkap.
--
-- Sudah diuji dengan tujuh belas probe: melihat seluruh PO, sekolah, berkas
-- tanda tangan, draf PKS, dan harga Acquisition; ditolak saat mencoba menyunting
-- PO, membuat PO, menghapus PO, memberi verifikasi, menyunting sekolah,
-- membubuhkan tanda tangan, menerbitkan Surat, membuat maupun membatalkan PKS,
-- dan menaikkan perannya sendiri.
--
-- Tabel `pengguna` dan `pengguna_riwayat` sengaja TETAP tertutup: keduanya milik
-- Super Admin, dan "melihat semuanya" di sini berarti seluruh alur kerja sama —
-- bukan daftar siapa boleh apa.
create or replace function private.boleh_lihat_semua() returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.punya_peran(
    'head_of_sales', 'head_of_operations', 'cbo', 'c_level', 'admin_utama', 'admin_sales',
    'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead'
  );
$fn$;

-- Harga Acquisition ikut terlihat. Ini keputusan yang pantas ditinjau, bukan
-- disisipkan diam-diam: angka itu lantai internal yang paling sensitif di
-- seluruh sistem. Alasannya, C Level justru pihak yang menetapkan strategi
-- harganya. Kalau tidak dikehendaki, cabut 'c_level' dari baris di bawah — satu
-- kata, dan tidak ada yang lain ikut berubah.
create or replace function private.boleh_lihat_acquisition() returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.punya_peran('cbo', 'c_level', 'admin_utama', 'head_of_operations', 'finance');
$fn$;
