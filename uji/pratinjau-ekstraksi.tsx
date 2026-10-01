// Pratinjau statis bagian BARU ekstraksi scan (catatan/25), di luar sesi login.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-ekstraksi.tsx
//
// Kenapa komponennya dirender LANGSUNG, bukan lewat FormPo seperti pratinjau-wizard: keadaan
// "scan sudah dibaca" dan "berkas pindaian sudah dipilih" keduanya hidup sebagai STATE di dalam
// useFormPo (dan pindaian itu `File`), jadi tidak ada prop yang bisa mengisinya dari luar. Menambah
// prop khusus pratinjau ke kode produksi berarti menambah jalan masuk yang tidak dipakai aplikasi
// hanya supaya tata letaknya bisa dipotret -- sedangkan merender komponennya langsung dengan `f`
// tiruan memberi potret yang sama atas MARKAH yang sesungguhnya dipakai.
import React from 'react';
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import BacaScan from '../app/(sistem)/po/baru/baca-scan';

const css = readFileSync('app/globals.css', 'utf8');
const berkas = new File([new Uint8Array(1024)], 'form-po-sekolah.pdf', { type: 'application/pdf' });

/** `f` tiruan: hanya bidang yang dibaca kedua komponen ini. */
const dasar = {
  gerbangEkstraksi: true,
  pindaian: berkas,
  pemberitahuanAi: false,
  setPemberitahuanAi() {},
  pasangEkstraksi() {},
};

const KASUS = {
  // Tombol harus MATI selama centang pemberitahuan belum dicentang.
  'scan-belum-dicentang': dasar,
  'scan-siap': { ...dasar, pemberitahuanAi: true },
  // Gerbang mati: kotaknya tidak boleh muncul sama sekali.
  'scan-gerbang-mati': { ...dasar, gerbangEkstraksi: false },
};

for (const [nama, f] of Object.entries(KASUS)) {
  const isi = renderToStaticMarkup(
    <BacaScan f={f as unknown as React.ComponentProps<typeof BacaScan>['f']} />);
  for (const [t, tema] of [['terang', 'light'], ['gelap', 'dark']] as const)
    writeFileSync(`_ekstraksi-${nama}-${t}.html`,
      `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8">`
      + `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${nama}</title>`
      + `<style>${css}</style><body><main class="wrap">${isi}</main></body></html>`);
}
console.log(`${Object.keys(KASUS).length * 2} berkas pratinjau ditulis`);
