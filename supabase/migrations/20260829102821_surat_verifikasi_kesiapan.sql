-- Surat Verifikasi Kesiapan berdiri sebagai dokumen sendiri, bukan menumpang di
-- tabel tanda_tangan: aturan tabel itu terikat status 'menunggu_ttd' dan peran
-- sales, dan memakainya ulang berarti melonggarkan penjagaan tanda tangan PO.
--
-- final_pada kosong = masih draf dan boleh disunting. Begitu diisi, surat
-- terkunci dan menjadi syarat PKS boleh dibuat.
create table surat_verifikasi (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null unique references po(id) on delete cascade,
  ditandatangani_oleh text not null references pengguna(email),
  -- Nama disalin, bukan dirujuk: surat yang sudah terbit tidak boleh berubah
  -- isinya hanya karena nama di daftar pengguna disunting.
  nama_penanda text not null,
  berkas text,
  dibuat_pada timestamptz not null default now(),
  final_pada timestamptz
);

comment on column surat_verifikasi.final_pada is
  'Kosong = draf. Terisi = surat terkunci dan PKS boleh dibuat.';

alter table surat_verifikasi enable row level security;

create policy surat_lihat on surat_verifikasi for select to authenticated
  using (exists (
    select 1 from po p where p.id = surat_verifikasi.po_id
      and private.boleh_lihat_po(p.dibuat_oleh)));

create policy surat_terbit on surat_verifikasi for insert to authenticated
  with check (
    private.punya_peran('tech_ops_lead')
    and ditandatangani_oleh = lower(auth.jwt() ->> 'email')
    and final_pada is null
    and exists (select 1 from po p
                 where p.id = surat_verifikasi.po_id and p.status = 'terverifikasi'));

-- USING menilai baris lama: surat yang sudah final tidak bisa disentuh lagi.
create policy surat_sunting on surat_verifikasi for update to authenticated
  using (private.punya_peran('tech_ops_lead') and final_pada is null)
  with check (private.punya_peran('tech_ops_lead')
    and ditandatangani_oleh = lower(auth.jwt() ->> 'email'));

create policy surat_batal on surat_verifikasi for delete to authenticated
  using (private.punya_peran('tech_ops_lead') and final_pada is null);

-- Berkas tanda tangan surat disimpan di awalan surat/ pada bucket yang sama,
-- dan izinnya dibatasi ke awalan itu supaya tidak bisa menimpa tanda tangan PO.
create policy surat_berkas_tulis on storage.objects for insert to authenticated
  with check (bucket_id = 'tanda-tangan'
    and name like 'surat/%' and private.punya_peran('tech_ops_lead'));

create policy surat_berkas_ganti on storage.objects for update to authenticated
  using (bucket_id = 'tanda-tangan'
    and name like 'surat/%' and private.punya_peran('tech_ops_lead'));

create policy surat_berkas_hapus on storage.objects for delete to authenticated
  using (bucket_id = 'tanda-tangan'
    and name like 'surat/%' and private.punya_peran('tech_ops_lead'));
