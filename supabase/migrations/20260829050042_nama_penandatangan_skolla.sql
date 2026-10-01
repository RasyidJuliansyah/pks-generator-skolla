-- Nama penanda tangan sisi Skolla, dipilih dari daftar pengguna.
alter table po
  add column if not exists nama_pm text,
  add column if not exists nama_sm text;

comment on column po.nama_pm is 'Partnership Manager yang menandatangani, dipilih dari daftar pengguna.';
comment on column po.nama_sm is 'Sales Manager yang menandatangani, dipilih dari daftar pengguna.';
