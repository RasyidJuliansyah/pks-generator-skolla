import React from 'react';
// Pemeriksaan manual daftar berkas jatuh tempo.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-retensi.tsx
//
// Halaman sungguhannya hanya untuk Super Admin dan butuh sesi, jadi daftarnya dirender
// di sini dengan data contoh. Yang diperiksa: keadaan kosong tidak terlihat seperti
// kegagalan, dan tiap baris menyebut PO, jenis, jatuh tempo, serta jalurnya.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import DaftarRetensi from '../app/(sistem)/retensi/daftar-retensi';
import type { BerkasJatuhTempo } from '../lib/retensi';

const router = {
  push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const contoh: BerkasJatuhTempo[] = [
  { po_id: 'a', nomor: 1, sekolah: 'SMA Negeri 1 Cibadak', jenis: 'Tanda tangan PO',
    bucket: 'tanda-tangan', jalur: 'a/kepala_sekolah.png', jatuh_tempo: '2026-08-01' },
  { po_id: 'a', nomor: 1, sekolah: 'SMA Negeri 1 Cibadak', jenis: 'Tanda tangan Surat Verifikasi',
    bucket: 'tanda-tangan', jalur: 'surat/a.png', jatuh_tempo: '2026-08-01' },
  { po_id: 'b', nomor: 67, sekolah: 'SMA Santamaria Monica', jenis: 'Tanda tangan PO',
    bucket: 'tanda-tangan', jalur: 'b/sales_manager.png', jatuh_tempo: '2026-09-05' },
];

const blok = ([['A', 'Ada berkas jatuh tempo', contoh], ['B', 'Tidak ada — jangan terlihat seperti gagal', []]] as
  [string, string, BerkasJatuhTempo[]][]).map(([kode, judul, d]) => (
  <section key={kode} style={{ marginBottom: 40 }}>
    <h2 style={{ font: '700 15px/1.4 system-ui', margin: '0 0 4px' }}>Keadaan {kode}</h2>
    <p style={{ font: '13px/1.5 system-ui', margin: '0 0 12px', opacity: 0.75 }}>{judul}</p>
    <AppRouterContext.Provider value={router}>
      <DaftarRetensi daftar={d} />
    </AppRouterContext.Provider>
  </section>
));

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_retensi-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Retensi ${nama}</title><style>${css}</style>`
    + `<body><main style="padding:24px">${renderToStaticMarkup(<>{blok}</>)}</main></body></html>`);
}
console.log('dua berkas pratinjau ditulis');
