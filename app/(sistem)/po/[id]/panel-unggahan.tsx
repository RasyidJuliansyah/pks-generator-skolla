'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ajukanUnggahan, urlUnggahanPo } from '@/lib/po-aksi';

/**
 * Panel untuk PO yang diunggah, menggantikan PanelTtd.
 *
 * PO unggahan tidak mengumpulkan tanda tangan lewat aplikasi — ketiganya sudah ada di
 * dalam pindaian. Yang tersisa: melihat pindaiannya, dan mengajukannya.
 *
 * Seluruh syarat pengajuan ditegakkan basis data, jadi tombol di sini tidak berpura-pura
 * tahu apakah PO-nya layak. Ia mengirim, lalu menampilkan apa adanya kalau ditolak —
 * termasuk penolakan lantai harga, yang justru pesan paling berguna buat Sales.
 */
export default function PanelUnggahan({
  poId, status, berkas, ditinjauOleh, ditinjauPada, bisaAjukan,
}: {
  poId: string;
  status: string;
  berkas: string | null;
  ditinjauOleh: string | null;
  ditinjauPada: string | null;
  bisaAjukan: boolean;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  const belumDiajukan = status === 'draf' || status === 'ditolak';

  // Syarat yang BELUM terpenuhi. Basis data juga menolak kalau salah satunya kurang,
  // tapi menawarkan tombol yang pasti gagal berarti menyuruh orang menekan dulu baru
  // diberi tahu — padahal kekurangannya sudah diketahui sejak halaman dimuat.
  const kurang = [
    ...(!berkas ? ['Pindaian PO belum diunggah.'] : []),
    ...(!ditinjauPada ? ['Belum ada pernyataan bahwa data ini sesuai dengan pindaian.'] : []),
  ];

  function buka() {
    mulai(async () => {
      if (!berkas) return;
      const url = await urlUnggahanPo(berkas);
      if (url) window.open(url, '_blank', 'noopener');
      else setGalat('Pindaian tidak bisa dibuka. Coba muat ulang halaman.');
    });
  }

  function ajukan() {
    setGalat(null);
    mulai(async () => {
      const h = await ajukanUnggahan(poId);
      if (h.ok) router.refresh();
      else setGalat(h.galat ?? 'Gagal mengajukan.');
    });
  }

  return (
    <section className="kotak no-print" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h2>PO Unggahan</h2>
        <span className="hint">diisi manual, ditandatangani di kertas</span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <p className="muted" style={{ fontSize: 13.5, margin: '0 0 12px', maxWidth: 640 }}>
          Pindaian inilah dokumen PO-nya. Data di sistem adalah transkripsinya, dan
          pernyataan kesesuaian di bawah yang menghubungkan keduanya.
        </p>

        {berkas ? (
          <button type="button" className="tombol" onClick={buka} disabled={kerja}>
            Buka pindaian PO
          </button>
        ) : (
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            Pindaian belum terunggah.
          </p>
        )}

        {ditinjauPada && (
          <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>
            Dinyatakan sesuai dengan pindaian oleh <strong>{ditinjauOleh}</strong>,{' '}
            {new Date(ditinjauPada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
        )}

        {belumDiajukan && bisaAjukan && kurang.length > 0 && (
          <div className="halangan" style={{ marginTop: 16 }}>
            <b>Belum bisa diajukan</b>
            <ul>{kurang.map((k, i) => <li key={i}>{k}</li>)}</ul>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
              Buka drafnya lalu lengkapi, baru PO ini bisa diajukan.
            </p>
          </div>
        )}

        {belumDiajukan && bisaAjukan && kurang.length === 0 && (
          <div style={{ marginTop: 16 }}>
            <button type="button" className="tombol utama" onClick={ajukan} disabled={kerja}>
              {kerja ? 'Mengajukan…' : 'Ajukan ke verifikasi'}
            </button>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0 0', maxWidth: 640 }}>
              Tanda tangan setiap pihak akan dicatat sebagai berasal dari pindaian ini, lalu PO
              langsung berstatus Ditandatangani, tahap Menunggu TTD dilewati karena
              semuanya memang sudah menandatangani di kertas.
            </p>
          </div>
        )}

        {galat && (
          <div className="halangan" style={{ marginTop: 14 }}>
            <b>Belum bisa diajukan</b>
            <ul><li>{galat}</li></ul>
          </div>
        )}
      </div>
    </section>
  );
}
