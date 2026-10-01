import React from 'react';
// Pratinjau Form PO (wizard, catatan/11). Juga penjaga Tugas 3 rencana: HTML sebelum
// dan sesudah state dipindah ke hook harus identik.
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-wizard.tsx [langkah]
//   node uji/tangkap-layar.mjs _wizard-*.html
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
  id: 'x', sekolah, jumlahSiswa: 300, jumlahGuru: 20, hargaSiswa: 350000, hargaGuru: 170000,
  masaMulai: '2026-09-01', masaSelesai: '2027-08-31', sumberDana: 'BOS', kota: 'Bekasi',
  tanggalTtd: '2026-09-12', namaPm: 'Agung Uji', namaSm: 'Zhurry Uji', jumlahRombel: 2,
  termin: [{ urutan: 1, tanggal: '2026-09-15', nominal: 0 }], catatan: [], asal: 'platform',
};
const KASUS: Record<string, (IsiPo & { skemaTtd?: 3 | 4 }) | undefined> = {
  baru: undefined,
  satu: { ...dasar,
    komponen: [...P('LMS Juara').map((id) => ({ id, sesi: 1 })), { id: 'guruOff', sesi: 2 }],
    rombel: [10, 11, 12].map((k) => ({ kelas: k, rombel: 'A', jumlah: 100 })) },
  banyak: { ...dasar, hargaSiswa: 0,
    komponen: [...[...P('LMS Smart'), 'asesmen'].map((id) => ({ id, sesi: 1, kelompok: 1 })),
               ...P('LMS Smart').map((id) => ({ id, sesi: 1, kelompok: 2 })),
               ...P('LMS Juara').map((id) => ({ id, sesi: 1, kelompok: 3 })),
               { id: 'guruOff', sesi: 2, kelompok: 1 }],
    rombel: [10, 11, 12].map((k, i) => ({ kelas: k, rombel: 'A', jumlah: 100, kelompok: i + 1 })),
    kelompok: [{ nomor: 1, hargaSiswa: 279000 }, { nomor: 2, nama: 'Kelas 11', hargaSiswa: 240000 },
               { nomor: 3, nama: 'Kelas 12 (TKA)', hargaSiswa: 350000 }] },
  // Empat penanda tangan (catatan/23). Kasus lain tanpa skemaTtd = draf lama skema 3.
  empat: { ...dasar, skemaTtd: 4, namaRh: 'RH Uji',
    komponen: P('LMS Juara').map((id) => ({ id, sesi: 1 })),
    rombel: [10, 11, 12].map((k) => ({ kelas: k, rombel: 'A', jumlah: 100 })) },
  'empat-tanpa-akun-rh': { ...dasar, skemaTtd: 4,
    komponen: P('LMS Juara').map((id) => ({ id, sesi: 1 })),
    rombel: [10, 11, 12].map((k) => ({ kelas: k, rombel: 'A', jumlah: 100 })) },
  unggahan: { ...dasar, asal: 'unggahan',
    komponen: P('LMS Smart').map((id) => ({ id, sesi: 1 })),
    rombel: [10, 11, 12].map((k) => ({ kelas: k, rombel: 'A', jumlah: 100 })) },
};

const mulaiDi = process.argv[2];
const css = readFileSync('app/globals.css', 'utf8');

// Hasil baca scan REKAAN untuk pratinjau keadaan "sudah dibaca AI" (catatan/25 Tugas 8):
// sekolah fiktif, nomor palsu, satu isian tidak terbaca, satu ditandai ragu. Tanpa data asli.
const HASIL_AI = {
  sekolah: { nama: 'SMA CONTOH UJI', npsn: '99990001', jenjang: 'SMA', alamat: 'Jl. Contoh No. 1',
    kepala_sekolah: 'Budi Contoh', kepsek_hp: '0800000001', bendahara: 'Sari Contoh', bendahara_hp: '0800000002' },
  kotak_paket: ['LMS Juara'], kotak_lain: [], custom_teks: null,
  harga_siswa: 350000, harga_guru: 170000,
  rombel: [{ kelas: 'X', rombel: 'A', jumlah: 100 }, { kelas: 'XI', rombel: 'A', jumlah: 100 },
           { kelas: 'XII', rombel: 'A', jumlah: 100 }],
  termin: [{ tanggal: '2026-09-15', nominal: 0 }],
  masa_mulai: '2026-09-01', masa_selesai: '2027-08-31', sumber_dana: 'BOS', kota: 'Bekasi',
  tanggal_ttd: '2026-09-12', catatan: ['Pelaksanaan mulai semester ganjil'],
  ragu: ['sekolah.bendahara_hp'], tidak_terbaca: ['sekolah.email'],
  peringatan: ['Tabel termin tidak rapi: kolom tanggal dan nominal tidak sejajar'],
};
const EKSTRAKSI: Record<string, { klaimId: string; hasil: unknown }> = {
  'scan-ai': { klaimId: '00000000-0000-0000-0000-0000000000aa', hasil: HASIL_AI },
  // Kotak paket ambigu: tidak ada komponen yang diisi, dan alasannya harus terbaca di langkah 2.
  'scan-ai-paket-ambigu': { klaimId: '00000000-0000-0000-0000-0000000000ab',
    hasil: { ...HASIL_AI, kotak_paket: ['LMS Juara', 'LMS Lite'], peringatan: [] } },
};
// Isian yang sama seperti yang tersimpan sesudah draf hasil ekstraksi disimpan dan dibuka lagi;
// yang TIDAK bisa datang dari sini adalah penanda konfirmasinya, dan itulah yang disemai
// `ekstraksiPratinjau` (sisa kunci + catatan tanpa jenis).
for (const nama of Object.keys(EKSTRAKSI)) {
  KASUS[nama] = { ...dasar, ...(nama.endsWith('paket-ambigu') ? { hargaSiswa: 0 } : {}),
    komponen: P('LMS Juara').map((id) => ({ id, sesi: 1 })),
    rombel: [10, 11, 12].map((k) => ({ kelas: k, rombel: 'A', jumlah: 100 })) };
}

for (const [nama, awal] of Object.entries(KASUS)) {
  const props = { komponen, preset, namaTier: NAMA_TIER.slice(0, 2) as unknown as string[], awal,
    akunPm: [{ email: 'a@x', nama: 'Agung Uji' }], akunSm: [{ email: 'z@x', nama: 'Zhurry Uji' }],
    akunRh: nama === 'empat-tanpa-akun-rh' ? [] : [{ email: 'r@x', nama: 'RH Uji' }],
    gerbangEkstraksi: !!EKSTRAKSI[nama],
    ...(mulaiDi ? { mulaiDi } : {}) } as React.ComponentProps<typeof FormPo>;
  const isi = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}><FormPo {...props} /></AppRouterContext.Provider>);
  const akhiran = mulaiDi ? `${mulaiDi}-${nama}` : nama;
  for (const [t, tema] of [['terang', 'light'], ['gelap', 'dark']] as const)
    writeFileSync(`_wizard-${akhiran}-${t}.html`,
      `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${akhiran}</title>`
      + `<style>${css}</style><body><main class="wrap">${isi}</main></body></html>`);
}

// Pratinjau kedua: keadaan SESUDAH scan dibaca. Keadaan itu hidup sebagai state di dalam
// useFormPo, jadi satu-satunya jalan menyemainya adalah prop pratinjau
// (`ekstraksiPratinjau`, pola yang sama dengan `mulaiDi`).
for (const [nama, ekstraksi] of Object.entries(EKSTRAKSI)) {
  for (const langkah of ['sekolah', 'paket', 'rombel', 'termin', 'penanda', 'tinjau'] as const) {
    const props = { komponen, preset, namaTier: NAMA_TIER.slice(0, 2) as unknown as string[],
      // Isian yang sudah tersimpan (bentuk draf yang dibuka lagi) PLUS penanda konfirmasinya.
      awal: KASUS[nama],
      akunPm: [{ email: 'a@x', nama: 'Agung Uji' }], akunSm: [{ email: 'z@x', nama: 'Zhurry Uji' }],
      akunRh: [{ email: 'r@x', nama: 'RH Uji' }],
      gerbangEkstraksi: true, ekstraksiPratinjau: ekstraksi, mulaiDi: langkah } as React.ComponentProps<typeof FormPo>;
    const isi = renderToStaticMarkup(
      <AppRouterContext.Provider value={router}><FormPo {...props} /></AppRouterContext.Provider>);
    for (const [t, tema] of [['terang', 'light'], ['gelap', 'dark']] as const)
      writeFileSync(`_ekstraksi-${nama}-${langkah}-${t}.html`,
        `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${nama}-${langkah}</title>`
        + `<style>${css}</style><body><main class="wrap">${isi}</main></body></html>`);
  }
}
console.log(`${Object.keys(KASUS).length * 2 + Object.keys(EKSTRAKSI).length * 6 * 2} berkas pratinjau ditulis`);
