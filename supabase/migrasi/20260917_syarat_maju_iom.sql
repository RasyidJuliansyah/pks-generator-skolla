-- IoM iom-2026-09-17b (catatan/13a), Fase 1 bagian basis data. Rencana: catatan/14 Tugas 2.
--
-- Lubang yang ditutup (13a Bagian 1 dan 2): transisi keluar draf tidak punya gerbang.
-- PO tanpa satu termin pun lolos sampai tanda tangan, dan masa aktif maupun data sekolah
-- hanya syarat CETAK. Syaratnya dipasang di transisi keluar draf, bukan saat simpan:
-- draf boleh setengah jadi (lib/kelengkapan-po.ts).
--
-- Satu trigger menutup dua jalur: kirimUntukTtd (draf -> menunggu_ttd) dan
-- ajukan_po_unggahan (draf -> ditandatangani) sama-sama melompatkan status lewat UPDATE,
-- dan galat di trigger membatalkan seluruh RPC termasuk tanda tangannya.

-- 1. Versi yang berlaku, SATU tempat. Naik versi = ganti fungsi ini dan VERSI_IOM di
--    lib/iom.ts; uji/syarat-maju.test.mjs gagal bila keduanya berbeda.
create or replace function private.versi_iom_berlaku()
returns text language sql immutable set search_path = public
as $$ select 'iom-2026-09-17b'::text $$;

-- 2. Kolom. versi_iom TANPA default: PO yang sudah ada tetap null = PO lama (keputusan B,
--    tidak surut). Stempel PO baru diisi trigger, bukan default, supaya kiriman klien
--    tidak bisa memilih versinya sendiri.
alter table po add column if not exists versi_iom text;
-- b4 (13a Bagian 7 butir 2): Sales menyatakan ada permintaan di luar paket.
alter table po add column if not exists permintaan_tambahan boolean not null default false;

-- 3. Stempel, kekekalan stempel, dan syarat maju.
create or replace function private.jaga_syarat_maju()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_kurang text[] := '{}';
  v_n int;
  v_total bigint;
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

  if cardinality(v_kurang) > 0 then
    raise exception 'PO belum bisa dikirim: %', array_to_string(v_kurang, ' ')
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists po_syarat_maju on po;
create trigger po_syarat_maju before insert or update on po
  for each row execute function private.jaga_syarat_maju();

-- 4. Bendera permintaan tambahan dibekukan bersama isi PO lainnya. Isi fungsi disalin dari
--    definisi hidup 17 Sep 2026; yang ditambahkan hanya permintaan_tambahan dan versi_iom.
create or replace function private.bekukan_isi_po()
returns trigger language plpgsql set search_path = public
as $$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh,
      NEW.permintaan_tambahan, NEW.versi_iom)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $$;
