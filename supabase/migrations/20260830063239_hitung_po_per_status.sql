-- Chip jumlah per status di Daftar PO selama ini dihitung dari baris yang sudah
-- terambil. Begitu daftarnya dipaginasi, angka itu cuma menghitung halaman yang
-- sedang terbuka — "3 Draf" padahal ada 47, tanpa apa pun yang menandakan.
--
-- SECURITY INVOKER (bawaan), BUKAN DEFINER: hitungannya harus tunduk pada RLS
-- pemanggilnya, supaya Sales biasa hanya menghitung PO miliknya sendiri. Sudah
-- diuji dengan dua akun sales — A melihat 3, B melihat 1 dari kumpulan yang sama.
create or replace function public.hitung_po_per_status()
returns table(status status_po, jumlah bigint)
language sql stable set search_path to 'public' as $fn$
  select p.status, count(*) from po p group by p.status;
$fn$;
