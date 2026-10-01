-- array_length(larik, 1) mengembalikan NULL untuk larik kosong, dan CHECK hanya
-- gagal pada FALSE — bukan NULL. Jadi penjaga sebelumnya lolos begitu saja dan
-- baris tanpa peran tetap diterima. cardinality() mengembalikan 0, bukan NULL.
alter table pengguna drop constraint pengguna_punya_peran;
alter table pengguna add constraint pengguna_punya_peran
  check (cardinality(peran) >= 1);
