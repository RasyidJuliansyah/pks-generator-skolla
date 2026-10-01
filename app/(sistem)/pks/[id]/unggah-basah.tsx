'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { catatUnggahanPks } from '@/lib/pks-aksi';
import { unggahBerkasAksi } from '@/lib/storage-aksi';

const MAKS_MB = 15;
const JENIS = ['application/pdf', 'image/jpeg', 'image/png'];
const mb = (bita: number) => (bita / 1024 / 1024).toFixed(1).replace('.', ',');
const EKSTENSI: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png',
};

/**
 * Mengunggah pindaian PKS bermeterai.
 *
 * Berkasnya dikirim langsung dari peramban ke penyimpanan memakai sesi
 * pengguna, bukan lewat Server Action: pindaian belasan megabyte, sementara
 * badan Server Action dibatasi 1MB. Yang lewat server hanya pencatatannya.
 */
export default function UnggahBasah({
  poId, sudahAda, urlBerkas, tanggal, diunggahOleh, tertahanSponsorship,
}: {
  poId: string;
  sudahAda: boolean;
  urlBerkas: string | null;
  tanggal: string | null;
  diunggahOleh: string | null;
  /**
   * PO bersponsorship yang dokumennya belum dikonfirmasi Finance untuk versi PO sekarang.
   * Penolakannya ada di `unggah_pks_basah`; ini supaya orang tahu apa yang ditunggu
   * sebelum menabrak dinding, bukan sesudahnya.
   */
  tertahanSponsorship?: boolean;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  const [buka, setBuka] = useState(false);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [tgl, setTgl] = useState('');

  function kirim() {
    setGalat(null);
    if (tertahanSponsorship) {
      return setGalat('PO ini bersponsorship. Finance harus mengonfirmasi Dokumen Sponsorship '
        + 'untuk versi PO sekarang sebelum PKS bermeterai bisa diunggah.');
    }
    if (!berkas) return setGalat('Pilih berkas pindaiannya dulu.');
    if (!JENIS.includes(berkas.type)) return setGalat('Berkas harus PDF, JPG, atau PNG.');
    if (berkas.size > MAKS_MB * 1024 * 1024) {
      // Menyebut ukuran sebenarnya dan jalan keluarnya: pesan "terlalu besar"
      // saja membuat orang mencoba berkas yang sama berulang kali.
      return setGalat(
        `Berkas ini ${mb(berkas.size)} MB, sedangkan batasnya ${MAKS_MB} MB. `
        + 'Pindai ulang pada 200 dpi hitam-putih, atau kompres PDF-nya, lalu unggah lagi.'
      );
    }
    if (!tgl) return setGalat('Isi tanggal penandatanganan yang tertulis di dokumen.');

    mulai(async () => {
      const jalur = `${poId}/pks.${EKSTENSI[berkas.type]}`;
      const fd = new FormData();
      fd.append('bucket', 'pks-basah');
      fd.append('jalur', jalur);
      fd.append('berkas', berkas);

      const res = await unggahBerkasAksi(fd);
      if (!res.ok) return setGalat(`Gagal mengunggah: ${res.galat}`);

      const h = await catatUnggahanPks(poId, jalur, tgl);
      if (h.ok) { setBuka(false); setBerkas(null); setTgl(''); router.refresh(); }
      else setGalat(h.galat ?? 'Gagal mencatat unggahan.');
    });
  }

  return (
    <div className="kotak no-print" style={{ padding: '18px 20px', marginTop: 16 }}>
      <span className={`lencana ${sudahAda ? 'hijau' : ''}`}>
        {sudahAda ? 'Sudah ditandatangani basah' : 'Menunggu tanda tangan basah'}
      </span>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 0' }}>PKS Bermeterai</h2>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5, maxWidth: 620 }}>
        {sudahAda
          ? <>Ditandatangani {tanggal}, diunggah oleh {diunggahOleh}. Inilah dokumen
              yang mengikat, PDF dari sistem hanya bahan cetaknya.</>
          : <>Setelah kedua pihak menandatangani di atas meterai, unggah pindaiannya
              di sini. Kerjasama baru tercatat jadi setelah langkah ini.{' '}
              <strong>Berkas PDF, JPG, atau PNG, maksimal {MAKS_MB} MB.</strong>{' '}
              Pindaian 200 dpi hitam-putih biasanya jauh di bawah batas itu; foto
              ponsel beresolusi penuh bisa melewatinya.</>}
      </p>

      {buka && (
        <div style={{ marginTop: 14, maxWidth: 460 }}>
          <div className="f">
            <label htmlFor="u-berkas">Pindaian PKS</label>
            <input id="u-berkas" type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setBerkas(e.target.files?.[0] ?? null)} />
            <span className="bantuan">
              PDF, JPG, atau PNG. Maksimal {MAKS_MB} MB.
              {berkas && (
                <> Berkas terpilih <strong>{mb(berkas.size)} MB</strong>
                  {berkas.size > MAKS_MB * 1024 * 1024
                    ? ', melewati batas.'
                    : '.'}
                </>
              )}
            </span>
          </div>
          <div className="f" style={{ marginTop: 12 }}>
            <label htmlFor="u-tgl">Tanggal penandatanganan</label>
            <input id="u-tgl" type="date" value={tgl} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setTgl(e.target.value)} />
            <span className="bantuan">Tanggal yang tertulis di dokumen, bukan tanggal unggah.</span>
          </div>
        </div>
      )}

      {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}

      <div className="ttd-aksi">
        {sudahAda && urlBerkas && (
          <a className="preset" href={urlBerkas} target="_blank" rel="noopener noreferrer">
            Lihat berkas
          </a>
        )}
        {buka ? (
          <>
            <button type="button" className="preset" disabled={kerja}
              onClick={() => { setBuka(false); setGalat(null); }}>Batal</button>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              disabled={kerja} onClick={kirim}>
              {kerja ? 'Mengunggah…' : 'Unggah'}
            </button>
          </>
        ) : (
          <button type="button" className={sudahAda ? 'preset' : 'tombol'}
            style={sudahAda ? undefined : { width: 'auto', margin: 0 }}
            onClick={() => setBuka(true)}>
            {sudahAda ? 'Ganti berkas' : 'Unggah PKS bermeterai'}
          </button>
        )}
      </div>
    </div>
  );
}
