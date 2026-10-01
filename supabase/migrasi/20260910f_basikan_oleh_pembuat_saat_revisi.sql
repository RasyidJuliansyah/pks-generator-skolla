-- Pembuat PO tidak bisa membasikan keputusan verifikasi atas PO-nya sendiri saat
-- merevisinya. Ditemukan 10 Sep 2026 saat audit 20260910e, sudah ada sejak 20260909e.
--
-- jaga_verifikator_bukan_pembuat() dipasang `before insert or update` dan menolak
-- SETIAP perubahan baris verifikasi oleh pembuat PO. basikan_verifikasi() menandai
-- keputusan lama tidak berlaku lewat UPDATE — jadi Sales yang merevisi PO-nya sendiri
-- yang ditolak ikut tertolak. simpanDraf() di lib/po-aksi.ts tidak memeriksa galat RPC
-- itu, sehingga PO yang isinya sudah berubah tetap membawa persetujuan atas isi LAMA,
-- tanpa ada yang tahu. Dibuktikan dalam simulasi yang dibatalkan: dengan PO #1 (buatan
-- rizki@) disetel ditolak, rizki@ ditolak membasikan keputusan education; bintang@
-- (admin_sales) lolos.
--
-- Sisi aplikasinya diperbaiki bersama berkas ini: simpanDraf() kini membasikan SEBELUM
-- menyimpan induk PO dan berhenti bila RPC-nya gagal; putuskanVerifikasi() memeriksa
-- galatnya sebelum menulis. Urutan rilis: terapkan migrasi ini DULU, baru deploy
-- aplikasinya. Sebaliknya, Sales yang merevisi PO-nya sendiri tertolak keras dan tidak
-- bisa menyimpan.
--
-- Membasikan karena PO direvisi bukan memutuskan, jadi dikecualikan — tapi SEMPIT:
--
--   * Hanya UPDATE yang MURNI membasikan: berlaku true -> false, isi keputusannya
--     (id, po_id, fungsi, hasil, catatan, item, oleh, waktu, versi_po) tidak berubah.
--   * Hanya selama PO berstatus draf atau ditolak — jalur revisi. Di tahap
--     verifikasi, basikan_verifikasi() punya cabang kedua: pemegang fungsi yang sama
--     boleh membasikan keputusan fungsinya. Tanpa batas status ini, farid@
--     (finance + sales) bisa membasikan PENOLAKAN verifikator finance lain atas PO
--     buatannya sendiri — membungkam veto. Hari ini trigger inilah yang menahannya,
--     jadi pengecualiannya tidak boleh melebar ke sana.
--
-- Pintu langsung lewat PostgREST tidak ikut terbuka: kebijakan `verifikasi_ubah` hanya
-- berlaku saat PO berstatus verifikasi, jadi di draf/ditolak satu-satunya jalan adalah
-- basikan_verifikasi() dengan gerbang boleh_ubah_po()-nya sendiri.
--
-- Perbandingan email dibiarkan `=`: sesi tanpa email tidak pernah sampai ke sini karena
-- RLS insert/update verifikasi menuntut `oleh = email` dan peran — lihat 20260910e.

create or replace function private.jaga_verifikator_bukan_pembuat()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
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
