-- Surat Verifikasi Kesiapan ditandatangani Tech Ops Lead yang menutup tahap
-- verifikasi, dan bertanggal saat penutupan itu. Keduanya perlu dicatat, bukan
-- disimpulkan dari waktu keputusan fungsi mana pun.
alter table po add column diverifikasi_oleh text references pengguna(email);
alter table po add column diverifikasi_pada timestamptz;

comment on column po.diverifikasi_oleh is
  'Tech Ops Lead yang menutup verifikasi; namanya menjadi penanda tangan surat.';
