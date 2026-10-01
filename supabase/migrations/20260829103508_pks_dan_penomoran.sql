-- Nomor perjanjian mengikuti PKS asli: 175/EXTSKOLLA/PKS/VIII/2026.
-- Nomor urut berjalan per tahun.
--
-- Penomoran sudah berjalan di luar sistem (Agustus 2026 sudah di 175), jadi
-- penghitungnya harus bisa disetel supaya PKS terbitan sistem tidak memakai
-- nomor yang sudah dipakai dokumen nyata.
create table pks_penomoran (
  tahun int primary key,
  mulai_dari int not null default 0
);

comment on table pks_penomoran is
  'Nomor terakhir yang sudah dipakai di luar sistem. PKS pertama dari sistem memakai mulai_dari + 1.';

insert into pks_penomoran (tahun, mulai_dari) values (2026, 175);

create table pks (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null unique references po(id) on delete cascade,
  tahun int not null,
  nomor_urut int not null,
  nomor text not null,
  dibuat_oleh text not null references pengguna(email),
  dibuat_pada timestamptz not null default now(),
  final_pada timestamptz,
  unique (tahun, nomor_urut)
);

comment on column pks.final_pada is
  'Kosong = draf, nomornya sudah dipesan. Terisi = siap ditandatangani basah.';

alter table pks enable row level security;
alter table pks_penomoran enable row level security;

create policy pks_lihat on pks for select to authenticated
  using (exists (select 1 from po p
                  where p.id = pks.po_id and private.boleh_lihat_po(p.dibuat_oleh)));

-- Penyisipan hanya lewat fungsi buat_pks di bawah, yang memesan nomor secara
-- berurutan. Tidak ada kebijakan INSERT langsung supaya nomor tidak bisa dipilih
-- sendiri oleh pemanggil.
create policy pks_sunting on pks for update to authenticated
  using (final_pada is null and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
    and exists (select 1 from po p where p.id = pks.po_id and private.milik_sales(p.dibuat_oleh)))
  with check (final_pada is not null);

create policy pks_batal on pks for delete to authenticated
  using (final_pada is null and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
    and exists (select 1 from po p where p.id = pks.po_id and private.milik_sales(p.dibuat_oleh)));

create policy penomoran_lihat on pks_penomoran for select to authenticated using (true);

/**
 * Memesan nomor PKS berikutnya dan membuat drafnya.
 *
 * Baris penomoran dikunci lebih dulu supaya dua pembuatan bersamaan tidak
 * mendapat nomor yang sama; unique(tahun, nomor_urut) menjadi jaring terakhir.
 */
create or replace function public.buat_pks(p_po uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  ROMAWI constant text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  saya text := lower(auth.jwt() ->> 'email');
  r record; thn int; bln int; urut int; nomor_baru text;
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

  insert into pks_penomoran (tahun) values (thn) on conflict do nothing;
  select mulai_dari into urut from pks_penomoran where tahun = thn for update;

  select greatest(urut, coalesce(max(nomor_urut), 0)) + 1 into urut
    from pks where tahun = thn;

  nomor_baru := lpad(urut::text, 3, '0') || '/EXTSKOLLA/PKS/' || ROMAWI[bln] || '/' || thn;

  insert into pks (po_id, tahun, nomor_urut, nomor, dibuat_oleh)
    values (p_po, thn, urut, nomor_baru, saya);

  return nomor_baru;
end;
$$;

revoke all on function public.buat_pks(uuid) from public, anon;
grant execute on function public.buat_pks(uuid) to authenticated;
