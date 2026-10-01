-- Satu sekolah dipegang tepat satu Sales, dan Sales hanya melihat sekolah yang
-- dipegangnya. Keputusan Rizki 2026-08-30.
--
-- Sebelum ini tabel `sekolah` terlihat oleh setiap pemegang peran dan bisa
-- disunting seluruh keluarga sales — terbukti lewat simulasi: Sales A menimpa
-- data sekolah milik Sales B.
--
-- Penegakan "satu sekolah satu sales" bertumpu pada indeks unik parsial yang
-- SUDAH ada di NPSN. Alurnya: Sales B tidak melihat sekolah milik A, jadi
-- pencarian lewat NPSN di simpanDraf tidak menemukan apa pun, lalu penyisipannya
-- ditolak indeks unik itu (23505). Aplikasi menerjemahkannya jadi kalimat yang
-- bisa dibaca — tanpa itu, Sales cuma melihat galat basis data.
--
-- CATATAN: jaminannya sekuat NPSN. Sekolah yang dibuat TANPA NPSN masih bisa
-- terduplikasi dengan pemegang berbeda. Mewajibkan NPSN adalah keputusan proses,
-- bukan teknis, jadi tidak diambil di sini.
alter table sekolah add column if not exists dipegang_oleh text references pengguna(email);

-- Sekolah yang sudah ada dipegang Sales pembuat PO pertamanya.
update sekolah s set dipegang_oleh = (
  select p.dibuat_oleh from po p where p.sekolah_id = s.id order by p.dibuat_pada limit 1)
 where dipegang_oleh is null;

-- Diisi trigger, bukan kode aplikasi: kalau bergantung pada satu jalur simpan,
-- sekolah yang lahir dari jalur lain akan punya pemegang kosong dan diam-diam
-- tak terlihat siapa pun kecuali pengawas.
create or replace function private.pegang_sekolah() returns trigger
language plpgsql set search_path to 'public' as $fn$
begin
  if NEW.dipegang_oleh is null then
    NEW.dipegang_oleh := lower(auth.jwt() ->> 'email');
  end if;
  return NEW;
end $fn$;
drop trigger if exists sekolah_pegang on sekolah;
create trigger sekolah_pegang before insert on sekolah
  for each row execute function private.pegang_sekolah();

-- Cerminan private.boleh_lihat_po: pengawas dan verifikator melihat semuanya —
-- verifikator memang perlu, karena menilai kesiapan sekolahnya — sementara Sales
-- biasa hanya melihat yang dipegangnya.
create or replace function private.boleh_lihat_sekolah(pemegang text) returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.boleh_lihat_semua()
      or pemegang = lower(auth.jwt() ->> 'email');
$fn$;

drop policy if exists sekolah_lihat on sekolah;
drop policy if exists sekolah_buat on sekolah;
drop policy if exists sekolah_ubah on sekolah;

create policy sekolah_lihat on sekolah for select to authenticated
  using (private.boleh_lihat_sekolah(dipegang_oleh));

create policy sekolah_buat on sekolah for insert to authenticated
  with check (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
    and (dipegang_oleh is null
         or dipegang_oleh = lower(auth.jwt() ->> 'email')
         or private.punya_peran('head_of_sales', 'admin_sales')));

-- WITH CHECK-nya yang menjaga pengalihan: Sales biasa tidak bisa melempar
-- sekolahnya ke orang lain maupun menarik milik orang. Head of Sales dan Admin
-- Sales bisa — dan itu memang mekanisme serah terima saat ada sales pindah.
create policy sekolah_ubah on sekolah for update to authenticated
  using (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
     and private.boleh_lihat_sekolah(dipegang_oleh))
  with check (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
     and (dipegang_oleh = lower(auth.jwt() ->> 'email')
          or private.punya_peran('head_of_sales', 'admin_sales')));
