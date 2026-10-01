-- Semula keputusan yang basi DIHAPUS saat PO direvisi, sehingga catatan
-- "Finance menolak karena termin tidak cocok" lenyap begitu diperbaiki. Untuk
-- dokumen yang jadi dasar PKS, jejak itu justru yang berguna.
--
-- Sekarang keputusan lama ditandai tidak berlaku, bukan dibuang. Satu fungsi
-- hanya boleh punya satu keputusan yang berlaku pada satu waktu.

alter table verifikasi drop constraint verifikasi_pkey;
alter table verifikasi add column id uuid primary key default gen_random_uuid();
alter table verifikasi add column berlaku boolean not null default true;
alter table verifikasi add column digantikan_pada timestamptz;
alter table verifikasi add column sebab_basi text;

comment on column verifikasi.berlaku is
  'false = keputusan lama yang sudah digantikan karena PO direvisi. Disimpan sebagai jejak.';
comment on column verifikasi.sebab_basi is
  'Bidang PO yang berubah sehingga keputusan ini perlu diulang.';

create unique index verifikasi_satu_berlaku
  on verifikasi (po_id, fungsi) where berlaku;

-- Kebijakan lama menyaring per (po_id, fungsi); tambahkan syarat berlaku supaya
-- keputusan lama tidak bisa disunting lagi.
drop policy if exists verifikasi_ubah on verifikasi;

create policy verifikasi_ubah on verifikasi for update to authenticated
  using (
    berlaku
    and private.fungsi_saya_cocok(fungsi)
    and exists (select 1 from po p where p.id = verifikasi.po_id and p.status = 'verifikasi')
  )
  with check (
    oleh = lower(auth.jwt() ->> 'email')
    and private.fungsi_saya_cocok(fungsi)
  );

-- Menandai basi dilakukan server action lewat fungsi ini supaya kebijakan
-- update di atas tidak perlu dilonggarkan.
create or replace function private.basikan_verifikasi(
  p_po uuid, p_fungsi fungsi_verifikasi[], p_sebab text
) returns void
language sql security definer
set search_path = public
as $$
  update verifikasi
     set berlaku = false, digantikan_pada = now(), sebab_basi = p_sebab
   where po_id = p_po and fungsi = any(p_fungsi) and berlaku;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
