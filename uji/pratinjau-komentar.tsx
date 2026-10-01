import React from 'react';
// Pemeriksaan manual komentar di lini masa.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-komentar.tsx
//   lalu buka _komentar-terang.html dan _komentar-gelap.html
//
// Halaman PO butuh sesi login, jadi potongan lini masanya dirender di sini dengan data
// contoh. Keadaan yang menentukan: komentar biasa milik sendiri, komentar basi,
// komentar disunting dengan versi lama, komentar dihapus, dan keputusan verifikasi yang
// terselip di antaranya.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import Menu from '../app/(sistem)/menu';
import { liniMasa } from '../lib/lini-masa';
import { KotakKomentar } from '../app/(sistem)/po/[id]/komentar';
import ButirLini from '../app/(sistem)/po/[id]/butir-lini';

const router = {
  push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const w = (m: number) => `2026-09-10T0${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:00.000Z`;
const saya = 'farid@skolla.education';

const peristiwa = liniMasa({
  riwayat: [
    { id: 1, status_lama: null, status_baru: 'draf', versi: 1, oleh: saya, pada: w(60) },
    { id: 2, status_lama: 'draf', status_baru: 'draf', versi: 2, oleh: saya, pada: w(130) },
    { id: 3, status_lama: 'ditandatangani', status_baru: 'verifikasi', versi: 2, oleh: saya, pada: w(140) },
  ],
  verifikasi: [
    { fungsi: 'finance', hasil: 'tolak', catatan: 'Termin kedua kurang Rp 2.000.000', oleh: 'yudi@skolla.education',
      waktu: w(100), berlaku: false, sebab_basi: 'Direvisi: termin berubah' },
    { fungsi: 'finance', hasil: 'setuju', catatan: null, oleh: 'yudi@skolla.education',
      waktu: w(170), berlaku: true, sebab_basi: null },
  ],
  komentar: [
    { id: 'a', isi: 'Termin kedua kurang, tolong dicek lagi ke bendahara ya.', oleh: 'yudi@skolla.education',
      waktu: w(101), versi_po: 1, disunting_pada: null, dihapus_pada: null, dihapus_oleh: null },
    { id: 'b', isi: 'Sudah saya perbaiki, bendahara konfirmasi via telepon.\nNominal sekarang pas.', oleh: saya,
      waktu: w(135), versi_po: 2, disunting_pada: w(138), dihapus_pada: null, dihapus_oleh: null,
      po_komentar_revisi: [{ isi: 'Sudah saya perbaiki.', digantikan_pada: w(138) }] },
    { id: 'c', isi: 'rahasia', oleh: saya, waktu: w(150), versi_po: 2,
      disunting_pada: null, dihapus_pada: w(152), dihapus_oleh: saya },
    { id: 'd', isi: 'Oke, lampu hijau dari Finance.', oleh: 'yudi@skolla.education',
      waktu: w(171), versi_po: 2, disunting_pada: null, dihapus_pada: null, dihapus_oleh: null },
    { id: 'b1', isi: 'Termin keduanya sudah saya perbaiki, mohon dicek lagi.',
      oleh: 'bintang@skolla.education', waktu: w(200), versi_po: 2,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: 'verifikasi:finance:' + w(100) },
    { id: 'b2', isi: 'Sudah betul. Saya cabut catatannya.', oleh: saya, waktu: w(210),
      versi_po: 2, disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: 'komentar:b1' },
    { id: 'b3', isi: 'Balasan ini menempel ke tanda tangan yang sudah dibatalkan.',
      oleh: saya, waktu: w(220), versi_po: 2,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: 'ttd:kepala_sekolah:2026-01-01T00:00:00.000Z' },
    // Utas DALAM, tujuh tingkat. Ada di sini supaya jorokan yang menjumlah ketahuan
    // mata, bukan cuma di kepala: versi pertama ButirLini mengalikan margin dengan
    // tingkatnya, dan karena margin pada <li> bersarang itu relatif, totalnya tumbuh
    // kuadratik sampai 396px — menggulir menyamping di layar 375px. Jangan dihapus:
    // tanpa utas sedalam ini, pratinjaunya hijau sementara ponselnya rusak.
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `d${i}`, isi: `Balasan tingkat ${i + 1}. Kalimatnya dibuat cukup panjang supaya kalau `
        + 'jorokannya menjumlah, luberannya benar-benar terlihat di layar sempit.',
      oleh: i % 2 ? saya : 'bintang@skolla.education', waktu: w(300 + i), versi_po: 2,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: i === 0 ? 'komentar:d' : `komentar:d${i - 1}`,
    })),
  ],
  versiPo: 2,
});

const lini = (
  <AppRouterContext.Provider value={router}>
    <section style={{ maxWidth: 820 }}>
      {/* Menu dengan lencana — di layout sungguhan ia di panel kiri. */}
      <PathnameContext.Provider value="/po">
        <div style={{ width: 260, marginBottom: 24 }} className="kotak">
          <Menu item={[
            { label: 'Dashboard', ke: '/beranda', ikon: 'dashboard', lencana: 3 },
            { label: 'Daftar PO (Pre-Order)', ke: '/po', ikon: 'po' },
          ]} />
        </div>
      </PathnameContext.Provider>

      {/* Daftar di Beranda — markup sama dengan beranda/page.tsx. */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head"><h2>PO dengan komentar belum Anda baca</h2>
          <span className="hint">3 komentar di 2 PO</span></div>
        <ul className="daftar-belum">
          <li><a href="#">PO-067</a><span>SMA Negeri 1 Cibadak</span>
            <span className="hitung-baru">2 baru</span><span className="muted">terakhir 10 Sep 2026, 09.51</span></li>
          <li><a href="#">PO-001</a><span>SMKS PGRI 1 Surabaya</span>
            <span className="hitung-baru">1 baru</span><span className="muted">terakhir 9 Sep 2026, 16.20</span></li>
        </ul>
      </section>

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Riwayat</h2>
      {/* Penanda "bolanya di siapa" — markup sama dengan po/[id]/page.tsx. */}
      <p className="komentar-bola">
        Komentar terakhir dari <strong>Yudi Pratama</strong> (Finance), 10 Sep 2026, 09.51.{' '}
        <span className="muted">Ini penanda siapa yang terakhir bicara, bukan penugasan.</span>
      </p>
      <KotakKomentar poId="x" />
      <ol className="lini-masa">
        {peristiwa.map((e) => (
          <ButirLini key={e.kunci} e={e} tingkat={0} ctx={{
            poId: 'x', saya, bolehTulis: true, baru: (x) => x.komentar?.id === 'b1',
          }} />
        ))}
      </ol>
    </section>
  </AppRouterContext.Provider>
);

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_komentar-${nama}.html`,
    // <meta viewport> WAJIB. Tanpa itu emulasi ponsel tidak berlaku: innerWidth tetap
    // ~980px, halaman tampak muat, dan luberan yang sedang dicari tidak pernah muncul.
    // Sudah menggigit saat pratinjau wizard (14 Sep 2026).
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Komentar ${nama}</title><style>${css}</style>`
    + `<body><main style="padding:24px">${renderToStaticMarkup(lini)}</main></body></html>`);
}
console.log('dua berkas pratinjau ditulis');
