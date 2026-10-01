\set ON_ERROR_STOP on
-- Mode ditentukan variabel psql :mode = 'catat' | 'banding'.
create table if not exists sidik_pembanding (id uuid primary key, sidik text);
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa,
                  kota, nama_pm, nama_sm, berkas_unggahan)
    values ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan',
            1000, 1, 1000, 'Bekasi', 'PM', 'SM', '00000000-0000-0000-0000-0000000000c9/po.pdf')
    on conflict (id) do nothing;
  -- Draf unggahan yang SUDAH dinyatakan sesuai dengan pindaiannya (catatan/25 Tugas 1). Dua hal
  -- yang membuatnya berbeda dari baris di atas, dan keduanya disengaja:
  --   * `ditinjau_pada` + `ditinjau_sidik` terisi, jadi ia persis keadaan yang dipakai
  --     `ajukan_po_unggahan` sebagai gerbang: sidik baru dibandingkan dengan KOLOM ini;
  --   * `dibaca_ai_pada` belum ada saat baris ini disisipkan, dan tetap kosong sesudahnya.
  -- Kalau kolom baru itu tidak dikeluarkan dari sidik selama kosong, draf ini akan menuntut
  -- tinjau ulang tanpa ada yang berubah pada pindaiannya.
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa,
                  kota, nama_pm, nama_sm, berkas_unggahan, ditinjau_pada, ditinjau_oleh)
    values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan',
            1000, 1, 1000, 'Bekasi', 'PM', 'SM', '00000000-0000-0000-0000-0000000000d9/po.pdf', now(), 'sales@uji')
    on conflict (id) do nothing;
  -- Trigger po_tinjauan_sidik dimatikan oleh session_replication_role, jadi sidiknya dihitung di
  -- sini -- dan dihitung oleh fungsi yang berlaku SAAT ITU. Perbedaan fungsi sebelum dan sesudah
  -- migrasilah yang sedang diuji, jadi nilainya tidak boleh dihitung ulang sesudah migrasi.
  update po p set ditinjau_sidik = private.sidik_tinjauan(p)
   where p.id = '00000000-0000-0000-0000-0000000000d9';
commit;
\if :{?mode}
\else
\set mode catat
\endif
select (:'mode' = 'catat') as catat \gset
\if :catat
  insert into sidik_pembanding select id, private.sidik_tinjauan(p) from po p
    where id in ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000d9')
    on conflict (id) do update set sidik = excluded.sidik;
  \echo 'P9 dicatat'
\else
  do $$ declare lama text; baru text; begin
    select sidik into lama from sidik_pembanding where id = '00000000-0000-0000-0000-0000000000c9';
    select private.sidik_tinjauan(p) into baru from po p where p.id = '00000000-0000-0000-0000-0000000000c9';
    if lama is distinct from baru then raise exception 'P9 GAGAL: sidik berubah karena kolom baru'; end if;
    raise notice 'P9 OK: sidik draf lama tetap';

    -- P9b: gerbang yang sesungguhnya. Draf yang sudah dinyatakan sesuai dipakai
    -- ajukan_po_unggahan dengan membandingkan sidik BARU terhadap kolom ditinjau_sidik yang
    -- dihitung fungsi LAMA. Bila keduanya berselisih, Sales dipaksa meninjau ulang padahal
    -- tidak ada satu pun isi yang berubah, dan pemeriksaan itu tidak menunjuk ke sebabnya.
    select ditinjau_sidik into lama from po where id = '00000000-0000-0000-0000-0000000000d9';
    select private.sidik_tinjauan(p) into baru from po p where p.id = '00000000-0000-0000-0000-0000000000d9';
    if lama is null then raise exception 'P9b GAGAL: ditinjau_sidik kosong, fikstur tidak terbaca'; end if;
    if lama is distinct from baru then
      raise exception 'P9b GAGAL: draf yang sudah dinyatakan sesuai jadi basi karena kolom baru (%.8.. vs %.8..)', lama, baru;
    end if;
    raise notice 'P9b OK: pernyataan "sesuai pindaian" pada draf lama tetap berlaku';
  end $$;
\endif
