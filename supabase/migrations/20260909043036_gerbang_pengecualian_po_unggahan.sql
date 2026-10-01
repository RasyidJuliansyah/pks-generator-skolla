create table if not exists po_pengecualian (
  po_id            uuid primary key references po(id) on delete cascade,
  lantai_disetujui bigint not null,
  harga_disetujui  bigint not null,
  pelanggaran      text[] not null,
  alasan           text   not null check (length(btrim(alasan)) > 0),
  disetujui_oleh   text   not null,
  disetujui_pada   timestamptz not null default now()
);

alter table po_pengecualian enable row level security;

drop policy if exists pengecualian_lihat on po_pengecualian;
create policy pengecualian_lihat on po_pengecualian for select to authenticated
using (exists (select 1 from po p
               where p.id = po_pengecualian.po_id
                 and private.boleh_lihat_po(p.dibuat_oleh)));

drop policy if exists pengecualian_beri on po_pengecualian;
create policy pengecualian_beri on po_pengecualian for insert to authenticated
with check (private.punya_peran('head_of_operations'));

create or replace function private.jaga_pengecualian()
returns trigger language plpgsql security definer set search_path to public as $$
declare
  v_po     po%rowtype;
  v_lantai bigint;
  v_saya   text := lower(auth.jwt() ->> 'email');
begin
  select * into v_po from po where id = new.po_id;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if v_po.asal <> 'unggahan' then
    raise exception 'Pengecualian hanya untuk PO unggahan, bukan PO yang dibuat di platform.'
      using errcode = 'check_violation';
  end if;

  if lower(v_po.dibuat_oleh) = v_saya then
    raise exception 'Penyetuju tidak boleh orang yang sama dengan pembuat PO.'
      using errcode = 'check_violation';
  end if;

  new.disetujui_oleh := v_saya;

  v_lantai := private.lantai_siswa(new.po_id);
  new.lantai_disetujui := v_lantai;
  new.harga_disetujui  := v_po.harga_siswa;

  if v_po.harga_siswa >= v_lantai then
    raise exception 'PO ini tidak melanggar lantai (harga % >= lantai %). Tidak perlu pengecualian.',
      v_po.harga_siswa, v_lantai using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_pengecualian on po_pengecualian;
create trigger jaga_pengecualian
  before insert on po_pengecualian
  for each row execute function private.jaga_pengecualian();

create or replace function private.jaga_lantai_po()
returns trigger language plpgsql security definer set search_path to public as $$
declare
  v_siswa bigint;
  v_guru  bigint;
  v_ok    boolean;
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
    select exists (
      select 1 from po_pengecualian x
      where x.po_id = new.id
        and x.harga_disetujui  = new.harga_siswa
        and x.lantai_disetujui = v_siswa
    ) into v_ok;

    if not v_ok then
      raise exception 'Harga siswa % di bawah bottom price (% per siswa).',
        new.harga_siswa, v_siswa using errcode = 'check_violation';
    end if;
  end if;

  if v_guru > 0 and new.jumlah_guru > 0 and new.harga_guru < v_guru then
    raise exception 'Harga guru % di bawah bottom price (% per guru).',
      new.harga_guru, v_guru using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
