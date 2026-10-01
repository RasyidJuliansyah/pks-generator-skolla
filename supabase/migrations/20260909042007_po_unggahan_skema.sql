alter table po add column if not exists asal text not null default 'platform'
  check (asal in ('platform', 'unggahan'));
alter table po add column if not exists berkas_unggahan text;
alter table po add column if not exists ditinjau_pada timestamptz;
alter table po add column if not exists ditinjau_oleh text;

comment on column po.asal is
  'platform = dibuat lewat aplikasi; unggahan = diisi manual di kertas lalu dipindai.';
comment on column po.ditinjau_pada is
  'Saat Sales menyatakan data hasil tinjauan sesuai dengan pindaian.';

alter table tanda_tangan add column if not exists asal text not null default 'aplikasi'
  check (asal in ('aplikasi', 'pindaian'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('po-unggahan', 'po-unggahan', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists po_unggahan_baca on storage.objects;
create policy po_unggahan_baca on storage.objects for select to authenticated
using (
  bucket_id = 'po-unggahan'
  and exists (select 1 from po p
              where p.id::text = split_part(storage.objects.name, '/', 1)
                and private.boleh_lihat_po(p.dibuat_oleh))
);

drop policy if exists po_unggahan_tulis on storage.objects;
create policy po_unggahan_tulis on storage.objects for insert to authenticated
with check (
  bucket_id = 'po-unggahan'
  and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
  and exists (select 1 from po p
              where p.id::text = split_part(storage.objects.name, '/', 1)
                and private.milik_sales(p.dibuat_oleh)
                and p.status in ('draf', 'ditolak'))
);

drop policy if exists po_unggahan_ganti on storage.objects;
create policy po_unggahan_ganti on storage.objects for update to authenticated
using (
  bucket_id = 'po-unggahan'
  and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
  and exists (select 1 from po p
              where p.id::text = split_part(storage.objects.name, '/', 1)
                and private.milik_sales(p.dibuat_oleh)
                and p.status in ('draf', 'ditolak'))
);

create or replace function private.bekukan_isi_po()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;
