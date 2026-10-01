-- Peran mengikuti spesifikasi alur kerjasama.
create type peran as enum (
  'sales',
  'head_of_sales',
  'head_of_operations',
  'cbo',
  'admin_utama',
  'admin_sales',
  'education',
  'tech_ops',
  'finance',
  'service_account',
  'tech_ops_lead'
);

-- Daftar pengguna berfungsi sekaligus sebagai daftar izin. Login Google saja tidak
-- cukup: tanpa baris di sini, seseorang tidak melihat apa pun. Email dipakai sebagai
-- kunci supaya orang bisa didaftarkan sebelum pernah masuk.
create table pengguna (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique check (email = lower(email)),
  nama         text,
  peran        peran[] not null default '{}',
  aktif        boolean not null default true,
  dibuat_pada  timestamptz not null default now()
);

comment on table pengguna is 'Daftar izin. Satu orang boleh memegang lebih dari satu peran.';

-- Peran milik pemanggil saat ini. security definer supaya kebijakan RLS di tabel lain
-- bisa membacanya tanpa pengguna perlu hak baca langsung ke tabel ini.
create or replace function peran_saya()
returns peran[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.peran from pengguna p
      where p.email = lower(auth.jwt() ->> 'email') and p.aktif),
    '{}'::peran[]
  );
$$;

create or replace function punya_peran(variadic dicari peran[])
returns boolean
language sql
stable
as $$
  select peran_saya() && dicari;
$$;

-- Boleh melihat seluruh PO: semua peran kecuali sales biasa.
create or replace function boleh_lihat_semua()
returns boolean
language sql
stable
as $$
  select punya_peran(
    'head_of_sales', 'head_of_operations', 'cbo', 'admin_utama', 'admin_sales',
    'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead'
  );
$$;

-- Berhak melihat Acquisition Price.
create or replace function boleh_lihat_acquisition()
returns boolean
language sql
stable
as $$
  select punya_peran('cbo', 'admin_utama', 'head_of_operations', 'finance');
$$;

alter table pengguna enable row level security;

-- Siapa pun yang sudah terdaftar boleh melihat dirinya sendiri.
create policy pengguna_lihat_diri on pengguna
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- Admin Utama melihat dan mengelola seluruh daftar pengguna.
create policy pengguna_admin_lihat on pengguna
  for select to authenticated
  using (punya_peran('admin_utama'));

create policy pengguna_admin_ubah on pengguna
  for all to authenticated
  using (punya_peran('admin_utama'))
  with check (punya_peran('admin_utama'));
