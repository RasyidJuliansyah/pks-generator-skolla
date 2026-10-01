create type status_po as enum (
  'draf',
  'menunggu_ttd',
  'ditandatangani',
  'verifikasi',
  'ditolak',
  'terverifikasi',
  'pks_terbit',
  'pks_ditandatangani',
  'aktif',
  'selesai'
);

create type jenjang_sekolah as enum ('SD', 'SMP', 'SMA');

create table sekolah (
  id             uuid primary key default gen_random_uuid(),
  nama           text not null,
  npsn           text,
  jenjang        jenjang_sekolah not null,
  alamat         text,
  telepon        text,
  email          text,
  kepala_sekolah text,
  kepsek_hp      text,
  bendahara      text,
  bendahara_hp   text,
  dibuat_pada    timestamptz not null default now(),
  diubah_pada    timestamptz not null default now()
);
create index on sekolah (lower(nama));
create unique index on sekolah (npsn) where npsn is not null and npsn <> '';

create table po (
  id            uuid primary key default gen_random_uuid(),
  nomor         bigint generated always as identity,
  sekolah_id    uuid not null references sekolah(id) on delete restrict,
  dibuat_oleh   text not null references pengguna(email) on delete restrict,
  status        status_po not null default 'draf',
  versi         integer not null default 1,

  jumlah_siswa  integer not null default 0 check (jumlah_siswa >= 0),
  jumlah_guru   integer not null default 0 check (jumlah_guru  >= 0),
  -- Hanya harga kesepakatan yang tersimpan. Price List, Bottom Price, dan
  -- Acquisition Price TIDAK PERNAH masuk basis data — lihat lib/pricelist.ts.
  harga_siswa   bigint  not null default 0 check (harga_siswa >= 0),
  harga_guru    bigint  not null default 0 check (harga_guru  >= 0),
  grand_total   bigint  not null default 0 check (grand_total >= 0),

  masa_mulai    date,
  masa_selesai  date,
  sumber_dana   text,
  sumber_dana_lain text,
  kota          text default 'Jakarta',
  tanggal_ttd   date,
  jumlah_rombel integer not null default 8 check (jumlah_rombel between 1 and 20),
  versi_pricelist text,

  dibuat_pada   timestamptz not null default now(),
  diubah_pada   timestamptz not null default now(),

  constraint masa_aktif_urut check (masa_selesai is null or masa_mulai is null or masa_selesai >= masa_mulai)
);
create index on po (dibuat_oleh);
create index on po (status);
create index on po (sekolah_id);

create table po_komponen (
  po_id       uuid not null references po(id) on delete cascade,
  komponen_id text not null,
  sesi        integer not null default 1 check (sesi >= 1),
  primary key (po_id, komponen_id)
);

create table po_rombel (
  po_id        uuid not null references po(id) on delete cascade,
  kelas        integer not null,
  rombel       text not null,
  jumlah_siswa integer not null default 0 check (jumlah_siswa >= 0),
  primary key (po_id, kelas, rombel)
);

create table po_termin (
  po_id   uuid not null references po(id) on delete cascade,
  urutan  integer not null check (urutan >= 1),
  tanggal date,
  nominal bigint not null default 0 check (nominal >= 0),
  primary key (po_id, urutan)
);

create table po_catatan (
  po_id uuid not null references po(id) on delete cascade,
  jenis text not null check (jenis in ('pelaksanaan', 'sponsorship')),
  isi   text,
  primary key (po_id, jenis)
);

create or replace function private.sentuh_diubah_pada()
returns trigger language plpgsql set search_path = public as $$
begin new.diubah_pada = now(); return new; end $$;

create trigger sekolah_sentuh before update on sekolah
  for each row execute function private.sentuh_diubah_pada();
create trigger po_sentuh before update on po
  for each row execute function private.sentuh_diubah_pada();
