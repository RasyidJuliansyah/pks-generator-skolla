alter table po add column if not exists ditinjau_sidik text;

comment on column po.ditinjau_sidik is
  'Sidik isi PO saat ditinjau_pada diisi. Diisi trigger po_tinjauan_sidik, tidak pernah '
  'dari pemanggil. ajukan_po_unggahan menolak bila isi saat diajukan berbeda.';

create or replace function private.sidik_tinjauan(p po)
returns text
language sql
stable
security definer
set search_path to public
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'po', (to_jsonb(p) - array['nomor', 'status', 'versi', 'dibuat_oleh', 'dibuat_pada',
                               'diubah_pada', 'diverifikasi_oleh', 'diverifikasi_pada',
                               'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik']),
    'sekolah', coalesce(p.sekolah_beku, '{}'::jsonb) - 'dipegang_oleh',
    'komponen', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_komponen x where x.po_id = p.id),
    'rombel',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_rombel x where x.po_id = p.id),
    'termin',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_termin x where x.po_id = p.id),
    'catatan',  (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_catatan x where x.po_id = p.id),
    'pindaian', (select jsonb_build_object('versi', o.version, 'etag', o.metadata->>'eTag')
                   from storage.objects o
                  where o.bucket_id = 'po-unggahan' and o.name = p.berkas_unggahan
                    and o.archived_at is null)
  )::text, 'UTF8')), 'hex');
$$;

revoke all on function private.sidik_tinjauan(po) from public, anon, authenticated;

create or replace function private.sidik_saat_ditinjau()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if new.ditinjau_pada is null then
    new.ditinjau_sidik := null;
  elsif tg_op = 'INSERT' or new.ditinjau_pada is distinct from old.ditinjau_pada then
    new.ditinjau_sidik := private.sidik_tinjauan(new);
  else
    new.ditinjau_sidik := old.ditinjau_sidik;
  end if;
  return new;
end;
$$;

drop trigger if exists po_tinjauan_sidik on po;
create trigger po_tinjauan_sidik
  before insert or update on po
  for each row execute function private.sidik_saat_ditinjau();

create or replace function ajukan_po_unggahan(p_po uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_po    po%rowtype;
  v_beku  jsonb;
  v_basi  boolean;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select * into v_po from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if lower(v_po.dibuat_oleh) is distinct from v_saya
     and not private.punya_peran('head_of_sales', 'admin_sales') then
    raise exception 'PO ini bukan milikmu.' using errcode = 'check_violation';
  end if;

  if v_po.asal <> 'unggahan' then
    raise exception 'Jalur ini hanya untuk PO unggahan. PO platform mengumpulkan tanda tangan lewat aplikasi.'
      using errcode = 'check_violation';
  end if;

  if v_po.status not in ('draf', 'ditolak') then
    raise exception 'PO berstatus % sudah tidak bisa diajukan lagi.', v_po.status
      using errcode = 'check_violation';
  end if;

  if v_po.berkas_unggahan is null then
    raise exception 'Pindaian PO belum diunggah.' using errcode = 'check_violation';
  end if;

  -- Tanpa pernyataan Sales, tidak ada yang menjamin data di sistem mewakili kertasnya.
  if v_po.ditinjau_pada is null then
    raise exception 'Belum ada pernyataan bahwa data ini sesuai dengan pindaian.'
      using errcode = 'check_violation';
  end if;

  -- PO yang pernah ditolak lalu diajukan ulang tidak boleh menumpuk tanda tangan.
  delete from tanda_tangan where po_id = p_po;

  -- Lompatan status ini memicu `jaga_lantai_po`; gerbangnya sama dengan jalur platform.
  -- Ia juga menyegarkan sekolah_beku untuk terakhir kalinya; nama kepala sekolah di
  -- tanda tangan harus diambil dari salinan hasil penyegaran ini, bukan dari v_po.
  update po set status = 'ditandatangani' where id = p_po
  returning sekolah_beku, private.sidik_tinjauan(po) is distinct from ditinjau_sidik
  into v_beku, v_basi;

  -- Sidiknya dihitung dari baris hasil lompatan status di atas, jadi yang dibandingkan
  -- persis isi yang dibekukan. Galat membatalkan seluruh pengajuan, termasuk
  -- penghapusan tanda tangan di atas.
  if v_basi then
    raise exception 'Data PO ini berubah sejak dinyatakan sesuai dengan pindaian. Buka Sunting, periksa lagi terhadap pindaiannya, lalu centang pernyataannya.'
      using errcode = 'check_violation';
  end if;

  -- Ketiganya menunjuk BERKAS YANG SAMA: satu lembar pindaian.
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh, asal) values
    (p_po, 'kepala_sekolah',
       coalesce(nullif(btrim(v_beku->>'kepala_sekolah'), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'partnership_manager',
       coalesce(nullif(btrim(v_po.nama_pm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'sales_manager',
       coalesce(nullif(btrim(v_po.nama_sm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian');
end;
$$;
