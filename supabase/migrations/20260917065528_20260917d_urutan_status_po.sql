-- IoM Fase 2 bagian 3 (catatan/15, temuan QA putaran 1, 17 Sep 2026): urutan status PO
-- dijaga basis data.
--
-- Lubang yang ditemukan QA: kebijakan RLS po_ubah membolehkan pemilik PO mengubah status
-- dari draf/ditolak/menunggu_ttd/ditandatangani ke nilai mana pun di daftarnya, termasuk
-- langsung ke `verifikasi`, dan syarat tiga tanda tangan hanya hidup di aplikasi
-- (ajukanVerifikasi). Selama ini tertutupi empat persetujuan manusia. Dengan jalur IoM,
-- PO tanpa satu pun tanda tangan bisa mendapat verdict lolos lalu ditutup satu klik.
-- Dibuktikan QA di produksi dalam transaksi yang dibatalkan.
--
-- Jalur yang tetap sah (semua jalur aplikasi hari ini):
--   menunggu_ttd -> ditandatangani                (simpanTtd, sesudah tiga tanda tangan)
--   draf/ditolak -> ditandatangani, asal unggahan (ajukan_po_unggahan)
--   ditandatangani -> verifikasi, >= 3 pihak      (ajukanVerifikasi)

create or replace function private.jaga_urutan_status_po()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_ttd int;
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

  if new.status = 'ditandatangani' then
    if old.status = 'menunggu_ttd' and new.asal = 'platform' then
      -- Hanya PO platform: tanda tangannya dibubuhkan di aplikasi selama menunggu_ttd.
      select count(distinct pihak) into v_ttd from tanda_tangan where po_id = new.id;
      if v_ttd < 3 then
        raise exception 'PO baru bisa berstatus ditandatangani sesudah ketiga pihak menandatangani (% dari 3).', v_ttd
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
    select count(distinct pihak) into v_ttd from tanda_tangan where po_id = new.id;
    if old.status <> 'ditandatangani' or v_ttd < 3 then
      raise exception 'PO hanya bisa diajukan ke verifikasi sesudah ditandatangani ketiga pihak (% dari 3).', v_ttd
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists po_urutan_status on po;
create trigger po_urutan_status before update of status on po
  for each row execute function private.jaga_urutan_status_po();

revoke all on function private.jaga_urutan_status_po() from public, anon, authenticated;
