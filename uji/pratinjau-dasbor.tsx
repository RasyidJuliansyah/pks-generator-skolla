import React from 'react';
// Perkakas pemeriksaan manual untuk grafik dasbor.
//
// Dasbor sungguhan butuh sesi login dan data nyata; berkas ini merender
// komponen grafiknya dengan data contoh yang meniru musim puncak Juni-September,
// dalam dua tema sekaligus, supaya tata letak dan kontras bisa diperiksa tanpa
// menyentuh data produksi:
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-dasbor.tsx
//   lalu buka _dasbor-terang.html dan _dasbor-gelap.html
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { BatangWaktu, Donat, AlurTahap, BatangPeringkat } from '../lib/grafik';
import { PALET } from '../lib/status-po';
import { rp, rpSingkat } from '../lib/format';
import { TAHAP_PO, TAHAP_PKS } from '../lib/status-po';

// Data contoh yang meniru musim puncak Juni-September.
const tren = [
  { label: 'Mar 26', nilai: 0 },
  { label: 'Apr 26', nilai: 42_000_000, ket: '2 PO' },
  { label: 'Mei 26', nilai: 88_000_000, ket: '4 PO' },
  { label: 'Jun 26', nilai: 315_000_000, ket: '14 PO' },
  { label: 'Jul 26', nilai: 640_000_000, ket: '31 PO' },
  { label: 'Agu 26', nilai: 812_000_000, ket: '38 PO' },
];
const proyeksi = [
  { label: 'Agu 26', nilai: 180_000_000 },
  { label: 'Sep 26', nilai: 420_000_000 },
  { label: 'Okt 26', nilai: 95_000_000 },
  { label: 'Nov 26', nilai: 0 },
  { label: 'Des 26', nilai: 310_000_000 },
  { label: 'Jan 27', nilai: 120_000_000 },
];
const jumlahPo = [6, 3, 5, 9, 2, 12];
const jumlahPks = [7, 11, 4, 1];
const corong = [
  { label: 'PO dibuat', jumlah: 89 },
  { label: 'Ditandatangani', jumlah: 71 },
  { label: 'Masuk verifikasi', jumlah: 64 },
  { label: 'Terverifikasi', jumlah: 46 },
  { label: 'PKS terbit', jumlah: 23 },
  { label: 'PKS bermeterai', jumlah: 12 },
];

const isi = renderToStaticMarkup(
  <main className="wrap">
    <header style={{ marginBottom: 4 }}>
      <p className="eyebrow">Skolla Package 2026</p>
      <h1>Dashboard</h1>
    </header>
    <div className="saring-waktu">
      <div className="status-baris">
        {['3 bulan', '6 bulan', '12 bulan', 'Semua'].map((l) => (
          <a key={l} href="#" className="status-chip"
            aria-current={l === '12 bulan' ? 'true' : undefined}><span>{l}</span></a>
        ))}
      </div>
      <form className="saring-tanggal">
        <label htmlFor="d1">Dari</label>
        <input id="d1" type="date" />
        <label htmlFor="d2">sampai</label>
        <input id="d2" type="date" />
        <button type="button" className="preset">Terapkan</button>
      </form>
    </div>
    <div className="kpi">
      {[
        { l: 'PO pada periode ini', v: '89', j: '6 ditolak' },
        { l: 'Nilai PO', v: rp(1_897_000_000), j: `rata-rata ${rpSingkat(21_314_606)} per PO` },
        { l: 'Kerjasama jadi', v: '12', j: `senilai ${rpSingkat(420_000_000)}` },
        { l: 'Siswa terlayani', v: '14.208', j: 'dari seluruh PO pada periode ini' },
      ].map((k) => (
        <div className="kpi-kotak" key={k.l}>
          <div className="kpi-label">{k.l}</div>
          <div className="kpi-angka">{k.v}</div>
          <div className="kpi-jejak">{k.j}</div>
        </div>
      ))}
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-head"><h2>Tren Nilai PO</h2><span className="hint">menurut bulan PO dibuat</span></div>
      <BatangWaktu data={tren} judul="Tren nilai PO per bulan" />
    </section>
    <div className="grid-dua">
      <section className="panel">
        <div className="panel-head"><h2>Komposisi PO</h2><span className="hint">seluruh PO, tahap saat ini</span></div>
        <Donat judul="Komposisi status PO"
          data={[...TAHAP_PO, ...TAHAP_PKS].map((s, i) =>
            ({ label: s.label, jumlah: [...jumlahPo, ...jumlahPks][i], warna: s.warna }))} />
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Komposisi PKS</h2><span className="hint">setelah PKS terbit</span></div>
        <Donat judul="Komposisi status PKS"
          data={TAHAP_PKS.map((s, i) => ({ label: s.label, jumlah: jumlahPks[i], warna: s.warna }))} />
      </section>
    </div>
    <section className="panel">
      <div className="panel-head"><h2>PKS Funnel</h2><span className="hint">berapa yang lolos ke tahap berikutnya</span></div>
      <AlurTahap tahap={corong} />
    </section>
    <section className="panel">
      <div className="panel-head"><h2>Lama Tiap Tahap</h2><span className="hint">median hari</span></div>
      <BatangPeringkat judul="Lama tiap tahap" satuan="hari" data={[
        { label: 'Dibuat → ditandatangani', nilai: 2.5, ket: '71 PO' },
        { label: 'Ditandatangani → terverifikasi', nilai: 9, ket: '64 PO' },
        { label: 'Terverifikasi → surat final', nilai: 3.5, ket: '46 PO' },
        { label: 'Surat final → PKS final', nilai: 1.5, ket: '23 PO' },
        { label: 'PKS final → bermeterai', nilai: 14, ket: '12 PO' },
      ]} />
    </section>
    <section className="panel">
      <div className="panel-head"><h2>Penolakan Verifikasi</h2><span className="hint">per fungsi</span></div>
      <BatangPeringkat judul="Penolakan per fungsi" data={[
        { label: 'Finance', nilai: 14, ket: 'dari 64 keputusan', warna: 'ditolak' },
        { label: 'Service Account', nilai: 6, ket: 'dari 64 keputusan', warna: 'ditolak' },
        { label: 'Tech Ops', nilai: 3, ket: 'dari 64 keputusan', warna: 'ditolak' },
        { label: 'Education', nilai: 1, ket: 'dari 64 keputusan', warna: 'ditolak' },
      ]} />
    </section>
    <div className="grid-dua">
      <section className="panel">
        <div className="panel-head"><h2>Sebaran Paket</h2><span className="hint">satu juring</span></div>
        <Donat judul="Sebaran paket"
          data={[{ label: 'LMS Juara', jumlah: 1, warna: PALET[0] }]} />
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Sebaran Jenjang</h2><span className="hint">tanpa warna, dan dengan nilai nol</span></div>
        <Donat judul="Sebaran jenjang" data={[
          { label: 'SD', jumlah: 3 },
          { label: 'SMP', jumlah: 0 },
          { label: 'SMA', jumlah: 1 },
        ]} />
      </section>
    </div>
    <section className="panel">
      <div className="panel-head"><h2>Komponen Terlaris</h2><span className="hint">delapan teratas</span></div>
      <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
        Menghitung berapa PO memilih tiap komponen, jadi satu PO bisa masuk ke beberapa
        juring sekaligus — angkanya bukan pembagian PO.
      </p>
      <Donat judul="Komponen terlaris" satuan="dipilih" data={[
        'Learning Management System', 'Bimbel Online — Modul', 'Bimbel Online — Video',
        'Latihan Soal', 'Asesmen Psikolog', 'Tryout', 'Live Class', 'Analisis SNBP',
      ].map((n, i) => ({ label: n, jumlah: [71, 64, 58, 52, 44, 39, 21, 12][i], warna: PALET[i % PALET.length] }))} />
    </section>
    <section className="panel">
      <div className="panel-head"><h2>Corong per Sales</h2><span className="hint">Prisma</span></div>
      <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
        Penyaring ini hanya mengubah corong di bawahnya, bukan panel lain di halaman ini.
      </p>
      <div className="status-baris">
        {['Semua', 'Prisma', 'Mekky', 'Cahyo', 'Fedri'].map((n) => (
          <a key={n} href="#" className="status-chip"
            aria-current={n === 'Prisma' ? 'true' : undefined}><span>{n}</span></a>
        ))}
      </div>
      <AlurTahap tahap={[
        { label: 'PO dibuat', jumlah: 24 }, { label: 'Ditandatangani', jumlah: 19 },
        { label: 'Masuk verifikasi', jumlah: 17 }, { label: 'Terverifikasi', jumlah: 11 },
        { label: 'PKS terbit', jumlah: 6 }, { label: 'PKS bermeterai', jumlah: 4 },
      ]} />
    </section>
    <section className="panel">
      <div className="panel-head"><h2>PKS Menggantung</h2><span className="hint">final tapi pindaiannya belum masuk</span></div>
      <BatangPeringkat judul="PKS menggantung" satuan="hari" data={[
        { label: 'SMA Muhammadiyah 2 Surakarta', nilai: 31, ket: 'Rp52 jt', warna: 'pks-terbit' },
        { label: 'SMKS PGRI 1 Surabaya', nilai: 12, ket: 'Rp75 jt', warna: 'pks-terbit' },
        { label: 'SMP Negeri 4 Mengwi', nilai: 4, ket: 'Rp180 jt', warna: 'pks-terbit' },
      ]} />
    </section>
    <section className="panel">
      <div className="panel-head"><h2>Proyeksi Penerimaan</h2><span className="hint">enam bulan ke depan</span></div>
      <BatangWaktu data={proyeksi} judul="Proyeksi penerimaan dari termin" />
    </section>
  </main>
);

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_dasbor-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Dasbor ${nama}</title><style>${css}</style><body>${isi}</body></html>`);
}
console.log('dua berkas pratinjau ditulis');
