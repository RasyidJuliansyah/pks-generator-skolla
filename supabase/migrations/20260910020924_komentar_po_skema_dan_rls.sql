create table if not exists po_komentar (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid not null references po(id) on delete cascade,
  isi            text not null check (length(btrim(isi)) > 0),
  oleh           text not null,
  waktu          timestamptz not null default now(),
  versi_po       integer not null,
  disunting_pada timestamptz,
  dihapus_pada   timestamptz,
  dihapus_oleh   text
);

create index if not exists po_komentar_po_waktu on po_komentar (po_id, waktu);

create table if not exists po_komentar_revisi (
  komentar_id     uuid not null references po_komentar(id) on delete cascade,
  isi             text not null,
  digantikan_pada timestamptz not null default now()
);

create index if not exists po_komentar_revisi_induk on po_komentar_revisi (komentar_id);

create table if not exists po_komentar_dibaca (
  po_id  uuid not null references po(id) on delete cascade,
  oleh   text not null,
  waktu  timestamptz not null default now(),
  primary key (po_id, oleh)
);

alter table po_komentar        enable row level security;
alter table po_komentar_revisi enable row level security;
alter table po_komentar_dibaca enable row level security;

drop policy if exists komentar_lihat on po_komentar;
create policy komentar_lihat on po_komentar for select to authenticated
using (exists (select 1 from po p
               where p.id = po_komentar.po_id
                 and private.boleh_lihat_po(p.dibuat_oleh)));

drop policy if exists komentar_tulis on po_komentar;
create policy komentar_tulis on po_komentar for insert to authenticated
with check (
  exists (select 1 from po p
          where p.id = po_komentar.po_id
            and private.boleh_lihat_po(p.dibuat_oleh))
  and not ('c_level' = any (private.peran_saya()))
  and oleh = lower(auth.jwt() ->> 'email')
);

revoke update, delete on po_komentar from anon, authenticated;

drop policy if exists komentar_revisi_lihat on po_komentar_revisi;
create policy komentar_revisi_lihat on po_komentar_revisi for select to authenticated
using (exists (select 1 from po_komentar k
               join po p on p.id = k.po_id
               where k.id = po_komentar_revisi.komentar_id
                 and private.boleh_lihat_po(p.dibuat_oleh)));

revoke insert, update, delete on po_komentar_revisi from anon, authenticated;

drop policy if exists dibaca_milik_sendiri on po_komentar_dibaca;
create policy dibaca_milik_sendiri on po_komentar_dibaca for all to authenticated
using (oleh = lower(auth.jwt() ->> 'email'))
with check (oleh = lower(auth.jwt() ->> 'email'));

revoke delete on po_komentar_dibaca from anon, authenticated;

create or replace function private.jaga_komentar_baru()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_versi integer;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select versi into v_versi from po where id = new.po_id;
  if v_versi is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  new.oleh           := v_saya;
  new.waktu          := now();
  new.versi_po       := v_versi;
  new.disunting_pada := null;
  new.dihapus_pada   := null;
  new.dihapus_oleh   := null;
  return new;
end;
$$;

drop trigger if exists jaga_komentar_baru on po_komentar;
create trigger jaga_komentar_baru
  before insert on po_komentar
  for each row execute function private.jaga_komentar_baru();

create or replace function private.jaga_komentar_sunting()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  new.id       := old.id;
  new.po_id    := old.po_id;
  new.oleh     := old.oleh;
  new.waktu    := old.waktu;
  new.versi_po := old.versi_po;

  if new.isi is distinct from old.isi then
    insert into po_komentar_revisi (komentar_id, isi) values (old.id, old.isi);
    new.disunting_pada := now();
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_komentar_sunting on po_komentar;
create trigger jaga_komentar_sunting
  before update on po_komentar
  for each row execute function private.jaga_komentar_sunting();

create or replace function sunting_komentar(p_id uuid, p_isi text)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_oleh  text;
  v_hapus timestamptz;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  select oleh, dihapus_pada into v_oleh, v_hapus from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) <> v_saya then
    raise exception 'Hanya penulisnya yang bisa menyunting komentar ini.'
      using errcode = 'check_violation';
  end if;
  if v_hapus is not null then
    raise exception 'Komentar ini sudah dihapus.' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_isi, ''))) = 0 then
    raise exception 'Isi komentar tidak boleh kosong.' using errcode = 'check_violation';
  end if;

  update po_komentar set isi = p_isi where id = p_id;
end;
$$;

revoke all on function sunting_komentar(uuid, text) from public, anon;
grant execute on function sunting_komentar(uuid, text) to authenticated;

create or replace function hapus_komentar(p_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_oleh text;
  v_saya text := lower(auth.jwt() ->> 'email');
begin
  select oleh into v_oleh from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) <> v_saya then
    raise exception 'Hanya penulisnya yang bisa menghapus komentar ini.'
      using errcode = 'check_violation';
  end if;

  update po_komentar
     set dihapus_pada = now(), dihapus_oleh = v_saya
   where id = p_id and dihapus_pada is null;
end;
$$;

revoke all on function hapus_komentar(uuid) from public, anon;
grant execute on function hapus_komentar(uuid) to authenticated;
