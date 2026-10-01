alter table po_komentar add column if not exists nama_penulis  text;
alter table po_komentar add column if not exists peran_penulis peran[];

create or replace function private.jaga_komentar_baru()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_versi integer;
  v_nama  text;
  v_peran peran[];
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select versi into v_versi from po where id = new.po_id;
  if v_versi is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  select nama, peran into v_nama, v_peran from pengguna where email = v_saya;

  new.oleh           := v_saya;
  new.nama_penulis   := v_nama;
  new.peran_penulis  := v_peran;
  new.waktu          := now();
  new.versi_po       := v_versi;
  new.disunting_pada := null;
  new.dihapus_pada   := null;
  new.dihapus_oleh   := null;
  return new;
end;
$$;

create or replace function private.jaga_komentar_sunting()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  new.id            := old.id;
  new.po_id         := old.po_id;
  new.oleh          := old.oleh;
  new.nama_penulis  := old.nama_penulis;
  new.peran_penulis := old.peran_penulis;
  new.waktu         := old.waktu;
  new.versi_po      := old.versi_po;

  if new.isi is distinct from old.isi then
    insert into po_komentar_revisi (komentar_id, isi) values (old.id, old.isi);
    new.disunting_pada := now();
  end if;

  return new;
end;
$$;

drop policy if exists dibaca_milik_sendiri on po_komentar_dibaca;
create policy dibaca_milik_sendiri on po_komentar_dibaca for all to authenticated
using (oleh = lower(auth.jwt() ->> 'email'))
with check (
  oleh = lower(auth.jwt() ->> 'email')
  and exists (select 1 from po p
              where p.id = po_komentar_dibaca.po_id
                and private.boleh_lihat_po(p.dibuat_oleh))
);

create or replace function komentar_belum_dibaca()
returns table (po_id uuid, jumlah bigint, terakhir timestamptz)
language sql
stable
security invoker
set search_path to public
as $$
  select k.po_id, count(*), max(k.waktu)
  from po_komentar k
  left join po_komentar_dibaca d
         on d.po_id = k.po_id and d.oleh = lower(auth.jwt() ->> 'email')
  where k.dihapus_pada is null
    and k.oleh is distinct from lower(auth.jwt() ->> 'email')
    and k.waktu > coalesce(d.waktu, '-infinity'::timestamptz)
  group by k.po_id
$$;

revoke all on function komentar_belum_dibaca() from public, anon;
grant execute on function komentar_belum_dibaca() to authenticated;

create or replace function tandai_komentar_dibaca(p_po uuid)
returns void
language sql
volatile
security invoker
set search_path to public
as $$
  insert into po_komentar_dibaca (po_id, oleh, waktu)
  values (p_po, lower(auth.jwt() ->> 'email'), now())
  on conflict (po_id, oleh) do update set waktu = excluded.waktu
$$;

revoke all on function tandai_komentar_dibaca(uuid) from public, anon;
grant execute on function tandai_komentar_dibaca(uuid) to authenticated;
