-- Admin Utama jadi Super Admin: berwenang atas segala hal yang bergantung peran,
-- termasuk memberi keputusan verifikasi. Keputusan Rizki 2026-08-30.
--
-- Diterapkan di SATU tempat, bukan dengan menyisipkan 'admin_utama' ke belasan
-- daftar peran di kebijakan dan fungsi. Menyebarkannya berarti cepat atau lambat
-- ada satu yang terlewat, dan yang terlewat itu tidak akan kelihatan sampai ada
-- yang mengeluh tidak bisa mengerjakan sesuatu.
--
-- CATATAN untuk pembaca berikutnya: setelah ini `punya_peran('sales')` bernilai
-- benar bagi Super Admin yang bukan sales. Itu disengaja — fungsi ini dipakai
-- untuk MENGIZINKAN, tidak pernah untuk menjawab "peran orang ini apa". Kalau
-- suatu saat butuh yang kedua, baca `private.peran_saya()` langsung.
--
-- Yang TIDAK ikut terbuka: aturan integritas yang berlaku bagi semua orang tanpa
-- memandang peran — pembekuan isi PO yang sudah ditandatangani, dan syarat empat
-- lampu hijau sebelum sebuah PO dinyatakan terverifikasi. Keduanya trigger, bukan
-- pemeriksaan peran, jadi Super Admin pun tetap tunduk. Sudah diuji.
create or replace function private.punya_peran(variadic dicari peran[])
returns boolean language sql stable set search_path to 'public' as $fn$
  select private.peran_saya() && dicari
      or 'admin_utama' = any(private.peran_saya());
$fn$;

-- Karena Super Admin bisa memberi peran apa pun kepada siapa pun — termasuk
-- kepada dirinya sendiri, lalu mencabutnya lagi — pemisahan tugas hanya berarti
-- kalau perubahannya meninggalkan jejak. Keputusan verifikasi memang menyimpan
-- `oleh`, tapi pemberian perannya selama ini tidak tercatat sama sekali.
create table if not exists pengguna_riwayat (
  id bigint generated always as identity primary key,
  email text not null,
  aksi text not null check (aksi in ('tambah', 'ubah', 'hapus')),
  peran_lama peran[], peran_baru peran[],
  nama_lama text,     nama_baru text,
  aktif_lama boolean, aktif_baru boolean,
  oleh text,
  pada timestamptz not null default now()
);
create index if not exists pengguna_riwayat_pada on pengguna_riwayat (pada desc);

-- HANYA kebijakan SELECT yang ada, dan itu disengaja: tanpa kebijakan tulis,
-- PostgREST tidak bisa menyisipkan, mengubah, maupun menghapus satu baris pun.
-- Yang mengisinya cuma trigger di bawah, yang berjalan SECURITY DEFINER. Jadi
-- Super Admin bisa membaca riwayatnya, tapi tidak bisa merapikannya.
alter table pengguna_riwayat enable row level security;
drop policy if exists riwayat_lihat on pengguna_riwayat;
create policy riwayat_lihat on pengguna_riwayat for select to authenticated
  using (private.punya_peran('admin_utama'));

create or replace function private.catat_riwayat_pengguna()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if TG_OP = 'INSERT' then
    insert into pengguna_riwayat(email, aksi, peran_baru, nama_baru, aktif_baru, oleh)
    values (NEW.email, 'tambah', NEW.peran, NEW.nama, NEW.aktif, lower(auth.jwt() ->> 'email'));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into pengguna_riwayat(email, aksi, peran_lama, nama_lama, aktif_lama, oleh)
    values (OLD.email, 'hapus', OLD.peran, OLD.nama, OLD.aktif, lower(auth.jwt() ->> 'email'));
    return OLD;
  end if;
  -- Hanya perubahan yang berarti yang dicatat; menyimpan ulang nilai yang sama
  -- tidak perlu meninggalkan baris.
  if (NEW.peran, NEW.nama, NEW.aktif) is distinct from (OLD.peran, OLD.nama, OLD.aktif) then
    insert into pengguna_riwayat(email, aksi, peran_lama, peran_baru,
                                 nama_lama, nama_baru, aktif_lama, aktif_baru, oleh)
    values (NEW.email, 'ubah', OLD.peran, NEW.peran, OLD.nama, NEW.nama,
            OLD.aktif, NEW.aktif, lower(auth.jwt() ->> 'email'));
  end if;
  return NEW;
end $fn$;
drop trigger if exists pengguna_catat on pengguna;
create trigger pengguna_catat after insert or update or delete on pengguna
  for each row execute function private.catat_riwayat_pengguna();
