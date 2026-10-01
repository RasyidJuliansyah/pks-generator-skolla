-- Pernyataan "data ini sesuai dengan pindaian" hanya berlaku untuk isi yang benar-benar
-- dinyatakan. Pengajuan PO unggahan ditolak bila isinya berubah sesudah pernyataan itu,
-- lewat jalur mana pun.
--
-- Ditemukan QA independen 11 Sep 2026. simpanDraf() dan catatUnggahanPo() membatalkan
-- pernyataan saat MEREKA mengubah isi, tetapi basis data tidak. Dibuktikan dalam
-- simulasi yang dibatalkan — PO unggahan dinyatakan sesuai, lalu tanpa menyentuh
-- ditinjau_*, ajukan_po_unggahan() tetap lolos ke `ditandatangani` setelah:
--   * pemilik PO mengubah harga_siswa langsung lewat PostgREST (po_ubah);
--   * pemilik PO mengubah po_termin dan po_catatan;
--   * Head of Sales mengubah po_rombel dan jumlah_siswa;
--   * kepala sekolah di baris `sekolah` (dipakai bersama) diganti — tanda tangan
--     kepala sekolah tercatat atas nama yang BARU di bawah pernyataan lama. Keadaan
--     yang sama muncul bila simpanDraf menulis baris sekolah lalu gagal di update PO;
--   * pemilik PO menimpa objek po-unggahan/{id}/po.pdf langsung (po_unggahan_ganti).
--
-- Kenapa sidik, bukan trigger yang mengosongkan ditinjau_* setiap kali isi berubah:
-- simpanDraf menulis ulang SELURUH baris anak (hapus lalu sisip, dua permintaan
-- terpisah) pada setiap simpan. Trigger di tabel anak akan membatalkan pernyataan pada
-- setiap simpan, termasuk yang tidak mengubah apa pun — basis data tidak bisa
-- membedakan tulis ulang yang identik dari perubahan sungguhan lintas permintaan.
-- Sidik membandingkan HASILNYA: isi yang sama menghasilkan sidik yang sama.
--
-- Cara kerjanya:
--   * Saat ditinjau_pada diisi (konfirmasiTinjauan), trigger po_tinjauan_sidik
--     menyimpan sidik isi PO saat itu ke ditinjau_sidik. Namanya sengaja diurutkan
--     sesudah po_bekukan_sekolah supaya membaca salinan sekolah yang sudah disegarkan.
--   * ajukan_po_unggahan() menghitung ulang sidiknya SESUDAH lompatan status — yaitu
--     sesudah po_bekukan_sekolah menyegarkan salinannya untuk terakhir kalinya — lalu
--     menolak bila berbeda. Yang dibandingkan persis isi yang akan dibekukan, termasuk
--     kepala sekolah yang dicetak di dokumen dan di tanda tangan.
--   * ditinjau_sidik tidak pernah diterima dari pemanggil: selalu ditimpa trigger.
--     Rumusnya terbuka di berkas ini, jadi tanpa itu pemilik PO bisa menghitung sidik
--     isi barunya sendiri dan memalsukan pernyataan yang tidak pernah dibuat.
--
-- Isi yang disidik: kolom PO kecuali penanda sistem (nomor, status, versi, pemilik,
-- stempel waktu, verifikasi, versi_pricelist yang selalu ditulis ulang simpanDraf,
-- dan ditinjau_* sendiri); salinan sekolah kecuali dipegang_oleh — pengalihan pemegang
-- tidak mengubah kertasnya; keempat tabel anak; dan versi + eTag objek pindaian. Versi
-- objek berganti pada setiap unggahan, jadi menimpa pindaian dengan berkas yang sama
-- pun ikut membatalkan — ragu berarti batal. Sengaja BUKAN updated_at: kolom itu ikut
-- berubah saat objeknya sekadar dibaca (last_accessed_at). Versi yang diarsipkan
-- (archived_at) dilewati: bila versioning bucket kelak dinyalakan, satu nama bisa
-- punya beberapa baris dan subkueri skalarnya akan gagal (catatan QA 11 Sep 2026).
--
-- Daftar kolomnya daftar TOLAK, bukan daftar terima: kolom PO baru otomatis ikut
-- disidik. Salah arahnya aman — paling-paling Sales mencentang ulang.
--
-- Pernyataan yang dibuat sebelum migrasi ini tidak punya sidik dan akan ditolak saat
-- diajukan. Saat diterapkan tidak ada satu pun PO unggahan di basis data.
--
-- Yang tidak ditutup: layar PO masih menampilkan "dinyatakan sesuai" sampai pengajuan
-- ditolak. Semua jalur aplikasi sudah membatalkan pernyataannya sendiri; yang tersisa
-- hanya jalur di luar aplikasi dan perubahan sekolah lewat PO lain.

alter table po add column if not exists ditinjau_sidik text;

comment on column po.ditinjau_sidik is
  'Sidik isi PO saat ditinjau_pada diisi. Diisi trigger po_tinjauan_sidik, tidak pernah '
  'dari pemanggil. ajukan_po_unggahan menolak bila isi saat diajukan berbeda.';

-- SECURITY DEFINER supaya sidiknya tidak bergantung pada siapa yang bertanya: RLS
-- tabel anak dan storage.objects tidak boleh membuat baris hilang dari perhitungan.
-- Karena itu pula EXECUTE-nya dicabut — ia hanya dipanggil trigger dan RPC di bawah.
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
                               'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik']),
    'sekolah', coalesce(p.sekolah_beku, '{}'::jsonb) - 'dipegang_oleh',
    'komponen', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_komponen x where x.po_id = p.id),
    'rombel',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_rombel x where x.po_id = p.id),
    'termin',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_termin x where x.po_id = p.id),
    'catatan',  (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_catatan x where x.po_id = p.id),
    'pindaian', (select jsonb_build_object('versi', o.version, 'etag', o.metadata->>'eTag')
                   from storage.objects o
                  where o.bucket_id = 'po-unggahan' and o.name = p.berkas_unggahan
                    and o.archived_at is null)
  )::text, 'UTF8')), 'hex');
$$;

revoke all on function private.sidik_tinjauan(po) from public, anon, authenticated;

create or replace function private.sidik_saat_ditinjau()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
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

drop trigger if exists po_tinjauan_sidik on po;
create trigger po_tinjauan_sidik
  before insert or update on po
  for each row execute function private.sidik_saat_ditinjau();

-- Sama dengan 20260911_ttd_kepala_sekolah_dari_salinan_beku, ditambah pemeriksaan sidik
-- sesudah lompatan status.
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

  -- Ketiganya menunjuk BERKAS YANG SAMA: satu lembar pindaian.
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh, asal) values
    (p_po, 'kepala_sekolah',
       coalesce(nullif(btrim(v_beku->>'kepala_sekolah'), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'partnership_manager',
       coalesce(nullif(btrim(v_po.nama_pm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'sales_manager',
       coalesce(nullif(btrim(v_po.nama_sm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian');
end;
$$;
