-- Dokumen checklist aslinya punya tiga kesimpulan: Siap Go-Live, Siap dengan
-- Catatan, dan Tidak Siap. Sistem semula hanya membangun dua.
alter type hasil_verifikasi add value if not exists 'setuju_catatan' after 'setuju';
