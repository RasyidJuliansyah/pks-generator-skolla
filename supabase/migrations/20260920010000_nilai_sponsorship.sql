-- Nilai sponsorship: kolom, syarat berpasangan saat keluar draf, dan pembekuan.
--
-- Melaksanakan catatan/18 bagian "Data" butir 1-3, lewat catatan/19 Tugas 1.
--
-- Sponsorship selama ini hanya teks bebas di po_catatan, jadi sistem tidak tahu nilainya dan
-- tidak bisa memeriksa kepatuhannya. Kolom ini yang membuat batas 15% bisa dinilai
-- (aturannya sendiri menyusul di migrasi 20260920b).
--
-- DIBUKTIKAN SEBELUMNYA, dalam transaksi yang dibatalkan: PO draf berstempel
-- iom-2026-09-17b dengan catatan sponsorship berisi dan tanpa nilai BERHASIL keluar draf
-- menjadi menunggu_ttd. Sesudah migrasi ini, yang sama ditolak.

-- 1. Kolom. Rupiah utuh, boleh kosong, tidak boleh negatif.
alter table po
  add column nilai_sponsorship bigint
  check (nilai_sponsorship is null or nilai_sponsorship >= 0);

comment on column po.nilai_sponsorship is
  'Nilai sponsorship dalam Rupiah utuh: satu angka total, termasuk barang dan media yang '
  'dinilai dengan harga pokoknya bagi Skolla. Rinciannya tetap di po_catatan jenis '
  'sponsorship. Batas kepatuhan 15% dari grand_total dinilai aturan IoM '
  'sponsorship-dalam-batas, bukan oleh check di sini.';

-- 2. Syarat keluar draf: catatan dan nilai wajib berpasangan.
--
-- Ditambahkan sebagai "Keputusan C" pada fungsi yang sudah ada, memakai pola v_kurang yang
-- sama supaya Sales menerima SATU pesan berisi semua yang kurang, bukan satu per satu.
--
-- Gerbangnya `= private.versi_iom_berlaku()`, bukan `is not null` seperti Keputusan B: PO
-- berstempel versi LAMA sengaja tidak dituntut nilainya (catatan/18, "PO yang sudah ada").
create or replace function private.jaga_syarat_maju()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kurang text[] := '{}';
  v_n int;
  v_total bigint;
  v_ada_catatan boolean;
  r record;
begin
  if tg_op = 'INSERT' then
    new.versi_iom := private.versi_iom_berlaku();
    return new;
  end if;

  -- Tanpa ini Sales bisa mengosongkan stempel lewat PostgREST dan PO-nya lolos dari
  -- syarat B sebagai "PO lama".
  if new.versi_iom is distinct from old.versi_iom then
    raise exception 'Versi IoM sebuah PO tidak bisa diubah.' using errcode = 'check_violation';
  end if;

  -- Hanya transisi KELUAR draf, kondisi yang sama persis dengan jaga_lantai_po.
  if old.status not in ('draf', 'ditolak') or new.status in ('draf', 'ditolak') then
    return new;
  end if;

  -- Keputusan A: berlaku untuk SEMUA PO, berstempel atau tidak.
  select count(*), coalesce(sum(nominal), 0) into v_n, v_total from po_termin where po_id = new.id;
  if v_n = 0 then
    v_kurang := array_append(v_kurang, 'Termin pembayaran belum diisi.');
  elsif v_total <> new.grand_total then
    v_kurang := array_append(v_kurang, format('Total termin Rp%s belum sama dengan grand total Rp%s.',
      replace(to_char(v_total, 'FM999,999,999,990'), ',', '.'),
      replace(to_char(new.grand_total, 'FM999,999,999,990'), ',', '.')));
  end if;

  -- Keputusan B: hanya PO berstempel. sekolah_beku sudah disegarkan po_bekukan_sekolah,
  -- yang berjalan lebih dulu (nama trigger ini sesudahnya menurut abjad).
  if new.versi_iom is not null then
    if new.masa_mulai is null or new.masa_selesai is null then
      v_kurang := array_append(v_kurang, 'Masa aktif belum lengkap.');
    elsif new.masa_selesai <= new.masa_mulai then
      v_kurang := array_append(v_kurang, 'Masa aktif berakhir sebelum atau pada tanggal mulainya.');
    end if;
    for r in select * from (values
        ('npsn', 'NPSN'), ('kepala_sekolah', 'Nama kepala sekolah'), ('kepsek_hp', 'Nomor HP kepala sekolah'),
        ('bendahara', 'Nama bendahara'), ('bendahara_hp', 'Nomor HP bendahara')) as t(kunci, label)
    loop
      if coalesce(btrim(new.sekolah_beku ->> r.kunci), '') = '' then
        v_kurang := array_append(v_kurang, r.label || ' belum diisi.');
      end if;
    end loop;
  end if;

  -- Keputusan C (catatan/18): catatan dan nilai sponsorship wajib berpasangan.
  -- Hanya PO berstempel versi yang berlaku sekarang.
  if new.versi_iom = private.versi_iom_berlaku() then
    select exists (select 1 from po_catatan
                   where po_id = new.id and jenis = 'sponsorship'
                     and btrim(coalesce(isi, '')) <> '')
      into v_ada_catatan;
    if v_ada_catatan and coalesce(new.nilai_sponsorship, 0) = 0 then
      v_kurang := array_append(v_kurang, 'Catatan sponsorship sudah diisi, tapi nilainya belum.');
    end if;
    if coalesce(new.nilai_sponsorship, 0) > 0 and not v_ada_catatan then
      v_kurang := array_append(v_kurang, 'Nilai sponsorship sudah diisi, tapi catatannya belum.');
    end if;
  end if;

  if cardinality(v_kurang) > 0 then
    raise exception 'PO belum bisa dikirim: %', array_to_string(v_kurang, ' ')
      using errcode = 'check_violation';
  end if;
  return new;
end $function$;

-- 3. Pembekuan.
--
-- ⚠️ bekukan_isi_po membekukan lewat DAFTAR KOLOM EKSPLISIT, bukan perbandingan seluruh
-- baris. Kolom baru TIDAK ikut beku dengan sendirinya. Tanpa baris tambahan di kedua tuple
-- di bawah, nilai_sponsorship PO yang sudah ditandatangani masih bisa diubah lewat PostgREST
-- sementara tanda tangannya tetap menempel — bentuk yang sama dengan temuan grand_total
-- diganti 777777 pada diagnostik 30 Agu 2026.
create or replace function private.bekukan_isi_po()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh,
      NEW.permintaan_tambahan, NEW.versi_iom, NEW.nilai_sponsorship)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;
