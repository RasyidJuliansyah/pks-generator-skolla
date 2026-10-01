-- Dua perubahan, keduanya lahir dari keputusan "satu sekolah dipegang satu Sales".

-- ── migrasi 1: sekolah_dipegang_satu_sales ───────────────────────────────────
-- Sebelum ini tabel `sekolah` terlihat oleh setiap pemegang peran dan bisa
-- disunting seluruh keluarga sales — terbukti lewat simulasi: Sales A menimpa
-- data sekolah milik Sales B.
--
-- Penegakan "satu sekolah satu sales" bertumpu pada indeks unik parsial yang
-- SUDAH ada di NPSN. Alurnya: Sales B tidak melihat sekolah milik A, jadi
-- pencarian NPSN di simpanDraf tidak menemukan apa pun, lalu penyisipannya
-- ditolak indeks unik itu (23505). Aplikasi menerjemahkannya jadi kalimat yang
-- bisa dibaca — tanpa itu yang sampai ke Sales cuma galat basis data.
--
-- CATATAN: jaminannya sekuat NPSN. Sekolah yang dibuat TANPA NPSN masih bisa
-- terduplikasi dengan pemegang berbeda. Mewajibkan NPSN keputusan proses, bukan
-- teknis, jadi tidak diambil di sini.
alter table sekolah add column if not exists dipegang_oleh text references pengguna(email);

update sekolah s set dipegang_oleh = (
  select p.dibuat_oleh from po p where p.sekolah_id = s.id order by p.dibuat_pada limit 1)
 where dipegang_oleh is null;

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
-- Sales bisa — itu mekanisme serah terima saat ada sales pindah.
create policy sekolah_ubah on sekolah for update to authenticated
  using (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
     and private.boleh_lihat_sekolah(dipegang_oleh))
  with check (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
     and (dipegang_oleh = lower(auth.jwt() ->> 'email')
          or private.punya_peran('head_of_sales', 'admin_sales')));

-- ── migrasi 2: riwayat_perpindahan_status_po ─────────────────────────────────
-- Siapa memverifikasi, siapa memfinalisasi, siapa menandatangani — semua SUDAH
-- tersimpan, tersebar di lima tabel. Yang TIDAK tersimpan: perpindahan status
-- itu sendiri. Siapa mengirim PO untuk ditandatangani, siapa menariknya kembali
-- ke draf — tidak ada kolomnya di mana pun, padahal itu yang paling sering
-- ditanyakan saat sebuah PO tersendat.
create table if not exists po_riwayat (
  id bigint generated always as identity primary key,
  po_id uuid not null references po(id) on delete cascade,
  status_lama status_po,
  status_baru status_po not null,
  versi int not null,
  oleh text,
  pada timestamptz not null default now()
);
create index if not exists po_riwayat_po on po_riwayat (po_id, pada);

-- Pola yang sama dengan pengguna_riwayat: HANYA kebijakan SELECT. Tanpa
-- kebijakan tulis, PostgREST tidak bisa menyisipkan riwayat palsu maupun
-- menghapus yang memberatkan.
alter table po_riwayat enable row level security;
drop policy if exists po_riwayat_lihat on po_riwayat;
create policy po_riwayat_lihat on po_riwayat for select to authenticated
  using (exists (select 1 from po p where p.id = po_riwayat.po_id
                  and private.boleh_lihat_po(p.dibuat_oleh)));

-- Kenaikan `versi` ikut dicatat meski statusnya tidak berubah: itu penanda PO
-- direvisi saat masih draf, dan itulah yang menjelaskan kenapa persetujuan
-- sebuah fungsi tiba-tiba basi.
create or replace function private.catat_riwayat_po() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if TG_OP = 'INSERT' then
    insert into po_riwayat(po_id, status_baru, versi, oleh)
    values (NEW.id, NEW.status, NEW.versi, lower(auth.jwt() ->> 'email'));
  elsif NEW.status is distinct from OLD.status or NEW.versi is distinct from OLD.versi then
    insert into po_riwayat(po_id, status_lama, status_baru, versi, oleh)
    values (NEW.id, OLD.status, NEW.status, NEW.versi, lower(auth.jwt() ->> 'email'));
  end if;
  return NEW;
end $fn$;
drop trigger if exists po_catat on po;
create trigger po_catat after insert or update on po
  for each row execute function private.catat_riwayat_po();

-- PO yang sudah ada diberi satu baris pembuka supaya lini masanya tidak kosong.
-- Perpindahan status sebelum trigger ini terpasang memang hilang, dan tidak ada
-- gunanya mengarang ulang: yang tercatat harus yang benar-benar terjadi.
insert into po_riwayat(po_id, status_baru, versi, oleh, pada)
select p.id, p.status, p.versi, p.dibuat_oleh, p.dibuat_pada
  from po p
 where not exists (select 1 from po_riwayat r where r.po_id = p.id);
