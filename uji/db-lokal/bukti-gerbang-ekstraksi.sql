\set ON_ERROR_STOP on
-- Bukti gerbang ekstraksi dan penanda `dibaca_ai_pada` (catatan/25 Tugas 1).
-- Setiap probe berjalan di dalam transaksi yang dibatalkan; pola bukti-empat-ttd.sql.
-- P9 tidak ada di sini: ia sudah punya rumah di bukti-sidik.sql (catat/banding).
create or replace function pg_temp.sebagai(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.sebagai_super() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;

insert into pengguna (email, nama, peran, aktif) values
  ('sales@uji', 'Sales Uji', '{sales}', true),
  ('super@uji', 'Super Uji', '{admin_utama}', true)
on conflict (email) do nothing;
insert into sekolah (id, nama, jenjang, npsn, dipegang_oleh, kepala_sekolah, kepsek_hp, bendahara, bendahara_hp)
  values ('00000000-0000-0000-0000-00000000a001', 'SMA UJI', 'SMA', '99990001', 'sales@uji', 'KS', '1', 'B', '1')
on conflict do nothing;

-- P1: gerbang MATI secara bawaan, dan menyalakannya tanpa penerima risiko ditolak basis data.
begin;
  select pg_temp.sebagai('super@uji');
  do $$ begin
    begin
      insert into pengaturan_ekstraksi (menyala, penyedia, model, diubah_oleh)
        values (true, 'OpenCode', 'x', 'super@uji');
      raise exception 'P1 GAGAL: gerbang menyala tanpa penerima risiko';
    exception when check_violation then null; end;
  end $$;
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  do $$ begin raise notice 'P1 OK: menyalakan tanpa penerima risiko ditolak'; end $$;
rollback;

-- P1b: menyalakan DENGAN enam isian lengkap diterima, dan baris terakhir yang berlaku.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'deepseek-v4.1-flash', 'pelatihan dimatikan',
            'Rizki', 'tanpa DPA, diterima', 'super@uji');
  do $$ declare v boolean; begin
    select menyala into v from pengaturan_ekstraksi order by id desc limit 1;
    if v is not true then raise exception 'P1b GAGAL: baris terakhir tidak berlaku'; end if;
    raise notice 'P1b OK: gerbang lengkap bisa dinyalakan, baris terakhir yang berlaku';
  end $$;
rollback;

-- P2: Sales tidak bisa membaca maupun menulis riwayat gerbang.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  select pg_temp.sebagai('sales@uji');
  do $$
  declare v int;
  begin
    select count(*) into v from pengaturan_ekstraksi;
    if v <> 0 then raise exception 'P2 GAGAL: Sales membaca % baris gerbang', v; end if;
    begin
      insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (true, 'sales@uji');
      raise exception 'P2 GAGAL: Sales menulis riwayat gerbang';
    exception when insufficient_privilege then null; end;
    raise notice 'P2 OK: gerbang tertutup bagi Sales, baca maupun tulis';
  end $$;
rollback;

-- P2b: Super Admin tidak bisa mengaku orang lain: diubah_oleh diambil dari sesi, bukan isian.
begin;
  select pg_temp.sebagai('super@uji');
  do $$ begin
    begin
      insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'sales@uji');
      raise exception 'P2b GAGAL: diubah_oleh boleh diisi nama orang lain';
    exception when insufficient_privilege then null; end;
    raise notice 'P2b OK: diubah_oleh terikat email pemanggil';
  end $$;
rollback;

-- P2c: Sales TIDAK membaca tabelnya, tetapi BISA membaca keadaannya lewat satu fungsi.
-- Ini yang membuat kotak "Baca scan" muncul bagi orang yang memang memakainya: halaman Form PO
-- dirender dengan sesi Sales, dan RLS tabel gerbang hanya untuk Super Admin.
begin;
  do $$ declare v boolean; begin
    perform pg_temp.sebagai('sales@uji');
    select public.gerbang_ekstraksi_menyala() into v;
    if v is not false then raise exception 'P2c GAGAL: gerbang tanpa baris tidak terbaca mati'; end if;
  end $$;
  -- Baris menyala yang sah menuntut enam isian (batasan gerbang_lengkap), jadi disisipkan
  -- sebagai superuser lewat tabelnya, lalu dibaca lagi dari sesi Sales.
  select pg_temp.sebagai_super();
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$ declare v boolean; n int; begin
    perform pg_temp.sebagai('sales@uji');
    select public.gerbang_ekstraksi_menyala() into v;
    if v is not true then raise exception 'P2c GAGAL: Sales tidak melihat gerbang menyala'; end if;
    select count(*) into n from pengaturan_ekstraksi;
    if n <> 0 then raise exception 'P2c GAGAL: Sales membaca % baris gerbang', n; end if;
    raise notice 'P2c OK: keadaan gerbang terbaca bagi Sales, tabelnya tetap tertutup';
  end $$;
rollback;

-- P3: dibaca_ai_pada hanya boleh diisi basis data; Sales ditolak mengisi DAN mengosongkan.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('sales@uji');
  do $$ begin
    begin
      update po set dibaca_ai_pada = now() where id = '00000000-0000-0000-0000-0000000000e1';
      raise exception 'P3 GAGAL: Sales mengisi dibaca_ai_pada';
    exception when check_violation then null; end;
  end $$;
  -- Lewat jalur yang diizinkan basis data (setelan transaksi), lalu dicoba dikosongkan lagi.
  set local app.penanda_ekstraksi = '1';
  update po set dibaca_ai_pada = now() where id = '00000000-0000-0000-0000-0000000000e1';
  set local app.penanda_ekstraksi = '';
  do $$ begin
    begin
      update po set dibaca_ai_pada = null where id = '00000000-0000-0000-0000-0000000000e1';
      raise exception 'P3 GAGAL: Sales mengosongkan dibaca_ai_pada';
    exception when check_violation then null; end;
    raise notice 'P3 OK: penanda isian AI tidak bisa dipalsukan maupun dihapus Sales';
  end $$;
rollback;

-- P4: PO yang sudah keluar draf tidak bisa ditulisi penanda lagi. Pembekuan berlaku lebih dulu
-- daripada izin penanda transaksi: menyetel `app.penanda_ekstraksi` TIDAK melewati pembekuan,
-- dan itu memang yang diinginkan -- jejaknya harus menempel pada isi yang sudah dibekukan.
-- (Urutan penyetelan status di sini sengaja memakai `replica` seperti bukti-empat-ttd.sql P6:
-- PO ditandatangani lahir langsung, supaya probe ini soal pembekuan, bukan soal jalur tanda
-- tangan yang sudah punya pembuktiannya sendiri.)
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'ditandatangani', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('sales@uji');
  set local app.penanda_ekstraksi = '1';
  do $$ begin
    begin
      update po set dibaca_ai_pada = now() where id = '00000000-0000-0000-0000-0000000000e2';
      raise exception 'P4 GAGAL: penanda berubah pada PO yang sudah diteken';
    -- `bekukan_isi_po` melempar TANPA errcode, jadi galatnya P0001 (raise_exception), bukan
    -- check_violation. Menangkapnya dengan `when others` lalu menyaring penanda GAGAL sendiri
    -- adalah pola yang sudah dipakai bukti-empat-ttd.sql P6.
    exception when others then
      if sqlerrm like 'P4 GAGAL%' then raise; end if;
    end;
    raise notice 'P4 OK: penanda beku pada PO yang sudah keluar draf, walau penanda transaksi dipasang';
  end $$;
rollback;

-- P5: gerbang adalah RIWAYAT -- baris lama tidak bisa disunting siapa pun, termasuk Super Admin.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  do $$ declare v int; begin
    update pengaturan_ekstraksi set menyala = true where menyala = false;
    get diagnostics v = row_count;
    if v <> 0 then raise exception 'P5 GAGAL: % baris gerbang disunting', v; end if;
    delete from pengaturan_ekstraksi;
    get diagnostics v = row_count;
    if v <> 0 then raise exception 'P5 GAGAL: % baris gerbang dihapus', v; end if;
    raise notice 'P5 OK: riwayat gerbang tidak bisa disunting maupun dihapus';
  end $$;
rollback;

-- P6: model dipaku di basis data dan tidak bisa dipanggil klien; fungsinya bukan endpoint.
-- Diperiksa lewat hak akses katalog, BUKAN dengan memanggilnya: fungsinya `language sql
-- immutable` yang mengembalikan konstanta, jadi perencana boleh menyisipkannya (inlining) dan
-- pemeriksaan izinnya ikut hilang -- probe yang memanggilnya akan hijau tanpa membuktikan apa pun.
begin;
  do $$ begin
    if has_function_privilege('authenticated', 'private.model_ekstraksi()', 'execute') then
      raise exception 'P6 GAGAL: authenticated masih boleh memanggil model_ekstraksi';
    end if;
    if has_function_privilege('anon', 'private.model_ekstraksi()', 'execute') then
      raise exception 'P6 GAGAL: anon masih boleh memanggil model_ekstraksi';
    end if;
    raise notice 'P6 OK: nama model dipaku di basis data, EXECUTE dicabut dari anon dan authenticated';
  end $$;
rollback;
