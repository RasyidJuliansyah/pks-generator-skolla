// Aturan ukuran gambar adalah aturan yang menentukan permintaan diterima atau ditolak Server
// Action (batas badan 1 MB, dijaga lagi di bacaScanPo dengan pagar 900.000 byte). Diuji sebagai
// fungsi murni: peramban tidak bisa dipanggil dari node.
//
// Angka BYTE-nya tidak diuji di sini dan tidak bisa diuji sebagai fungsi murni -- ia diukur di
// peramban pada Tugas 6 langkah 8 dan dicatat sebagai komentar di lib/render-pdf.ts. Yang dijaga
// di sini adalah aturan yang menentukan angka itu (geometri dan mutu), supaya perubahan yang
// membuat satu halaman membengkak tidak lolos tanpa disadari.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { langkahTurun, MUTU, MAKS_PANJANG, DPI } = muat('render-pdf');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Halaman A4 pada 150 dpi = 1240x1754 px: cukup terbaca model, muat di bawah batas.
assert.deepEqual(langkahTurun(1240, 1754), { lebar: 1240, tinggi: 1754 });
ok('halaman pada 150 dpi dikirim apa adanya');

// Halaman yang lebih lebar dari MAKS_PANJANG diperkecil dengan rasio yang sama.
const besar = langkahTurun(2480, 3508);
assert.ok(Math.max(besar.lebar, besar.tinggi) <= MAKS_PANJANG, 'hasil harus <= MAKS_PANJANG');
assert.ok(Math.abs(besar.lebar / besar.tinggi - 2480 / 3508) < 0.001, 'rasio harus dijaga');
ok('halaman besar diperkecil dengan rasio dijaga');

// Halaman yang sudah kecil TIDAK diperbesar: ini yang menjaga berkas asal 300 dpi tidak
// dikirim ulang setelah diperkecil, dan yang membuat pengukuran di peramban bisa diulang.
assert.deepEqual(langkahTurun(600, 850), { lebar: 600, tinggi: 850 });
ok('halaman kecil tidak diperbesar');

assert.ok(MUTU > 0.5 && MUTU <= 0.8, 'mutu JPEG harus hemat tapi masih terbaca');
assert.ok(DPI >= 120 && DPI <= 200, '150 dpi dipilih dari pengukuran; di luar 120-200 perlu diukur ulang');
ok('mutu dan kerapatan berada di rentang yang diukur, bukan dikira-kira');

console.log(`\n${n} pemeriksaan lolos.`);
