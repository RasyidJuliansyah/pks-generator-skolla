import React from 'react';
// Pratinjau daftar sekolah berikut baris penyaringnya, dua tema.
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-daftar-sekolah.tsx
//   node uji/tangkap-layar.mjs _daftar-terang.html _daftar-gelap.html
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { rp } from '../lib/format';
import { TAHAP_PO, TAHAP_PKS } from '../lib/status-po';
import { PERIODE } from '../lib/periode';
import { halaman, jendela } from '../lib/paginasi';

const LABEL = Object.fromEntries([...TAHAP_PO, ...TAHAP_PKS].map((s) => [s.kode, s]));
const pemegang = ['bintang', 'agung', 'zhurry'];
const sekolah = [
  { nama: 'SMA Negeri 1 Cibadak', jenjang: 'SMA', npsn: '20203344',
    kepsek: 'Dra. Sri Wahyuni, M.Pd.', sales: 'bintang',
    po: [{ n: 7, s: 'pks_ditandatangani' }, { n: 3, s: 'selesai' }, { n: 1, s: 'ditolak' }], nilai: 268_400_000 },
  { nama: 'SMP Islam Al-Azhar 14', jenjang: 'SMP', npsn: '20301122',
    kepsek: 'H. Muhammad Yusuf, S.Pd.', sales: 'agung',
    po: [{ n: 12, s: 'verifikasi' }], nilai: 74_000_000 },
  { nama: 'SD Muhammadiyah 4 Pandaan', jenjang: 'SD', npsn: null,
    kepsek: null, sales: 'zhurry', po: [], nilai: 0 },
  { nama: 'SMA Negeri 3 Sukabumi', jenjang: 'SMA', npsn: '20203399',
    kepsek: 'Drs. Bambang Priyanto', sales: 'bintang',
    po: [{ n: 11, s: 'draf' }, { n: 9, s: 'aktif' }, { n: 6, s: 'selesai' },
         { n: 4, s: 'selesai' }, { n: 2, s: 'ditolak' }], nilai: 391_200_000 },
];

const chip = (label: string, warna?: string, aktif?: boolean) => (
  <a key={label} href="#" className="status-chip" aria-current={aktif || undefined}>
    {warna && <span className={`titik w-${warna}`} />}<span>{label}</span>
  </a>
);

const isi = renderToStaticMarkup(
  <main className="wrap">
    <header className="top">
      <div>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Sekolah</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          247 sekolah · halaman 4 dari 13
        </p>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          9 PO dan nilai {rp(733_600_000)} pada halaman ini.
        </p>
      </div>
    </header>

    <div className="saring-waktu">
      <div className="status-baris" role="group" aria-label="Rentang cepat">
        {PERIODE.map((x) => chip(x.label, undefined, x.kode === 'semua'))}
      </div>
      <form className="saring-tanggal">
        <label htmlFor="s-dari">Dari</label>
        <input id="s-dari" type="date" />
        <label htmlFor="s-sampai">sampai</label>
        <input id="s-sampai" type="date" />
        <button type="button" className="preset">Terapkan</button>
      </form>
    </div>
    <p className="muted" style={{ margin: '-6px 0 14px', fontSize: 12.5 }}>
      Rentang waktu menyaring berdasarkan tanggal PO dibuat.
    </p>

    <form className="cari-baris" style={{ marginBottom: 18 }}>
      <div className="f" style={{ margin: 0, flex: '2 1 220px', maxWidth: 320 }}>
        <label htmlFor="q">Cari sekolah</label>
        <input id="q" type="search" placeholder="Nama sekolah…" />
      </div>
      <div className="f" style={{ margin: 0, flex: '1 1 150px', maxWidth: 220 }}>
        <label htmlFor="f-sales">Sales</label>
        <select id="f-sales" defaultValue="">
          <option value="">Semua sales</option>
          {pemegang.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div className="f" style={{ margin: 0, flex: '1 1 150px', maxWidth: 220 }}>
        <label htmlFor="f-po">Status PO</label>
        <select id="f-po" defaultValue="">
          <option value="">Semua status PO</option>
          {TAHAP_PO.map((x) => <option key={x.kode} value={x.kode}>{x.label}</option>)}
        </select>
      </div>
      <div className="f" style={{ margin: 0, flex: '1 1 150px', maxWidth: 220 }}>
        <label htmlFor="f-pks">Status PKS</label>
        <select id="f-pks" defaultValue="">
          <option value="">Semua status PKS</option>
          {TAHAP_PKS.map((x) => <option key={x.kode} value={x.kode}>{x.label}</option>)}
        </select>
      </div>
      <button type="button" className="preset" style={{ alignSelf: 'end' }}>Terapkan</button>
      <a href="#" className="preset" style={{ alignSelf: 'end' }}>Bersihkan</a>
    </form>

    <div className="sekolah-kisi">
      {sekolah.map((s) => (
        <a key={s.nama} href="#" className="sekolah-kartu">
          <div className="sekolah-kartu-kepala">
            <strong>{s.nama}</strong><span className="muted">{s.jenjang}</span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {s.npsn ? `NPSN ${s.npsn}` : 'NPSN belum diisi'}
            {s.kepsek ? ` · ${s.kepsek}` : ''}
          </div>
          <div className="sekolah-sales">Sales <strong>{s.sales}</strong></div>
          <div className="status-baris" style={{ margin: '10px 0 0' }}>
            {s.po.length ? s.po.slice(0, 4).map((p) => (
              <span key={p.n} className="status-chip">
                <span className={`titik w-${LABEL[p.s]?.warna ?? 'muted'}`} />
                <span>PO-{String(p.n).padStart(3, '0')}</span>
              </span>
            )) : <span className="muted" style={{ fontSize: 13 }}>Belum ada PO</span>}
            {s.po.length > 4 && <span className="status-chip nol"><span>+{s.po.length - 4}</span></span>}
          </div>
          {s.po.length > 0 && (
            <div className="ttd-waktu" style={{ marginTop: 8 }}>
              {s.po.length} PO · nilai {rp(s.nilai)}
            </div>
          )}
        </a>
      ))}
    </div>

    <nav className="halaman-baris" aria-label="Navigasi halaman">
      <a href="#" className="status-chip"><span>← Sebelumnya</span></a>
      {jendela(halaman(247, 20, 4).kini, halaman(247, 20, 4).jumlah).map((n) => (
        <a key={n} href="#" className="status-chip" aria-current={n === 4 || undefined}>
          <span>{n}</span>
        </a>
      ))}
      <a href="#" className="status-chip"><span>Berikutnya →</span></a>
    </nav>
  </main>
);

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_daftar-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Daftar sekolah ${nama}</title><style>${css}</style><body>${isi}</body></html>`);
}
console.log('dua berkas pratinjau ditulis');
