import React from 'react';
// Perkakas pemeriksaan manual untuk DUA MEKANISME HARGA di form PO.
//
// Form sungguhannya butuh sesi login, jadi komponennya dirender di sini dengan
// data contoh — tiga skenario yang menentukan, dua tema:
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-mode-harga.tsx
//   node uji/tangkap-layar.mjs _mode-harga-terang.html _mode-harga-gelap.html
//
// Ada sebabnya: perpindahan paket <-> a la carte punya tebing yang terasa seperti
// bug (melepas satu komponen murah menaikkan lantai puluhan ribu). Kalimat yang
// menjelaskannya harus benar-benar DILIHAT, bukan dibayangkan — dan angka yang
// tercetak di panel tier harus benar-benar cocok dengan yang dihitung.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import FormPo from '../app/(sistem)/po/baru/form-po';
import { komponenUntuk, presetUntuk, PRESET, NAMA_TIER } from '../lib/pricelist';
import type { IsiPo } from '../lib/po-aksi';

const router = {
  push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const sekolah: IsiPo['sekolah'] = { nama: 'SMA Negeri 1 Cibadak', npsn: '20203344', jenjang: 'SMA' };

const isi = (ids: string[]): IsiPo => ({
  sekolah, komponen: ids.map((id) => ({ id, sesi: 1 })),
  jumlahSiswa: 300, jumlahGuru: 0, hargaSiswa: 0, hargaGuru: 0, termin: [],
});

const juara = PRESET.find((p) => p.n === 'LMS Juara')!.ids;

const skenario: [string, string, IsiPo][] = [
  ['A', 'LMS Juara lengkap — harus berharga PAKET', isi(juara)],
  ['B', 'LMS Juara minus Analisis SNBP — harus A LA CARTE, dan menyebut tebingnya',
    isi(juara.filter((id) => id !== 'snbp'))],
  ['C', 'Racikan bebas LMS + Video + Live — a la carte, tanpa ajakan',
    isi(['lms', 'video', 'live'])],
  ['E', 'Bimbel UTBK/TKA Lite — satu-satunya paket yang benar-benar lebih murah, '
      + 'penghematannya harus disebut',
    isi(PRESET.find((p) => p.n === 'Bimbel UTBK/TKA Lite')!.ids)],
];

// F: PO baru tanpa `awal` — satu-satunya keadaan yang memunculkan pemilih jalur.
// G: PO unggahan tanpa pindaian — penghalang simpannya harus menyebutkan itu.
const unggahan: IsiPo = { ...isi(juara), asal: 'unggahan' };

// Skenario D memakai peran SALES: acquisition harus hilang, komponen maupun paket.
const sales: [string, string, IsiPo] =
  ['D', 'LMS Juara lengkap, dilihat peran Sales — Acquisition tidak boleh muncul', isi(juara)];

const tambahan: [string, string, IsiPo | undefined][] = [
  ['F', 'PO baru — pemilih "Buat di platform / Unggah PO" harus muncul', undefined],
  ['G', 'PO unggahan tanpa pindaian — harus terhalang, dan alasannya disebut', unggahan],
];

const blok = ([...skenario, sales, ...tambahan] as [string, string, IsiPo | undefined][])
  .map(([kode, judul, awal]) => (
  <section key={kode} style={{ marginBottom: 48 }}>
    <h2 style={{ font: '700 15px/1.4 system-ui', margin: '0 0 4px' }}>Skenario {kode}</h2>
    <p style={{ font: '13px/1.5 system-ui', margin: '0 0 12px', opacity: 0.75 }}>{judul}</p>
    <AppRouterContext.Provider value={router}>
      <FormPo
        komponen={komponenUntuk(kode !== 'D')}
        preset={presetUntuk(kode !== 'D')}
        namaTier={NAMA_TIER.slice(0, kode === 'D' ? 2 : 3) as unknown as string[]}
        awal={awal}
        akunPm={[{ email: 'bintang@skolla.education', nama: 'Bintang' }]}
        akunSm={[{ email: 'agung@skolla.education', nama: 'Agung' }]}
      />
    </AppRouterContext.Provider>
  </section>
));

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_mode-harga-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Mode harga ${nama}</title><style>${css}</style>`
    + `<body><main style="padding:24px">${renderToStaticMarkup(<>{blok}</>)}</main></body></html>`);
}
console.log('dua berkas pratinjau ditulis');
