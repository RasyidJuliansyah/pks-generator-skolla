/**
 * Menjaga agar sistem tidak pernah kehilangan Admin Utama.
 *
 * Ditaruh sebagai trigger, bukan pemeriksaan di halaman: halaman bisa dilewati,
 * dan kehilangan admin terakhir berarti tidak ada lagi yang bisa memulihkan
 * akses siapa pun — termasuk dirinya sendiri.
 *
 * Menurunkan atau menonaktifkan diri sendiri juga ditolak. Bukan karena
 * berbahaya secara sistem, tapi karena itu kekeliruan yang tidak bisa
 * dibatalkan sendiri: pemulihannya harus lewat admin lain.
 */
create or replace function private.jaga_admin_utama()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  saya text := lower(auth.jwt() ->> 'email');
  tersisa int;
begin
  if TG_OP = 'UPDATE' and NEW.email = saya then
    if ('admin_utama' = any(OLD.peran)) and not ('admin_utama' = any(NEW.peran)) then
      raise exception 'Peran Admin Utama tidak bisa dicabut dari akun sendiri. Minta Admin Utama lain melakukannya.';
    end if;
    if OLD.aktif and not NEW.aktif then
      raise exception 'Akun sendiri tidak bisa dinonaktifkan.';
    end if;
  end if;

  select count(*) into tersisa
    from pengguna
   where aktif and 'admin_utama' = any(peran)
     and email <> coalesce(OLD.email, '');

  if TG_OP = 'DELETE' then
    if 'admin_utama' = any(OLD.peran) and OLD.aktif and tersisa = 0 then
      raise exception 'Admin Utama terakhir tidak bisa dihapus.';
    end if;
    return OLD;
  end if;

  if NEW.aktif and 'admin_utama' = any(NEW.peran) then
    return NEW;  -- masih ada admin: yang ini sendiri
  end if;
  if tersisa = 0 then
    raise exception 'Sistem harus punya minimal satu Admin Utama yang aktif.';
  end if;
  return NEW;
end;
$$;

create trigger jaga_admin_utama
  before update or delete on pengguna
  for each row execute function private.jaga_admin_utama();

-- Nama wajib: dipakai sebagai penanda tangan di PO dan surat, dan baris tanpa
-- nama akan tampil sebagai alamat surel di dokumen resmi.
update pengguna set nama = split_part(email, '@', 1) where nama is null or btrim(nama) = '';
alter table pengguna add constraint pengguna_nama_terisi
  check (nama is not null and btrim(nama) <> '');
