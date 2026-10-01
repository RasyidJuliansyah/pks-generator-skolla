alter table po_rombel   add column if not exists kelompok smallint not null default 1;
alter table po_komponen add column if not exists kelompok smallint not null default 1;

alter table po_rombel   drop constraint if exists po_rombel_kelompok_satu_dulu;
alter table po_rombel   add  constraint po_rombel_kelompok_satu_dulu   check (kelompok = 1);
alter table po_komponen drop constraint if exists po_komponen_kelompok_satu_dulu;
alter table po_komponen add  constraint po_komponen_kelompok_satu_dulu check (kelompok = 1);
