-- Daftar berkas tanda tangan yang sudah jatuh tempo, untuk dihapus Super Admin.
--
-- Kebijakannya diputuskan Rizki 9 Sep 2026 (catatan/retensi-data-pribadi.md):
-- gambar tanda tangan disimpan 12 bulan setelah PKS ditandatangani basah, atau 12 bulan
-- sejak PO terakhir disentuh bila tidak pernah sampai PKS. Barisnya TETAP disimpan —
-- nama, waktu, siapa membubuhkan — yang dihapus hanya gambarnya.
--
-- Penghapusannya SENGAJA tidak otomatis. Ia tidak bisa dibatalkan, jadi harus selalu ada
-- orang yang bertanggung jawab; cron yang salah hitung menghapus berkas sebelum ada yang
-- sadar, dan tidak ada yang bisa dimintai keterangan.

-- `berkas` NOT NULL, jadi jalurnya tidak bisa dikosongkan. Penanda terpisah justru lebih
-- baik: jalurnya tetap jadi jejak "dulu ada tanda tangan di sini", dan tanggal hapusnya
-- ikut tercatat.
alter table tanda_tangan     add column if not exists berkas_dihapus_pada timestamptz;
alter table surat_verifikasi add column if not exists berkas_dihapus_pada timestamptz;

/**
 * Berkas yang sudah lewat masa simpannya. Hanya Super Admin.
 *
 * `p_bulan` sengaja PARAMETER, bukan angka di dalam fungsi: masa simpannya hidup di
 * `lib/retensi.ts` sebagai satu konstanta yang juga dipakai dokumen. Menuliskannya lagi
 * di sini berarti dua sumber yang bisa menyimpang — dan yang tercetak di lembar
 * bermeterai adalah yang salah.
 *
 * DIKECUALIKAN: tanda tangan PO unggahan (`asal = 'pindaian'`). Ketiganya menunjuk
 * PINDAIAN PO, yang menurut keputusan retensi tidak pernah dihapus. Tanpa pengecualian
 * ini, membersihkan tanda tangan justru menghapus satu-satunya dokumen PO yang tidak
 * bisa dibangun ulang dari data.
 */
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

/**
 * Menandai berkas sudah dihapus. Dipanggil SETELAH berkasnya benar-benar hilang dari
 * penyimpanan, supaya penanda tidak pernah mendahului kenyataan.
 */
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

-- Super Admin boleh menghapus gambar tanda tangan di bucket `tanda-tangan`.
-- Kebijakan hapus yang ada hanya berlaku saat PO berstatus menunggu_ttd atau untuk
-- Tech Ops Lead pada berkas surat; keduanya tidak menjangkau berkas lama yang jatuh tempo.
--
-- Sengaja TIDAK mencakup `pks-basah` maupun `po-unggahan`: keduanya dokumen perusahaan
-- yang tidak pernah dihapus, dan TIDAK ADANYA kebijakan hapus di sana adalah penjaganya.
drop policy if exists ttd_hapus_retensi on storage.objects;
create policy ttd_hapus_retensi on storage.objects for delete to authenticated
using (
  bucket_id = 'tanda-tangan'
  and private.punya_peran('admin_utama')
);
