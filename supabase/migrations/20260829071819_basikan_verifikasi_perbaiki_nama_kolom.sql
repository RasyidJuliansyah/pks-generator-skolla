create or replace function public.basikan_verifikasi(
  p_po uuid, p_fungsi fungsi_verifikasi[], p_sebab text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
begin
  select dibuat_oleh, status into r from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan';
  end if;

  if not (
    private.boleh_ubah_po(r.dibuat_oleh, r.status)
    or (array_length(p_fungsi, 1) = 1 and private.fungsi_saya_cocok(p_fungsi[1]))
  ) then
    raise exception 'Tidak berhak membatalkan keputusan verifikasi';
  end if;

  update verifikasi
     set berlaku = false, digantikan_pada = now(), sebab_basi = p_sebab
   where po_id = p_po and fungsi = any(p_fungsi) and berlaku;
end;
$$;
