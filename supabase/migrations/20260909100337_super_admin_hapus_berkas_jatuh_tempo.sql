-- Super Admin boleh menghapus gambar tanda tangan di bucket `tanda-tangan`.
--
-- Dibutuhkan retensi: kebijakan hapus yang ada hanya berlaku saat PO berstatus
-- menunggu_ttd (pemiliknya membatalkan) atau untuk Tech Ops Lead pada berkas surat.
-- Keduanya tidak menjangkau berkas lama yang jatuh tempo.
--
-- Sengaja TIDAK mencakup bucket `pks-basah` maupun `po-unggahan`: keduanya dokumen
-- perusahaan yang menurut keputusan retensi tidak pernah dihapus, dan tidak adanya
-- kebijakan hapus di sana adalah penjaganya.
drop policy if exists ttd_hapus_retensi on storage.objects;
create policy ttd_hapus_retensi on storage.objects for delete to authenticated
using (
  bucket_id = 'tanda-tangan'
  and private.punya_peran('admin_utama')
);
