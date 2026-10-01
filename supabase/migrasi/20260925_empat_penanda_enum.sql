-- Empat penanda tangan Form PO, bagian 1: nilai enum (catatan/23).
--
-- TERPISAH dari pemakaiannya karena nilai enum baru tidak bisa dipakai di transaksi yang
-- sama dengan penambahannya. Aditif: tidak ada baris yang berubah, dan nilai yang belum
-- dipakai tidak mengubah perilaku apa pun.
--
-- `regional_head` di pihak_ttd: kotak baru di antara Partnership Manager dan Head of Sales.
-- Head of Sales TIDAK mendapat nilai baru; ia tetap `sales_manager`, hanya labelnya berganti
-- di aplikasi (lib/pihak.ts), supaya tidak ada tanda tangan atau berkas yang dipindah.
alter type pihak_ttd add value if not exists 'regional_head' after 'partnership_manager';

-- Peran Regional Head Division: baca-saja pola c_level, diberikan lewat Kelola Pengguna.
alter type peran add value if not exists 'regional_head';
