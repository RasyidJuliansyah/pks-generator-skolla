-- Formulir PO memilih Partnership Manager dan Sales Manager dari daftar yang
-- sama, padahal keduanya jabatan berbeda: PM diisi pemegang peran `sales`, SM
-- diisi pemegang peran `head_of_sales`. Tanpa penyaring, siapa pun bisa terpilih
-- sebagai penanda tangan mana pun.
--
-- Penyaringnya opsional supaya pemakai lama tidak berubah: /analitik memetakan
-- email sales jadi nama untuk SELURUH akun, dan halaman Surat mencari nama
-- penutup verifikasi yang bisa siapa saja.
--
-- Membaca kolom `peran` LANGSUNG, bukan lewat private.punya_peran(): fungsi itu
-- meloloskan Super Admin untuk peran apa pun karena ia dipakai untuk MENGIZINKAN.
-- Di sini pertanyaannya "siapa yang memegang peran ini", dan Super Admin bukan
-- Partnership Manager.
--
-- Fungsi lama yang tanpa argumen dihapus supaya PostgREST tidak menghadapi dua
-- kelebihan beban yang ambigu. Argumen barunya berdefault null, jadi pemanggilan
-- tanpa argumen tetap teratasi — aman dipasang sebelum maupun sesudah kodenya.
drop function if exists public.daftar_penanda_tangan();

create or replace function public.daftar_penanda_tangan(p_peran peran[] default null)
returns table(email text, nama text)
language sql stable security definer set search_path to 'public' as $fn$
  select p.email, p.nama
    from pengguna p
   where p.aktif
     and private.peran_saya() <> '{}'::peran[]
     and (p_peran is null or p.peran && p_peran)
   order by p.nama;
$fn$;

-- Disamakan dengan lima fungsi lain di skema ini: hanya pengguna yang sudah
-- masuk. Fungsi lama pun begitu; defaultnya perlu dipasang ulang karena
-- fungsinya baru.
revoke execute on function public.daftar_penanda_tangan(peran[]) from public, anon;
