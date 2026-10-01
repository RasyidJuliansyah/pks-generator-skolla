-- Menghitung ulang verdict IoM PO-344 sesudah perbaikan bukti 20260921100000.
--
-- KENAPA TIDAK CUKUP MENYENTUH STATUSNYA. Trigger po_verdict_iom memang `after update
-- of status on po`, tapi private.catat_verdict_iom() membuka diri dengan:
--
--     if new.status <> 'verifikasi' or old.status = 'verifikasi' then return null; end if;
--
-- Verdict hanya dihitung saat PO MASUK ke verifikasi. PO-344 sudah ada di dalamnya, jadi
-- `update po set status = status` memicu triggernya lalu langsung keluar tanpa berbuat
-- apa-apa — dibuktikan di replika lokal: nol baris verdict baru.
--
-- Memaksanya lewat status memerlukan putaran nyata (verifikasi -> ditandatangani ->
-- verifikasi). Itu BUKAN penyegaran: ia menulis peristiwa sungguhan ke lini masa yang
-- dibaca orang, dan berpotensi membasikan keputusan verifikasi yang sudah ada.
--
-- Jadi barisnya disisipkan langsung, PERSIS seperti yang dilakukan triggernya sendiri —
-- kolom, sumber nilai, dan versi_iom yang sama. Verdict lama TIDAK dihapus: layar membaca
-- yang terbaru (verdictTerakhir di lib/verdict-iom.ts), dan riwayatnya tetap utuh.
--
-- Hasil yang diharapkan, dibuktikan di replika lokal dengan fikstur menyerupai PO-344:
--   sebelum : gagal {satu-kelompok, lantai-siswa, tanpa-diskon}, bukti "harga 0, bottom 186000"
--   sesudah : gagal {satu-kelompok}, bukti "tidak dinilai untuk PO berkelompok"
-- `lolos` tetap false: PO berkelompok memang jatuh ke verifikasi manual (13a Bagian 4).
--
-- Di basis data baru pernyataan ini TIDAK melakukan apa-apa — tidak ada PO bernomor 344.
insert into verifikasi_otomatis (po_id, versi_po, versi_iom, lolos, paket, gagal, hasil)
select p.id, p.versi, private.versi_iom_berlaku(), (v ->> 'lolos')::boolean, v ->> 'paket',
       array(select jsonb_array_elements_text(v -> 'gagal')), v -> 'hasil'
  from po p, lateral private.nilai_iom(p.id) v
 where p.nomor = 344
   and p.status = 'verifikasi';
