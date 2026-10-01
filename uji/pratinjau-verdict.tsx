import React from 'react';
// Pratinjau kartu verdict IoM di panel verifikasi (catatan/16 Tugas 5), dua tema.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-verdict.tsx
//
// Sejak 22 Sep 2026 (catatan/13a Bagian 11) penutupan dikerjakan basis data sendiri, jadi
// kasus "menunggu penutupan HoO" dan "tertahan karena deklarasi" sudah tidak ada. Yang perlu
// terlihat sekarang: PO yang sudah ditutup otomatis (tanpa tindakan), verdict yang gagal,
// verdict basi, dan keadaan darurat verdict lolos yang toh berhenti di `verifikasi`.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import PanelVerifikasi from '../app/(sistem)/po/[id]/panel-verifikasi';
import { VERSI_IOM } from '../lib/iom';
import type { BarisVerdict } from '../lib/verdict-iom';

const router = {
  push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const lolos: BarisVerdict = {
  lolos: true, gagal: [], hasil: [], paket: 'LMS Smart', versi_po: 1,
  versi_iom: VERSI_IOM, dicatat_pada: '2026-09-22T07:00:00+00:00',
};
const gagal: BarisVerdict = {
  ...lolos, lolos: false, paket: null,
  gagal: ['sekolah-lengkap', 'tanpa-diskon', 'sponsorship-dalam-batas'],
  hasil: [
    { kode: 'sekolah-terisi', lolos: true, bukti: 'SMA Contoh' },
    { kode: 'sekolah-lengkap', lolos: false, bukti: 'kosong: bendahara, bendahara_hp' },
    { kode: 'tanpa-diskon', lolos: false, bukti: 'harga 230000, price list 240000' },
    { kode: 'sponsorship-dalam-batas', lolos: false, bukti: 'Rp 50.000.000 dari Rp 120.000.000 (41,7%)' },
  ],
};

type Kasus = { verdict: BarisVerdict; versiPo: number; status: string; keputusan?: unknown[] };
const KASUS: Record<string, Kasus> = {
  // Sudah ditutup sistem: kartunya menjelaskan, tidak menawarkan tindakan apa pun.
  'lolos-otomatis': { verdict: lolos, versiPo: 1, status: 'terverifikasi' },
  gagal: { verdict: gagal, versiPo: 1, status: 'verifikasi' },
  basi: { verdict: lolos, versiPo: 2, status: 'verifikasi' },
  // Verdict lolos tetapi toh berhenti di `verifikasi` -- penutupan otomatisnya gagal. Panel
  // harus menyebutnya butuh keempat fungsi, bukan menjanjikan penutupan yang tak ada lagi.
  'tertolak-fungsi': {
    verdict: lolos, versiPo: 1, status: 'verifikasi',
    keputusan: [{
      fungsi: 'finance', hasil: 'tolak', catatan: 'Termin tidak cocok.', item: {},
      oleh: 'finance@skolla.education', waktu: '2026-09-22T08:00:00+00:00',
      berlaku: true, versi_po: 1, sebab_basi: null,
    }],
  },
};

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, k] of Object.entries(KASUS)) {
  const isi = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PanelVerifikasi poId="pratinjau" status={k.status} keputusan={(k.keputusan ?? []) as any}
        fungsiSaya={[]} adalahLead={false} milikSaya={false}
        verdict={k.verdict} versiPo={k.versiPo} />
    </AppRouterContext.Provider>);
  for (const [t, tema] of [['terang', 'light'], ['gelap', 'dark']] as const)
    writeFileSync(`_verdict-${nama}-${t}.html`,
      `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8">`
      + `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${nama}</title>`
      + `<style>${css}</style><body><main class="wrap">${isi}</main></body></html>`);
}
console.log(`${Object.keys(KASUS).length * 2} berkas pratinjau ditulis`);
