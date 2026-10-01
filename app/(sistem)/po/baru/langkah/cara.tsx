/** Langkah 0: pilih jalur, dan untuk PO unggahan pilih scan-nya. Hanya saat membuat PO baru. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from '../use-form-po';
import { isian } from '../isian';
import BacaScan from '../baca-scan';

export default function Cara({ f }: PropsLangkah) {
  const { preset, awal, asal, setAsal, pindaian, pilihPindaian, formKertasLama, setFormKertasLama } = f;
  return (
    <>
    {/* Pemilih jalur hanya muncul saat MEMBUAT. PO yang sudah ada memakai asal yang
        tersimpan, dan basis data membekukannya begitu PO meninggalkan draf. */}
    {!awal && (
      <section className="kotak no-print" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Cara membuat PO</h2>
          <span className="hint">menentukan isian di langkah berikutnya</span>
        </div>
        <div className="presets">
          <button type="button" className="preset" aria-pressed={asal === 'platform'}
            onClick={() => setAsal('platform')}>Buat di platform</button>
          <button type="button" className="preset" aria-pressed={asal === 'unggahan'}
            onClick={() => setAsal('unggahan')}>Unggah PO yang sudah ditandatangani</button>
        </div>
        {asal === 'unggahan' && (
          <div style={{ padding: '0 16px 16px' }}>
            <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 12px', maxWidth: 640 }}>
              Untuk PO yang diisi manual di kertas dan sudah ditandatangani semua pihak.
              Unggah pindaiannya, lalu isi form ini sambil membandingkannya,{' '}
              <strong>pindaian itulah dokumennya</strong>, dan isian di sini adalah
              transkripsinya. <strong>PDF, maksimal 15 MB.</strong>
            </p>
            <input type="file" accept="application/pdf" onChange={pilihPindaian} />
            <BacaScan f={f} />
            <label className="baris" style={{ padding: '12px 0 0' }}>
              <input type="checkbox" checked={formKertasLama}
                onChange={(e) => setFormKertasLama(e.target.checked)} />
              <span>
                <span className="nama">Form kertas lama (3 kotak tanda tangan)</span>
                <span className="meta">
                  Tanpa Regional Head Division. Tidak bisa diubah sesudah PO disimpan.
                </span>
              </span>
            </label>
            {pindaian && (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {pindaian.name} · {(pindaian.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB
              </p>
            )}
          </div>
        )}
      </section>
    )}
    </>
  );
}
