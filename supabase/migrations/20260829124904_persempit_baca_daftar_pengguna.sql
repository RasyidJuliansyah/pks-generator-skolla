-- Sebelumnya siapa pun yang terdaftar bisa membaca SELURUH tabel pengguna,
-- termasuk peran tiap orang. Yang sebenarnya dibutuhkan hanya nama dan alamat
-- akun aktif, untuk dropdown penanda tangan di form PO.
--
-- RLS bekerja per baris, bukan per kolom, jadi kolom `peran` tidak bisa
-- disembunyikan lewat kebijakan. Karena itu tabelnya ditutup dan kebutuhan yang
-- sah dilayani fungsi yang hanya mengembalikan dua kolom itu — pola yang sama
-- dengan alasan pricelist tidak pernah masuk basis data.
drop policy pengguna_lihat on pengguna;

create policy pengguna_lihat_sendiri on pengguna for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

/** Nama dan alamat akun aktif, untuk pilihan penanda tangan. Tanpa peran. */
create or replace function public.daftar_penanda_tangan()
returns table (email text, nama text)
language sql security definer stable
set search_path = public
as $$
  select p.email, p.nama
    from pengguna p
   where p.aktif and private.peran_saya() <> '{}'::peran[]
   order by p.nama;
$$;

revoke all on function public.daftar_penanda_tangan() from public, anon;
grant execute on function public.daftar_penanda_tangan() to authenticated;
