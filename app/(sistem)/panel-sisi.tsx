'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Membungkus sidebar supaya di layar sempit ia bisa disembunyikan.
 *
 * Di layar lebar tidak ada yang berubah: sidebar tetap menempel di kiri. Di
 * layar sempit muncul bilah yang menempel di atas walau halaman digulir, dan
 * menunya dibuka lewat tombol. Panelnya menutupi isi, bukan mendorongnya —
 * mendorong isi membuat posisi bacaan melompat setiap kali menu dibuka.
 */
export default function PanelSisi({
  judul, children,
}: { judul: string; children: React.ReactNode }) {
  const [buka, setBuka] = useState(false);
  const path = usePathname();

  // Berpindah halaman berarti urusan dengan menu selesai.
  useEffect(() => { setBuka(false); }, [path]);

  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [buka]);

  return (
    <>
      <div className="bar-ponsel">
        <div className="bar-judul">
          <p className="eyebrow" style={{ margin: 0 }}>Skolla</p>
          <strong>{judul}</strong>
        </div>
        <button type="button" className="burger" aria-expanded={buka} aria-controls="sisi-utama"
          onClick={() => setBuka((v) => !v)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {buka
              ? <path d="M6 6l12 12M18 6L6 18" />
              : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {buka ? 'Tutup' : 'Menu'}
        </button>
      </div>

      {buka && (
        <button type="button" className="tirai" aria-label="Tutup menu"
          onClick={() => setBuka(false)} />
      )}

      <aside id="sisi-utama" className={`sisi${buka ? ' terbuka' : ''}`}>{children}</aside>
    </>
  );
}
