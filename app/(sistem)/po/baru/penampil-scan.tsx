import { halamanScan, type KodeLangkah } from '@/lib/langkah-po';
import type { PropsLangkah } from './use-form-po';

/**
 * Scan PO unggahan di samping langkah, dibuka di halaman yang relevan lewat fragmen
 * #page=N pada tautan PDF. Scan yang baru dipilih memakai tautan objek lokal; yang sudah
 * tersimpan memakai tautan bertanda tangan.
 */
export default function PenampilScan({ f, langkah }: Pick<PropsLangkah, 'f'> & { langkah: KodeLangkah }) {
  const tautan = f.pratinjau ?? f.pratinjauTersimpan;
  if (!tautan) {
    return (
      <div className="kotak scan-kosong">
        <p className="muted" style={{ margin: 0 }}>
          {/* "Cara membuat" hanya ada untuk PO baru; PO lama mengganti scan-nya di Tinjau. */}
          Scan PO belum ada. Pilih berkasnya di langkah {f.awal ? 'Tinjau (Ganti pindaian)' : 'Cara membuat'}.
        </p>
      </div>
    );
  }
  const hal = halamanScan(langkah);
  const src = hal ? `${tautan}#page=${hal}` : tautan;
  return <iframe key={src} src={src} title={hal ? `Scan PO halaman ${hal}` : 'Scan PO'} className="scan-po" />;
}
