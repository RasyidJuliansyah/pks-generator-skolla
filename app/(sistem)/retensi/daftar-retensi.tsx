'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { hapusBerkasJatuhTempo } from '@/lib/po-aksi';
import type { BerkasJatuhTempo } from '@/lib/retensi';

export default function DaftarRetensi({ daftar }: { daftar: BerkasJatuhTempo[] }) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  // Konfirmasi per baris, bukan satu tombol "hapus semua": penghapusan tidak bisa
  // dibatalkan, dan tombol borongan membuat kesalahan sekali menjadi kerusakan banyak.
  const [pasti, setPasti] = useState<string | null>(null);

  function hapus(b: BerkasJatuhTempo) {
    setGalat(null);
    mulai(async () => {
      const h = await hapusBerkasJatuhTempo(b.bucket, b.jalur);
      if (h.ok) { setPasti(null); router.refresh(); }
      else setGalat(h.galat ?? 'Gagal menghapus.');
    });
  }

  if (daftar.length === 0) {
    return (
      <div className="kotak" style={{ padding: '18px 20px' }}>
        <strong style={{ fontSize: 14 }}>Tidak ada berkas yang jatuh tempo.</strong>
        <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
          Halaman ini akan terisi sendiri begitu ada berkas yang lewat masa simpannya.
        </p>
      </div>
    );
  }

  return (
    <>
      {galat && <div className="halangan"><b>Gagal</b><ul><li>{galat}</li></ul></div>}
      <div className="kotak">
        <div className="panel-head">
          <h2>{daftar.length} berkas jatuh tempo</h2>
          <span className="hint">dihapus satu per satu</span>
        </div>
        <ul className="daftar">
          {daftar.map((b) => (
            <li key={b.jalur + b.jenis}>
              <div className="baris" style={{ alignItems: 'flex-start' }}>
                <span>
                  <span className="nama">PO-{b.nomor} · {b.sekolah}</span>
                  <span className="meta">
                    {b.jenis} · jatuh tempo {new Date(b.jatuh_tempo).toLocaleDateString('id-ID',
                      { dateStyle: 'medium' })} · <code>{b.jalur}</code>
                  </span>
                </span>
                <span className="kanan">
                  {pasti === b.jalur ? (
                    <>
                      <button type="button" className="preset" onClick={() => hapus(b)} disabled={kerja}>
                        {kerja ? 'Menghapus…' : 'Ya, hapus permanen'}
                      </button>
                      <button type="button" className="preset" onClick={() => setPasti(null)} disabled={kerja}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <button type="button" className="preset" onClick={() => setPasti(b.jalur)}>
                      Hapus gambar
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
