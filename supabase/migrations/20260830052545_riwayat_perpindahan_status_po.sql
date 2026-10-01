-- Siapa memverifikasi, siapa memfinalisasi, siapa menandatangani — semua itu
-- SUDAH tersimpan, tersebar di lima tabel: po.diverifikasi_oleh, verifikasi.oleh
-- (keempat fungsi, termasuk yang sudah dibasikan berikut sebabnya),
-- tanda_tangan.dibubuhkan_oleh, surat_verifikasi.ditandatangani_oleh, dan
-- pks.dibuat_oleh/diunggah_oleh.
--
-- Yang TIDAK tersimpan: perpindahan status itu sendiri. Siapa mengirim PO untuk
-- ditandatangani, siapa menariknya kembali ke draf, siapa mengajukan verifikasi
-- — tidak ada kolomnya di mana pun. Itu justru bagian yang paling sering
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
-- menghapus yang memberatkan. Yang mengisinya cuma trigger SECURITY DEFINER.
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

-- PO yang sudah ada diberi satu baris pembuka supaya lini masanya tidak kosong
-- sama sekali. Perpindahan status sebelum trigger ini terpasang memang hilang,
-- dan tidak ada gunanya mengarang ulang: yang tercatat harus yang benar-benar
-- terjadi, bukan rekaan yang tampak rapi.
insert into po_riwayat(po_id, status_baru, versi, oleh, pada)
select p.id, p.status, p.versi, p.dibuat_oleh, p.dibuat_pada
  from po p
 where not exists (select 1 from po_riwayat r where r.po_id = p.id);
