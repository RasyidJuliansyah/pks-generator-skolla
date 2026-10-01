// Hitungan halaman. Yang diuji terutama kasus tepinya, karena kesalahan di sini
// tidak berisik: batas range() PostgREST inklusif di kedua ujung, jadi salah
// satu saja membuat satu baris terlewat di TIAP halaman tanpa ada galat apa pun.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(
  readFileSync(new URL('../lib/paginasi.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { halaman, jendela } = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Rentangnya inklusif: halaman berisi 20 membentang dari 0 sampai 19, bukan 20.
const h1 = halaman(100, 20, 1);
assert.deepEqual([h1.dari, h1.sampai], [0, 19]);
const h2 = halaman(100, 20, 2);
assert.deepEqual([h2.dari, h2.sampai], [20, 39]);
assert.equal(h1.jumlah, 5);
ok('rentang inklusif dan tidak tumpang tindih antar halaman');

// Sisa tidak boleh menghasilkan halaman kosong maupun baris yang tidak terjangkau.
assert.equal(halaman(101, 20, 1).jumlah, 6);
assert.equal(halaman(100, 20, 1).jumlah, 5);
assert.equal(halaman(1, 20, 1).jumlah, 1);
assert.equal(halaman(0, 20, 1).jumlah, 1, 'daftar kosong tetap satu halaman, bukan nol');
ok('jumlah halaman benar termasuk saat ada sisa dan saat kosong');

// Halaman di luar jangkauan dijepit, bukan menghasilkan daftar kosong yang
// membingungkan — orang menyunting angka di alamat, dan tautan lama basi.
assert.equal(halaman(100, 20, 99).kini, 5);
assert.equal(halaman(100, 20, 0).kini, 1);
assert.equal(halaman(100, 20, -3).kini, 1);
assert.equal(halaman(100, 20, 'abc').kini, 1);
assert.equal(halaman(100, 20, undefined).kini, 1);
assert.equal(halaman(100, 20, '3').kini, 3, 'nilai dari alamat selalu berupa teks');
ok('halaman di luar jangkauan dan masukan aneh dijepit ke rentang sah');

assert.equal(halaman(100, 20, 1).adaSebelum, false);
assert.equal(halaman(100, 20, 1).adaSesudah, true);
assert.equal(halaman(100, 20, 5).adaSesudah, false);
assert.equal(halaman(10, 20, 1).adaSesudah, false, 'satu halaman tidak punya berikutnya');
ok('penanda sebelum/sesudah benar di kedua ujung');

// Seluruh baris harus terjangkau persis sekali.
const per = 7, total = 44;
const terjangkau = new Set();
for (let i = 1; i <= halaman(total, per, 1).jumlah; i++) {
  const h = halaman(total, per, i);
  for (let x = h.dari; x <= Math.min(h.sampai, total - 1); x++) {
    assert.equal(terjangkau.has(x), false, `baris ${x} terjangkau dua kali`);
    terjangkau.add(x);
  }
}
assert.equal(terjangkau.size, total, 'ada baris yang tidak pernah terjangkau');
ok(`${total} baris dengan ${per} per halaman: semuanya terjangkau persis sekali`);

// Jendela nomor tetap selebar yang diminta dan menempel ke tepi, bukan menyempit
// di sana — yang menyempit membuat tombolnya berpindah tempat saat ditekan.
assert.deepEqual(jendela(1, 20, 7), [1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(jendela(20, 20, 7), [14, 15, 16, 17, 18, 19, 20]);
assert.deepEqual(jendela(10, 20, 7), [7, 8, 9, 10, 11, 12, 13]);
assert.deepEqual(jendela(2, 3, 7), [1, 2, 3], 'tidak mengarang halaman yang tidak ada');
assert.deepEqual(jendela(1, 1, 7), [1]);
ok('jendela nomor selebar mungkin, menempel tepi, tidak mengarang halaman');

for (let j = 1; j <= 30; j++) {
  for (let k = 1; k <= j; k++) {
    const w = jendela(k, j, 7);
    assert.ok(w.includes(k), `halaman ${k} dari ${j} tidak ada di jendelanya sendiri`);
    assert.ok(w[0] >= 1 && w[w.length - 1] <= j, `jendela ${w} keluar jangkauan pada ${k}/${j}`);
  }
}
ok('halaman yang sedang dibuka selalu ada di jendelanya sendiri');

console.log(`\n${n} pemeriksaan lolos.`);
