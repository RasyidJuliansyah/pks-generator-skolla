'use client';

import { useEffect, useRef, useState } from 'react';
import { paginasiPks } from '@/lib/paginasi-pks';

/**
 * Menampilkan PKS sebagai halaman A4 tetap, masing-masing berkop.
 *
 * PKS asli memakai kop satu halaman penuh yang berulang tiap halaman, kotak
 * paraf PIHAK I/PIHAK II di kiri bawah, dan "Halaman x dari y" di kanan bawah.
 * Ketiganya tidak bisa didapat dari pemenggalan halaman CSS: latar berulang
 * tidak seragam antar peramban, dan CSS tidak bisa menyebut jumlah halaman
 * total. Karena itu isinya diukur lebih dulu lalu dibagi sendiri.
 */

const MM = 96 / 25.4;
const TINGGI_ISI_MM = 242;  // 297 dikurangi kop atas 26mm dan kaki 29mm

export default function KertasPks({ html }: { html: string }) {
  const ukur = useRef<HTMLDivElement>(null);
  const [halaman, setHalaman] = useState<string[] | null>(null);

  useEffect(() => {
    let batal = false;
    // Diukur setelah fon siap: mengukur lebih awal menghasilkan jumlah halaman
    // yang berbeda, dan batas halamannya ikut meleset.
    const jalan = () => {
      if (!batal && ukur.current) setHalaman(paginasiPks(ukur.current, TINGGI_ISI_MM * MM));
    };
    if (document.fonts?.ready) document.fonts.ready.then(jalan);
    else jalan();
    return () => { batal = true; };
  }, [html]);

  return (
    <>
      <div ref={ukur} className="pks-ukur pks" aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: html }} />

      {halaman === null ? (
        <p className="muted" style={{ fontSize: 13.5 }}>Menyusun halaman…</p>
      ) : (
        halaman.map((isi, i) => (
          <section className="pks-kertas" key={i}>
            <div className="pks-isi pks" dangerouslySetInnerHTML={{ __html: isi }} />
            {/* Halaman tanda tangan tidak berparaf: di situ para pihak
                membubuhkan tanda tangan penuh, bukan sekadar memarafi. */}
            {i < halaman.length - 1 && (
              <table className="pks-paraf" aria-hidden="true">
                <tbody>
                  <tr><td></td><td></td></tr>
                  <tr><td>PIHAK I</td><td>PIHAK II</td></tr>
                </tbody>
              </table>
            )}
            <span className="pks-halaman">Halaman {i + 1} dari {halaman.length}</span>
          </section>
        ))
      )}
    </>
  );
}
