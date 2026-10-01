\set ON_ERROR_STOP on
-- Bukti migrasi 20260927010000 (kinerja RLS + indeks). Mode :mode = 'catat' | 'banding'.
-- Sidik = SELURUH policy schema public (bukan hanya 16 yang diubah): peran, perintah, permissive,
-- USING, WITH CHECK. Sesudah migrasi, bungkus (select auth.jwt()) dikupas lalu harus identik.
create table if not exists sidik_policy (kunci text primary key, isi text);
\if :{?mode}
\else
\set mode catat
\endif
select (:'mode' = 'catat') as catat \gset
\if :catat
  truncate sidik_policy;
  insert into sidik_policy
    select tablename || '.' || policyname,
           concat_ws(' | ', permissive, roles::text, cmd, qual, with_check)
      from pg_policies where schemaname = 'public';
  \echo 'sidik policy dicatat'
\else
  do $$
  declare n_lama int; n_beda int; n_telanjang int; n_indeks int; r record;
  begin
    select count(*) into n_lama from sidik_policy;
    for r in
      select coalesce(s.kunci, b.kunci) kunci
        from sidik_policy s
        full join (select tablename || '.' || policyname kunci,
                          replace(concat_ws(' | ', permissive, roles::text, cmd, qual, with_check),
                                  '( SELECT auth.jwt() AS jwt)', 'auth.jwt()') isi
                     from pg_policies where schemaname = 'public') b using (kunci)
       where s.isi is distinct from b.isi
    loop raise warning 'BEDA: %', r.kunci; end loop;
    get diagnostics n_beda = row_count;
    select count(*) into n_beda from sidik_policy s
      full join (select tablename || '.' || policyname kunci,
                        replace(concat_ws(' | ', permissive, roles::text, cmd, qual, with_check),
                                '( SELECT auth.jwt() AS jwt)', 'auth.jwt()') isi
                   from pg_policies where schemaname = 'public') b using (kunci)
     where s.isi is distinct from b.isi;
    if n_beda > 0 then raise exception 'K1 GAGAL: % policy berubah makna', n_beda; end if;
    raise notice 'K1 OK: % policy identik setelah bungkus dikupas', n_lama;

    select count(*) into n_telanjang from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.(jwt|uid)\(\)';
    if n_telanjang > 0 then raise exception 'K2 GAGAL: % policy masih memanggil auth.* per baris', n_telanjang; end if;
    raise notice 'K2 OK: tidak ada auth.jwt()/auth.uid() telanjang';

    select count(*) into n_indeks from pg_indexes where schemaname = 'public' and indexname in (
      'pks_dibuat_oleh_idx', 'pks_diunggah_oleh_idx', 'po_diverifikasi_oleh_idx',
      'sekolah_dipegang_oleh_idx', 'surat_verifikasi_ditandatangani_oleh_idx',
      'tanda_tangan_dibubuhkan_oleh_idx', 'verifikasi_oleh_idx');
    if n_indeks <> 7 then raise exception 'K3 GAGAL: indeks FK % dari 7', n_indeks; end if;
    raise notice 'K3 OK: 7 indeks FK ada';

    if not exists (select 1 from pg_constraint where conrelid = 'public.po_komentar_revisi'::regclass and contype = 'p')
      then raise exception 'K4 GAGAL: po_komentar_revisi tanpa primary key'; end if;
    raise notice 'K4 OK: po_komentar_revisi punya primary key';
  end $$;
\endif
