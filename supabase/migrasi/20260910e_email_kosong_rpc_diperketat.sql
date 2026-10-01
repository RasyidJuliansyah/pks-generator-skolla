-- Audit 10 Sep 2026 atas SEMUA fungsi `security definer` di skema public dan private,
-- menyusul temuan pada sunting_komentar()/hapus_komentar() (20260910c). Jebakannya sama:
-- bila klaim JWT tidak memuat email, `lower(auth.jwt() ->> 'email')` bernilai NULL,
-- perbandingan dengannya ikut NULL, dan IF memperlakukan NULL sebagai tidak-benar.
-- Penjaga berbentuk `if not (pemilik = saya or ...) then raise` pun LEWAT, dengan RLS
-- sudah tidak berlaku. Dua fungsi ternyata terbuka:
--
-- 1. basikan_verifikasi() — sesi tanpa email bisa menandai keputusan verifikasi basi
--    pada PO siapa pun yang berstatus draf atau ditolak. Lubangnya ada di pembantu
--    private.boleh_ubah_po(), yang mengembalikan NULL (bukan false) saat email kosong:
--    `true and NULL` = NULL, `not (NULL or false)` = NULL, penolakan dilewati.
--    Dibuktikan: keputusan berlaku PO #1 turun 4 → 3.
--
-- 2. ajukan_po_unggahan() — pemeriksaan kepemilikannya dilewati dengan cara yang sama.
--    Hari ini ia hanya tertahan secara KEBETULAN: tanda_tangan.dibubuhkan_oleh NOT NULL
--    menolak baris yang diisi v_saya kosong. Penjaga yang bekerja karena kebetulan
--    bukan penjaga.
--
-- Penawarnya: tolak tegas saat email kosong, dan susun pemeriksaannya supaya NULL
-- tidak pernah bisa sampai ke IF — `is distinct from`, atau `coalesce(..., false)`
-- bila NULL-nya datang dari fungsi pembantu. Pembantu private.* sendiri tidak diubah:
-- di kebijakan RLS, NULL dan false sama-sama menolak, jadi di sana mereka aman.
--
-- Sisanya diperiksa satu per satu dan tidak butuh perubahan:
--   * buat_pks, finalisasi_pks, unggah_pks_basah — `not (punya_peran(..) and ..)`;
--     tanpa email peran_saya() = '{}', punya_peran() = false, jadi penolakan jalan.
--   * daftar_jatuh_tempo, tandai_berkas_dihapus — `not punya_peran('admin_utama')`,
--     sama. daftar_penanda_tangan — `peran_saya() <> '{}'` bernilai false.
--   * jaga_pengecualian, jaga_verifikator_bukan_pembuat — perbandingannya memang bisa
--     NULL dan terlewati, tapi barisnya tidak pernah sampai: RLS insert keduanya
--     menuntut peran (pengecualian_beri) atau `oleh = email` (verifikasi_putuskan),
--     dan kolom penulisnya NOT NULL. Dibuktikan, bukan diandaikan.
--   * jaga_admin_utama — pemeriksaan "akun sendiri" terlewati tanpa email, tapi UPDATE
--     pengguna menuntut admin_utama; pemeriksaan admin terakhir tidak bergantung email.
--   * catat_riwayat_*, jaga_komentar_*, jaga_lantai_po, lantai_*, peran_saya —
--     tidak memeriksa wewenang lewat email.
--
-- Hari ini proyek hanya menyalakan masuk Google (anonim, telepon, email, SAML, web3
-- mati; tak ada hook access token), jadi sesi tanpa email belum bisa diterbitkan.
-- Jaminannya tetap tidak boleh bergantung pada metode masuk mana yang kebetulan menyala.

create or replace function basikan_verifikasi(p_po uuid, p_fungsi fungsi_verifikasi[], p_sebab text)
returns void
language plpgsql
security definer
set search_path to public
as $$
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

create or replace function ajukan_po_unggahan(p_po uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_po   po%rowtype;
  v_saya text := lower(auth.jwt() ->> 'email');
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

  -- Ketiganya menunjuk BERKAS YANG SAMA: satu lembar pindaian.
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh, asal) values
    (p_po, 'kepala_sekolah',
       coalesce(nullif(btrim(v_po.sekolah_beku->>'kepala_sekolah'), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'partnership_manager',
       coalesce(nullif(btrim(v_po.nama_pm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'sales_manager',
       coalesce(nullif(btrim(v_po.nama_sm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian');

  -- Lompatan status ini memicu `jaga_lantai_po`; gerbangnya sama dengan jalur platform.
  update po set status = 'ditandatangani' where id = p_po;
end;
$$;
