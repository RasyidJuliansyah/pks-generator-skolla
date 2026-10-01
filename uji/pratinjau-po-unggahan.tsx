import React from 'react';
// Pemeriksaan manual panel PO unggahan.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-po-unggahan.tsx
//   lalu buka _unggahan-terang.html dan _unggahan-gelap.html
//
// Halaman sungguhannya butuh sesi login, jadi panelnya dirender di sini dengan data
// contoh. Tiga keadaan yang menentukan: pindaian belum ada, sudah ada tapi belum
// dinyatakan sesuai, dan sudah lengkap sehingga bisa diajukan.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import PanelUnggahan from '../app/(sistem)/po/[id]/panel-unggahan';
import PanelVerifikasi from '../app/(sistem)/po/[id]/panel-verifikasi';

const router = {
  push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const keadaan: [string, string, React.ComponentProps<typeof PanelUnggahan>][] = [
  ['A', 'Pindaian belum terunggah — tidak boleh ada tombol ajukan',
    { poId: 'x', status: 'draf', berkas: null, ditinjauOleh: null, ditinjauPada: null, bisaAjukan: true }],
  ['B', 'Pindaian ada, belum dinyatakan sesuai',
    { poId: 'x', status: 'draf', berkas: 'x/po.pdf', ditinjauOleh: null, ditinjauPada: null, bisaAjukan: true }],
  ['C', 'Lengkap — siap diajukan',
    { poId: 'x', status: 'draf', berkas: 'x/po.pdf', ditinjauOleh: 'farid@skolla.education',
      ditinjauPada: '2026-09-09T04:20:00.000Z', bisaAjukan: true }],
  ['D', 'Sudah diajukan — tombol ajukan harus hilang',
    { poId: 'x', status: 'ditandatangani', berkas: 'x/po.pdf', ditinjauOleh: 'farid@skolla.education',
      ditinjauPada: '2026-09-09T04:20:00.000Z', bisaAjukan: true }],
];

const blok = keadaan.map(([kode, judul, props]) => (
  <section key={kode} style={{ marginBottom: 40 }}>
    <h2 style={{ font: '700 15px/1.4 system-ui', margin: '0 0 4px' }}>Keadaan {kode}</h2>
    <p style={{ font: '13px/1.5 system-ui', margin: '0 0 12px', opacity: 0.75 }}>{judul}</p>
    <AppRouterContext.Provider value={router}>
      <PanelUnggahan {...props} />
    </AppRouterContext.Provider>
  </section>
));

// Panel verifikasi: yang diperiksa di sini adalah apakah verifikator diberi tahu bahwa
// PO ini unggahan, DAN diberi jalan membuka kertasnya. Tanpa itu ia menilai angka tanpa
// pernah bisa melihat sumbernya.
const verifikasi = (
  <>
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ font: '700 15px/1.4 system-ui', margin: '0 0 4px' }}>Keadaan E</h2>
      <p style={{ font: '13px/1.5 system-ui', margin: '0 0 12px', opacity: 0.75 }}>
        Verifikasi PO UNGGAHAN — harus menyebut asalnya dan menyediakan tautan pindaian
      </p>
      <AppRouterContext.Provider value={router}>
        <PanelVerifikasi poId="x" status="verifikasi" keputusan={[]} fungsiSaya={['finance']}
          adalahLead={false} milikSaya={false} berkasUnggahan="x/po.pdf" />
      </AppRouterContext.Provider>
    </section>
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ font: '700 15px/1.4 system-ui', margin: '0 0 4px' }}>Keadaan F</h2>
      <p style={{ font: '13px/1.5 system-ui', margin: '0 0 12px', opacity: 0.75 }}>
        Verifikasi PO PLATFORM — tidak boleh ada keterangan pindaian sama sekali
      </p>
      <AppRouterContext.Provider value={router}>
        <PanelVerifikasi poId="x" status="verifikasi" keputusan={[]} fungsiSaya={['finance']}
          adalahLead={false} milikSaya={false} berkasUnggahan={null} />
      </AppRouterContext.Provider>
    </section>
  </>
);

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_unggahan-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>PO unggahan ${nama}</title><style>${css}</style>`
    + `<body><main style="padding:24px">${renderToStaticMarkup(<>{blok}{verifikasi}</>)}</main></body></html>`);
}
console.log('dua berkas pratinjau ditulis');
