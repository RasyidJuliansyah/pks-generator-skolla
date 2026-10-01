-- Fungsi pembantu dipindah ke skema `private` supaya tidak ikut terekspos sebagai
-- endpoint RPC oleh PostgREST, sekaligus search_path-nya dikunci.
create schema if not exists private;

create or replace function private.peran_saya()
returns peran[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select p.peran from pengguna p
      where p.email = lower(auth.jwt() ->> 'email') and p.aktif),
    '{}'::peran[]
  );
$$;

create or replace function private.punya_peran(variadic dicari peran[])
returns boolean
language sql stable
set search_path = public
as $$
  select private.peran_saya() && dicari;
$$;

create or replace function private.boleh_lihat_semua()
returns boolean
language sql stable
set search_path = public
as $$
  select private.punya_peran(
    'head_of_sales', 'head_of_operations', 'cbo', 'admin_utama', 'admin_sales',
    'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead'
  );
$$;

create or replace function private.boleh_lihat_acquisition()
returns boolean
language sql stable
set search_path = public
as $$
  select private.punya_peran('cbo', 'admin_utama', 'head_of_operations', 'finance');
$$;

-- Kebijakan lama menunjuk fungsi di skema public; digambar ulang ke yang privat.
drop policy if exists pengguna_lihat_diri  on pengguna;
drop policy if exists pengguna_admin_lihat on pengguna;
drop policy if exists pengguna_admin_ubah  on pengguna;

drop function if exists public.boleh_lihat_acquisition();
drop function if exists public.boleh_lihat_semua();
drop function if exists public.punya_peran(peran[]);
drop function if exists public.peran_saya();

create policy pengguna_lihat_diri on pengguna
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

create policy pengguna_admin_lihat on pengguna
  for select to authenticated
  using (private.punya_peran('admin_utama'));

create policy pengguna_admin_ubah on pengguna
  for all to authenticated
  using (private.punya_peran('admin_utama'))
  with check (private.punya_peran('admin_utama'));

-- Hanya pengguna yang sudah masuk yang boleh menjalankan fungsi ini; anon tidak.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
