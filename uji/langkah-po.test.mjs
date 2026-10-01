// Langkah wizard Form PO (catatan/11). Yang dijaga: urutan yang diputuskan, langkah
// yang hanya ada untuk PO baru, dan status langkah yang tidak menutupi halangan.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const L = muat('langkah-po');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.deepEqual(L.LANGKAH.map((l) => l.kode),
  ['cara', 'sekolah', 'paket', 'rombel', 'termin', 'penanda', 'tinjau']);
ok('urutan langkah sesuai keputusan 14 Sep 2026: paket sebelum rombel');

assert.equal(L.langkahTampil(true).some((l) => l.kode === 'cara'), false);
assert.equal(L.langkahTampil(false)[0].kode, 'cara');
ok('"Cara membuat" hanya untuk PO baru');

assert.equal(L.langkahAwal(true), 'tinjau');
assert.equal(L.langkahAwal(false), 'cara');
ok('PO baru mulai di awal, draf lama di Tinjau');

const h = [{ langkah: 'paket', pesan: 'x' }];
assert.equal(L.statusLangkah('paket', h, new Set(['paket'])), 'halangan');
assert.equal(L.statusLangkah('sekolah', h, new Set(['sekolah'])), 'lengkap');
assert.equal(L.statusLangkah('termin', h, new Set()), 'belum');
assert.equal(L.statusLangkah('paket', h, new Set()), 'belum');
ok('status: belum dibuka tetap belum meski ada halangan; sesudah dibuka halangan tampil');

assert.deepEqual(['cara', 'sekolah', 'paket', 'rombel', 'termin', 'penanda', 'tinjau'].map(L.halamanScan),
  [null, 1, 1, 1, 1, 2, null]);
ok('halaman scan per langkah');

console.log(`\n${n} pemeriksaan lolos.`);
