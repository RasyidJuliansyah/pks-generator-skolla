create or replace function private.jaga_verifikator_bukan_pembuat()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_pemilik text;
begin
  select dibuat_oleh into v_pemilik from po where id = new.po_id;

  if v_pemilik is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if lower(v_pemilik) = lower(auth.jwt() ->> 'email') then
    raise exception 'Kamu yang membuat PO ini, jadi tidak bisa ikut memverifikasinya. Minta pemegang fungsi % yang lain.', new.fungsi
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_verifikator_bukan_pembuat on verifikasi;
create trigger jaga_verifikator_bukan_pembuat
  before insert or update on verifikasi
  for each row execute function private.jaga_verifikator_bukan_pembuat();

drop policy if exists po_verifikasi_lanjut on po;
create policy po_verifikasi_lanjut on po for update to authenticated
using (
  status = 'verifikasi'
  and private.punya_peran('tech_ops_lead')
  and dibuat_oleh <> lower(auth.jwt() ->> 'email')
)
with check (
  status in ('verifikasi', 'terverifikasi', 'ditolak')
  and private.punya_peran('tech_ops_lead')
  and dibuat_oleh <> lower(auth.jwt() ->> 'email')
);
