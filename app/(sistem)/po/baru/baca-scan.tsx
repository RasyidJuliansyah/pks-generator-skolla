'use client';

/**
 * Kotak "Baca scan dengan AI" di langkah 0 (catatan/17 amandemen 3).
 *
 * HANYA tampil saat gerbang organisasi menyala, dan hanya saat MEMBUAT PO unggahan: scan PO yang
 * sudah ada tidak pernah dibaca ulang. Tanpa menekan tombol ini, Sales mengetik seperti hari ini.
 *
 * Halaman-halaman PDF dirender jadi JPEG di peramban INI dan tidak pernah disimpan: yang sampai
 * ke server hanya gambar di dalam permintaan, dan yang tersimpan hanya hasil bacanya.
 */
import { useState } from 'react';
import { halamanKeJpeg } from '@/lib/render-pdf';
import { bacaScanPo } from '@/lib/ekstraksi-aksi';
import type { PropsLangkah } from './use-form-po';

export default function BacaScan({ f }: { f: PropsLangkah['f'] }) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  if (!f.gerbangEkstraksi || !f.pindaian) return null;

  async function baca() {
    setPesan(null);
    setSibuk(true);
    try {
      const berkas = await f.pindaian!.arrayBuffer();
      const gambar = await halamanKeJpeg(berkas);
      const hasil = await bacaScanPo(gambar);
      if (!hasil.ok) { setPesan(hasil.galat); return; }
      f.pasangEkstraksi(hasil.klaimId, hasil.hasil);
      setPesan('Scan terbaca. Periksa setiap isian terhadap pindaiannya.');
    } catch {
      // Sebab teknisnya (worker pdf.js, kanvas, memori) TIDAK ditampilkan: yang perlu diketahui
      // Sales hanya bahwa ia harus mengetik. Galat penyedia sudah jadi kalimat di atas.
      setPesan('Scan tidak terbaca, lanjutkan dengan mengetik.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="kotak" style={{ padding: '12px 16px', marginTop: 12 }}>
      <label className="baris">
        <input type="checkbox" checked={f.pemberitahuanAi}
          onChange={(e) => f.setPemberitahuanAi(e.target.checked)} />
        <span>
          <span className="nama">Sekolah sudah diberi tahu bahwa PO ini dibaca layanan AI</span>
          <span className="meta">
            Pindaian memuat nama, nomor HP, dan tanda tangan. Isian yang dihasilkan tetap harus
            kamu periksa; tidak ada yang masuk sistem tanpa kamu konfirmasi.
          </span>
        </span>
      </label>
      <button className="tombol" type="button" onClick={baca}
        disabled={!f.pemberitahuanAi || sibuk}>
        {sibuk ? 'Membaca scan, sekitar 30 detik…' : 'Baca scan'}
      </button>
      {pesan && <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{pesan}</p>}
    </div>
  );
}
