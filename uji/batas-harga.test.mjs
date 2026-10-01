// Harga Acquisition tidak boleh sampai ke peramban.
//
// Ditemukan 10 Sep 2026: form-po (komponen klien) -> hitung.ts -> NILAI KOMPONEN dari
// pricelist.ts. Bundler mengirim seluruh larik ke peramban, tiga tier termasuk
// Acquisition — chunk build memuat harfiah `{id:"lms",…,p:[1e5,66e3,43e3]}`. Penyaringan
// komponenUntuk() di server hanya menyaring yang TAMPIL, bukan yang TERKIRIM.
//
// Uji ini menelusuri graf impor dari setiap berkas 'use client' dan gagal bila
// lib/pricelist.ts bisa dijangkau lewat impor NILAI. Yang dilewati:
//   * `import type` / `export type` — dihapus saat kompilasi, tidak ikut dibundel;
//   * modul 'use server' — di klien ia diganti rujukan aksi server, isinya tidak
//     ikut terkirim, jadi impornya bukan jalan ke peramban.
//
// Impornya dibaca PENGURAI TypeScript, bukan regex. Versi regex punya titik buta yang
// dibuktikan QA 12 Sep 2026: polanya bisa merentang lintas baris, jadi `export type A =
// {…};` yang diikuti impor nilai terbaca sebagai satu impor tipe dan dilewati. Juga:
// `import()` dinamis diikuti, `index.tsx` diselesaikan, dan 'use client' dikenali
// meski didahului komentar.
//
// Kebenaran terakhirnya tetap chunk hasil build; `uji/pindai-bundel.mjs` memeriksanya
// sesudah `npm run build`. Uji ini penjaga cepatnya, yang jalan di setiap `periksa`.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const AKAR = new URL('..', import.meta.url).pathname;
const TERLARANG = join(AKAR, 'lib/pricelist.ts');

function berkas(dir, keluar = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) berkas(p, keluar);
    else if (/\.tsx?$/.test(n)) keluar.push(p);
  }
  return keluar;
}

const urai = (p) => ts.createSourceFile(p, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true,
  p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

// 'use client' / 'use server' hanya berlaku sebagai pernyataan PERTAMA berkas; komentar
// di atasnya tidak dihitung pernyataan.
function arahan(p) {
  const st = urai(p).statements[0];
  if (st && ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) {
    const m = st.expression.text.match(/^use (client|server)$/);
    if (m) return m[1];
  }
  return undefined;
}

function tujuan(dari, spesifier) {
  let dasar;
  if (spesifier.startsWith('@/')) dasar = join(AKAR, spesifier.slice(2));
  else if (spesifier.startsWith('.')) dasar = join(dirname(dari), spesifier);
  else return null;                                           // paket npm
  for (const c of [dasar, `${dasar}.ts`, `${dasar}.tsx`, join(dasar, 'index.ts'), join(dasar, 'index.tsx')])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

// Impor/ekspor-ulang NILAI saja, ditambah import() dinamis. Yang dilewati hanya yang
// memang dihapus kompilator: `import type`, `export type`, dan `import { type A }`
// yang SELURUH isinya tipe tanpa impor bawaan/namespace.
function imporNilai(p) {
  const out = [];
  const tambah = (spes) => { const t = tujuan(p, spes); if (t) out.push(t); };
  (function jalan(n) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const k = n.importClause;
      const tipeSaja = k && (k.isTypeOnly || (!k.name && k.namedBindings
        && ts.isNamedImports(k.namedBindings) && k.namedBindings.elements.length > 0
        && k.namedBindings.elements.every((e) => e.isTypeOnly)));
      if (!tipeSaja) tambah(n.moduleSpecifier.text);        // termasuk impor efek samping
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      if (!n.isTypeOnly) tambah(n.moduleSpecifier.text);     // export { x } from / export * from
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword
               && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      tambah(n.arguments[0].text);                           // import('…')
    }
    ts.forEachChild(n, jalan);
  })(urai(p));
  return out;
}

const semua = [...berkas(join(AKAR, 'app')), ...berkas(join(AKAR, 'lib'))];
const klien = semua.filter((p) => arahan(p) === 'client');
assert.ok(klien.length > 0, 'tidak ada berkas klien terdeteksi — pemeriksa ini rusak');

const bocor = [];
for (const akar of klien) {
  const asal = new Map([[akar, null]]);
  const antre = [akar];
  while (antre.length) {
    const kini = antre.shift();
    if (kini === TERLARANG) {
      const rantai = [];
      for (let x = kini; x; x = asal.get(x)) rantai.unshift(relative(AKAR, x));
      bocor.push(rantai.join(' -> '));
      break;
    }
    for (const t of imporNilai(kini)) {
      if (asal.has(t)) continue;
      if (t !== TERLARANG && arahan(t) === 'server') continue;
      asal.set(t, kini);
      antre.push(t);
    }
  }
}
assert.deepEqual(bocor, [],
  'pricelist.ts (berisi harga Acquisition) terjangkau dari berkas klien:\n  ' + bocor.join('\n  '));
console.log(`  OK  ${klien.length} berkas klien ditelusuri; pricelist.ts tidak terjangkau dari satu pun`);
console.log('\n1 pemeriksaan lolos.');
