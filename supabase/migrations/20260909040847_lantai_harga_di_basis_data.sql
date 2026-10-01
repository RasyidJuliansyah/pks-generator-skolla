create table if not exists harga_komponen (
  id         text primary key,
  price_list bigint  not null,
  bottom     bigint  not null,
  grup       text    not null check (grup in ('core', 'addon')),
  untuk_guru boolean not null default false,
  per_sesi   boolean not null default false
);

create table if not exists harga_paket (
  nama       text primary key,
  ids        text[] not null,
  price_list bigint not null,
  bottom     bigint not null
);

create table if not exists pricelist_aktif (
  satu_baris      boolean primary key default true check (satu_baris),
  versi           text not null,
  diperbarui_pada timestamptz not null default now()
);
insert into pricelist_aktif (versi) values ('belum diisi') on conflict do nothing;

alter table harga_komponen  enable row level security;
alter table harga_paket     enable row level security;
alter table pricelist_aktif enable row level security;
revoke all on harga_komponen, harga_paket, pricelist_aktif from anon, authenticated;

create or replace function private.lantai_siswa(p_po uuid)
returns bigint language sql stable security definer set search_path to public as $$
  with k as (
    select pk.sesi, h.id, h.bottom, h.grup, h.untuk_guru
    from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
    where pk.po_id = p_po
  ),
  inti as (
    select coalesce(array_agg(id order by id), array[]::text[]) as ids,
           coalesce(sum(bottom), 0) as jumlah
    from k where grup = 'core' and not untuk_guru
  ),
  addon as (
    select coalesce(sum(bottom * greatest(sesi, 1)), 0) as jumlah
    from k where grup = 'addon' and not untuk_guru
  )
  select coalesce(
           (select hp.bottom from harga_paket hp, inti where hp.ids = inti.ids),
           (select jumlah from inti)
         ) + (select jumlah from addon);
$$;

create or replace function private.lantai_guru(p_po uuid)
returns bigint language sql stable security definer set search_path to public as $$
  select coalesce(sum(h.bottom * greatest(pk.sesi, 1)), 0)
  from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
  where pk.po_id = p_po and h.untuk_guru;
$$;

create or replace function private.jaga_lantai_po()
returns trigger language plpgsql security definer set search_path to public as $$
declare
  v_siswa bigint;
  v_guru  bigint;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draf' then
      raise exception 'PO baru harus berstatus draf, bukan %', new.status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if old.status not in ('draf', 'ditolak') then return new; end if;
  if new.status in ('draf', 'ditolak') then return new; end if;

  v_siswa := private.lantai_siswa(new.id);
  v_guru  := private.lantai_guru(new.id);

  if v_siswa > 0 and new.harga_siswa < v_siswa then
    raise exception 'Harga siswa % di bawah bottom price (% per siswa).',
      new.harga_siswa, v_siswa using errcode = 'check_violation';
  end if;

  if v_guru > 0 and new.jumlah_guru > 0 and new.harga_guru < v_guru then
    raise exception 'Harga guru % di bawah bottom price (% per guru).',
      new.harga_guru, v_guru using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_lantai_po on po;
create trigger jaga_lantai_po
  before insert or update on po
  for each row execute function private.jaga_lantai_po();
