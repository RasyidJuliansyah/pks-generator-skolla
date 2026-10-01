/** Langkah 6: pernyataan kesesuaian (unggahan), halangan simpan dan cetak, cetak, dan pratinjau dokumen. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from '../use-form-po';
import DaftarHalangan from './daftar-halangan';

/** Nama langkah untuk pesan "belum dicocokkan"; hanya lima langkah yang memuat isian dari scan. */
const JUDUL_LANGKAH: Record<string, string> = {
  sekolah: 'Sekolah', paket: 'Paket & harga', rombel: 'Rombel',
  termin: 'Termin & masa aktif', penanda: 'Penanda tangan & catatan',
};

export default function Tinjau({ f, ke }: PropsLangkah) {
  const { halanganSimpan, halanganCetak, preset, awal, berkasUnggahan, asal, pindaian, pratinjau, sesuaiPindaian, setSesuaiPindaian, pratinjauTersimpan, sekolah, harga, halangan, kurangLengkap, html, pilihPindaian } = f;
  return (
    <>
    {/* Sunting PO unggahan: pindaiannya bisa diganti — termasuk untuk memulihkan
        unggahan yang gagal saat drafnya dibuat. */}
    {awal && asal === 'unggahan' && (
      <section className="kotak no-print" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Ganti pindaian</h2>
          <span className="hint">{berkasUnggahan ? 'hanya bila pindaiannya keliru' : 'belum ada pindaian tersimpan'}</span>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 12px', maxWidth: 640 }}>
            Mengubah isi PO atau mengganti pindaiannya membatalkan pernyataan bahwa data
            sesuai dengan pindaian. Centang lagi di kotak Pernyataan kesesuaian bila masih sesuai,
            tanpa itu PO ini tidak bisa diajukan. <strong>PDF, maksimal 15 MB.</strong>
          </p>
          <input type="file" accept="application/pdf" onChange={pilihPindaian} />
          {pindaian && (
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {pindaian.name} · {(pindaian.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB
            </p>
          )}
        </div>
      </section>
    )}

    {/* Konfirmasi per langkah (catatan/17 amandemen 2 butir 4): Tinjau terkunci sampai semua
        langkah dicocokkan, semua centang berisiko lengkap, dan setiap catatan berjenis.
        Daftarnya disebut supaya Sales tahu ke mana harus kembali, bukan menebak. */}
    {!f.tinjauTerbuka && (
      <section className="kotak no-print" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Masih ada isian hasil baca scan yang belum dicocokkan</h2>
          <span className="hint">langkah 1 sampai 5</span>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <p className="muted" style={{ margin: '4px 0 8px', fontSize: 13.5, maxWidth: 640 }}>
            Sebelum Tinjau bisa dibuka, setiap isian yang datang dari hasil baca scan harus
            dicocokkan dengan pindaiannya. Lengkap bukan berarti benar.
          </p>
          <ul className="daftar">
            {f.langkahScan.map((l) => (
              <li key={l.langkah} style={{ padding: '8px 0' }}>
                <button type="button" className="preset" onClick={() => ke(l.langkah)}>
                  {JUDUL_LANGKAH[l.langkah] ?? l.langkah}
                </button>{' '}
                <span className="meta">{l.kunci.length} isian belum dicocokkan</span>
              </li>
            ))}
            {f.catatanTanpaJenis.length > 0 && (
              <li style={{ padding: '8px 0' }}>
                <button type="button" className="preset" onClick={() => ke('penanda')}>
                  Penanda tangan &amp; catatan
                </button>{' '}
                <span className="meta">{f.catatanTanpaJenis.length} catatan belum dipilih jenisnya</span>
              </li>
            )}
          </ul>
        </div>
      </section>
    )}

    {asal === 'unggahan' && (pratinjau ?? pratinjauTersimpan) && (
      <section className="kotak no-print" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h2>Pernyataan kesesuaian</h2><span className="hint">menjamin seluruh isi PO</span></div>
        <label className="baris" style={{ padding: '12px 16px' }}>
          <input type="checkbox" checked={sesuaiPindaian} disabled={!f.tinjauTerbuka}
            onChange={(e) => setSesuaiPindaian(e.target.checked)} />
          <span>
            <span className="nama">Data yang saya isi sesuai dengan pindaian ini</span>
            <span className="meta">
              Dicatat berikut nama dan waktunya. Tidak ada mesin yang memeriksa ini:
              pernyataan Anda satu-satunya yang menjamin data di sistem mewakili kertas
              yang ditandatangani.
              {!f.tinjauTerbuka && ' Terkunci sampai seluruh isian dari scan dicocokkan.'}
            </span>
          </span>
        </label>
      </section>
    )}
    <section className="kotak no-print" style={{ marginBottom: 16, paddingBottom: 4 }}>
      <div className="panel-head"><h2>Tinjau</h2><span className="hint">periksa sebelum menyimpan dan mencetak</span></div>
      {halanganSimpan.length === 0 && halanganCetak.length === 0 && f.tinjauTerbuka && (
        <p className="muted" style={{ padding: '4px 16px', margin: 0 }}>Tidak ada halangan: PO ini siap disimpan dan dicetak.</p>
      )}
      {halanganSimpan.length > 0 && (
        <DaftarHalangan judul="Belum bisa disimpan" halangan={halanganSimpan} ke={ke} />
      )}
        {/* Daftarnya sendiri, bukan digabung ke "Belum bisa disimpan": draf
            memang boleh disimpan meski isiannya belum lengkap. */}
        {halanganCetak.length > halanganSimpan.length && (
          <DaftarHalangan judul="Belum bisa dicetak" kelas="halangan-cetak" ke={ke}
            keterangan="Yang tercetak akan ditandatangani sekolah, jadi isiannya harus lengkap."
            halangan={halanganCetak.slice(halanganSimpan.length)} />
        )}
        <button type="button" className="preset no-print"
          style={{ width: 'calc(100% - 32px)', margin: '0 16px 16px', justifyContent: 'center' }}
          disabled={kurangLengkap.length > 0 || !f.tinjauTerbuka} onClick={() => window.print()}>
          Cetak / Simpan PDF
        </button>
    </section>
    {/* Di luar .grid-po: kotak A4 lebih lebar dari kolomnya dan panel harga
        bersifat lengket, jadi kalau tetap di dalam kisi keduanya saling tindih. */}
    <section className="po-dokumen">
      <h2 className="po-dokumen-judul no-print">Pratinjau Dokumen</h2>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
    </>
  );
}
