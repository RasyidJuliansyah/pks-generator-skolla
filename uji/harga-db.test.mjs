// Harga di basis data adalah SALINAN KETIGA. Dua salinan (aplikasi + kalkulator lama)
// sudah dijaga cap VERSI_PRICELIST; salinan ketiga ini dijaga di sini.
//
// Dua hal yang diuji, dan keduanya pernah jadi cara sistem bocor di tempat lain:
//   1. berkas seed benar-benar dihasilkan dari lib/pricelist.ts, bukan disunting tangan
//   2. ACQUISITION PRICE tidak ikut — diperiksa per angka, bukan per kata
//
// Nomor 2 penting karena "tidak ada kata acquisition di berkas" bukan bukti apa-apa;
// yang bocor adalah ANGKANYA.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(
  readFileSync(new URL('../lib/pricelist.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { KOMPONEN, PRESET, VERSI_PRICELIST } = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// 1. Seed harus cocok dengan kode. Generatornya sendiri yang memutuskan, supaya uji ini
//    tidak jadi salinan keempat dari aturan pembentukannya.
execFileSync(process.execPath, [new URL('./buat-harga-db.mjs', import.meta.url).pathname, '--cek'],
  { stdio: 'pipe' });
ok('supabase/harga-db.sql dihasilkan dari lib/pricelist.ts, bukan disunting tangan');

const sql = readFileSync(new URL('../supabase/harga-db.sql', import.meta.url), 'utf8');

// 2. Tiap komponen muncul dengan price list dan bottom-nya, dan acquisition-nya TIDAK.
const angka = (s) => (s.match(/\d+/g) ?? []).map(Number);
for (const k of KOMPONEN) {
  const baris = sql.split('\n').find((b) => b.includes(`('${k.id}',`));
  assert.ok(baris, `komponen ${k.id} tidak ada di seed`);
  const nilai = angka(baris);
  assert.ok(nilai.includes(k.p[0]), `${k.id}: price list ${k.p[0]} tidak ada di seed`);
  assert.ok(nilai.includes(k.p[1]), `${k.id}: bottom ${k.p[1]} tidak ada di seed`);
  // Acquisition hanya boleh absen. Kalau kebetulan sama dengan salah satu tier lain,
  // pengecekan ini memang tidak bisa membedakannya — dan itu disebut terang di sini
  // supaya tidak dikira lebih kuat daripada yang sebenarnya.
  if (k.p[2] !== k.p[0] && k.p[2] !== k.p[1]) {
    assert.ok(!nilai.includes(k.p[2]),
      `${k.id}: ACQUISITION PRICE ${k.p[2]} BOCOR ke basis data`);
  }
}
ok(`${KOMPONEN.length} komponen: price list & bottom ikut, acquisition tidak`);

for (const p of PRESET) {
  const baris = sql.split('\n').find((b) => b.includes(`('${p.n.replace(/'/g, "''")}',`));
  assert.ok(baris, `paket ${p.n} tidak ada di seed`);
  const nilai = angka(baris);
  assert.ok(nilai.includes(p.p[0]) && nilai.includes(p.p[1]), `${p.n}: harga tidak lengkap`);
  if (p.p[2] !== p.p[0] && p.p[2] !== p.p[1]) {
    assert.ok(!nilai.includes(p.p[2]), `${p.n}: ACQUISITION PRICE PAKET ${p.p[2]} BOCOR`);
  }
  // ids harus terurut: pencocokan paket di SQL memakai kesamaan larik apa adanya,
  // jadi urutan yang salah membuat paket tidak pernah cocok dan lantainya diam-diam
  // jatuh ke jumlah komponen.
  const urut = [...p.ids].sort();
  for (const id of urut) assert.ok(baris.includes(`'${id}'`), `${p.n}: ${id} hilang`);
  const posisi = urut.map((id) => baris.indexOf(`'${id}'`));
  assert.deepEqual(posisi, [...posisi].sort((a, b) => a - b),
    `${p.n}: ids tidak terurut — paket tidak akan pernah cocok di SQL`);
}
ok(`${PRESET.length} paket: harga ikut, acquisition tidak, ids terurut`);

assert.ok(sql.includes(`'${VERSI_PRICELIST}'`), 'cap versi tidak ikut ditulis ke seed');
ok(`cap versi ${VERSI_PRICELIST} tercatat di basis data`);

console.log(`\n${n} pemeriksaan lolos.`);
