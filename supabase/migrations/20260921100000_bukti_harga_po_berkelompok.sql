-- PO berkelompok: satu sebab, satu kegagalan (temuan PO-344, 21 Sep 2026).
--
-- Harga per siswa PO berkelompok tersimpan di po_kelompok; `po.harga_siswa` sendiri 0.
-- Menilai nol itu terhadap bottom price dan price list melahirkan DUA kegagalan palsu.
-- PO-344 gagal {satu-kelompok, lantai-siswa, tanpa-diskon} dengan bukti
-- "harga 0, bottom 186000" — padahal kedua kelompoknya berharga Rp258.000 dan Rp135.000.
-- Sales yang membacanya akan mencari kesalahan harga yang tidak ada.
--
-- Sesudah ini kedua aturan harga TIDAK DINILAI untuk PO berkelompok, dengan bukti yang
-- menyebut sebabnya. Ini TIDAK meloloskan apa pun: `satu-kelompok` selalu gagal saat
-- v_kelompok >= 2, jadi PO berkelompok tetap jatuh ke verifikasi manual. Yang berubah
-- cuma sebab yang dilaporkan — satu, bukan tiga.
--
-- Badan fungsi disalin dari YANG HIDUP DI PRODUKSI (dump skema 21 Sep 2026), bukan dari
-- 20260917b yang sudah usang: berkas itu masih memuat aturan `tanpa-sponsorship` yang
-- sudah digantikan `sponsorship-dalam-batas` oleh 20260920b. Menulis ulang dari sana
-- akan diam-diam MEMBATALKAN pekerjaan sponsorship.

CREATE OR REPLACE FUNCTION "private"."nilai_iom"("p_po" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v po%rowtype;
  h jsonb := '[]';
  v_hari date := (now() at time zone 'Asia/Jakarta')::date;
  v_ids text[]; v_asing text[]; v_langgar text[]; v_kurang text[]; v_gagal text[];
  v_n int; v_total bigint; v_kelompok int;
  v_paket harga_paket%rowtype; v_ada_paket boolean;
  d deklarasi_kesiapan%rowtype; v_ada_d boolean := false; v_butir_kurang text[] := '{}';
  v_bukti_paket text; v_masa text;
  v_sp_catatan boolean; v_sp_nilai bigint; v_sp_batas bigint;
  v_berkelompok boolean;
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

  -- ---- 13a Bagian 4 dan 7 ----
  select count(*) into v_kelompok from po_kelompok where po_id = p_po;
  h := h || private.aturan_iom('satu-kelompok', v_kelompok < 2, v_kelompok || ' baris kelompok');
  v_berkelompok := v_kelompok >= 2;

  select hp.* into v_paket from harga_paket hp
   where (select array_agg(distinct x order by x) from unnest(hp.ids) x) = v_ids
   limit 1;
  v_ada_paket := found;
  v_bukti_paket := case when v_ada_paket then v_paket.nama
    else 'susunan komponen bukan paket persis (a la carte, add-on, atau pelatihan guru)' end;
  h := h || private.aturan_iom('paket-persis', v_ada_paket, v_bukti_paket);
  h := h || private.aturan_iom('layanan-sesuai-paket', v_ada_paket, v_bukti_paket);

  if v_ada_paket then
    select * into d from deklarasi_kesiapan where produk = v_paket.nama
     order by ditandatangani_pada desc limit 1;
    v_ada_d := found;
  end if;
  if v_ada_d then
    select coalesce(array_agg(t.b order by t.o), '{}') into v_butir_kurang
      from unnest(array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4']) with ordinality as t(b, o)
     where not (t.b = any(d.butir));
  end if;
  h := h || private.aturan_iom('deklarasi-berlaku',
    v_ada_d and d.berlaku_sampai >= v_hari and cardinality(v_butir_kurang) = 0,
    case when not v_ada_d then 'tidak ada deklarasi untuk paket ini'
         when d.berlaku_sampai < v_hari then 'kedaluwarsa ' || d.berlaku_sampai
         when cardinality(v_butir_kurang) > 0 then 'butir belum dideklarasikan: ' || array_to_string(v_butir_kurang, ', ')
         else 'berlaku sampai ' || d.berlaku_sampai end);

  h := h || private.aturan_iom('lantai-siswa',
    v_berkelompok or (v_ada_paket and v.harga_siswa >= v_paket.bottom),
    case when v_berkelompok then 'tidak dinilai untuk PO berkelompok: harganya per kelompok'
         when v_ada_paket then format('harga %s, bottom %s', v.harga_siswa, v_paket.bottom)
         else 'tidak dinilai tanpa paket persis' end);
  h := h || private.aturan_iom('lantai-guru',
    not exists (select 1 from po_komponen pk join harga_komponen hk on hk.id = pk.komponen_id
                 where pk.po_id = p_po and hk.untuk_guru),
    'pelatihan guru membuat PO dinilai manual');
  h := h || private.aturan_iom('tanpa-diskon',
    v_berkelompok or (v_ada_paket and v.harga_siswa >= v_paket.price_list),
    case when v_berkelompok then 'tidak dinilai untuk PO berkelompok: harganya per kelompok'
         when v_ada_paket then format('harga %s, price list %s', v.harga_siswa, v_paket.price_list)
         else 'tidak dinilai tanpa paket persis' end);
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
  return jsonb_build_object('versi_iom', private.versi_iom_berlaku(), 'lolos', cardinality(v_gagal) = 0,
    'paket', case when v_ada_paket then v_paket.nama end, 'gagal', to_jsonb(v_gagal), 'hasil', h);
end $$;


