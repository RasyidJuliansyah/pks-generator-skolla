// Satu sumber daftar dan label pihak penanda tangan (catatan/23).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { muat } from './muat.mjs';

const { SEMUA_PIHAK, pihakUntuk, labelPihak, skemaDari } = muat('pihak');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.deepEqual(pihakUntuk(3), ['kepala_sekolah', 'partnership_manager', 'sales_manager']);
assert.deepEqual(pihakUntuk(4), ['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager']);
assert.deepEqual(SEMUA_PIHAK, pihakUntuk(4));
ok('skema 3 = tiga pihak lama, skema 4 = empat pihak urut dokumen');

// Dokumen yang sudah diteken dirender ulang dengan label yang sama seperti saat diteken.
assert.equal(labelPihak('sales_manager', 3), 'Sales Manager');
assert.equal(labelPihak('sales_manager', 4), 'Head of Sales');
assert.equal(labelPihak('regional_head', 4), 'Regional Head Division');
assert.equal(labelPihak('kepala_sekolah', 3), 'Kepala Sekolah');
assert.equal(labelPihak('partnership_manager', 4), 'Partnership Manager');
ok('label Sales Manager/Head of Sales mengikuti skema');

assert.equal(skemaDari(4), 4);
for (const v of [3, undefined, null, '4', 0, 5]) assert.equal(skemaDari(v), 3, String(v));
ok('skemaDari: hanya angka 4 yang terbaca empat; data lama tanpa kolom terbaca tiga');

// Daftar dan label pihak hanya lewat pihakUntuk/labelPihak: salinan lain akan berpecah saat
// skema berubah (lini-masa.ts sempat punya LABEL_PIHAK sendiri).
const telusuri = (d) => readdirSync(d).flatMap((f) => {
  const j = `${d}/${f}`;
  if (f === 'node_modules' || f.startsWith('.')) return [];
  return statSync(j).isDirectory() ? telusuri(j) : /\.(ts|tsx)$/.test(f) ? [j] : [];
});
const akar = new URL('..', import.meta.url).pathname;
const pemakai = [...telusuri(`${akar}app`), ...telusuri(`${akar}lib`)]
  .filter((f) => /\bURUT_PIHAK\b|\bLABEL_PIHAK\b/.test(readFileSync(f, 'utf8')));
assert.deepEqual(pemakai, [], 'URUT_PIHAK/LABEL_PIHAK masih dipakai: ' + pemakai.join(', '));
ok('tidak ada lagi daftar atau label pihak di luar pihakUntuk/labelPihak');

console.log(`\n${n} pemeriksaan lolos.`);
