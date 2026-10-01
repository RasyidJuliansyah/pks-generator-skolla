-- Nama kepala sekolah di tanda tangan PO unggahan harus sama dengan salinan yang
-- dibekukan — salinan itulah yang dicetak di PO, Surat, dan PKS (20260830b).
--
-- Ditemukan QA independen 11 Sep 2026. ajukan_po_unggahan() membaca po.sekolah_beku ke
-- variabel lokal, mengisi tiga baris tanda_tangan dari situ, BARU kemudian mengubah
-- status ke ditandatangani. Update itu memicu po_bekukan_sekolah, yang menyegarkan
-- salinannya dari baris `sekolah` karena status lamanya masih draf/ditolak. Baris sekolah
-- dipakai bersama, jadi kepala sekolahnya bisa berganti lewat PO lain sesudah PO ini
-- terakhir disimpan. Akibatnya tanda tangan memuat nama LAMA, dokumen mencetak nama BARU.
-- Dibuktikan dalam simulasi yang dibatalkan: PO unggahan baru dari data PO 67, kepala
-- sekolahnya diganti lewat baris sekolah, pemilik PO mengajukan — tanda tangan "Mugan",
-- salinan beku "Kepala Baru Uji".
--
-- Penawarnya: ubah status lebih dulu dan ambil salinan hasil penyegarannya lewat
-- `returning`, lalu tanda tangan diisi dari salinan itu. Keduanya berasal dari baris
-- yang sama, jadi tidak bisa berselisih lagi — bukan membaca ulang baris sekolah
-- secara terpisah, yang hanya sepakat selama logika po_bekukan_sekolah tidak berubah.
-- Tidak ada trigger atau gerbang yang menuntut tanda tangan sudah ada saat status
-- berpindah (jaga_lantai_po hanya memeriksa harga), jadi urutannya aman dibalik.
--
-- Penjaga di atasnya tidak berubah: tolak sesi tanpa email, kepemilikan dengan
-- `is distinct from` (20260910e).

create or replace function ajukan_po_unggahan(p_po uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_po   po%rowtype;
  v_beku jsonb;
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

  -- Lompatan status ini memicu `jaga_lantai_po`; gerbangnya sama dengan jalur platform.
  -- Ia juga menyegarkan sekolah_beku untuk terakhir kalinya; nama kepala sekolah di
  -- tanda tangan harus diambil dari salinan hasil penyegaran ini, bukan dari v_po.
  update po set status = 'ditandatangani' where id = p_po
  returning sekolah_beku into v_beku;

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
