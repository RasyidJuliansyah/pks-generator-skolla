create type pihak_ttd as enum ('kepala_sekolah', 'partnership_manager', 'sales_manager');

create table tanda_tangan (
  po_id       uuid not null references po(id) on delete cascade,
  pihak       pihak_ttd not null,
  nama        text not null,
  berkas      text not null,              -- jalur di bucket privat 'tanda-tangan'
  dibubuhkan_oleh text not null references pengguna(email),
  waktu       timestamptz not null default now(),
  primary key (po_id, pihak)
);

comment on table tanda_tangan is
  'Tanda tangan digital pada PO. Data pribadi — berkasnya di bucket privat, '
  'retensi belum ditetapkan (lihat catatan UU PDP di spesifikasi).';

alter table tanda_tangan enable row level security;

create policy ttd_lihat on tanda_tangan for select to authenticated
  using (exists (select 1 from po p where p.id = tanda_tangan.po_id
                  and private.boleh_lihat_po(p.dibuat_oleh)));

-- Membubuhkan hanya boleh saat PO sedang menunggu tanda tangan, dan hanya oleh
-- pihak yang berhak menyunting PO itu (sales pembuatnya, Head of Sales, Admin Sales).
create policy ttd_bubuh on tanda_tangan for insert to authenticated
  with check (
    dibubuhkan_oleh = lower(auth.jwt() ->> 'email')
    and exists (
      select 1 from po p
       where p.id = tanda_tangan.po_id
         and p.status = 'menunggu_ttd'
         and (p.dibuat_oleh = lower(auth.jwt() ->> 'email')
              or private.punya_peran('head_of_sales', 'admin_sales'))
    )
  );

-- Menghapus dipakai untuk mengulang tanda tangan yang keliru, syarat sama.
create policy ttd_hapus on tanda_tangan for delete to authenticated
  using (
    exists (
      select 1 from po p
       where p.id = tanda_tangan.po_id
         and p.status = 'menunggu_ttd'
         and (p.dibuat_oleh = lower(auth.jwt() ->> 'email')
              or private.punya_peran('head_of_sales', 'admin_sales'))
    )
  );

-- Bucket privat. Tidak ada akses publik sama sekali; berkas hanya dibaca lewat
-- URL bertanda tangan berumur pendek.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tanda-tangan', 'tanda-tangan', false, 524288, array['image/png'])
on conflict (id) do nothing;

create policy ttd_berkas_baca on storage.objects for select to authenticated
  using (bucket_id = 'tanda-tangan' and private.peran_saya() <> '{}');

create policy ttd_berkas_tulis on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tanda-tangan'
    and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
  );

create policy ttd_berkas_hapus on storage.objects for delete to authenticated
  using (
    bucket_id = 'tanda-tangan'
    and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
  );
