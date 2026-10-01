alter table tanda_tangan     add column if not exists berkas_dihapus_pada timestamptz;
alter table surat_verifikasi add column if not exists berkas_dihapus_pada timestamptz;

create or replace function daftar_jatuh_tempo(p_bulan int)
returns table (
  po_id       uuid,
  nomor       bigint,
  sekolah     text,
  jenis       text,
  bucket      text,
  jalur       text,
  jatuh_tempo date
)
language plpgsql
stable
security definer
set search_path to public
as $$
begin
  if not private.punya_peran('admin_utama') then
    raise exception 'Hanya Super Admin yang boleh melihat daftar jatuh tempo.'
      using errcode = 'check_violation';
  end if;

  return query
  with dasar as (
    select p.id, p.nomor, p.diubah_pada,
           coalesce(p.sekolah_beku->>'nama', '—') as sekolah,
           (select k.ditandatangani_pada from pks k where k.po_id = p.id) as pks_basah
    from po p
  ),
  tempo as (
    select d.*,
           (coalesce(d.pks_basah, d.diubah_pada::date) + make_interval(months => p_bulan))::date as jt
    from dasar d
  )
  select t.id, t.nomor, t.sekolah, 'Tanda tangan PO'::text, 'tanda-tangan'::text,
         tt.berkas, t.jt
  from tempo t
  join tanda_tangan tt on tt.po_id = t.id
  where tt.asal <> 'pindaian'
    and tt.berkas_dihapus_pada is null
    and t.jt <= current_date

  union all

  select t.id, t.nomor, t.sekolah, 'Tanda tangan Surat Verifikasi'::text, 'tanda-tangan'::text,
         sv.berkas, t.jt
  from tempo t
  join surat_verifikasi sv on sv.po_id = t.id
  where sv.berkas is not null
    and sv.berkas_dihapus_pada is null
    and t.jt <= current_date

  order by 7, 2;
end;
$$;

revoke all on function daftar_jatuh_tempo(int) from public, anon;
grant execute on function daftar_jatuh_tempo(int) to authenticated;

create or replace function tandai_berkas_dihapus(p_jalur text)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if not private.punya_peran('admin_utama') then
    raise exception 'Hanya Super Admin yang boleh menghapus berkas jatuh tempo.'
      using errcode = 'check_violation';
  end if;

  update tanda_tangan set berkas_dihapus_pada = now()
   where berkas = p_jalur and asal <> 'pindaian' and berkas_dihapus_pada is null;

  update surat_verifikasi set berkas_dihapus_pada = now()
   where berkas = p_jalur and berkas_dihapus_pada is null;
end;
$$;

revoke all on function tandai_berkas_dihapus(text) from public, anon;
grant execute on function tandai_berkas_dihapus(text) to authenticated;
