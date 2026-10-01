-- Status konfirmasi per langkah disimpan bersama draf (catatan/17 amandemen 2 butir 5).
--
-- Isinya DAFTAR KUNCI isian yang masih menunggu konfirmasi Sales, bukan hasil baca AI. Hasil
-- mentah tetap hanya terbaca Super Admin (tabel ekstraksi_po); yang disimpan di sini hanya
-- "apa yang belum diperiksa", dan itu tidak membocorkan apa pun yang belum diketahui Sales.
alter table po add column if not exists ekstraksi_menunggu text[];

comment on column po.ekstraksi_menunggu is
  'Kunci isian dari scan yang belum dikonfirmasi Sales (catatan/17 amandemen 2). Kosong = semua '
  'langkah sudah dikonfirmasi. Penanda kemajuan layar, bukan isi dokumen.';

-- Pembekuan: kolom baru masuk KEDUA tuple. Ditulis di atas versi 20260926a.
create or replace function private.bekukan_isi_po()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh,
      NEW.permintaan_tambahan, NEW.versi_iom, NEW.nilai_sponsorship,
      NEW.skema_ttd, NEW.nama_rh, NEW.dibaca_ai_pada, NEW.ekstraksi_menunggu)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship,
      OLD.skema_ttd, OLD.nama_rh, OLD.dibaca_ai_pada, OLD.ekstraksi_menunggu)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;

-- Sidik tinjauan: kolom ini dikeluarkan SELALU, bukan hanya saat kosong. Ia berubah justru saat
-- Sales mencentang, dan itu bukan perubahan isi PO: menguncinya di dalam sidik akan membatalkan
-- pernyataan "sesuai pindaian" hanya karena Sales menyelesaikan centangannya.
-- Ditulis di atas versi 20260926a.
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
                               'diverifikasi_otomatis', 'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik',
                               'skema_ttd', 'ekstraksi_menunggu'])
          - case when p.nama_rh is null then 'nama_rh' else '' end
          - case when p.dibaca_ai_pada is null then 'dibaca_ai_pada' else '' end,
    'sekolah', coalesce(p.sekolah_beku, '{}'::jsonb) - 'dipegang_oleh',
    'komponen', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_komponen x where x.po_id = p.id),
    'rombel',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_rombel x where x.po_id = p.id),
    'termin',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_termin x where x.po_id = p.id),
    'catatan',  (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_catatan x where x.po_id = p.id),
    'kelompok', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_kelompok x where x.po_id = p.id),
    'pindaian', (select jsonb_build_object('versi', o.version, 'etag', o.metadata->>'eTag')
                   from storage.objects o
                  where o.bucket_id = 'po-unggahan' and o.name = p.berkas_unggahan
                    and o.archived_at is null)
  )::text, 'UTF8')), 'hex');
$$;
revoke all on function private.sidik_tinjauan(po) from public, anon, authenticated;
