--
-- PostgreSQL database dump
--

\restrict R5HdNFVbdyZlZJX9rW41yYP46GoL0l46PaH0OvPgvuUGu1wpERGWvABIOQZokOJ

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA private;


ALTER SCHEMA private OWNER TO postgres;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: fungsi_verifikasi; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.fungsi_verifikasi AS ENUM (
    'education',
    'tech_ops',
    'finance',
    'service_account'
);


ALTER TYPE public.fungsi_verifikasi OWNER TO postgres;

--
-- Name: hasil_verifikasi; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hasil_verifikasi AS ENUM (
    'setuju',
    'setuju_catatan',
    'tolak'
);


ALTER TYPE public.hasil_verifikasi OWNER TO postgres;

--
-- Name: jenjang_sekolah; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.jenjang_sekolah AS ENUM (
    'SD',
    'SMP',
    'SMA'
);


ALTER TYPE public.jenjang_sekolah OWNER TO postgres;

--
-- Name: peran; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.peran AS ENUM (
    'sales',
    'head_of_sales',
    'head_of_operations',
    'cbo',
    'admin_utama',
    'admin_sales',
    'education',
    'tech_ops',
    'finance',
    'service_account',
    'tech_ops_lead',
    'c_level',
    'regional_head'
);


ALTER TYPE public.peran OWNER TO postgres;

--
-- Name: pihak_ttd; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.pihak_ttd AS ENUM (
    'kepala_sekolah',
    'partnership_manager',
    'regional_head',
    'sales_manager'
);


ALTER TYPE public.pihak_ttd OWNER TO postgres;

--
-- Name: status_po; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_po AS ENUM (
    'draf',
    'menunggu_ttd',
    'ditandatangani',
    'verifikasi',
    'ditolak',
    'terverifikasi',
    'pks_terbit',
    'pks_ditandatangani',
    'aktif',
    'selesai'
);


ALTER TYPE public.status_po OWNER TO postgres;

--
-- Name: aturan_iom(text, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.aturan_iom(p_kode text, p_lolos boolean, p_bukti text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$ select jsonb_build_object('kode', p_kode, 'lolos', coalesce(p_lolos, false), 'bukti', coalesce(p_bukti, '')) $$;


ALTER FUNCTION private.aturan_iom(p_kode text, p_lolos boolean, p_bukti text) OWNER TO postgres;

--
-- Name: basikan_saat_sekolah_berubah(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.basikan_saat_sekolah_berubah() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_berubah text[] := '{}';
begin
  -- Hanya di sinilah po_bekukan_sekolah menyegarkan salinannya.
  if old.status not in ('draf', 'ditolak') then return new; end if;
  -- NULL berarti barisnya tidak terlihat oleh pemanggil, bukan datanya berubah.
  if new.sekolah_beku is null then return new; end if;

  if nullif(regexp_replace(old.sekolah_beku->>'kepala_sekolah', '^\s+|\s+$', '', 'g'), '')
     is distinct from
     nullif(regexp_replace(new.sekolah_beku->>'kepala_sekolah', '^\s+|\s+$', '', 'g'), '') then
    v_berubah := v_berubah || 'kepala_sekolah'::text;
  end if;
  if old.sekolah_beku->>'jenjang' is distinct from new.sekolah_beku->>'jenjang' then
    v_berubah := v_berubah || 'jenjang'::text;
  end if;

  if cardinality(v_berubah) > 0 then
    update verifikasi
       set berlaku = false, digantikan_pada = now(),
           sebab_basi = 'Data sekolah berubah: ' || array_to_string(v_berubah, ', ')
     where po_id = new.id and berlaku
       and fungsi in ('education', 'tech_ops', 'service_account');
  end if;

  return new;
end;
$_$;


ALTER FUNCTION private.basikan_saat_sekolah_berubah() OWNER TO postgres;

--
-- Name: bekukan_isi_po(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.bekukan_isi_po() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh,
      NEW.permintaan_tambahan, NEW.versi_iom, NEW.nilai_sponsorship,
      NEW.skema_ttd, NEW.nama_rh, NEW.dibaca_ai_pada, NEW.ekstraksi_menunggu)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship,
      OLD.skema_ttd, OLD.nama_rh, OLD.dibaca_ai_pada, OLD.ekstraksi_menunggu)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.bekukan_isi_po() OWNER TO postgres;

--
-- Name: bekukan_sekolah(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.bekukan_sekolah() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_beku jsonb;
begin
  if TG_OP = 'INSERT' or OLD.status in ('draf', 'ditolak') then
    select to_jsonb(s) - 'id' - 'dibuat_pada' - 'diubah_pada'
      into v_beku from sekolah s where s.id = NEW.sekolah_id;
    if found then
      NEW.sekolah_beku := v_beku;
    elsif TG_OP = 'UPDATE' and NEW.sekolah_id = OLD.sekolah_id then
      NEW.sekolah_beku := OLD.sekolah_beku;
    else
      raise exception 'Sekolah untuk PO ini dipegang sales lain. Minta Head of Sales atau Admin Sales mengalihkannya lebih dulu.'
        using errcode = '42501';
    end if;
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.bekukan_sekolah() OWNER TO postgres;

--
-- Name: boleh_lihat_acquisition(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.boleh_lihat_acquisition() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select private.punya_peran('cbo', 'c_level', 'admin_utama', 'head_of_operations', 'finance', 'regional_head');
$$;


ALTER FUNCTION private.boleh_lihat_acquisition() OWNER TO postgres;

--
-- Name: boleh_lihat_po(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.boleh_lihat_po(pemilik text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select private.boleh_lihat_semua()
      or pemilik = lower(auth.jwt() ->> 'email');
$$;


ALTER FUNCTION private.boleh_lihat_po(pemilik text) OWNER TO postgres;

--
-- Name: boleh_lihat_sekolah(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.boleh_lihat_sekolah(pemegang text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select private.boleh_lihat_semua()
      or pemegang = lower(auth.jwt() ->> 'email');
$$;


ALTER FUNCTION private.boleh_lihat_sekolah(pemegang text) OWNER TO postgres;

--
-- Name: boleh_lihat_semua(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.boleh_lihat_semua() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select private.punya_peran(
    'head_of_sales', 'head_of_operations', 'cbo', 'c_level', 'admin_utama', 'admin_sales',
    'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead', 'regional_head'
  );
$$;


ALTER FUNCTION private.boleh_lihat_semua() OWNER TO postgres;

--
-- Name: boleh_ubah_po(text, public.status_po); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.boleh_ubah_po(pemilik text, st public.status_po) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select st in ('draf', 'ditolak')
     and (pemilik = lower(auth.jwt() ->> 'email')
          or private.punya_peran('head_of_sales', 'admin_sales'));
$$;


ALTER FUNCTION private.boleh_ubah_po(pemilik text, st public.status_po) OWNER TO postgres;

--
-- Name: catat_riwayat_pengguna(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.catat_riwayat_pengguna() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if TG_OP = 'INSERT' then
    insert into pengguna_riwayat(email, aksi, peran_baru, nama_baru, aktif_baru, oleh)
    values (NEW.email, 'tambah', NEW.peran, NEW.nama, NEW.aktif, lower(auth.jwt() ->> 'email'));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into pengguna_riwayat(email, aksi, peran_lama, nama_lama, aktif_lama, oleh)
    values (OLD.email, 'hapus', OLD.peran, OLD.nama, OLD.aktif, lower(auth.jwt() ->> 'email'));
    return OLD;
  end if;
  -- Hanya perubahan yang berarti yang dicatat; menyimpan ulang nilai yang sama
  -- tidak perlu meninggalkan baris.
  if (NEW.peran, NEW.nama, NEW.aktif) is distinct from (OLD.peran, OLD.nama, OLD.aktif) then
    insert into pengguna_riwayat(email, aksi, peran_lama, peran_baru,
                                 nama_lama, nama_baru, aktif_lama, aktif_baru, oleh)
    values (NEW.email, 'ubah', OLD.peran, NEW.peran, OLD.nama, NEW.nama,
            OLD.aktif, NEW.aktif, lower(auth.jwt() ->> 'email'));
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.catat_riwayat_pengguna() OWNER TO postgres;

--
-- Name: catat_riwayat_po(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.catat_riwayat_po() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if TG_OP = 'INSERT' then
    insert into po_riwayat(po_id, status_baru, versi, oleh)
    values (NEW.id, NEW.status, NEW.versi, lower(auth.jwt() ->> 'email'));
  elsif NEW.status is distinct from OLD.status or NEW.versi is distinct from OLD.versi then
    insert into po_riwayat(po_id, status_lama, status_baru, versi, oleh)
    values (NEW.id, OLD.status, NEW.status, NEW.versi, lower(auth.jwt() ->> 'email'));
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.catat_riwayat_po() OWNER TO postgres;

--
-- Name: catat_verdict_iom(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.catat_verdict_iom() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v jsonb;
begin
  if new.status <> 'verifikasi' or old.status = 'verifikasi' then return null; end if;
  begin
    v := private.nilai_iom(new.id);
  exception when others then
    v := jsonb_build_object('lolos', false, 'paket', null, 'kelompok', '[]'::jsonb,
      'gagal', jsonb_build_array('galat-evaluasi'),
      'hasil', jsonb_build_array(private.aturan_iom('galat-evaluasi', false, sqlerrm)));
  end;
  insert into verifikasi_otomatis (po_id, versi_po, versi_iom, lolos, paket, kelompok, gagal, hasil)
  values (new.id, new.versi, private.versi_iom_berlaku(), (v ->> 'lolos')::boolean, v ->> 'paket',
          array(select jsonb_array_elements_text(coalesce(v -> 'kelompok', '[]'::jsonb))),
          array(select jsonb_array_elements_text(v -> 'gagal')), v -> 'hasil');
  return null;
end $$;


ALTER FUNCTION private.catat_verdict_iom() OWNER TO postgres;

--
-- Name: fungsi_saya_cocok(public.fungsi_verifikasi); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.fungsi_saya_cocok(f public.fungsi_verifikasi) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select case f
    when 'education'       then private.punya_peran('education')
    when 'tech_ops'        then private.punya_peran('tech_ops')
    when 'finance'         then private.punya_peran('finance')
    when 'service_account' then private.punya_peran('service_account')
  end;
$$;


ALTER FUNCTION private.fungsi_saya_cocok(f public.fungsi_verifikasi) OWNER TO postgres;

--
-- Name: jaga_admin_utama(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_admin_utama() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  saya text := lower(auth.jwt() ->> 'email');
  tersisa int;
begin
  if TG_OP = 'UPDATE' and NEW.email = saya then
    if ('admin_utama' = any(OLD.peran)) and not ('admin_utama' = any(NEW.peran)) then
      raise exception 'Peran Admin Utama tidak bisa dicabut dari akun sendiri. Minta Admin Utama lain melakukannya.';
    end if;
    if OLD.aktif and not NEW.aktif then
      raise exception 'Akun sendiri tidak bisa dinonaktifkan.';
    end if;
  end if;

  select count(*) into tersisa
    from pengguna
   where aktif and 'admin_utama' = any(peran)
     and email <> coalesce(OLD.email, '');

  if TG_OP = 'DELETE' then
    if 'admin_utama' = any(OLD.peran) and OLD.aktif and tersisa = 0 then
      raise exception 'Admin Utama terakhir tidak bisa dihapus.';
    end if;
    return OLD;
  end if;

  if NEW.aktif and 'admin_utama' = any(NEW.peran) then
    return NEW;  -- masih ada admin: yang ini sendiri
  end if;
  if tersisa = 0 then
    raise exception 'Sistem harus punya minimal satu Admin Utama yang aktif.';
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION private.jaga_admin_utama() OWNER TO postgres;

--
-- Name: jaga_komentar_baru(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_komentar_baru() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_versi        integer;
  v_nama         text;
  v_peran        peran[];
  v_saya         text := lower(auth.jwt() ->> 'email');
  v_induk_id     uuid;
  v_induk_po     uuid;
  v_induk_dalam  integer;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select versi into v_versi from po where id = new.po_id;
  if v_versi is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  -- Salinan penulis, dari 20260910d: yang relevan adalah peran orang itu SAAT berbicara,
  -- bukan perannya sekarang. Lihat penjelasan panjang di migrasi tersebut.
  select nama, peran into v_nama, v_peran from pengguna where email = v_saya;

  new.oleh           := v_saya;
  new.nama_penulis   := v_nama;
  new.peran_penulis  := v_peran;
  new.waktu          := now();
  new.versi_po       := v_versi;
  new.disunting_pada := null;
  new.dihapus_pada   := null;
  new.dihapus_oleh   := null;

  -- Kedalaman DIHITUNG di sini, tidak pernah diambil dari kiriman klien. Klien yang
  -- mengarang kedalaman 0 pada balasan tingkat sepuluh membuat pagar di bawah tak ada
  -- artinya.
  new.kedalaman := 0;

  if new.induk_kunci is not null then
    -- Kunci terpanjang yang sah kira-kira 70 karakter (verifikasi:<fungsi>:<ISO>).
    -- Batas ini menutup penambat karangan yang dipakai menitipkan data.
    if length(new.induk_kunci) > 200 then
      raise exception 'Penambat balasan tidak dikenali.' using errcode = 'check_violation';
    end if;

    -- Hanya penambat ke KOMENTAR yang bisa diperiksa basis data. Penambat ke peristiwa
    -- lain (verifikasi:, ttd:, riwayat:, surat:, pks:) tidak punya baris yang bisa
    -- ditunjuk; kalau peristiwanya hilang, lini masa menampilkannya sebagai nisan.
    if new.induk_kunci like 'komentar:%' then
      begin
        v_induk_id := substring(new.induk_kunci from 10)::uuid;
      exception when others then
        raise exception 'Penambat balasan tidak dikenali.' using errcode = 'check_violation';
      end;

      select po_id, kedalaman into v_induk_po, v_induk_dalam
        from po_komentar where id = v_induk_id;

      if v_induk_po is null then
        raise exception 'Komentar yang dibalas tidak ditemukan.' using errcode = 'check_violation';
      end if;

      -- Balasan lintas PO tidak membocorkan apa pun (render selalu per-PO), tapi ia data
      -- sampah yang menunggu jadi kebingungan. Ditolak di sini, sekali.
      if v_induk_po <> new.po_id then
        raise exception 'Balasan harus berada di PO yang sama dengan komentar yang dibalas.'
          using errcode = 'check_violation';
      end if;

      new.kedalaman := v_induk_dalam + 1;

      -- Lima puluh tingkat bukan percakapan manusia. Pagarnya ada supaya render rekursif
      -- dan kueri rekursif punya langit-langit, bukan untuk membatasi diskusi.
      if new.kedalaman > 50 then
        raise exception 'Balasan sudah bersarang 50 tingkat. Mulai utas baru di tingkat atas.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION private.jaga_komentar_baru() OWNER TO postgres;

--
-- Name: jaga_komentar_sunting(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_komentar_sunting() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  new.id            := old.id;
  new.po_id         := old.po_id;
  new.oleh          := old.oleh;
  new.nama_penulis  := old.nama_penulis;
  new.peran_penulis := old.peran_penulis;
  new.waktu         := old.waktu;
  new.versi_po      := old.versi_po;
  new.induk_kunci   := old.induk_kunci;
  new.kedalaman     := old.kedalaman;

  if new.isi is distinct from old.isi then
    insert into po_komentar_revisi (komentar_id, isi) values (old.id, old.isi);
    new.disunting_pada := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION private.jaga_komentar_sunting() OWNER TO postgres;

--
-- Name: jaga_lantai_po(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_lantai_po() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_siswa bigint; v_guru bigint; v_ok boolean; v_n int; v_total bigint := 0; v_jumlah bigint := 0;
  v_s bigint; v_lantai bigint; v_label text; r record;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draf' then
      raise exception 'PO baru harus berstatus draf, bukan %', new.status using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.status not in ('draf', 'ditolak') then return new; end if;
  if new.status in ('draf', 'ditolak') then return new; end if;
  if exists (select 1 from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
             where pk.po_id = new.id and h.untuk_guru and pk.kelompok <> 1) then
    raise exception 'Pelatihan Guru dicatat di tingkat PO (kelompok 1), bukan per kelompok.' using errcode = 'check_violation';
  end if;
  select count(*) into v_n from po_kelompok where po_id = new.id;
  if v_n = 1 then
    raise exception 'PO satu kelompok disimpan tanpa baris po_kelompok; harganya di harga siswa PO.' using errcode = 'check_violation';
  end if;
  if v_n = 0 then
    if exists (select 1 from po_komponen where po_id = new.id and kelompok <> 1)
       or exists (select 1 from po_rombel where po_id = new.id and kelompok <> 1) then
      raise exception 'Komponen atau rombel menunjuk kelompok yang tidak ada.' using errcode = 'check_violation';
    end if;
    v_siswa := private.lantai_siswa(new.id);
    if v_siswa > 0 and new.harga_siswa < v_siswa then
      select exists (select 1 from po_pengecualian x where x.po_id = new.id
          and x.harga_disetujui = new.harga_siswa and x.lantai_disetujui = v_siswa) into v_ok;
      if not v_ok then
        raise exception 'Harga siswa % di bawah bottom price (% per siswa).', new.harga_siswa, v_siswa using errcode = 'check_violation';
      end if;
    end if;
    if new.grand_total is distinct from new.harga_siswa * new.jumlah_siswa + new.harga_guru * new.jumlah_guru then
      raise exception 'Grand total % tidak sama dengan harga × jumlah (%).', new.grand_total,
        new.harga_siswa * new.jumlah_siswa + new.harga_guru * new.jumlah_guru using errcode = 'check_violation';
    end if;
  else
    if new.asal <> 'platform' then
      raise exception 'PO unggahan belum bisa berkelompok: kertas Form PO hanya punya satu baris siswa.' using errcode = 'check_violation';
    end if;
    if new.harga_siswa <> 0 then
      raise exception 'PO berkelompok menyimpan harga per kelompok; harga siswa PO harus 0, bukan %.', new.harga_siswa using errcode = 'check_violation';
    end if;
    if exists (select 1 from po_rombel x where x.po_id = new.id and x.jumlah_siswa > 0
               and not exists (select 1 from po_kelompok k where k.po_id = new.id and k.nomor = x.kelompok)) then
      raise exception 'Ada siswa di rombel yang belum masuk kelompok mana pun, jadi tidak tertagih.' using errcode = 'check_violation';
    end if;
    if exists (select 1 from po_komponen x join harga_komponen h on h.id = x.komponen_id
               where x.po_id = new.id and not h.untuk_guru
               and not exists (select 1 from po_kelompok k where k.po_id = new.id and k.nomor = x.kelompok)) then
      raise exception 'Ada komponen yang menunjuk kelompok yang tidak ada.' using errcode = 'check_violation';
    end if;
    for r in select k.nomor, k.nama, k.harga_siswa from po_kelompok k where k.po_id = new.id order by k.nomor loop
      v_label := coalesce(nullif(btrim(r.nama), ''), 'Kelompok ' || r.nomor);
      select coalesce(sum(jumlah_siswa), 0) into v_s from po_rombel where po_id = new.id and kelompok = r.nomor;
      if v_s = 0 then raise exception '% belum berisi siswa.', v_label using errcode = 'check_violation'; end if;
      if not exists (select 1 from po_komponen x join harga_komponen h on h.id = x.komponen_id
                     where x.po_id = new.id and x.kelompok = r.nomor and not h.untuk_guru) then
        raise exception '% belum punya komponen.', v_label using errcode = 'check_violation';
      end if;
      v_lantai := private.lantai_siswa_kelompok(new.id, r.nomor);
      if v_lantai > 0 and r.harga_siswa < v_lantai then
        raise exception 'Harga siswa % (%) di bawah bottom price (% per siswa).', v_label, r.harga_siswa, v_lantai using errcode = 'check_violation';
      end if;
      v_jumlah := v_jumlah + v_s; v_total := v_total + r.harga_siswa * v_s;
    end loop;
    if new.jumlah_siswa <> v_jumlah then
      raise exception 'Jumlah siswa PO % tidak sama dengan jumlah rombel seluruh kelompok (%).', new.jumlah_siswa, v_jumlah using errcode = 'check_violation';
    end if;
    if new.grand_total is distinct from v_total + new.harga_guru * new.jumlah_guru then
      raise exception 'Grand total % tidak sama dengan jumlah seluruh kelompok ditambah guru (%).', new.grand_total,
        v_total + new.harga_guru * new.jumlah_guru using errcode = 'check_violation';
    end if;
  end if;
  v_guru := private.lantai_guru(new.id);
  if v_guru > 0 and new.jumlah_guru > 0 and new.harga_guru < v_guru then
    raise exception 'Harga guru % di bawah bottom price (% per guru).', new.harga_guru, v_guru using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


ALTER FUNCTION private.jaga_lantai_po() OWNER TO postgres;

--
-- Name: jaga_penanda_otomatis(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_penanda_otomatis() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Tanpa penanda transaksi, kolom ini tidak boleh berubah dari keadaan sebelumnya. Pada
  -- INSERT, OLD null diperlakukan sebagai false, sehingga `true` tetap ditolak.
  if NEW.diverifikasi_otomatis is distinct from coalesce(OLD.diverifikasi_otomatis, false)
     and coalesce(current_setting('app.penutup_iom', true), '') <> '1' then
    raise exception 'Penanda verifikasi otomatis hanya boleh diisi basis data.'
      using errcode = 'check_violation';
  end if;

  -- Penanda "dibaca AI" (catatan/17). Penanda yang bisa dihapus pemiliknya bukan jejak: tanpa
  -- ini Sales bisa mengosongkannya lewat PostgREST dan PO hasil ekstraksi jadi tampak seperti
  -- PO yang diketik sendiri.
  if NEW.dibaca_ai_pada is distinct from OLD.dibaca_ai_pada
     and coalesce(current_setting('app.penanda_ekstraksi', true), '') <> '1' then
    raise exception 'Penanda isian AI hanya boleh diisi basis data.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.jaga_penanda_otomatis() OWNER TO postgres;

--
-- Name: jaga_pengecualian(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_pengecualian() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_po po%rowtype; v_lantai bigint; v_saya text := lower(auth.jwt() ->> 'email');
begin
  select * into v_po from po where id = new.po_id;
  if not found then raise exception 'PO tidak ditemukan.' using errcode = 'check_violation'; end if;
  if v_po.asal <> 'unggahan' then
    raise exception 'Pengecualian hanya untuk PO unggahan, bukan PO yang dibuat di platform.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from po_kelompok where po_id = new.po_id) then
    raise exception 'Pengecualian hanya untuk PO satu kelompok.' using errcode = 'check_violation';
  end if;
  if lower(v_po.dibuat_oleh) = v_saya then
    raise exception 'Penyetuju tidak boleh orang yang sama dengan pembuat PO.' using errcode = 'check_violation';
  end if;
  new.disetujui_oleh := v_saya;
  v_lantai := private.lantai_siswa(new.po_id);
  new.lantai_disetujui := v_lantai;
  new.harga_disetujui := v_po.harga_siswa;
  if v_po.harga_siswa >= v_lantai then
    raise exception 'PO ini tidak melanggar lantai (harga % >= lantai %). Tidak perlu pengecualian.',
      v_po.harga_siswa, v_lantai using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


ALTER FUNCTION private.jaga_pengecualian() OWNER TO postgres;

--
-- Name: jaga_penutupan_verifikasi(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_penutupan_verifikasi() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare hijau int; tolak int;
begin
  if OLD.status <> 'verifikasi' or NEW.status = OLD.status then return NEW; end if;
  select count(*) filter (where hasil <> 'tolak'), count(*) filter (where hasil = 'tolak')
    into hijau, tolak from verifikasi where po_id = NEW.id and berlaku;
  if NEW.status = 'terverifikasi' and (hijau < 4 or tolak > 0) then
    -- Jalur IoM: tanpa empat persetujuan, tanpa satu pun penolakan, dan verdict TERAKHIR
    -- lolos untuk versi PO ini dan versi IoM yang berlaku.
    --
    -- Yang berhak menempuh jalur ini kini bukan peran, melainkan PENANDA TRANSAKSI yang
    -- hanya dipasang private.tutup_otomatis(). Peran diperiksa harfiah lewat peran_saya()
    -- pada versi sebelumnya, bukan punya_peran(): punya_peran meloloskan admin_utama untuk
    -- peran apa pun (temuan QA putaran 1), padahal keputusannya "hanya Head of Operations".
    -- Sejak keputusan 22 Sep 2026 keputusan itu pindah ke mesin, jadi perannya tidak lagi
    -- relevan -- yang relevan tinggal siapa yang boleh memasang penandanya.
    --
    -- Deklarasi paketnya diperiksa ulang saat menutup. Sejak PO berkelompok boleh otomatis,
    -- jadi SETIAP paket yang dipakai diperiksa, bukan cuma satu.
    if tolak > 0
       or coalesce(current_setting('app.penutup_iom', true), '') <> '1'
       or not exists (
         select 1 from (select lolos, versi_po, versi_iom, paket, kelompok from verifikasi_otomatis
                         where po_id = NEW.id order by dicatat_pada desc limit 1) t
          where t.lolos and t.versi_po = NEW.versi and t.versi_iom = private.versi_iom_berlaku()
            and cardinality(coalesce(t.kelompok, array[t.paket])) > 0
            and not exists (
              select 1 from unnest(coalesce(t.kelompok, array[t.paket])) pk
               where not exists (
                 select 1 from (select berlaku_sampai, butir from deklarasi_kesiapan dk
                                 where dk.produk = pk order by dk.ditandatangani_pada desc limit 1) d
                  where d.berlaku_sampai >= (now() at time zone 'Asia/Jakarta')::date
                    and d.butir @> array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4'])))
    then
      raise exception 'Belum bisa dinyatakan terverifikasi: % dari 4 fungsi setuju, % menolak.', hijau, tolak;
    end if;
  end if;
  if NEW.status = 'ditolak' and tolak = 0 then
    raise exception 'Tidak ada fungsi yang menolak, jadi PO ini tidak bisa ditutup sebagai ditolak.';
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.jaga_penutupan_verifikasi() OWNER TO postgres;

--
-- Name: jaga_syarat_maju(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_syarat_maju() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_kurang text[] := '{}';
  v_n int;
  v_total bigint;
  v_ada_catatan boolean;
  r record;
begin
  if tg_op = 'INSERT' then
    new.versi_iom := private.versi_iom_berlaku();
    -- Tiga kotak hanya untuk form kertas lama yang diunggah (centang di langkah 0). PO
    -- platform selalu empat, apa pun kiriman klien.
    new.skema_ttd := case when new.asal = 'unggahan' and new.skema_ttd = 3 then 3 else 4 end;
    return new;
  end if;

  -- Tanpa ini Sales bisa mengosongkan stempel lewat PostgREST dan PO-nya lolos dari
  -- syarat B sebagai "PO lama".
  if new.versi_iom is distinct from old.versi_iom then
    raise exception 'Versi IoM sebuah PO tidak bisa diubah.' using errcode = 'check_violation';
  end if;

  -- Sama alasannya: PO skema 4 yang diturunkan jadi 3 lolos dengan tiga tanda tangan.
  if new.skema_ttd is distinct from old.skema_ttd then
    raise exception 'Jumlah penanda tangan sebuah PO tidak bisa diubah.' using errcode = 'check_violation';
  end if;

  -- Skema 3 pada PO baru hanya lahir dari centang form kertas lama, yang sah untuk unggahan.
  -- Tanpa ini, unggahan skema 3 bisa dibalik jadi platform selagi draf dan mengumpulkan tiga
  -- tanda tangan di aplikasi (temuan QA akhir). Aplikasi tidak pernah mengubah asal sebuah PO;
  -- PO lama skema 3 pun tidak kehilangan apa pun.
  if new.skema_ttd = 3 and new.asal is distinct from old.asal then
    raise exception 'Asal PO tiga penanda tangan tidak bisa diubah.' using errcode = 'check_violation';
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

  -- Keputusan D (catatan/23): PO empat penanda tangan butuh nama Regional Head.
  if new.skema_ttd = 4 and coalesce(btrim(new.nama_rh), '') = '' then
    v_kurang := array_append(v_kurang, 'Regional Head Division belum dipilih.');
  end if;

  if cardinality(v_kurang) > 0 then
    raise exception 'PO belum bisa dikirim: %', array_to_string(v_kurang, ' ')
      using errcode = 'check_violation';
  end if;
  return new;
end $$;


ALTER FUNCTION private.jaga_syarat_maju() OWNER TO postgres;

--
-- Name: jaga_urutan_status_po(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_urutan_status_po() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_ada int; v_wajib int;
begin
  if new.status is not distinct from old.status then return new; end if;

  -- Putaran tanda tangan baru (temuan QA putaran 2): isi PO dibekukan saat keluar draf, jadi
  -- tanda tangan dari putaran sebelumnya (PO yang ditolak lalu disunting) bukan tanda tangan
  -- atas isi yang sekarang. Pola yang sama dengan kembalikanKeDraf dan ajukan_po_unggahan.
  -- Trigger ini berjalan paling akhir, jadi penghapusan tidak terjadi bila trigger lain menolak.
  if new.status = 'menunggu_ttd' and old.status in ('draf', 'ditolak') then
    delete from tanda_tangan where po_id = new.id;
    return new;
  end if;

  v_wajib := cardinality(private.pihak_wajib(new.skema_ttd));
  select count(distinct t.pihak) into v_ada from tanda_tangan t
   where t.po_id = new.id and t.pihak = any (private.pihak_wajib(new.skema_ttd));

  if new.status = 'ditandatangani' then
    if old.status = 'menunggu_ttd' and new.asal = 'platform' then
      -- Hanya PO platform: tanda tangannya dibubuhkan di aplikasi selama menunggu_ttd.
      if v_ada < v_wajib then
        raise exception 'PO baru bisa berstatus ditandatangani sesudah semua pihak menandatangani (% dari %).', v_ada, v_wajib
          using errcode = 'check_violation';
      end if;
      return new;
    elsif old.status in ('draf', 'ditolak') and new.asal = 'unggahan' then
      -- Syarat ajukan_po_unggahan diulang di sini, supaya UPDATE langsung tidak melewatinya.
      -- Sidik dibandingkan dengan baris sesudah trigger lain berjalan (nama trigger ini
      -- sesudah po_tinjauan_sidik dan po_bekukan_sekolah menurut abjad), sama seperti RPC.
      -- PO unggahan TIDAK boleh lewat menunggu_ttd: di sana tanda tangan bisa disisipkan tanpa
      -- pemeriksaan sidik (temuan QA putaran 2).
      if new.berkas_unggahan is null or new.ditinjau_pada is null
         or private.sidik_tinjauan(new) is distinct from new.ditinjau_sidik then
        raise exception 'PO unggahan hanya bisa berstatus ditandatangani lewat pengajuan pindaian yang sudah dinyatakan sesuai.'
          using errcode = 'check_violation';
      end if;
      -- Tanda tangan pindaian putaran lama dibuang; RPC menyisipkan yang baru sesudah lompatan ini.
      delete from tanda_tangan where po_id = new.id;
      return new;
    end if;
    raise exception 'PO berstatus % tidak bisa langsung menjadi ditandatangani.', old.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'verifikasi' then
    if old.status <> 'ditandatangani' or v_ada < v_wajib then
      raise exception 'PO hanya bisa diajukan ke verifikasi sesudah ditandatangani semua pihak (% dari %).', v_ada, v_wajib
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;


ALTER FUNCTION private.jaga_urutan_status_po() OWNER TO postgres;

--
-- Name: jaga_verifikator_bukan_pembuat(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.jaga_verifikator_bukan_pembuat() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_pemilik text;
  v_status  status_po;
begin
  select dibuat_oleh, status into v_pemilik, v_status from po where id = new.po_id;

  -- PO tidak ditemukan berarti ada yang salah; jangan diam-diam meloloskan.
  if v_pemilik is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  -- Membasikan karena PO direvisi, bukan memutuskan. Lihat kepala berkas untuk
  -- kenapa batas statusnya penting.
  if tg_op = 'UPDATE'
     and v_status in ('draf', 'ditolak')
     and old.berlaku and not new.berlaku
     and (new.id, new.po_id, new.fungsi, new.hasil, new.catatan, new.item,
          new.oleh, new.waktu, new.versi_po)
         is not distinct from
         (old.id, old.po_id, old.fungsi, old.hasil, old.catatan, old.item,
          old.oleh, old.waktu, old.versi_po)
  then
    return new;
  end if;

  if lower(v_pemilik) = lower(auth.jwt() ->> 'email') then
    raise exception 'Kamu yang membuat PO ini, jadi tidak bisa ikut memverifikasinya. '
      'Minta pemegang fungsi % yang lain.', new.fungsi
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;


ALTER FUNCTION private.jaga_verifikator_bukan_pembuat() OWNER TO postgres;

--
-- Name: kelompok_iom(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.kelompok_iom(p_po uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'nomor', k.nomor, 'hargaSiswa', k.harga_siswa, 'komponen', kom.ids) order by k.nomor), '[]'::jsonb)
    from po_kelompok k
    left join lateral (
      select coalesce(jsonb_agg(distinct pk.komponen_id order by pk.komponen_id), '[]'::jsonb) as ids
        from po_komponen pk where pk.po_id = k.po_id and pk.kelompok = k.nomor
    ) kom on true
   where k.po_id = p_po;
$$;


ALTER FUNCTION private.kelompok_iom(p_po uuid) OWNER TO postgres;

--
-- Name: lantai_guru(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.lantai_guru(p_po uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(h.bottom * greatest(pk.sesi, 1)), 0)
  from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
  where pk.po_id = p_po and h.untuk_guru;
$$;


ALTER FUNCTION private.lantai_guru(p_po uuid) OWNER TO postgres;

--
-- Name: lantai_siswa(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.lantai_siswa(p_po uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with k as (
    select pk.sesi, h.id, h.bottom, h.grup, h.untuk_guru
    from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
    where pk.po_id = p_po
  ),
  inti as (
    select coalesce(array_agg(id order by id), array[]::text[]) as ids,
           coalesce(sum(bottom), 0) as jumlah
    from k where grup = 'core' and not untuk_guru
  ),
  addon as (
    select coalesce(sum(bottom * greatest(sesi, 1)), 0) as jumlah
    from k where grup = 'addon' and not untuk_guru
  )
  select coalesce(
           (select hp.bottom from harga_paket hp, inti where hp.ids = inti.ids),
           (select jumlah from inti)
         ) + (select jumlah from addon);
$$;


ALTER FUNCTION private.lantai_siswa(p_po uuid) OWNER TO postgres;

--
-- Name: lantai_siswa_kelompok(uuid, smallint); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.lantai_siswa_kelompok(p_po uuid, p_kelompok smallint) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with k as (
    select pk.sesi, h.id, h.bottom, h.grup, h.untuk_guru
    from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
    where pk.po_id = p_po and pk.kelompok = p_kelompok
  ),
  inti as (
    select coalesce(array_agg(id order by id), array[]::text[]) as ids, coalesce(sum(bottom), 0) as jumlah
    from k where grup = 'core' and not untuk_guru
  ),
  addon as (
    select coalesce(sum(bottom * greatest(sesi, 1)), 0) as jumlah from k where grup = 'addon' and not untuk_guru
  )
  select coalesce((select hp.bottom from harga_paket hp, inti where hp.ids = inti.ids), (select jumlah from inti))
       + (select jumlah from addon);
$$;


ALTER FUNCTION private.lantai_siswa_kelompok(p_po uuid, p_kelompok smallint) OWNER TO postgres;

--
-- Name: milik_sales(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.milik_sales(pemilik text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select pemilik = lower(auth.jwt() ->> 'email')
      or private.punya_peran('head_of_sales', 'admin_sales');
$$;


ALTER FUNCTION private.milik_sales(pemilik text) OWNER TO postgres;

--
-- Name: model_ekstraksi(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.model_ekstraksi() RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$ select 'deepseek-v4.1-flash'::text $$;


ALTER FUNCTION private.model_ekstraksi() OWNER TO postgres;

--
-- Name: nilai_iom(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.nilai_iom(p_po uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v po%rowtype;
  h jsonb := '[]';
  v_hari date := (now() at time zone 'Asia/Jakarta')::date;
  v_ids text[]; v_asing text[]; v_langgar text[]; v_kurang text[]; v_gagal text[];
  v_n int; v_total bigint; v_kelompok int;
  v_berkelompok boolean;
  v_units jsonb;      -- satu entri per unit dinilai (kelompok, atau satu PO tunggal)
  v_dinilai jsonb;    -- v_units + paket/bottom/price_list hasil pencocokan
  v_pakai text[];     -- nama paket unik yang dipakai
  v_semua_paket boolean;
  v_bukti_paket text; v_bukti_harga text;
  v_semua_lantai boolean; v_semua_diskon boolean;
  d deklarasi_kesiapan%rowtype; v_ada_d boolean := false; v_butir_kurang text[] := '{}';
  v_dek_bukti text[] := '{}';
  v_masa text;
  v_sp_catatan boolean; v_sp_nilai bigint; v_sp_batas bigint;
  v_pk text;
begin
  select * into v from po where id = p_po;
  if not found then raise exception 'PO % tidak ditemukan.', p_po; end if;

  -- ---- 13a Bagian 1 dan 2 ----
  h := h || private.aturan_iom('po-berstempel-iom', v.versi_iom is not null,
    coalesce('dibuat di bawah ' || v.versi_iom, 'PO dibuat sebelum IoM berlaku'));
  h := h || private.aturan_iom('sekolah-terisi', coalesce(btrim(v.sekolah_beku ->> 'nama'), '') <> '',
    coalesce(nullif(btrim(v.sekolah_beku ->> 'nama'), ''), 'nama sekolah kosong'));

  select coalesce(array_agg(distinct komponen_id order by komponen_id), '{}') into v_ids
    from po_komponen where po_id = p_po;
  select coalesce(array_agg(distinct pk.komponen_id order by pk.komponen_id), '{}') into v_asing
    from po_komponen pk
   where pk.po_id = p_po and not exists (select 1 from harga_komponen hk where hk.id = pk.komponen_id);
  h := h || private.aturan_iom('komponen-dikenal', cardinality(v_ids) > 0 and cardinality(v_asing) = 0,
    case when cardinality(v_asing) > 0 then 'tidak dikenal: ' || array_to_string(v_asing, ', ')
         when cardinality(v_ids) > 0 then 'semua dikenal' else 'tanpa komponen' end);
  h := h || private.aturan_iom('jumlah-siswa-minimal', v.jumlah_siswa >= 1, v.jumlah_siswa || ' siswa');

  -- MIN_PESERTA (salinan lib/aturan-komponen.ts)
  select coalesce(array_agg(format('%s minimal %s %s, sekarang %s.', a.id, a.n, a.per,
           case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end) order by a.id), '{}')
    into v_langgar
    from po_komponen pk
    join harga_komponen hk on hk.id = pk.komponen_id
    join (values ('live', 30, 'siswa'), ('pmOn', 30, 'siswa'), ('pendam', 30, 'siswa'), ('psiOn', 10, 'siswa'),
                 ('psiOff', 10, 'siswa'), ('guruOff', 10, 'guru'), ('guruOn', 10, 'guru')) as a(id, n, per)
      on a.id = pk.komponen_id
   where pk.po_id = p_po
     and (case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end) < a.n;
  h := h || private.aturan_iom('minimal-peserta', cardinality(v_langgar) = 0,
    coalesce(nullif(array_to_string(v_langgar, ' '), ''), 'terpenuhi'));

  -- KAPASITAS_SESI (salinan lib/aturan-komponen.ts)
  select coalesce(array_agg(format('%s butuh minimal %s sesi, sekarang %s.', a.id,
           ceil((case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end)::numeric / a.n)::int,
           greatest(1, pk.sesi)) order by a.id), '{}')
    into v_langgar
    from po_komponen pk
    join harga_komponen hk on hk.id = pk.komponen_id
    join (values ('psiOff', 30, 'siswa'), ('psiOn', 30, 'siswa'), ('guruOff', 30, 'guru'), ('guruOn', 30, 'guru')) as a(id, n, per)
      on a.id = pk.komponen_id
   where pk.po_id = p_po
     and ceil((case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end)::numeric / a.n) > greatest(1, pk.sesi);
  h := h || private.aturan_iom('kapasitas-sesi', cardinality(v_langgar) = 0,
    coalesce(nullif(array_to_string(v_langgar, ' '), ''), 'terpenuhi'));

  select count(*), coalesce(sum(nominal), 0) into v_n, v_total from po_termin where po_id = p_po;
  h := h || private.aturan_iom('termin-sama-total', v_n > 0 and v_total = v.grand_total,
    case when v_n > 0 then format('total termin %s, grand total %s', v_total, v.grand_total) else 'tanpa termin' end);

  if v.asal = 'unggahan' then
    h := h || private.aturan_iom('unggahan-ditinjau', v.berkas_unggahan is not null and v.ditinjau_pada is not null,
      case when v.berkas_unggahan is null then 'pindaian belum ada'
           when v.ditinjau_pada is null then 'belum ada pernyataan sesuai pindaian'
           else 'ditinjau ' || v.ditinjau_pada end);
  end if;

  v_masa := format('%s s.d. %s', coalesce(v.masa_mulai::text, '-'), coalesce(v.masa_selesai::text, '-'));
  h := h || private.aturan_iom('masa-aktif-lengkap', v.masa_mulai is not null and v.masa_selesai is not null, v_masa);
  h := h || private.aturan_iom('masa-aktif-wajar',
    v.masa_mulai is not null and v.masa_selesai is not null and v.masa_selesai > v.masa_mulai, v_masa);

  select coalesce(array_agg(t.k order by t.o), '{}') into v_kurang
    from unnest(array['npsn', 'kepala_sekolah', 'kepsek_hp', 'bendahara', 'bendahara_hp']) with ordinality as t(k, o)
   where coalesce(btrim(v.sekolah_beku ->> t.k), '') = '';
  h := h || private.aturan_iom('sekolah-lengkap', cardinality(v_kurang) = 0,
    case when cardinality(v_kurang) > 0 then 'kosong: ' || array_to_string(v_kurang, ', ') else 'lengkap' end);

  -- ---- 13a Bagian 4, 7, dan 9: kelompok dinilai satu per satu ----
  select count(*) into v_kelompok from po_kelompok where po_id = p_po;
  v_berkelompok := v_kelompok >= 2;
  v_units := case when v_berkelompok then private.kelompok_iom(p_po)
                  else jsonb_build_array(jsonb_build_object(
                         'nomor', 1, 'hargaSiswa', v.harga_siswa, 'komponen', to_jsonb(v_ids))) end;

  -- Penjaga himpunan kelompok: jumlah barisnya harus utuh dan terbaca, supaya PO berkelompok
  -- yang barisnya gagal terbaca tidak diam-diam dinilai kosong lalu lolos.
  h := h || private.aturan_iom('kelompok-terdefinisi',
    case when v_berkelompok
         then v_kelompok between 2 and 6 and jsonb_array_length(v_units) = v_kelompok
         else v_kelompok < 2 end,
    case when v_berkelompok
         then v_kelompok || ' baris kelompok, ' || jsonb_array_length(v_units) || ' terbaca'
         else v_kelompok || ' baris kelompok' end);

  -- Cocokkan tiap unit dengan satu paket (himpunan komponennya harus persis).
  select coalesce(jsonb_agg(u.obj || jsonb_build_object(
           'paket', hp.nama, 'bottom', hp.bottom, 'price_list', hp.price_list) order by (u.obj ->> 'nomor')::int), '[]'::jsonb)
    into v_dinilai
    from jsonb_array_elements(v_units) as u(obj)
    left join lateral (
      select hpk.* from harga_paket hpk
       where (select array_agg(distinct x order by x) from unnest(hpk.ids) x)
           = (select array_agg(distinct y order by y) from jsonb_array_elements_text(u.obj -> 'komponen') y)
       limit 1
    ) hp on true;

  select coalesce(bool_and((u ->> 'paket') is not null), false),
         coalesce(string_agg(coalesce(u ->> 'paket', 'bukan paket persis'), ' + ' order by (u ->> 'nomor')::int), 'tanpa komponen')
    into v_semua_paket, v_bukti_paket
    from jsonb_array_elements(v_dinilai) u;
  h := h || private.aturan_iom('paket-persis', v_semua_paket, v_bukti_paket);
  h := h || private.aturan_iom('layanan-sesuai-paket', v_semua_paket, v_bukti_paket);

  -- Deklarasi kesiapan: harus ada dan berlaku untuk SETIAP paket yang dipakai.
  select coalesce(array_agg(distinct u ->> 'paket' order by u ->> 'paket'), '{}') into v_pakai
    from jsonb_array_elements(v_dinilai) u where u ->> 'paket' is not null;
  v_dek_bukti := '{}';
  foreach v_pk in array v_pakai loop
    select * into d from deklarasi_kesiapan where produk = v_pk order by ditandatangani_pada desc limit 1;
    if not found then
      v_dek_bukti := v_dek_bukti || ('tidak ada deklarasi ' || v_pk);
    else
      select coalesce(array_agg(t.b order by t.o), '{}') into v_butir_kurang
        from unnest(array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4']) with ordinality as t(b, o)
       where not (t.b = any(d.butir));
      if d.berlaku_sampai < v_hari then
        v_dek_bukti := v_dek_bukti || ('kedaluwarsa ' || v_pk || ' ' || d.berlaku_sampai);
      elsif cardinality(v_butir_kurang) > 0 then
        v_dek_bukti := v_dek_bukti || (v_pk || ' kurang butir ' || array_to_string(v_butir_kurang, ', '));
      end if;
    end if;
  end loop;
  h := h || private.aturan_iom('deklarasi-berlaku',
    v_semua_paket and cardinality(v_dek_bukti) = 0,
    case when cardinality(v_dek_bukti) > 0 then array_to_string(v_dek_bukti, '; ')
         when cardinality(v_pakai) > 0 then 'berlaku untuk ' || array_to_string(v_pakai, ' + ')
         else 'tidak ada paket yang dinilai' end);

  -- Harga dinilai PER KELOMPOK dari harganya sendiri. `po.harga_siswa` bernilai 0 untuk PO
  -- berkelompok, jadi menilainya dari sana membuat PO yang harganya sehat tampak melanggar.
  select coalesce(string_agg(
           case when (u ->> 'paket') is null then 'tidak dinilai: bukan paket persis'
                when v_berkelompok then format('kelompok %s (%s) %s vs %s %s',
                       u ->> 'nomor', u ->> 'paket', u ->> 'hargaSiswa', 'bottom', u ->> 'bottom')
                else format('%s vs %s %s', u ->> 'hargaSiswa', 'bottom', u ->> 'bottom') end,
           ' · ' order by (u ->> 'nomor')::int), '-')
    into v_bukti_harga
    from jsonb_array_elements(v_dinilai) u;
  select coalesce(bool_and((u ->> 'paket') is not null
                           and (u ->> 'hargaSiswa')::bigint >= (u ->> 'bottom')::bigint), false)
    into v_semua_lantai from jsonb_array_elements(v_dinilai) u;
  h := h || private.aturan_iom('lantai-siswa', v_semua_lantai, v_bukti_harga);

  h := h || private.aturan_iom('lantai-guru',
    not exists (select 1 from po_komponen pk join harga_komponen hk on hk.id = pk.komponen_id
                 where pk.po_id = p_po and hk.untuk_guru),
    'pelatihan guru membuat PO dinilai manual');

  select coalesce(string_agg(
           case when (u ->> 'paket') is null then 'tidak dinilai: bukan paket persis'
                when v_berkelompok then format('kelompok %s (%s) %s vs %s %s',
                       u ->> 'nomor', u ->> 'paket', u ->> 'hargaSiswa', 'price list', u ->> 'price_list')
                else format('%s vs %s %s', u ->> 'hargaSiswa', 'price list', u ->> 'price_list') end,
           ' · ' order by (u ->> 'nomor')::int), '-')
    into v_bukti_harga
    from jsonb_array_elements(v_dinilai) u;
  select coalesce(bool_and((u ->> 'paket') is not null
                           and (u ->> 'hargaSiswa')::bigint >= (u ->> 'price_list')::bigint), false)
    into v_semua_diskon from jsonb_array_elements(v_dinilai) u;
  -- Diskon per kelompok DIIZINKAN sebatas bottom price (keputusan Rizki 22 Sep 2026):
  -- po_kelompok memang cara resmi memberi harga berbeda per kelompok. PO satu kelompok tetap
  -- wajib tanpa diskon seperti sebelumnya.
  h := h || private.aturan_iom('tanpa-diskon', v_berkelompok or v_semua_diskon,
    case when v_berkelompok then 'PO berkelompok: diskon per kelompok diizinkan sebatas bottom price · ' || v_bukti_harga
         else v_bukti_harga end);

  h := h || private.aturan_iom('tanpa-pengecualian-hoo',
    not exists (select 1 from po_pengecualian where po_id = p_po), 'pengecualian lantai HoO');
  -- Sponsorship mengambil 15% dari pendapatan (catatan/18). Yang dinilai batasnya, bukan
  -- ada-tidaknya. Rumusnya bilangan bulat, sama persis dengan lib/iom.ts:
  -- nilai * 100 <= grand_total * 15. Jangan diubah jadi * 0.15.
  select exists (select 1 from po_catatan
                 where po_id = p_po and jenis = 'sponsorship' and btrim(coalesce(isi, '')) <> '')
    into v_sp_catatan;
  v_sp_nilai := coalesce(v.nilai_sponsorship, 0);
  v_sp_batas := (v.grand_total * 15) / 100;
  h := h || private.aturan_iom('sponsorship-dalam-batas',
    case when not v_sp_catatan and v_sp_nilai = 0 then true
         when v_sp_catatan <> (v_sp_nilai > 0) then false
         else v_sp_nilai * 100 <= v.grand_total * 15 end,
    case when not v_sp_catatan and v_sp_nilai = 0 then 'tidak ada'
         when v_sp_catatan <> (v_sp_nilai > 0) then 'catatan dan nilai sponsorship tidak berpasangan'
         else format('Rp%s = %s dari Rp%s, batas Rp%s',
           replace(to_char(v_sp_nilai, 'FM999,999,999,990'), ',', '.'),
           case when v.grand_total > 0
                then replace(to_char(round(v_sp_nilai::numeric * 100 / v.grand_total, 1), 'FM990.0'), '.', ',') || '%'
                else '—' end,
           replace(to_char(v.grand_total, 'FM999,999,999,990'), ',', '.'),
           replace(to_char(v_sp_batas, 'FM999,999,999,990'), ',', '.')) end);
  h := h || private.aturan_iom('tanpa-permintaan-tambahan', not v.permintaan_tambahan, 'permintaan di luar paket');

  select coalesce(array_agg(t.e ->> 'kode' order by t.o), '{}') into v_gagal
    from jsonb_array_elements(h) with ordinality as t(e, o)
   where not (t.e ->> 'lolos')::boolean;

  -- `paket`: nama tunggal bila hanya satu paket dipakai (termasuk PO satu kelompok), null bila
  -- berkelompok dengan paket berbeda. `kelompok`: seluruh paket yang dipakai.
  return jsonb_build_object('versi_iom', private.versi_iom_berlaku(), 'lolos', cardinality(v_gagal) = 0,
    'paket', case when cardinality(v_pakai) = 1 then v_pakai[1] end,
    'kelompok', to_jsonb(v_pakai),
    'gagal', to_jsonb(v_gagal), 'hasil', h);
end $$;


ALTER FUNCTION private.nilai_iom(p_po uuid) OWNER TO postgres;

--
-- Name: pegang_sekolah(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.pegang_sekolah() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if NEW.dipegang_oleh is null then
    NEW.dipegang_oleh := lower(auth.jwt() ->> 'email');
  end if;
  return NEW;
end $$;


ALTER FUNCTION private.pegang_sekolah() OWNER TO postgres;

--
-- Name: peran_saya(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.peran_saya() RETURNS public.peran[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select p.peran from pengguna p
      where p.email = lower(auth.jwt() ->> 'email') and p.aktif),
    '{}'::peran[]
  );
$$;


ALTER FUNCTION private.peran_saya() OWNER TO postgres;

--
-- Name: pihak_wajib(smallint); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.pihak_wajib(p_skema smallint) RETURNS public.pihak_ttd[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select case when p_skema = 4
    then array['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager']::pihak_ttd[]
    else array['kepala_sekolah', 'partnership_manager', 'sales_manager']::pihak_ttd[] end;
$$;


ALTER FUNCTION private.pihak_wajib(p_skema smallint) OWNER TO postgres;

--
-- Name: po_pada_jalur(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.po_pada_jalur(nama text) RETURNS uuid
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select (regexp_match(nama,
    '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'))[1]::uuid;
$$;


ALTER FUNCTION private.po_pada_jalur(nama text) OWNER TO postgres;

--
-- Name: punya_peran(public.peran[]); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.punya_peran(VARIADIC dicari public.peran[]) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select private.peran_saya() && dicari
      or 'admin_utama' = any(private.peran_saya());
$$;


ALTER FUNCTION private.punya_peran(VARIADIC dicari public.peran[]) OWNER TO postgres;

--
-- Name: sentuh_diubah_pada(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.sentuh_diubah_pada() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin new.diubah_pada = now(); return new; end $$;


ALTER FUNCTION private.sentuh_diubah_pada() OWNER TO postgres;

--
-- Name: sidik_saat_ditinjau(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.sidik_saat_ditinjau() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.ditinjau_pada is null then
    new.ditinjau_sidik := null;
  elsif tg_op = 'INSERT' or new.ditinjau_pada is distinct from old.ditinjau_pada then
    new.ditinjau_sidik := private.sidik_tinjauan(new);
  else
    new.ditinjau_sidik := old.ditinjau_sidik;
  end if;
  return new;
end;
$$;


ALTER FUNCTION private.sidik_saat_ditinjau() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: po; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nomor bigint NOT NULL,
    sekolah_id uuid NOT NULL,
    dibuat_oleh text NOT NULL,
    status public.status_po DEFAULT 'draf'::public.status_po NOT NULL,
    versi integer DEFAULT 1 NOT NULL,
    jumlah_siswa integer DEFAULT 0 NOT NULL,
    jumlah_guru integer DEFAULT 0 NOT NULL,
    harga_siswa bigint DEFAULT 0 NOT NULL,
    harga_guru bigint DEFAULT 0 NOT NULL,
    grand_total bigint DEFAULT 0 NOT NULL,
    masa_mulai date,
    masa_selesai date,
    sumber_dana text,
    sumber_dana_lain text,
    kota text DEFAULT 'Jakarta'::text,
    tanggal_ttd date,
    jumlah_rombel integer DEFAULT 8 NOT NULL,
    versi_pricelist text,
    dibuat_pada timestamp with time zone DEFAULT now() NOT NULL,
    diubah_pada timestamp with time zone DEFAULT now() NOT NULL,
    nama_pm text,
    nama_sm text,
    diverifikasi_oleh text,
    diverifikasi_pada timestamp with time zone,
    sekolah_beku jsonb,
    asal text DEFAULT 'platform'::text NOT NULL,
    berkas_unggahan text,
    ditinjau_pada timestamp with time zone,
    ditinjau_oleh text,
    ditinjau_sidik text,
    versi_iom text,
    permintaan_tambahan boolean DEFAULT false NOT NULL,
    nilai_sponsorship bigint,
    diverifikasi_otomatis boolean DEFAULT false NOT NULL,
    skema_ttd smallint DEFAULT 4 NOT NULL,
    nama_rh text,
    dibaca_ai_pada timestamp with time zone,
    ekstraksi_menunggu text[],
    CONSTRAINT masa_aktif_urut CHECK (((masa_selesai IS NULL) OR (masa_mulai IS NULL) OR (masa_selesai >= masa_mulai))),
    CONSTRAINT po_asal_check CHECK ((asal = ANY (ARRAY['platform'::text, 'unggahan'::text]))),
    CONSTRAINT po_grand_total_check CHECK ((grand_total >= 0)),
    CONSTRAINT po_harga_guru_check CHECK ((harga_guru >= 0)),
    CONSTRAINT po_harga_siswa_check CHECK ((harga_siswa >= 0)),
    CONSTRAINT po_jumlah_guru_check CHECK ((jumlah_guru >= 0)),
    CONSTRAINT po_jumlah_rombel_check CHECK (((jumlah_rombel >= 1) AND (jumlah_rombel <= 20))),
    CONSTRAINT po_jumlah_siswa_check CHECK ((jumlah_siswa >= 0)),
    CONSTRAINT po_nilai_sponsorship_check CHECK (((nilai_sponsorship IS NULL) OR (nilai_sponsorship >= 0))),
    CONSTRAINT po_skema_ttd_check CHECK ((skema_ttd = ANY (ARRAY[3, 4])))
);


ALTER TABLE public.po OWNER TO postgres;

--
-- Name: COLUMN po.nama_pm; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.nama_pm IS 'Partnership Manager yang menandatangani, dipilih dari daftar pengguna.';


--
-- Name: COLUMN po.nama_sm; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.nama_sm IS 'Sales Manager yang menandatangani, dipilih dari daftar pengguna.';


--
-- Name: COLUMN po.diverifikasi_oleh; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.diverifikasi_oleh IS 'Orang yang MENUTUP verifikasi: Tech Ops Lead pada jalur manual, atau HoO pada penutupan satu-klik lama. KOSONG untuk penutupan otomatis (sejak 22 Sep 2026) -- kolomnya ber-foreign key ke pengguna(email) dan memang tidak ada orang yang menutupnya. Penanda otomatisnya ada di po.diverifikasi_otomatis.';


--
-- Name: COLUMN po.asal; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.asal IS 'platform = dibuat lewat aplikasi; unggahan = diisi manual di kertas lalu dipindai.';


--
-- Name: COLUMN po.ditinjau_pada; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.ditinjau_pada IS 'Saat Sales menyatakan data hasil tinjauan sesuai dengan pindaian.';


--
-- Name: COLUMN po.ditinjau_sidik; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.ditinjau_sidik IS 'Sidik isi PO saat ditinjau_pada diisi. Diisi trigger po_tinjauan_sidik, tidak pernah dari pemanggil. ajukan_po_unggahan menolak bila isi saat diajukan berbeda.';


--
-- Name: COLUMN po.nilai_sponsorship; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.nilai_sponsorship IS 'Nilai sponsorship dalam Rupiah utuh: satu angka total, termasuk barang dan media yang dinilai dengan harga pokoknya bagi Skolla. Rinciannya tetap di po_catatan jenis sponsorship. Batas kepatuhan 15% dari grand_total dinilai aturan IoM sponsorship-dalam-batas, bukan oleh check di sini.';


--
-- Name: COLUMN po.diverifikasi_otomatis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.diverifikasi_otomatis IS 'Ditutup lewat jalur IoM otomatis, tanpa klik manusia. Tahan waktu: revisi sesudahnya tidak menghapus jejak ini.';


--
-- Name: COLUMN po.skema_ttd; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.skema_ttd IS 'Jumlah penanda tangan Form PO: 3 (Kepala Sekolah, PM, Sales Manager) untuk PO sebelum 25 Sep 2026 dan unggahan form kertas lama; 4 (+ Regional Head Division, Sales Manager berlabel Head of Sales) untuk yang lain. Diisi private.jaga_syarat_maju saat INSERT, tidak bisa diubah sesudahnya.';


--
-- Name: COLUMN po.nama_rh; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.nama_rh IS 'Regional Head Division yang menandatangani, dipilih dari akun berperan regional_head. Hanya bermakna pada skema_ttd = 4.';


--
-- Name: COLUMN po.dibaca_ai_pada; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.dibaca_ai_pada IS 'Waktu isian awal PO ini dibaca AI dari pindaian (catatan/17). Diisi tautkan_ekstraksi() saja, tidak pernah dari klien. Kosong = tidak ada isian dari AI.';


--
-- Name: COLUMN po.ekstraksi_menunggu; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.po.ekstraksi_menunggu IS 'Kunci isian dari scan yang belum dikonfirmasi Sales (catatan/17 amandemen 2). Kosong = semua langkah sudah dikonfirmasi. Penanda kemajuan layar, bukan isi dokumen.';


--
-- Name: sidik_tinjauan(public.po); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.sidik_tinjauan(p public.po) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select encode(sha256(convert_to(jsonb_build_object(
    'po', (to_jsonb(p) - array['nomor', 'status', 'versi', 'dibuat_oleh', 'dibuat_pada',
                               'diubah_pada', 'diverifikasi_oleh', 'diverifikasi_pada',
                               'diverifikasi_otomatis', 'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik',
                               'skema_ttd', 'ekstraksi_menunggu'])
          - case when p.nama_rh is null then 'nama_rh' else '' end
          - case when p.dibaca_ai_pada is null then 'dibaca_ai_pada' else '' end,
    'sekolah', coalesce(p.sekolah_beku, '{}'::jsonb) - 'dipegang_oleh',
    'komponen', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_komponen x where x.po_id = p.id),
    'rombel',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_rombel x where x.po_id = p.id),
    'termin',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_termin x where x.po_id = p.id),
    'catatan',  (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_catatan x where x.po_id = p.id),
    'kelompok', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_kelompok x where x.po_id = p.id),
    'pindaian', (select jsonb_build_object('versi', o.version, 'etag', o.metadata->>'eTag')
                   from storage.objects o
                  where o.bucket_id = 'po-unggahan' and o.name = p.berkas_unggahan
                    and o.archived_at is null)
  )::text, 'UTF8')), 'hex');
$$;


ALTER FUNCTION private.sidik_tinjauan(p public.po) OWNER TO postgres;

--
-- Name: tutup_otomatis(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.tutup_otomatis(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
begin
  select status into v_status from po where id = p_po for update;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_status <> 'verifikasi' then
    raise exception 'PO tidak sedang dalam tahap verifikasi.' using errcode = 'check_violation';
  end if;

  -- Penanda transaksi. Ia satu-satunya yang membuat trigger penutupan mengizinkan jalur
  -- IoM tanpa peran Head of Operations. `is_local = true`, jadi tidak menempel di koneksi
  -- yang dipakai bersama oleh connection pool PostgREST.
  perform set_config('app.penutup_iom', '1', true);

  -- `diverifikasi_oleh` sengaja DIKOSONGKAN, dan itu bukan kelalaian.
  --
  -- Dua alasan, keduanya mengikat. Pertama, kolom itu ber-FOREIGN KEY ke pengguna(email)
  -- (20260829072645_catat_penutup_verifikasi), jadi nilai apa pun yang bukan email DITOLAK --
  -- dan penolakan itu terjadi di dalam transaksi pengajuan verifikasi Sales, sehingga SELURUH
  -- pengajuan ikut batal. Percobaan pertama migrasi ini menulis 'sistem:iom-<versi>' dan
  -- karenanya tidak akan pernah berhasil pada satu PO pun. Kedua, catatan/13a Bagian 6
  -- memutuskan kolom ini berisi NAMA ORANG; mengisinya dengan penanda sistem akan tercetak
  -- sebagai nama di dokumen.
  --
  -- Yang mencatat bahwa penutupan ini otomatis adalah `diverifikasi_otomatis`, dan versi
  -- aturannya ada di baris `verifikasi_otomatis.versi_iom`. Keduanya sudah cukup, dan
  -- keduanya jujur: memang tidak ada orang yang menutup PO ini.
  update po set status = 'terverifikasi',
                diverifikasi_oleh = null,
                diverifikasi_pada = now(),
                diverifikasi_otomatis = true
   where id = p_po;

  -- Surat terbit dan langsung terkunci. Tanpa tanda tangan gambar, tanpa penanda: suratnya
  -- menyatakan sistem yang mengkonfirmasi, bukan orang.
  insert into surat_verifikasi (po_id, otomatis) values (p_po, true)
    on conflict (po_id) do nothing;

  update surat_verifikasi set final_pada = now()
   where po_id = p_po and otomatis and final_pada is null;
end $$;


ALTER FUNCTION private.tutup_otomatis(p_po uuid) OWNER TO postgres;

--
-- Name: tutup_otomatis_trigger(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.tutup_otomatis_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform private.tutup_otomatis(new.po_id);
  return null;
end $$;


ALTER FUNCTION private.tutup_otomatis_trigger() OWNER TO postgres;

--
-- Name: versi_iom_berlaku(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.versi_iom_berlaku() RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$ select 'iom-2026-09-22'::text $$;


ALTER FUNCTION private.versi_iom_berlaku() OWNER TO postgres;

--
-- Name: ajukan_po_unggahan(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ajukan_po_unggahan(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_po    po%rowtype;
  v_beku  jsonb;
  v_basi  boolean;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select * into v_po from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if lower(v_po.dibuat_oleh) is distinct from v_saya
     and not private.punya_peran('head_of_sales', 'admin_sales') then
    raise exception 'PO ini bukan milikmu.' using errcode = 'check_violation';
  end if;

  if v_po.asal <> 'unggahan' then
    raise exception 'Jalur ini hanya untuk PO unggahan. PO platform mengumpulkan tanda tangan lewat aplikasi.'
      using errcode = 'check_violation';
  end if;

  if v_po.status not in ('draf', 'ditolak') then
    raise exception 'PO berstatus % sudah tidak bisa diajukan lagi.', v_po.status
      using errcode = 'check_violation';
  end if;

  if v_po.berkas_unggahan is null then
    raise exception 'Pindaian PO belum diunggah.' using errcode = 'check_violation';
  end if;

  -- Tanpa pernyataan Sales, tidak ada yang menjamin data di sistem mewakili kertasnya.
  if v_po.ditinjau_pada is null then
    raise exception 'Belum ada pernyataan bahwa data ini sesuai dengan pindaian.'
      using errcode = 'check_violation';
  end if;

  -- PO yang pernah ditolak lalu diajukan ulang tidak boleh menumpuk tanda tangan.
  delete from tanda_tangan where po_id = p_po;

  -- Lompatan status ini memicu `jaga_lantai_po`; gerbangnya sama dengan jalur platform.
  -- Ia juga menyegarkan sekolah_beku untuk terakhir kalinya; nama kepala sekolah di
  -- tanda tangan harus diambil dari salinan hasil penyegaran ini, bukan dari v_po.
  update po set status = 'ditandatangani' where id = p_po
  returning sekolah_beku, private.sidik_tinjauan(po) is distinct from ditinjau_sidik
  into v_beku, v_basi;

  -- Sidiknya dihitung dari baris hasil lompatan status di atas, jadi yang dibandingkan
  -- persis isi yang dibekukan. Galat membatalkan seluruh pengajuan, termasuk
  -- penghapusan tanda tangan di atas.
  if v_basi then
    raise exception 'Data PO ini berubah sejak dinyatakan sesuai dengan pindaian. Buka Sunting, periksa lagi terhadap pindaiannya, lalu centang pernyataannya.'
      using errcode = 'check_violation';
  end if;

  -- Semuanya menunjuk BERKAS YANG SAMA: satu lembar pindaian. Daftarnya dari skema PO.
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh, asal)
  select p_po, w.p,
         coalesce(nullif(btrim(case w.p
           when 'kepala_sekolah' then v_beku->>'kepala_sekolah'
           when 'partnership_manager' then v_po.nama_pm
           when 'regional_head' then v_po.nama_rh
           else v_po.nama_sm end), ''), '—'),
         v_po.berkas_unggahan, v_saya, 'pindaian'
    from unnest(private.pihak_wajib(v_po.skema_ttd)) as w(p);
end;
$$;


ALTER FUNCTION public.ajukan_po_unggahan(p_po uuid) OWNER TO postgres;

--
-- Name: basikan_verifikasi(uuid, public.fungsi_verifikasi[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.basikan_verifikasi(p_po uuid, p_fungsi public.fungsi_verifikasi[], p_sebab text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r      record;
  v_saya text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select dibuat_oleh, status into r from po where id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;

  -- coalesce: boleh_ubah_po() dan fungsi_saya_cocok() bisa NULL (mis. p_fungsi berisi
  -- NULL), dan NULL di sini berarti penolakannya dilewati.
  if not coalesce(private.boleh_ubah_po(r.dibuat_oleh, r.status)
    or (cardinality(p_fungsi) = 1
        and private.fungsi_saya_cocok(p_fungsi[1])
        and r.status = 'verifikasi'), false)
  then raise exception 'Tidak berhak membatalkan keputusan verifikasi'; end if;

  update verifikasi set berlaku = false, digantikan_pada = now(), sebab_basi = p_sebab
   where po_id = p_po and fungsi = any(p_fungsi) and berlaku;
end $$;


ALTER FUNCTION public.basikan_verifikasi(p_po uuid, p_fungsi public.fungsi_verifikasi[], p_sebab text) OWNER TO postgres;

--
-- Name: buat_pks(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.buat_pks(p_po uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  ROMAWI constant text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  saya text := lower(auth.jwt() ->> 'email');
  r record; thn int; bln int;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;

  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh)) then
    raise exception 'Hanya sales pemilik PO yang bisa membuat PKS';
  end if;
  if r.status <> 'terverifikasi' then
    raise exception 'PO belum terverifikasi';
  end if;
  if not exists (select 1 from surat_verifikasi s
                  where s.po_id = p_po and s.final_pada is not null) then
    raise exception 'Surat Verifikasi Kesiapan belum difinalisasi';
  end if;
  if exists (select 1 from pks where po_id = p_po) then
    raise exception 'PKS untuk PO ini sudah ada';
  end if;

  thn := extract(year from now())::int;
  bln := extract(month from now())::int;
  insert into pks (po_id, tahun, bulan, dibuat_oleh) values (p_po, thn, bln, saya);

  return '/EXTSKOLLA/PKS/' || ROMAWI[bln] || '/' || thn;
end;
$$;


ALTER FUNCTION public.buat_pks(p_po uuid) OWNER TO postgres;

--
-- Name: daftar_jatuh_tempo(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.daftar_jatuh_tempo(p_bulan integer) RETURNS TABLE(po_id uuid, nomor bigint, sekolah text, jenis text, bucket text, jalur text, jatuh_tempo date)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not private.punya_peran('admin_utama') then
    raise exception 'Hanya Super Admin yang boleh melihat daftar jatuh tempo.'
      using errcode = 'check_violation';
  end if;

  return query
  with dasar as (
    select p.id, p.nomor, p.diubah_pada,
           coalesce(p.sekolah_beku->>'nama', '—') as sekolah,
           (select k.ditandatangani_pada from pks k where k.po_id = p.id) as pks_basah
    from po p
  ),
  tempo as (
    select d.*,
           (coalesce(d.pks_basah, d.diubah_pada::date) + make_interval(months => p_bulan))::date as jt
    from dasar d
  )
  select t.id, t.nomor, t.sekolah, 'Tanda tangan PO'::text, 'tanda-tangan'::text,
         tt.berkas, t.jt
  from tempo t
  join tanda_tangan tt on tt.po_id = t.id
  where tt.asal <> 'pindaian'
    and tt.berkas_dihapus_pada is null
    and t.jt <= current_date

  union all

  select t.id, t.nomor, t.sekolah, 'Tanda tangan Surat Verifikasi'::text, 'tanda-tangan'::text,
         sv.berkas, t.jt
  from tempo t
  join surat_verifikasi sv on sv.po_id = t.id
  where sv.berkas is not null
    and sv.berkas_dihapus_pada is null
    and t.jt <= current_date

  order by 7, 2;
end;
$$;


ALTER FUNCTION public.daftar_jatuh_tempo(p_bulan integer) OWNER TO postgres;

--
-- Name: daftar_penanda_tangan(public.peran[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.daftar_penanda_tangan(p_peran public.peran[] DEFAULT NULL::public.peran[]) RETURNS TABLE(email text, nama text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.email, p.nama
    from pengguna p
   where p.aktif
     and private.peran_saya() <> '{}'::peran[]
     and (p_peran is null or p.peran && p_peran)
   order by p.nama;
$$;


ALTER FUNCTION public.daftar_penanda_tangan(p_peran public.peran[]) OWNER TO postgres;

--
-- Name: finalisasi_pks(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.finalisasi_pks(p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;
  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh)) then
    raise exception 'Hanya sales pemilik PO yang bisa memfinalisasi PKS';
  end if;

  update pks set final_pada = now() where po_id = p_po and final_pada is null;
  if not found then raise exception 'PKS belum dibuat atau sudah difinalisasi'; end if;

  update po set status = 'pks_terbit' where id = p_po and status = 'terverifikasi';
end;
$$;


ALTER FUNCTION public.finalisasi_pks(p_po uuid) OWNER TO postgres;

--
-- Name: gerbang_ekstraksi_menyala(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.gerbang_ekstraksi_menyala() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select coalesce((select menyala from pengaturan_ekstraksi order by id desc limit 1), false) $$;


ALTER FUNCTION public.gerbang_ekstraksi_menyala() OWNER TO postgres;

--
-- Name: hapus_komentar(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hapus_komentar(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_oleh text;
  v_saya text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select oleh into v_oleh from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) is distinct from v_saya then
    raise exception 'Hanya penulisnya yang bisa menghapus komentar ini.'
      using errcode = 'check_violation';
  end if;

  update po_komentar
     set dihapus_pada = now(), dihapus_oleh = v_saya
   where id = p_id and dihapus_pada is null;
end;
$$;


ALTER FUNCTION public.hapus_komentar(p_id uuid) OWNER TO postgres;

--
-- Name: hitung_po_per_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hitung_po_per_status() RETURNS TABLE(status public.status_po, jumlah bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select p.status, count(*) from po p group by p.status;
$$;


ALTER FUNCTION public.hitung_po_per_status() OWNER TO postgres;

--
-- Name: klaim_ekstraksi(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.klaim_ekstraksi() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_saya   text := lower(auth.jwt() ->> 'email');
  v_nyala  boolean;
  v_jumlah int;
  v_id     uuid;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  -- Gerbang organisasi. Baris terakhir yang berlaku; tanpa baris = mati.
  select menyala into v_nyala from pengaturan_ekstraksi order by id desc limit 1;
  if coalesce(v_nyala, false) is not true then
    raise exception 'Pembacaan scan dengan AI belum dinyalakan.' using errcode = 'check_violation';
  end if;

  -- Pemanggil harus berperan pembuat PO. Saat klaim belum ada PO-nya, jadi yang diperiksa
  -- perannya, bukan kepemilikan sebuah PO.
  if not private.punya_peran('sales', 'head_of_sales', 'admin_sales') then
    raise exception 'Hanya Sales yang boleh membaca scan.' using errcode = 'check_violation';
  end if;

  select count(*) into v_jumlah from ekstraksi_po
   where diklaim_oleh = v_saya
     and (diklaim_pada at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date;
  if v_jumlah >= 20 then
    raise exception 'Batas 20 pembacaan scan per hari sudah tercapai.' using errcode = 'check_violation';
  end if;

  -- Hasil mentah klaim yang tidak pernah ditautkan dibuang sesudah 24 jam: data pribadi dari
  -- scan tidak boleh tinggal di basis data tanpa PO yang memilikinya.
  update ekstraksi_po set hasil = null
   where po_id is null and hasil is not null and selesai_pada < now() - interval '24 hours';

  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model)
    values (v_saya, v_saya, private.model_ekstraksi())
    returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION public.klaim_ekstraksi() OWNER TO postgres;

--
-- Name: komentar_belum_dibaca(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.komentar_belum_dibaca() RETURNS TABLE(po_id uuid, jumlah bigint, terakhir timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select k.po_id, count(*), max(k.waktu)
  from po_komentar k
  left join po_komentar_dibaca d
         on d.po_id = k.po_id and d.oleh = lower(auth.jwt() ->> 'email')
  where k.dihapus_pada is null
    and k.oleh is distinct from lower(auth.jwt() ->> 'email')
    and k.waktu > coalesce(d.waktu, '-infinity'::timestamptz)
  group by k.po_id
$$;


ALTER FUNCTION public.komentar_belum_dibaca() OWNER TO postgres;

--
-- Name: selesai_ekstraksi(uuid, boolean, jsonb, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text, p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_saya text := lower(auth.jwt() ->> 'email');
  v_row  ekstraksi_po%rowtype;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select * into v_row from ekstraksi_po where id = p_id;
  if not found then
    raise exception 'Pembacaan tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_row.diklaim_oleh is distinct from v_saya then
    raise exception 'Pembacaan ini bukan milikmu.' using errcode = 'check_violation';
  end if;
  if v_row.selesai_pada is not null then
    raise exception 'Pembacaan ini sudah selesai.' using errcode = 'check_violation';
  end if;
  if v_row.diklaim_pada < now() - interval '5 minutes' then
    raise exception 'Klaim ini sudah kedaluwarsa.' using errcode = 'check_violation';
  end if;

  update ekstraksi_po
     set selesai_pada = now(), berhasil = p_berhasil, hasil = p_hasil, galat = p_galat,
         durasi_ms = p_durasi_ms, token_masuk = p_token_masuk, token_keluar = p_token_keluar
   where id = p_id;
end $$;


ALTER FUNCTION public.selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text, p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer) OWNER TO postgres;

--
-- Name: sunting_komentar(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sunting_komentar(p_id uuid, p_isi text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_oleh  text;
  v_hapus timestamptz;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select oleh, dihapus_pada into v_oleh, v_hapus from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) is distinct from v_saya then
    raise exception 'Hanya penulisnya yang bisa menyunting komentar ini.'
      using errcode = 'check_violation';
  end if;
  if v_hapus is not null then
    raise exception 'Komentar ini sudah dihapus.' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_isi, ''))) = 0 then
    raise exception 'Isi komentar tidak boleh kosong.' using errcode = 'check_violation';
  end if;

  update po_komentar set isi = p_isi where id = p_id;
end;
$$;


ALTER FUNCTION public.sunting_komentar(p_id uuid, p_isi text) OWNER TO postgres;

--
-- Name: tandai_berkas_dihapus(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tandai_berkas_dihapus(p_jalur text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not private.punya_peran('admin_utama') then
    raise exception 'Hanya Super Admin yang boleh menghapus berkas jatuh tempo.'
      using errcode = 'check_violation';
  end if;

  update tanda_tangan set berkas_dihapus_pada = now()
   where berkas = p_jalur and asal <> 'pindaian' and berkas_dihapus_pada is null;

  update surat_verifikasi set berkas_dihapus_pada = now()
   where berkas = p_jalur and berkas_dihapus_pada is null;
end;
$$;


ALTER FUNCTION public.tandai_berkas_dihapus(p_jalur text) OWNER TO postgres;

--
-- Name: tandai_komentar_dibaca(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tandai_komentar_dibaca(p_po uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  insert into po_komentar_dibaca (po_id, oleh, waktu)
  values (p_po, lower(auth.jwt() ->> 'email'), now())
  on conflict (po_id, oleh) do update set waktu = excluded.waktu
$$;


ALTER FUNCTION public.tandai_komentar_dibaca(p_po uuid) OWNER TO postgres;

--
-- Name: tautkan_ekstraksi(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tautkan_ekstraksi(p_id uuid, p_po uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_saya text := lower(auth.jwt() ->> 'email');
  v_row  ekstraksi_po%rowtype;
  v_po   po%rowtype;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  -- `for update`: dua permintaan berbarengan dengan klaim yang sama harus BERBARIS, bukan
  -- sama-sama lolos pemeriksaan lalu sama-sama menstempel dibaca_ai_pada. Jendelanya sempit
  -- (temuan QA), tetapi penguncian barisnya tidak berbiaya dan menutupnya sepenuhnya.
  select * into v_row from ekstraksi_po where id = p_id for update;
  if not found then
    raise exception 'Pembacaan tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_row.diklaim_oleh is distinct from v_saya then
    raise exception 'Pembacaan ini bukan milikmu.' using errcode = 'check_violation';
  end if;
  if v_row.berhasil is not true then
    raise exception 'Pembacaan ini tidak berhasil.' using errcode = 'check_violation';
  end if;
  if v_row.po_id is not null then
    raise exception 'Pembacaan ini sudah tertaut ke PO lain.' using errcode = 'check_violation';
  end if;
  if v_row.hasil is null then
    raise exception 'Hasil pembacaan sudah dibuang.' using errcode = 'check_violation';
  end if;

  select * into v_po from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_po.dibuat_oleh) is distinct from v_saya then
    raise exception 'PO ini bukan milikmu.' using errcode = 'check_violation';
  end if;
  if v_po.asal <> 'unggahan' then
    raise exception 'Jalur ini hanya untuk PO unggahan.' using errcode = 'check_violation';
  end if;
  if v_po.status not in ('draf', 'ditolak') then
    raise exception 'PO ini sudah keluar dari draf.' using errcode = 'check_violation';
  end if;
  if v_po.dibaca_ai_pada is not null
     or exists (select 1 from ekstraksi_po e where e.po_id = p_po) then
    raise exception 'PO ini sudah punya pembacaan.' using errcode = 'check_violation';
  end if;

  update ekstraksi_po set po_id = p_po where id = p_id;

  -- Penanda hanya boleh diisi basis data; setelannya dilepas lagi di akhir, karena `set_config`
  -- transaksi-lokal TETAP berlaku sesudah blok selesai (pelajaran 17 Sep 2026).
  perform set_config('app.penanda_ekstraksi', '1', true);
  update po set dibaca_ai_pada = v_row.selesai_pada where id = p_po;
  perform set_config('app.penanda_ekstraksi', '', true);
end $$;


ALTER FUNCTION public.tautkan_ekstraksi(p_id uuid, p_po uuid) OWNER TO postgres;

--
-- Name: unggah_pks_basah(uuid, text, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; s record; v_sponsor boolean;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;
  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh))
  then raise exception 'Hanya sales pemilik PO yang bisa mengunggah PKS'; end if;
  if p_berkas is null or p_berkas not like p_po::text || '/%' then
    raise exception 'Berkas harus berada di folder PO ini';
  end if;
  select final_pada into s from pks where po_id = p_po;
  if not found then raise exception 'PKS belum dibuat'; end if;
  if s.final_pada is null then raise exception 'PKS belum difinalisasi'; end if;
  if p_tanggal > current_date then
    raise exception 'Tanggal penandatanganan tidak boleh di masa depan';
  end if;

  -- PO lama tanpa nilai tetap wajib dikonfirmasi dokumennya; nilainya yang tidak dituntut.
  select exists (select 1 from po_catatan
                 where po_id = p_po and jenis = 'sponsorship' and btrim(coalesce(isi, '')) <> '')
      or coalesce((select nilai_sponsorship from po where id = p_po), 0) > 0
    into v_sponsor;
  if v_sponsor and not exists (
    select 1 from pks_dokumen_sponsorship d
    join po p on p.id = d.po_id
    where d.po_id = p_po
      and d.versi_po = p.versi
      and d.form_ditandatangani
      and d.rekening_atas_nama_lembaga
      and d.meterai_bila_di_atas_5juta)
  then
    raise exception 'PO ini bersponsorship. Finance harus mengonfirmasi dokumen sponsorship '
      'untuk versi PO sekarang sebelum PKS bertanda tangan basah bisa diunggah.';
  end if;

  update pks set berkas_basah = p_berkas, diunggah_oleh = lower(auth.jwt() ->> 'email'),
         diunggah_pada = now(), ditandatangani_pada = p_tanggal
   where po_id = p_po;
  update po set status = 'pks_ditandatangani'
   where id = p_po and status in ('terverifikasi', 'pks_terbit');
end $$;


ALTER FUNCTION public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date) OWNER TO postgres;

--
-- Name: deklarasi_kesiapan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deklarasi_kesiapan (
    produk text NOT NULL,
    versi_produk text NOT NULL,
    butir text[] NOT NULL,
    berlaku_sampai date NOT NULL,
    ditandatangani_oleh text NOT NULL,
    ditandatangani_pada timestamp with time zone NOT NULL
);


ALTER TABLE public.deklarasi_kesiapan OWNER TO postgres;

--
-- Name: ekstraksi_po; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ekstraksi_po (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid,
    diklaim_oleh text NOT NULL,
    diklaim_pada timestamp with time zone DEFAULT now() NOT NULL,
    dicentang_oleh text NOT NULL,
    dicentang_pada timestamp with time zone DEFAULT now() NOT NULL,
    model text NOT NULL,
    selesai_pada timestamp with time zone,
    durasi_ms integer,
    token_masuk integer,
    token_keluar integer,
    berhasil boolean,
    galat text,
    hasil jsonb
);


ALTER TABLE public.ekstraksi_po OWNER TO postgres;

--
-- Name: TABLE ekstraksi_po; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ekstraksi_po IS 'Pembacaan scan PO oleh model vision (catatan/17). Hanya Super Admin yang membaca; isinya adalah data yang sudah ada di pindaian, jadi paparannya tidak bertambah. po_id kosong = pembacaan yang belum tertaut ke PO mana pun. Masa simpannya MENGIKUTI pindaian PO: po-unggahan ada di TIDAK_DIHAPUS (lib/retensi.ts), jadi dalam praktik baris ini tidak pernah dihapus. ON DELETE CASCADE mengikatnya ke PO, supaya kalau kebijakan pindaian suatu hari berubah dan PO-nya dibuang, catatan pembacaannya ikut terbawa pada tindakan yang sama.';


--
-- Name: harga_komponen; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.harga_komponen (
    id text NOT NULL,
    price_list bigint NOT NULL,
    bottom bigint NOT NULL,
    grup text NOT NULL,
    untuk_guru boolean DEFAULT false NOT NULL,
    per_sesi boolean DEFAULT false NOT NULL,
    CONSTRAINT harga_komponen_grup_check CHECK ((grup = ANY (ARRAY['core'::text, 'addon'::text])))
);


ALTER TABLE public.harga_komponen OWNER TO postgres;

--
-- Name: harga_paket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.harga_paket (
    nama text NOT NULL,
    ids text[] NOT NULL,
    price_list bigint NOT NULL,
    bottom bigint NOT NULL
);


ALTER TABLE public.harga_paket OWNER TO postgres;

--
-- Name: pengaturan_ekstraksi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pengaturan_ekstraksi (
    id bigint NOT NULL,
    menyala boolean DEFAULT false NOT NULL,
    penyedia text,
    paket_akun text,
    model text,
    pemeriksaan_data text,
    risiko_diterima_oleh text,
    alasan_risiko text,
    diubah_oleh text NOT NULL,
    diubah_pada timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gerbang_lengkap CHECK (((NOT menyala) OR ((COALESCE(btrim(penyedia), ''::text) <> ''::text) AND (COALESCE(btrim(paket_akun), ''::text) <> ''::text) AND (COALESCE(btrim(model), ''::text) <> ''::text) AND (COALESCE(btrim(pemeriksaan_data), ''::text) <> ''::text) AND (COALESCE(btrim(risiko_diterima_oleh), ''::text) <> ''::text) AND (COALESCE(btrim(alasan_risiko), ''::text) <> ''::text)))),
    CONSTRAINT gerbang_oleh CHECK ((COALESCE(btrim(diubah_oleh), ''::text) <> ''::text))
);


ALTER TABLE public.pengaturan_ekstraksi OWNER TO postgres;

--
-- Name: TABLE pengaturan_ekstraksi; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pengaturan_ekstraksi IS 'Riwayat gerbang ekstraksi scan PO (catatan/17). Baris terakhir = keadaan berlaku. Hanya Super Admin yang membaca dan menulis.';


--
-- Name: pengaturan_ekstraksi_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pengaturan_ekstraksi_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pengaturan_ekstraksi_id_seq OWNER TO postgres;

--
-- Name: pengaturan_ekstraksi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pengaturan_ekstraksi_id_seq OWNED BY public.pengaturan_ekstraksi.id;


--
-- Name: pengguna; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pengguna (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    nama text,
    peran public.peran[] DEFAULT '{}'::public.peran[] NOT NULL,
    aktif boolean DEFAULT true NOT NULL,
    dibuat_pada timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pengguna_email_check CHECK ((email = lower(email))),
    CONSTRAINT pengguna_nama_terisi CHECK (((nama IS NOT NULL) AND (btrim(nama) <> ''::text))),
    CONSTRAINT pengguna_punya_peran CHECK ((cardinality(peran) >= 1))
);


ALTER TABLE public.pengguna OWNER TO postgres;

--
-- Name: TABLE pengguna; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pengguna IS 'Daftar izin. Satu orang boleh memegang lebih dari satu peran.';


--
-- Name: pengguna_riwayat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pengguna_riwayat (
    id bigint NOT NULL,
    email text NOT NULL,
    aksi text NOT NULL,
    peran_lama public.peran[],
    peran_baru public.peran[],
    nama_lama text,
    nama_baru text,
    aktif_lama boolean,
    aktif_baru boolean,
    oleh text,
    pada timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pengguna_riwayat_aksi_check CHECK ((aksi = ANY (ARRAY['tambah'::text, 'ubah'::text, 'hapus'::text])))
);


ALTER TABLE public.pengguna_riwayat OWNER TO postgres;

--
-- Name: pengguna_riwayat_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.pengguna_riwayat ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.pengguna_riwayat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    tahun integer NOT NULL,
    dibuat_oleh text NOT NULL,
    dibuat_pada timestamp with time zone DEFAULT now() NOT NULL,
    final_pada timestamp with time zone,
    bulan integer DEFAULT EXTRACT(month FROM now()) NOT NULL,
    berkas_basah text,
    diunggah_oleh text,
    diunggah_pada timestamp with time zone,
    ditandatangani_pada date,
    CONSTRAINT pks_bulan_check CHECK (((bulan >= 1) AND (bulan <= 12)))
);


ALTER TABLE public.pks OWNER TO postgres;

--
-- Name: COLUMN pks.tahun; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pks.tahun IS 'Tahun pada ekor nomor perjanjian, diambil saat draf dibuat.';


--
-- Name: COLUMN pks.final_pada; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pks.final_pada IS 'Kosong = draf, nomornya sudah dipesan. Terisi = siap ditandatangani basah.';


--
-- Name: COLUMN pks.bulan; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pks.bulan IS 'Bulan pada ekor nomor perjanjian, dicetak sebagai angka Romawi.';


--
-- Name: COLUMN pks.berkas_basah; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pks.berkas_basah IS 'Pindaian PKS bermeterai yang sudah ditandatangani kedua pihak.';


--
-- Name: COLUMN pks.ditandatangani_pada; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pks.ditandatangani_pada IS 'Tanggal pada dokumen basah, diisi Sales — bukan tanggal unggah.';


--
-- Name: pks_dokumen_sponsorship; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pks_dokumen_sponsorship (
    po_id uuid NOT NULL,
    versi_po integer NOT NULL,
    form_ditandatangani boolean NOT NULL,
    rekening_atas_nama_lembaga boolean NOT NULL,
    meterai_bila_di_atas_5juta boolean NOT NULL,
    oleh text NOT NULL,
    pada timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pks_dokumen_sponsorship OWNER TO postgres;

--
-- Name: TABLE pks_dokumen_sponsorship; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pks_dokumen_sponsorship IS 'Konfirmasi Finance bahwa dokumen sponsorship sebuah PO sudah beres (catatan/18). Terikat versi_po: konfirmasi untuk versi yang bukan versi PO sekarang tidak berlaku.';


--
-- Name: po_catatan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_catatan (
    po_id uuid NOT NULL,
    jenis text NOT NULL,
    isi text,
    CONSTRAINT po_catatan_jenis_check CHECK ((jenis = ANY (ARRAY['pelaksanaan'::text, 'sponsorship'::text])))
);


ALTER TABLE public.po_catatan OWNER TO postgres;

--
-- Name: po_kelompok; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_kelompok (
    po_id uuid NOT NULL,
    nomor smallint NOT NULL,
    nama text,
    harga_siswa bigint NOT NULL,
    CONSTRAINT po_kelompok_harga_siswa_check CHECK ((harga_siswa >= 0)),
    CONSTRAINT po_kelompok_nama_check CHECK (((nama IS NULL) OR ((length(btrim(nama)) >= 1) AND (length(btrim(nama)) <= 60)))),
    CONSTRAINT po_kelompok_nomor_check CHECK (((nomor >= 1) AND (nomor <= 6)))
);


ALTER TABLE public.po_kelompok OWNER TO postgres;

--
-- Name: po_komentar; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_komentar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    isi text NOT NULL,
    oleh text NOT NULL,
    waktu timestamp with time zone DEFAULT now() NOT NULL,
    versi_po integer NOT NULL,
    disunting_pada timestamp with time zone,
    dihapus_pada timestamp with time zone,
    dihapus_oleh text,
    nama_penulis text,
    peran_penulis public.peran[],
    induk_kunci text,
    kedalaman integer DEFAULT 0 NOT NULL,
    CONSTRAINT po_komentar_isi_check CHECK ((length(btrim(isi)) > 0)),
    CONSTRAINT po_komentar_isi_panjang CHECK ((length(isi) <= 4000))
);


ALTER TABLE public.po_komentar OWNER TO postgres;

--
-- Name: po_komentar_dibaca; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_komentar_dibaca (
    po_id uuid NOT NULL,
    oleh text NOT NULL,
    waktu timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.po_komentar_dibaca OWNER TO postgres;

--
-- Name: po_komentar_revisi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_komentar_revisi (
    komentar_id uuid NOT NULL,
    isi text NOT NULL,
    digantikan_pada timestamp with time zone DEFAULT now() NOT NULL,
    id bigint NOT NULL,
    CONSTRAINT po_komentar_revisi_isi_panjang CHECK ((length(isi) <= 4000))
);


ALTER TABLE public.po_komentar_revisi OWNER TO postgres;

--
-- Name: po_komentar_revisi_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.po_komentar_revisi ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.po_komentar_revisi_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: po_komponen; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_komponen (
    po_id uuid NOT NULL,
    komponen_id text NOT NULL,
    sesi integer DEFAULT 1 NOT NULL,
    kelompok smallint DEFAULT 1 NOT NULL,
    CONSTRAINT po_komponen_kelompok_rentang CHECK (((kelompok >= 1) AND (kelompok <= 6))),
    CONSTRAINT po_komponen_sesi_check CHECK ((sesi >= 1))
);


ALTER TABLE public.po_komponen OWNER TO postgres;

--
-- Name: po_nomor_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.po ALTER COLUMN nomor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.po_nomor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: po_pengecualian; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_pengecualian (
    po_id uuid NOT NULL,
    lantai_disetujui bigint NOT NULL,
    harga_disetujui bigint NOT NULL,
    pelanggaran text[] NOT NULL,
    alasan text NOT NULL,
    disetujui_oleh text NOT NULL,
    disetujui_pada timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT po_pengecualian_alasan_check CHECK ((length(btrim(alasan)) > 0))
);


ALTER TABLE public.po_pengecualian OWNER TO postgres;

--
-- Name: po_riwayat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_riwayat (
    id bigint NOT NULL,
    po_id uuid NOT NULL,
    status_lama public.status_po,
    status_baru public.status_po NOT NULL,
    versi integer NOT NULL,
    oleh text,
    pada timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.po_riwayat OWNER TO postgres;

--
-- Name: po_riwayat_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.po_riwayat ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.po_riwayat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: po_rombel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_rombel (
    po_id uuid NOT NULL,
    kelas integer NOT NULL,
    rombel text NOT NULL,
    jumlah_siswa integer DEFAULT 0 NOT NULL,
    kelompok smallint DEFAULT 1 NOT NULL,
    CONSTRAINT po_rombel_jumlah_siswa_check CHECK ((jumlah_siswa >= 0)),
    CONSTRAINT po_rombel_kelompok_rentang CHECK (((kelompok >= 1) AND (kelompok <= 6)))
);


ALTER TABLE public.po_rombel OWNER TO postgres;

--
-- Name: po_termin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_termin (
    po_id uuid NOT NULL,
    urutan integer NOT NULL,
    tanggal date,
    nominal bigint DEFAULT 0 NOT NULL,
    CONSTRAINT po_termin_nominal_check CHECK ((nominal >= 0)),
    CONSTRAINT po_termin_urutan_check CHECK ((urutan >= 1))
);


ALTER TABLE public.po_termin OWNER TO postgres;

--
-- Name: pricelist_aktif; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pricelist_aktif (
    satu_baris boolean DEFAULT true NOT NULL,
    versi text NOT NULL,
    diperbarui_pada timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricelist_aktif_satu_baris_check CHECK (satu_baris)
);


ALTER TABLE public.pricelist_aktif OWNER TO postgres;

--
-- Name: sekolah; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sekolah (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nama text NOT NULL,
    npsn text,
    jenjang public.jenjang_sekolah NOT NULL,
    alamat text,
    telepon text,
    email text,
    kepala_sekolah text,
    kepsek_hp text,
    bendahara text,
    bendahara_hp text,
    dibuat_pada timestamp with time zone DEFAULT now() NOT NULL,
    diubah_pada timestamp with time zone DEFAULT now() NOT NULL,
    dipegang_oleh text
);


ALTER TABLE public.sekolah OWNER TO postgres;

--
-- Name: surat_verifikasi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.surat_verifikasi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    ditandatangani_oleh text,
    nama_penanda text,
    berkas text,
    dibuat_pada timestamp with time zone DEFAULT now() NOT NULL,
    final_pada timestamp with time zone,
    berkas_dihapus_pada timestamp with time zone,
    otomatis boolean DEFAULT false NOT NULL,
    CONSTRAINT surat_penanda_konsisten CHECK (((otomatis AND (ditandatangani_oleh IS NULL) AND (nama_penanda IS NULL)) OR ((NOT otomatis) AND (ditandatangani_oleh IS NOT NULL) AND (nama_penanda IS NOT NULL))))
);


ALTER TABLE public.surat_verifikasi OWNER TO postgres;

--
-- Name: COLUMN surat_verifikasi.final_pada; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.surat_verifikasi.final_pada IS 'Kosong = draf. Terisi = surat terkunci dan PKS boleh dibuat.';


--
-- Name: COLUMN surat_verifikasi.otomatis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.surat_verifikasi.otomatis IS 'Diterbitkan dan dikunci basis data, tanpa tanda tangan manusia. ditandatangani_oleh dan nama_penanda NULL.';


--
-- Name: tanda_tangan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tanda_tangan (
    po_id uuid NOT NULL,
    pihak public.pihak_ttd NOT NULL,
    nama text NOT NULL,
    berkas text NOT NULL,
    dibubuhkan_oleh text NOT NULL,
    waktu timestamp with time zone DEFAULT now() NOT NULL,
    asal text DEFAULT 'aplikasi'::text NOT NULL,
    berkas_dihapus_pada timestamp with time zone,
    CONSTRAINT tanda_tangan_asal_check CHECK ((asal = ANY (ARRAY['aplikasi'::text, 'pindaian'::text])))
);


ALTER TABLE public.tanda_tangan OWNER TO postgres;

--
-- Name: TABLE tanda_tangan; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tanda_tangan IS 'Tanda tangan digital pada PO. Data pribadi — berkasnya di bucket privat, retensi belum ditetapkan (lihat catatan UU PDP di spesifikasi).';


--
-- Name: verifikasi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verifikasi (
    po_id uuid NOT NULL,
    fungsi public.fungsi_verifikasi NOT NULL,
    hasil public.hasil_verifikasi NOT NULL,
    catatan text,
    item jsonb DEFAULT '{}'::jsonb NOT NULL,
    oleh text NOT NULL,
    waktu timestamp with time zone DEFAULT now() NOT NULL,
    versi_po integer NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    berlaku boolean DEFAULT true NOT NULL,
    digantikan_pada timestamp with time zone,
    sebab_basi text
);


ALTER TABLE public.verifikasi OWNER TO postgres;

--
-- Name: COLUMN verifikasi.berlaku; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.verifikasi.berlaku IS 'false = keputusan lama yang sudah digantikan karena PO direvisi. Disimpan sebagai jejak.';


--
-- Name: COLUMN verifikasi.sebab_basi; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.verifikasi.sebab_basi IS 'Bidang PO yang berubah sehingga keputusan ini perlu diulang.';


--
-- Name: verifikasi_otomatis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verifikasi_otomatis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    versi_po integer NOT NULL,
    versi_iom text NOT NULL,
    lolos boolean NOT NULL,
    paket text,
    gagal text[] DEFAULT '{}'::text[] NOT NULL,
    hasil jsonb NOT NULL,
    dicatat_pada timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    kelompok text[]
);


ALTER TABLE public.verifikasi_otomatis OWNER TO postgres;

--
-- Name: pengaturan_ekstraksi id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pengaturan_ekstraksi ALTER COLUMN id SET DEFAULT nextval('public.pengaturan_ekstraksi_id_seq'::regclass);


--
-- Name: deklarasi_kesiapan deklarasi_kesiapan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deklarasi_kesiapan
    ADD CONSTRAINT deklarasi_kesiapan_pkey PRIMARY KEY (produk, versi_produk);


--
-- Name: ekstraksi_po ekstraksi_po_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ekstraksi_po
    ADD CONSTRAINT ekstraksi_po_pkey PRIMARY KEY (id);


--
-- Name: ekstraksi_po ekstraksi_po_po_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ekstraksi_po
    ADD CONSTRAINT ekstraksi_po_po_id_key UNIQUE (po_id);


--
-- Name: harga_komponen harga_komponen_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.harga_komponen
    ADD CONSTRAINT harga_komponen_pkey PRIMARY KEY (id);


--
-- Name: harga_paket harga_paket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.harga_paket
    ADD CONSTRAINT harga_paket_pkey PRIMARY KEY (nama);


--
-- Name: pengaturan_ekstraksi pengaturan_ekstraksi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pengaturan_ekstraksi
    ADD CONSTRAINT pengaturan_ekstraksi_pkey PRIMARY KEY (id);


--
-- Name: pengguna pengguna_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pengguna
    ADD CONSTRAINT pengguna_email_key UNIQUE (email);


--
-- Name: pengguna pengguna_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pengguna
    ADD CONSTRAINT pengguna_pkey PRIMARY KEY (id);


--
-- Name: pengguna_riwayat pengguna_riwayat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pengguna_riwayat
    ADD CONSTRAINT pengguna_riwayat_pkey PRIMARY KEY (id);


--
-- Name: pks_dokumen_sponsorship pks_dokumen_sponsorship_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks_dokumen_sponsorship
    ADD CONSTRAINT pks_dokumen_sponsorship_pkey PRIMARY KEY (po_id);


--
-- Name: pks pks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks
    ADD CONSTRAINT pks_pkey PRIMARY KEY (id);


--
-- Name: pks pks_po_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks
    ADD CONSTRAINT pks_po_id_key UNIQUE (po_id);


--
-- Name: po_catatan po_catatan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_catatan
    ADD CONSTRAINT po_catatan_pkey PRIMARY KEY (po_id, jenis);


--
-- Name: po_kelompok po_kelompok_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_kelompok
    ADD CONSTRAINT po_kelompok_pkey PRIMARY KEY (po_id, nomor);


--
-- Name: po_komentar_dibaca po_komentar_dibaca_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komentar_dibaca
    ADD CONSTRAINT po_komentar_dibaca_pkey PRIMARY KEY (po_id, oleh);


--
-- Name: po_komentar po_komentar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komentar
    ADD CONSTRAINT po_komentar_pkey PRIMARY KEY (id);


--
-- Name: po_komentar_revisi po_komentar_revisi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komentar_revisi
    ADD CONSTRAINT po_komentar_revisi_pkey PRIMARY KEY (id);


--
-- Name: po_komponen po_komponen_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komponen
    ADD CONSTRAINT po_komponen_pkey PRIMARY KEY (po_id, kelompok, komponen_id);


--
-- Name: po_pengecualian po_pengecualian_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_pengecualian
    ADD CONSTRAINT po_pengecualian_pkey PRIMARY KEY (po_id);


--
-- Name: po po_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po
    ADD CONSTRAINT po_pkey PRIMARY KEY (id);


--
-- Name: po_riwayat po_riwayat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_riwayat
    ADD CONSTRAINT po_riwayat_pkey PRIMARY KEY (id);


--
-- Name: po_rombel po_rombel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_rombel
    ADD CONSTRAINT po_rombel_pkey PRIMARY KEY (po_id, kelas, rombel);


--
-- Name: po_termin po_termin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_termin
    ADD CONSTRAINT po_termin_pkey PRIMARY KEY (po_id, urutan);


--
-- Name: pricelist_aktif pricelist_aktif_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricelist_aktif
    ADD CONSTRAINT pricelist_aktif_pkey PRIMARY KEY (satu_baris);


--
-- Name: sekolah sekolah_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sekolah
    ADD CONSTRAINT sekolah_pkey PRIMARY KEY (id);


--
-- Name: surat_verifikasi surat_verifikasi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surat_verifikasi
    ADD CONSTRAINT surat_verifikasi_pkey PRIMARY KEY (id);


--
-- Name: surat_verifikasi surat_verifikasi_po_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surat_verifikasi
    ADD CONSTRAINT surat_verifikasi_po_id_key UNIQUE (po_id);


--
-- Name: tanda_tangan tanda_tangan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanda_tangan
    ADD CONSTRAINT tanda_tangan_pkey PRIMARY KEY (po_id, pihak);


--
-- Name: verifikasi_otomatis verifikasi_otomatis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verifikasi_otomatis
    ADD CONSTRAINT verifikasi_otomatis_pkey PRIMARY KEY (id);


--
-- Name: verifikasi verifikasi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verifikasi
    ADD CONSTRAINT verifikasi_pkey PRIMARY KEY (id);


--
-- Name: ekstraksi_po_klaim_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ekstraksi_po_klaim_idx ON public.ekstraksi_po USING btree (diklaim_pada DESC);


--
-- Name: pengguna_riwayat_pada; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pengguna_riwayat_pada ON public.pengguna_riwayat USING btree (pada DESC);


--
-- Name: pks_dibuat_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pks_dibuat_oleh_idx ON public.pks USING btree (dibuat_oleh);


--
-- Name: pks_diunggah_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pks_diunggah_oleh_idx ON public.pks USING btree (diunggah_oleh);


--
-- Name: po_dibuat_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_dibuat_oleh_idx ON public.po USING btree (dibuat_oleh);


--
-- Name: po_diverifikasi_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_diverifikasi_oleh_idx ON public.po USING btree (diverifikasi_oleh);


--
-- Name: po_komentar_induk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_komentar_induk ON public.po_komentar USING btree (po_id, induk_kunci);


--
-- Name: po_komentar_po_waktu; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_komentar_po_waktu ON public.po_komentar USING btree (po_id, waktu);


--
-- Name: po_komentar_revisi_induk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_komentar_revisi_induk ON public.po_komentar_revisi USING btree (komentar_id);


--
-- Name: po_riwayat_po; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_riwayat_po ON public.po_riwayat USING btree (po_id, pada);


--
-- Name: po_sekolah_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_sekolah_id_idx ON public.po USING btree (sekolah_id);


--
-- Name: po_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX po_status_idx ON public.po USING btree (status);


--
-- Name: sekolah_dipegang_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sekolah_dipegang_oleh_idx ON public.sekolah USING btree (dipegang_oleh);


--
-- Name: sekolah_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sekolah_lower_idx ON public.sekolah USING btree (lower(nama));


--
-- Name: sekolah_npsn_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sekolah_npsn_idx ON public.sekolah USING btree (npsn) WHERE ((npsn IS NOT NULL) AND (npsn <> ''::text));


--
-- Name: surat_verifikasi_ditandatangani_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX surat_verifikasi_ditandatangani_oleh_idx ON public.surat_verifikasi USING btree (ditandatangani_oleh);


--
-- Name: tanda_tangan_dibubuhkan_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tanda_tangan_dibubuhkan_oleh_idx ON public.tanda_tangan USING btree (dibubuhkan_oleh);


--
-- Name: verifikasi_oleh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX verifikasi_oleh_idx ON public.verifikasi USING btree (oleh);


--
-- Name: verifikasi_otomatis_po; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX verifikasi_otomatis_po ON public.verifikasi_otomatis USING btree (po_id, dicatat_pada DESC);


--
-- Name: verifikasi_satu_berlaku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX verifikasi_satu_berlaku ON public.verifikasi USING btree (po_id, fungsi) WHERE berlaku;


--
-- Name: pengguna jaga_admin_utama; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER jaga_admin_utama BEFORE DELETE OR UPDATE ON public.pengguna FOR EACH ROW EXECUTE FUNCTION private.jaga_admin_utama();


--
-- Name: po_komentar jaga_komentar_baru; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER jaga_komentar_baru BEFORE INSERT ON public.po_komentar FOR EACH ROW EXECUTE FUNCTION private.jaga_komentar_baru();


--
-- Name: po_komentar jaga_komentar_sunting; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER jaga_komentar_sunting BEFORE UPDATE ON public.po_komentar FOR EACH ROW EXECUTE FUNCTION private.jaga_komentar_sunting();


--
-- Name: po jaga_lantai_po; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER jaga_lantai_po BEFORE INSERT OR UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.jaga_lantai_po();


--
-- Name: po_pengecualian jaga_pengecualian; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER jaga_pengecualian BEFORE INSERT ON public.po_pengecualian FOR EACH ROW EXECUTE FUNCTION private.jaga_pengecualian();


--
-- Name: verifikasi jaga_verifikator_bukan_pembuat; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER jaga_verifikator_bukan_pembuat BEFORE INSERT OR UPDATE ON public.verifikasi FOR EACH ROW EXECUTE FUNCTION private.jaga_verifikator_bukan_pembuat();


--
-- Name: pengguna pengguna_catat; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER pengguna_catat AFTER INSERT OR DELETE OR UPDATE ON public.pengguna FOR EACH ROW EXECUTE FUNCTION private.catat_riwayat_pengguna();


--
-- Name: po po_bekukan_isi; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_bekukan_isi BEFORE UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.bekukan_isi_po();


--
-- Name: po po_bekukan_sekolah; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_bekukan_sekolah BEFORE INSERT OR UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.bekukan_sekolah();


--
-- Name: po po_bekukan_sekolah_basi; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_bekukan_sekolah_basi BEFORE UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.basikan_saat_sekolah_berubah();


--
-- Name: po po_catat; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_catat AFTER INSERT OR UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.catat_riwayat_po();


--
-- Name: po po_jaga_penanda; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_jaga_penanda BEFORE INSERT OR UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.jaga_penanda_otomatis();


--
-- Name: po po_jaga_penutupan; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_jaga_penutupan BEFORE UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.jaga_penutupan_verifikasi();


--
-- Name: po po_sentuh; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_sentuh BEFORE UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.sentuh_diubah_pada();


--
-- Name: po po_syarat_maju; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_syarat_maju BEFORE INSERT OR UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.jaga_syarat_maju();


--
-- Name: po po_tinjauan_sidik; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_tinjauan_sidik BEFORE INSERT OR UPDATE ON public.po FOR EACH ROW EXECUTE FUNCTION private.sidik_saat_ditinjau();


--
-- Name: verifikasi_otomatis po_tutup_otomatis; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_tutup_otomatis AFTER INSERT ON public.verifikasi_otomatis FOR EACH ROW WHEN (new.lolos) EXECUTE FUNCTION private.tutup_otomatis_trigger();


--
-- Name: po po_urutan_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_urutan_status BEFORE UPDATE OF status ON public.po FOR EACH ROW EXECUTE FUNCTION private.jaga_urutan_status_po();


--
-- Name: po po_verdict_iom; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER po_verdict_iom AFTER UPDATE OF status ON public.po FOR EACH ROW EXECUTE FUNCTION private.catat_verdict_iom();


--
-- Name: sekolah sekolah_pegang; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sekolah_pegang BEFORE INSERT ON public.sekolah FOR EACH ROW EXECUTE FUNCTION private.pegang_sekolah();


--
-- Name: sekolah sekolah_sentuh; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sekolah_sentuh BEFORE UPDATE ON public.sekolah FOR EACH ROW EXECUTE FUNCTION private.sentuh_diubah_pada();


--
-- Name: ekstraksi_po ekstraksi_po_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ekstraksi_po
    ADD CONSTRAINT ekstraksi_po_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: pks pks_dibuat_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks
    ADD CONSTRAINT pks_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES public.pengguna(email);


--
-- Name: pks pks_diunggah_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks
    ADD CONSTRAINT pks_diunggah_oleh_fkey FOREIGN KEY (diunggah_oleh) REFERENCES public.pengguna(email);


--
-- Name: pks_dokumen_sponsorship pks_dokumen_sponsorship_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks_dokumen_sponsorship
    ADD CONSTRAINT pks_dokumen_sponsorship_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: pks pks_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pks
    ADD CONSTRAINT pks_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_catatan po_catatan_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_catatan
    ADD CONSTRAINT po_catatan_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po po_dibuat_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po
    ADD CONSTRAINT po_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES public.pengguna(email) ON DELETE RESTRICT;


--
-- Name: po po_diverifikasi_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po
    ADD CONSTRAINT po_diverifikasi_oleh_fkey FOREIGN KEY (diverifikasi_oleh) REFERENCES public.pengguna(email);


--
-- Name: po_kelompok po_kelompok_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_kelompok
    ADD CONSTRAINT po_kelompok_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_komentar_dibaca po_komentar_dibaca_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komentar_dibaca
    ADD CONSTRAINT po_komentar_dibaca_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_komentar po_komentar_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komentar
    ADD CONSTRAINT po_komentar_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_komentar_revisi po_komentar_revisi_komentar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komentar_revisi
    ADD CONSTRAINT po_komentar_revisi_komentar_id_fkey FOREIGN KEY (komentar_id) REFERENCES public.po_komentar(id) ON DELETE CASCADE;


--
-- Name: po_komponen po_komponen_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_komponen
    ADD CONSTRAINT po_komponen_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_pengecualian po_pengecualian_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_pengecualian
    ADD CONSTRAINT po_pengecualian_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_riwayat po_riwayat_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_riwayat
    ADD CONSTRAINT po_riwayat_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po_rombel po_rombel_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_rombel
    ADD CONSTRAINT po_rombel_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: po po_sekolah_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po
    ADD CONSTRAINT po_sekolah_id_fkey FOREIGN KEY (sekolah_id) REFERENCES public.sekolah(id) ON DELETE RESTRICT;


--
-- Name: po_termin po_termin_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_termin
    ADD CONSTRAINT po_termin_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: sekolah sekolah_dipegang_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sekolah
    ADD CONSTRAINT sekolah_dipegang_oleh_fkey FOREIGN KEY (dipegang_oleh) REFERENCES public.pengguna(email);


--
-- Name: surat_verifikasi surat_verifikasi_ditandatangani_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surat_verifikasi
    ADD CONSTRAINT surat_verifikasi_ditandatangani_oleh_fkey FOREIGN KEY (ditandatangani_oleh) REFERENCES public.pengguna(email);


--
-- Name: surat_verifikasi surat_verifikasi_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surat_verifikasi
    ADD CONSTRAINT surat_verifikasi_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: tanda_tangan tanda_tangan_dibubuhkan_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanda_tangan
    ADD CONSTRAINT tanda_tangan_dibubuhkan_oleh_fkey FOREIGN KEY (dibubuhkan_oleh) REFERENCES public.pengguna(email);


--
-- Name: tanda_tangan tanda_tangan_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tanda_tangan
    ADD CONSTRAINT tanda_tangan_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: verifikasi verifikasi_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verifikasi
    ADD CONSTRAINT verifikasi_oleh_fkey FOREIGN KEY (oleh) REFERENCES public.pengguna(email);


--
-- Name: verifikasi_otomatis verifikasi_otomatis_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verifikasi_otomatis
    ADD CONSTRAINT verifikasi_otomatis_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: verifikasi verifikasi_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verifikasi
    ADD CONSTRAINT verifikasi_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.po(id) ON DELETE CASCADE;


--
-- Name: deklarasi_kesiapan; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deklarasi_kesiapan ENABLE ROW LEVEL SECURITY;

--
-- Name: deklarasi_kesiapan deklarasi_kesiapan_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deklarasi_kesiapan_lihat ON public.deklarasi_kesiapan FOR SELECT TO authenticated USING (private.boleh_lihat_semua());


--
-- Name: po_komentar_dibaca dibaca_milik_sendiri; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dibaca_milik_sendiri ON public.po_komentar_dibaca TO authenticated USING ((oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))) WITH CHECK (((oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_komentar_dibaca.po_id) AND private.boleh_lihat_po(p.dibuat_oleh))))));


--
-- Name: ekstraksi_po ekstraksi_baca; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ekstraksi_baca ON public.ekstraksi_po FOR SELECT TO authenticated USING (('admin_utama'::public.peran = ANY (private.peran_saya())));


--
-- Name: ekstraksi_po; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ekstraksi_po ENABLE ROW LEVEL SECURITY;

--
-- Name: pengaturan_ekstraksi gerbang_baca; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY gerbang_baca ON public.pengaturan_ekstraksi FOR SELECT TO authenticated USING (('admin_utama'::public.peran = ANY (private.peran_saya())));


--
-- Name: pengaturan_ekstraksi gerbang_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY gerbang_tulis ON public.pengaturan_ekstraksi FOR INSERT TO authenticated WITH CHECK ((('admin_utama'::public.peran = ANY (private.peran_saya())) AND (diubah_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));


--
-- Name: harga_komponen; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.harga_komponen ENABLE ROW LEVEL SECURITY;

--
-- Name: harga_paket; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.harga_paket ENABLE ROW LEVEL SECURITY;

--
-- Name: po_komentar komentar_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY komentar_lihat ON public.po_komentar FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_komentar.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_komentar_revisi komentar_revisi_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY komentar_revisi_lihat ON public.po_komentar_revisi FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.po_komentar k
     JOIN public.po p ON ((p.id = k.po_id)))
  WHERE ((k.id = po_komentar_revisi.komentar_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_komentar komentar_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY komentar_tulis ON public.po_komentar FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_komentar.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))) AND (NOT ('c_level'::public.peran = ANY (private.peran_saya()))) AND (oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));


--
-- Name: pengaturan_ekstraksi; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pengaturan_ekstraksi ENABLE ROW LEVEL SECURITY;

--
-- Name: po_pengecualian pengecualian_beri; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pengecualian_beri ON public.po_pengecualian FOR INSERT TO authenticated WITH CHECK (private.punya_peran(VARIADIC ARRAY['head_of_operations'::public.peran]));


--
-- Name: po_pengecualian pengecualian_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pengecualian_lihat ON public.po_pengecualian FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_pengecualian.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: pengguna; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pengguna ENABLE ROW LEVEL SECURITY;

--
-- Name: pengguna pengguna_admin_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pengguna_admin_lihat ON public.pengguna FOR SELECT TO authenticated USING (private.punya_peran(VARIADIC ARRAY['admin_utama'::public.peran]));


--
-- Name: pengguna pengguna_admin_ubah; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pengguna_admin_ubah ON public.pengguna TO authenticated USING (private.punya_peran(VARIADIC ARRAY['admin_utama'::public.peran])) WITH CHECK (private.punya_peran(VARIADIC ARRAY['admin_utama'::public.peran]));


--
-- Name: pengguna pengguna_lihat_sendiri; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pengguna_lihat_sendiri ON public.pengguna FOR SELECT TO authenticated USING ((email = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))));


--
-- Name: pengguna_riwayat; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pengguna_riwayat ENABLE ROW LEVEL SECURITY;

--
-- Name: pks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pks ENABLE ROW LEVEL SECURITY;

--
-- Name: pks pks_batal; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pks_batal ON public.pks FOR DELETE TO authenticated USING (((final_pada IS NULL) AND private.punya_peran(VARIADIC ARRAY['sales'::public.peran, 'head_of_sales'::public.peran, 'admin_sales'::public.peran]) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = pks.po_id) AND private.milik_sales(p.dibuat_oleh))))));


--
-- Name: pks_dokumen_sponsorship pks_dok_sp_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pks_dok_sp_lihat ON public.pks_dokumen_sponsorship FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = pks_dokumen_sponsorship.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: pks_dokumen_sponsorship pks_dok_sp_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pks_dok_sp_tulis ON public.pks_dokumen_sponsorship USING (('finance'::public.peran = ANY (private.peran_saya()))) WITH CHECK ((('finance'::public.peran = ANY (private.peran_saya())) AND (lower(oleh) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = pks_dokumen_sponsorship.po_id) AND (p.versi = pks_dokumen_sponsorship.versi_po))))));


--
-- Name: pks_dokumen_sponsorship; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pks_dokumen_sponsorship ENABLE ROW LEVEL SECURITY;

--
-- Name: pks pks_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pks_lihat ON public.pks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = pks.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po ENABLE ROW LEVEL SECURITY;

--
-- Name: po po_buat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_buat ON public.po FOR INSERT TO authenticated WITH CHECK (((dibuat_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND private.punya_peran(VARIADIC ARRAY['sales'::public.peran, 'head_of_sales'::public.peran, 'admin_sales'::public.peran]) AND (status = 'draf'::public.status_po)));


--
-- Name: po_catatan; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_catatan ENABLE ROW LEVEL SECURITY;

--
-- Name: po_catatan po_catatan_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_catatan_lihat ON public.po_catatan FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_catatan.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_catatan po_catatan_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_catatan_tulis ON public.po_catatan TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_catatan.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_catatan.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status)))));


--
-- Name: po po_hapus; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_hapus ON public.po FOR DELETE TO authenticated USING (((status = 'draf'::public.status_po) AND (dibuat_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));


--
-- Name: po_kelompok; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_kelompok ENABLE ROW LEVEL SECURITY;

--
-- Name: po_kelompok po_kelompok_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_kelompok_lihat ON public.po_kelompok FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_kelompok.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_kelompok po_kelompok_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_kelompok_tulis ON public.po_kelompok TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_kelompok.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_kelompok.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status)))));


--
-- Name: po_komentar; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_komentar ENABLE ROW LEVEL SECURITY;

--
-- Name: po_komentar_dibaca; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_komentar_dibaca ENABLE ROW LEVEL SECURITY;

--
-- Name: po_komentar_revisi; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_komentar_revisi ENABLE ROW LEVEL SECURITY;

--
-- Name: po_komponen; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_komponen ENABLE ROW LEVEL SECURITY;

--
-- Name: po_komponen po_komponen_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_komponen_lihat ON public.po_komponen FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_komponen.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_komponen po_komponen_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_komponen_tulis ON public.po_komponen TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_komponen.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_komponen.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status)))));


--
-- Name: po po_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_lihat ON public.po FOR SELECT TO authenticated USING (private.boleh_lihat_po(dibuat_oleh));


--
-- Name: po_pengecualian; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_pengecualian ENABLE ROW LEVEL SECURITY;

--
-- Name: po_riwayat; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_riwayat ENABLE ROW LEVEL SECURITY;

--
-- Name: po_riwayat po_riwayat_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_riwayat_lihat ON public.po_riwayat FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_riwayat.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_rombel; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_rombel ENABLE ROW LEVEL SECURITY;

--
-- Name: po_rombel po_rombel_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_rombel_lihat ON public.po_rombel FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_rombel.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_rombel po_rombel_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_rombel_tulis ON public.po_rombel TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_rombel.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_rombel.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status)))));


--
-- Name: po_termin; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_termin ENABLE ROW LEVEL SECURITY;

--
-- Name: po_termin po_termin_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_termin_lihat ON public.po_termin FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_termin.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: po_termin po_termin_tulis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_termin_tulis ON public.po_termin TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_termin.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = po_termin.po_id) AND private.boleh_ubah_po(p.dibuat_oleh, p.status)))));


--
-- Name: po po_tolak_ke_draf; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_tolak_ke_draf ON public.po FOR UPDATE TO authenticated USING (((status = 'ditolak'::public.status_po) AND private.milik_sales(dibuat_oleh))) WITH CHECK (((status = ANY (ARRAY['ditolak'::public.status_po, 'draf'::public.status_po])) AND private.milik_sales(dibuat_oleh)));


--
-- Name: po po_ubah; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_ubah ON public.po FOR UPDATE TO authenticated USING (((status = ANY (ARRAY['draf'::public.status_po, 'ditolak'::public.status_po, 'menunggu_ttd'::public.status_po, 'ditandatangani'::public.status_po])) AND private.milik_sales(dibuat_oleh))) WITH CHECK (((status = ANY (ARRAY['draf'::public.status_po, 'ditolak'::public.status_po, 'menunggu_ttd'::public.status_po, 'ditandatangani'::public.status_po, 'verifikasi'::public.status_po])) AND private.milik_sales(dibuat_oleh)));


--
-- Name: po po_verifikasi_lanjut; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY po_verifikasi_lanjut ON public.po FOR UPDATE TO authenticated USING (((status = 'verifikasi'::public.status_po) AND private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::public.peran]) AND (dibuat_oleh <> lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))))) WITH CHECK (((status = ANY (ARRAY['verifikasi'::public.status_po, 'terverifikasi'::public.status_po, 'ditolak'::public.status_po])) AND private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::public.peran]) AND (dibuat_oleh <> lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));


--
-- Name: pricelist_aktif; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pricelist_aktif ENABLE ROW LEVEL SECURITY;

--
-- Name: pengguna_riwayat riwayat_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY riwayat_lihat ON public.pengguna_riwayat FOR SELECT TO authenticated USING (private.punya_peran(VARIADIC ARRAY['admin_utama'::public.peran]));


--
-- Name: sekolah; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sekolah ENABLE ROW LEVEL SECURITY;

--
-- Name: sekolah sekolah_buat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sekolah_buat ON public.sekolah FOR INSERT TO authenticated WITH CHECK ((private.punya_peran(VARIADIC ARRAY['sales'::public.peran, 'head_of_sales'::public.peran, 'admin_sales'::public.peran]) AND ((dipegang_oleh IS NULL) OR (dipegang_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::public.peran, 'admin_sales'::public.peran]))));


--
-- Name: sekolah sekolah_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sekolah_lihat ON public.sekolah FOR SELECT TO authenticated USING (private.boleh_lihat_sekolah(dipegang_oleh));


--
-- Name: sekolah sekolah_ubah; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sekolah_ubah ON public.sekolah FOR UPDATE TO authenticated USING ((private.punya_peran(VARIADIC ARRAY['sales'::public.peran, 'head_of_sales'::public.peran, 'admin_sales'::public.peran]) AND private.boleh_lihat_sekolah(dipegang_oleh))) WITH CHECK ((private.punya_peran(VARIADIC ARRAY['sales'::public.peran, 'head_of_sales'::public.peran, 'admin_sales'::public.peran]) AND ((dipegang_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::public.peran, 'admin_sales'::public.peran]))));


--
-- Name: surat_verifikasi surat_batal; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surat_batal ON public.surat_verifikasi FOR DELETE TO authenticated USING ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::public.peran]) AND (final_pada IS NULL) AND (NOT otomatis)));


--
-- Name: surat_verifikasi surat_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surat_lihat ON public.surat_verifikasi FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = surat_verifikasi.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: surat_verifikasi surat_sunting; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surat_sunting ON public.surat_verifikasi FOR UPDATE TO authenticated USING ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::public.peran]) AND (final_pada IS NULL) AND (NOT otomatis))) WITH CHECK ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::public.peran]) AND (NOT otomatis) AND (ditandatangani_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));


--
-- Name: surat_verifikasi surat_terbit; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surat_terbit ON public.surat_verifikasi FOR INSERT TO authenticated WITH CHECK ((private.punya_peran(VARIADIC ARRAY['tech_ops_lead'::public.peran]) AND (NOT otomatis) AND (ditandatangani_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (final_pada IS NULL) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = surat_verifikasi.po_id) AND (p.status = 'terverifikasi'::public.status_po))))));


--
-- Name: surat_verifikasi; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.surat_verifikasi ENABLE ROW LEVEL SECURITY;

--
-- Name: tanda_tangan; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tanda_tangan ENABLE ROW LEVEL SECURITY;

--
-- Name: tanda_tangan ttd_bubuh; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ttd_bubuh ON public.tanda_tangan FOR INSERT TO authenticated WITH CHECK (((dibubuhkan_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = tanda_tangan.po_id) AND (p.status = 'menunggu_ttd'::public.status_po) AND ((p.dibuat_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::public.peran, 'admin_sales'::public.peran])))))));


--
-- Name: tanda_tangan ttd_hapus; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ttd_hapus ON public.tanda_tangan FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = tanda_tangan.po_id) AND (p.status = 'menunggu_ttd'::public.status_po) AND ((p.dibuat_oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR private.punya_peran(VARIADIC ARRAY['head_of_sales'::public.peran, 'admin_sales'::public.peran]))))));


--
-- Name: tanda_tangan ttd_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ttd_lihat ON public.tanda_tangan FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = tanda_tangan.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: verifikasi; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.verifikasi ENABLE ROW LEVEL SECURITY;

--
-- Name: verifikasi verifikasi_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY verifikasi_lihat ON public.verifikasi FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = verifikasi.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: verifikasi_otomatis; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.verifikasi_otomatis ENABLE ROW LEVEL SECURITY;

--
-- Name: verifikasi_otomatis verifikasi_otomatis_lihat; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY verifikasi_otomatis_lihat ON public.verifikasi_otomatis FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = verifikasi_otomatis.po_id) AND private.boleh_lihat_po(p.dibuat_oleh)))));


--
-- Name: verifikasi verifikasi_putuskan; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY verifikasi_putuskan ON public.verifikasi FOR INSERT TO authenticated WITH CHECK (((oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND private.fungsi_saya_cocok(fungsi) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = verifikasi.po_id) AND (p.status = 'verifikasi'::public.status_po))))));


--
-- Name: verifikasi verifikasi_ubah; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY verifikasi_ubah ON public.verifikasi FOR UPDATE TO authenticated USING ((berlaku AND private.fungsi_saya_cocok(fungsi) AND (EXISTS ( SELECT 1
   FROM public.po p
  WHERE ((p.id = verifikasi.po_id) AND (p.status = 'verifikasi'::public.status_po)))))) WITH CHECK (((oleh = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) AND private.fungsi_saya_cocok(fungsi)));


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION aturan_iom(p_kode text, p_lolos boolean, p_bukti text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.aturan_iom(p_kode text, p_lolos boolean, p_bukti text) FROM PUBLIC;


--
-- Name: FUNCTION boleh_lihat_acquisition(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.boleh_lihat_acquisition() FROM PUBLIC;
GRANT ALL ON FUNCTION private.boleh_lihat_acquisition() TO authenticated;


--
-- Name: FUNCTION boleh_lihat_po(pemilik text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.boleh_lihat_po(pemilik text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.boleh_lihat_po(pemilik text) TO authenticated;


--
-- Name: FUNCTION boleh_lihat_semua(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.boleh_lihat_semua() FROM PUBLIC;
GRANT ALL ON FUNCTION private.boleh_lihat_semua() TO authenticated;


--
-- Name: FUNCTION boleh_ubah_po(pemilik text, st public.status_po); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.boleh_ubah_po(pemilik text, st public.status_po) FROM PUBLIC;
GRANT ALL ON FUNCTION private.boleh_ubah_po(pemilik text, st public.status_po) TO authenticated;


--
-- Name: FUNCTION catat_verdict_iom(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.catat_verdict_iom() FROM PUBLIC;


--
-- Name: FUNCTION fungsi_saya_cocok(f public.fungsi_verifikasi); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.fungsi_saya_cocok(f public.fungsi_verifikasi) FROM PUBLIC;
GRANT ALL ON FUNCTION private.fungsi_saya_cocok(f public.fungsi_verifikasi) TO authenticated;


--
-- Name: FUNCTION jaga_penanda_otomatis(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.jaga_penanda_otomatis() FROM PUBLIC;


--
-- Name: FUNCTION jaga_penutupan_verifikasi(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.jaga_penutupan_verifikasi() FROM PUBLIC;


--
-- Name: FUNCTION jaga_urutan_status_po(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.jaga_urutan_status_po() FROM PUBLIC;


--
-- Name: FUNCTION kelompok_iom(p_po uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.kelompok_iom(p_po uuid) FROM PUBLIC;


--
-- Name: FUNCTION lantai_siswa_kelompok(p_po uuid, p_kelompok smallint); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.lantai_siswa_kelompok(p_po uuid, p_kelompok smallint) FROM PUBLIC;


--
-- Name: FUNCTION milik_sales(pemilik text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.milik_sales(pemilik text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.milik_sales(pemilik text) TO authenticated;


--
-- Name: FUNCTION model_ekstraksi(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.model_ekstraksi() FROM PUBLIC;


--
-- Name: FUNCTION nilai_iom(p_po uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.nilai_iom(p_po uuid) FROM PUBLIC;


--
-- Name: FUNCTION peran_saya(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.peran_saya() FROM PUBLIC;
GRANT ALL ON FUNCTION private.peran_saya() TO authenticated;


--
-- Name: FUNCTION pihak_wajib(p_skema smallint); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.pihak_wajib(p_skema smallint) FROM PUBLIC;


--
-- Name: FUNCTION punya_peran(VARIADIC dicari public.peran[]); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.punya_peran(VARIADIC dicari public.peran[]) FROM PUBLIC;
GRANT ALL ON FUNCTION private.punya_peran(VARIADIC dicari public.peran[]) TO authenticated;


--
-- Name: FUNCTION sentuh_diubah_pada(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.sentuh_diubah_pada() FROM PUBLIC;
GRANT ALL ON FUNCTION private.sentuh_diubah_pada() TO authenticated;


--
-- Name: TABLE po; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po TO anon;
GRANT ALL ON TABLE public.po TO authenticated;
GRANT ALL ON TABLE public.po TO service_role;


--
-- Name: FUNCTION sidik_tinjauan(p public.po); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.sidik_tinjauan(p public.po) FROM PUBLIC;


--
-- Name: FUNCTION tutup_otomatis(p_po uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.tutup_otomatis(p_po uuid) FROM PUBLIC;


--
-- Name: FUNCTION tutup_otomatis_trigger(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.tutup_otomatis_trigger() FROM PUBLIC;


--
-- Name: FUNCTION ajukan_po_unggahan(p_po uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ajukan_po_unggahan(p_po uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ajukan_po_unggahan(p_po uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ajukan_po_unggahan(p_po uuid) TO service_role;


--
-- Name: FUNCTION basikan_verifikasi(p_po uuid, p_fungsi public.fungsi_verifikasi[], p_sebab text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.basikan_verifikasi(p_po uuid, p_fungsi public.fungsi_verifikasi[], p_sebab text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.basikan_verifikasi(p_po uuid, p_fungsi public.fungsi_verifikasi[], p_sebab text) TO authenticated;
GRANT ALL ON FUNCTION public.basikan_verifikasi(p_po uuid, p_fungsi public.fungsi_verifikasi[], p_sebab text) TO service_role;


--
-- Name: FUNCTION buat_pks(p_po uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.buat_pks(p_po uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.buat_pks(p_po uuid) TO authenticated;
GRANT ALL ON FUNCTION public.buat_pks(p_po uuid) TO service_role;


--
-- Name: FUNCTION daftar_jatuh_tempo(p_bulan integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.daftar_jatuh_tempo(p_bulan integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.daftar_jatuh_tempo(p_bulan integer) TO authenticated;
GRANT ALL ON FUNCTION public.daftar_jatuh_tempo(p_bulan integer) TO service_role;


--
-- Name: FUNCTION daftar_penanda_tangan(p_peran public.peran[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.daftar_penanda_tangan(p_peran public.peran[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.daftar_penanda_tangan(p_peran public.peran[]) TO authenticated;
GRANT ALL ON FUNCTION public.daftar_penanda_tangan(p_peran public.peran[]) TO service_role;


--
-- Name: FUNCTION finalisasi_pks(p_po uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.finalisasi_pks(p_po uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finalisasi_pks(p_po uuid) TO authenticated;
GRANT ALL ON FUNCTION public.finalisasi_pks(p_po uuid) TO service_role;


--
-- Name: FUNCTION gerbang_ekstraksi_menyala(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.gerbang_ekstraksi_menyala() FROM PUBLIC;
GRANT ALL ON FUNCTION public.gerbang_ekstraksi_menyala() TO authenticated;
GRANT ALL ON FUNCTION public.gerbang_ekstraksi_menyala() TO service_role;


--
-- Name: FUNCTION hapus_komentar(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hapus_komentar(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hapus_komentar(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.hapus_komentar(p_id uuid) TO service_role;


--
-- Name: FUNCTION hitung_po_per_status(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.hitung_po_per_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hitung_po_per_status() TO authenticated;
GRANT ALL ON FUNCTION public.hitung_po_per_status() TO service_role;


--
-- Name: FUNCTION klaim_ekstraksi(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.klaim_ekstraksi() FROM PUBLIC;
GRANT ALL ON FUNCTION public.klaim_ekstraksi() TO authenticated;
GRANT ALL ON FUNCTION public.klaim_ekstraksi() TO service_role;


--
-- Name: FUNCTION komentar_belum_dibaca(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.komentar_belum_dibaca() FROM PUBLIC;
GRANT ALL ON FUNCTION public.komentar_belum_dibaca() TO authenticated;
GRANT ALL ON FUNCTION public.komentar_belum_dibaca() TO service_role;


--
-- Name: FUNCTION selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text, p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text, p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text, p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer) TO authenticated;
GRANT ALL ON FUNCTION public.selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text, p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer) TO service_role;


--
-- Name: FUNCTION sunting_komentar(p_id uuid, p_isi text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.sunting_komentar(p_id uuid, p_isi text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sunting_komentar(p_id uuid, p_isi text) TO authenticated;
GRANT ALL ON FUNCTION public.sunting_komentar(p_id uuid, p_isi text) TO service_role;


--
-- Name: FUNCTION tandai_berkas_dihapus(p_jalur text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.tandai_berkas_dihapus(p_jalur text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tandai_berkas_dihapus(p_jalur text) TO authenticated;
GRANT ALL ON FUNCTION public.tandai_berkas_dihapus(p_jalur text) TO service_role;


--
-- Name: FUNCTION tandai_komentar_dibaca(p_po uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.tandai_komentar_dibaca(p_po uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tandai_komentar_dibaca(p_po uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tandai_komentar_dibaca(p_po uuid) TO service_role;


--
-- Name: FUNCTION tautkan_ekstraksi(p_id uuid, p_po uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.tautkan_ekstraksi(p_id uuid, p_po uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tautkan_ekstraksi(p_id uuid, p_po uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tautkan_ekstraksi(p_id uuid, p_po uuid) TO service_role;


--
-- Name: FUNCTION unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date) TO authenticated;
GRANT ALL ON FUNCTION public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date) TO service_role;


--
-- Name: TABLE deklarasi_kesiapan; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.deklarasi_kesiapan TO service_role;
GRANT SELECT ON TABLE public.deklarasi_kesiapan TO authenticated;


--
-- Name: TABLE ekstraksi_po; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ekstraksi_po TO anon;
GRANT ALL ON TABLE public.ekstraksi_po TO authenticated;
GRANT ALL ON TABLE public.ekstraksi_po TO service_role;


--
-- Name: TABLE harga_komponen; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.harga_komponen TO service_role;


--
-- Name: TABLE harga_paket; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.harga_paket TO service_role;


--
-- Name: TABLE pengaturan_ekstraksi; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pengaturan_ekstraksi TO anon;
GRANT ALL ON TABLE public.pengaturan_ekstraksi TO authenticated;
GRANT ALL ON TABLE public.pengaturan_ekstraksi TO service_role;


--
-- Name: SEQUENCE pengaturan_ekstraksi_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pengaturan_ekstraksi_id_seq TO anon;
GRANT ALL ON SEQUENCE public.pengaturan_ekstraksi_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pengaturan_ekstraksi_id_seq TO service_role;


--
-- Name: TABLE pengguna; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pengguna TO anon;
GRANT ALL ON TABLE public.pengguna TO authenticated;
GRANT ALL ON TABLE public.pengguna TO service_role;


--
-- Name: TABLE pengguna_riwayat; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pengguna_riwayat TO anon;
GRANT ALL ON TABLE public.pengguna_riwayat TO authenticated;
GRANT ALL ON TABLE public.pengguna_riwayat TO service_role;


--
-- Name: SEQUENCE pengguna_riwayat_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pengguna_riwayat_id_seq TO anon;
GRANT ALL ON SEQUENCE public.pengguna_riwayat_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pengguna_riwayat_id_seq TO service_role;


--
-- Name: TABLE pks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pks TO anon;
GRANT ALL ON TABLE public.pks TO authenticated;
GRANT ALL ON TABLE public.pks TO service_role;


--
-- Name: TABLE pks_dokumen_sponsorship; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pks_dokumen_sponsorship TO authenticated;
GRANT ALL ON TABLE public.pks_dokumen_sponsorship TO service_role;


--
-- Name: TABLE po_catatan; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po_catatan TO anon;
GRANT ALL ON TABLE public.po_catatan TO authenticated;
GRANT ALL ON TABLE public.po_catatan TO service_role;


--
-- Name: TABLE po_kelompok; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.po_kelompok TO authenticated;
GRANT ALL ON TABLE public.po_kelompok TO service_role;


--
-- Name: TABLE po_komentar; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.po_komentar TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.po_komentar TO authenticated;
GRANT ALL ON TABLE public.po_komentar TO service_role;


--
-- Name: TABLE po_komentar_dibaca; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.po_komentar_dibaca TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.po_komentar_dibaca TO authenticated;
GRANT ALL ON TABLE public.po_komentar_dibaca TO service_role;


--
-- Name: TABLE po_komentar_revisi; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.po_komentar_revisi TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.po_komentar_revisi TO authenticated;
GRANT ALL ON TABLE public.po_komentar_revisi TO service_role;


--
-- Name: SEQUENCE po_komentar_revisi_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.po_komentar_revisi_id_seq TO anon;
GRANT ALL ON SEQUENCE public.po_komentar_revisi_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.po_komentar_revisi_id_seq TO service_role;


--
-- Name: TABLE po_komponen; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po_komponen TO anon;
GRANT ALL ON TABLE public.po_komponen TO authenticated;
GRANT ALL ON TABLE public.po_komponen TO service_role;


--
-- Name: SEQUENCE po_nomor_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.po_nomor_seq TO anon;
GRANT ALL ON SEQUENCE public.po_nomor_seq TO authenticated;
GRANT ALL ON SEQUENCE public.po_nomor_seq TO service_role;


--
-- Name: TABLE po_pengecualian; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.po_pengecualian TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.po_pengecualian TO authenticated;
GRANT ALL ON TABLE public.po_pengecualian TO service_role;


--
-- Name: TABLE po_riwayat; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po_riwayat TO anon;
GRANT ALL ON TABLE public.po_riwayat TO authenticated;
GRANT ALL ON TABLE public.po_riwayat TO service_role;


--
-- Name: SEQUENCE po_riwayat_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.po_riwayat_id_seq TO anon;
GRANT ALL ON SEQUENCE public.po_riwayat_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.po_riwayat_id_seq TO service_role;


--
-- Name: TABLE po_rombel; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po_rombel TO anon;
GRANT ALL ON TABLE public.po_rombel TO authenticated;
GRANT ALL ON TABLE public.po_rombel TO service_role;


--
-- Name: TABLE po_termin; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po_termin TO anon;
GRANT ALL ON TABLE public.po_termin TO authenticated;
GRANT ALL ON TABLE public.po_termin TO service_role;


--
-- Name: TABLE pricelist_aktif; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pricelist_aktif TO service_role;


--
-- Name: TABLE sekolah; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sekolah TO anon;
GRANT ALL ON TABLE public.sekolah TO authenticated;
GRANT ALL ON TABLE public.sekolah TO service_role;


--
-- Name: TABLE surat_verifikasi; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.surat_verifikasi TO anon;
GRANT ALL ON TABLE public.surat_verifikasi TO authenticated;
GRANT ALL ON TABLE public.surat_verifikasi TO service_role;


--
-- Name: TABLE tanda_tangan; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tanda_tangan TO anon;
GRANT ALL ON TABLE public.tanda_tangan TO authenticated;
GRANT ALL ON TABLE public.tanda_tangan TO service_role;


--
-- Name: TABLE verifikasi; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.verifikasi TO anon;
GRANT ALL ON TABLE public.verifikasi TO authenticated;
GRANT ALL ON TABLE public.verifikasi TO service_role;


--
-- Name: TABLE verifikasi_otomatis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.verifikasi_otomatis TO service_role;
GRANT SELECT ON TABLE public.verifikasi_otomatis TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict R5HdNFVbdyZlZJX9rW41yYP46GoL0l46PaH0OvPgvuUGu1wpERGWvABIOQZokOJ

