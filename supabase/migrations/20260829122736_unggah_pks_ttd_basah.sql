-- PKS yang sudah ditandatangani basah diunggah Sales, dan itulah yang menandai
-- kerjasama benar-benar jadi. Statusnya memakai nilai enum yang sejak awal
-- disediakan tapi belum tersambung: pks_terbit lalu pks_ditandatangani.

alter table pks add column berkas_basah text;
alter table pks add column diunggah_oleh text references pengguna(email);
alter table pks add column diunggah_pada timestamptz;
alter table pks add column ditandatangani_pada date;

comment on column pks.berkas_basah is
  'Pindaian PKS bermeterai yang sudah ditandatangani kedua pihak.';
comment on column pks.ditandatangani_pada is
  'Tanggal pada dokumen basah, diisi Sales — bukan tanggal unggah.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pks-basah', 'pks-basah', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Berkas disimpan sebagai "<po_id>/pks.<ext>", sehingga izin bacanya bisa
-- diikatkan langsung ke PO-nya — bukan sekadar "punya peran apa pun", karena
-- isinya perjanjian bermeterai milik sekolah.
create policy pks_basah_baca on storage.objects for select to authenticated
  using (bucket_id = 'pks-basah' and exists (
    select 1 from po p
     where p.id::text = split_part(name, '/', 1)
       and private.boleh_lihat_po(p.dibuat_oleh)));

create policy pks_basah_tulis on storage.objects for insert to authenticated
  with check (bucket_id = 'pks-basah'
    and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
    and exists (select 1 from po p
                 where p.id::text = split_part(name, '/', 1)
                   and private.milik_sales(p.dibuat_oleh)));

create policy pks_basah_ganti on storage.objects for update to authenticated
  using (bucket_id = 'pks-basah'
    and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
    and exists (select 1 from po p
                 where p.id::text = split_part(name, '/', 1)
                   and private.milik_sales(p.dibuat_oleh)));

/**
 * Mengunci PKS dan menaikkan status PO menjadi pks_terbit.
 *
 * Perpindahan status dilakukan di sini, bukan lewat RLS: kebijakan po_ubah
 * sengaja tidak mengizinkan sales menyentuh PO yang sudah terverifikasi, dan
 * melonggarkannya demi satu langkah ini akan membuka pintu untuk semua langkah.
 */
create or replace function public.finalisasi_pks(p_po uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r record;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;
  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh)) then
    raise exception 'Hanya sales pemilik PO yang bisa memfinalisasi PKS';
  end if;

  update pks set final_pada = now() where po_id = p_po and final_pada is null;
  if not found then raise exception 'PKS belum dibuat atau sudah difinalisasi'; end if;

  update po set status = 'pks_terbit' where id = p_po and status = 'terverifikasi';
end;
$$;

/** Mencatat pindaian PKS bermeterai; inilah yang menandai kerjasama jadi. */
create or replace function public.unggah_pks_basah(
  p_po uuid, p_berkas text, p_tanggal date
) returns void
language plpgsql security definer
set search_path = public
as $$
declare r record; s record;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;
  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh)) then
    raise exception 'Hanya sales pemilik PO yang bisa mengunggah PKS';
  end if;

  select final_pada into s from pks where po_id = p_po;
  if not found then raise exception 'PKS belum dibuat'; end if;
  if s.final_pada is null then
    raise exception 'PKS belum difinalisasi';
  end if;
  if p_tanggal > current_date then
    raise exception 'Tanggal penandatanganan tidak boleh di masa depan';
  end if;

  update pks
     set berkas_basah = p_berkas,
         diunggah_oleh = lower(auth.jwt() ->> 'email'),
         diunggah_pada = now(),
         ditandatangani_pada = p_tanggal
   where po_id = p_po;

  update po set status = 'pks_ditandatangani'
   where id = p_po and status in ('terverifikasi', 'pks_terbit');
end;
$$;

revoke all on function public.finalisasi_pks(uuid) from public, anon;
revoke all on function public.unggah_pks_basah(uuid, text, date) from public, anon;
grant execute on function public.finalisasi_pks(uuid) to authenticated;
grant execute on function public.unggah_pks_basah(uuid, text, date) to authenticated;
