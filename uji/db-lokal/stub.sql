-- Stub minimum untuk memuat dump skema public+private di Postgres polos. BUKAN Supabase:
-- hanya cukup untuk membuktikan trigger/RPC/RLS dalam transaksi yang dibatalkan.
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create schema if not exists storage;
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid,
  version text, metadata jsonb, archived_at timestamptz, created_at timestamptz default now());
create table if not exists storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on storage.objects to authenticated;
create extension if not exists pgcrypto;
