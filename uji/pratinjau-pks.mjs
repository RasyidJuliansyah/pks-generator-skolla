// Perkakas pemeriksaan manual untuk paginasi PKS.
//
// Paginasi bergantung pada pengukuran tata letak sungguhan, jadi tidak bisa
// diuji tanpa peramban: jsdom tidak menghitung tinggi apa pun. Berkas ini
// menghasilkan halaman uji berisi PKS terberat yang masuk akal — banyak
// komponen dan 12 termin — lengkap dengan kop tersisip, lalu paginasinya
// dijalankan dari konsol peramban:
//
//   node uji/pratinjau-pks.mjs && buka _pratinjau-pks.html
//   > await document.fonts.ready
//   > paginasiPks(document.getElementById('ukur'), 242*(96/25.4))
//
// Yang harus benar: isi hasil sama persis dengan sumber, sumber tidak berubah,
// dua kali jalan memberi hasil sama, dan tidak ada halaman yang meluber.
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { muat } from './muat.mjs';
const P = muat('dokumen-pks');
const D = muat('dokumen-dari-po');
const { PRESET } = muat('pricelist');
const juara = PRESET.find((p) => p.n === 'LMS Juara');

// Kasus berat: banyak komponen dan 12 termin, supaya pemecahan pasal teruji.
const banyakTermin = Array.from({ length: 12 }, (_, i) => ({
  urutan: i + 1, tanggal: `2026-${String((i % 12) + 1).padStart(2, '0')}-28`, nominal: 6_250_000,
}));
const po = {
  sekolah: { nama: 'SMKS PGRI 1 SURABAYA', jenjang: 'SMA',
    alamat: 'Jl. Jemursari VIII No.120, Jemur Wonosari, Kec. Wonocolo, Surabaya, Jawa Timur 60237',
    telepon: '0812-3267-7561', kepala_sekolah: 'KUSTIONO, S.T., M.M.' },
  jumlah_siswa: 914, jumlah_guru: 24, grand_total: 75_000_000,
  masa_mulai: '2026-09-01', masa_selesai: '2027-08-31',
  po_komponen: [...juara.ids.map((id) => ({ komponen_id: id, sesi: 1 })),
                { komponen_id: 'guruOff', sesi: 3 }, { komponen_id: 'pmOn', sesi: 8 }],
  po_rombel: [{ kelas: 10, rombel: 'A', jumlah_siswa: 300 },
              { kelas: 11, rombel: 'A', jumlah_siswa: 307 },
              { kelas: 12, rombel: 'A', jumlah_siswa: 307 }],
  po_termin: banyakTermin,
};
const html = P.dokumenPks(D.dataPksDariPo(po, '/EXTSKOLLA/PKS/VIII/2026'));
const css = readFileSync('app/globals.css', 'utf8');
const paginasiJs = ts.transpileModule(readFileSync('lib/paginasi-pks.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
// Halaman uji dirender sebagai dokumen data:, yang tidak boleh memuat berkas
// lokal — kopnya harus ikut tersisip.
const kop = readFileSync('public/kop-pks.png').toString('base64');

writeFileSync('_pratinjau-pks.html', `<!doctype html><meta charset=utf-8><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uji Paginasi PKS</title>
<style>${css.replace("url('/kop-pks.png')", `url('data:image/png;base64,${kop}')`)}</style>
<body>
<div id="ukur" class="pks-ukur pks">${html}</div>
<div id="keluar" class="pks-dokumen"></div>
<script>
${paginasiJs}
window.paginasiPks = paginasiPks;
</script>`);
console.log('halaman diukur di peramban; termin:', banyakTermin.length);
