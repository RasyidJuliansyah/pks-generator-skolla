'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { simpanDokumenSponsorship } from '@/lib/pks-aksi';
import { konfirmasiBeres, type KonfirmasiSponsorship } from '@/lib/sponsorship';

/**
 * Kotak Dokumen Sponsorship di halaman PKS (catatan/18).
 *
 * Tampil untuk SETIAP PO bersponsorship, lolos otomatis maupun manual. Finance mencentang,
 * peran lain melihat statusnya. Penolakan sungguhannya ada di basis data: RLS menentukan
 * siapa boleh menulis, dan `unggah_pks_basah` menolak PKS basah selama konfirmasi yang
 * berlaku belum ada. Yang di sini hanya menjelaskan.
 */

const PERNYATAAN = [
  ['form', 'Form Sponsorship atau Form Hibah beserta Berita Acaranya sudah ditandatangani'],
  ['rekening', 'Rekening penerima atas nama sekolah, yayasan, atau badan hukum, bukan perorangan'],
  ['meterai', 'Hibah di atas Rp5.000.000 memakai meterai Rp10.000 pada Berita Acaranya'],
] as const;

export default function DokumenSponsorship({
  poId, versiPo, konfirmasi, adalahFinance,
}: {
  poId: string;
  versiPo: number;
  konfirmasi: KonfirmasiSponsorship | null;
  adalahFinance: boolean;
}) {
  // Konfirmasi untuk versi PO yang bukan versi sekarang tidak berlaku — PO yang berubah
  // sesudah dikonfirmasi harus dikonfirmasi ulang. `berlaku` dipisah dari `lengkap` karena
  // pesannya berbeda: "versi lama" bukan "belum lengkap".
  const berlaku = !!konfirmasi && konfirmasi.versi_po === versiPo;
  const lengkap = konfirmasiBeres(konfirmasi, versiPo);

  const [centang, setCentang] = useState({
    form: berlaku ? konfirmasi.form_ditandatangani : false,
    rekening: berlaku ? konfirmasi.rekening_atas_nama_lembaga : false,
    meterai: berlaku ? konfirmasi.meterai_bila_di_atas_5juta : false,
  });
  const [pesan, setPesan] = useState<string | null>(null);
  const [kerja, mulai] = useTransition();
  const router = useRouter();

  function simpan() {
    setPesan(null);
    mulai(async () => {
      const h = await simpanDokumenSponsorship(poId, versiPo, centang);
      if (!h.ok) return setPesan(h.galat ?? 'Gagal menyimpan.');
      router.refresh();
    });
  }

  return (
    <section className="kotak" style={{ marginTop: 18 }}>
      <div className="panel-head">
        <h2>Dokumen Sponsorship</h2>
        <span className={`lencana ${lengkap ? 'hijau' : 'kuning'}`}>
          {lengkap ? 'Sudah dikonfirmasi' : berlaku ? 'Belum lengkap' : 'Belum dikonfirmasi'}
        </span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {konfirmasi && !berlaku && (
          <p className="meta" style={{ marginTop: 0 }}>
            PO ini berubah sesudah dikonfirmasi (konfirmasi untuk versi {konfirmasi.versi_po},
            sekarang versi {versiPo}). Konfirmasinya perlu diulang.
          </p>
        )}

        {PERNYATAAN.map(([kunci, teks]) => (
          <label className="baris" key={kunci} style={{ padding: '8px 0', minHeight: 44 }}>
            <input
              type="checkbox"
              checked={centang[kunci]}
              disabled={!adalahFinance || kerja}
              onChange={(e) => setCentang({ ...centang, [kunci]: e.target.checked })}
            />
            <span><span className="nama">{teks}</span></span>
          </label>
        ))}

        {adalahFinance ? (
          <button type="button" className="tombol" disabled={kerja} onClick={simpan}
            style={{ marginTop: 10, minHeight: 44 }}>
            {kerja ? 'Menyimpan…' : 'Simpan konfirmasi'}
          </button>
        ) : (
          <p className="meta" style={{ marginBottom: 0 }}>
            Hanya Finance yang bisa mengisi bagian ini.
          </p>
        )}

        {pesan && <p className="meta" style={{ marginBottom: 0 }}>{pesan}</p>}

        {berlaku && (
          <p className="meta" style={{ marginBottom: 0 }}>
            Terakhir disimpan {konfirmasi.oleh.split('@')[0]} ·{' '}
            {new Date(konfirmasi.pada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>
    </section>
  );
}
