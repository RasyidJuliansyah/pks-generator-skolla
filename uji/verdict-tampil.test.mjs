// Tampilan verdict IoM (catatan/16). Yang dijaga: setiap kode aturan punya label manusia,
// verdict yang dipakai selalu baris TERAKHIR, dan layar hanya menyebut "lolos" bila PO itu
// memang berakhir terverifikasi: versi PO dan versi IoM sama, tanpa penolakan.
//
// Sejak 22 Sep 2026 (catatan/13a Bagian 11) penutupannya dikerjakan basis data sendiri, jadi
// dua syarat yang dulu ikut diperiksa di sini sudah tidak relevan, dan menghapusnya BUKAN
// kehilangan penjagaan:
//
//   - deklarasi paket masih berlaku: dulu diperiksa di sini karena penutupan terjadi satu klik
//     kemudian, sehingga deklarasi bisa kedaluwarsa di antaranya. Celah itu hilang -- verdict
//     dan penutupan kini satu transaksi -- dan deklarasi yang tidak berlaku sudah membuat
//     verdictnya sendiri gagal lewat aturan `deklarasi-berlaku`.
//   - ada Head of Operations aktif: penutupan tidak lagi menuntut peran itu.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const V = muat('verdict-iom');
const { VERSI_IOM } = muat('iom');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const kodeMesin = [...readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8').matchAll(/cek\('([a-z-]+)'/g)]
  .map((m) => m[1]);
for (const k of [...kodeMesin, 'galat-evaluasi'])
  assert.ok(V.LABEL_ATURAN[k] && !V.LABEL_ATURAN[k].includes('—'), `label ${k} hilang atau memakai tanda pisah`);
ok(`${kodeMesin.length + 1} kode aturan punya label tanpa tanda pisah`);

const baris = (lolos, versi_po, dicatat_pada, lain = {}) =>
  ({ lolos, versi_po, dicatat_pada, gagal: [], hasil: [], paket: 'LMS Smart', versi_iom: VERSI_IOM, ...lain });
assert.equal(V.verdictTerakhir(null), null);
assert.equal(V.verdictTerakhir([baris(false, 1, '2026-09-17T01:00:00+00:00'), baris(true, 1, '2026-09-17T02:00:00+00:00')]).lolos, true);
assert.equal(V.verdictTerakhir([baris(true, 1, '2026-09-17T02:00:00+00:00'), baris(false, 1, '2026-09-17T01:00:00+00:00')]).lolos, true);
ok('verdict terakhir dipilih menurut dicatat_pada, bukan urutan larik');

const bebas = { versiPo: 2, adaPenolakan: false };
assert.equal(V.keadaanVerdict(null, bebas), 'tidak-ada');
assert.equal(V.keadaanVerdict(baris(true, 1, 'a'), bebas), 'basi');
assert.equal(V.keadaanVerdict(baris(true, 2, 'a', { versi_iom: 'iom-lama' }), bebas), 'basi');
assert.equal(V.keadaanVerdict(baris(false, 2, 'a'), bebas), 'gagal');
assert.equal(V.keadaanVerdict(baris(true, 2, 'a'), bebas), 'lolos');
// Penolakan mustahil muncul bersama verdict lolos pada keadaan normal -- verdict lolos
// langsung menutup PO dalam transaksi yang sama. Bila toh muncul, PO itu memang butuh
// keempat fungsi, jadi jawabannya "gagal", bukan "lolos".
assert.equal(V.keadaanVerdict(baris(true, 2, 'a'), { ...bebas, adaPenolakan: true }), 'gagal');
ok('keadaan: basi bila versi beda; gagal bila aturan gagal atau ada fungsi menolak; lolos selain itu');

// Syarat yang sudah tidak berlaku tidak boleh diam-diam hidup lagi di modul ini: ia akan
// membuat PO yang sudah ditutup basis data tampak tertahan, atau sebaliknya menjanjikan
// penutupan yang tidak ada lagi yang mengerjakannya.
for (const nama of ['bagiAntrean', 'adaHoO', 'deklarasiMasihBerlaku'])
  assert.equal(V[nama], undefined, `${nama} masih diekspor padahal syaratnya sudah tidak berlaku`);
ok('syarat lama (deklarasi paket, ada HoO) tidak lagi hidup di modul tampilan');

console.log(`\n${n} pemeriksaan lolos.`);
