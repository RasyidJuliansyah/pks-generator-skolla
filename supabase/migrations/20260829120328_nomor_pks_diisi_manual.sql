-- Penomoran dipakai bersama banyak jenis dokumen, bukan PKS saja, sehingga
-- urutannya tidak bisa ditentukan dari sistem ini. Angkanya diisi tangan;
-- yang tetap dihasilkan hanya ekornya: /EXTSKOLLA/PKS/<bulan romawi>/<tahun>.
alter table pks drop constraint pks_tahun_nomor_urut_key;
alter table pks drop column nomor_urut;
alter table pks drop column nomor;
alter table pks add column bulan int not null default extract(month from now())
  check (bulan between 1 and 12);

drop table pks_penomoran;

comment on column pks.tahun is 'Tahun pada ekor nomor perjanjian, diambil saat draf dibuat.';
comment on column pks.bulan is 'Bulan pada ekor nomor perjanjian, dicetak sebagai angka Romawi.';

create or replace function public.buat_pks(p_po uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  ROMAWI constant text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  saya text := lower(auth.jwt() ->> 'email');
  r record; thn int; bln int;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;

  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh)) then
    raise exception 'Hanya sales pemilik PO yang bisa membuat PKS';
  end if;
  if r.status <> 'terverifikasi' then
    raise exception 'PO belum terverifikasi';
  end if;
  if not exists (select 1 from surat_verifikasi s
                  where s.po_id = p_po and s.final_pada is not null) then
    raise exception 'Surat Verifikasi Kesiapan belum difinalisasi';
  end if;
  if exists (select 1 from pks where po_id = p_po) then
    raise exception 'PKS untuk PO ini sudah ada';
  end if;

  thn := extract(year from now())::int;
  bln := extract(month from now())::int;
  insert into pks (po_id, tahun, bulan, dibuat_oleh) values (p_po, thn, bln, saya);

  return '/EXTSKOLLA/PKS/' || ROMAWI[bln] || '/' || thn;
end;
$$;
