'use client';

import { useEffect, useState } from 'react';

type Tema = 'light' | 'dark';

/**
 * Dua posisi saja: terang dan gelap. Bawaannya TERANG, apa pun setelan sistem —
 * gelap hanya berlaku bila pengguna memilihnya sendiri, dan pilihan itu diingat.
 */
export default function PengalihTema() {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    let tersimpan: Tema = 'light';
    try {
      if (localStorage.getItem('tema') === 'dark') tersimpan = 'dark';
    } catch {}
    setTema(tersimpan);
  }, []);

  useEffect(() => {
    if (tema) document.documentElement.dataset.theme = tema;
  }, [tema]);

  function pilih(t: Tema) {
    try { localStorage.setItem('tema', t); } catch {}
    setTema(t);
  }

  return (
    <div className="tema" role="group" aria-label="Tema tampilan">
      <button
        type="button" title="Mode terang" aria-label="Mode terang"
        aria-pressed={tema === 'light'} onClick={() => pilih('light')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      <button
        type="button" title="Mode gelap" aria-label="Mode gelap"
        aria-pressed={tema === 'dark'} onClick={() => pilih('dark')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>
    </div>
  );
}
