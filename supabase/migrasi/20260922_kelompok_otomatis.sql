-- PO berkelompok boleh lolos verifikasi otomatis (keputusan Rizki 22 Sep 2026,
-- catatan/13a Bagian 9). Menggantikan aturan `satu-kelompok` ("PO berkelompok selalu
-- manual") yang ditetapkan 17 Sep 2026.
--
-- Alasannya: harga per siswa PO berkelompok tersimpan di po_kelompok, dan tabel itu memang
-- cara resmi memberi harga BERBEDA per kelompok. Melarangnya otomatis berarti setiap PO
-- berkelompok selalu menyita waktu keempat fungsi, padahal isinya bisa diperiksa mesin
-- sepenuhnya.
--
-- Yang menahan sekarang bukan jenis PO-nya, tapi isi tiap kelompok: komponennya harus persis
-- satu paket, ada deklarasi kesiapan yang berlaku untuk paket itu, dan harganya tidak di
-- bawah bottom price paketnya. Diskon per kelompok di bawah price list TIDAK memaksa manual
-- (keputusan Rizki 22 Sep 2026): selama masih >= bottom, kelompok itu sah.
--
-- Aturan `satu-kelompok` diganti `kelompok-terdefinisi`. Aturan harga (`lantai-siswa`,
-- `tanpa-diskon`) tidak lagi dilewati untuk PO berkelompok; keduanya menilai SETIAP kelompok
-- dari harganya sendiri, bukan dari `po.harga_siswa` yang bernilai 0 (temuan PO-344,
-- 21 Sep 2026).
--
-- Badan nilai_iom disalin dari YANG HIDUP DI PRODUKSI (dump 21 Sep 2026 lewat
-- 20260921b_bukti_harga_po_berkelompok), bukan dari 20260917b yang sudah usang.

-- ---------------------------------------------------------------------------
-- 1. Daftar paket yang dipakai, satu baris per paket
-- ---------------------------------------------------------------------------
alter table verifikasi_otomatis add column if not exists kelompok text[];

-- ---------------------------------------------------------------------------
-- 2. Versi aturan
-- ---------------------------------------------------------------------------
create or replace function private.versi_iom_berlaku()
 returns text language sql immutable set search_path to 'public'
as $function$ select 'iom-2026-09-22'::text $function$;

-- ---------------------------------------------------------------------------
-- 3. Kelompok beserta komponennya, siap dinilai satu per satu
-- ---------------------------------------------------------------------------
create or replace function private.kelompok_iom(p_po uuid)
returns jsonb language sql stable security definer set search_path to public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'nomor', k.nomor, 'hargaSiswa', k.harga_siswa, 'komponen', kom.ids) order by k.nomor), '[]'::jsonb)
    from po_kelompok k
    left join lateral (
      select coalesce(jsonb_agg(distinct pk.komponen_id order by pk.komponen_id), '[]'::jsonb) as ids
        from po_komponen pk where pk.po_id = k.po_id and pk.kelompok = k.nomor
    ) kom on true
   where k.po_id = p_po;
$$;
revoke all on function private.kelompok_iom(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mesin aturan
-- ---------------------------------------------------------------------------
create or replace function private.nilai_iom(p_po uuid)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
 as $$
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

-- ---------------------------------------------------------------------------
-- 5. Pencatat verdict: simpan juga daftar paketnya
-- ---------------------------------------------------------------------------
create or replace function private.catat_verdict_iom()
returns trigger language plpgsql security definer set search_path = public
as $$
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

drop trigger if exists po_verdict_iom on po;
create trigger po_verdict_iom after update of status on po
  for each row execute function private.catat_verdict_iom();

-- ---------------------------------------------------------------------------
-- 6. Penutupan: deklarasi diperiksa untuk SETIAP paket yang dipakai
-- ---------------------------------------------------------------------------
-- Sisa badan disalin dari definisi hidup 17 Sep 2026; yang berubah hanya pemeriksaan
-- deklarasi: dari satu `t.paket` menjadi setiap elemen `t.kelompok` (jatuh kembali ke
-- `t.paket` untuk baris lama yang belum punya kolomnya).
create or replace function private.jaga_penutupan_verifikasi()
returns trigger language plpgsql set search_path = public
as $$
declare hijau int; tolak int;
begin
  if OLD.status <> 'verifikasi' or NEW.status = OLD.status then return NEW; end if;
  select count(*) filter (where hasil <> 'tolak'), count(*) filter (where hasil = 'tolak')
    into hijau, tolak from verifikasi where po_id = NEW.id and berlaku;
  if NEW.status = 'terverifikasi' and (hijau < 4 or tolak > 0) then
    -- Jalur IoM: tanpa empat persetujuan, HANYA Head of Operations, tanpa satu pun penolakan,
    -- dan verdict TERAKHIR lolos untuk versi PO ini dan versi IoM yang berlaku.
    -- Peran dicek harfiah lewat peran_saya(), bukan punya_peran(): punya_peran meloloskan
    -- admin_utama untuk peran apa pun, padahal keputusannya "hanya Head of Operations" dan
    -- namanya yang tercetak di Surat (temuan QA putaran 1).
    -- Deklarasi paketnya diperiksa ulang saat menutup. Sejak PO berkelompok boleh otomatis,
    -- jadi SETIAP paket yang dipakai diperiksa, bukan cuma satu.
    if tolak > 0 or not ('head_of_operations' = any(private.peran_saya())) or not exists (
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

revoke all on function private.jaga_penutupan_verifikasi() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Verdict PO-344 disegarkan: dulu manual karena berkelompok, sekarang lolos
-- ---------------------------------------------------------------------------
-- Hanya disegarkan bila PO-nya benar-benar lolos di bawah aturan baru. Kalau tidak, baris
-- lama dibiarkan (PO tetap manual) dan itu terlihat di layar, bukan tersembunyi.
insert into verifikasi_otomatis (po_id, versi_po, versi_iom, lolos, paket, kelompok, gagal, hasil)
select p.id, p.versi, private.versi_iom_berlaku(),
       (n ->> 'lolos')::boolean, n ->> 'paket',
       array(select jsonb_array_elements_text(coalesce(n -> 'kelompok', '[]'::jsonb))),
       array(select jsonb_array_elements_text(n -> 'gagal')), n -> 'hasil'
  from po p
  cross join lateral (select private.nilai_iom(p.id) as n) x
 where p.nomor = 344
   and (x.n ->> 'lolos')::boolean
   and not exists (
     select 1 from verifikasi_otomatis vo
      where vo.po_id = p.id and vo.versi_iom = private.versi_iom_berlaku() and vo.versi_po = p.versi);
