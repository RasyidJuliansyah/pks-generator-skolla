\set ON_ERROR_STOP on
-- Pembantu: sesi sebagai pengguna berperan tertentu.
create or replace function pg_temp.sebagai(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Pengguna fikstur (sekali, di luar probe; basis data lokal dibuang sesudahnya).
insert into pengguna (email, nama, peran, aktif) values
  ('sales@uji', 'Sales Uji', '{sales}', true),
  ('rh@uji', 'RH Uji', '{regional_head}', true),
  ('hos@uji', 'HoS Uji', '{head_of_sales}', true)
on conflict (email) do nothing;
-- Data sekolah lengkap: sekolah_beku disegarkan dari baris ini setiap status PO berpindah
-- (po_bekukan_sekolah), jadi nama kepala sekolah di tanda tangan unggahan datang dari sini.
insert into sekolah (id, nama, jenjang, npsn, dipegang_oleh, kepala_sekolah, kepsek_hp, bendahara, bendahara_hp)
  values ('00000000-0000-0000-0000-00000000a001', 'SMA UJI', 'SMA', '99990001', 'sales@uji', 'KS', '1', 'B', '1')
on conflict do nothing;

-- P1: PO LAMA (skema 3) maju ke ditandatangani dengan tiga tanda tangan.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'menunggu_ttd', 'platform', 3, 1000, 1, 1000);
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh) values
    ('00000000-0000-0000-0000-0000000000c1', 'kepala_sekolah', 'KS', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c1', 'partnership_manager', 'PM', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c1', 'sales_manager', 'SM', 'x', 'sales@uji');
  set local session_replication_role = origin;
  update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000c1';
  do $$ begin raise notice 'P1 OK: skema 3 lolos dengan tiga tanda tangan'; end $$;
rollback;

-- P2: PO BARU (skema 4) ditolak di 3 dari 4, lolos di 4 dari 4.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'menunggu_ttd', 'platform', 4, 1000, 1, 1000);
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh) values
    ('00000000-0000-0000-0000-0000000000c2', 'kepala_sekolah', 'KS', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c2', 'partnership_manager', 'PM', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c2', 'sales_manager', 'HoS', 'x', 'sales@uji');
  set local session_replication_role = origin;
  do $$ begin
    begin
      update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000c2';
      raise exception 'P2 GAGAL: skema 4 lolos dengan tiga tanda tangan';
    exception when check_violation then
      if sqlerrm not like '%3 dari 4%' then raise exception 'P2 GAGAL: pesan tak menyebut 3 dari 4: %', sqlerrm; end if;
    end;
  end $$;
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh) values
    ('00000000-0000-0000-0000-0000000000c2', 'regional_head', 'RH', 'x', 'sales@uji');
  update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000c2';
  do $$ begin raise notice 'P2 OK: 3/4 ditolak, 4/4 lolos'; end $$;
rollback;

-- P3: skema tidak bisa diubah lewat PostgREST oleh Sales, ke arah mana pun.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'draf', 'platform', 4, 1000, 1, 1000),
           ('00000000-0000-0000-0000-000000000c3b', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'draf', 'platform', 3, 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('sales@uji');
  do $$ begin
    begin update po set skema_ttd = 3 where id = '00000000-0000-0000-0000-0000000000c3';
      raise exception 'P3 GAGAL: 4 -> 3 lolos';
    exception when check_violation then null; end;
    begin update po set skema_ttd = 4 where id = '00000000-0000-0000-0000-000000000c3b';
      raise exception 'P3 GAGAL: 3 -> 4 lolos';
    exception when check_violation then null; end;
    raise notice 'P3 OK: skema beku sejak lahir';
  end $$;
rollback;

-- P4: PO platform tidak bisa lahir skema 3; PO unggahan boleh (centang form lama).
begin;
  select pg_temp.sebagai('sales@uji');
  insert into po (id, sekolah_id, dibuat_oleh, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'platform', 3, 0, 0, 0),
           ('00000000-0000-0000-0000-000000000c4b', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'unggahan', 3, 0, 0, 0),
           ('00000000-0000-0000-0000-000000000c4c', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'unggahan', 4, 0, 0, 0);
  do $$ declare a int; b int; c int; begin
    select skema_ttd into a from po where id = '00000000-0000-0000-0000-0000000000c4';
    select skema_ttd into b from po where id = '00000000-0000-0000-0000-000000000c4b';
    select skema_ttd into c from po where id = '00000000-0000-0000-0000-000000000c4c';
    if (a, b, c) is distinct from (4, 3, 4) then raise exception 'P4 GAGAL: % % %', a, b, c; end if;
    raise notice 'P4 OK: platform selalu 4, unggahan boleh 3';
  end $$;
rollback;

-- P5: nama_rh kosong menahan PO skema 4 keluar draf; PO skema 3 tidak menuntutnya.
-- Keluar draf memicu syarat lain (termin, masa aktif, isian sekolah); fikstur memenuhi semuanya.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa,
                  masa_mulai, masa_selesai, versi_iom, sekolah_beku, nama_pm, nama_sm)
    select v.id::uuid, '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'platform', v.skema, 1000, 1, 1000,
           '2026-10-01', '2027-09-30', null,
           '{"npsn":"1","kepala_sekolah":"KS","kepsek_hp":"1","bendahara":"B","bendahara_hp":"1"}'::jsonb, 'PM', 'HoS'
      from (values ('00000000-0000-0000-0000-0000000000c5', 4), ('00000000-0000-0000-0000-000000000c5b', 3)) v(id, skema);
  insert into po_termin (po_id, urutan, nominal, tanggal) values
    ('00000000-0000-0000-0000-0000000000c5', 1, 1000, '2026-10-15'),
    ('00000000-0000-0000-0000-000000000c5b', 1, 1000, '2026-10-15');
  set local session_replication_role = origin;
  do $$ begin
    begin update po set status = 'menunggu_ttd' where id = '00000000-0000-0000-0000-0000000000c5';
      raise exception 'P5 GAGAL: skema 4 tanpa Regional Head keluar draf';
    exception when check_violation then
      if sqlerrm not like '%Regional Head Division belum dipilih%' then raise exception 'P5 GAGAL: %', sqlerrm; end if;
    end;
    update po set status = 'menunggu_ttd' where id = '00000000-0000-0000-0000-000000000c5b';
    raise notice 'P5 OK: Regional Head wajib hanya di skema 4';
  end $$;
rollback;

-- P6: nama_rh dan skema_ttd beku pada PO yang sudah diteken.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, nama_rh, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'ditandatangani', 'platform', 4, 'RH Uji', 1000, 1, 1000);
  set local session_replication_role = origin;
  do $$ begin
    begin update po set nama_rh = 'Orang Lain' where id = '00000000-0000-0000-0000-0000000000c6';
      raise exception 'P6 GAGAL: nama_rh berubah pada PO diteken';
    exception when others then
      if sqlerrm like 'P6 GAGAL%' then raise; end if;
    end;
    raise notice 'P6 OK: nama_rh beku';
  end $$;
rollback;

-- P7: ajukan_po_unggahan menyisipkan empat penanda pada skema 4 dan tiga pada skema 3.
-- (Skema 3 dan 4 dibuktikan dalam dua transaksi; fikstur memenuhi syarat keluar draf dan sidik.)
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa,
                  masa_mulai, masa_selesai, sekolah_beku, nama_pm, nama_sm, nama_rh, berkas_unggahan)
    values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan', 4,
            1000, 1, 1000, '2026-10-01', '2027-09-30',
            '{"npsn":"1","kepala_sekolah":"KS","kepsek_hp":"1","bendahara":"B","bendahara_hp":"1"}'::jsonb,
            'PM', 'HoS', 'RH Uji', '00000000-0000-0000-0000-0000000000c7/po.pdf');
  insert into po_termin (po_id, urutan, nominal, tanggal) values ('00000000-0000-0000-0000-0000000000c7', 1, 1000, '2026-10-15');
  set local session_replication_role = origin;
  update po set ditinjau_pada = now(), ditinjau_oleh = 'sales@uji' where id = '00000000-0000-0000-0000-0000000000c7';
  select pg_temp.sebagai('sales@uji');
  select ajukan_po_unggahan('00000000-0000-0000-0000-0000000000c7');
  do $$ declare daftar text; begin
    select string_agg(pihak::text || '=' || nama, ',' order by pihak) into daftar
      from tanda_tangan where po_id = '00000000-0000-0000-0000-0000000000c7';
    if daftar is distinct from 'kepala_sekolah=KS,partnership_manager=PM,regional_head=RH Uji,sales_manager=HoS' then
      raise exception 'P7 GAGAL: %', daftar; end if;
    raise notice 'P7 OK: unggahan skema 4 = empat penanda';
  end $$;
rollback;
-- P7b: sama, skema 3 dan tanpa nama_rh -> tiga penanda.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa,
                  masa_mulai, masa_selesai, sekolah_beku, nama_pm, nama_sm, berkas_unggahan)
    values ('00000000-0000-0000-0000-000000000c7b', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan', 3,
            1000, 1, 1000, '2026-10-01', '2027-09-30',
            '{"npsn":"1","kepala_sekolah":"KS","kepsek_hp":"1","bendahara":"B","bendahara_hp":"1"}'::jsonb,
            'PM', 'SM', '00000000-0000-0000-0000-000000000c7b/po.pdf');
  insert into po_termin (po_id, urutan, nominal, tanggal) values ('00000000-0000-0000-0000-000000000c7b', 1, 1000, '2026-10-15');
  set local session_replication_role = origin;
  update po set ditinjau_pada = now(), ditinjau_oleh = 'sales@uji' where id = '00000000-0000-0000-0000-000000000c7b';
  select pg_temp.sebagai('sales@uji');
  select ajukan_po_unggahan('00000000-0000-0000-0000-000000000c7b');
  do $$ declare n int; begin
    select count(*) into n from tanda_tangan where po_id = '00000000-0000-0000-0000-000000000c7b';
    if n <> 3 then raise exception 'P7b GAGAL: % penanda', n; end if;
    raise notice 'P7b OK: unggahan skema 3 = tiga penanda';
  end $$;
rollback;

-- P8: akun yang hanya berperan regional_head melihat semua PO dan harga Acquisition,
-- dan ditolak di jalur tulis.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'menunggu_ttd', 'platform', 4, 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('rh@uji');
  do $$ declare n int; begin
    select count(*) into n from po where id = '00000000-0000-0000-0000-0000000000c8';
    if n <> 1 then raise exception 'P8 GAGAL: regional_head tidak melihat PO'; end if;
    if not private.boleh_lihat_acquisition() then raise exception 'P8 GAGAL: tidak melihat Acquisition'; end if;
    update po set kota = 'X' where id = '00000000-0000-0000-0000-0000000000c8';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'P8 GAGAL: regional_head menyunting PO'; end if;
    begin
      insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh)
        values ('00000000-0000-0000-0000-0000000000c8', 'regional_head', 'RH', 'x', 'rh@uji');
      raise exception 'P8 GAGAL: regional_head membubuhkan tanda tangan';
    exception when insufficient_privilege then null; end;
    begin
      insert into po (sekolah_id, dibuat_oleh, asal) values ('00000000-0000-0000-0000-00000000a001', 'rh@uji', 'platform');
      raise exception 'P8 GAGAL: regional_head membuat PO';
    exception when insufficient_privilege then null; end;
    raise notice 'P8 OK: regional_head baca-saja, termasuk Acquisition';
  end $$;
rollback;

-- P9: sidik draf unggahan yang sudah ditinjau TIDAK berubah karena kolom baru.
-- Dijalankan siapkan.sh DUA KALI: sekali tanpa migrasi 20260925b (mencatat sidik ke
-- /tmp di dalam container), sekali dengan (membandingkan). Lihat langkah 5.

-- P8b (temuan QA akhir): regional_head juga ditolak di verifikasi, surat, PKS, dan sekolah.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-000000000c8b', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'verifikasi', 'platform', 4, 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('rh@uji');
  do $$ declare n int; begin
    begin
      insert into verifikasi (po_id, fungsi, hasil, oleh, versi_po)
        values ('00000000-0000-0000-0000-000000000c8b', 'finance', 'setuju', 'rh@uji', 1);
      raise exception 'P8b GAGAL: regional_head memberi verifikasi';
    exception when insufficient_privilege or check_violation then null; end;
    begin
      insert into surat_verifikasi (po_id, ditandatangani_oleh, nama_penanda)
        values ('00000000-0000-0000-0000-000000000c8b', 'rh@uji', 'RH');
      raise exception 'P8b GAGAL: regional_head membuat surat';
    exception when insufficient_privilege or check_violation then null; end;
    begin
      insert into pks (po_id, tahun, dibuat_oleh) values ('00000000-0000-0000-0000-000000000c8b', 2026, 'rh@uji');
      raise exception 'P8b GAGAL: regional_head membuat PKS';
    exception when insufficient_privilege or check_violation then null; end;
    update sekolah set nama = 'DIUBAH RH' where id = '00000000-0000-0000-0000-00000000a001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'P8b GAGAL: regional_head menyunting sekolah'; end if;
    begin
      insert into sekolah (nama, jenjang) values ('SEKOLAH RH', 'SMA');
      raise exception 'P8b GAGAL: regional_head membuat sekolah';
    exception when insufficient_privilege or check_violation then null; end;
    raise notice 'P8b OK: regional_head ditolak di verifikasi, surat, PKS, sekolah';
  end $$;
rollback;

-- P11: regional_head BOLEH berkomentar (keputusan Rizki 25 Sep 2026); C Level tetap tidak.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'draf', 'platform', 4, 1000, 1, 1000);
  set local session_replication_role = origin;
  insert into pengguna (email, nama, peran, aktif) values ('cl@uji', 'CL Uji', '{c_level}', true)
    on conflict (email) do nothing;
  select pg_temp.sebagai('rh@uji');
  insert into po_komentar (po_id, isi, oleh) values ('00000000-0000-0000-0000-000000000c11', 'komentar RH', 'rh@uji');
  select pg_temp.sebagai('cl@uji');
  do $$ begin
    begin
      insert into po_komentar (po_id, isi, oleh) values ('00000000-0000-0000-0000-000000000c11', 'komentar CL', 'cl@uji');
      raise exception 'P11 GAGAL: C Level menulis komentar';
    exception when insufficient_privilege or check_violation then
      if sqlerrm like 'P11 GAGAL%' then raise; end if;
    end;
    raise notice 'P11 OK: regional_head berkomentar, C Level tetap ditolak';
  end $$;
rollback;

-- P12 (temuan QA akhir): PO skema 3 tidak bisa berganti asal, jadi PO platform tidak bisa
-- berakhir tiga penanda tangan lewat unggahan-form-lama yang dibalik ke platform.
begin;
  select pg_temp.sebagai('sales@uji');
  insert into po (id, sekolah_id, dibuat_oleh, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-000000000c12', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'unggahan', 3, 0, 0, 0);
  do $$ begin
    begin update po set asal = 'platform' where id = '00000000-0000-0000-0000-000000000c12';
      raise exception 'P12 GAGAL: unggahan skema 3 berganti jadi platform';
    exception when check_violation then null; end;
    raise notice 'P12 OK: asal PO skema 3 beku';
  end $$;
rollback;
