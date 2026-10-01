\set ON_ERROR_STOP on
-- Bukti tiga RPC ekstraksi (catatan/25 Tugas 2). Setiap probe di dalam transaksi yang dibatalkan.
--
-- Dua pembantu, dan yang kedua bukan hiasan. `ekstraksi_po` tidak punya policy tulis, jadi
-- fikstur dan pergeseran waktu HARUS dikerjakan sebagai superuser: sebagai `authenticated`,
-- RLS menolaknya tanpa galat (0 baris), dan probe yang mengira dirinya menyiapkan keadaan akan
-- lulus tanpa menguji apa pun.
create or replace function pg_temp.sebagai(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.sebagai_super() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;
-- `perform`, bukan `select`: plpgsql menuntut INTO pada SELECT, dan tanpa itu bloknya gagal
-- "query has no destination for result data" -- probe yang tidak pernah menguji apa pun.
create or replace function pg_temp.tolak(p_isi text) returns void language plpgsql as $$
begin
  begin execute p_isi; raise exception 'GAGAL: % seharusnya ditolak', p_isi;
  exception when check_violation or insufficient_privilege then null; end;
end $$;

insert into pengguna (email, nama, peran, aktif) values
  ('sales@uji', 'Sales Uji', '{sales}', true),
  ('sales2@uji', 'Sales Dua', '{sales}', true),
  ('fin@uji', 'Finance Uji', '{finance}', true),
  ('super@uji', 'Super Uji', '{admin_utama}', true)
on conflict (email) do nothing;

-- P1: gerbang mati => klaim ditolak.
begin;
  select pg_temp.sebagai('sales@uji');
  do $$ begin
    perform pg_temp.tolak('select public.klaim_ekstraksi()');
    raise notice 'P1 OK: gerbang mati menolak klaim';
  end $$;
rollback;

-- P2: gerbang menyala; bukan Sales ditolak; dua klaim melahirkan dua baris; batas 20 menahan 21.
begin;
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'deepseek-v4.1-flash', 'pelatihan dimatikan',
            'Rizki', 'tanpa DPA, diterima', 'super@uji');
  do $$
  declare v uuid; v2 uuid; m text;
  begin
    perform pg_temp.sebagai('fin@uji');
    perform pg_temp.tolak('select public.klaim_ekstraksi()');

    perform pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    v2 := public.klaim_ekstraksi();
    if v = v2 then raise exception 'P2 GAGAL: klaim kedua tidak melahirkan baris baru'; end if;

    -- Dibaca sebagai superuser: Sales memang TIDAK boleh membaca tabel ini (P6), jadi pemeriksaan
    -- dari sesi Sales selalu melihat nol baris dan melaporkan "model kosong".
    perform pg_temp.sebagai_super();
    select model into m from ekstraksi_po where id = v;
    if m is distinct from 'deepseek-v4.1-flash' then
      raise exception 'P2 GAGAL: model tidak dipaku basis data (%)', coalesce(m, 'kosong');
    end if;
    raise notice 'P2 OK: Finance ditolak, dua klaim Sales jadi dua baris, model dari basis data';
  end $$;
  -- Batas harian: 20 klaim palsu disisipkan sebagai superuser (RLS menolak authenticated),
  -- lalu klaim berikutnya ditolak.
  select pg_temp.sebagai_super();
  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model)
    select 'sales@uji', 'sales@uji', 'x' from generate_series(1, 20);
  do $$ begin
    perform pg_temp.sebagai('sales@uji');
    perform pg_temp.tolak('select public.klaim_ekstraksi()');
    raise notice 'P2b OK: batas 20 klaim per hari menahan klaim berikutnya';
  end $$;
rollback;

-- P3: hasil ditulis sekali, hanya oleh pengklaim, hanya dalam 5 menit.
begin;
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$
  declare v uuid;
  begin
    perform pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();

    perform pg_temp.sebagai('sales2@uji');
    perform pg_temp.tolak(format('select public.selesai_ekstraksi(%L, true, ''{}''::jsonb, null, 10, 1, 1)', v));

    perform pg_temp.sebagai('sales@uji');
    perform public.selesai_ekstraksi(v, true, '{"sekolah":{}}'::jsonb, null, 10, 1, 1);
    perform pg_temp.tolak(format('select public.selesai_ekstraksi(%L, true, ''{}''::jsonb, null, 10, 1, 1)', v));
    raise notice 'P3a OK: sekali, oleh pengklaimnya saja';
  end $$;
  -- Kedaluwarsa: waktu klaim dimajukan sebagai superuser.
  select pg_temp.sebagai_super();
  update ekstraksi_po set diklaim_pada = now() - interval '6 minutes', selesai_pada = null
   where diklaim_oleh = 'sales@uji';
  do $$ declare v uuid; begin
    select id into v from ekstraksi_po where diklaim_oleh = 'sales@uji' limit 1;
    perform pg_temp.sebagai('sales@uji');
    perform pg_temp.tolak(format('select public.selesai_ekstraksi(%L, true, ''{}''::jsonb, null, 10, 1, 1)', v));
    raise notice 'P3b OK: klaim kedaluwarsa lima menit tidak bisa ditutup lagi';
  end $$;
rollback;

-- P4: hasil mentah klaim tak tertaut dikosongkan sesudah 24 jam.
begin;
  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model, selesai_pada, berhasil, hasil)
    values ('sales@uji', 'sales@uji', 'x', now() - interval '25 hours', true, '{"rahasia":1}'::jsonb);
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$ declare sisa int; begin
    perform pg_temp.sebagai('sales@uji');
    perform public.klaim_ekstraksi();
    -- Dibaca sebagai superuser: dari sesi Sales, `hasil` tidak terlihat sama sekali, dan probe
    -- yang membaca nol baris akan melaporkan "bersih" untuk alasan yang salah.
    perform pg_temp.sebagai_super();
    select count(*) into sisa from ekstraksi_po where hasil = '{"rahasia":1}'::jsonb;
    if sisa <> 0 then raise exception 'P4 GAGAL: hasil mentah klaim lama masih tersimpan'; end if;
    raise notice 'P4 OK: hasil mentah tanpa PO dibuang sesudah 24 jam';
  end $$;
rollback;

-- P4b: pembersihan 24 jam TIDAK boleh menyentuh hasil yang sudah tertaut ke PO. Tanpa ini,
-- satu klaim lama yang sudah ditautkan kehilangan hasil mentahnya saat Sales lain membaca scan,
-- dan penautan yang gagal di tengah jalan kehilangan buktinya. (Temuan QA: probe P4 hanya
-- membuktikan sisi yang belum tertaut.)
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model, po_id, selesai_pada, berhasil, hasil)
    values ('sales@uji', 'sales@uji', 'x', '00000000-0000-0000-0000-0000000000f6',
            now() - interval '25 hours', true, '{"tertaut":1}'::jsonb);
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$ begin
    perform pg_temp.sebagai('sales@uji');
    perform public.klaim_ekstraksi();
    perform pg_temp.sebagai_super();
    if not exists (select 1 from ekstraksi_po where hasil = '{"tertaut":1}'::jsonb) then
      raise exception 'P4b GAGAL: hasil mentah yang SUDAH tertaut ikut dibuang';
    end if;
    raise notice 'P4b OK: hasil mentah yang tertaut ke PO tidak ikut dibersihkan';
  end $$;
rollback;

-- P5: tautkan hanya ke PO sendiri, unggahan, draf, dan sekali saja; penandanya terpasang.
begin;
  set local session_replication_role = replica;
  insert into sekolah (id, nama, jenjang, npsn, dipegang_oleh)
    values ('00000000-0000-0000-0000-00000000a001', 'SMA UJI', 'SMA', '99990001', 'sales@uji')
    on conflict do nothing;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000),
           ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000a001',
            'sales2@uji', 'draf', 'unggahan', 1000, 1, 1000),
           ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'platform', 1000, 1, 1000);
  set local session_replication_role = origin;
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$
  declare v uuid;
  begin
    perform pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    perform public.selesai_ekstraksi(v, true, '{"sekolah":{"nama":"SMA UJI"}}'::jsonb, null, 10, 1, 1);

    perform pg_temp.tolak(format('select public.tautkan_ekstraksi(%L, ''00000000-0000-0000-0000-0000000000f2'')', v));
    perform pg_temp.tolak(format('select public.tautkan_ekstraksi(%L, ''00000000-0000-0000-0000-0000000000f3'')', v));
    perform pg_temp.tolak(format('select public.tautkan_ekstraksi(%L, ''00000000-0000-0000-0000-0000000000f4'')', v));

    perform public.tautkan_ekstraksi(v, '00000000-0000-0000-0000-0000000000f1');
    -- Penanda dibaca sebagai Sales (PO-nya sendiri memang boleh ia baca). Baris pembacaannya TIDAK:
    -- tabel ekstraksi_po hanya terbaca Super Admin (P6), jadi pemeriksaannya lewat reset role.
    if (select dibaca_ai_pada from po where id = '00000000-0000-0000-0000-0000000000f1') is null then
      raise exception 'P5 GAGAL: penanda tidak terpasang';
    end if;
    perform pg_temp.sebagai_super();
    if (select po_id from ekstraksi_po where id = v) is distinct from '00000000-0000-0000-0000-0000000000f1'::uuid then
      raise exception 'P5 GAGAL: baris pembacaan tidak tertaut';
    end if;
    perform pg_temp.sebagai('sales@uji');
    perform pg_temp.tolak(format('select public.tautkan_ekstraksi(%L, ''00000000-0000-0000-0000-0000000000f1'')', v));
    raise notice 'P5 OK: tautan hanya ke PO sendiri, unggahan, draf, sekali, dan penanda terpasang';
  end $$;
rollback;

-- P5b: pembacaan GAGAL tidak bisa ditautkan -- percobaan yang ditinggalkan tidak boleh
-- menandai PO apa pun sebagai "dibaca AI".
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$
  declare v uuid;
  begin
    perform pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    perform public.selesai_ekstraksi(v, false, null, 'Penyedia menjawab 500.', 10, null, null);
    perform pg_temp.tolak(format('select public.tautkan_ekstraksi(%L, ''00000000-0000-0000-0000-0000000000f5'')', v));
    if (select dibaca_ai_pada from po where id = '00000000-0000-0000-0000-0000000000f5') is not null then
      raise exception 'P5b GAGAL: penanda terpasang oleh pembacaan yang gagal';
    end if;
    raise notice 'P5b OK: pembacaan gagal tidak menautkan apa pun dan tidak menandai PO';
  end $$;
rollback;

-- P5c: PO yang sudah keluar draf ditolak. (Temuan QA: P5 menguji PO orang lain dan PO
-- platform, tetapi bukan status non-draf.)
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'ditandatangani', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$
  declare v uuid;
  begin
    perform pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    perform public.selesai_ekstraksi(v, true, '{"sekolah":{}}'::jsonb, null, 10, 1, 1);
    perform pg_temp.tolak(format('select public.tautkan_ekstraksi(%L, ''00000000-0000-0000-0000-0000000000f7'')', v));
    if (select dibaca_ai_pada from po where id = '00000000-0000-0000-0000-0000000000f7') is not null then
      raise exception 'P5c GAGAL: PO non-draf ditandai dibaca AI';
    end if;
    raise notice 'P5c OK: PO yang sudah keluar draf tidak bisa ditautkan';
  end $$;
rollback;

-- P6: Sales tidak bisa membaca tabel pembacaan maupun tabel gerbang.
begin;
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model) values ('sales@uji', 'sales@uji', 'x');
  do $$
  declare a int; b int;
  begin
    perform pg_temp.sebagai('sales@uji');
    select count(*) into a from ekstraksi_po;
    select count(*) into b from pengaturan_ekstraksi;
    if a <> 0 or b <> 0 then raise exception 'P6 GAGAL: Sales membaca % baris pembacaan, % baris gerbang', a, b; end if;
    raise notice 'P6 OK: kedua tabel tertutup bagi Sales';
  end $$;
  -- Super Admin boleh membaca catatannya, dan hanya membaca.
  -- UPDATE/DELETE diuji lewat row_count, bukan dengan menuntut galat: tabel tanpa policy tulis
  -- tidak MELARANG, ia menyaring barisnya -- jadi pernyataannya berhasil dengan 0 baris, tanpa
  -- galat apa pun. Probe yang menuntut galat di sini justru gagal karena hal yang benar.
  do $$
  declare a int; v int;
  begin
    perform pg_temp.sebagai('super@uji');
    select count(*) into a from ekstraksi_po;
    if a = 0 then raise exception 'P6b GAGAL: Super Admin tidak melihat catatan pembacaan'; end if;
    perform pg_temp.tolak('insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model) values (''super@uji'', ''super@uji'', ''x'')');
    update ekstraksi_po set hasil = null;
    get diagnostics v = row_count;
    if v <> 0 then raise exception 'P6b GAGAL: % baris pembacaan disunting klien', v; end if;
    delete from ekstraksi_po;
    get diagnostics v = row_count;
    if v <> 0 then raise exception 'P6b GAGAL: % baris pembacaan dihapus klien', v; end if;
    raise notice 'P6b OK: Super Admin membaca catatannya, tanpa jalan tulis klien';
  end $$;
rollback;
