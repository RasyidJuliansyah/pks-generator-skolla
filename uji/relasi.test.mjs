// Bug yang menyebabkan surat tersimpan tapi tidak pernah tampil: relasi
// bersyarat unik datang sebagai objek, bukan larik.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(readFileSync(new URL('../lib/relasi.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
const { satu } = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.deepEqual(satu({ nomor: 'A' }), { nomor: 'A' });
ok('relasi unik datang sebagai objek, dikembalikan apa adanya');

assert.deepEqual(satu([{ nomor: 'A' }, { nomor: 'B' }]), { nomor: 'A' });
ok('relasi berulang datang sebagai larik, diambil yang pertama');

assert.equal(satu([]), undefined);
assert.equal(satu(null), undefined);
assert.equal(satu(undefined), undefined);
ok('larik kosong, null, dan undefined sama-sama menghasilkan undefined');

// Inilah yang dulu keliru: objek dibaca dengan [0].
const objek = { berkas: 'surat/x.png' };
assert.equal(objek[0], undefined, 'objek memang tidak punya indeks 0');
assert.equal(satu(objek).berkas, 'surat/x.png');
ok('dokumen yang tersimpan kini terbaca, bukan dianggap tidak ada');

console.log(`\n${n} pemeriksaan lolos.`);
