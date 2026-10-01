alter table po_komentar drop constraint if exists po_komentar_isi_panjang;
alter table po_komentar add constraint po_komentar_isi_panjang check (length(isi) <= 4000);
alter table po_komentar_revisi drop constraint if exists po_komentar_revisi_isi_panjang;
alter table po_komentar_revisi add constraint po_komentar_revisi_isi_panjang check (length(isi) <= 4000);
