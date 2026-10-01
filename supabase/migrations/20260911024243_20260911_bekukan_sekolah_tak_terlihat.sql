-- Salinan data sekolah di PO tidak lagi terhapus jadi NULL saat penyuntingnya tidak
-- bisa melihat baris sekolahnya.
--
-- Ditemukan QA independen 11 Sep 2026. bekukan_sekolah() (20260830b) berjalan
-- sebagai pemanggil, jadi SELECT-nya tunduk pada RLS sekolah_lihat. Sales murni
-- hanya melihat sekolah yang dipegangnya. Begitu sekolah itu dialihkan ke sales
-- lain, update apa pun oleh pembuat PO selama draf/ditolak — simpan, tarik ke draf,
-- kirim untuk tanda tangan — tidak menemukan barisnya, dan SELECT INTO tanpa baris
-- mengisi NEW.sekolah_beku dengan NULL. PO, Surat, dan PKS lalu mencetak nama
-- sekolah dan kepala sekolah kosong. Dibuktikan dalam simulasi yang dibatalkan:
-- sales murni, sekolahnya dialihkan, ubah kota PO — salinannya jadi NULL.
--
-- Perbaikannya di titik "baris tidak ditemukan", tiga cabang:
--   * terlihat — disegarkan seperti biasa;
--   * UPDATE dengan sekolah_id yang sama — salinan LAMA dipertahankan. PO itu memang
--     sudah memegang data sekolah ini; tidak ada yang baru disalin. Pembuat PO tetap
--     bisa menarik ke draf dan mengirim untuk tanda tangan, alih-alih PO-nya macet
--     karena pengalihan yang bukan ulahnya. Salinannya berhenti mengikuti baris
--     hidup sampai orang yang bisa melihat sekolahnya (Head of Sales, Admin Sales)
--     menyentuh PO itu — saat itu ia disegarkan dan 20260910n membasikan
--     persetujuannya bila kepala sekolah/jenjang berubah;
--   * INSERT, atau sekolah_id diganti ke sekolah yang tidak terlihat — ditolak.
--     Mempertahankan salinan lama di sini berarti sekolah_id baru berpasangan dengan
--     data sekolah lama. Jalur sah tidak pernah sampai ke sini: sekolah baru
--     dipegang pembuatnya (isi_pemegang_sekolah, 20260830e), dan simpanDraf hanya
--     menemukan sekolah lewat NPSN yang terlihat.
--
-- Sengaja BUKAN SECURITY DEFINER. Definer tanpa penjaga menyalin data sekolah mana
-- pun ke PO lewat sekolah_id sembarang — pemilik PO bisa mengubah sekolah_id
-- langsung lewat PostgREST (po_ubah) lalu membaca sekolah_beku-nya.
--
-- Salinan yang dikirim pemanggil sendiri tidak pernah lolos: cabang pertama
-- menimpanya dengan data segar, cabang kedua dengan salinan lama.
create or replace function private.bekukan_sekolah()
returns trigger language plpgsql set search_path to 'public' as $fn$
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
end $fn$;

