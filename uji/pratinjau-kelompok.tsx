import React from 'react';
// Pemeriksaan manual form PO berkelompok.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-kelompok.tsx
//   node uji/tangkap-layar.mjs _kelompok-satu-terang.html _kelompok-banyak-terang.html ...
//
// Dua keadaan: PO satu kelompok (harus terlihat persis seperti sebelum kelompok ada,
// ditambah panel "Kelompok Siswa") dan PO tiga kelompok (Santamaria, pricelist 4.0).
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import FormPo from '../app/(sistem)/po/baru/form-po';
import { komponenUntuk, presetUntuk, NAMA_TIER } from '../lib/pricelist';
import type { IsiPo } from '../lib/po-aksi';

const router = {
  push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const komponen = komponenUntuk(false);
const preset = presetUntuk(false);
const P = (n: string) => preset.find((p) => p.n === n)!.ids;
const sekolah = { nama: 'SMA SANTAMARIA MONICA', npsn: '20200001', jenjang: 'SMA' as const,
  kepala_sekolah: 'Dra. Maria Uji', kepsek_hp: '0800', bendahara: 'Budi', bendahara_hp: '0801' };
const dasar: Omit<IsiPo, 'komponen' | 'rombel'> = {
  id: 'x', sekolah, jumlahSiswa: 300, jumlahGuru: 20, hargaSiswa: 350000, hargaGuru: 150000,
  masaMulai: '2026-09-01', masaSelesai: '2027-08-31', sumberDana: 'BOS', kota: 'Bekasi',
  tanggalTtd: '2026-09-12', namaPm: 'Agung Uji', namaSm: 'Zhurry Uji', jumlahRombel: 2,
  termin: [{ urutan: 1, tanggal: '2026-09-15', nominal: 0 }], catatan: [], asal: 'platform',
};
const satu: IsiPo = { ...dasar,
  komponen: [...P('LMS Juara').map((id) => ({ id, sesi: 1 })), { id: 'guruOff', sesi: 2 }],
  rombel: [10, 11, 12].map((k) => ({ kelas: k, rombel: 'A', jumlah: 100 })) };
const banyak: IsiPo = { ...dasar, hargaSiswa: 0,
  komponen: [...[...P('LMS Smart'), 'asesmen'].map((id) => ({ id, sesi: 1, kelompok: 1 })),
             ...P('LMS Smart').map((id) => ({ id, sesi: 1, kelompok: 2 })),
             ...P('LMS Juara').map((id) => ({ id, sesi: 1, kelompok: 3 })),
             { id: 'guruOff', sesi: 2, kelompok: 1 }],
  rombel: [10, 11, 12].map((k, i) => ({ kelas: k, rombel: 'A', jumlah: 100, kelompok: i + 1 })),
  kelompok: [{ nomor: 1, hargaSiswa: 279000 }, { nomor: 2, nama: 'Kelas 11', hargaSiswa: 240000 },
             { nomor: 3, nama: 'Kelas 12 (TKA)', hargaSiswa: 350000 }] };

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, awal] of [['satu', satu], ['banyak', banyak]] as const) {
  const isi = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <FormPo komponen={komponen} preset={preset} namaTier={NAMA_TIER.slice(0, 2) as unknown as string[]}
        awal={awal} akunPm={[{ email: 'a@x', nama: 'Agung Uji' }]} akunSm={[{ email: 'z@x', nama: 'Zhurry Uji' }]} />
    </AppRouterContext.Provider>);
  for (const [t, tema] of [['terang', 'light'], ['gelap', 'dark']] as const)
    writeFileSync(`_kelompok-${nama}-${t}.html`,
      `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${nama}</title>`
      + `<style>${css}</style><body><main class="wrap" style="max-width:1280px">${isi}</main></body></html>`);
}
console.log('empat berkas pratinjau ditulis');
