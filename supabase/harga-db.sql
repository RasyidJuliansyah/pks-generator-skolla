-- DIHASILKAN OLEH uji/buat-harga-db.mjs — JANGAN DISUNTING TANGAN.
-- Sumber: lib/pricelist.ts, cap versi af4fc50e4ac9.
--
-- Hanya price list dan bottom price. Acquisition price TIDAK PERNAH masuk basis data.
--
-- Idempoten: dijalankan ulang setiap kali harga berubah.
begin;

delete from harga_komponen;
insert into harga_komponen (id, price_list, bottom, grup, untuk_guru, per_sesi) values
  ('lms', 100000, 66000, 'core', false, false),
  ('modul', 15000, 11000, 'core', false, false),
  ('video', 29000, 19000, 'core', false, false),
  ('soal', 60000, 39000, 'core', false, false),
  ('asesmen', 75000, 50000, 'core', false, false),
  ('tryout', 25000, 20000, 'core', false, false),
  ('live', 32000, 21000, 'core', false, false),
  ('snbp', 4000, 3000, 'core', false, false),
  ('konsul', 52000, 34000, 'addon', false, true),
  ('pendam', 45000, 28000, 'addon', false, true),
  ('pmOn', 32000, 21000, 'addon', false, true),
  ('psiOff', 150000, 91000, 'addon', false, true),
  ('psiOn', 95000, 56000, 'addon', false, true),
  ('guruOff', 150000, 82000, 'addon', true, true),
  ('guruOn', 50000, 23000, 'addon', true, true);

delete from harga_paket;
insert into harga_paket (nama, ids, price_list, bottom) values
  ('LMS Juara', array['asesmen', 'live', 'lms', 'modul', 'snbp', 'soal', 'tryout', 'video'], 350000, 186000),
  ('LMS Smart', array['lms', 'modul', 'soal', 'video'], 240000, 135000),
  ('LMS Lite', array['lms'], 100000, 66000),
  ('Bimbel UTBK/TKA Premium', array['asesmen', 'live', 'modul', 'snbp', 'soal', 'tryout', 'video'], 285000, 120000),
  ('Bimbel UTBK/TKA Lite', array['asesmen', 'modul', 'snbp', 'soal', 'tryout', 'video'], 150000, 99000),
  ('Asesmen Psikologi', array['asesmen'], 75000, 50000),
  ('Tryout', array['tryout'], 25000, 20000);

update pricelist_aktif set versi = 'af4fc50e4ac9', diperbarui_pada = now();

commit;
