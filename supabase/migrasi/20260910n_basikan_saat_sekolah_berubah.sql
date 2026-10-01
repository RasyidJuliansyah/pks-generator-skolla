-- Persetujuan verifikasi ikut basi saat salinan data sekolah di PO berubah — lewat
-- jalur mana pun, bukan hanya lewat simpanDraf().
--
-- Ditemukan QA independen 10 Sep 2026. po.sekolah_beku adalah salinan baris `sekolah`
-- milik PO, disegarkan trigger po_bekukan_sekolah pada SETIAP update PO selama
-- berstatus draf/ditolak. Baris sekolah dipakai bersama, jadi kepala sekolahnya bisa
-- berganti lewat PO lain. simpanDraf() membasikan persetujuan bila melihat perubahan
-- itu, tapi update lain — tarik ke draf, kirim untuk tanda tangan, catat pindaian,
-- konfirmasi tinjauan — ikut menyegarkan salinannya tanpa membasikan apa pun.
-- Dibuktikan dalam simulasi yang dibatalkan: PO 67 ditolak dengan persetujuan
-- Education, kepala sekolahnya diganti lewat baris sekolah, Sales mengirim untuk tanda
-- tangan — salinannya kini memuat kepala sekolah baru, persetujuan Education tetap
-- berlaku.
--
-- Kenapa trigger ini, bukan berhenti menyegarkan pada update status saja: salinan
-- itulah yang dicetak di PO, Surat, dan PKS (20260830b), termasuk nama penanda
-- tangannya. Berhenti menyegarkan berarti mengirim untuk tanda tangan membekukan
-- kepala sekolah yang sudah tidak menjabat. Yang benar: salinannya tetap segar,
-- persetujuannya yang dibasikan.
--
-- Wilayahnya mengikuti WILAYAH di lib/checklist.ts: kepala_sekolah dan jenjang ->
-- Education, Tech Ops, Service Account. Untuk kepala_sekolah, kosong dan null dianggap
-- sama dan spasi/tab/baris baru di tepi dibuang — sama dengan isianBerubah() di sisi
-- aplikasi. jenjang enum NOT NULL, jadi cukup dibandingkan langsung.
--
-- Pergantian sekolah (sekolah_id) sengaja tidak di sini. simpanDraf() menangkapnya.
-- Pemilik PO memang bisa mengubah sekolah_id langsung lewat PostgREST (po_ubah), tapi
-- itu pintu belakang yang sama dengan semua bidang lain yang pembasiannya dijalankan
-- aplikasi — bukan yang ditutup berkas ini.
--
-- Salinan baru yang NULL dilewati, bukan dianggap perubahan: bekukan_sekolah() berjalan
-- sebagai pemanggil, dan penyunting PO yang tidak bisa melihat baris sekolahnya (mis.
-- sekolahnya sudah dialihkan ke sales lain) mendapat NULL. Itu cacat tersendiri; di
-- sini ia tidak boleh membasikan persetujuan dengan alasan palsu.
--
-- SECURITY DEFINER wajib: kebijakan verifikasi_ubah hanya berlaku saat PO berstatus
-- verifikasi, jadi Sales tidak bisa membasikan langsung di draf/ditolak. Pemicunya
-- sering pembuat PO sendiri, dan jaga_verifikator_bukan_pembuat hanya meloloskan
-- basikan murni selama PO draf/ditolak — itu 20260910f, yang karenanya HARUS
-- diterapkan lebih dulu. Tanpanya, tarik ke draf dan kirim untuk tanda tangan oleh
-- pembuat PO tertolak utuh setiap kali data sekolahnya berubah (dibuktikan QA).
--
-- BEFORE, bukan AFTER: pada AFTER, status PO sudah berpindah (mis. menunggu_ttd) dan
-- pengecualian 20260910f tidak berlaku lagi (dibuktikan QA: varian AFTER tertolak).
-- Namanya sengaja diurutkan sesudah po_bekukan_sekolah supaya membaca salinan yang
-- sudah disegarkan.

create or replace function private.basikan_saat_sekolah_berubah()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
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
$$;

drop trigger if exists po_bekukan_sekolah_basi on po;
create trigger po_bekukan_sekolah_basi
  before update on po
  for each row execute function private.basikan_saat_sekolah_berubah();
