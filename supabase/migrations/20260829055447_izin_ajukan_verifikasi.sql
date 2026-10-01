-- Sales boleh mengajukan PO yang sudah ditandatangani ke tahap verifikasi.
-- Setelah masuk 'verifikasi', PO keluar dari fase sales dan tidak bisa disentuh lagi
-- dari sisi ini — kewenangan berpindah ke empat fungsi verifikator.
drop policy if exists po_ubah on po;

create policy po_ubah on po for update to authenticated
  using (
    status in ('draf', 'ditolak', 'menunggu_ttd', 'ditandatangani')
    and private.milik_sales(dibuat_oleh)
  )
  with check (
    status in ('draf', 'ditolak', 'menunggu_ttd', 'ditandatangani', 'verifikasi')
    and private.milik_sales(dibuat_oleh)
  );
