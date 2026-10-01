-- Fungsi ini harus dipanggil dari server action lewat PostgREST, sehingga tidak
-- bisa tinggal di skema private yang sengaja tidak diekspos. Karena begitu,
-- izinnya diperiksa di dalam fungsinya sendiri, bukan diserahkan ke RLS.
drop function if exists private.basikan_verifikasi(uuid, fungsi_verifikasi[], text);

create or replace function public.basikan_verifikasi(
  p_po uuid, p_fungsi fungsi_verifikasi[], p_sebab text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
begin
  select oleh, status into r from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan';
  end if;

  -- Dua jalur sah: Sales yang sedang merevisi POnya sendiri, atau verifikator
  -- yang mengganti keputusannya sendiri.
  if not (
    private.boleh_ubah_po(r.oleh, r.status)
    or (array_length(p_fungsi, 1) = 1 and private.fungsi_saya_cocok(p_fungsi[1]))
  ) then
    raise exception 'Tidak berhak membatalkan keputusan verifikasi';
  end if;

  update verifikasi
     set berlaku = false, digantikan_pada = now(), sebab_basi = p_sebab
   where po_id = p_po and fungsi = any(p_fungsi) and berlaku;
end;
$$;

revoke all on function public.basikan_verifikasi(uuid, fungsi_verifikasi[], text) from public, anon;
grant execute on function public.basikan_verifikasi(uuid, fungsi_verifikasi[], text) to authenticated;
