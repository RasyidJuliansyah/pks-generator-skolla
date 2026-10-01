'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buatPks, finalisasiPks, batalkanPks } from '@/lib/pks-aksi';

export default function PanelPks({
  poId, adaDraf, finalPada, bisaKelola,
}: {
  poId: string;
  adaDraf: boolean;
  finalPada: string | null;
  bisaKelola: boolean;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  const aksi = (fn: () => Promise<{ ok: boolean; galat?: string }>) =>
    mulai(async () => {
      setGalat(null);
      const h = await fn();
      if (h.ok) router.refresh();
      else setGalat(h.galat ?? 'Gagal.');
    });

  return (
    <div className="kotak no-print" style={{ padding: '18px 20px', marginTop: 16 }}>
      <div className="baris-kanan" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <span className={`lencana ${finalPada ? 'hijau' : ''}`}>{finalPada ? 'Final' : adaDraf ? 'Draf' : 'Belum dibuat'}</span>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5, maxWidth: 620 }}>
            {finalPada
              ? `Difinalisasi ${new Date(finalPada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}. `
                + 'Unduh, cetak dua rangkap, tandatangani basah di atas meterai, lalu unggah hasil pindaiannya. '
                + 'PDF-nya dikunci: boleh dicetak, tidak boleh disunting atau disalin isinya.'
              : adaDraf
                ? 'Periksa isinya, lalu finalisasi sebelum diunduh untuk ditandatangani basah. '
                  + 'Angka nomor perjanjian ditulis tangan saat penandatanganan.'
                : 'Angka nomor perjanjian diisi tangan; sistem hanya mencetak ekornya '
                  + '(/EXTSKOLLA/PKS/bulan/tahun).'}
          </p>
        </div>
        <div className="ttd-aksi" style={{ margin: 0 }}>
          <Link href="/pks" className="preset">Kembali ke daftar</Link>
          <Link href={`/po/${poId}`} className="preset">Lihat PO</Link>
          {!adaDraf && bisaKelola && (
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              disabled={kerja} onClick={() => aksi(() => buatPks(poId))}>
              {kerja ? 'Memproses…' : 'Buat draf PKS'}
            </button>
          )}
          {adaDraf && !finalPada && bisaKelola && (
            <>
              <button type="button" className="preset merah" disabled={kerja}
                onClick={() => aksi(() => batalkanPks(poId))}>Batalkan draf</button>
              <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
                disabled={kerja} onClick={() => aksi(() => finalisasiPks(poId))}>
                {kerja ? 'Memproses…' : 'Finalisasi PKS'}
              </button>
            </>
          )}
          {finalPada && (
            <a className="tombol" style={{ width: 'auto', margin: 0 }}
              href={`/api/pks/${poId}/pdf`}>
              Unduh PDF
            </a>
          )}
        </div>
      </div>
      {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}
    </div>
  );
}
