-- Baris tanpa peran adalah keadaan setengah jadi yang paling membingungkan:
-- orangnya lolos sebagai pengguna sah, sidebar muncul, tapi setiap halaman
-- kosong karena RLS tidak meloloskan apa pun — tanpa satu pun penjelasan.
--
-- Lebih baik keadaan itu tidak bisa ada. Yang tersisa hanya tiga: belum
-- terdaftar, nonaktif, atau punya minimal satu peran.
update pengguna set peran = '{sales}'
 where peran = '{}'::peran[];

alter table pengguna add constraint pengguna_punya_peran
  check (array_length(peran, 1) >= 1);
