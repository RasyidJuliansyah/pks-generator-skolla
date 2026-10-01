-- Empat penanda tangan Form PO, bagian 2 (catatan/23, keputusan Rizki 25 Sep 2026).
--
-- Hanya PO BARU yang butuh empat. Setiap PO yang ada saat migrasi ini berjalan tetap tiga,
-- dan dokumennya tidak berubah: po.skema_ttd dicatat per PO, diisi saat lahir, tidak
-- pernah berubah sesudahnya.

-- 1. Kolom. Bawaan 3 SAAT DITAMBAHKAN = backfill semua PO lama dalam satu langkah, tanpa
-- UPDATE yang memicu trigger. Sesudah itu bawaannya 4, dan trigger INSERT yang menentukan.
alter table po add column if not exists skema_ttd smallint not null default 3
  check (skema_ttd in (3, 4));
alter table po alter column skema_ttd set default 4;
comment on column po.skema_ttd is
  'Jumlah penanda tangan Form PO: 3 (Kepala Sekolah, PM, Sales Manager) untuk PO sebelum 25 Sep 2026 '
  'dan unggahan form kertas lama; 4 (+ Regional Head Division, Sales Manager berlabel Head of Sales) '
  'untuk yang lain. Diisi private.jaga_syarat_maju saat INSERT, tidak bisa diubah sesudahnya.';

alter table po add column if not exists nama_rh text;
comment on column po.nama_rh is
  'Regional Head Division yang menandatangani, dipilih dari akun berperan regional_head. Hanya bermakna pada skema_ttd = 4.';

-- 2. Daftar pihak per skema: SATU sumber di basis data. Cerminnya lib/pihak.ts pihakUntuk().
create or replace function private.pihak_wajib(p_skema smallint)
returns pihak_ttd[] language sql immutable set search_path = public as $$
  select case when p_skema = 4
    then array['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager']::pihak_ttd[]
    else array['kepala_sekolah', 'partnership_manager', 'sales_manager']::pihak_ttd[] end;
$$;
revoke all on function private.pihak_wajib(smallint) from public, anon, authenticated;

-- 3. Syarat maju: skema ditentukan saat lahir dan beku; Regional Head wajib keluar draf.
-- Ditulis di atas versi 20260920a (nilai sponsorship); seluruh isinya dipertahankan.
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
end $function$;

-- 4. Pembekuan: DAFTAR KOLOM EKSPLISIT, kedua tuple. Kolom baru tidak ikut beku sendirinya.
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
      NEW.permintaan_tambahan, NEW.versi_iom, NEW.nilai_sponsorship,
      NEW.skema_ttd, NEW.nama_rh)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship,
      OLD.skema_ttd, OLD.nama_rh)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;

-- 5. Urutan status: "semua pihak wajib sudah ada", bukan "tiga baris".
-- Ditulis di atas versi 20260917d; hanya dua pemeriksaan jumlah yang berganti.
create or replace function private.jaga_urutan_status_po()
returns trigger language plpgsql security definer set search_path = public
as $$
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

-- 6. Sidik tinjauan PO unggahan. Kolom baru SENGAJA dikeluarkan bila tidak membawa isi:
-- sidik adalah hash to_jsonb(baris), jadi kunci baru yang muncul di setiap baris akan
-- membasikan setiap draf unggahan yang sudah dinyatakan sesuai pindaian, dan Sales harus
-- meninjau ulang tanpa ada yang berubah (probe P9). skema_ttd tidak pernah berubah sesudah
-- lahir, jadi tidak perlu disidik; nama_rh disidik begitu terisi, karena itulah isi yang
-- dinyatakan sesuai dengan kertasnya. Ditulis di atas versi 20260922c.
create or replace function private.sidik_tinjauan(p po)
returns text
language sql
stable
security definer
set search_path to public
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'po', (to_jsonb(p) - array['nomor', 'status', 'versi', 'dibuat_oleh', 'dibuat_pada',
                               'diubah_pada', 'diverifikasi_oleh', 'diverifikasi_pada',
                               'diverifikasi_otomatis', 'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik',
                               'skema_ttd'])
          - case when p.nama_rh is null then 'nama_rh' else '' end,
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
revoke all on function private.sidik_tinjauan(po) from public, anon, authenticated;

-- 7. Pengajuan PO unggahan: satu penanda per pihak wajib. Ditulis di atas versi 20260911b;
-- seluruh pemeriksaan dan urutannya dipertahankan, hanya penyisipan di akhir yang berganti.
create or replace function ajukan_po_unggahan(p_po uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
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

-- 8. Regional Head Division: baca-saja pola c_level (keputusan Rizki 25 Sep 2026).
-- Disebut HANYA di dua fungsi pembacaan ini. Setiap jalur tulis menyebut perannya eksplisit,
-- jadi peran yang tidak disebut di sana otomatis tidak bisa menulis.
create or replace function private.boleh_lihat_semua() returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.punya_peran(
    'head_of_sales', 'head_of_operations', 'cbo', 'c_level', 'admin_utama', 'admin_sales',
    'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead', 'regional_head'
  );
$fn$;

-- Harga Acquisition ikut terlihat, sama seperti C Level: disengaja. Kalau tidak dikehendaki,
-- cabut 'regional_head' dari baris di bawah, satu kata, dan tidak ada yang lain ikut berubah.
create or replace function private.boleh_lihat_acquisition() returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.punya_peran('cbo', 'c_level', 'admin_utama', 'head_of_operations', 'finance', 'regional_head');
$fn$;
