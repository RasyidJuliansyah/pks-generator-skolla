'use client';

/**
 * Formulir gerbang ekstraksi + tombol pembuka hasil mentah (catatan/25 Tugas 9).
 *
 * Riwayatnya append-only: menekan "Simpan" menulis BARIS BARU, dan baris terakhir yang berlaku.
 * Karena itu formulirnya tidak memuat keadaan "terpasang" -- ia selalu mulai dari isian baru.
 */
import { useState, useTransition } from 'react';
import { simpanGerbang, bukaHasil, type IsianGerbang } from '@/lib/ekstraksi-gerbang-aksi';

const KOSONG: IsianGerbang = {
  menyala: false, penyedia: 'OpenCode Go', paketAkun: '',
  // Nama model SENGAJA kosong di sini, bukan dipatok: ia hidup di dua tempat saja (fungsi
  // private.model_ekstraksi() di basis data dan konstanta modul penyedia), dan
  // uji/ekstraksi-bundel.test.mjs menolak nama itu muncul di berkas klien. Kolom riwayat di
  // bawah sudah menunjukkan model yang tercatat terakhir.
  model: '',
  pemeriksaanData: '', risikoDiterimaOleh: '', alasanRisiko: '',
};

export default function Gerbang({ berlaku }: { berlaku: { menyala: boolean } | null }) {
  const [i, setI] = useState<IsianGerbang>(KOSONG);
  const [pesan, setPesan] = useState<string | null>(null);
  const [kirim, mulai] = useTransition();

  const ubah = (k: keyof IsianGerbang, v: string | boolean) => setI((x) => ({ ...x, [k]: v }));

  const simpan = () => {
    setPesan(null);
    mulai(async () => {
      const r = await simpanGerbang(i);
      setPesan(r.ok
        ? `Tersimpan. Gerbang sekarang ${i.menyala ? 'MENYALA' : 'mati'}; muat ulang halaman untuk melihat keadaannya.`
        : (r.galat ?? 'Gagal menyimpan.'));
      if (r.ok) setI(KOSONG);
    });
  };

  return (
    <section className="kotak" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h2>Gerbang ekstraksi</h2>
        <span className="hint">
          {berlaku?.menyala ? 'sekarang MENYALA' : 'sekarang mati'}
        </span>
      </div>
      <div className="isian">
        <label className="baris" style={{ padding: '0 16px' }}>
          <input type="checkbox" checked={i.menyala} onChange={(e) => ubah('menyala', e.target.checked)} />
          <span>
            <span className="nama">Nyalakan pembacaan scan dengan AI</span>
            <span className="meta">
              Selama mati, kotak &quot;Baca scan&quot; tidak muncul dan setiap klaim ditolak basis
              data: jalur unggah berperilaku persis seperti sebelum fitur ini ada.
            </span>
          </span>
        </label>
        <div className="f">
          <label htmlFor="g-penyedia">Penyedia</label>
          <input id="g-penyedia" value={i.penyedia} onChange={(e) => ubah('penyedia', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="g-paket">Paket akun</label>
          <input id="g-paket" value={i.paketAkun} onChange={(e) => ubah('paketAkun', e.target.value)}
            placeholder="mis. OpenCode Go" />
        </div>
        <div className="f">
          <label htmlFor="g-model">Model</label>
          <input id="g-model" value={i.model} onChange={(e) => ubah('model', e.target.value)} />
        </div>
        <div className="f lebar">
          <label htmlFor="g-data">Pemeriksaan data</label>
          <input id="g-data" value={i.pemeriksaanData} onChange={(e) => ubah('pemeriksaanData', e.target.value)}
            placeholder="mis. pelatihan atas data dimatikan" />
        </div>
        <div className="f">
          <label htmlFor="g-risiko">Risiko diterima oleh</label>
          <input id="g-risiko" value={i.risikoDiterimaOleh} onChange={(e) => ubah('risikoDiterimaOleh', e.target.value)} />
        </div>
        <div className="f">
          <label htmlFor="g-alasan">Alasan</label>
          <input id="g-alasan" value={i.alasanRisiko} onChange={(e) => ubah('alasanRisiko', e.target.value)}
            placeholder="mis. tanpa DPA, diterima" />
        </div>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 10px', maxWidth: 640 }}>
          Menyalakan gerbang menuntut KETUJUH isian di atas terisi: perubahannya tercatat sebagai
          riwayat, termasuk siapa yang menerima risikonya dan alasannya. Basis data yang menolak,
          bukan layar ini.
        </p>
        <button type="button" className="tombol" disabled={kirim} onClick={simpan}>
          {kirim ? 'Menyimpan…' : 'Simpan keadaan gerbang'}
        </button>
        {pesan && <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>{pesan}</p>}
      </div>
    </section>
  );
}

/** Tombol pembuka isi mentah satu pembacaan; isinya baru diambil saat ditekan. */
export function BukaHasil({ id }: { id: string }) {
  const [isi, setIsi] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [kirim, mulai] = useTransition();
  const buka = () => mulai(async () => {
    const r = await bukaHasil(id);
    if (r.ok) { setIsi(r.hasil ?? ''); setPesan(null); }
    else setPesan(r.galat ?? 'Gagal membaca.');
  });
  return (
    <>
      <button type="button" className="preset" disabled={kirim} onClick={buka}>
        {kirim ? 'Membuka…' : isi === null ? 'Lihat hasil mentah' : 'Muat ulang hasil mentah'}
      </button>
      {pesan && <p className="muted" style={{ fontSize: 13 }}>{pesan}</p>}
      {isi !== null && (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8, maxHeight: 320, overflow: 'auto' }}>
          {isi}
        </pre>
      )}
    </>
  );
}
