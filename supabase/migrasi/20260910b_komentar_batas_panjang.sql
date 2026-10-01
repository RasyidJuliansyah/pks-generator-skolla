-- Batas panjang komentar, di basis data — bukan cuma di kotak tulisnya.
--
-- 4000 karakter kira-kira dua halaman A4: jauh di atas percakapan wajar, cukup rendah
-- supaya utas tidak bisa dijadikan tempat menempel dokumen utuh. Dokumen punya
-- tempatnya sendiri (lampiran, pindaian), dan komentar yang memuat seluruh isinya
-- menduplikasi data pribadi ke tempat yang tidak punya aturan retensi sendiri.
--
-- Revisi ikut dibatasi dengan angka yang sama: ia salinan isi lama, jadi tidak pernah
-- sah melebihinya.
alter table po_komentar drop constraint if exists po_komentar_isi_panjang;
alter table po_komentar add constraint po_komentar_isi_panjang check (length(isi) <= 4000);
alter table po_komentar_revisi drop constraint if exists po_komentar_revisi_isi_panjang;
alter table po_komentar_revisi add constraint po_komentar_revisi_isi_panjang check (length(isi) <= 4000);
