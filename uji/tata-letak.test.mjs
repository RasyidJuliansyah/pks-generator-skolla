// Butir kisi harus boleh menyusut, dan isi yang memang lebih lebar dari layar
// harus menggulir di dalam kotaknya sendiri.
//
// Pernah menggigit (dilaporkan dari ponsel, 1 Sep 2026): butir kisi memakai
// min-width:auto, artinya lantai lebarnya mengikuti isi TERLEBAR. Tabel rombel
// 543px menaikkan lantai itu di atas lebar ponsel, jadi SELURUH halaman
// tergulir menyamping — dan .bar-ponsel yang position:sticky berhenti di 70%
// lebar layar, karena sticky mengikuti viewport, bukan lebar gulir dokumen.
// overflow-x:auto di .kisi-rombel tidak menolong selama wadahnya tidak pernah
// diizinkan menyusut. Dua syarat itu yang dijaga di sini; keduanya perlu.
//
// ponytail: pemeriksaan statis atas aturan CSS-nya, BUKAN pengukuran tata letak
// sungguhan. Mengukur lebar betulan perlu Chrome, sedangkan `npm run periksa`
// harus tetap jalan di mesin tanpa Chrome. Kalau nanti ada CI ber-Chrome,
// ganti dengan memuat halaman di 375px dan menuntut
// scrollWidth === clientWidth — itu menguji akibatnya, bukan ejaannya.
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const rapat = css.replace(/\s+/g, '');

// 1. Butir kisi boleh menyusut.
const kisi = [
  ['.grid-po', '.grid-po>*{min-width:0}'],
  ['.kerangka', '.isi{min-width:0'],
];
for (const [nama, aturan] of kisi) {
  assert.ok(rapat.includes(aturan),
    `butir ${nama} harus boleh menyusut — aturan hilang: ${aturan}`);
  console.log(`  OK  butir ${nama} boleh menyusut`);
}

// 2. Wadah yang isinya sengaja melebihi layar menggulir sendiri.
for (const kelas of ['kisi-rombel', 'po-dokumen', 'pks-dokumen']) {
  assert.match(rapat, new RegExp(`\\.${kelas}\\{[^}]*overflow-x:auto`),
    `.${kelas} harus overflow-x:auto supaya isinya tidak mendorong halaman`);
  console.log(`  OK  .${kelas} menggulir isinya sendiri`);
}

// 3. Jorokan balasan tidak boleh dikali tingkatnya.
//
// Margin pada <li> bersarang itu RELATIF terhadap induknya, jadi ia menjumlah sendiri.
// Mengalikannya dengan tingkat membuat totalnya tumbuh kuadratik, dan pagar INDENT_MAKS
// tidak menolong — ia cuma membuat PERTAMBAHANNYA tetap, bukan menghentikannya.
//
// Diukur di peramban pada 375px, 21 Sep 2026, utas tujuh tingkat:
//   dikali tingkat -> meluber 307px, balasan terdalam mulai di x=595 (di luar layar)
//   jorokan tetap  -> meluber 0px,   balasan terdalam mulai di x=271
// Komentar DIBUANG dulu. Penjelasan di berkas itu menyebut bentuk yang salah supaya
// yang membacanya paham apa yang dihindari — dan tanpa pembuangan ini, asersinya cocok
// dengan penjelasannya sendiri lalu merah padahal kodenya benar. Pola yang sama dengan
// pelajaran uji/batas-harga.test.mjs: periksa KODE, bukan kata di berkas.
const butir = readFileSync(
  new URL('../app/(sistem)/po/[id]/butir-lini.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(butir, /Math\.min\(\s*tingkat\s*,\s*INDENT_MAKS\s*\)\s*\*/,
  'jorokan balasan dikali tingkatnya lagi — totalnya menjumlah dan meluber di ponsel');
assert.match(butir, /tingkat\s*<=\s*INDENT_MAKS\s*\?\s*JOROK\s*:\s*0/,
  'jorokan balasan tidak lagi berhenti di INDENT_MAKS');
console.log('  OK  jorokan balasan tetap per tingkat dan berhenti di INDENT_MAKS');

// 4. Setiap pratinjau statis WAJIB memancarkan <meta viewport>.
//
// Tanpa itu emulasi ponsel TIDAK berlaku sama sekali: peramban memakai lebar tata letak
// bawaan ~980px, halaman tampak muat, dan luberan mendatar yang sedang dicari tidak
// pernah muncul. Pratinjaunya hijau sementara ponselnya rusak — yaitu kebalikan dari
// gunanya pratinjau.
//
// Sudah menggigit DUA KALI: pratinjau wizard (14 Sep 2026) dan pratinjau komentar
// (21 Sep 2026, pengukuran pertama atas bug luberan nyata terbaca bersih karenanya).
// Dua kali berarti pantas dijaga, bukan diperbaiki satu-satu lagi.
//
// Pengecualian ditandai di berkasnya sendiri dengan komentar PENANDA di bawah, berikut
// alasannya — pola yang sama dengan uji/kueri-baca.test.mjs.
const PENANDA = 'viewport sengaja tidak diwajibkan';
const VIEWPORT = 'name="viewport"';

const pratinjau = readdirSync(new URL('../uji/', import.meta.url))
  .filter((f) => /^pratinjau-.*\.(mjs|tsx)$/.test(f))
  .map((f) => [f, readFileSync(new URL(`../uji/${f}`, import.meta.url), 'utf8')])
  // Hanya yang benar-benar menulis halaman utuh. Pratinjau yang cuma merender potongan
  // tidak punya <head> untuk diisi.
  .filter(([, isi]) => /<!doctype html>/i.test(isi));

assert.ok(pratinjau.length >= 10,
  `cuma ${pratinjau.length} pratinjau ditemukan — penyaringnya kemungkinan salah, `
  + 'dan penjaga yang tidak menemukan apa-apa selalu hijau');

for (const [nama, isi] of pratinjau) {
  if (isi.includes(PENANDA)) {
    console.log(`  --  ${nama} dikecualikan (${PENANDA})`);
    continue;
  }
  assert.ok(isi.includes(VIEWPORT),
    `${nama} menulis halaman utuh tanpa <meta viewport>. Emulasi ponsel tidak akan `
    + 'berlaku di berkas hasilnya: innerWidth tetap ~980px dan luberan di 375px tak '
    + `terlihat. Tambahkan metanya, atau tulis "${PENANDA}" berikut alasannya.`);
}
console.log(`  OK  ${pratinjau.length} pratinjau statis memancarkan <meta viewport>`);

console.log(`\n${kisi.length + 5} penjaga tata letak lolos.`);
