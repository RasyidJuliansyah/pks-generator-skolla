-- Kinerja RLS dan indeks (saran Performance Advisor Supabase, 26 Sep 2026).
--
-- KENAPA
-- 1. 16 policy memanggil auth.jwt() langsung. Postgres mengevaluasinya ULANG untuk setiap baris
--    yang dipindai. Dibungkus (select auth.jwt()) jadi InitPlan: dihitung sekali per kueri.
--    Nilainya sama persis dalam satu kueri, jadi siapa-boleh-apa TIDAK berubah. ALTER POLICY
--    (bukan drop/create) supaya peran dan perintah tiap policy tetap persis seperti di produksi;
--    teks USING/WITH CHECK diambil dari pg_policies basis data bukti, hanya auth.jwt() yang
--    dibungkus.
-- 2. Tujuh foreign key ke pengguna tanpa indeks penutup: menghapus/mengubah email pengguna
--    memindai seluruh tabel anak, dan filter "dibuat/diverifikasi oleh X" tidak punya indeks.
-- 3. po_komentar_revisi tidak punya primary key. Ditambah kolom identitas; trigger pengisinya
--    hanya menyisipkan (komentar_id, isi), jadi tidak tersentuh.
--
-- SENGAJA TIDAK: memecah policy FOR ALL "*_tulis" menjadi insert/update/delete (saran
-- multiple_permissive_policies). Itu mengubah cakupan SELECT dan bisa mengubah siapa melihat
-- baris apa; manfaatnya nyaris nol pada ukuran data ini. Indeks tak terpakai juga dibiarkan
-- (basis data masih muda).


-- 1. auth.jwt() -> (select auth.jwt())

alter policy gerbang_tulis on public.pengaturan_ekstraksi
  with check ((('admin_utama'::peran = ANY (private.peran_saya())) AND (diubah_oleh = lower(((select auth.jwt()) ->> 'email'::text)))));

alter policy pengguna_lihat_sendiri on public.pengguna
  using ((email = lower(((select auth.jwt()) ->> 'email'::text))));

alter policy pks_dok_sp_tulis on public.pks_dokumen_sponsorship
  using (('finance'::peran = ANY (private.peran_saya())))
  with check ((('finance'::peran = ANY (private.peran_saya())) AND (lower(oleh) = lower(((select auth.jwt()) ->> 'email'::text))) AND (EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = pks_dokumen_sponsorship.po_id) AND (p.versi = pks_dokumen_sponsorship.versi_po))))));

alter policy po_buat on public.po
  with check (((dibuat_oleh = lower(((select auth.jwt()) ->> 'email'::text))) AND private.punya_peran(VARIADIC ARRAY['sales'::peran, 'head_of_sales'::peran, 'admin_sales'::peran]) AND (status = 'draf'::status_po)));

alter policy po_hapus on public.po
  using (((status = 'draf'::status_po) AND (dibuat_oleh = lower(((select auth.jwt()) ->> 'email'::text)))));

alter policy po_verifikasi_lanjut on public.po
  using (((status = 'verifikasi'::status_po) AND private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::peran]) AND (dibuat_oleh <> lower(((select auth.jwt()) ->> 'email'::text)))))
  with check (((status = ANY (ARRAY['verifikasi'::status_po, 'terverifikasi'::status_po, 'ditolak'::status_po])) AND private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::peran]) AND (dibuat_oleh <> lower(((select auth.jwt()) ->> 'email'::text)))));

alter policy komentar_tulis on public.po_komentar
  with check (((EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = po_komentar.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))) AND (NOT ('c_level'::peran = ANY (private.peran_saya()))) AND (oleh = lower(((select auth.jwt()) ->> 'email'::text)))));

alter policy dibaca_milik_sendiri on public.po_komentar_dibaca
  using ((oleh = lower(((select auth.jwt()) ->> 'email'::text))))
  with check (((oleh = lower(((select auth.jwt()) ->> 'email'::text))) AND (EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = po_komentar_dibaca.po_id) AND private.boleh_lihat_po(p.dibuat_oleh))))));

alter policy sekolah_buat on public.sekolah
  with check ((private.punya_peran(VARIADIC ARRAY['sales'::peran, 'head_of_sales'::peran, 'admin_sales'::peran]) AND ((dipegang_oleh IS NULL) OR (dipegang_oleh = lower(((select auth.jwt()) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::peran, 'admin_sales'::peran]))));

alter policy sekolah_ubah on public.sekolah
  using ((private.punya_peran(VARIADIC ARRAY['sales'::peran, 'head_of_sales'::peran, 'admin_sales'::peran]) AND private.boleh_lihat_sekolah(dipegang_oleh)))
  with check ((private.punya_peran(VARIADIC ARRAY['sales'::peran, 'head_of_sales'::peran, 'admin_sales'::peran]) AND ((dipegang_oleh = lower(((select auth.jwt()) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::peran, 'admin_sales'::peran]))));

alter policy surat_sunting on public.surat_verifikasi
  using ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::peran]) AND (final_pada IS NULL) AND (NOT otomatis)))
  with check ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::peran]) AND (NOT otomatis) AND (ditandatangani_oleh = lower(((select auth.jwt()) ->> 'email'::text)))));

alter policy surat_terbit on public.surat_verifikasi
  with check ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::peran]) AND (NOT otomatis) AND (ditandatangani_oleh = lower(((select auth.jwt()) ->> 'email'::text))) AND (final_pada IS NULL) AND (EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = surat_verifikasi.po_id) AND (p.status = 'terverifikasi'::status_po))))));

alter policy ttd_bubuh on public.tanda_tangan
  with check (((dibubuhkan_oleh = lower(((select auth.jwt()) ->> 'email'::text))) AND (EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = tanda_tangan.po_id) AND (p.status = 'menunggu_ttd'::status_po) AND ((p.dibuat_oleh = lower(((select auth.jwt()) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::peran, 'admin_sales'::peran])))))));

alter policy ttd_hapus on public.tanda_tangan
  using ((EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = tanda_tangan.po_id) AND (p.status = 'menunggu_ttd'::status_po) AND ((p.dibuat_oleh = lower(((select auth.jwt()) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::peran, 'admin_sales'::peran]))))));

alter policy verifikasi_putuskan on public.verifikasi
  with check (((oleh = lower(((select auth.jwt()) ->> 'email'::text))) AND private.fungsi_saya_cocok(fungsi) AND (EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = verifikasi.po_id) AND (p.status = 'verifikasi'::status_po))))));

alter policy verifikasi_ubah on public.verifikasi
  using ((berlaku AND private.fungsi_saya_cocok(fungsi) AND (EXISTS ( SELECT 1
   FROM po p
  WHERE ((p.id = verifikasi.po_id) AND (p.status = 'verifikasi'::status_po))))))
  with check (((oleh = lower(((select auth.jwt()) ->> 'email'::text))) AND private.fungsi_saya_cocok(fungsi)));


-- 2. Indeks foreign key
create index if not exists pks_dibuat_oleh_idx on public.pks (dibuat_oleh);
create index if not exists pks_diunggah_oleh_idx on public.pks (diunggah_oleh);
create index if not exists po_diverifikasi_oleh_idx on public.po (diverifikasi_oleh);
create index if not exists sekolah_dipegang_oleh_idx on public.sekolah (dipegang_oleh);
create index if not exists surat_verifikasi_ditandatangani_oleh_idx on public.surat_verifikasi (ditandatangani_oleh);
create index if not exists tanda_tangan_dibubuhkan_oleh_idx on public.tanda_tangan (dibubuhkan_oleh);
create index if not exists verifikasi_oleh_idx on public.verifikasi (oleh);

-- 3. Primary key po_komentar_revisi
alter table public.po_komentar_revisi
  add column if not exists id bigint generated always as identity primary key;
