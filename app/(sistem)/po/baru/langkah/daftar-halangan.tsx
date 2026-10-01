import { LANGKAH, type Halangan, type KodeLangkah } from '@/lib/langkah-po';

const JUDUL = Object.fromEntries(LANGKAH.map((l) => [l.kode, l.judul])) as Record<KodeLangkah, string>;

/** Halangan simpan atau cetak, masing-masing dengan tautan ke langkah tempat ia diperbaiki. */
export default function DaftarHalangan({ judul, keterangan, halangan, ke, kelas = '' }: {
  judul: string; keterangan?: string; halangan: Halangan[]; ke: (k: KodeLangkah) => void; kelas?: string;
}) {
  return (
    <div className={`halangan ${kelas}`.trim()}>
      <b>{judul}</b>
      {keterangan && <p>{keterangan}</p>}
      <ul>
        {halangan.map((h, i) => (
          <li key={i}>
            {h.pesan}{' '}
            <button type="button" className="tautan-kecil" onClick={() => ke(h.langkah)}>
              Buka {JUDUL[h.langkah]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
