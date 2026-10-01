'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Kanvas tanda tangan. Menerima tetikus maupun sentuhan, dan menskalakan diri
 * ke rasio piksel perangkat supaya goresannya tidak pecah di layar beresolusi tinggi.
 *
 * Ini tanda tangan TIDAK tersertifikasi — kekuatan hukumnya lemah dan itu memang
 * diterima: PO adalah dokumen komitmen awal, sementara PKS tetap ditandatangani
 * basah di atas meterai.
 */
export default function KanvasTtd({
  batal, simpan, sedang,
}: { batal: () => void; simpan: (png: Blob) => void; sedang: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [adaGoresan, setAdaGoresan] = useState(false);
  const menggambar = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const kotak = c.getBoundingClientRect();
    c.width = kotak.width * dpr;
    c.height = kotak.height * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#111';
  }, []);

  function titik(e: React.PointerEvent<HTMLCanvasElement>) {
    const k = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - k.left, y: e.clientY - k.top };
  }

  function mulai(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = ref.current!.getContext('2d')!;
    const t = titik(e);
    g.beginPath();
    g.moveTo(t.x, t.y);
    menggambar.current = true;
  }

  function gerak(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!menggambar.current) return;
    e.preventDefault();
    const g = ref.current!.getContext('2d')!;
    const t = titik(e);
    g.lineTo(t.x, t.y);
    g.stroke();
    if (!adaGoresan) setAdaGoresan(true);
  }

  const selesai = () => { menggambar.current = false; };

  function bersihkan() {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setAdaGoresan(false);
  }

  function kirim() {
    ref.current!.toBlob((b) => b && simpan(b), 'image/png');
  }

  return (
    <div className="ttd-kanvas-bungkus">
      <canvas
        ref={ref}
        className="ttd-kanvas"
        onPointerDown={mulai}
        onPointerMove={gerak}
        onPointerUp={selesai}
        onPointerLeave={selesai}
        onPointerCancel={selesai}
        aria-label="Area membubuhkan tanda tangan"
      />
      <p className="ttd-petunjuk">Bubuhkan tanda tangan di kotak putih di atas.</p>
      <div className="ttd-aksi">
        <button type="button" className="preset" onClick={bersihkan} disabled={!adaGoresan || sedang}>
          Ulangi
        </button>
        <button type="button" className="preset" onClick={batal} disabled={sedang}>
          Batal
        </button>
        <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
          onClick={kirim} disabled={!adaGoresan || sedang}>
          {sedang ? 'Menyimpan…' : 'Simpan tanda tangan'}
        </button>
      </div>
    </div>
  );
}
